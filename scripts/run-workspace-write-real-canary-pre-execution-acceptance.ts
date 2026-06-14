#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SandboxProfileSchema, type SandboxProfile } from "../packages/kernel-contracts/src/index.js";
import {
  createApprovedWorkspaceWriteProviderExecutionPermit,
  ExecutorExecutionPlanSchema,
  hashProviderManifest,
  ProviderManifestSchema,
  type ExecutorExecutionPlan,
  type ProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  PR_12B_REAL_CANARY_BRANCH,
  PR_12B_REAL_CANARY_WORKSPACE,
  createWorkspaceWriteRollbackPlanEvidence,
  evaluateWorkspaceWriteCanaryReadiness,
  evaluateWorkspaceWritePatchGuard,
  evaluateWorkspaceWriteRealCanaryAuthorization,
  evaluateWorkspaceWriteRealCanaryPreExecutionGate
} from "../packages/workspace-write-guard/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "workspace-write-real-canary-pre-execution-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";
const CANARY_TARGET_FILE = DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE;

export interface WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence {
  schemaVersion: "workspace-write-real-canary-pre-execution-acceptance.v1";
  generatedAt: string;
  mode: "workspace-write-real-canary-pre-execution-local-only";
  taskId: string;
  checks: {
    authorizationAccepted: boolean;
    canaryReadinessReady: boolean;
    preExecutionGateReady: boolean;
    authorizationFailureBlocksGate: boolean;
    readinessFailureBlocksGate: boolean;
    existingCanaryFileBlocksGate: boolean;
    canaryFileAbsentBeforeAndAfter: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    noCanaryFileWrite: boolean;
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
    authorizationStatus: "authorized" | "blocked";
    readinessStatus: "ready" | "blocked";
    gateStatus: "ready" | "blocked";
    pushDisallowed: boolean;
    rollbackReady: boolean;
  };
  counters: {
    providerExecuteCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
    canaryFileWrites: number;
  };
  blockingReasons: string[];
}

export interface WorkspaceWriteRealCanaryPreExecutionAcceptanceOptions {
  generatedAt?: string;
}

