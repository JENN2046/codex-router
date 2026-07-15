import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  collectExportedPublicFacadeText,
  collectOfflineExecutionCapsuleBoundaryAuditInput,
  formatOfflineExecutionCapsuleBoundaryAuditResult,
  reviewOfflineExecutionCapsuleBoundary
} from "../scripts/run-offline-execution-capsule-boundary-audit.js";

test("offline execution capsule boundary audit passes for the internal test-only surface", async () => {
  const result = reviewOfflineExecutionCapsuleBoundary(
    await collectOfflineExecutionCapsuleBoundaryAuditInput()
  );
  assert.equal(result.status, "passed");
  assert.deepEqual(result.reasons, []);
  assert.ok(Object.values(result.checks).every(Boolean));
  assert.equal(result.summary.executionMode, "test_only_simulated");
  assert.equal(result.summary.contentStoreMode, "in_memory_only");
  assert.equal(result.summary.publicExported, false);
  assert.equal(result.summary.liveExecutionAuthorized, false);
  assert.equal(result.summary.autoApprovalEligible, false);
  assert.equal(result.summary.retainEligible, false);
  assert.equal(result.summary.applyEligible, false);
  assert.equal(result.summary.workspaceWriteEligible, false);
  assert.equal(result.summary.injectedTransformSideEffectsMechanicallyExcluded, false);
  assert.equal(result.summary.capsuleSourceRuntimeIoImportsPresent, false);
  assert.equal(result.summary.childProcessesStartedDuringAudit, 0);
  assert.equal(result.summary.socketsOpenedDuringAudit, 0);
  assert.equal(result.summary.providerCallsDuringAudit, 0);
  assert.equal(result.summary.filesystemWritesDuringAudit, 0);
});

test("offline execution capsule boundary blocks bare builtins, environment access, and renamed stores", async () => {
  const input = await collectOfflineExecutionCapsuleBoundaryAuditInput();
  const scenarios: Array<{
    source: string;
    reasons: string[];
  }> = [
    {
      source: 'import { readFile } from "fs";',
      reasons: [
        "offline_execution_capsule_boundary_sourceImportsAllowlisted",
        "offline_execution_capsule_boundary_noFilesystemProcessOrSocketImports"
      ]
    },
    {
      source: 'import { execFile } from "child_process";',
      reasons: [
        "offline_execution_capsule_boundary_sourceImportsAllowlisted",
        "offline_execution_capsule_boundary_noFilesystemProcessOrSocketImports"
      ]
    },
    {
      source: 'import { readFile } from/* capsule */"fs";',
      reasons: [
        "offline_execution_capsule_boundary_sourceImportsAllowlisted",
        "offline_execution_capsule_boundary_noFilesystemProcessOrSocketImports"
      ]
    },
    {
      source: 'void import/* capsule */("fs");',
      reasons: [
        "offline_execution_capsule_boundary_sourceImportsAllowlisted",
        "offline_execution_capsule_boundary_noFilesystemProcessOrSocketImports"
      ]
    },
    {
      source: 'const diskStore = { read: async () => import/* capsule */("fs") };',
      reasons: [
        "offline_execution_capsule_boundary_sourceImportsAllowlisted",
        "offline_execution_capsule_boundary_noFilesystemProcessOrSocketImports"
      ]
    },
    {
      source: 'import legacyFs = require("fs");',
      reasons: [
        "offline_execution_capsule_boundary_sourceImportsAllowlisted",
        "offline_execution_capsule_boundary_noFilesystemProcessOrSocketImports"
      ]
    },
    {
      source: 'const legacyFs = require/* capsule */("fs");',
      reasons: [
        "offline_execution_capsule_boundary_sourceImportsAllowlisted",
        "offline_execution_capsule_boundary_noFilesystemProcessOrSocketImports",
        "offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"
      ]
    },
    {
      source: "class DiskCas {}",
      reasons: ["offline_execution_capsule_boundary_inMemoryContentStoreOnly"]
    },
    {
      source: "const ambient = process.env.OFFLINE_CAPSULE_FIXTURE_SECRET;",
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: 'const ambient = process["env"].OFFLINE_CAPSULE_FIXTURE_SECRET;',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: 'process.getBuiltinModule("fs").readFileSync("fixture");',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: "const request = fetch; request('https://example.invalid');",
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: '(() => {}).constructor("return process")().getBuiltinModule("fs");',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: 'const key = "constructor"; (() => {})[key]("return process")();',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: '(() => {})["con" + "structor"]("return process")();',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: '(() => {})[["con", "structor"].join("")]("return process")();',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: '(() => {})[String.fromCharCode(99,111,110,115,116,114,117,99,116,111,114)]("return process")();',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: 'Reflect.get((() => {}), String.fromCharCode(99,111,110,115,116,114,117,99,116,111,114))("return process")();',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: 'Object.getOwnPropertyDescriptor((() => {}), String.fromCharCode(99,111,110,115,116,114,117,99,116,111,114))?.value("return process")();',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: 'Object["getOwn" + "PropertyDescriptor"]((() => {}), String.fromCharCode(99,111,110,115,116,114,117,99,116,111,114))?.value("return process")();',
      reasons: ["offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"]
    },
    {
      source: "class DiskCAS {}",
      reasons: ["offline_execution_capsule_boundary_inMemoryContentStoreOnly"]
    },
    {
      source: "class DiskStore {}",
      reasons: ["offline_execution_capsule_boundary_inMemoryContentStoreOnly"]
    },
    {
      source: "class/* capsule */DiskStore {}",
      reasons: ["offline_execution_capsule_boundary_inMemoryContentStoreOnly"]
    },
    {
      source: "const diskStore = class {};",
      reasons: ["offline_execution_capsule_boundary_inMemoryContentStoreOnly"]
    }
  ];
  for (const scenario of scenarios) {
    const result = reviewOfflineExecutionCapsuleBoundary({
      ...input,
      sourceText: `${input.sourceText}\n${scenario.source}`
    });
    assert.equal(result.status, "blocked", scenario.source);
    for (const reason of scenario.reasons) {
      assert.ok(result.reasons.includes(reason), `${scenario.source}: ${reason}`);
    }
  }
});

