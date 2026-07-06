import test from "node:test";
import assert from "node:assert/strict";
import {
  createApprovedWorkspaceWriteProviderExecutionPermit,
  createApprovedWorkspaceWriteProviderExecutionPermitV2,
  createBlockedWorkspaceWriteProviderExecutionPermit,
  ExecutorExecutionPlanSchema,
  hashProviderManifest,
  ProviderManifestSchema,
  type ExecutorExecutionPlan,
  type ProviderManifest,
  type WorkspaceWriteProviderExecutionPermit,
  type WorkspaceWriteProviderExecutionPermitV2
} from "../packages/provider-core/src/index.js";
import { SandboxProfileSchema, type SandboxProfile } from "../packages/kernel-contracts/src/index.js";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  PR_12B_REAL_CANARY_BRANCH,
  PR_12B_REAL_CANARY_WORKSPACE,
  WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV,
  createWorkspaceWriteRealCanaryConfigFromEnv,
  createWorkspaceWriteRollbackPlanEvidence,
  evaluateWorkspaceWriteCanaryReadiness,
  evaluateWorkspaceWriteRealCanaryAuthorization,
  evaluateWorkspaceWriteRealCanaryPreExecutionGate,
  evaluateWorkspaceWritePatchGuard,
  inspectWorkspaceWriteUnifiedDiff
} from "../packages/governance-internal-workspace-write-guard/src/index.js";

test("workspace-write guard passes bounded permitted diffs", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 4
  });
  const result = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      "diff --git a/workspace/packages/provider-core/src/index.ts b/workspace/packages/provider-core/src/index.ts",
      "--- a/workspace/packages/provider-core/src/index.ts",
      "+++ b/workspace/packages/provider-core/src/index.ts",
      "@@",
      "-old line",
      "+new line"
    ].join("\n")
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "passed");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.summary.changedFileCount, 1);
  assert.equal(result.summary.diffLineCount, 2);
  assert.equal(result.summary.changedFiles[0]?.path, "workspace/packages/provider-core/src/index.ts");
  assert.match(result.summary.patchHash, /^[a-f0-9]{64}$/);
});

test("workspace-write guard blocks file and diff size violations", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 2
  });
  const result = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      "diff --git a/workspace/packages/provider-core/src/index.ts b/workspace/packages/provider-core/src/index.ts",
      "--- a/workspace/packages/provider-core/src/index.ts",
      "+++ b/workspace/packages/provider-core/src/index.ts",
      "@@",
      "-old line",
      "+new line",
      "+extra line",
      "diff --git a/workspace/tests/provider-core.test.ts b/workspace/tests/provider-core.test.ts",
      "--- a/workspace/tests/provider-core.test.ts",
      "+++ b/workspace/tests/provider-core.test.ts",
      "@@",
      "+unpermitted"
    ].join("\n")
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("workspace_write_patch_guard_changed_files_exceed_max"));
  assert.ok(result.reasons.includes("workspace_write_patch_guard_diff_lines_exceed_max"));
  assert.ok(result.reasons.includes(
    "workspace_write_patch_guard_changed_file_not_permitted:workspace/tests/provider-core.test.ts"
  ));
});

test("workspace-write guard blocks unsafe paths and unapproved permits", () => {
  const permit = createWorkspaceWritePermit({
    approved: false,
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 2,
    maxDiffLines: 10
  });
  const result = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      "diff --git a/../outside.ts b/../outside.ts",
      "--- a/../outside.ts",
      "+++ b/../outside.ts",
      "@@",
      "+outside"
    ].join("\n")
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes("workspace_write_patch_guard_permit_not_approved:blocked"));
  assert.ok(result.reasons.includes("workspace_write_patch_guard_changed_file_out_of_bounds"));
  assert.ok(result.reasons.includes("workspace_write_patch_guard_changed_file_not_permitted:../outside.ts"));
});

test("workspace-write guard detects secret-like diff content without returning raw diff", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 4
  });
  const result = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      "diff --git a/workspace/packages/provider-core/src/index.ts b/workspace/packages/provider-core/src/index.ts",
      "--- a/workspace/packages/provider-core/src/index.ts",
      "+++ b/workspace/packages/provider-core/src/index.ts",
      "@@",
      "+const fixture = \"sk-proj-123456789\";"
    ].join("\n")
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes("workspace_write_patch_guard_secret_like_content"));
  assert.equal(result.summary.secretMarkerCount, 1);
  assert.equal(serialized.includes("sk-proj-123456789"), false);
  assert.equal(serialized.includes("const fixture"), false);
  assert.equal(serialized.includes("raw patch"), false);
});

