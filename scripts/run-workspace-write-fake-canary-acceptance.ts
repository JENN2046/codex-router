#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SandboxProfileSchema, type SandboxProfile } from "../packages/kernel-contracts/src/index.js";
import {
  createApprovedWorkspaceWriteProviderExecutionPermit,
  createBlockedWorkspaceWriteProviderExecutionPermit,
  ExecutorExecutionPlanSchema,
  hashProviderManifest,
  ProviderManifestSchema,
  type ExecutorExecutionPlan,
  type ProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  createWorkspaceWriteRollbackPlanEvidence,
  evaluateWorkspaceWriteCanaryReadiness,
  evaluateWorkspaceWritePatchGuard
} from "../packages/workspace-write-guard/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "workspace-write-fake-canary-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";
const CANARY_TARGET_FILE = DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE;

export interface WorkspaceWriteFakeCanaryAcceptanceEvidence {
  schemaVersion: "workspace-write-fake-canary-acceptance.v1";
  generatedAt: string;
  mode: "workspace-write-fake-canary-local-only";
  taskId: string;
  checks: {
    fixedCanaryTarget: boolean;
    approvedPermitCreated: boolean;
    nonCanaryTargetRejected: boolean;
    patchGuardPassedForCanaryDiff: boolean;
    patchGuardBlocksNonCanaryDiff: boolean;
    rollbackEvidenceReady: boolean;
    canaryReadinessBlocksWithoutOperatorGate: boolean;
    canaryReadinessReadyWithFakeGate: boolean;
    canaryFileAbsentBeforeAndAfter: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    providerId: string;
    manifestHash: string;
    planId: string;
    permitId: string;
    targetFile: string;
    sideEffectClass: "workspace_write";
    sandbox: "workspace-write";
    maxChangedFiles: number;
    maxDiffLines: number;
    patchHash: string;
    changedFileCount: number;
    diffLineCount: number;
    rollbackAvailable: boolean;
    readinessStatus: "ready" | "blocked";
  };
  counters: {
    providerExecuteCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
    canaryFileWrites: number;
  };
  blockingReasons: string[];
}

export interface WorkspaceWriteFakeCanaryAcceptanceOptions {
  generatedAt?: string;
}

export async function runWorkspaceWriteFakeCanaryAcceptance(
  options: WorkspaceWriteFakeCanaryAcceptanceOptions = {}
): Promise<WorkspaceWriteFakeCanaryAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const manifest = createProviderManifest();
  const plan = createWorkspaceWriteCanaryPlan();
  const canaryFileExistsBefore = existsSync(CANARY_TARGET_FILE);
  const approvedPermit = createApprovedWorkspaceWriteProviderExecutionPermit({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: "operator_auth_workspace_write_fake_canary_acceptance",
    targetFiles: [CANARY_TARGET_FILE],
    maxChangedFiles: 1,
    maxDiffLines: 2,
    rollbackRequired: true,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "codex/workspace-write-fake-canary",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "abc123def456"
    },
    issuedAt: generatedAt
  });
  const blockedPermit = createBlockedWorkspaceWriteProviderExecutionPermit({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: "operator_auth_workspace_write_fake_canary_acceptance",
    targetFiles: ["tmp/not-the-canary.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 2,
    rollbackRequired: true,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "codex/workspace-write-fake-canary",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "abc123def456"
    },
    reasons: ["workspace_write_fake_canary_target_mismatch"],
    issuedAt: generatedAt
  });
  const canaryGuard = evaluateWorkspaceWritePatchGuard({
    permit: approvedPermit,
    unifiedDiff: createCanaryDiff()
  });
  const nonCanaryGuard = evaluateWorkspaceWritePatchGuard({
    permit: approvedPermit,
    unifiedDiff: createNonCanaryDiff()
  });
  const rollbackReady = createWorkspaceWriteRollbackPlanEvidence({
    permit: approvedPermit,
    guardResult: canaryGuard,
    beforeCommit: "abc123def456",
    generatedAt
  });
  const readinessBlocked = evaluateWorkspaceWriteCanaryReadiness({
    permit: approvedPermit,
    guardResult: canaryGuard,
    rollbackEvidence: rollbackReady,
    targetFile: CANARY_TARGET_FILE,
    operatorGateEnabled: false
  });
  const readinessReady = evaluateWorkspaceWriteCanaryReadiness({
    permit: approvedPermit,
    guardResult: canaryGuard,
    rollbackEvidence: rollbackReady,
    targetFile: CANARY_TARGET_FILE,
    operatorGateEnabled: true
  });
  const counters = {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0
  };
  const canaryFileExistsAfter = existsSync(CANARY_TARGET_FILE);
  const blockingReasons = uniqueStrings([
    ...blockedPermit.reasons,
    ...nonCanaryGuard.reasons,
    ...rollbackReady.blockingReasons
  ]);
  const evidenceWithoutLeakCheck: Omit<
    WorkspaceWriteFakeCanaryAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<WorkspaceWriteFakeCanaryAcceptanceEvidence["checks"], "leakCheckPassed">;
  } = {
    schemaVersion: "workspace-write-fake-canary-acceptance.v1",
    generatedAt,
    mode: "workspace-write-fake-canary-local-only",
    taskId: "workspace-write-fake-canary-acceptance",
    checks: {
      fixedCanaryTarget: approvedPermit.targetFiles.length === 1
        && approvedPermit.targetFiles[0] === CANARY_TARGET_FILE,
      approvedPermitCreated: approvedPermit.status === "approved",
      nonCanaryTargetRejected: blockedPermit.status === "blocked"
        && blockedPermit.reasons.includes("workspace_write_fake_canary_target_mismatch"),
      patchGuardPassedForCanaryDiff: canaryGuard.ok === true
        && canaryGuard.summary.changedFileCount === 1
        && canaryGuard.summary.changedFiles[0]?.path === CANARY_TARGET_FILE,
      patchGuardBlocksNonCanaryDiff: nonCanaryGuard.ok === false
        && nonCanaryGuard.reasons.includes(
          "workspace_write_patch_guard_changed_file_not_permitted:tmp/not-the-canary.txt"
        ),
      rollbackEvidenceReady: rollbackReady.status === "ready"
        && rollbackReady.rollback.available === true,
      canaryReadinessBlocksWithoutOperatorGate: readinessBlocked.status === "blocked"
        && readinessBlocked.reasons.includes(
          "workspace_write_canary_readiness_operator_gate_required"
        ),
      canaryReadinessReadyWithFakeGate: readinessReady.status === "ready"
        && readinessReady.summary.providerExecuteCalls === 0
        && readinessReady.summary.realCodexCliCalls === 0
        && readinessReady.summary.workspaceWriteExecuteCalls === 0
        && readinessReady.summary.canaryFileWrites === 0,
      canaryFileAbsentBeforeAndAfter: !canaryFileExistsBefore && !canaryFileExistsAfter,
      noProviderExecute: counters.providerExecuteCalls === 0,
      noRealCodexCli: counters.realCodexCliCalls === 0,
      noWorkspaceWriteExecute: counters.workspaceWriteExecuteCalls === 0
    },
    summary: {
      providerId: approvedPermit.providerId,
      manifestHash: hashProviderManifest(manifest),
      planId: plan.planId,
      permitId: approvedPermit.permitId,
      targetFile: CANARY_TARGET_FILE,
      sideEffectClass: "workspace_write",
      sandbox: "workspace-write",
      maxChangedFiles: approvedPermit.maxChangedFiles,
      maxDiffLines: approvedPermit.maxDiffLines,
      patchHash: canaryGuard.summary.patchHash,
      changedFileCount: canaryGuard.summary.changedFileCount,
      diffLineCount: canaryGuard.summary.diffLineCount,
      rollbackAvailable: rollbackReady.rollback.available,
      readinessStatus: readinessReady.status
    },
    counters,
    blockingReasons: uniqueStrings([
      ...blockingReasons,
      ...readinessBlocked.reasons,
      ...readinessReady.reasons
    ])
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

export async function writeWorkspaceWriteFakeCanaryAcceptanceEvidence(
  evidence: WorkspaceWriteFakeCanaryAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{ path: string; evidence: WorkspaceWriteFakeCanaryAcceptanceEvidence }> {
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
      notes: ["workspace-write fake canary acceptance fixture"]
    },
    supportedSandboxProfiles: [
      createSandboxProfile("read-only"),
      createSandboxProfile("workspace-write")
    ],
    supportedSideEffectClasses: ["read_only", "workspace_write"],
    metadata: {}
  });
}

