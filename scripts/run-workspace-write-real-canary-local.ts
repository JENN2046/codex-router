#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { SandboxProfileSchema, type SandboxProfile } from "../packages/kernel-contracts/src/index.js";
import {
  InMemoryProviderExecutionPermitConsumptionStore,
  createApprovedWorkspaceWriteProviderExecutionPermitV2,
  createBlockedWorkspaceWriteProviderExecutionPermitV2,
  consumeWorkspaceWriteProviderExecutionPermitV2ForPlan,
  ExecutorExecutionPlanSchema,
  hashProviderManifest,
  ProviderManifestSchema,
  type ExecutorExecutionPlan,
  type ProviderManifest,
  type WorkspaceWriteProviderExecutionPermitV2IssueInput
} from "../packages/provider-core/src/index.js";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  createWorkspaceWriteRealCanaryConfig,
  createWorkspaceWriteRollbackPlanEvidence,
  evaluateWorkspaceWriteCanaryReadiness,
  evaluateWorkspaceWritePatchGuard,
  evaluateWorkspaceWriteRealCanaryAuthorization,
  evaluateWorkspaceWriteRealCanaryAuthorizationPacket,
  evaluateWorkspaceWriteRealCanaryPreExecutionGate,
  type WorkspaceWriteRealCanaryAuthorizationPacketV1,
  type WorkspaceWriteRealCanaryConfig
} from "../packages/governance-internal-workspace-write-guard/src/index.js";

const execFileAsync = promisify(execFile);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "workspace-write-real-canary-local-execution-latest.json"
);
const AUTHORIZATION_ENV = "WORKSPACE_WRITE_REAL_CANARY_EXECUTE_AUTHORIZATION";
const CANARY_CONTENT = "canary=ready\n";
const PROTECTED_BRANCHES = new Set(["main", "master", "production", "release"]);

export interface WorkspaceWriteRealCanaryLocalExecutionEvidence {
  schemaVersion: "workspace-write-real-canary-local-execution.v1";
  generatedAt: string;
  mode: "workspace-write-real-canary-local-execution";
  status: "ready" | "passed" | "blocked" | "failed";
  taskId: "workspace-write-real-canary-local-execution";
  checks: {
    executeRequested: boolean;
    exactAuthorizationMatched: boolean;
    branchNonProtected: boolean;
    worktreeCleanBefore: boolean;
    targetFixed: boolean;
    targetAbsentBefore: boolean;
    authorizationAccepted: boolean;
    authorizationPacketAccepted: boolean;
    permitV2Accepted: boolean;
    readinessReady: boolean;
    preExecutionGateReady: boolean;
    permitConsumed: boolean;
    wroteOnlyCanaryTarget: boolean;
    postWritePatchGuardPassed: boolean;
    rollbackAttempted: boolean;
    rollbackVerified: boolean;
    targetAbsentAfterRollback: boolean;
    targetWorktreeCleanAfterRollback: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noRemoteWrite: boolean;
    evidenceSanitized: boolean;
  };
  summary: {
    branch: string;
    beforeCommit: string;
    afterCommit: string;
    workspaceHash: string;
    providerId: "codex-cli";
    manifestHash: string;
    planId: string;
    permitId: string;
    targetFile: typeof DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE;
    contentHash?: string;
    preflightPatchHash: string;
    postWritePatchHash?: string;
    changedFileCount: number;
    diffLineCount: number;
    rollbackStrategy: "remove_canary_target_file";
    evidenceWrittenByRunner: false;
  };
  counters: {
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0 | 1;
    canaryFileWrites: 0 | 1;
    remoteWrites: 0;
  };
  reasons: string[];
}

export interface WorkspaceWriteRealCanaryLocalExecutionOptions {
  cwd?: string;
  execute?: boolean;
  authorizationPhrase?: string | undefined;
  generatedAt?: string;
}

