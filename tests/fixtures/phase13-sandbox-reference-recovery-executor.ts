import { createHash } from "node:crypto";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  GovernanceOperatorActionHostExecutorDispatchExecutor,
  GovernanceOperatorActionHostExecutorDispatchExecutorResult,
  GovernanceOperatorActionHostExecutorDispatchInvocation
} from "../../packages/recovery-control/src/index.js";

export interface Phase13SandboxReferenceRecoveryExecutorOptions {
  sandboxRoot: string;
  now?: () => string;
}

export class Phase13SandboxReferenceRecoveryExecutorError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "Phase13SandboxReferenceRecoveryExecutorError";
    this.code = code;
  }
}

export class Phase13SandboxReferenceRecoveryExecutor
  implements GovernanceOperatorActionHostExecutorDispatchExecutor {
  private readonly sandboxRoot: string;
  private readonly now: () => string;

  constructor(options: Phase13SandboxReferenceRecoveryExecutorOptions) {
    this.sandboxRoot = options.sandboxRoot;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async dispatch(
    invocation: GovernanceOperatorActionHostExecutorDispatchInvocation
  ): Promise<GovernanceOperatorActionHostExecutorDispatchExecutorResult> {
    const root = await prepareSandboxRoot(this.sandboxRoot);
    const runId = createPhase13SandboxReferenceRunId(invocation);
    const runDir = resolve(root, runId);
    assertInsideSandbox(root, runDir);
    await assertSandboxRunDirUnused(runDir);
    await mkdir(runDir, { recursive: false });

    const actionRecord = createActionRecord(invocation, runId, this.now());
    await writeSandboxJson(root, runDir, "action.json", actionRecord);

    const statusRecord = {
      schemaVersion: "phase13-sandbox-reference-recovery-status.v1",
      runId,
      executorKind: "sandbox_reference",
      status: "completed",
      completionMeaning: "dispatch_transaction_completed",
      recommendedAction: invocation.recommendedAction,
      reasonCode: `phase13_sandbox_${invocation.recommendedAction}_completed`,
      completedAt: this.now(),
      actionRecordHash: stableSha256(actionRecord)
    };

    if (invocation.recommendedAction === "fork") {
      const lineageDir = resolve(runDir, "lineage");
      assertInsideSandbox(root, lineageDir);
      await mkdir(lineageDir, { recursive: false });
      await writeSandboxJson(root, lineageDir, "lineage.json", {
        schemaVersion: "phase13-sandbox-reference-lineage.v1",
        runId,
        parentActionRefHash: stableSha256(invocation.actionRef),
        createdAt: this.now()
      });
    }

    await writeSandboxJson(
      root,
      runDir,
      `${invocation.recommendedAction}.completed.json`,
      statusRecord
    );
    await writeSandboxJson(root, runDir, "status.json", statusRecord);

    const resultHash = stableSha256(statusRecord);
    const resultRef = `artifact:phase13-sandbox-reference:${resultHash}`;

    return {
      schemaVersion: "governance-operator-action-host-executor-dispatch-executor-result.v1",
      status: "completed",
      resultRef,
      evidenceRefs: [resultRef]
    };
  }
}

export function createPhase13SandboxReferenceRunId(
  invocation: Pick<
    GovernanceOperatorActionHostExecutorDispatchInvocation,
    | "dispatchMode"
    | "taskId"
    | "actionRef"
    | "receiptId"
    | "envelopeHash"
    | "recommendedAction"
    | "executionPlanHash"
    | "checkpointRef"
    | "hostExecutorDescriptorId"
    | "hostExecutorDescriptorHash"
    | "authorizationIdentityHash"
  >
): string {
  return stableSha256({
    dispatchMode: invocation.dispatchMode,
    taskId: invocation.taskId,
    actionRef: invocation.actionRef,
    receiptId: invocation.receiptId,
    envelopeHash: invocation.envelopeHash,
    recommendedAction: invocation.recommendedAction,
    executionPlanHash: invocation.executionPlanHash,
    checkpointRef: invocation.checkpointRef ?? null,
    hostExecutorDescriptorId: invocation.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: invocation.authorizationIdentityHash
  });
}

async function prepareSandboxRoot(sandboxRoot: string): Promise<string> {
  const root = resolve(sandboxRoot);
  await mkdir(root, { recursive: true });
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Phase13SandboxReferenceRecoveryExecutorError(
      "phase13_sandbox_root_not_directory"
    );
  }
  return realpath(root);
}

async function assertSandboxRunDirUnused(runDir: string): Promise<void> {
  try {
    const runDirStat = await lstat(runDir);
    if (runDirStat.isSymbolicLink()) {
      throw new Phase13SandboxReferenceRecoveryExecutorError(
        "phase13_sandbox_symlink_escape"
      );
    }
    throw new Phase13SandboxReferenceRecoveryExecutorError(
      "phase13_sandbox_run_path_exists"
    );
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function writeSandboxJson(
  root: string,
  parentDir: string,
  fileName: string,
  value: unknown
): Promise<void> {
  if (!/^[A-Za-z0-9_.-]+$/.test(fileName) || fileName.includes("..")) {
    throw new Phase13SandboxReferenceRecoveryExecutorError(
      "phase13_sandbox_file_name_unsafe"
    );
  }

  const resolvedParent = await realpath(parentDir);
  assertInsideSandbox(root, resolvedParent);

  const target = resolve(resolvedParent, fileName);
  assertInsideSandbox(root, target);

  const handle = await open(target, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

function createActionRecord(
  invocation: GovernanceOperatorActionHostExecutorDispatchInvocation,
  runId: string,
  createdAt: string
) {
  return {
    schemaVersion: "phase13-sandbox-reference-recovery-action.v1",
    runId,
    executorKind: "sandbox_reference",
    status: "accepted",
    dispatchMode: invocation.dispatchMode,
    recommendedAction: invocation.recommendedAction,
    createdAt,
    taskIdHash: stableSha256(invocation.taskId),
    actionRefHash: stableSha256(invocation.actionRef),
    receiptIdHash: stableSha256(invocation.receiptId),
    envelopeHash: invocation.envelopeHash,
    executionPlanHash: invocation.executionPlanHash,
    ...(invocation.checkpointRef !== undefined
      ? { checkpointRefHash: stableSha256(invocation.checkpointRef) }
      : {}),
    hostExecutorDescriptorIdHash: stableSha256(invocation.hostExecutorDescriptorId),
    hostExecutorDescriptorHash: invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: invocation.authorizationIdentityHash,
    evidenceRefHashes: invocation.evidenceRefs.map(stableSha256)
  };
}

function assertInsideSandbox(root: string, target: string): void {
  const relativePath = relative(root, target);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Phase13SandboxReferenceRecoveryExecutorError(
      "phase13_sandbox_path_escape"
    );
  }
}

function stableSha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableStringify(record[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
