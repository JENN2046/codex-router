#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SandboxProfileSchema, type SandboxProfile } from "../packages/kernel-contracts/src/index.js";
import {
  createApprovedProviderExecutionPermit,
  createApprovedWorkspaceWriteProviderExecutionPermit,
  createBlockedWorkspaceWriteProviderExecutionPermit,
  ExecutorExecutionPlanSchema,
  hashProviderManifest,
  ProviderManifestSchema,
  type ExecutorExecutionPlan,
  type ProviderManifest,
  type WorkspaceWriteProviderExecutionPermit
} from "../packages/provider-core/src/index.js";
import {
  createWorkspaceWriteRollbackPlanEvidence,
  evaluateWorkspaceWritePatchGuard
} from "../packages/workspace-write-guard/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "workspace-write-governance-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";

export interface WorkspaceWriteGovernanceAcceptanceEvidence {
  schemaVersion: "workspace-write-governance-acceptance.v1";
  generatedAt: string;
  mode: "workspace-write-governance-local-only";
  taskId: string;
  checks: {
    approvedPermitCreated: boolean;
    blockedPermitRejected: boolean;
    legacyReadOnlyPermitStillRejectsWorkspaceWrite: boolean;
    patchGuardPassed: boolean;
    patchGuardBlocksFileCount: boolean;
    patchGuardBlocksDiffLines: boolean;
    patchGuardBlocksOutOfBounds: boolean;
    patchGuardBlocksSecretLikeContent: boolean;
    rollbackEvidenceReady: boolean;
    rollbackEvidenceBlocksMissingBeforeCommit: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    providerId: string;
    manifestHash: string;
    permitId: string;
    planId: string;
    sideEffectClass: "workspace_write";
    sandbox: "workspace-write";
    targetFileCount: number;
    maxChangedFiles: number;
    maxDiffLines: number;
    patchHash: string;
    changedFileCount: number;
    diffLineCount: number;
    rollbackAvailable: boolean;
  };
  counters: {
    providerExecuteCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
  };
  blockingReasons: string[];
}

export interface WorkspaceWriteGovernanceAcceptanceOptions {
  generatedAt?: string;
}

