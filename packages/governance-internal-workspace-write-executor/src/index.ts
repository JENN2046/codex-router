import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, realpath, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative } from "node:path";
import { promisify } from "node:util";
import {
  WorkspaceWriteProviderExecutionPermitV2Schema,
  consumeWorkspaceWriteProviderExecutionPermitV2ForPlan,
  validateWorkspaceWriteProviderExecutionPermitV2ForPlan,
  type ExecutorExecutionPlan,
  type ProviderExecutionPermitConsumptionStore,
  type ProviderManifest,
  type WorkspaceWriteProviderExecutionPermitV2
} from "../../provider-core/src/index.js";
import {
  createWorkspaceWriteRollbackPlanEvidence,
  evaluateWorkspaceWritePatchGuard,
  type WorkspaceWritePatchGuardResult,
  type WorkspaceWriteRollbackPlanEvidence
} from "../../governance-internal-workspace-write-guard/src/index.js";

const execFileAsync = promisify(execFile);

export type WorkspaceWriteOperation =
  | {
      kind: "write";
      path: string;
      content: string;
    }
  | {
      kind: "delete";
      path: string;
    };

export type WorkspaceWriteExecutionStatus =
  | "ready"
  | "passed"
  | "blocked"
  | "failed";

export interface WorkspaceWriteExecutionEvidence {
  schemaVersion: "workspace-write-execution-evidence.v1";
  generatedAt: string;
  mode: "workspace-write";
  status: WorkspaceWriteExecutionStatus;
  taskId: string;
  checks: {
    executeRequested: boolean;
    executionAuthorizationMatched: boolean;
    permitValidForPlan: boolean;
    permitConsumed: boolean;
    branchMatched: boolean;
    branchNonProtected: boolean;
    headCommitMatched: boolean;
    worktreeCleanBefore: boolean;
    operationTargetsDeclared: boolean;
    operationTargetsUnique: boolean;
    operationTargetsSafe: boolean;
    preExecutionPatchGuardPassed: boolean;
    rollbackReady: boolean;
    wroteOnlyPermittedTargets: boolean;
    postExecutionPatchGuardPassed: boolean;
    rollbackAttempted: boolean;
    rollbackVerified: boolean;
    noProviderExecute: true;
    noRealCodexCli: true;
    noRemoteWrite: true;
    evidenceSanitized: boolean;
  };
  summary: {
    branch: string;
    beforeCommit: string;
    afterCommit: string;
    permitId: string;
    planId: string;
    providerId: string;
    targetFiles: string[];
    operationCount: number;
    writeOperationCount: number;
    deleteOperationCount: number;
    expectedPatchHash?: string;
    actualPatchHash?: string;
    changedFileCount: number;
    diffLineCount: number;
    rollbackAffectedFiles: string[];
    contentHashes: Array<{
      path: string;
      beforeHash: string | null;
      afterHash: string | null;
    }>;
  };
  counters: {
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0 | 1;
    fileWriteCalls: number;
    fileDeleteCalls: number;
    remoteWrites: 0;
  };
  reasons: string[];
}

export interface WorkspaceWriteExecutionInput {
  cwd: string;
  permit: WorkspaceWriteProviderExecutionPermitV2;
  plan: ExecutorExecutionPlan;
  manifest: ProviderManifest;
  operations: WorkspaceWriteOperation[];
  executionAuthorizationId?: string;
  execute?: boolean;
  now: () => string;
  consumptionStore?: ProviderExecutionPermitConsumptionStore;
}