export async function runWorkspaceWriteRealCanaryPreExecutionAcceptance(
  options: WorkspaceWriteRealCanaryPreExecutionAcceptanceOptions = {}
): Promise<WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const manifest = createProviderManifest();
  const plan = createWorkspaceWriteCanaryPlan();
  const canaryFileExistsBefore = existsSync(CANARY_TARGET_FILE);
  const permit = createApprovedWorkspaceWriteProviderExecutionPermit({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: "operator_auth_workspace_write_real_canary_pre_execution_acceptance",
    targetFiles: [CANARY_TARGET_FILE],
    maxChangedFiles: 1,
    maxDiffLines: 2,
    rollbackRequired: true,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: PR_12B_REAL_CANARY_BRANCH,
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "abc123def456"
    },
    issuedAt: generatedAt
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createCanaryDiff()
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit: "abc123def456",
    generatedAt
  });
  const readinessReady = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: CANARY_TARGET_FILE,
    operatorGateEnabled: true
  });
  const readinessBlocked = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: CANARY_TARGET_FILE,
    operatorGateEnabled: false
  });
  const authorizationReady = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: PR_12B_REAL_CANARY_WORKSPACE,
    branch: PR_12B_REAL_CANARY_BRANCH,
    targetFile: CANARY_TARGET_FILE,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const authorizationBlocked = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: "APPROVE_WORKSPACE_WRITE",
    workspace: PR_12B_REAL_CANARY_WORKSPACE,
    branch: PR_12B_REAL_CANARY_BRANCH,
    targetFile: CANARY_TARGET_FILE,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const gateReady = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationReady,
    readiness: readinessReady,
    canaryFileExists: false
  });
  const authorizationBlockedGate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationBlocked,
    readiness: readinessReady,
    canaryFileExists: false
  });
  const readinessBlockedGate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationReady,
    readiness: readinessBlocked,
    canaryFileExists: false
  });
  const existingFileBlockedGate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationReady,
    readiness: readinessReady,
    canaryFileExists: true
  });
  const counters = {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0
  };
  const canaryFileExistsAfter = existsSync(CANARY_TARGET_FILE);
  const evidenceWithoutLeakCheck: Omit<
    WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "workspace-write-real-canary-pre-execution-acceptance.v1",
    generatedAt,
    mode: "workspace-write-real-canary-pre-execution-local-only",
    taskId: "workspace-write-real-canary-pre-execution-acceptance",
    checks: {
      authorizationAccepted: authorizationReady.status === "authorized",
      canaryReadinessReady: readinessReady.status === "ready",
      preExecutionGateReady: gateReady.status === "ready",
      authorizationFailureBlocksGate: authorizationBlockedGate.status === "blocked"
        && authorizationBlockedGate.reasons.includes(
          "workspace_write_real_canary_pre_execution_authorization_blocked"
        ),
      readinessFailureBlocksGate: readinessBlockedGate.status === "blocked"
        && readinessBlockedGate.reasons.includes(
          "workspace_write_real_canary_pre_execution_readiness_blocked"
        ),
      existingCanaryFileBlocksGate: existingFileBlockedGate.status === "blocked"
        && existingFileBlockedGate.reasons.includes(
          "workspace_write_real_canary_pre_execution_canary_file_must_be_absent"
        ),
      canaryFileAbsentBeforeAndAfter: !canaryFileExistsBefore && !canaryFileExistsAfter,
      noProviderExecute: counters.providerExecuteCalls === 0,
      noRealCodexCli: counters.realCodexCliCalls === 0,
      noWorkspaceWriteExecute: counters.workspaceWriteExecuteCalls === 0,
      noCanaryFileWrite: counters.canaryFileWrites === 0
    },
    summary: {
      providerId: permit.providerId,
      manifestHash: hashProviderManifest(manifest),
      planId: plan.planId,
      permitId: permit.permitId,
      targetFile: CANARY_TARGET_FILE,
      sideEffectClass: "workspace_write",
      sandbox: "workspace-write",
      authorizationStatus: authorizationReady.status,
      readinessStatus: readinessReady.status,
      gateStatus: gateReady.status,
      pushDisallowed: gateReady.summary.pushDisallowed,
      rollbackReady: gateReady.summary.rollbackReady
    },
    counters,
    blockingReasons: uniqueStrings([
      ...authorizationBlockedGate.reasons,
      ...readinessBlockedGate.reasons,
      ...existingFileBlockedGate.reasons
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

export async function writeWorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence(
  evidence: WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence;
}> {
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
      notes: ["workspace-write real canary pre-execution acceptance fixture"]
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
    planId: "plan_workspace_write_real_canary_pre_execution_acceptance",
    runId: "run_workspace_write_real_canary_pre_execution_acceptance",
    taskId: "workspace-write-real-canary-pre-execution-acceptance",
    providerId: "codex-cli",
    inputHash: "a".repeat(64),
    policyDecisionHash: "policy_hash_workspace_write_real_canary_pre_execution_acceptance",
    requiredCapabilities: [`fs.write:${CANARY_TARGET_FILE}`],
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write"),
    sideEffectClass: "workspace_write",
    createdAt: "2026-06-14T00:00:00.000Z",
    metadata: {
      localOnly: true,
      preExecutionOnly: true
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
    sandboxId: `sandbox_workspace_write_real_canary_pre_execution_${mode.replace(/[^a-z0-9]+/g, "_")}`,
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

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    PR_12B_REAL_CANARY_WORKSPACE,
    PR_12B_REAL_CANARY_ALLOWED_ACTION,
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
    "APPROVE_WORKSPACE_WRITE",
    "canary=ready"
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
  const evidence = await runWorkspaceWriteRealCanaryPreExecutionAcceptance();
  const write = await writeWorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Workspace-write real canary pre-execution acceptance");
  console.log(`authorization accepted: ${evidence.checks.authorizationAccepted}`);
  console.log(`readiness ready: ${evidence.checks.canaryReadinessReady}`);
  console.log(`pre-execution gate ready: ${evidence.checks.preExecutionGateReady}`);
  console.log(`workspace-write execute: ${evidence.counters.workspaceWriteExecuteCalls}`);
  console.log(`canary file writes: ${evidence.counters.canaryFileWrites}`);
  console.log(`leak check: ${evidence.checks.leakCheckPassed}`);
  console.log(`evidence: ${write.path}`);

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Workspace-write real canary pre-execution acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