function createWorkspaceWriteCanaryPlan(): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_workspace_write_fake_canary_acceptance",
    runId: "run_workspace_write_fake_canary_acceptance",
    taskId: "workspace-write-fake-canary-acceptance",
    providerId: "codex-cli",
    inputHash: "a".repeat(64),
    policyDecisionHash: "policy_hash_workspace_write_fake_canary_acceptance",
    requiredCapabilities: [`fs.write:${CANARY_TARGET_FILE}`],
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write"),
    sideEffectClass: "workspace_write",
    createdAt: "2026-06-14T00:00:00.000Z",
    metadata: {
      fakeOnly: true,
      canaryTarget: CANARY_TARGET_FILE
    }
  });
}

function createSandboxProfile(
  mode: "read-only" | "workspace-write",
  writableRoots = mode === "read-only" ? [] : ["tmp"],
  envPolicy: SandboxProfile["envPolicy"] = {
    inheritProcessEnv: false,
    allowlist: []
  }
) {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_workspace_write_fake_canary_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots,
    envPolicy
  });
}

function createCanaryDiff(): string {
  return [
    `diff --git a/${CANARY_TARGET_FILE} b/${CANARY_TARGET_FILE}`,
    `--- a/${CANARY_TARGET_FILE}`,
    `+++ b/${CANARY_TARGET_FILE}`,
    "@@",
    "+canary=ready"
  ].join("\n");
}

function createNonCanaryDiff(): string {
  return [
    "diff --git a/tmp/not-the-canary.txt b/tmp/not-the-canary.txt",
    "--- a/tmp/not-the-canary.txt",
    "+++ b/tmp/not-the-canary.txt",
    "@@",
    "+canary=wrong-target"
  ].join("\n");
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
    "Bearer",
    "canary=ready",
    "canary=wrong-target"
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
  const evidence = await runWorkspaceWriteFakeCanaryAcceptance();
  const write = await writeWorkspaceWriteFakeCanaryAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Workspace-write fake canary acceptance");
  console.log(`fixed canary target: ${evidence.checks.fixedCanaryTarget}`);
  console.log(`patch guard passed: ${evidence.checks.patchGuardPassedForCanaryDiff}`);
  console.log(`rollback ready: ${evidence.checks.rollbackEvidenceReady}`);
  console.log(`readiness default blocked: ${evidence.checks.canaryReadinessBlocksWithoutOperatorGate}`);
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
      "Workspace-write fake canary acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
