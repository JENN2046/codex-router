import { createHash } from "node:crypto";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAdapter,
  GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAdapterResult,
  GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunInvocation
} from "../../packages/governance-internal-recovery-control/src/index.js";

export interface Phase18SandboxTaskControlAdapterOptions {
  sandboxRoot: string;
  now?: () => string;
}

export class Phase18SandboxTaskControlAdapterError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "Phase18SandboxTaskControlAdapterError";
    this.code = code;
  }
}

export class Phase18SandboxTaskControlAdapter
  implements GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAdapter {
  private readonly sandboxRoot: string;
  private readonly now: () => string;

  constructor(options: Phase18SandboxTaskControlAdapterOptions) {
    this.sandboxRoot = options.sandboxRoot;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async runTaskControlSandboxDryRun(
    invocation: GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunInvocation
  ): Promise<GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAdapterResult> {
    const root = await prepareSandboxRoot(this.sandboxRoot);
    const runId = createPhase18TaskControlSandboxRunId(invocation);
    const runDir = resolve(root, runId);
    assertInsideSandbox(root, runDir);
    await assertSandboxRunDirUnused(runDir);
    await mkdir(runDir, { recursive: false });

    const requestRecord = createRequestRecord(invocation, runId, this.now());
    await writeSandboxJson(root, runDir, "task-control-request.json", requestRecord);

    const receiptRecord = {
      schemaVersion: "phase18-sandbox-task-control-receipt.v1",
      runId,
      adapterKind: "sandbox_task_control_adapter",
      status: "completed",
      completionMeaning: "task_control_sandbox_contract_witness_completed",
      recommendedAction: invocation.recommendedAction,
      permittedTaskControlOperationRef: invocation.permittedTaskControlOperationRef,
      reasonCode: `phase18_task_control_${invocation.recommendedAction}_completed`,
      completedAt: this.now(),
      requestRecordHash: stableSha256(requestRecord)
    };
    await writeSandboxJson(root, runDir, "task-control-receipt.json", receiptRecord);

    const evidenceRecord = {
      schemaVersion: "phase18-sandbox-task-control-evidence.v1",
      runId,
      evidenceRefHashes: invocation.evidenceRefs.map(stableSha256),
      receiptRecordHash: stableSha256(receiptRecord),
      recordedAt: this.now()
    };
    await writeSandboxJson(root, runDir, "evidence.json", evidenceRecord);

    const resultHash = stableSha256(receiptRecord);
    const resultRef = `artifact:phase18-task-control-sandbox:${resultHash}`;

    return {
      schemaVersion:
        "governance-operator-action-agent-task-control-dispatch-sandbox-dry-run-adapter-result.v1",
      status: "completed",
      reasonCode: `phase18_task_control_${invocation.recommendedAction}_completed`,
      resultRef,
      evidenceRefs: [resultRef]
    };
  }
}

export function createPhase18TaskControlSandboxRunId(
  invocation: Pick<
    GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunInvocation,
    | "taskId"
    | "actionRef"
    | "receiptId"
    | "envelopeHash"
    | "recommendedAction"
    | "executionPlanHash"
    | "checkpointRefHash"
    | "adapterId"
    | "adapterKind"
    | "adapterDescriptorHash"
    | "contextPackageHash"
    | "permittedTaskControlOperationRef"
    | "sandboxScopeRef"
    | "sandboxRootBindingHash"
    | "idempotencyKeyHash"
  >
): string {
  return stableSha256({
    taskId: invocation.taskId,
    actionRef: invocation.actionRef,
    receiptId: invocation.receiptId,
    envelopeHash: invocation.envelopeHash,
    recommendedAction: invocation.recommendedAction,
    executionPlanHash: invocation.executionPlanHash,
    checkpointRefHash: invocation.checkpointRefHash ?? null,
    adapterId: invocation.adapterId,
    adapterKind: invocation.adapterKind,
    adapterDescriptorHash: invocation.adapterDescriptorHash,
    contextPackageHash: invocation.contextPackageHash,
    permittedTaskControlOperationRef: invocation.permittedTaskControlOperationRef,
    sandboxScopeRef: invocation.sandboxScopeRef,
    sandboxRootBindingHash: invocation.sandboxRootBindingHash,
    idempotencyKeyHash: invocation.idempotencyKeyHash
  });
}

async function prepareSandboxRoot(sandboxRoot: string): Promise<string> {
  const root = resolve(sandboxRoot);
  await mkdir(root, { recursive: true });
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Phase18SandboxTaskControlAdapterError(
      "phase18_task_control_sandbox_root_not_directory"
    );
  }
  return realpath(root);
}

async function assertSandboxRunDirUnused(runDir: string): Promise<void> {
  try {
    const runDirStat = await lstat(runDir);
    if (runDirStat.isSymbolicLink()) {
      throw new Phase18SandboxTaskControlAdapterError(
        "phase18_task_control_sandbox_symlink_escape"
      );
    }
    throw new Phase18SandboxTaskControlAdapterError(
      "phase18_task_control_sandbox_run_path_exists"
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
    throw new Phase18SandboxTaskControlAdapterError(
      "phase18_task_control_sandbox_file_name_unsafe"
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

function createRequestRecord(
  invocation: GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunInvocation,
  runId: string,
  createdAt: string
) {
  return {
    schemaVersion: "phase18-sandbox-task-control-request.v1",
    runId,
    adapterKind: "sandbox_task_control_adapter",
    status: "accepted",
    createdAt,
    recommendedAction: invocation.recommendedAction,
    taskIdHash: stableSha256(invocation.taskId),
    actionRefHash: stableSha256(invocation.actionRef),
    receiptIdHash: stableSha256(invocation.receiptId),
    envelopeHash: invocation.envelopeHash,
    executionPlanHash: invocation.executionPlanHash,
    ...(invocation.checkpointRefHash !== undefined
      ? { checkpointRefHash: invocation.checkpointRefHash }
      : {}),
    adapterIdHash: stableSha256(invocation.adapterId),
    adapterDescriptorHash: invocation.adapterDescriptorHash,
    requestedDispatchClass: invocation.requestedDispatchClass,
    requestedSideEffectClass: invocation.requestedSideEffectClass,
    authorizedTaskControlScopeRefHash:
      stableSha256(invocation.authorizedTaskControlScopeRef),
    hostAgentRuntimeRefHash: stableSha256(invocation.hostAgentRuntimeRef),
    hostAgentCapabilityRefHash: stableSha256(invocation.hostAgentCapabilityRef),
    contextPackageRefHash: stableSha256(invocation.contextPackageRef),
    contextPackageHash: invocation.contextPackageHash,
    permittedTaskControlOperationRef: invocation.permittedTaskControlOperationRef,
    promptContentPolicyRefHash: stableSha256(invocation.promptContentPolicyRef),
    workspaceBoundaryRefHash: stableSha256(invocation.workspaceBoundaryRef),
    sandboxScopeRefHash: stableSha256(invocation.sandboxScopeRef),
    sandboxRootBindingHash: invocation.sandboxRootBindingHash,
    ...(invocation.rollbackExpectationRef !== undefined
      ? { rollbackExpectationRefHash: stableSha256(invocation.rollbackExpectationRef) }
      : {}),
    abortExpectationRefHash: stableSha256(invocation.abortExpectationRef),
    timeoutPolicyRefHash: stableSha256(invocation.timeoutPolicyRef),
    idempotencyKeyHash: invocation.idempotencyKeyHash,
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
    throw new Phase18SandboxTaskControlAdapterError(
      "phase18_task_control_sandbox_path_escape"
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