test("workspace-write guard inspects unified diff summaries without raw content", () => {
  const inspection = inspectWorkspaceWriteUnifiedDiff([
    "diff --git a/workspace/a.ts b/workspace/a.ts",
    "--- a/workspace/a.ts",
    "+++ b/workspace/a.ts",
    "@@",
    "-a",
    "+b"
  ].join("\n"));

  assert.equal(inspection.changedFileCount, 1);
  assert.equal(inspection.diffLineCount, 2);
  assert.equal(inspection.changedFiles[0]?.addedLines, 1);
  assert.equal(inspection.changedFiles[0]?.removedLines, 1);
  assert.match(inspection.patchHash, /^[a-f0-9]{64}$/);
});

test("workspace-write rollback evidence records before commit and patch hash", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 4
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createSafeDiff()
  });
  const evidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.schemaVersion, "workspace-write-rollback-plan-evidence.v1");
  assert.equal(evidence.status, "ready");
  assert.equal(evidence.beforeCommit, "abc123def456");
  assert.equal(evidence.patchHash, guardResult.summary.patchHash);
  assert.deepEqual(evidence.changedFiles.map((file) => file.path), [
    "workspace/packages/provider-core/src/index.ts"
  ]);
  assert.equal(evidence.rollback.available, true);
  assert.equal(
    evidence.rollback.command,
    "git restore --source abc123def456 -- workspace/packages/provider-core/src/index.ts"
  );
  assert.deepEqual(evidence.blockingReasons, []);
  assert.equal(evidence.checks.noRawPatch, true);
  assert.equal(serialized.includes("old line"), false);
  assert.equal(serialized.includes("new line"), false);
});

test("workspace-write rollback evidence blocks when guard failed", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 4
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      "diff --git a/workspace/tests/provider-core.test.ts b/workspace/tests/provider-core.test.ts",
      "--- a/workspace/tests/provider-core.test.ts",
      "+++ b/workspace/tests/provider-core.test.ts",
      "@@",
      "+unpermitted"
    ].join("\n")
  });
  const evidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.equal(evidence.status, "blocked");
  assert.equal(evidence.rollback.available, false);
  assert.ok(evidence.blockingReasons.includes("workspace_write_rollback_plan_guard_not_passed"));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_patch_guard_changed_file_not_permitted:workspace/tests/provider-core.test.ts"
  ));
});

test("workspace-write rollback evidence requires before commit", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 4
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createSafeDiff()
  });
  const evidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "   ",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.equal(evidence.status, "blocked");
  assert.equal(evidence.checks.beforeCommitRecorded, false);
  assert.equal(evidence.checks.rollbackCommandRecorded, false);
  assert.equal(evidence.rollback.command, undefined);
  assert.ok(evidence.blockingReasons.includes("workspace_write_rollback_plan_before_commit_required"));
});

test("workspace-write rollback evidence stays sanitized after secret-like guard input", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 4
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      "diff --git a/workspace/packages/provider-core/src/index.ts b/workspace/packages/provider-core/src/index.ts",
      "--- a/workspace/packages/provider-core/src/index.ts",
      "+++ b/workspace/packages/provider-core/src/index.ts",
      "@@",
      "+const fixture = \"sk-proj-123456789\";"
    ].join("\n")
  });
  const evidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.status, "blocked");
  assert.ok(evidence.blockingReasons.includes("workspace_write_patch_guard_secret_like_content"));
  assert.equal(serialized.includes("sk-proj-123456789"), false);
  assert.equal(serialized.includes("const fixture"), false);
  assert.equal(serialized.includes("raw patch"), false);
});

test("workspace-write canary readiness blocks without explicit operator gate", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: [DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE],
    maxChangedFiles: 1,
    maxDiffLines: 2
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createCanaryDiff()
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const readiness = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    operatorGateEnabled: false
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.reasons.includes("workspace_write_canary_readiness_operator_gate_required"));
  assert.equal(readiness.summary.fixedTarget, true);
  assert.equal(readiness.summary.providerExecuteCalls, 0);
  assert.equal(readiness.summary.realCodexCliCalls, 0);
  assert.equal(readiness.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(readiness.summary.canaryFileWrites, 0);
});