test("offline execution capsule boundary permits statically known computed data keys", async () => {
  const input = await collectOfflineExecutionCapsuleBoundaryAuditInput();
  const result = reviewOfflineExecutionCapsuleBoundary({
    ...input,
    sourceText: `${input.sourceText}\nconst safeValue = ({ value: 1 })["value"]; const first = [1][0];`
  });
  assert.equal(result.status, "passed");
  assert.deepEqual(result.reasons, []);
});

test("offline execution capsule boundary blocks process and public export broadening", async () => {
  const input = await collectOfflineExecutionCapsuleBoundaryAuditInput();
  const processResult = reviewOfflineExecutionCapsuleBoundary({
    ...input,
    sourceText: `${input.sourceText}\nimport { spawn } from "node:child_process";\nspawn("worker", []);`
  });
  assert.equal(processResult.status, "blocked");
  assert.ok(processResult.reasons.includes(
    "offline_execution_capsule_boundary_noFilesystemProcessOrSocketImports"
  ));
  assert.ok(processResult.reasons.includes(
    "offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"
  ));

  const packageJson = JSON.parse(input.packageJsonText) as {
    exports: Record<string, unknown>;
  };
  packageJson.exports["./execution-capsule"] =
    "./dist/packages/execution-capsule/src/index.js";
  const exportResult = reviewOfflineExecutionCapsuleBoundary({
    ...input,
    packageJsonText: JSON.stringify(packageJson)
  });
  assert.equal(exportResult.status, "blocked");
  assert.ok(exportResult.reasons.includes(
    "offline_execution_capsule_boundary_publicExportAbsent"
  ));

  const aliasedPackageJson = structuredClone(packageJson);
  delete aliasedPackageJson.exports["./execution-capsule"];
  aliasedPackageJson.exports["./offline-capsule"] = {
    types: ["./dist/packages/execution-capsule/src/index.d.ts"],
    default: "./dist/packages/offline-capsule/src/index.js"
  };
  const aliasedExportResult = reviewOfflineExecutionCapsuleBoundary({
    ...input,
    packageJsonText: JSON.stringify(aliasedPackageJson)
  });
  assert.equal(aliasedExportResult.status, "blocked");
  assert.ok(aliasedExportResult.reasons.includes(
    "offline_execution_capsule_boundary_publicExportAbsent"
  ));
});