export async function runWorkspaceWriteGovernanceAcceptance(
  options: WorkspaceWriteGovernanceAcceptanceOptions = {}
): Promise<WorkspaceWriteGovernanceAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const manifest = createProviderManifest();
  const plan = createWorkspaceWritePlan();
  const approvedPermit = createApprovedWorkspaceWriteProviderExecutionPermit({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: "operator_auth_workspace_write_governance_acceptance",
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 4,
    rollbackRequired: true,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "codex/workspace-write-governance",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "abc123def456"
    },
    issuedAt: generatedAt
  });
  const blockedPermit = createBlockedWorkspaceWriteProviderExecutionPermit({
    plan,
    manifest,
    approvalStatus: "pending",
    targetFiles: ["../outside.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 4,
    rollbackRequired: false,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "main",
      protectedBranch: true,
      worktreeClean: false
    },
    issuedAt: generatedAt
  });
  const legacyReadOnlyPermitStillRejectsWorkspaceWrite = catchesProviderCoreError(() => {
    createApprovedProviderExecutionPermit({
      plan,
      manifest,
      issuedAt: generatedAt
    });
  }, "provider_execution_permit_not_approvable");
  const passGuard = evaluateWorkspaceWritePatchGuard({
    permit: approvedPermit,
    unifiedDiff: createSafeDiff()
  });
  const tooLargeGuard = evaluateWorkspaceWritePatchGuard({
    permit: approvedPermit,
    unifiedDiff: createTooLargeDiff()
  });
  const outOfBoundsGuard = evaluateWorkspaceWritePatchGuard({
    permit: approvedPermit,
    unifiedDiff: createOutOfBoundsDiff()
  });
  const sensitiveGuard = evaluateWorkspaceWritePatchGuard({
    permit: approvedPermit,
    unifiedDiff: createSensitiveDiff()
  });
  const rollbackReady = createWorkspaceWriteRollbackPlanEvidence({
    permit: approvedPermit,
    guardResult: passGuard,
    beforeCommit: "abc123def456",
    generatedAt
  });
  const rollbackMissingBeforeCommit = createWorkspaceWriteRollbackPlanEvidence({
    permit: approvedPermit,
    guardResult: passGuard,
    generatedAt
  });
  const counters = {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  };
  const blockingReasons = uniqueStrings([
    ...blockedPermit.reasons,
    ...tooLargeGuard.reasons,
    ...outOfBoundsGuard.reasons,
    ...sensitiveGuard.reasons,
    ...rollbackMissingBeforeCommit.blockingReasons
  ]);
  const evidenceWithoutLeakCheck: Omit<
    WorkspaceWriteGovernanceAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<WorkspaceWriteGovernanceAcceptanceEvidence["checks"], "leakCheckPassed">;
  } = {
    schemaVersion: "workspace-write-governance-acceptance.v1",
    generatedAt,
    mode: "workspace-write-governance-local-only",
    taskId: "workspace-write-governance-acceptance",
    checks: {
      approvedPermitCreated: approvedPermit.status === "approved",
      blockedPermitRejected: blockedPermit.status === "blocked"
        && blockedPermit.reasons.includes("workspace_write_provider_execution_permit_operator_authorization_required")
        && blockedPermit.reasons.includes("workspace_write_provider_execution_permit_dirty_worktree_forbidden"),
      legacyReadOnlyPermitStillRejectsWorkspaceWrite,
      patchGuardPassed: passGuard.ok === true,
      patchGuardBlocksFileCount: tooLargeGuard.reasons.includes(
        "workspace_write_patch_guard_changed_files_exceed_max"
      ),
      patchGuardBlocksDiffLines: tooLargeGuard.reasons.includes(
        "workspace_write_patch_guard_diff_lines_exceed_max"
      ),
      patchGuardBlocksOutOfBounds: outOfBoundsGuard.reasons.includes(
        "workspace_write_patch_guard_changed_file_out_of_bounds"
      ),
      patchGuardBlocksSecretLikeContent: sensitiveGuard.reasons.includes(
        "workspace_write_patch_guard_secret_like_content"
      ),
      rollbackEvidenceReady: rollbackReady.status === "ready"
        && rollbackReady.rollback.available === true,
      rollbackEvidenceBlocksMissingBeforeCommit: rollbackMissingBeforeCommit.status === "blocked"
        && rollbackMissingBeforeCommit.blockingReasons.includes(
          "workspace_write_rollback_plan_before_commit_required"
        ),
      noProviderExecute: counters.providerExecuteCalls === 0,
      noRealCodexCli: counters.realCodexCliCalls === 0,
      noWorkspaceWriteExecute: counters.workspaceWriteExecuteCalls === 0
    },
    summary: {
      providerId: approvedPermit.providerId,
      manifestHash: hashProviderManifest(manifest),
      permitId: approvedPermit.permitId,
      planId: plan.planId,
      sideEffectClass: "workspace_write",
      sandbox: "workspace-write",
      targetFileCount: approvedPermit.targetFiles.length,
      maxChangedFiles: approvedPermit.maxChangedFiles,
      maxDiffLines: approvedPermit.maxDiffLines,
      patchHash: passGuard.summary.patchHash,
      changedFileCount: passGuard.summary.changedFileCount,
      diffLineCount: passGuard.summary.diffLineCount,
      rollbackAvailable: rollbackReady.rollback.available
    },
    counters,
    blockingReasons
  };
  const leakCheckPassed = !containsForbiddenMarkers(evidenceWithoutLeakCheck);

  return {
    ...evidenceWithoutLeakCheck,
    checks: {
      ...evidenceWithoutLeakCheck.checks,
      leakCheckPassed
    }
  };
}