test("workspace-write canary readiness can become ready for a fixed fake target", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: [DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE],
    maxChangedFiles: 1,
    maxDiffLines: 2
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createCanaryDiff()
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const readiness = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    operatorGateEnabled: true
  });
  const serialized = JSON.stringify(readiness);

  assert.equal(readiness.ok, true);
  assert.equal(readiness.status, "ready");
  assert.deepEqual(readiness.reasons, []);
  assert.equal(readiness.summary.targetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(readiness.summary.fixedTarget, true);
  assert.equal(readiness.summary.operatorGateEnabled, true);
  assert.equal(readiness.summary.permitApproved, true);
  assert.equal(readiness.summary.patchGuardPassed, true);
  assert.equal(readiness.summary.rollbackReady, true);
  assert.equal(readiness.summary.providerExecuteCalls, 0);
  assert.equal(readiness.summary.realCodexCliCalls, 0);
  assert.equal(readiness.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(readiness.summary.canaryFileWrites, 0);
  assert.equal(serialized.includes("canary=ready"), false);
});

test("workspace-write canary readiness accepts permit v2 without execution", () => {
  const permit = createWorkspaceWritePermitV2({
    targetFiles: [DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE],
    maxChangedFiles: 1,
    maxDiffLines: 2
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createCanaryDiff()
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const readiness = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    operatorGateEnabled: true
  });
  const unsafeGuard = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      `diff --git a/${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE} b/${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}`,
      `--- a/${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}`,
      `+++ b/${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}`,
      "@@",
      "+canary=ready",
      "diff --git a/../outside.txt b/../outside.txt",
      "--- a/../outside.txt",
      "+++ b/../outside.txt",
      "@@",
      "+const secret = \"sk-proj-123456789\";"
    ].join("\n")
  });
  const serializedUnsafeGuard = JSON.stringify(unsafeGuard);

  assert.equal(guardResult.ok, true);
  assert.equal(rollbackEvidence.status, "ready");
  assert.equal(rollbackEvidence.permit.schemaVersion, "provider-workspace-write-execution-permit.v2");
  assert.equal(readiness.ok, true);
  assert.equal(readiness.summary.permitSchemaVersion, "provider-workspace-write-execution-permit.v2");
  assert.equal(readiness.summary.providerExecuteCalls, 0);
  assert.equal(readiness.summary.realCodexCliCalls, 0);
  assert.equal(readiness.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(readiness.summary.canaryFileWrites, 0);
  assert.equal(unsafeGuard.ok, false);
  assert.ok(unsafeGuard.reasons.includes("workspace_write_patch_guard_changed_files_exceed_max"));
  assert.ok(unsafeGuard.reasons.includes("workspace_write_patch_guard_changed_file_out_of_bounds"));
  assert.ok(unsafeGuard.reasons.includes("workspace_write_patch_guard_changed_file_not_permitted:../outside.txt"));
  assert.ok(unsafeGuard.reasons.includes("workspace_write_patch_guard_secret_like_content"));
  assert.equal(serializedUnsafeGuard.includes("sk-proj-123456789"), false);
  assert.equal(serializedUnsafeGuard.includes("const secret"), false);
});

test("workspace-write canary readiness blocks non-canary targets and broad caps", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["tmp/not-the-canary.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 8
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      "diff --git a/tmp/not-the-canary.txt b/tmp/not-the-canary.txt",
      "--- a/tmp/not-the-canary.txt",
      "+++ b/tmp/not-the-canary.txt",
      "@@",
      "+canary=wrong-target"
    ].join("\n")
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const readiness = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: "tmp/not-the-canary.txt",
    operatorGateEnabled: true
  });
  const serialized = JSON.stringify(readiness);

  assert.equal(readiness.ok, false);
  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.reasons.includes("workspace_write_canary_readiness_fixed_target_required"));
  assert.ok(readiness.reasons.includes("workspace_write_canary_readiness_diff_cap_too_large"));
  assert.equal(readiness.summary.fixedTarget, false);
  assert.equal(serialized.includes("canary=wrong-target"), false);
});