export async function runWorkspaceWriteExecution(
  input: WorkspaceWriteExecutionInput
): Promise<WorkspaceWriteExecutionEvidence> {
  const generatedAt = input.now();
  const permit = WorkspaceWriteProviderExecutionPermitV2Schema.parse(input.permit);
  const normalizedOperations = normalizeOperations(input.operations);
  const targetFiles = [...permit.targetFiles];
  const operationTargets = normalizedOperations.map((operation) => operation.path);
  const operationTargetsDeclared = operationTargets.length > 0
    && operationTargets.every((path) => targetFiles.includes(path));
  const operationTargetsUnique = new Set(operationTargets).size === operationTargets.length;
  const operationTargetsSafe = operationTargets.every(isSafeWorkspaceRelativePath);
  const executionAuthorizationMatched = input.executionAuthorizationId !== undefined
    && input.executionAuthorizationId === permit.operatorAuthorizationId;
  const permitValidationReasons = validateWorkspaceWriteProviderExecutionPermitV2ForPlan(
    permit,
    input.plan,
    input.manifest,
    {
      now: generatedAt,
      reasonPrefix: "workspace_write_execution_permit_v2"
    }
  );
  const gitProbe = await probeWorkspaceGitState(input.cwd);
  if (gitProbe.status === "blocked") {
    return createEvidence({
      generatedAt,
      status: "blocked",
      executeRequested: input.execute === true,
      executionAuthorizationMatched,
      permitValidForPlan: permitValidationReasons.length === 0,
      permitConsumed: false,
      branch: "unknown",
      beforeCommit: "unknown",
      afterCommit: "unknown",
      permit,
      operationTargets,
      operations: normalizedOperations,
      branchMatched: false,
      branchNonProtected: false,
      headCommitMatched: false,
      worktreeCleanBefore: false,
      operationTargetsDeclared,
      operationTargetsUnique,
      operationTargetsSafe,
      preExecutionPatchGuardPassed: false,
      rollbackReady: false,
      wroteOnlyPermittedTargets: false,
      postExecutionPatchGuardPassed: false,
      rollbackAttempted: false,
      rollbackVerified: false,
      expectedGuard: undefined,
      actualGuard: undefined,
      contentHashes: [],
      counters: {
        workspaceWriteExecuteCalls: 0,
        fileWriteCalls: 0,
        fileDeleteCalls: 0
      },
      reasons: uniqueStrings([
        ...(executionAuthorizationMatched
          ? []
          : ["workspace_write_execution_authorization_id_required"]),
        ...(permitValidationReasons.length === 0
          ? []
          : [
              "workspace_write_execution_permit_invalid",
              ...permitValidationReasons
            ]),
        "workspace_write_execution_git_probe_failed"
      ])
    });
  }

  const { branch, headCommit, statusBefore } = gitProbe;
  const operationTargetPathReasons = operationTargetsSafe
    ? await collectWorkspaceTargetPathReasons(input.cwd, operationTargets)
    : [];
  const existingCommitAbsentTargetReasons = operationTargetsSafe
    ? await collectWorkspaceExistingCommitAbsentTargetReasons(
        input.cwd,
        headCommit,
        operationTargets
      )
    : [];
  const operationWritableRootReasons = operationTargetsSafe
    ? collectWorkspaceWritableRootReasons(
        input.plan.sandboxProfile.writableRoots,
        operationTargets
      )
    : [];
  const branchMatched = permit.repositoryState.branch === branch;
  const branchNonProtected = !permit.repositoryState.protectedBranch;
  const headCommitMatched = permit.repositoryState.headCommit === headCommit
    && permit.rollback.beforeCommit === headCommit;
  const worktreeCleanBefore = statusBefore.trim() === "";
  let expectedGuard: WorkspaceWritePatchGuardResult | undefined;
  let rollbackEvidence: WorkspaceWriteRollbackPlanEvidence | undefined;
  const gateReasons: string[] = [
    ...(executionAuthorizationMatched
      ? []
      : ["workspace_write_execution_authorization_id_required"]),
    ...(permitValidationReasons.length === 0
      ? []
      : [
          "workspace_write_execution_permit_invalid",
          ...permitValidationReasons
        ]),
    ...(branchMatched ? [] : ["workspace_write_execution_branch_mismatch"]),
    ...(branchNonProtected ? [] : ["workspace_write_execution_protected_branch_forbidden"]),
    ...(headCommitMatched ? [] : ["workspace_write_execution_head_commit_mismatch"]),
    ...(worktreeCleanBefore ? [] : ["workspace_write_execution_dirty_worktree_forbidden"]),
    ...(operationTargetsDeclared ? [] : ["workspace_write_execution_operation_target_not_declared"]),
    ...(operationTargetsUnique ? [] : ["workspace_write_execution_duplicate_operation_target"]),
    ...(operationTargetsSafe ? [] : ["workspace_write_execution_unsafe_operation_target"]),
    ...operationTargetPathReasons,
    ...existingCommitAbsentTargetReasons,
    ...operationWritableRootReasons
  ];

  if (normalizedOperations.length > 0 && operationTargetsSafe) {
    try {
      const expectedDiff = await createWorkspaceWriteSyntheticDiff({
        cwd: input.cwd,
        beforeCommit: headCommit,
        operations: normalizedOperations
      });
      expectedGuard = evaluateWorkspaceWritePatchGuard({
        permit,
        unifiedDiff: expectedDiff
      });
      rollbackEvidence = createWorkspaceWriteRollbackPlanEvidence({
        permit,
        guardResult: expectedGuard,
        beforeCommit: headCommit,
        generatedAt
      });
    } catch {
      gateReasons.push("workspace_write_execution_expected_diff_failed");
    }
  }

  if (expectedGuard !== undefined && !expectedGuard.ok) {
    gateReasons.push(
      "workspace_write_execution_pre_execution_patch_guard_failed",
      ...expectedGuard.reasons
    );
  }

  if (rollbackEvidence !== undefined && rollbackEvidence.status !== "ready") {
    gateReasons.push(
      "workspace_write_execution_rollback_not_ready",
      ...rollbackEvidence.blockingReasons
    );
  }

  const uniqueGateReasons = uniqueStrings(gateReasons);
  if (uniqueGateReasons.length > 0) {
    return createEvidence({
      generatedAt,
      status: "blocked",
      executeRequested: input.execute === true,
      executionAuthorizationMatched,
      permitValidForPlan: permitValidationReasons.length === 0,
      permitConsumed: false,
      branch,
      beforeCommit: headCommit,
      afterCommit: headCommit,
      permit,
      operationTargets,
      operations: normalizedOperations,
      branchMatched,
      branchNonProtected,
      headCommitMatched,
      worktreeCleanBefore,
      operationTargetsDeclared,
      operationTargetsUnique,
      operationTargetsSafe,
      preExecutionPatchGuardPassed: expectedGuard?.ok ?? false,
      rollbackReady: rollbackEvidence?.status === "ready",
      wroteOnlyPermittedTargets: false,
      postExecutionPatchGuardPassed: false,
      rollbackAttempted: false,
      rollbackVerified: false,
      expectedGuard,
      actualGuard: undefined,
      contentHashes: [],
      counters: {
        workspaceWriteExecuteCalls: 0,
        fileWriteCalls: 0,
        fileDeleteCalls: 0
      },
      reasons: uniqueGateReasons
    });
  }

  if (input.execute !== true) {
    return createEvidence({
      generatedAt,
      status: "ready",
      executeRequested: false,
      executionAuthorizationMatched,
      permitValidForPlan: true,
      permitConsumed: false,
      branch,
      beforeCommit: headCommit,
      afterCommit: headCommit,
      permit,
      operationTargets,
      operations: normalizedOperations,
      branchMatched,
      branchNonProtected,
      headCommitMatched,
      worktreeCleanBefore,
      operationTargetsDeclared,
      operationTargetsUnique,
      operationTargetsSafe,
      preExecutionPatchGuardPassed: expectedGuard?.ok ?? false,
      rollbackReady: rollbackEvidence?.status === "ready",
      wroteOnlyPermittedTargets: false,
      postExecutionPatchGuardPassed: false,
      rollbackAttempted: false,
      rollbackVerified: false,
      expectedGuard,
      actualGuard: undefined,
      contentHashes: [],
      counters: {
        workspaceWriteExecuteCalls: 0,
        fileWriteCalls: 0,
        fileDeleteCalls: 0
      },
      reasons: []
    });
  }

  if (input.consumptionStore === undefined) {
    return createEvidence({
      generatedAt,
      status: "blocked",
      executeRequested: true,
      executionAuthorizationMatched,
      permitValidForPlan: true,
      permitConsumed: false,
      branch,
      beforeCommit: headCommit,
      afterCommit: headCommit,
      permit,
      operationTargets,
      operations: normalizedOperations,
      branchMatched,
      branchNonProtected,
      headCommitMatched,
      worktreeCleanBefore,
      operationTargetsDeclared,
      operationTargetsUnique,
      operationTargetsSafe,
      preExecutionPatchGuardPassed: expectedGuard?.ok ?? false,
      rollbackReady: rollbackEvidence?.status === "ready",
      wroteOnlyPermittedTargets: false,
      postExecutionPatchGuardPassed: false,
      rollbackAttempted: false,
      rollbackVerified: false,
      expectedGuard,
      actualGuard: undefined,
      contentHashes: [],
      counters: {
        workspaceWriteExecuteCalls: 0,
        fileWriteCalls: 0,
        fileDeleteCalls: 0
      },
      reasons: ["workspace_write_execution_consumption_store_required"]
    });
  }

  const consumptionReasons = consumeWorkspaceWriteProviderExecutionPermitV2ForPlan(
    permit,
    input.plan,
    input.manifest,
    input.consumptionStore,
    {
      now: generatedAt,
      consumedAt: generatedAt,
      reasonPrefix: "workspace_write_execution_permit_v2"
    }
  );
  if (consumptionReasons.length > 0) {
    return createEvidence({
      generatedAt,
      status: "blocked",
      executeRequested: true,
      executionAuthorizationMatched,
      permitValidForPlan: true,
      permitConsumed: false,
      branch,
      beforeCommit: headCommit,
      afterCommit: headCommit,
      permit,
      operationTargets,
      operations: normalizedOperations,
      branchMatched,
      branchNonProtected,
      headCommitMatched,
      worktreeCleanBefore,
      operationTargetsDeclared,
      operationTargetsUnique,
      operationTargetsSafe,
      preExecutionPatchGuardPassed: expectedGuard?.ok ?? false,
      rollbackReady: rollbackEvidence?.status === "ready",
      wroteOnlyPermittedTargets: false,
      postExecutionPatchGuardPassed: false,
      rollbackAttempted: false,
      rollbackVerified: false,
      expectedGuard,
      actualGuard: undefined,
      contentHashes: [],
      counters: {
        workspaceWriteExecuteCalls: 0,
        fileWriteCalls: 0,
        fileDeleteCalls: 0
      },
      reasons: consumptionReasons
    });
  }

  const contentHashesBefore = await readContentHashes(input.cwd, headCommit, operationTargets);
  let fileWriteCalls = 0;
  let fileDeleteCalls = 0;
  const executionReasons: string[] = [];
  let actualGuard: WorkspaceWritePatchGuardResult | undefined;
  let rollbackAttempted = false;
  let rollbackVerified = false;
  const createdParentDirectories = new Set<string>();

  try {
    for (const operation of normalizedOperations) {
      const operationPathReasons = await collectWorkspaceTargetPathReasons(input.cwd, [operation.path]);
      if (operationPathReasons.length > 0) {
        executionReasons.push(...operationPathReasons);
        break;
      }
      const absolutePath = join(input.cwd, operation.path);
      if (operation.kind === "write") {
        for (const path of collectMissingWorkspaceParentDirectories(input.cwd, operation.path)) {
          createdParentDirectories.add(path);
        }
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, operation.content, "utf8");
        fileWriteCalls += 1;
      } else {
        await rm(absolutePath, { force: true });
        fileDeleteCalls += 1;
      }
    }

    const actualDiff = await createDiffFromCommitToWorkspace({
      cwd: input.cwd,
      beforeCommit: headCommit,
      targetFiles: operationTargets
    });
    actualGuard = evaluateWorkspaceWritePatchGuard({
      permit,
      unifiedDiff: actualDiff
    });
    if (!actualGuard.ok) {
      executionReasons.push(
        "workspace_write_execution_post_execution_patch_guard_failed",
        ...actualGuard.reasons
      );
    }
  } catch {
    executionReasons.push("workspace_write_execution_apply_operations_failed");
  } finally {
    rollbackAttempted = true;
    try {
      await rollbackWorkspaceTargets(input.cwd, headCommit, operationTargets);
      await removeWorkspaceCreatedParentDirectories(input.cwd, createdParentDirectories);
      rollbackVerified = (await targetsClean(input.cwd, operationTargets))
        && workspaceCreatedParentDirectoriesAbsent(input.cwd, createdParentDirectories);
    } catch {
      executionReasons.push("workspace_write_execution_rollback_failed");
    }
  }

  if (!rollbackVerified) {
    executionReasons.push("workspace_write_execution_rollback_not_verified");
  }

  const afterCommit = (await git(["rev-parse", "HEAD"], input.cwd)).trim();
  const contentHashesAfter = await readContentHashes(input.cwd, headCommit, operationTargets);
  const contentHashes = contentHashesBefore.map((before) => {
    const after = contentHashesAfter.find((candidate) => candidate.path === before.path);
    return {
      ...before,
      afterHash: after?.afterHash ?? null
    };
  });
  const wroteOnlyPermittedTargets = actualGuard !== undefined
    && actualGuard.summary.changedFiles.every((file) => targetFiles.includes(file.path));

  return createEvidence({
    generatedAt,
    status: executionReasons.length === 0 ? "passed" : "failed",
    executeRequested: true,
    executionAuthorizationMatched,
    permitValidForPlan: true,
    permitConsumed: true,
    branch,
    beforeCommit: headCommit,
    afterCommit,
    permit,
    operationTargets,
    operations: normalizedOperations,
    branchMatched,
    branchNonProtected,
    headCommitMatched,
    worktreeCleanBefore,
    operationTargetsDeclared,
    operationTargetsUnique,
    operationTargetsSafe,
    preExecutionPatchGuardPassed: expectedGuard?.ok ?? false,
    rollbackReady: rollbackEvidence?.status === "ready",
    wroteOnlyPermittedTargets,
    postExecutionPatchGuardPassed: actualGuard?.ok ?? false,
    rollbackAttempted,
    rollbackVerified,
    expectedGuard,
    actualGuard,
    contentHashes,
    counters: {
      workspaceWriteExecuteCalls: 1,
      fileWriteCalls,
      fileDeleteCalls
    },
    reasons: uniqueStrings(executionReasons)
  });
}