export async function runWorkspaceWriteRealCanaryLocalExecution(
  options: WorkspaceWriteRealCanaryLocalExecutionOptions = {}
): Promise<WorkspaceWriteRealCanaryLocalExecutionEvidence> {
  const cwd = options.cwd ?? process.cwd();
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const executeRequested = options.execute === true;
  const branch = (await git(["branch", "--show-current"], cwd)).trim();
  const beforeCommit = (await git(["rev-parse", "HEAD"], cwd)).trim();
  const gitStatusBefore = await git(["status", "--short"], cwd);
  const targetFile = DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE;
  const targetPath = join(cwd, targetFile);
  const canaryConfig = createWorkspaceWriteRealCanaryConfig({
    workspace: cwd,
    branch,
    targetFile,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION
  });
  const targetAbsentBefore = !existsSync(targetPath);
  const exactAuthorizationMatched =
    options.authorizationPhrase === PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE;
  const branchNonProtected = branch.length > 0 && !PROTECTED_BRANCHES.has(branch);
  const worktreeCleanBefore = gitStatusBefore.trim() === "";
  const manifest = createProviderManifest();
  const plan = createWorkspaceWriteCanaryPlan(canaryConfig, manifest, generatedAt);
  const authorizationPacket = createAuthorizationPacket("operator_auth_workspace_write_real_canary_local");
  const permitInput: WorkspaceWriteProviderExecutionPermitV2IssueInput = {
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: authorizationPacket.operatorAuthorizationId,
    targetFiles: [targetFile],
    maxChangedFiles: 1,
    maxDiffLines: 2,
    rollbackRequired: true,
    rollback: {
      beforeCommit
    },
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch,
      protectedBranch: !branchNonProtected,
      worktreeClean: worktreeCleanBefore,
      headCommit: beforeCommit
    },
    issuedAt: generatedAt
  };
  const permit = branchNonProtected && worktreeCleanBefore
    ? createApprovedWorkspaceWriteProviderExecutionPermitV2(permitInput)
    : createBlockedWorkspaceWriteProviderExecutionPermitV2(permitInput);
  const preflightDiff = createCanaryDiff(targetFile);
  const preflightGuard = evaluateWorkspaceWritePatchGuard({
    permit,
    unifiedDiff: preflightDiff
  });
  const rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
    permit,
    guardResult: preflightGuard,
    beforeCommit,
    generatedAt
  });
  const readiness = evaluateWorkspaceWriteCanaryReadiness({
    permit,
    guardResult: preflightGuard,
    rollbackEvidence,
    targetFile,
    allowedTargetFile: targetFile,
    operatorGateEnabled: true
  });
  const authorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    ...(options.authorizationPhrase !== undefined
      ? { authorizationPhrase: options.authorizationPhrase }
      : {}),
    workspace: cwd,
    branch,
    targetFile,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
    canaryConfig,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const authorizationPacketReview = evaluateWorkspaceWriteRealCanaryAuthorizationPacket({
    authorizationPacket,
    permit,
    plan,
    manifest,
    now: generatedAt,
    canaryConfig
  });
  const preExecutionGate = evaluateWorkspaceWriteRealCanaryPreExecutionGate({
    authorization,
    readiness,
    authorizationPacket: authorizationPacketReview,
    canaryFileExists: !targetAbsentBefore
  });
  const gateReasons = collectReasons([
    [exactAuthorizationMatched, "workspace_write_real_canary_exact_authorization_required"],
    [branchNonProtected, "workspace_write_real_canary_non_protected_branch_required"],
    [worktreeCleanBefore, "workspace_write_real_canary_clean_worktree_required"],
    [targetAbsentBefore, "workspace_write_real_canary_target_must_be_absent"],
    [authorization.ok, "workspace_write_real_canary_authorization_blocked"],
    [authorizationPacketReview.ok, "workspace_write_real_canary_authorization_packet_blocked"],
    [readiness.ok, "workspace_write_real_canary_readiness_blocked"],
    [preExecutionGate.ok, "workspace_write_real_canary_pre_execution_gate_blocked"]
  ]);
  const preflightReasons = executeRequested
    ? gateReasons
    : gateReasons.filter((reason) =>
        reason !== "workspace_write_real_canary_exact_authorization_required"
      );

  if (preflightReasons.length > 0) {
    return createEvidence({
      generatedAt,
      status: "blocked",
      executeRequested,
      exactAuthorizationMatched,
      branchNonProtected,
      worktreeCleanBefore,
      targetAbsentBefore,
      branch,
      beforeCommit,
      afterCommit: beforeCommit,
      canaryConfig,
      manifest,
      plan,
      permitId: permit.permitId,
      authorizationAccepted: authorization.ok,
      authorizationPacketAccepted: authorizationPacketReview.ok,
      permitV2Accepted: authorizationPacketReview.summary.permitV2Accepted,
      readinessReady: readiness.ok,
      preExecutionGateReady: preExecutionGate.ok,
      preflightPatchHash: preflightGuard.summary.patchHash,
      changedFileCount: preflightGuard.summary.changedFileCount,
      diffLineCount: preflightGuard.summary.diffLineCount,
      counters: {
        workspaceWriteExecuteCalls: 0,
        canaryFileWrites: 0
      },
      reasons: preflightReasons
    });
  }

  if (!executeRequested) {
    return createEvidence({
      generatedAt,
      status: "ready",
      executeRequested,
      exactAuthorizationMatched,
      branchNonProtected,
      worktreeCleanBefore,
      targetAbsentBefore,
      branch,
      beforeCommit,
      afterCommit: beforeCommit,
      canaryConfig,
      manifest,
      plan,
      permitId: permit.permitId,
      authorizationAccepted: authorization.ok,
      authorizationPacketAccepted: authorizationPacketReview.ok,
      permitV2Accepted: authorizationPacketReview.summary.permitV2Accepted,
      readinessReady: readiness.ok,
      preExecutionGateReady: preExecutionGate.ok,
      preflightPatchHash: preflightGuard.summary.patchHash,
      changedFileCount: preflightGuard.summary.changedFileCount,
      diffLineCount: preflightGuard.summary.diffLineCount,
      counters: {
        workspaceWriteExecuteCalls: 0,
        canaryFileWrites: 0
      },
      reasons: []
    });
  }

  const consumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();
  const consumptionReasons = consumeWorkspaceWriteProviderExecutionPermitV2ForPlan(
    permit,
    plan,
    manifest,
    consumptionStore,
    {
      now: generatedAt,
      consumedAt: generatedAt,
      reasonPrefix: "workspace_write_real_canary_permit_v2"
    }
  );

  if (consumptionReasons.length > 0) {
    return createEvidence({
      generatedAt,
      status: "blocked",
      executeRequested,
      exactAuthorizationMatched,
      branchNonProtected,
      worktreeCleanBefore,
      targetAbsentBefore,
      branch,
      beforeCommit,
      afterCommit: beforeCommit,
      canaryConfig,
      manifest,
      plan,
      permitId: permit.permitId,
      authorizationAccepted: true,
      authorizationPacketAccepted: true,
      permitV2Accepted: true,
      readinessReady: true,
      preExecutionGateReady: true,
      preflightPatchHash: preflightGuard.summary.patchHash,
      changedFileCount: preflightGuard.summary.changedFileCount,
      diffLineCount: preflightGuard.summary.diffLineCount,
      counters: {
        workspaceWriteExecuteCalls: 0,
        canaryFileWrites: 0
      },
      reasons: consumptionReasons
    });
  }

  let postWritePatchHash: string | undefined;
  let contentHash: string | undefined;
  let postWritePatchGuardPassed = false;
  let wroteOnlyCanaryTarget = false;
  let rollbackAttempted = false;
  let rollbackVerified = false;
  let targetAbsentAfterRollback = false;
  let targetWorktreeCleanAfterRollback = false;
  let createdParentDirectoriesAbsentAfterRollback = false;
  const createdParentDirectories = new Set<string>();
  const executionReasons: string[] = [];

  try {
    for (const path of collectMissingWorkspaceParentDirectories(cwd, targetFile)) {
      createdParentDirectories.add(path);
    }
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, CANARY_CONTENT, { encoding: "utf8", flag: "wx" });
    const actualContent = await readFile(targetPath, "utf8");
    contentHash = sha256(actualContent);

    if (actualContent !== CANARY_CONTENT) {
      executionReasons.push("workspace_write_real_canary_content_mismatch");
    }

    const postWriteGuard = evaluateWorkspaceWritePatchGuard({
      permit,
      unifiedDiff: createCanaryDiffFromContent(targetFile, actualContent)
    });
    postWritePatchHash = postWriteGuard.summary.patchHash;
    postWritePatchGuardPassed = postWriteGuard.ok;
    wroteOnlyCanaryTarget = postWriteGuard.summary.changedFileCount === 1
      && postWriteGuard.summary.changedFiles[0]?.path === targetFile;

    if (!postWriteGuard.ok) {
      executionReasons.push(
        "workspace_write_real_canary_post_write_patch_guard_failed",
        ...postWriteGuard.reasons
      );
    }
  } catch {
    executionReasons.push("workspace_write_real_canary_write_failed");
  } finally {
    rollbackAttempted = true;
    try {
      await rm(targetPath, { force: true });
      await removeWorkspaceCreatedParentDirectories(cwd, createdParentDirectories);
      targetAbsentAfterRollback = !existsSync(targetPath);
      const targetStatus = await git(["status", "--short", "--", targetFile], cwd);
      targetWorktreeCleanAfterRollback = targetStatus.trim() === "";
      createdParentDirectoriesAbsentAfterRollback =
        workspaceCreatedParentDirectoriesAbsent(cwd, createdParentDirectories);
      rollbackVerified = targetAbsentAfterRollback
        && targetWorktreeCleanAfterRollback
        && createdParentDirectoriesAbsentAfterRollback;
    } catch {
      executionReasons.push("workspace_write_real_canary_rollback_failed");
    }
  }

  if (!rollbackVerified) {
    executionReasons.push("workspace_write_real_canary_rollback_not_verified");
  }

  const afterCommit = (await git(["rev-parse", "HEAD"], cwd)).trim();

  return createEvidence({
    generatedAt,
    status: executionReasons.length === 0 ? "passed" : "failed",
    executeRequested,
    exactAuthorizationMatched,
    branchNonProtected,
    worktreeCleanBefore,
    targetAbsentBefore,
    branch,
    beforeCommit,
    afterCommit,
    canaryConfig,
    manifest,
    plan,
    permitId: permit.permitId,
    authorizationAccepted: true,
    authorizationPacketAccepted: true,
    permitV2Accepted: true,
    readinessReady: true,
    preExecutionGateReady: true,
    permitConsumed: true,
    wroteOnlyCanaryTarget,
    postWritePatchGuardPassed,
    rollbackAttempted,
    rollbackVerified,
    targetAbsentAfterRollback,
    targetWorktreeCleanAfterRollback,
    contentHash,
    preflightPatchHash: preflightGuard.summary.patchHash,
    postWritePatchHash,
    changedFileCount: preflightGuard.summary.changedFileCount,
    diffLineCount: preflightGuard.summary.diffLineCount,
    counters: {
      workspaceWriteExecuteCalls: 1,
      canaryFileWrites: 1
    },
    reasons: executionReasons
  });
}