test("workspace-write real canary authorization accepts only the PR-12B exact packet", () => {
  const authorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: PR_12B_REAL_CANARY_WORKSPACE,
    branch: PR_12B_REAL_CANARY_BRANCH,
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });

  assert.equal(authorization.ok, true);
  assert.equal(authorization.status, "authorized");
  assert.deepEqual(authorization.reasons, []);
  assert.deepEqual(authorization.summary, {
    exactPhraseMatched: true,
    workspaceMatched: true,
    branchMatched: true,
    fixedTargetMatched: true,
    allowedActionMatched: true,
    sandboxMatched: true,
    rollbackRequired: true,
    pushDisallowed: true,
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0
  });
});

test("workspace-write real canary authorization accepts configured canary target from env", () => {
  const canaryConfig = createWorkspaceWriteRealCanaryConfigFromEnv({
    [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.targetFile]: "var/canary/configured.txt",
    [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.workspace]: "D:/configured/repo",
    [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.branch]: "canary/main",
    [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.allowedAction]: "one configured local canary write"
  });
  const authorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: "D:\\configured\\repo\\",
    branch: "canary/main",
    targetFile: "var/canary/configured.txt",
    allowedAction: "one configured local canary write",
    canaryConfig,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const defaultTargetAuthorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: "D:/configured/repo",
    branch: "canary/main",
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    allowedAction: "one configured local canary write",
    canaryConfig,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });

  assert.equal(canaryConfig.targetFile, "var/canary/configured.txt");
  assert.equal(authorization.ok, true);
  assert.equal(authorization.status, "authorized");
  assert.equal(defaultTargetAuthorization.ok, false);
  assert.ok(defaultTargetAuthorization.reasons.includes(
    "workspace_write_real_canary_authorization_fixed_target_required"
  ));
});

test("workspace-write real canary env config rejects unsafe target files", () => {
  assert.throws(
    () => createWorkspaceWriteRealCanaryConfigFromEnv({
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.targetFile]: "../outside.txt"
    }),
    /workspace_write_real_canary_config_target_file_unsafe/
  );

  assert.throws(
    () => createWorkspaceWriteRealCanaryConfigFromEnv({
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.targetFile]: "C:/outside.txt"
    }),
    /workspace_write_real_canary_config_target_file_unsafe/
  );
});

test("workspace-write real canary authorization fails closed on missing or broadened fields", () => {
  const authorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: "APPROVE_WORKSPACE_WRITE",
    workspace: "A:/other/repo",
    branch: "release",
    targetFile: "tmp/not-the-canary.txt",
    allowedAction: "general workspace write",
    sandboxMode: "danger-full-access",
    rollbackRequired: false,
    pushAuthorized: true
  });

  assert.equal(authorization.ok, false);
  assert.equal(authorization.status, "blocked");
  assert.ok(authorization.reasons.includes(
    "workspace_write_real_canary_authorization_exact_phrase_required"
  ));
  assert.ok(authorization.reasons.includes(
    "workspace_write_real_canary_authorization_workspace_mismatch"
  ));
  assert.ok(authorization.reasons.includes(
    "workspace_write_real_canary_authorization_main_branch_required"
  ));
  assert.ok(authorization.reasons.includes(
    "workspace_write_real_canary_authorization_fixed_target_required"
  ));
  assert.ok(authorization.reasons.includes(
    "workspace_write_real_canary_authorization_bounded_action_required"
  ));
  assert.ok(authorization.reasons.includes(
    "workspace_write_real_canary_authorization_workspace_write_sandbox_required"
  ));
  assert.ok(authorization.reasons.includes(
    "workspace_write_real_canary_authorization_rollback_required"
  ));
  assert.ok(authorization.reasons.includes(
    "workspace_write_real_canary_authorization_push_must_be_separate"
  ));
  assert.equal(authorization.summary.providerExecuteCalls, 0);
  assert.equal(authorization.summary.realCodexCliCalls, 0);
  assert.equal(authorization.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(authorization.summary.canaryFileWrites, 0);
});

test("workspace-write real canary authorization result stays sanitized", () => {
  const authorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: "A:/other/repo",
    branch: "feature/unsafe",
    targetFile: "tmp/not-the-canary.txt",
    allowedAction: "general unbounded write",
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const serialized = JSON.stringify(authorization);

  assert.equal(authorization.ok, false);
  assert.equal(serialized.includes(PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE), false);
  assert.equal(serialized.includes("A:/other/repo"), false);
  assert.equal(serialized.includes("feature/unsafe"), false);
  assert.equal(serialized.includes("tmp/not-the-canary.txt"), false);
  assert.equal(serialized.includes("general unbounded write"), false);
});