test("offline execution capsule boundary discovers facade files from package exports", async () => {
  const input = await collectOfflineExecutionCapsuleBoundaryAuditInput();
  const cwd = await mkdtemp(join(tmpdir(), "offline-capsule-export-facade-"));
  try {
    const publicApiDirectory = join(cwd, "packages", "public-api", "src");
    const bridgeDirectory = join(cwd, "packages", "capsule-bridge", "src");
    const capsuleDirectory = join(cwd, "packages", "execution-capsule", "src");
    await Promise.all([
      mkdir(publicApiDirectory, { recursive: true }),
      mkdir(bridgeDirectory, { recursive: true }),
      mkdir(capsuleDirectory, { recursive: true })
    ]);
    await writeFile(join(publicApiDirectory, "protocol.ts"), "export const safe = true;\n");
    await writeFile(
      join(publicApiDirectory, "capsule-facade.ts"),
      'export * from "./capsule-helper.js";\n'
    );
    await writeFile(
      join(publicApiDirectory, "capsule-helper.ts"),
      'export * from "../../capsule-bridge/src/index.js";\n'
    );
    await writeFile(
      join(bridgeDirectory, "index.ts"),
      'export * from "../../execution-capsule/src/index.js";\n'
    );
    await writeFile(join(capsuleDirectory, "index.ts"), "export const internal = true;\n");
    const packageJsonText = JSON.stringify({
      exports: {
        "./protocol": {
          types: "./dist/packages/public-api/src/protocol.d.ts",
          import: "./dist/packages/public-api/src/protocol.js"
        },
        "./capsule-facade": "./packages/public-api/src/capsule-facade.ts"
      }
    });
    const publicApiText = await collectExportedPublicFacadeText(packageJsonText, cwd);
    assert.match(publicApiText, /capsule-facade\.ts/u);
    assert.match(publicApiText, /capsule-helper\.ts/u);
    assert.match(publicApiText, /capsule-bridge/u);
    assert.match(publicApiText, /execution-capsule/u);

    const result = reviewOfflineExecutionCapsuleBoundary({
      ...input,
      packageJsonText,
      publicApiText
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.reasons.includes(
      "offline_execution_capsule_boundary_publicExportAbsent"
    ));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("offline execution capsule boundary maps NodeNext facade targets", async () => {
  const input = await collectOfflineExecutionCapsuleBoundaryAuditInput();
  const cwd = await mkdtemp(join(tmpdir(), "offline-capsule-nodenext-facade-"));
  try {
    const publicApiDirectory = join(cwd, "packages", "public-api", "src");
    await mkdir(publicApiDirectory, { recursive: true });
    await writeFile(join(publicApiDirectory, "hidden.mts"), "export const safe = true;\n");
    const packageJsonText = JSON.stringify({
      exports: {
        "./hidden": {
          types: "./dist/packages/public-api/src/hidden.d.mts",
          import: "./dist/packages/public-api/src/hidden.mjs"
        }
      }
    });
    const publicApiText = await collectExportedPublicFacadeText(packageJsonText, cwd);
    assert.match(publicApiText, /hidden\.mts/u);
    const result = reviewOfflineExecutionCapsuleBoundary({
      ...input,
      packageJsonText,
      publicApiText
    });
    assert.equal(result.status, "passed");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test(
  "offline execution capsule boundary canonicalizes symlinked facade roots",
  { skip: process.platform === "win32" },
  async () => {
    const cwd = await mkdtemp(join(tmpdir(), "offline-capsule-linked-facade-root-"));
    try {
      const repositoryRoot = join(cwd, "repository");
      const linkedRoot = join(cwd, "repository-link");
      const publicApiDirectory = join(repositoryRoot, "packages", "public-api", "src");
      await mkdir(publicApiDirectory, { recursive: true });
      await writeFile(join(publicApiDirectory, "protocol.ts"), "export const safe = true;\n");
      await symlink(repositoryRoot, linkedRoot, "dir");
      const publicApiText = await collectExportedPublicFacadeText(JSON.stringify({
        exports: { "./protocol": "./dist/packages/public-api/src/protocol.js" }
      }), linkedRoot);
      assert.match(publicApiText, /protocol\.ts/u);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
);

test("offline execution capsule boundary fails closed on unmapped local facade targets", async () => {
  await assert.rejects(
    collectExportedPublicFacadeText(JSON.stringify({
      exports: { "./hidden": "./dist/packages/public-api/src/hidden.json" }
    })),
    /offline_capsule_public_facade_target_unmapped/u
  );
});

test("offline execution capsule boundary fails closed on missing local facade dependencies", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "offline-capsule-missing-facade-dependency-"));
  try {
    const publicApiDirectory = join(cwd, "packages", "public-api", "src");
    await mkdir(publicApiDirectory, { recursive: true });
    await writeFile(
      join(publicApiDirectory, "capsule-facade.ts"),
      'export * from "./missing-helper.js";\n'
    );
    const packageJsonText = JSON.stringify({
      exports: {
        "./capsule-facade": "./packages/public-api/src/capsule-facade.ts"
      }
    });
    await assert.rejects(
      collectExportedPublicFacadeText(packageJsonText, cwd),
      /offline_capsule_public_facade_dependency_missing/u
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("offline execution capsule boundary parses and constrains public facade module loading", async () => {
  const input = await collectOfflineExecutionCapsuleBoundaryAuditInput();
  const scenarios = [
    'export * from "../execution\\u002dcapsule/src/index.js";',
    'export * from "../execution%2dcapsule/src/index.js";',
    'export const load = () => import("../execution-" + "capsule/src/index.js");',
    'const path = "../execution-capsule/src/index.js"; export const load = () => import(path);',
    'export const load = () => require("../execution-capsule/src/index.js");',
    'import capsule = require("../execution-capsule/src/index.js"); export { capsule };',
    "export * from;"
  ];
  for (const publicApiText of scenarios) {
    const result = reviewOfflineExecutionCapsuleBoundary({
      ...input,
      publicApiText: `${publicApiText}\n`
    });
    assert.equal(result.status, "blocked", publicApiText);
    assert.ok(result.reasons.includes(
      "offline_execution_capsule_boundary_publicExportAbsent"
    ), publicApiText);
  }
});

test("offline execution capsule boundary blocks approval, retain, provider, and remote store coupling", async () => {
  const input = await collectOfflineExecutionCapsuleBoundaryAuditInput();
  const result = reviewOfflineExecutionCapsuleBoundary({
    ...input,
    sourceText: `${input.sourceText}
import { issueRetainPermit } from "../../retain-control/src/index.js";
import { executeProvider } from "../../provider-core/src/index.js";
class RemoteContentAddressedStore {}`
  });
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "offline_execution_capsule_boundary_inMemoryContentStoreOnly"
  ));
  assert.ok(result.reasons.includes(
    "offline_execution_capsule_boundary_noProviderOrHostExecutionCoupling"
  ));
  assert.ok(result.reasons.includes(
    "offline_execution_capsule_boundary_noApprovalRetainApplyCoupling"
  ));
});

test("offline execution capsule audit output is summarized and secret-free", async () => {
  const output = formatOfflineExecutionCapsuleBoundaryAuditResult(
    reviewOfflineExecutionCapsuleBoundary(
      await collectOfflineExecutionCapsuleBoundaryAuditInput()
    )
  );
  assert.doesNotMatch(output, /OPENAI_API_KEY|sk-proj-|Bearer\s/u);
  assert.doesNotMatch(output, /unifiedDiff|instruction|successCriteria/u);
});
