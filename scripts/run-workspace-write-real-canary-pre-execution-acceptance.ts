#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SandboxProfileSchema, type SandboxProfile } from "../packages/kernel-contracts/src/index.js";
import {
  createApprovedWorkspaceWriteProviderExecutionPermitV2,
  ExecutorExecutionPlanSchema,
  hashProviderManifest,
  ProviderManifestSchema,
  type ExecutorExecutionPlan,
  type ProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  createWorkspaceWriteRealCanaryConfig,
  createWorkspaceWriteRealCanaryConfigFromEnv,
  createWorkspaceWriteRollbackPlanEvidence,
  evaluateWorkspaceWriteCanaryReadiness,
  evaluateWorkspaceWritePatchGuard,
  evaluateWorkspaceWriteRealCanaryAuthorization,
  evaluateWorkspaceWriteRealCanaryAuthorizationPacket,
  evaluateWorkspaceWriteRealCanaryPreExecutionGate,
  type WorkspaceWriteRealCanaryAuthorizationPacketV1,
  type WorkspaceWriteRealCanaryConfig,
  type WorkspaceWriteRealCanaryConfigEnv,
  type WorkspaceWriteRealCanaryConfigInput
} from "../packages/governance-internal-workspace-write-guard/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "workspace-write-real-canary-pre-execution-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";