test("workspace-write real canary pre-execution gate becomes ready without executing", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: [DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE],
    maxChangedFiles: 1,
    maxDiffLines: 2
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createCanaryDiff()
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const readiness = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    operatorGateEnabled: true
  });
  const authorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: PR_12B_REAL_CANARY_WORKSPACE,
    branch: PR_12B_REAL_CANARY_BRANCH,
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const gate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization,
    readiness,
    canaryFileExists: false
  });

  assert.equal(gate.ok, true);
  assert.equal(gate.status, "ready");
  assert.deepEqual(gate.reasons, []);
  assert.equal(gate.summary.authorizationAccepted, true);
  assert.equal(gate.summary.canaryReadinessReady, true);
  assert.equal(gate.summary.canaryFileAbsent, true);
  assert.equal(gate.summary.fixedTargetMatched, true);
  assert.equal(gate.summary.pushDisallowed, true);
  assert.equal(gate.summary.rollbackReady, true);
  assert.equal(gate.summary.providerExecuteCalls, 0);
  assert.equal(gate.summary.realCodexCliCalls, 0);
  assert.equal(gate.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(gate.summary.canaryFileWrites, 0);
});

test("workspace-write real canary pre-execution gate blocks before execution", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: [DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE],
    maxChangedFiles: 1,
    maxDiffLines: 2
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createCanaryDiff()
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const readiness = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    operatorGateEnabled: false
  });
  const authorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: "APPROVE_WORKSPACE_WRITE",
    workspace: PR_12B_REAL_CANARY_WORKSPACE,
    branch: PR_12B_REAL_CANARY_BRANCH,
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const gate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization,
    readiness,
    canaryFileExists: true
  });

  assert.equal(gate.ok, false);
  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes(
    "workspace_write_real_canary_pre_execution_authorization_blocked"
  ));
  assert.ok(gate.reasons.includes(
    "workspace_write_real_canary_pre_execution_readiness_blocked"
  ));
  assert.ok(gate.reasons.includes(
    "workspace_write_real_canary_pre_execution_canary_file_must_be_absent"
  ));
  assert.ok(gate.reasons.includes(
    "workspace_write_real_canary_authorization_exact_phrase_required"
  ));
  assert.ok(gate.reasons.includes(
    "workspace_write_canary_readiness_operator_gate_required"
  ));
  assert.equal(gate.summary.authorizationAccepted, false);
  assert.equal(gate.summary.canaryReadinessReady, false);
  assert.equal(gate.summary.canaryFileAbsent, false);
  assert.equal(gate.summary.providerExecuteCalls, 0);
  assert.equal(gate.summary.realCodexCliCalls, 0);
  assert.equal(gate.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(gate.summary.canaryFileWrites, 0);
});

test("workspace-write real canary pre-execution gate result stays sanitized", () => {
  const permit = createWorkspaceWritePermit({
    targetFiles: ["tmp/not-the-canary.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 8
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: [
      "diff --git a/tmp/not-the-canary.txt b/tmp/not-the-canary.txt",
      "--- a/tmp/not-the-canary.txt",
      "+++ b/tmp/not-the-canary.txt",
      "@@",
      "+canary=wrong-target"
    ].join("\n")
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt: "2026-06-14T00:00:00.000Z"
  });
  const readiness = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: "tmp/not-the-canary.txt",
    operatorGateEnabled: true
  });
  const authorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: "A:/other/repo",
    branch: "feature/unsafe",
    targetFile: "tmp/not-the-canary.txt",
    allowedAction: "general unbounded write",
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const gate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization,
    readiness,
    canaryFileExists: false
  });
  const serialized = JSON.stringify(gate);

  assert.equal(gate.ok, false);
  assert.equal(serialized.includes(PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE), false);
  assert.equal(serialized.includes("A:/other/repo"), false);
  assert.equal(serialized.includes("feature/unsafe"), false);
  assert.equal(serialized.includes("general unbounded write"), false);
  assert.equal(serialized.includes("canary=wrong-target"), false);
});

function createSafeDiff(): string {
  return [
    "diff --git a/workspace/packages/provider-core/src/index.ts b/workspace/packages/provider-core/src/index.ts",
    "--- a/workspace/packages/provider-core/src/index.ts",
    "+++ b/workspace/packages/provider-core/src/index.ts",
    "@@",
    "-old line",
    "+new line"
  ].join("\n");
}

