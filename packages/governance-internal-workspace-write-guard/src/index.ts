import { createHash } from "node:crypto";
import { z } from "zod";
import { redactText } from "../../governance-internal-redaction/src/index.js";
import {
  ExecutorExecutionPlanSchema,
  ProviderManifestSchema,
  WorkspaceWriteProviderExecutionPermitSchema,
  WorkspaceWriteProviderExecutionPermitV2Schema,
  validateWorkspaceWriteProviderExecutionPermitV2ForPlan,
  type WorkspaceWriteProviderExecutionPermit,
  type WorkspaceWriteProviderExecutionPermitV2
} from "../../provider-core/src/index.js";

export const DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE = "tmp/codex-cli-write-canary.txt";
export const PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE =
  "APPROVE_PR_12B_REAL_WORKSPACE_WRITE_CANARY";
export const PR_12B_REAL_CANARY_WORKSPACE =
  "A:\\AGENTS_OS_Workspace\\governance\\codex-router\\repo";
export const PR_12B_REAL_CANARY_BRANCH = "main";
export const PR_12B_REAL_CANARY_ALLOWED_ACTION = "one bounded local canary write";
export const WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV = {
  targetFile: "WORKSPACE_WRITE_REAL_CANARY_TARGET_FILE",
  workspace: "WORKSPACE_WRITE_REAL_CANARY_WORKSPACE",
  branch: "WORKSPACE_WRITE_REAL_CANARY_BRANCH",
  allowedAction: "WORKSPACE_WRITE_REAL_CANARY_ALLOWED_ACTION"
} as const;
export const DEFAULT_WORKSPACE_WRITE_REAL_CANARY_CONFIG = {
  targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  workspace: PR_12B_REAL_CANARY_WORKSPACE,
  branch: PR_12B_REAL_CANARY_BRANCH,
  allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION
} as const;

export const WorkspaceWriteRealCanaryAuthorizationPacketV1Schema = z.object({
  schemaVersion: z.literal("workspace-write-real-canary-authorization-packet.v1"),
  authorizationIntent: z.literal("workspace_write_real_canary"),
  authorizationScope: z.literal("single_local_canary_write_only"),
  operatorAuthorizationId: z.string().min(1),
  providerId: z.literal("codex-cli"),
  targetFile: z.literal(DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE),
  allowedAction: z.literal(PR_12B_REAL_CANARY_ALLOWED_ACTION),
  sideEffectClass: z.literal("workspace_write"),
  sandbox: z.literal("workspace-write"),
  maxChangedFiles: z.literal(1),
  maxDiffLines: z.literal(2),
  rollbackRequired: z.literal(true),
  canaryFileAbsentBeforeExecution: z.literal(true),
  branchPolicy: z.literal("non_main_non_protected_branch_only"),
  worktreeCleanRequired: z.literal(true),
  beforeCommitRequired: z.literal(true),
  permitV2Required: z.literal(true),
  fakeCanaryV2Required: z.literal(true),
  releaseGateRequired: z.literal(true),
  pushAuthorized: z.literal(false),
  releaseAuthorized: z.literal(false),
  tagAuthorized: z.literal(false),
  deploymentAuthorized: z.literal(false),
  packagePublishAuthorized: z.literal(false),
  externalWriteAuthorized: z.literal(false),
  secretMutationAuthorized: z.literal(false)
}).strict();

export const WorkspaceWriteDiffFileSummarySchema = z.object({
  path: z.string().min(1),
  addedLines: z.number().int().nonnegative(),
  removedLines: z.number().int().nonnegative(),
  changedLines: z.number().int().nonnegative()
});

export const WorkspaceWriteDiffInspectionSchema = z.object({
  patchHash: z.string().regex(/^[a-f0-9]{64}$/),
  changedFiles: z.array(WorkspaceWriteDiffFileSummarySchema),
  changedFileCount: z.number().int().nonnegative(),
  diffLineCount: z.number().int().nonnegative(),
  secretMarkerCount: z.number().int().nonnegative()
});

export const WorkspaceWritePatchGuardResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["passed", "blocked"]),
  reasons: z.array(z.string()),
  summary: z.object({
    patchHash: z.string().regex(/^[a-f0-9]{64}$/),
    changedFileCount: z.number().int().nonnegative(),
    diffLineCount: z.number().int().nonnegative(),
    secretMarkerCount: z.number().int().nonnegative(),
    maxChangedFiles: z.number().int().positive(),
    maxDiffLines: z.number().int().positive(),
    targetFiles: z.array(z.string()),
    changedFiles: z.array(WorkspaceWriteDiffFileSummarySchema)
  })
});

