import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { cleanBuildOutput } from "../scripts/clean-build-output.js";
import {
  appendUniqueAuditDiagnostic,
  type CleanBuildDiagnostic,
  normalizeAuditDiagnostic,
  resolveNpmInvocation,
  runCleanBuildDeterminismAudit
} from "../scripts/run-clean-build-determinism-audit.js";

test("clean build removes only the validated repository-local dist directory", async (context) => {
  const root = await createCleanerFixture("codex-router", "dist");
  context.after(() => rm(root, { recursive: true, force: true }));
  const sentinel = resolve(root, "dist", "stale-package", "index.js");
  await mkdir(resolve(root, "dist", "stale-package"), { recursive: true });
  await writeFile(sentinel, "stale\n", "utf8");

  const result = await cleanBuildOutput(root);

  assert.deepEqual(result, {
    status: "cleaned",
    target: "dist",
    existed: true
  });
  await assert.rejects(readFile(sentinel, "utf8"));
});

test("clean build fails closed on the wrong repository identity", async (context) => {
  const root = await createCleanerFixture("another-package", "dist");
  context.after(() => rm(root, { recursive: true, force: true }));
  const sentinel = resolve(root, "dist", "keep.txt");
  await mkdir(resolve(root, "dist"), { recursive: true });
  await writeFile(sentinel, "keep\n", "utf8");

  await assert.rejects(
    cleanBuildOutput(root),
    /clean_build_repository_identity_mismatch/u
  );
  assert.equal(await readFile(sentinel, "utf8"), "keep\n");
});

test("clean build fails closed when TypeScript outDir is not repository dist", async (context) => {
  const root = await createCleanerFixture("codex-router", "../outside");
  context.after(() => rm(root, { recursive: true, force: true }));
  const sentinel = resolve(root, "dist", "keep.txt");
  await mkdir(resolve(root, "dist"), { recursive: true });
  await writeFile(sentinel, "keep\n", "utf8");

  await assert.rejects(cleanBuildOutput(root), /clean_build_outdir_mismatch/u);
  assert.equal(await readFile(sentinel, "utf8"), "keep\n");
});

test("clean-build audit proves stale and empty dist builds pack identical files", async () => {
  const result = await runCleanBuildDeterminismAudit();

  assert.equal(result.status, "passed", result.reasons.join(","));
  assert.deepEqual(result.checks, {
    removedSourceOutputInitiallyEmitted: true,
    staleOutputRemovedBeforeRebuild: true,
    dirtyAndEmptyDistFilesMatch: true,
    dirtyAndEmptyPackFileListsMatch: true
  });
  assert.ok(result.summary.dirtyBuildDistFileCount > 0);
  assert.equal(
    result.summary.dirtyBuildDistFileCount,
    result.summary.emptyBuildDistFileCount
  );
  assert.ok(result.summary.dirtyBuildPackFileCount > 0);
  assert.equal(
    result.summary.dirtyBuildPackFileCount,
    result.summary.emptyBuildPackFileCount
  );
  assert.match(result.summary.distDigest, /^[a-f0-9]{64}$/u);
  assert.match(result.summary.packFileListDigest, /^[a-f0-9]{64}$/u);
  assert.equal(result.summary.coreOnlyArtifactProven, false);
  assert.equal(result.summary.artifactAllowlistChanged, false);
  assert.equal(result.summary.runtimeSurfaceChanged, false);
  assert.deepEqual(result.diagnostics, []);
});

test("clean-build audit invokes npm safely on Windows and POSIX", () => {
  assert.deepEqual(resolveNpmInvocation(["run", "build"], {
    platform: "win32",
    npmExecPath: "C:/node/node_modules/npm/bin/npm-cli.js",
    nodeExecutable: "C:/node/node.exe"
  }), {
    command: "C:/node/node.exe",
    argv: ["C:/node/node_modules/npm/bin/npm-cli.js", "run", "build"]
  });
  assert.deepEqual(resolveNpmInvocation(["pack", "--dry-run"], {
    platform: "linux"
  }), {
    command: "npm",
    argv: ["pack", "--dry-run"]
  });
});

test("clean-build diagnostics bind every fixed audit stage and reject arbitrary stages", () => {
  for (const stage of ["copy", "build", "pack", "manifest", "cleanup"] as const) {
    assert.deepEqual(normalizeAuditDiagnostic(stage, "unexpected"), {
      stage,
      category: "unknown_error",
      reason: `clean_build_determinism_${stage}_unknown_error`
    });
  }
  assert.throws(
    () => normalizeAuditDiagnostic("host-runtime", new Error("failure")),
    /clean_build_diagnostic_stage_invalid/u
  );
});

