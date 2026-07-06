import { createHash } from "node:crypto";
import { z } from "zod";
import { redactText } from "../../governance-internal-redaction/src/index.js";
import {
  WorkspaceWriteProviderExecutionPermitSchema,
  WorkspaceWriteProviderExecutionPermitV2Schema,
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
    pushDisallowed: z.boolean(),
    rollbackReady: z.boolean(),
    providerExecuteCalls: z.literal(0),
    realCodexCliCalls: z.literal(0),
    workspaceWriteExecuteCalls: z.literal(0),
    canaryFileWrites: z.literal(0)
  })
});

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
  canaryFileExists: boolean;
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

export function evaluateWorkspaceWriteRealCanaryPreExecutionGate(
  input: WorkspaceWriteRealCanaryPreExecutionGateInput
): WorkspaceWriteRealCanaryPreExecutionGateResult {
  const authorization = WorkspaceWriteRealCanaryAuthorizationResultSchema.parse(input.authorization);
  const readiness = WorkspaceWriteCanaryReadinessResultSchema.parse(input.readiness);
  const canaryFileAbsent = !input.canaryFileExists;
  const reasons = [
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
        && readiness.summary.fixedTarget,
      branchMatched: authorization.summary.branchMatched,
      workspaceMatched: authorization.summary.workspaceMatched,
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