function createCanaryDiff(): string {
  return [
    `diff --git a/${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE} b/${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}`,
    `--- a/${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}`,
    `+++ b/${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}`,
    "@@",
    "+canary=ready"
  ].join("\n");
}

function createWorkspaceWritePermit(options: {
  approved?: boolean;
  targetFiles: string[];
  maxChangedFiles: number;
  maxDiffLines: number;
}): WorkspaceWriteProviderExecutionPermit {
  const plan = createExecutorPlan({
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write"),
    sideEffectClass: "workspace_write"
  });
  const input = {
    plan,
    manifest: createProviderManifest(),
    approvalStatus: options.approved === false ? "pending" as const : "approved" as const,
    ...(options.approved === false
      ? {}
      : { operatorAuthorizationId: "operator_auth_workspace_write_guard_001" }),
    targetFiles: options.targetFiles,
    maxChangedFiles: options.maxChangedFiles,
    maxDiffLines: options.maxDiffLines,
    rollbackRequired: true,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "codex/workspace-write-governance",
      protectedBranch: false,
      worktreeClean: true
    },
    issuedAt: "2026-06-14T00:00:00.000Z"
  };

  return options.approved === false
    ? createBlockedWorkspaceWriteProviderExecutionPermit(input)
    : createApprovedWorkspaceWriteProviderExecutionPermit(input);
}

function createWorkspaceWritePermitV2(options: {
  targetFiles: string[];
  maxChangedFiles: number;
  maxDiffLines: number;
}): WorkspaceWriteProviderExecutionPermitV2 {
  const manifest = createProviderManifest();
  const plan = createExecutorPlan({
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write"),
    sideEffectClass: "workspace_write",
    providerExecutionPlanHash: "c".repeat(64),
    providerManifestHash: hashProviderManifest(manifest),
    principalId: "principal_workspace_write_guard_001",
    principalHash: "d".repeat(64)
  });

  return createApprovedWorkspaceWriteProviderExecutionPermitV2({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: "operator_auth_workspace_write_guard_v2_001",
    targetFiles: options.targetFiles,
    maxChangedFiles: options.maxChangedFiles,
    maxDiffLines: options.maxDiffLines,
    rollbackRequired: true,
    rollback: {
      beforeCommit: "abc123def456"
    },
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "codex/workspace-write-governance",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "abc123def456"
    },
    issuedAt: "2026-06-14T00:00:00.000Z"
  });
}

function createProviderManifest(): ProviderManifest {
  return ProviderManifestSchema.parse({
    schemaVersion: "provider-manifest.v1",
    providerId: "provider_core_executor_001",
    kind: "executor",
    displayName: "Provider Core Executor",
    version: "0.1.0",
    capabilities: ["execution.plan"],
    requiredConfig: {
      keys: [],
      optionalKeys: []
    },
    securityBoundary: {
      isolation: "process",
      networkAccess: "none",
      filesystemAccess: "workspace-write",
      secretAccess: "none",
      notes: ["test fixture"]
    },
    supportedSandboxProfiles: [
      createSandboxProfile("read-only"),
      createSandboxProfile("workspace-write")
    ],
    supportedSideEffectClasses: ["read_only", "workspace_write"],
    metadata: {}
  });
}

function createExecutorPlan(
  overrides: Partial<ExecutorExecutionPlan> = {}
): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_provider_core_executor_001",
    runId: "run_provider_core_001",
    taskId: "task_provider_core_001",
    providerId: "provider_core_executor_001",
    inputHash: "a".repeat(64),
    policyDecisionHash: "policy_hash_provider_core_001",
    requiredCapabilities: ["fs.read:/repo/**"],
    approvalRequired: false,
    sandboxProfile: createSandboxProfile("read-only"),
    sideEffectClass: "read_only",
    createdAt: "2026-06-04T00:00:00.000Z",
    metadata: {},
    ...overrides
  });
}

function createSandboxProfile(
  mode: "read-only" | "workspace-write" | "danger-full-access",
  writableRoots = mode === "read-only" ? [] : ["workspace"],
  envPolicy: SandboxProfile["envPolicy"] = {
    inheritProcessEnv: false,
    allowlist: []
  }
) {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_provider_core_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots,
    envPolicy
  });
}