function createEvidence(input: {
  generatedAt: string;
  status: WorkspaceWriteExecutionStatus;
  executeRequested: boolean;
  executionAuthorizationMatched: boolean;
  permitValidForPlan: boolean;
  permitConsumed: boolean;
  branch: string;
  beforeCommit: string;
  afterCommit: string;
  permit: WorkspaceWriteProviderExecutionPermitV2;
  operationTargets: string[];
  operations: WorkspaceWriteOperation[];
  branchMatched: boolean;
  branchNonProtected: boolean;
  headCommitMatched: boolean;
  worktreeCleanBefore: boolean;
  operationTargetsDeclared: boolean;
  operationTargetsUnique: boolean;
  operationTargetsSafe: boolean;
  preExecutionPatchGuardPassed: boolean;
  rollbackReady: boolean;
  wroteOnlyPermittedTargets: boolean;
  postExecutionPatchGuardPassed: boolean;
  rollbackAttempted: boolean;
  rollbackVerified: boolean;
  expectedGuard: WorkspaceWritePatchGuardResult | undefined;
  actualGuard: WorkspaceWritePatchGuardResult | undefined;
  contentHashes: Array<{
    path: string;
    beforeHash: string | null;
    afterHash: string | null;
  }>;
  counters: {
    workspaceWriteExecuteCalls: 0 | 1;
    fileWriteCalls: number;
    fileDeleteCalls: number;
  };
  reasons: string[];
}): WorkspaceWriteExecutionEvidence {
  const evidence: WorkspaceWriteExecutionEvidence = {
    schemaVersion: "workspace-write-execution-evidence.v1",
    generatedAt: input.generatedAt,
    mode: "workspace-write",
    status: input.status,
    taskId: input.permit.taskId,
    checks: {
      executeRequested: input.executeRequested,
      executionAuthorizationMatched: input.executionAuthorizationMatched,
      permitValidForPlan: input.permitValidForPlan,
      permitConsumed: input.permitConsumed,
      branchMatched: input.branchMatched,
      branchNonProtected: input.branchNonProtected,
      headCommitMatched: input.headCommitMatched,
      worktreeCleanBefore: input.worktreeCleanBefore,
      operationTargetsDeclared: input.operationTargetsDeclared,
      operationTargetsUnique: input.operationTargetsUnique,
      operationTargetsSafe: input.operationTargetsSafe,
      preExecutionPatchGuardPassed: input.preExecutionPatchGuardPassed,
      rollbackReady: input.rollbackReady,
      wroteOnlyPermittedTargets: input.wroteOnlyPermittedTargets,
      postExecutionPatchGuardPassed: input.postExecutionPatchGuardPassed,
      rollbackAttempted: input.rollbackAttempted,
      rollbackVerified: input.rollbackVerified,
      noProviderExecute: true,
      noRealCodexCli: true,
      noRemoteWrite: true,
      evidenceSanitized: true
    },
    summary: {
      branch: input.branch,
      beforeCommit: input.beforeCommit,
      afterCommit: input.afterCommit,
      permitId: input.permit.permitId,
      planId: input.permit.planId,
      providerId: input.permit.providerId,
      targetFiles: [...input.permit.targetFiles],
      operationCount: input.operations.length,
      writeOperationCount: input.operations.filter((operation) => operation.kind === "write").length,
      deleteOperationCount: input.operations.filter((operation) => operation.kind === "delete").length,
      ...(input.expectedGuard !== undefined
        ? { expectedPatchHash: input.expectedGuard.summary.patchHash }
        : {}),
      ...(input.actualGuard !== undefined
        ? { actualPatchHash: input.actualGuard.summary.patchHash }
        : {}),
      changedFileCount: input.actualGuard?.summary.changedFileCount
        ?? input.expectedGuard?.summary.changedFileCount
        ?? 0,
      diffLineCount: input.actualGuard?.summary.diffLineCount
        ?? input.expectedGuard?.summary.diffLineCount
        ?? 0,
      rollbackAffectedFiles: [...input.operationTargets],
      contentHashes: input.contentHashes
    },
    counters: {
      providerExecuteCalls: 0,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: input.counters.workspaceWriteExecuteCalls,
      fileWriteCalls: input.counters.fileWriteCalls,
      fileDeleteCalls: input.counters.fileDeleteCalls,
      remoteWrites: 0
    },
    reasons: uniqueStrings(input.reasons)
  };
  evidence.checks.evidenceSanitized = evidenceIsSanitized(evidence);
  return evidence;
}

