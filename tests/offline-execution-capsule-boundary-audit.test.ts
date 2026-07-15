import test from "node:test";
import assert from "node:assert/strict";
import {
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