export interface WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence {
  schemaVersion: "workspace-write-real-canary-pre-execution-acceptance.v1";
  generatedAt: string;
  mode: "workspace-write-real-canary-pre-execution-local-only";
  taskId: string;
  checks: {
    authorizationAccepted: boolean;
    authorizationPacketAccepted: boolean;
    permitV2Accepted: boolean;
    permitV2Approved: boolean;
    permitV2Validated: boolean;
    packetActionBoundToConfig: boolean;
    packetPermitBindingAccepted: boolean;
    canaryReadinessReady: boolean;
    preExecutionGateReady: boolean;
    authorizationPacketFailureBlocksGate: boolean;
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
    packetSchemaVersion: "workspace-write-real-canary-authorization-packet.v1";
    permitSchemaVersion: "provider-workspace-write-execution-permit.v2";
    targetFile: string;
    sideEffectClass: "workspace_write";
    sandbox: "workspace-write";
    authorizationStatus: "authorized" | "blocked";
    authorizationPacketStatus: "accepted" | "blocked";
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
  canaryConfig?: WorkspaceWriteRealCanaryConfigInput;
  env?: WorkspaceWriteRealCanaryConfigEnv;
}

export async function runWorkspaceWriteRealCanaryPreExecutionAcceptance(
  options: WorkspaceWriteRealCanaryPreExecutionAcceptanceOptions = {}
): Promise<WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const canaryConfig = resolveCanaryConfig(options);
  const manifest = createProviderManifest();
  const plan = createWorkspaceWriteCanaryPlan(canaryConfig, manifest);
  const canaryFileExistsBefore = existsSync(canaryConfig.targetFile);
  const operatorAuthorizationId = "operator_auth_workspace_write_real_canary_pre_execution_acceptance";
  const beforeCommit = "abc123def456";
  const authorizationPacket = createAuthorizationPacket(operatorAuthorizationId);
  const permit = createApprovedWorkspaceWriteProviderExecutionPermitV2({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId,
    targetFiles: [canaryConfig.targetFile],
    maxChangedFiles: 1,
    maxDiffLines: 2,
    rollbackRequired: true,
    rollback: {
      beforeCommit
    },
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "codex/workspace-write-real-canary-pre-execution",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: beforeCommit
    },
    issuedAt: generatedAt
  });
  const guardResult = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: createCanaryDiff(canaryConfig)
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult,
    beforeCommit,
    generatedAt
  });
  const readinessReady = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: canaryConfig.targetFile,
    allowedTargetFile: canaryConfig.targetFile,
    operatorGateEnabled: true
  });
  const readinessBlocked = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult,
    rollbackEvidence,
    targetFile: canaryConfig.targetFile,
    allowedTargetFile: canaryConfig.targetFile,
    operatorGateEnabled: false
  });
  const authorizationReady = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: canaryConfig.workspace,
    branch: canaryConfig.branch,
    targetFile: canaryConfig.targetFile,
    allowedAction: canaryConfig.allowedAction,
    canaryConfig,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const authorizationBlocked = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: "APPROVE_WORKSPACE_WRITE",
    workspace: canaryConfig.workspace,
    branch: canaryConfig.branch,
    targetFile: canaryConfig.targetFile,
    allowedAction: canaryConfig.allowedAction,
    canaryConfig,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const authorizationPacketReady = evaluateWorkspaceWriteRealCanaryAuthorizationPacket({
    authorizationPacket,
    permit,
    plan,
    manifest,
    now: generatedAt,
    canaryConfig
  });
  const authorizationPacketBlocked = evaluateWorkspaceWriteRealCanaryAuthorizationPacket({
    authorizationPacket: {
      ...authorizationPacket,
      pushAuthorized: true
    },
    permit,
    plan,
    manifest,
    now: generatedAt,
    canaryConfig
  });
  const gateReady = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationReady,
    readiness: readinessReady,
    authorizationPacket: authorizationPacketReady,
    canaryFileExists: false
  });
  const authorizationPacketBlockedGate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationReady,
    readiness: readinessReady,
    authorizationPacket: authorizationPacketBlocked,
    canaryFileExists: false
  });
  const authorizationBlockedGate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationBlocked,
    readiness: readinessReady,
    authorizationPacket: authorizationPacketReady,
    canaryFileExists: false
  });
  const readinessBlockedGate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationReady,
    readiness: readinessBlocked,
    authorizationPacket: authorizationPacketReady,
    canaryFileExists: false
  });
  const existingFileBlockedGate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization: authorizationReady,
    readiness: readinessReady,
    authorizationPacket: authorizationPacketReady,
    canaryFileExists: true
  });
  const counters = {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0
  };
  const canaryFileExistsAfter = existsSync(canaryConfig.targetFile);
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
      authorizationPacketAccepted: authorizationPacketReady.status === "accepted",
      permitV2Accepted: authorizationPacketReady.summary.permitV2Accepted,
      permitV2Approved: authorizationPacketReady.summary.permitApproved,
      permitV2Validated: authorizationPacketReady.summary.permitV2ValidationPassed,
      packetActionBoundToConfig: authorizationPacketReady.summary.allowedActionMatched,
      packetPermitBindingAccepted: gateReady.summary.packetPermitBindingAccepted,
      canaryReadinessReady: readinessReady.status === "ready",
      preExecutionGateReady: gateReady.status === "ready",
      authorizationPacketFailureBlocksGate: authorizationPacketBlockedGate.status === "blocked"
        && authorizationPacketBlockedGate.reasons.includes(
          "workspace_write_real_canary_pre_execution_authorization_packet_blocked"
        ),
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
      packetSchemaVersion: authorizationPacket.schemaVersion,
      permitSchemaVersion: permit.schemaVersion,
      targetFile: canaryConfig.targetFile,
      sideEffectClass: "workspace_write",
      sandbox: "workspace-write",
      authorizationStatus: authorizationReady.status,
      authorizationPacketStatus: authorizationPacketReady.status,
      readinessStatus: readinessReady.status,
      gateStatus: gateReady.status,
      pushDisallowed: gateReady.summary.pushDisallowed,
      rollbackReady: gateReady.summary.rollbackReady
    },
    counters,
    blockingReasons: uniqueStrings([
      ...authorizationPacketBlockedGate.reasons,
      ...authorizationBlockedGate.reasons,
      ...readinessBlockedGate.reasons,
      ...existingFileBlockedGate.reasons
    ])
  };
  const leakCheckPassed = !containsForbiddenMarkers(evidenceWithoutLeakCheck, canaryConfig);

  return {
    ...evidenceWithoutLeakCheck,
    checks: {
      ...evidenceWithoutLeakCheck.checks,
      leakCheckPassed
    }
  };
}