async function createWorkspaceWriteSyntheticDiff(input: {
  cwd: string;
  beforeCommit: string;
  operations: WorkspaceWriteOperation[];
}): Promise<string> {
  const targetFiles = input.operations.map((operation) => operation.path);
  const beforeContents = await readCommitContents(input.cwd, input.beforeCommit, targetFiles);
  const afterContents = new Map<string, string | null>(
    targetFiles.map((path) => [path, beforeContents.get(path) ?? null])
  );

  for (const operation of input.operations) {
    afterContents.set(operation.path, operation.kind === "write" ? operation.content : null);
  }

  return createUnifiedDiffFromContents(targetFiles, beforeContents, afterContents);
}

async function createDiffFromCommitToWorkspace(input: {
  cwd: string;
  beforeCommit: string;
  targetFiles: string[];
}): Promise<string> {
  const beforeContents = await readCommitContents(input.cwd, input.beforeCommit, input.targetFiles);
  const afterContents = new Map<string, string | null>();

  for (const path of input.targetFiles) {
    const absolutePath = join(input.cwd, path);
    afterContents.set(path, existsSync(absolutePath) ? await readFile(absolutePath, "utf8") : null);
  }

  return createUnifiedDiffFromContents(input.targetFiles, beforeContents, afterContents);
}