export async function writeWorkspaceWriteRealCanaryLocalExecutionEvidence(
  evidence: WorkspaceWriteRealCanaryLocalExecutionEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{ path: string; evidence: WorkspaceWriteRealCanaryLocalExecutionEvidence }> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return { path: evidencePath, evidence };
}

function createEvidence(input: {
  generatedAt: string;
  status: WorkspaceWriteRealCanaryLocalExecutionEvidence["status"];
  executeRequested: boolean;
  exactAuthorizationMatched: boolean;
  branchNonProtected: boolean;
  worktreeCleanBefore: boolean;
  targetAbsentBefore: boolean;
  branch: string;
  beforeCommit: string;
  afterCommit: string;
  canaryConfig: WorkspaceWriteRealCanaryConfig;
  manifest: ProviderManifest;
  plan: ExecutorExecutionPlan;
  permitId: string;
  authorizationAccepted: boolean;
  authorizationPacketAccepted: boolean;
  permitV2Accepted: boolean;
  readinessReady: boolean;
  preExecutionGateReady: boolean;
  permitConsumed?: boolean;
  wroteOnlyCanaryTarget?: boolean;
  postWritePatchGuardPassed?: boolean;
  rollbackAttempted?: boolean;
  rollbackVerified?: boolean;
  targetAbsentAfterRollback?: boolean;
  targetWorktreeCleanAfterRollback?: boolean;
  contentHash?: string | undefined;
  preflightPatchHash: string;
  postWritePatchHash?: string | undefined;
  changedFileCount: number;
  diffLineCount: number;
  counters: {
    workspaceWriteExecuteCalls: 0 | 1;
    canaryFileWrites: 0 | 1;
  };
  reasons: string[];
}): WorkspaceWriteRealCanaryLocalExecutionEvidence {
  const evidence = {
    schemaVersion: "workspace-write-real-canary-local-execution.v1" as const,
    generatedAt: input.generatedAt,
    mode: "workspace-write-real-canary-local-execution" as const,
    status: input.status,
    taskId: "workspace-write-real-canary-local-execution" as const,
    checks: {
      executeRequested: input.executeRequested,
      exactAuthorizationMatched: input.exactAuthorizationMatched,
      branchNonProtected: input.branchNonProtected,
      worktreeCleanBefore: input.worktreeCleanBefore,
      targetFixed: input.canaryConfig.targetFile === DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
      targetAbsentBefore: input.targetAbsentBefore,
      authorizationAccepted: input.authorizationAccepted,
      authorizationPacketAccepted: input.authorizationPacketAccepted,
      permitV2Accepted: input.permitV2Accepted,
      readinessReady: input.readinessReady,
      preExecutionGateReady: input.preExecutionGateReady,
      permitConsumed: input.permitConsumed ?? false,
      wroteOnlyCanaryTarget: input.wroteOnlyCanaryTarget ?? false,
      postWritePatchGuardPassed: input.postWritePatchGuardPassed ?? false,
      rollbackAttempted: input.rollbackAttempted ?? false,
      rollbackVerified: input.rollbackVerified ?? false,
      targetAbsentAfterRollback: input.targetAbsentAfterRollback ?? input.targetAbsentBefore,
      targetWorktreeCleanAfterRollback: input.targetWorktreeCleanAfterRollback ?? false,
      noProviderExecute: true,
      noRealCodexCli: true,
      noRemoteWrite: true,
      evidenceSanitized: true
    },
    summary: {
      branch: input.branch,
      beforeCommit: input.beforeCommit,
      afterCommit: input.afterCommit,
      workspaceHash: sha256(input.canaryConfig.workspace),
      providerId: "codex-cli" as const,
      manifestHash: hashProviderManifest(input.manifest),
      planId: input.plan.planId,
      permitId: input.permitId,
      targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE as typeof DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
      ...(input.contentHash !== undefined ? { contentHash: input.contentHash } : {}),
      preflightPatchHash: input.preflightPatchHash,
      ...(input.postWritePatchHash !== undefined
        ? { postWritePatchHash: input.postWritePatchHash }
        : {}),
      changedFileCount: input.changedFileCount,
      diffLineCount: input.diffLineCount,
      rollbackStrategy: "remove_canary_target_file" as const,
      evidenceWrittenByRunner: false as const
    },
    counters: {
      providerExecuteCalls: 0 as const,
      realCodexCliCalls: 0 as const,
      workspaceWriteExecuteCalls: input.counters.workspaceWriteExecuteCalls,
      canaryFileWrites: input.counters.canaryFileWrites,
      remoteWrites: 0 as const
    },
    reasons: [...new Set(input.reasons)]
  };
  evidence.checks.evidenceSanitized = evidenceIsSanitized(evidence);
  return evidence;
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
      notes: ["local real workspace-write canary fixture; no Codex CLI invocation"]
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
  manifest: ProviderManifest,
  createdAt: string
): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_workspace_write_real_canary_local_execution",
    runId: "run_workspace_write_real_canary_local_execution",
    taskId: "workspace-write-real-canary-local-execution",
    providerId: "codex-cli",
    inputHash: "a".repeat(64),
    providerExecutionPlanHash: "c".repeat(64),
    providerManifestHash: hashProviderManifest(manifest),
    policyDecisionHash: "policy_hash_workspace_write_real_canary_local_execution",
    principalId: "principal_workspace_write_real_canary_local_execution",
    principalHash: "d".repeat(64),
    requiredCapabilities: [`fs.write:${canaryConfig.targetFile}`],
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write", ["tmp"]),
    sideEffectClass: "workspace_write",
    createdAt,
    metadata: {
      localOnly: true,
      noRemoteWrite: true,
      noRealCodexCli: true
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
    targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
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
): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_workspace_write_real_canary_local_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots,
    envPolicy
  });
}