export const WorkspaceWriteRollbackPlanEvidenceSchema = z.object({
  schemaVersion: z.literal("workspace-write-rollback-plan-evidence.v1").default(
    "workspace-write-rollback-plan-evidence.v1"
  ),
  generatedAt: z.string().min(1),
  status: z.enum(["ready", "blocked"]),
  permit: z.object({
    schemaVersion: z.string().min(1).optional(),
    permitId: z.string().min(1),
    providerId: z.string().min(1),
    taskId: z.string().min(1),
    runId: z.string().min(1).optional(),
    planId: z.string().min(1).optional(),
    status: z.enum(["candidate", "approved", "blocked"]),
    sideEffectClass: z.literal("workspace_write"),
    sandboxMode: z.literal("workspace-write")
  }),
  beforeCommit: z.string().min(1).optional(),
  patchHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  changedFiles: z.array(WorkspaceWriteDiffFileSummarySchema),
  rollback: z.object({
    required: z.boolean(),
    available: z.boolean(),
    command: z.string().min(1).optional(),
    affectedFiles: z.array(z.string()),
    strategy: z.string().min(1)
  }),
  checks: z.object({
    permitApproved: z.boolean(),
    guardPassed: z.boolean(),
    beforeCommitRecorded: z.boolean(),
    patchHashRecorded: z.boolean(),
    changedFilesRecorded: z.boolean(),
    rollbackCommandRecorded: z.boolean(),
    noRawPatch: z.literal(true)
  }),
  blockingReasons: z.array(z.string())
});

export const WorkspaceWriteCanaryReadinessResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["ready", "blocked"]),
  reasons: z.array(z.string()),
  summary: z.object({
    targetFile: z.string().min(1),
    allowedTargetFile: z.string().min(1),
    providerId: z.string().min(1),
    permitId: z.string().min(1),
    permitSchemaVersion: z.string().min(1).optional(),
    planId: z.string().min(1).optional(),
    sideEffectClass: z.literal("workspace_write"),
    sandboxMode: z.literal("workspace-write"),
    maxChangedFiles: z.number().int().positive(),
    maxDiffLines: z.number().int().positive(),
    fixedTarget: z.boolean(),
    operatorGateEnabled: z.boolean(),
    permitApproved: z.boolean(),
    patchGuardPassed: z.boolean(),
    rollbackReady: z.boolean(),
    protectedBranch: z.boolean(),
    worktreeClean: z.boolean(),
    providerExecuteCalls: z.literal(0),
    realCodexCliCalls: z.literal(0),
    workspaceWriteExecuteCalls: z.literal(0),
    canaryFileWrites: z.literal(0)
  })
});

export const WorkspaceWriteRealCanaryAuthorizationResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["authorized", "blocked"]),
  reasons: z.array(z.string()),
  summary: z.object({
    exactPhraseMatched: z.boolean(),
    workspaceMatched: z.boolean(),
    branchMatched: z.boolean(),
    fixedTargetMatched: z.boolean(),
    allowedActionMatched: z.boolean(),
    sandboxMatched: z.boolean(),
    rollbackRequired: z.boolean(),
    pushDisallowed: z.boolean(),
    providerExecuteCalls: z.literal(0),
    realCodexCliCalls: z.literal(0),
    workspaceWriteExecuteCalls: z.literal(0),
    canaryFileWrites: z.literal(0)
  })
});

export const WorkspaceWriteRealCanaryPreExecutionGateResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["ready", "blocked"]),
  reasons: z.array(z.string()),
  summary: z.object({
    targetFile: z.string().min(1),
    authorizationAccepted: z.boolean(),
    canaryReadinessReady: z.boolean(),
    canaryFileAbsent: z.boolean(),
    fixedTargetMatched: z.boolean(),
    branchMatched: z.boolean(),
    workspaceMatched: z.boolean(),
    authorizationPacketAccepted: z.boolean(),
    permitV2Accepted: z.boolean(),
    packetPermitBindingAccepted: z.boolean(),
    pushDisallowed: z.boolean(),
    rollbackReady: z.boolean(),
    providerExecuteCalls: z.literal(0),
    realCodexCliCalls: z.literal(0),
    workspaceWriteExecuteCalls: z.literal(0),
    canaryFileWrites: z.literal(0)
  })
});

export const WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["accepted", "blocked"]),
  reasons: z.array(z.string()),
  summary: z.object({
    packetSchemaVersion: z.literal("workspace-write-real-canary-authorization-packet.v1"),
    permitSchemaVersion: z.literal("provider-workspace-write-execution-permit.v2").optional(),
    packetSchemaAccepted: z.boolean(),
    permitV2Accepted: z.boolean(),
    permitApproved: z.boolean(),
    permitV2ValidationPassed: z.boolean(),
    operatorAuthorizationMatched: z.boolean(),
    providerMatched: z.boolean(),
    fixedTargetMatched: z.boolean(),
    allowedActionMatched: z.boolean(),
    boundedCapsMatched: z.boolean(),
    rollbackBindingMatched: z.boolean(),
    branchPolicyMatched: z.boolean(),
    worktreeCleanMatched: z.boolean(),
    beforeCommitRecorded: z.boolean(),
    permitUnconsumed: z.boolean(),
    noBundledRemoteOrExternalAuthority: z.boolean(),
    providerExecuteCalls: z.literal(0),
    realCodexCliCalls: z.literal(0),
    workspaceWriteExecuteCalls: z.literal(0),
    canaryFileWrites: z.literal(0)
  })
});

export type WorkspaceWriteRealCanaryAuthorizationPacketV1 = z.infer<
  typeof WorkspaceWriteRealCanaryAuthorizationPacketV1Schema
>;
export type WorkspaceWriteDiffFileSummary = z.infer<typeof WorkspaceWriteDiffFileSummarySchema>;
export type WorkspaceWriteDiffInspection = z.infer<typeof WorkspaceWriteDiffInspectionSchema>;
export type WorkspaceWritePatchGuardResult = z.infer<typeof WorkspaceWritePatchGuardResultSchema>;
export type WorkspaceWriteRollbackPlanEvidence = z.infer<
  typeof WorkspaceWriteRollbackPlanEvidenceSchema