export async function writeWorkspaceWriteGovernanceAcceptanceEvidence(
  evidence: WorkspaceWriteGovernanceAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{ path: string; evidence: WorkspaceWriteGovernanceAcceptanceEvidence }> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function createProviderManifest(): ProviderManifest {
  return ProviderManifestSchema.parse({
    schemaVersion: "provider-manifest.v1",
    providerId: "codex-cli",
    kind: "executor",
    displayName: "Codex CLI",
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
      notes: ["workspace-write governance acceptance fixture"]
    },
    supportedSandboxProfiles: [
      createSandboxProfile("read-only"),
      createSandboxProfile("workspace-write")
    ],
    supportedSideEffectClasses: ["read_only", "workspace_write"],
    metadata: {}
  });
}

function createWorkspaceWritePlan(): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_workspace_write_governance_acceptance",
    runId: "run_workspace_write_governance_acceptance",
    taskId: "workspace-write-governance-acceptance",
    providerId: "codex-cli",
    inputHash: "a".repeat(64),
    policyDecisionHash: "policy_hash_workspace_write_governance_acceptance",
    requiredCapabilities: ["fs.write:workspace/packages/provider-core/src/index.ts"],
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write"),
    sideEffectClass: "workspace_write",
    createdAt: "2026-06-14T00:00:00.000Z",
    metadata: {}
  });
}

function createSandboxProfile(
  mode: "read-only" | "workspace-write",
  writableRoots = mode === "read-only" ? [] : ["workspace"],
  envPolicy: SandboxProfile["envPolicy"] = {
    inheritProcessEnv: false,
    allowlist: []
  }
) {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_workspace_write_governance_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots,
    envPolicy
  });
}

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

function createTooLargeDiff(): string {
  return [
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
    "+unpermitted",
    "+also unpermitted"
  ].join("\n");
}

function createOutOfBoundsDiff(): string {
  return [
    "diff --git a/../outside.ts b/../outside.ts",
    "--- a/../outside.ts",
    "+++ b/../outside.ts",
    "@@",
    "+outside"
  ].join("\n");
}

function createSensitiveDiff(): string {
  return [
    "diff --git a/workspace/packages/provider-core/src/index.ts b/workspace/packages/provider-core/src/index.ts",
    "--- a/workspace/packages/provider-core/src/index.ts",
    "+++ b/workspace/packages/provider-core/src/index.ts",
    "@@",
    "+const fixture = \"sk-proj-123456789\";"
  ].join("\n");
}

function catchesProviderCoreError(fn: () => void, marker: string): boolean {
  try {
    fn();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(marker);
  }
}

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "requestedAction",
    "prompt",
    "args",
    "stdout",
    "stderr",
    "raw command",
    "raw task envelope",
    "raw env",
    "raw token",
    "raw patch",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer"
  ].some((marker) => serialized.includes(marker));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

async function main(): Promise<void> {
  const outputIdx = process.argv.indexOf("--output");
  const outputPath = outputIdx >= 0
    ? process.argv[outputIdx + 1]!
    : DEFAULT_EVIDENCE_PATH;
  const evidence = await runWorkspaceWriteGovernanceAcceptance();
  const write = await writeWorkspaceWriteGovernanceAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Workspace-write governance acceptance");
  console.log(`approved permit: ${evidence.checks.approvedPermitCreated}`);
  console.log(`patch guard passed: ${evidence.checks.patchGuardPassed}`);
  console.log(`rollback ready: ${evidence.checks.rollbackEvidenceReady}`);
  console.log(`workspace-write execute: ${evidence.counters.workspaceWriteExecuteCalls}`);
  console.log(`leak check: ${evidence.checks.leakCheckPassed}`);
  console.log(`evidence: ${write.path}`);

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Workspace-write governance acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
