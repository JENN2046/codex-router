import test from "node:test";
import assert from "node:assert/strict";
import {
  createApprovedWorkspaceWriteProviderExecutionPermit,
  createBlockedWorkspaceWriteProviderExecutionPermit,
  ExecutorExecutionPlanSchema,
  ProviderManifestSchema,
  type ExecutorExecutionPlan,
  type ProviderManifest,
  type WorkspaceWriteProviderExecutionPermit
} from "../packages/provider-core/src/index.js";
import { SandboxProfileSchema, type SandboxProfile } from "../packages/kernel-contracts/src/index.js";
import {
  createWorkspaceWriteRollbackPlanEvidence,
  evaluateWorkspaceWritePatchGuard,
  inspectWorkspaceWriteUnifiedDiff
} from "../packages/workspace-write-guard/src/index.js";

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