>;
export type WorkspaceWriteCanaryReadinessResult = z.infer<
  typeof WorkspaceWriteCanaryReadinessResultSchema
>;
export type WorkspaceWriteRealCanaryAuthorizationResult = z.infer<
  typeof WorkspaceWriteRealCanaryAuthorizationResultSchema
>;
export type WorkspaceWriteRealCanaryPreExecutionGateResult = z.infer<
  typeof WorkspaceWriteRealCanaryPreExecutionGateResultSchema
>;
export type WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceResult = z.infer<
  typeof WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceResultSchema
>;

export type WorkspaceWriteGuardPermit =
  | WorkspaceWriteProviderExecutionPermit
  | WorkspaceWriteProviderExecutionPermitV2;

const WorkspaceWriteGuardPermitSchema = z.union([
  WorkspaceWriteProviderExecutionPermitSchema,
  WorkspaceWriteProviderExecutionPermitV2Schema
]);

export type WorkspaceWritePatchGuardInput = {
  permit: WorkspaceWriteGuardPermit;
  unifiedDiff: string;
};

export type WorkspaceWriteRollbackPlanEvidenceInput = {
  permit: WorkspaceWriteGuardPermit;
  guardResult: WorkspaceWritePatchGuardResult;
  beforeCommit?: string;
  generatedAt: string;
};

export type WorkspaceWriteCanaryReadinessInput = {
  permit: WorkspaceWriteGuardPermit;
  guardResult: WorkspaceWritePatchGuardResult;
  rollbackEvidence: WorkspaceWriteRollbackPlanEvidence;
  targetFile: string;
  allowedTargetFile?: string;
  operatorGateEnabled: boolean;
};

export type WorkspaceWriteRealCanaryAuthorizationInput = {
  authorizationPhrase?: string;
  workspace?: string;
  branch?: string;
  targetFile?: string;
  allowedAction?: string;
  canaryConfig?: WorkspaceWriteRealCanaryConfigInput;
  sandboxMode?: string;
  rollbackRequired?: boolean;
  pushAuthorized?: boolean;
};

export type WorkspaceWriteRealCanaryConfig = {
  targetFile: string;
  workspace: string;
  branch: string;
  allowedAction: string;
};

export type WorkspaceWriteRealCanaryConfigInput = Partial<WorkspaceWriteRealCanaryConfig>;

export type WorkspaceWriteRealCanaryConfigEnv = Record<string, string | undefined>;

export type WorkspaceWriteRealCanaryPreExecutionGateInput = {
  authorization: WorkspaceWriteRealCanaryAuthorizationResult;
  readiness: WorkspaceWriteCanaryReadinessResult;
  authorizationPacket: WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceResult;
  canaryFileExists: boolean;
};

export type WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceInput = {
  authorizationPacket: unknown;
  permit: unknown;
  plan: unknown;
  manifest: unknown;
  now?: string;
  canaryConfig?: WorkspaceWriteRealCanaryConfigInput;
};

export function inspectWorkspaceWriteUnifiedDiff(unifiedDiff: string): WorkspaceWriteDiffInspection {
  const patchHash = createHash("sha256").update(unifiedDiff).digest("hex");
  const files = new Map<string, WorkspaceWriteDiffFileSummary>();
  let currentPath: string | undefined;
  let secretMarkerCount = 0;

  for (const line of unifiedDiff.replace(/\r\n/g, "\n").split("\n")) {
    const diffPath = readDiffGitPath(line) ?? readDiffHeaderPath(line);
    if (diffPath !== undefined) {
      currentPath = diffPath;
      ensureDiffFile(files, currentPath);
      continue;
    }

    if (currentPath === undefined) {
      if (lineHasSecretLikeContent(line)) {
        secretMarkerCount += 1;
      }
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      const summary = ensureDiffFile(files, currentPath);
      summary.addedLines += 1;
      summary.changedLines += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      const summary = ensureDiffFile(files, currentPath);
      summary.removedLines += 1;
      summary.changedLines += 1;
    }

    if (lineHasSecretLikeContent(line)) {
      secretMarkerCount += 1;
    }
  }

  const changedFiles = [...files.values()]
    .filter((file) => file.changedLines > 0)
    .sort((left, right) => left.path.localeCompare(right.path));
  const diffLineCount = changedFiles.reduce((sum, file) => sum + file.changedLines, 0);

  return WorkspaceWriteDiffInspectionSchema.parse({
    patchHash,
    changedFiles,
    changedFileCount: changedFiles.length,
    diffLineCount,
    secretMarkerCount
  });
}