function resolveCanaryConfig(
  options: WorkspaceWriteRealCanaryPreExecutionAcceptanceOptions
): WorkspaceWriteRealCanaryConfig {
  if (options.canaryConfig !== undefined) {
    return createWorkspaceWriteRealCanaryConfig(options.canaryConfig);
  }

  if (options.env !== undefined) {
    return createWorkspaceWriteRealCanaryConfigFromEnv(options.env);
  }

  return createWorkspaceWriteRealCanaryConfig();
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

function createWorkspaceWriteCanaryPlan(
  canaryConfig: WorkspaceWriteRealCanaryConfig,
  manifest: ProviderManifest
): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_workspace_write_real_canary_pre_execution_acceptance",
    runId: "run_workspace_write_real_canary_pre_execution_acceptance",
    taskId: "workspace-write-real-canary-pre-execution-acceptance",
    providerId: "codex-cli",
    inputHash: "a".repeat(64),
    providerExecutionPlanHash: "c".repeat(64),
    providerManifestHash: hashProviderManifest(manifest),
    policyDecisionHash: "policy_hash_workspace_write_real_canary_pre_execution_acceptance",
    principalId: "principal_workspace_write_real_canary_pre_execution_acceptance",
    principalHash: "d".repeat(64),
    requiredCapabilities: [`fs.write:${canaryConfig.targetFile}`],
    approvalRequired: true,
    sandboxProfile: createSandboxProfile(
      "workspace-write",
      [getWorkspaceWritableRoot(canaryConfig.targetFile)]
    ),
    sideEffectClass: "workspace_write",
    createdAt: "2026-06-14T00:00:00.000Z",
    metadata: {
      localOnly: true,
      preExecutionOnly: true
    }
  });
}

function createAuthorizationPacket(
  operatorAuthorizationId: string
): WorkspaceWriteRealCanaryAuthorizationPacketV1 {
  return {
    schemaVersion: "workspace-write-real-canary-authorization-packet.v1",
    authorizationIntent: "workspace_write_real_canary",
    authorizationScope: "single_local_canary_write_only",
    operatorAuthorizationId,
    providerId: "codex-cli",
    targetFile: "tmp/codex-cli-write-canary.txt",
    allowedAction: "one bounded local canary write",
    sideEffectClass: "workspace_write",
    sandbox: "workspace-write",
    maxChangedFiles: 1,
    maxDiffLines: 2,
    rollbackRequired: true,
    canaryFileAbsentBeforeExecution: true,
    branchPolicy: "non_main_non_protected_branch_only",
    worktreeCleanRequired: true,
    beforeCommitRequired: true,
    permitV2Required: true,
    fakeCanaryV2Required: true,
    releaseGateRequired: true,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false,
    deploymentAuthorized: false,
    packagePublishAuthorized: false,
    externalWriteAuthorized: false,
    secretMutationAuthorized: false
  };
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

function createCanaryDiff(canaryConfig: WorkspaceWriteRealCanaryConfig): string {
  return [
    `diff --git a/${canaryConfig.targetFile} b/${canaryConfig.targetFile}`,
    `--- a/${canaryConfig.targetFile}`,
    `+++ b/${canaryConfig.targetFile}`,
    "@@",
    "+canary=ready"
  ].join("\n");
}

function getWorkspaceWritableRoot(targetFile: string): string {
  return targetFile.split("/")[0] ?? targetFile;
}

function containsForbiddenMarkers(
  value: unknown,
  canaryConfig: WorkspaceWriteRealCanaryConfig
): boolean {
  const serialized = JSON.stringify(value);
  return [
    PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    canaryConfig.workspace,
    canaryConfig.allowedAction,
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
  const evidence = await runWorkspaceWriteRealCanaryPreExecutionAcceptance({
    env: process.env
  });
  const write = await writeWorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Workspace-write real canary pre-execution acceptance");
  console.log(`authorization accepted: ${evidence.checks.authorizationAccepted}`);
  console.log(`authorization packet accepted: ${evidence.checks.authorizationPacketAccepted}`);
  console.log(`permit v2 accepted: ${evidence.checks.permitV2Accepted}`);
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