function createUnifiedDiffFromContents(
  targetFiles: string[],
  beforeContents: Map<string, string | null>,
  afterContents: Map<string, string | null>
): string {
  const chunks: string[] = [];

  for (const path of targetFiles) {
    const before = beforeContents.get(path) ?? null;
    const after = afterContents.get(path) ?? null;
    if (before === after) {
      continue;
    }

    chunks.push(`diff --git a/${path} b/${path}`);
    if (before === null) {
      chunks.push("new file mode 100644");
      chunks.push("--- /dev/null");
    } else {
      chunks.push(`--- a/${path}`);
    }
    if (after === null) {
      chunks.push("deleted file mode 100644");
      chunks.push("+++ /dev/null");
    } else {
      chunks.push(`+++ b/${path}`);
    }
    chunks.push("@@");
    if (before !== null) {
      for (const line of splitPatchLines(before)) {
        chunks.push(`-${line}`);
      }
    }
    if (after !== null) {
      for (const line of splitPatchLines(after)) {
        chunks.push(`+${line}`);
      }
    }
  }

  return chunks.join("\n");
}

function splitPatchLines(value: string): string[] {
  if (value.length === 0) {
    return [""];
  }
  return value.endsWith("\n")
    ? value.slice(0, -1).split("\n")
    : value.split("\n");
}