test("clean-build diagnostics retain only bounded child-process categories", () => {
  const error = Object.assign(new Error("spawn failed at /private/fixture"), {
    code: 7,
    signal: "SIGTERM",
    stdout: "secret stdout",
    stderr: "secret stderr",
    command: "npm run build --token secret",
    argv: ["--token", "secret"],
    cwd: "/private/fixture",
    env: { SECRET_TOKEN: "secret" },
    path: "/private/npm"
  });
  const diagnostic = normalizeAuditDiagnostic("build", error);

  assert.deepEqual(diagnostic, {
    stage: "build",
    category: "child_process_exit",
    reason: "clean_build_determinism_build_child_process_exit",
    exitCodeCategory: "nonzero",
    signalCategory: "SIGTERM"
  });
  assert.deepEqual(Object.keys(diagnostic).sort(), [
    "category",
    "exitCodeCategory",
    "reason",
    "signalCategory",
    "stage"
  ]);
  assert.doesNotMatch(
    JSON.stringify(diagnostic),
    /private|secret|stdout|stderr|command|argv|cwd|env|token|npm/iu
  );
});

test("clean-build diagnostics classify approved filesystem codes without paths", () => {
  for (const filesystemCode of [
    "EACCES",
    "EBUSY",
    "EEXIST",
    "EIO",
    "ENOENT",
    "ENOSPC",
    "ENOTDIR",
    "EPERM",
    "ETIMEDOUT"
  ]) {
    const diagnostic = normalizeAuditDiagnostic("cleanup", Object.assign(
      new Error(`cannot remove /private/${filesystemCode}`),
      { code: filesystemCode, path: `/private/${filesystemCode}` }
    ));
    assert.deepEqual(diagnostic, {
      stage: "cleanup",
      category: "filesystem_error",
      reason: "clean_build_determinism_cleanup_filesystem_error",
      filesystemCode
    });
    assert.doesNotMatch(JSON.stringify(diagnostic), /private/iu);
  }

  assert.deepEqual(normalizeAuditDiagnostic("copy", Object.assign(
    new Error("unsafe"),
    { code: "EHOSTUNREACH", path: "/private/host" }
  )), {
    stage: "copy",
    category: "unknown_error",
    reason: "clean_build_determinism_copy_unknown_error"
  });
});

test("clean-build diagnostics classify JSON and preserve explicit manifest mismatch reasons", () => {
  assert.deepEqual(normalizeAuditDiagnostic(
    "pack",
    new SyntaxError("Unexpected token in private npm pack output")
  ), {
    stage: "pack",
    category: "json_parse_error",
    reason: "clean_build_determinism_pack_json_parse_error"
  });
  assert.deepEqual(normalizeAuditDiagnostic(
    "manifest",
    new Error("clean_build_dist_manifest_mismatch")
  ), {
    stage: "manifest",
    category: "manifest_mismatch",
    reason: "clean_build_dist_manifest_mismatch"
  });
  assert.deepEqual(normalizeAuditDiagnostic(
    "manifest",
    new Error("clean_build_pack_file_list_mismatch")
  ), {
    stage: "manifest",
    category: "manifest_mismatch",
    reason: "clean_build_pack_file_list_mismatch"
  });
});

test("clean-build diagnostics fail closed for unexpected error shapes", () => {
  for (const error of [
    undefined,
    null,
    42,
    "raw private error",
    ["raw", "error"],
    { message: "Raw path /private/fixture" },
    { message: "safe_reason", code: "NOT_ALLOWED", path: "/private/fixture" }
  ]) {
    const diagnostic = normalizeAuditDiagnostic("manifest", error);
    assert.deepEqual(Object.keys(diagnostic).sort(), [
      "category",
      "reason",
      "stage"
    ]);
    assert.doesNotMatch(JSON.stringify(diagnostic), /private|raw|fixture/iu);
  }
  assert.deepEqual(
    normalizeAuditDiagnostic("manifest", new Error("safe_reason")),
    {
      stage: "manifest",
      category: "unknown_error",
      reason: "clean_build_determinism_manifest_unknown_error"
    }
  );
  assert.deepEqual(
    normalizeAuditDiagnostic(
      "build",
      new Error("clean_build_npm_execpath_missing")
    ),
    {
      stage: "build",
      category: "unknown_error",
      reason: "clean_build_npm_execpath_missing"
    }
  );
});

test("clean-build diagnostics retain primary and cleanup failures independently", () => {
  const diagnostics: CleanBuildDiagnostic[] = [];
  const primary = normalizeAuditDiagnostic("build", Object.assign(
    new Error("private child-process failure"),
    { code: 1, stdout: "private stdout", stderr: "private stderr" }
  ));
  const cleanup = normalizeAuditDiagnostic("cleanup", Object.assign(
    new Error("cannot remove /private/fixture"),
    { code: "EBUSY", path: "/private/fixture" }
  ));

  appendUniqueAuditDiagnostic(diagnostics, primary);
  appendUniqueAuditDiagnostic(diagnostics, cleanup);
  appendUniqueAuditDiagnostic(diagnostics, primary);

  assert.deepEqual(diagnostics, [primary, cleanup]);
  assert.doesNotMatch(
    JSON.stringify(diagnostics),
    /private|stdout|stderr|fixture/iu
  );
});

async function createCleanerFixture(
  packageName: string,
  outDir: string
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "codex-router-clean-build-"));
  await writeFile(resolve(root, "package.json"), `${JSON.stringify({
    name: packageName
  })}\n`, "utf8");
  await writeFile(resolve(root, "tsconfig.json"), `${JSON.stringify({
    compilerOptions: { outDir }
  })}\n`, "utf8");
  return root;
}
