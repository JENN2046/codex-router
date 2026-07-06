import { createHash } from "node:crypto";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapter,
  GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResult,
  GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation
} from "../../packages/governance-internal-recovery-control/src/index.js";

export interface Phase15SandboxReferenceAgentExecutorAdapterOptions {
  sandboxRoot: string;
  now?: () => string;
}

export class Phase15SandboxReferenceAgentExecutorAdapterError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "Phase15SandboxReferenceAgentExecutorAdapterError";
    this.code = code;
  }
}

export class Phase15SandboxReferenceAgentExecutorAdapter
  implements GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapter {
  private readonly sandboxRoot: string;
  private readonly now: () => string;

  constructor(options: Phase15SandboxReferenceAgentExecutorAdapterOptions) {
    this.sandboxRoot = options.sandboxRoot;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async runSandboxContract(
    invocation: GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation
  ): Promise<GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResult> {
    const root = await prepareSandboxRoot(this.sandboxRoot);
    const runId = createPhase15SandboxAdapterContractRunId(invocation);
    const runDir = resolve(root, runId);
    assertInsideSandbox(root, runDir);
    await assertSandboxRunDirUnused(runDir);
    await mkdir(runDir, { recursive: false });

    const contractRecord = createContractRecord(invocation, runId, this.now());
    await writeSandboxJson(root, runDir, "contract.json", contractRecord);

    const statusRecord = {
      schemaVersion: "phase15-sandbox-reference-agent-executor-adapter-status.v1",
      runId,
      adapterKind: "sandbox_reference_adapter",
      status: "completed",
      completionMeaning: "sandbox_contract_witness_completed",
      recommendedAction: invocation.recommendedAction,
      reasonCode: `phase15_sandbox_${invocation.recommendedAction}_completed`,
      completedAt: this.now(),
      contractRecordHash: stableSha256(contractRecord)
    };

    if (invocation.recommendedAction === "fork") {
      const lineageDir = resolve(runDir, "lineage");
      assertInsideSandbox(root, lineageDir);
      await mkdir(lineageDir, { recursive: false });
      await writeSandboxJson(root, lineageDir, "lineage.json", {
        schemaVersion: "phase15-sandbox-reference-agent-executor-adapter-lineage.v1",
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
    const resultRef = `artifact:phase15-sandbox-adapter:${resultHash}`;

    return {
      schemaVersion:
        "governance-operator-action-agent-executor-adapter-sandbox-contract-adapter-result.v1",
      status: "completed",
      resultRef,
      evidenceRefs: [resultRef]
    };
  }
}

export function createPhase15SandboxAdapterContractRunId(
  invocation: Pick<
    GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation,
    | "contractMode"
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
    | "adapterId"
    | "adapterKind"
    | "adapterDescriptorHash"
    | "sandboxScopeRef"
    | "sideEffectBoundary"
  >
): string {
  return stableSha256({
    contractMode: invocation.contractMode,
    taskId: invocation.taskId,
    actionRef: invocation.actionRef,
    receiptId: invocation.receiptId,
    envelopeHash: invocation.envelopeHash,
    recommendedAction: invocation.recommendedAction,
    executionPlanHash: invocation.executionPlanHash,
    checkpointRef: invocation.checkpointRef ?? null,
    hostExecutorDescriptorId: invocation.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: invocation.authorizationIdentityHash,
    adapterId: invocation.adapterId,
    adapterKind: invocation.adapterKind,
    adapterDescriptorHash: invocation.adapterDescriptorHash,
    sandboxScopeRef: invocation.sandboxScopeRef,
    sideEffectBoundary: invocation.sideEffectBoundary
  });
}

async function prepareSandboxRoot(sandboxRoot: string): Promise<string> {
  const root = resolve(sandboxRoot);
  await mkdir(root, { recursive: true });
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Phase15SandboxReferenceAgentExecutorAdapterError(
      "phase15_sandbox_root_not_directory"
    );
  }
  return realpath(root);
}

async function assertSandboxRunDirUnused(runDir: string): Promise<void> {
  try {
    const runDirStat = await lstat(runDir);
    if (runDirStat.isSymbolicLink()) {
      throw new Phase15SandboxReferenceAgentExecutorAdapterError(
        "phase15_sandbox_symlink_escape"
      );
    }
    throw new Phase15SandboxReferenceAgentExecutorAdapterError(
      "phase15_sandbox_run_path_exists"
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
    throw new Phase15SandboxReferenceAgentExecutorAdapterError(
      "phase15_sandbox_file_name_unsafe"
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

function createContractRecord(
  invocation: GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation,
  runId: string,
  createdAt: string
) {
  return {
    schemaVersion: "phase15-sandbox-reference-agent-executor-adapter-contract.v1",
    runId,
    adapterKind: "sandbox_reference_adapter",
    status: "accepted",
    contractMode: invocation.contractMode,
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
    adapterIdHash: stableSha256(invocation.adapterId),
    adapterDescriptorHash: invocation.adapterDescriptorHash,
    sandboxScopeRefHash: stableSha256(invocation.sandboxScopeRef),
    sideEffectBoundary: invocation.sideEffectBoundary,
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
    throw new Phase15SandboxReferenceAgentExecutorAdapterError(
      "phase15_sandbox_path_escape"
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