async function rollbackWorkspaceTargets(
  cwd: string,
  beforeCommit: string,
  targetFiles: string[]
): Promise<void> {
  for (const path of targetFiles) {
    if (await commitPathExists(cwd, beforeCommit, path)) {
      await mkdir(dirname(join(cwd, path)), { recursive: true });
      await git(["restore", "--source", beforeCommit, "--", path], cwd);
    } else {
      await rm(join(cwd, path), { force: true });
    }
  }
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

async function targetsClean(cwd: string, targetFiles: string[]): Promise<boolean> {
  const status = await git(["status", "--short", "--", ...targetFiles], cwd);
  return status.trim() === "";
}

async function collectWorkspaceExistingCommitAbsentTargetReasons(
  cwd: string,
  beforeCommit: string,
  targetFiles: string[]
): Promise<string[]> {
  const reasons: string[] = [];
  for (const path of targetFiles) {
    if (
      existsSync(join(cwd, path))
      && !(await commitPathExists(cwd, beforeCommit, path))
    ) {
      reasons.push(`workspace_write_execution_existing_commit_absent_target_forbidden:${path}`);
    }
  }
  return reasons;
}

async function probeWorkspaceGitState(cwd: string): Promise<
  | {
      status: "ready";
      branch: string;
      headCommit: string;
      statusBefore: string;
    }
  | {
      status: "blocked";
    }
> {
  try {
    const branch = (await git(["branch", "--show-current"], cwd)).trim();
    const headCommit = (await git(["rev-parse", "HEAD"], cwd)).trim();
    const statusBefore = await git(["status", "--short"], cwd);
    return {
      status: "ready",
      branch,
      headCommit,
      statusBefore
    };
  } catch {
    return { status: "blocked" };
  }
}

async function readCommitContents(
  cwd: string,
  commit: string,
  targetFiles: string[]
): Promise<Map<string, string | null>> {
  const contents = new Map<string, string | null>();
  for (const path of targetFiles) {
    try {
      const { stdout } = await execFileAsync("git", ["show", `${commit}:${path}`], {
        cwd,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20
      });
      contents.set(path, stdout);
    } catch {
      contents.set(path, null);
    }
  }
  return contents;
}

async function commitPathExists(
  cwd: string,
  commit: string,
  path: string
): Promise<boolean> {
  try {
    await execFileAsync("git", ["cat-file", "-e", `${commit}:${path}`], {
      cwd,
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
}

async function readContentHashes(
  cwd: string,
  beforeCommit: string,
  targetFiles: string[]
): Promise<Array<{ path: string; beforeHash: string | null; afterHash: string | null }>> {
  const beforeContents = await readCommitContents(cwd, beforeCommit, targetFiles);
  const hashes: Array<{ path: string; beforeHash: string | null; afterHash: string | null }> = [];

  for (const path of targetFiles) {
    const before = beforeContents.get(path) ?? null;
    const absolutePath = join(cwd, path);
    const after = existsSync(absolutePath) ? await readFile(absolutePath, "utf8") : null;
    hashes.push({
      path,
      beforeHash: before === null ? null : sha256(before),
      afterHash: after === null ? null : sha256(after)
    });
  }

  return hashes;
}

function normalizeOperations(operations: WorkspaceWriteOperation[]): WorkspaceWriteOperation[] {
  return operations.map((operation) => ({
    ...operation,
    path: normalizeWorkspacePath(operation.path)
  }));
}

function normalizeWorkspacePath(path: string): string {
  return normalize(path).replace(/\\/g, "/");
}

function isSafeWorkspaceRelativePath(path: string): boolean {
  return path.length > 0
    && !isAbsolute(path)
    && !path.startsWith("../")
    && path !== ".."
    && !hasGitMetadataPathComponent(path)
    && !path.includes("/../")
    && !path.includes("\0")
    && !path.includes("\n")
    && !path.includes("\r");
}

function hasGitMetadataPathComponent(path: string): boolean {
  return normalizeWorkspacePath(path)
    .split("/")
    .some((part) => part === ".git");
}

function collectWorkspaceWritableRootReasons(
  writableRoots: string[],
  targetPaths: string[]
): string[] {
  if (targetPaths.length === 0) {
    return [];
  }

  return targetPaths
    .filter((targetPath) => (
      !writableRoots.some((writableRoot) =>
        writableRootAllowsTarget(writableRoot, targetPath)
      )
    ))
    .map((targetPath) =>
      `workspace_write_execution_target_outside_writable_roots:${targetPath}`
    );
}

function writableRootAllowsTarget(
  writableRoot: string,
  targetPath: string
): boolean {
  const normalizedRoot = normalizeWorkspaceWritableRoot(writableRoot);
  const normalizedTarget = normalizeWorkspacePath(targetPath);

  if (
    !isSafeWorkspaceRelativePath(normalizedRoot) ||
    !isSafeWorkspaceRelativePath(normalizedTarget)
  ) {
    return false;
  }

  if (normalizedRoot === "*") {
    return true;
  }

  if (normalizedRoot.endsWith("/**")) {
    const rootPrefix = normalizedRoot.slice(0, -3);
    return normalizedTarget === rootPrefix || normalizedTarget.startsWith(`${rootPrefix}/`);
  }

  const rootPrefix = normalizedRoot.endsWith("/")
    ? normalizedRoot.slice(0, -1)
    : normalizedRoot;
  return normalizedTarget === rootPrefix || normalizedTarget.startsWith(`${rootPrefix}/`);
}

function normalizeWorkspaceWritableRoot(writableRoot: string): string {
  const normalizedRoot = normalizeWorkspacePath(writableRoot);
  if (normalizedRoot === "workspace" || normalizedRoot === "workspace/**") {
    return "*";
  }

  return normalizedRoot.startsWith("workspace/")
    ? normalizedRoot.slice("workspace/".length)
    : normalizedRoot;
}

async function collectWorkspaceTargetPathReasons(
  cwd: string,
  targetPaths: string[]
): Promise<string[]> {
  const workspaceRoot = await realpath(cwd);
  const reasons: string[] = [];

  for (const targetPath of targetPaths) {
    if (!isSafeWorkspaceRelativePath(targetPath)) {
      reasons.push("workspace_write_execution_unsafe_operation_target");
      continue;
    }

    const parts = normalize(targetPath).split("/").filter((part) => part.length > 0);
    let currentPath = cwd;

    for (const part of parts) {
      currentPath = join(currentPath, part);
      try {
        const stats = await lstat(currentPath);
        if (stats.isSymbolicLink()) {
          reasons.push(`workspace_write_execution_symlink_target_forbidden:${targetPath}`);
          break;
        }

        const resolvedPath = await realpath(currentPath);
        if (!isWorkspaceContainedPath(workspaceRoot, resolvedPath)) {
          reasons.push(`workspace_write_execution_target_outside_workspace:${targetPath}`);
          break;
        }
      } catch (error) {
        if (isNodeErrorCode(error, "ENOENT")) {
          break;
        }
        reasons.push(`workspace_write_execution_target_path_check_failed:${targetPath}`);
        break;
      }
    }
  }

  return uniqueStrings(reasons);
}

function isWorkspaceContainedPath(workspaceRoot: string, resolvedPath: string): boolean {
  const pathRelativeToWorkspace = relative(workspaceRoot, resolvedPath);
  return pathRelativeToWorkspace === ""
    || (!pathRelativeToWorkspace.startsWith("..") && !isAbsolute(pathRelativeToWorkspace));
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === code;
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

function evidenceIsSanitized(evidence: unknown): boolean {
  const serialized = JSON.stringify(evidence);
  return [
    "OPENAI_API_KEY",
    "sk-",
    "Bearer",
    "raw patch",
    "raw env",
    "stdout",
    "stderr"
  ].every((marker) => !serialized.includes(marker));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