export function evaluateWorkspaceWritePatchGuard(
  input: WorkspaceWritePatchGuardInput
): WorkspaceWritePatchGuardResult {
  const permit = WorkspaceWriteGuardPermitSchema.parse(input.permit);
  const inspection = inspectWorkspaceWriteUnifiedDiff(input.unifiedDiff);
  const reasons: string[] = [];
  const permittedTargets = new Set(permit.targetFiles);

  if (permit.status !== "approved") {
    reasons.push(`workspace_write_patch_guard_permit_not_approved:${permit.status}`);
  }

  if (inspection.changedFileCount === 0) {
    reasons.push("workspace_write_patch_guard_changed_files_required");
  }

  if (inspection.changedFileCount > permit.maxChangedFiles) {
    reasons.push("workspace_write_patch_guard_changed_files_exceed_max");
  }

  if (inspection.diffLineCount > permit.maxDiffLines) {
    reasons.push("workspace_write_patch_guard_diff_lines_exceed_max");
  }

  for (const file of inspection.changedFiles) {
    if (!isSafeWorkspaceRelativeFilePath(file.path)) {
      reasons.push("workspace_write_patch_guard_changed_file_out_of_bounds");
    }

    if (!permittedTargets.has(file.path)) {
      reasons.push(`workspace_write_patch_guard_changed_file_not_permitted:${file.path}`);
    }
  }

  if (inspection.secretMarkerCount > 0) {
    reasons.push("workspace_write_patch_guard_secret_like_content");
  }

  const uniqueReasons = uniqueStrings(reasons);

  return WorkspaceWritePatchGuardResultSchema.parse({
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "passed" : "blocked",
    reasons: uniqueReasons,
    summary: {
      patchHash: inspection.patchHash,
      changedFileCount: inspection.changedFileCount,
      diffLineCount: inspection.diffLineCount,
      secretMarkerCount: inspection.secretMarkerCount,
      maxChangedFiles: permit.maxChangedFiles,
      maxDiffLines: permit.maxDiffLines,
      targetFiles: [...permit.targetFiles],
      changedFiles: inspection.changedFiles
    }
  });
}

export function createWorkspaceWriteRollbackPlanEvidence(
  input: WorkspaceWriteRollbackPlanEvidenceInput
): WorkspaceWriteRollbackPlanEvidence {
  const permit = WorkspaceWriteGuardPermitSchema.parse(input.permit);
  const guardResult = WorkspaceWritePatchGuardResultSchema.parse(input.guardResult);
  const beforeCommit = normalizeOptionalString(input.beforeCommit);
  const changedFiles = guardResult.summary.changedFiles;
  const affectedFiles = changedFiles.map((file) => file.path);
  const reasons = [
    ...(permit.status === "approved"
      ? []
      : [`workspace_write_rollback_plan_permit_not_approved:${permit.status}`]),
    ...(guardResult.ok
      ? []
      : ["workspace_write_rollback_plan_guard_not_passed", ...guardResult.reasons]),
    ...(beforeCommit !== undefined
      ? []
      : ["workspace_write_rollback_plan_before_commit_required"]),
    ...(guardResult.summary.patchHash.length > 0
      ? []
      : ["workspace_write_rollback_plan_patch_hash_required"]),
    ...(changedFiles.length > 0
      ? []
      : ["workspace_write_rollback_plan_changed_files_required"]),
    ...(permit.rollbackRequired
      ? []
      : ["workspace_write_rollback_plan_rollback_required"])
  ];
  const uniqueReasons = uniqueStrings(reasons);
  const command = beforeCommit === undefined || affectedFiles.length === 0
    ? undefined
    : createGitRestoreRollbackCommand(beforeCommit, affectedFiles);

  return WorkspaceWriteRollbackPlanEvidenceSchema.parse({
    schemaVersion: "workspace-write-rollback-plan-evidence.v1",
    generatedAt: input.generatedAt,
    status: uniqueReasons.length === 0 ? "ready" : "blocked",
    permit: {
      schemaVersion: permit.schemaVersion,
      permitId: permit.permitId,
      providerId: permit.providerId,
      taskId: permit.taskId,
      ...(permit.runId !== undefined ? { runId: permit.runId } : {}),
      ...(permit.planId !== undefined ? { planId: permit.planId } : {}),
      status: permit.status,
      sideEffectClass: permit.sideEffectClass,
      sandboxMode: permit.sandboxMode
    },
    ...(beforeCommit !== undefined ? { beforeCommit } : {}),
    patchHash: guardResult.summary.patchHash,
    changedFiles,
    rollback: {
      required: permit.rollbackRequired,
      available: uniqueReasons.length === 0,
      ...(command !== undefined ? { command } : {}),
      affectedFiles,
      strategy: "Restore affected files from the recorded beforeCommit without moving branches or touching remote state."
    },
    checks: {
      permitApproved: permit.status === "approved",
      guardPassed: guardResult.ok,
      beforeCommitRecorded: beforeCommit !== undefined,
      patchHashRecorded: guardResult.summary.patchHash.length > 0,
      changedFilesRecorded: changedFiles.length > 0,
      rollbackCommandRecorded: command !== undefined,
      noRawPatch: true
    },
    blockingReasons: uniqueReasons
  });
}