function createCanaryDiff(targetFile: string): string {
  return createCanaryDiffFromContent(targetFile, CANARY_CONTENT);
}

function createCanaryDiffFromContent(targetFile: string, content: string): string {
  const addedLines = content.endsWith("\n") ? content.slice(0, -1).split("\n") : content.split("\n");
  return [
    `diff --git a/${targetFile} b/${targetFile}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${targetFile}`,
    "@@",
    ...addedLines.map((line) => `+${line}`)
  ].join("\n");
}

function collectReasons(checks: Array<[boolean, string]>): string[] {
  return checks.flatMap(([ok, reason]) => ok ? [] : [reason]);
}

function collectMissingWorkspaceParentDirectories(cwd: string, targetPath: string): string[] {
  const directories: string[] = [];
  let current = dirname(targetPath);
  while (current !== "." && current !== "") {
    if (!existsSync(join(cwd, current))) {
      directories.push(current);
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return directories;
}

async function removeWorkspaceCreatedParentDirectories(
  cwd: string,
  directories: Set<string>
): Promise<void> {
  const deepestFirst = [...directories].sort((a, b) => pathDepth(b) - pathDepth(a));
  for (const path of deepestFirst) {
    try {
      await rmdir(join(cwd, path));
    } catch (error) {
      if (!isErrnoException(error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function workspaceCreatedParentDirectoriesAbsent(cwd: string, directories: Set<string>): boolean {
  return [...directories].every((path) => !existsSync(join(cwd, path)));
}

function pathDepth(path: string): number {
  return path.split("/").length;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function evidenceIsSanitized(evidence: unknown): boolean {
  const serialized = JSON.stringify(evidence);
  return [
    PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    CANARY_CONTENT.trim(),
    "OPENAI_API_KEY",
    "sk-",
    "Bearer",
    "stdout",
    "stderr",
    "raw command",
    "raw env",
    "raw patch"
  ].every((marker) => !serialized.includes(marker));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

function parseCliArgs(argv: string[]): {
  execute: boolean;
  outputPath: string;
  json: boolean;
} {
  const outputIdx = argv.indexOf("--output");
  return {
    execute: argv.includes("--execute"),
    outputPath: outputIdx >= 0 ? argv[outputIdx + 1] ?? DEFAULT_EVIDENCE_PATH : DEFAULT_EVIDENCE_PATH,
    json: argv.includes("--json")
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const evidence = await runWorkspaceWriteRealCanaryLocalExecution({
    execute: args.execute,
    ...(process.env[AUTHORIZATION_ENV] !== undefined
      ? { authorizationPhrase: process.env[AUTHORIZATION_ENV] }
      : {})
  });
  const write = await writeWorkspaceWriteRealCanaryLocalExecutionEvidence(
    evidence,
    args.outputPath
  );

  if (args.json) {
    console.log(JSON.stringify(evidence, null, 2));
    return;
  }

  console.log("Workspace-write real canary local execution");
  console.log(`status: ${evidence.status}`);
  console.log(`execute requested: ${evidence.checks.executeRequested}`);
  console.log(`branch: ${evidence.summary.branch}`);
  console.log(`target file: ${evidence.summary.targetFile}`);
  console.log(`workspace-write execute calls: ${evidence.counters.workspaceWriteExecuteCalls}`);
  console.log(`canary file writes: ${evidence.counters.canaryFileWrites}`);
  console.log(`rollback verified: ${evidence.checks.rollbackVerified}`);
  console.log(`evidence: ${write.path}`);
  if (evidence.reasons.length > 0) {
    console.log(`reasons: ${evidence.reasons.join(",")}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
