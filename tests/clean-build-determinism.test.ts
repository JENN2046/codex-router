import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { cleanBuildOutput } from "../scripts/clean-build-output.js";
import {
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