export function evaluateWorkspaceWriteCanaryReadiness(
  input: WorkspaceWriteCanaryReadinessInput
): WorkspaceWriteCanaryReadinessResult {
  const permit = WorkspaceWriteGuardPermitSchema.parse(input.permit);
  const guardResult = WorkspaceWritePatchGuardResultSchema.parse(input.guardResult);
  const rollbackEvidence = WorkspaceWriteRollbackPlanEvidenceSchema.parse(input.rollbackEvidence);
  const allowedTargetFile = input.allowedTargetFile ?? DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE;
  const fixedTarget = input.targetFile === allowedTargetFile
    && permit.targetFiles.length === 1
    && permit.targetFiles[0] === allowedTargetFile
    && guardResult.summary.changedFiles.length === 1
    && guardResult.summary.changedFiles[0]?.path === allowedTargetFile;
  const reasons = [
    ...(input.operatorGateEnabled
      ? []
      : ["workspace_write_canary_readiness_operator_gate_required"]),
    ...(fixedTarget
      ? []
      : ["workspace_write_canary_readiness_fixed_target_required"]),
    ...(permit.status === "approved"
      ? []
      : [`workspace_write_canary_readiness_permit_not_approved:${permit.status}`]),
    ...(permit.sideEffectClass === "workspace_write"
      ? []
      : ["workspace_write_canary_readiness_requires_workspace_write_side_effect"]),
    ...(permit.sandboxMode === "workspace-write"
      ? []
      : ["workspace_write_canary_readiness_requires_workspace_write_sandbox"]),
    ...(permit.maxChangedFiles === 1
      ? []
      : ["workspace_write_canary_readiness_single_file_only"]),
    ...(permit.maxDiffLines <= 2
      ? []
      : ["workspace_write_canary_readiness_diff_cap_too_large"]),
    ...(permit.operatorAuthorizationId !== undefined
      ? []
      : ["workspace_write_canary_readiness_operator_authorization_required"]),
    ...(permit.repositoryState.protectedBranch
      ? ["workspace_write_canary_readiness_protected_branch_forbidden"]
      : []),
    ...(permit.repositoryState.worktreeClean
      ? []
      : ["workspace_write_canary_readiness_dirty_worktree_forbidden"]),
    ...(guardResult.ok
      ? []
      : ["workspace_write_canary_readiness_patch_guard_not_passed", ...guardResult.reasons]),
    ...(rollbackEvidence.status === "ready" && rollbackEvidence.rollback.available
      ? []
      : ["workspace_write_canary_readiness_rollback_not_ready", ...rollbackEvidence.blockingReasons])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return WorkspaceWriteCanaryReadinessResultSchema.parse({
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "ready" : "blocked",
    reasons: uniqueReasons,
    summary: {
      targetFile: input.targetFile,
      allowedTargetFile,
      providerId: permit.providerId,
      permitId: permit.permitId,
      permitSchemaVersion: permit.schemaVersion,
      ...(permit.planId !== undefined ? { planId: permit.planId } : {}),
      sideEffectClass: permit.sideEffectClass,
      sandboxMode: permit.sandboxMode,
      maxChangedFiles: permit.maxChangedFiles,
      maxDiffLines: permit.maxDiffLines,
      fixedTarget,
      operatorGateEnabled: input.operatorGateEnabled,
      permitApproved: permit.status === "approved",
      patchGuardPassed: guardResult.ok,
      rollbackReady: rollbackEvidence.status === "ready" && rollbackEvidence.rollback.available,
      protectedBranch: permit.repositoryState.protectedBranch,
      worktreeClean: permit.repositoryState.worktreeClean,
      providerExecuteCalls: 0,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      canaryFileWrites: 0
    }
  });
}

export function createWorkspaceWriteRealCanaryConfig(
  input: WorkspaceWriteRealCanaryConfigInput = {}
): WorkspaceWriteRealCanaryConfig {
  return {
    targetFile: normalizeCanaryTargetFile(
      configuredString(input.targetFile, DEFAULT_WORKSPACE_WRITE_REAL_CANARY_CONFIG.targetFile, "target_file")
    ),
    workspace: configuredString(
      input.workspace,
      DEFAULT_WORKSPACE_WRITE_REAL_CANARY_CONFIG.workspace,
      "workspace"
    ),
    branch: configuredString(
      input.branch,
      DEFAULT_WORKSPACE_WRITE_REAL_CANARY_CONFIG.branch,
      "branch"
    ),
    allowedAction: configuredString(
      input.allowedAction,
      DEFAULT_WORKSPACE_WRITE_REAL_CANARY_CONFIG.allowedAction,
      "allowed_action"
    )
  };
}

export function createWorkspaceWriteRealCanaryConfigFromEnv(
  env: WorkspaceWriteRealCanaryConfigEnv
): WorkspaceWriteRealCanaryConfig {
  const input: WorkspaceWriteRealCanaryConfigInput = {};
  const targetFile = env[WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.targetFile];
  const workspace = env[WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.workspace];
  const branch = env[WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.branch];
  const allowedAction = env[WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.allowedAction];

  if (targetFile !== undefined) {
    input.targetFile = targetFile;
  }
  if (workspace !== undefined) {
    input.workspace = workspace;
  }
  if (branch !== undefined) {
    input.branch = branch;
  }
  if (allowedAction !== undefined) {
    input.allowedAction = allowedAction;
  }

  return createWorkspaceWriteRealCanaryConfig(input);
}

export function evaluateWorkspaceWriteRealCanaryAuthorization(
  input: WorkspaceWriteRealCanaryAuthorizationInput
): WorkspaceWriteRealCanaryAuthorizationResult {
  const canaryConfig = createWorkspaceWriteRealCanaryConfig(input.canaryConfig);
  const exactPhraseMatched = input.authorizationPhrase === PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE;
  const workspaceMatched = normalizeWorkspacePath(input.workspace) === normalizeWorkspacePath(
    canaryConfig.workspace
  );
  const branchMatched = input.branch === canaryConfig.branch;
  const fixedTargetMatched = input.targetFile === canaryConfig.targetFile;
  const allowedActionMatched = input.allowedAction === canaryConfig.allowedAction;
  const sandboxMatched = input.sandboxMode === "workspace-write";
  const rollbackRequired = input.rollbackRequired === true;
  const pushDisallowed = input.pushAuthorized !== true;
  const reasons = [
    ...(exactPhraseMatched
      ? []
      : ["workspace_write_real_canary_authorization_exact_phrase_required"]),
    ...(workspaceMatched
      ? []
      : ["workspace_write_real_canary_authorization_workspace_mismatch"]),
    ...(branchMatched
      ? []
      : ["workspace_write_real_canary_authorization_main_branch_required"]),
    ...(fixedTargetMatched
      ? []
      : ["workspace_write_real_canary_authorization_fixed_target_required"]),
    ...(allowedActionMatched
      ? []
      : ["workspace_write_real_canary_authorization_bounded_action_required"]),
    ...(sandboxMatched
      ? []
      : ["workspace_write_real_canary_authorization_workspace_write_sandbox_required"]),
    ...(rollbackRequired
      ? []
      : ["workspace_write_real_canary_authorization_rollback_required"]),
    ...(pushDisallowed
      ? []
      : ["workspace_write_real_canary_authorization_push_must_be_separate"])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return WorkspaceWriteRealCanaryAuthorizationResultSchema.parse({
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "authorized" : "blocked",
    reasons: uniqueReasons,
    summary: {
      exactPhraseMatched,
      workspaceMatched,
      branchMatched,
      fixedTargetMatched,
      allowedActionMatched,
      sandboxMatched,
      rollbackRequired,
      pushDisallowed,
      providerExecuteCalls: 0,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      canaryFileWrites: 0
    }
  });
}

export function evaluateWorkspaceWriteRealCanaryAuthorizationPacket(
  input: WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceInput
): WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceResult {
  const canaryConfig = createWorkspaceWriteRealCanaryConfig(input.canaryConfig);
  const packetParse = WorkspaceWriteRealCanaryAuthorizationPacketV1Schema.safeParse(
    input.authorizationPacket
  );
  const permitParse = WorkspaceWriteProviderExecutionPermitV2Schema.safeParse(input.permit);
  const planParse = ExecutorExecutionPlanSchema.safeParse(input.plan);
  const manifestParse = ProviderManifestSchema.safeParse(input.manifest);
  const packet = packetParse.success ? packetParse.data : undefined;
  const permit = permitParse.success ? permitParse.data : undefined;
  const plan = planParse.success ? planParse.data : undefined;
  const manifest = manifestParse.success ? manifestParse.data : undefined;
  const reasons: string[] = [];

  if (!packetParse.success) {
    reasons.push(
      `workspace_write_real_canary_authorization_packet_invalid:${formatZodIssues(packetParse.error)}`
    );
  }

  if (!permitParse.success) {
    reasons.push(
      `workspace_write_real_canary_authorization_packet_permit_v2_invalid:${formatZodIssues(permitParse.error)}`
    );
  }

  if (!planParse.success) {
    reasons.push(
      `workspace_write_real_canary_authorization_packet_plan_invalid:${formatZodIssues(planParse.error)}`
    );
  }

  if (!manifestParse.success) {
    reasons.push(
      `workspace_write_real_canary_authorization_packet_manifest_invalid:${formatZodIssues(manifestParse.error)}`
    );
  }

  const permitValidationReasons = permit !== undefined
    && plan !== undefined
    && manifest !== undefined
    ? validateWorkspaceWriteProviderExecutionPermitV2ForPlan(permit, plan, manifest, {
        reasonPrefix: "workspace_write_real_canary_authorization_packet_permit_v2",
        ...(input.now === undefined ? {} : { now: input.now })
      })
    : [];
  const permitV2ValidationPassed = permit !== undefined
    && plan !== undefined
    && manifest !== undefined
    && permitValidationReasons.length === 0;
  const operatorAuthorizationMatched = packet !== undefined
    && permit !== undefined
    && permit.operatorAuthorizationId === packet.operatorAuthorizationId;
  const providerMatched = packet !== undefined
    && permit !== undefined
    && permit.providerId === packet.providerId;
  const allowedActionMatched = packet !== undefined
    && packet.allowedAction === canaryConfig.allowedAction;
  const fixedTargetMatched = packet !== undefined
    && permit !== undefined
    && packet.targetFile === canaryConfig.targetFile
    && permit.targetFiles.length === 1
    && permit.targetFiles[0] === packet.targetFile;
  const boundedCapsMatched = packet !== undefined
    && permit !== undefined
    && permit.maxChangedFiles === packet.maxChangedFiles
    && permit.maxDiffLines === packet.maxDiffLines;
  const rollbackBindingMatched = packet !== undefined
    && permit !== undefined
    && permit.rollbackRequired === packet.rollbackRequired
    && permit.rollback.commandIdentity.kind === "git_restore_from_commit"
    && permit.rollback.commandIdentity.affectedFiles.length === 1
    && permit.rollback.commandIdentity.affectedFiles[0] === packet.targetFile;
  const branchPolicyMatched = packet !== undefined
    && permit !== undefined
    && packet.branchPolicy === "non_main_non_protected_branch_only"
    && permit.protectedBranchForbidden
    && !permit.repositoryState.protectedBranch
    && permit.repositoryState.branch !== "main";
  const worktreeCleanMatched = packet !== undefined
    && permit !== undefined
    && packet.worktreeCleanRequired
    && permit.dirtyWorktreeForbidden
    && permit.repositoryState.worktreeClean;
  const beforeCommitRecorded = packet !== undefined
    && permit !== undefined
    && packet.beforeCommitRequired
    && permit.rollback.beforeCommit.length > 0
    && permit.repositoryState.headCommit === permit.rollback.beforeCommit;
  const permitUnconsumed = permit !== undefined && permit.consumedAt === undefined;
  const permitApproved = permit !== undefined
    && permit.status === "approved"
    && permit.approvalStatus === "approved";
  const noBundledRemoteOrExternalAuthority = packet !== undefined
    && !packet.pushAuthorized
    && !packet.releaseAuthorized
    && !packet.tagAuthorized
    && !packet.deploymentAuthorized
    && !packet.packagePublishAuthorized
    && !packet.externalWriteAuthorized
    && !packet.secretMutationAuthorized;

  if (packet !== undefined && packet.targetFile !== canaryConfig.targetFile) {
    reasons.push("workspace_write_real_canary_authorization_packet_target_config_mismatch");
  }

  if (packet !== undefined && !allowedActionMatched) {
    reasons.push("workspace_write_real_canary_authorization_packet_allowed_action_config_mismatch");
  }

  if (permit !== undefined && plan !== undefined && manifest !== undefined && !permitV2ValidationPassed) {
    reasons.push(
      "workspace_write_real_canary_authorization_packet_permit_v2_validation_failed",
      ...permitValidationReasons
    );
  }

  if (packet !== undefined && permit !== undefined && !operatorAuthorizationMatched) {
    reasons.push("workspace_write_real_canary_authorization_packet_operator_permit_mismatch");
  }

  if (packet !== undefined && permit !== undefined && !providerMatched) {
    reasons.push("workspace_write_real_canary_authorization_packet_provider_permit_mismatch");
  }

  if (packet !== undefined && permit !== undefined && !fixedTargetMatched) {
    reasons.push("workspace_write_real_canary_authorization_packet_fixed_target_required");
  }

  if (packet !== undefined && permit !== undefined && !boundedCapsMatched) {
    reasons.push("workspace_write_real_canary_authorization_packet_bounded_caps_required");
  }

  if (packet !== undefined && permit !== undefined && !rollbackBindingMatched) {
    reasons.push("workspace_write_real_canary_authorization_packet_rollback_binding_required");
  }

  if (packet !== undefined && permit !== undefined && !branchPolicyMatched) {
    reasons.push("workspace_write_real_canary_authorization_packet_non_main_non_protected_branch_required");
  }

  if (packet !== undefined && permit !== undefined && !worktreeCleanMatched) {
    reasons.push("workspace_write_real_canary_authorization_packet_clean_worktree_required");
  }

  if (packet !== undefined && permit !== undefined && !beforeCommitRecorded) {
    reasons.push("workspace_write_real_canary_authorization_packet_before_commit_required");
  }

  if (permit !== undefined && !permitUnconsumed) {
    reasons.push("workspace_write_real_canary_authorization_packet_permit_must_be_unconsumed");
  }

  if (permit !== undefined && !permitApproved) {
    reasons.push("workspace_write_real_canary_authorization_packet_permit_must_be_approved");
  }

  if (packet !== undefined && !noBundledRemoteOrExternalAuthority) {
    reasons.push("workspace_write_real_canary_authorization_packet_remote_or_external_authority_forbidden");
  }

  const uniqueReasons = uniqueStrings(reasons);

  return WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceResultSchema.parse({
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "accepted" : "blocked",
    reasons: uniqueReasons,
    summary: {
      packetSchemaVersion: "workspace-write-real-canary-authorization-packet.v1",
      ...(permit !== undefined ? { permitSchemaVersion: permit.schemaVersion } : {}),
      packetSchemaAccepted: packetParse.success,
      permitV2Accepted: permitParse.success,
      permitApproved,
      permitV2ValidationPassed,
      operatorAuthorizationMatched,
      providerMatched,
      fixedTargetMatched,
      allowedActionMatched,
      boundedCapsMatched,
      rollbackBindingMatched,
      branchPolicyMatched,
      worktreeCleanMatched,
      beforeCommitRecorded,
      permitUnconsumed,
      noBundledRemoteOrExternalAuthority,
      providerExecuteCalls: 0,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      canaryFileWrites: 0
    }
  });
}

export function evaluateWorkspaceWriteRealCanaryPreExecutionGate(
  input: WorkspaceWriteRealCanaryPreExecutionGateInput
): WorkspaceWriteRealCanaryPreExecutionGateResult {
  const authorization = WorkspaceWriteRealCanaryAuthorizationResultSchema.parse(input.authorization);
  const readiness = WorkspaceWriteCanaryReadinessResultSchema.parse(input.readiness);
  const authorizationPacket = WorkspaceWriteRealCanaryAuthorizationPacketAcceptanceResultSchema.parse(
    input.authorizationPacket
  );
  const canaryFileAbsent = !input.canaryFileExists;
  const reasons = [
    ...(authorizationPacket.ok
      ? []
      : [
          "workspace_write_real_canary_pre_execution_authorization_packet_blocked",
          ...authorizationPacket.reasons
        ]),
    ...(authorization.ok
      ? []
      : [
          "workspace_write_real_canary_pre_execution_authorization_blocked",
          ...authorization.reasons
        ]),
    ...(readiness.ok
      ? []
      : [
          "workspace_write_real_canary_pre_execution_readiness_blocked",
          ...readiness.reasons
        ]),
    ...(canaryFileAbsent
      ? []
      : ["workspace_write_real_canary_pre_execution_canary_file_must_be_absent"])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return WorkspaceWriteRealCanaryPreExecutionGateResultSchema.parse({
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "ready" : "blocked",
    reasons: uniqueReasons,
    summary: {
      targetFile: readiness.summary.targetFile,
      authorizationAccepted: authorization.ok,
      canaryReadinessReady: readiness.ok,
      canaryFileAbsent,
      fixedTargetMatched: authorization.summary.fixedTargetMatched
        && readiness.summary.fixedTarget
        && authorizationPacket.summary.fixedTargetMatched,
      branchMatched: authorization.summary.branchMatched,
      workspaceMatched: authorization.summary.workspaceMatched,
      authorizationPacketAccepted: authorizationPacket.ok,
      permitV2Accepted: authorizationPacket.summary.permitV2Accepted,
      packetPermitBindingAccepted: authorizationPacket.summary.operatorAuthorizationMatched
        && authorizationPacket.summary.providerMatched
        && authorizationPacket.summary.fixedTargetMatched
        && authorizationPacket.summary.allowedActionMatched
        && authorizationPacket.summary.boundedCapsMatched
        && authorizationPacket.summary.rollbackBindingMatched
        && authorizationPacket.summary.permitApproved
        && authorizationPacket.summary.permitV2ValidationPassed,
      pushDisallowed: authorization.summary.pushDisallowed,
      rollbackReady: readiness.summary.rollbackReady,
      providerExecuteCalls: 0,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      canaryFileWrites: 0
    }
  });
}

function ensureDiffFile(
  files: Map<string, WorkspaceWriteDiffFileSummary>,
  path: string
): WorkspaceWriteDiffFileSummary {
  const existing = files.get(path);
  if (existing !== undefined) {
    return existing;
  }

  const summary: WorkspaceWriteDiffFileSummary = {
    path,
    addedLines: 0,
    removedLines: 0,
    changedLines: 0
  };
  files.set(path, summary);
  return summary;
}

function readDiffGitPath(line: string): string | undefined {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  return match?.[2] === undefined ? undefined : normalizeDiffPath(match[2]);
}

function readDiffHeaderPath(line: string): string | undefined {
  const match = /^\+\+\+ (.+)$/.exec(line);
  const rawPath = match?.[1];
  if (rawPath === undefined || rawPath === "/dev/null") {
    return undefined;
  }

  return normalizeDiffPath(rawPath);
}

function normalizeDiffPath(path: string): string | undefined {
  const unquoted = path.replace(/^"|"$/g, "");
  const withoutPrefix = unquoted.startsWith("a/") || unquoted.startsWith("b/")
    ? unquoted.slice(2)
    : unquoted;
  return withoutPrefix.length === 0 ? undefined : withoutPrefix.replace(/\\/g, "/");
}

function lineHasSecretLikeContent(line: string): boolean {
  return redactText(line) !== line;
}

function createGitRestoreRollbackCommand(beforeCommit: string, affectedFiles: string[]): string {
  return [
    "git",
    "restore",
    "--source",
    beforeCommit,
    "--",
    ...affectedFiles
  ].map(quoteCommandToken).join(" ");
}

function quoteCommandToken(token: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(token)) {
    return token;
  }

  return `"${token.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function normalizeWorkspacePath(value: string | undefined): string | undefined {
  const trimmed = normalizeOptionalString(value);
  return trimmed === undefined ? undefined : trimmed.replace(/\//g, "\\").replace(/\\+$/g, "");
}

function configuredString(
  value: string | undefined,
  defaultValue: string,
  label: string
): string {
  const configured = value === undefined ? defaultValue : value;
  const normalized = normalizeOptionalString(configured);

  if (normalized === undefined) {
    throw new Error(`workspace_write_real_canary_config_${label}_required`);
  }

  return normalized;
}

function normalizeCanaryTargetFile(value: string): string {
  const normalized = value.replace(/\\/g, "/");

  if (!isSafeWorkspaceRelativeFilePath(normalized)) {
    throw new Error("workspace_write_real_canary_config_target_file_unsafe");
  }

  return normalized;
}

function isSafeWorkspaceRelativeFilePath(path: string): boolean {
  const slashPath = path.replace(/\\/g, "/");

  if (
    slashPath.length === 0
    || slashPath.startsWith("/")
    || /^[a-zA-Z]:/.test(slashPath)
    || slashPath.endsWith("/")
  ) {
    return false;
  }

  const parts = slashPath.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "root";
      return `${path}:${issue.code}`;
    })
    .sort()
    .join("|");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
