#!/usr/bin/env node

import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import {
  dispatchReadOnlyRunnerResultToProvider
} from "../packages/host-dispatcher/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";
import { CodexCliExecutorProvider } from "../packages/providers/codex-cli/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "read-only-control-chain-acceptance.json"
);
const DEFAULT_POLICY_PATH = join(__dirname, "..", "routing-policy.yaml");
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";

export interface ReadOnlyControlChainAcceptanceEvidence {
  schemaVersion: "read-only-control-chain-acceptance.v1";
  generatedAt: string;
  mode: "fake-readonly";
  taskId: string;
  commit?: string;
  checks: {
    runnerReady: boolean;
    preflightOk: boolean;
    approvalResolved: boolean;
    hostRouteCodexCli: boolean;
    toolAccessReadOnly: boolean;
    providerGrantPresent: boolean;
    permitIssued: boolean;
    dispatchOk: boolean;
    dryRunNoSpawn: boolean;
    workspaceWriteBlocked: boolean;
    providerGrantMissingBlocked: boolean;
    approvalPendingBlocked: boolean;
    preflightFailedBlocked: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    providerId: string;
    sideEffectClass: string;
    sandbox: string;
    eventCount: number;
    parseErrorCount: number;
    warningCount: number;
  };
  blockingReasons: string[];
}

export interface ReadOnlyControlChainAcceptanceOptions {
  generatedAt?: string;
  policyPath?: string;
  commit?: string;
}

export async function runReadOnlyControlChainAcceptance(
  options: ReadOnlyControlChainAcceptanceOptions = {}
): Promise<ReadOnlyControlChainAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const policy = await loadPolicyFromFile(options.policyPath ?? DEFAULT_POLICY_PATH);
  const task = createReadOnlyAcceptanceTask();
  const runnerResult = await runDesktopDecision({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    now: () => generatedAt
  });
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "{\"type\":\"agent_message\",\"message\":\"READONLY_CONTROL_CHAIN_ACCEPTANCE_OK\"}\n",
        exitCode: 0
      });
    }
  });
  const dispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    now: generatedAt
  });

  let dryRunSpawnCalls = 0;
  const dryRunProvider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn: () => {
      dryRunSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const dryRunDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider: dryRunProvider,
    now: generatedAt,
    dryRun: true
  });

  const workspaceWriteDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult: {
      ...runnerResult,
      decision: {
        ...runnerResult.decision,
        execution: {
          ...runnerResult.decision.execution,
          toolAccess: "local_write"
        },
        ...(runnerResult.decision.providerGrant === undefined
          ? {}
          : {
            providerGrant: {
              ...runnerResult.decision.providerGrant,
              sideEffectClass: "workspace_write",
              sandboxMode: "workspace-write",
              toolAccess: "local_write"
            }
          })
      }
    },
    provider,
    now: generatedAt
  });

  const decisionWithoutGrant = {
    ...runnerResult.decision
  };
  delete (decisionWithoutGrant as { providerGrant?: unknown }).providerGrant;
  const providerGrantMissingDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult: {
      ...runnerResult,
      decision: decisionWithoutGrant
    },
    provider,
    now: generatedAt
  });

  const approvalPendingDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult: {
      ...runnerResult,
      approval: {
        status: "pending",
        reasons: ["acceptance_negative_approval_pending"],
        gateId: "gate_readonly_control_chain_acceptance"
      }
    },
    provider,
    now: generatedAt
  });

  const preflightFailedDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult: {
      ...runnerResult,
      preflight: {
        ...runnerResult.preflight,
        ok: false,
        errors: ["acceptance_negative_preflight_failed"]
      }
    },
    provider,
    now: generatedAt
  });

  const evidenceWithoutLeakCheck: Omit<
    ReadOnlyControlChainAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<ReadOnlyControlChainAcceptanceEvidence["checks"], "leakCheckPassed">;
  } = {
    schemaVersion: "read-only-control-chain-acceptance.v1",
    generatedAt,
    mode: "fake-readonly",
    taskId: runnerResult.task.taskId,
    ...(options.commit !== undefined ? { commit: options.commit } : {}),
    checks: {
      runnerReady: runnerResult.status === "ready",
      preflightOk: runnerResult.preflight.ok,
      approvalResolved: runnerResult.approval.status === "not_required"
        || runnerResult.approval.status === "approved",
      hostRouteCodexCli: runnerResult.decision.hostRoute === "codex-cli",
      toolAccessReadOnly: runnerResult.decision.execution.toolAccess === "read_only",
      providerGrantPresent: runnerResult.decision.providerGrant !== undefined,
      permitIssued: dispatch.permit?.status === "approved",
      dispatchOk: dispatch.ok === true && spawnCalls === 1,
      dryRunNoSpawn: dryRunDispatch.ok === true && dryRunSpawnCalls === 0,
      workspaceWriteBlocked: workspaceWriteDispatch.ok === false
        && workspaceWriteDispatch.status === "blocked",
      providerGrantMissingBlocked: providerGrantMissingDispatch.ok === false
        && providerGrantMissingDispatch.blockingReasons?.includes(
          "runner_result_provider_grant_missing"
        ) === true,
      approvalPendingBlocked: approvalPendingDispatch.ok === false
        && approvalPendingDispatch.blockingReasons?.includes(
          "runner_result_approval_unresolved"
        ) === true,
      preflightFailedBlocked: preflightFailedDispatch.ok === false
        && preflightFailedDispatch.blockingReasons?.includes(
          "runner_result_preflight_failed"
        ) === true
    },
    summary: {
      providerId: dispatch.providerId ?? "codex-cli",
      sideEffectClass: dispatch.sideEffectClass ?? "read_only",
      sandbox: dispatch.sandbox ?? "read-only",
      eventCount: dispatch.eventCount ?? 0,
      parseErrorCount: dispatch.parseErrorCount ?? 0,
      warningCount: dispatch.warningCount ?? 0
    },
    blockingReasons: [
      ...(dispatch.blockingReasons ?? []),
      ...(dryRunDispatch.blockingReasons ?? []),
      ...(workspaceWriteDispatch.blockingReasons ?? []),
      ...(providerGrantMissingDispatch.blockingReasons ?? []),
      ...(approvalPendingDispatch.blockingReasons ?? []),
      ...(preflightFailedDispatch.blockingReasons ?? [])
    ]
  };

  const leakCheckPassed = !containsRawExecutionMarkers(evidenceWithoutLeakCheck);

  return {
    ...evidenceWithoutLeakCheck,
    checks: {
      ...evidenceWithoutLeakCheck.checks,
      leakCheckPassed
    }
  };
}

export async function writeReadOnlyControlChainAcceptanceEvidence(
  evidence: ReadOnlyControlChainAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{ path: string; evidence: ReadOnlyControlChainAcceptanceEvidence }> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function createReadOnlyAcceptanceTask() {
  return parseTaskEnvelope({
    taskId: "read-only-control-chain-acceptance",
    source: "desktop-thread",
    intent: {
      summary: "Read-only control chain acceptance",
      requestedAction: "Inspect the current routing control chain without edits",
      successCriteria: ["read-only provider fake dispatch completes"],
      outOfScope: ["workspace writes", "remote writes", "real Codex CLI execution"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["routing-policy.yaml"],
      modules: ["host-dispatcher", "providers/codex-cli"]
    },
    constraints: {
      requiresNetwork: false
    },
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: ["acceptance", "read-only-control-chain"]
    }
  });
}

function containsRawExecutionMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "prompt",
    "args",
    "stdout",
    "stderr",
    "raw command",
    "raw task envelope",
    "raw env",
    "raw token",
    "raw patch"
  ].some((marker) => serialized.includes(marker));
}

async function main(): Promise<void> {
  const outputIdx = process.argv.indexOf("--output");
  const outputPath = outputIdx >= 0
    ? process.argv[outputIdx + 1]!
    : DEFAULT_EVIDENCE_PATH;
  const evidence = await runReadOnlyControlChainAcceptance();
  const write = await writeReadOnlyControlChainAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Read-only control chain acceptance");
  console.log(`dispatch ok: ${evidence.checks.dispatchOk}`);
  console.log(`dry run no spawn: ${evidence.checks.dryRunNoSpawn}`);
  console.log(`workspace-write blocked: ${evidence.checks.workspaceWriteBlocked}`);
  console.log(`leak check: ${evidence.checks.leakCheckPassed}`);
  console.log(`evidence: ${write.path}`);

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

class FakeCodexCliStream extends EventEmitter {
  setEncoding(_encoding: BufferEncoding): void {}
  destroy(): void {}
}

class FakeCodexCliWritableStream {
  end(): void {}
  destroy(): void {}
}

class FakeCodexCliChild extends EventEmitter {
  readonly stdin = new FakeCodexCliWritableStream();
  readonly stdout = new FakeCodexCliStream();
  readonly stderr = new FakeCodexCliStream();

  constructor(
    private readonly closeCode: number,
    private readonly closeSignal: NodeJS.Signals | null
  ) {
    super();
  }

  kill(_signal?: NodeJS.Signals | number): boolean {
    queueMicrotask(() => {
      this.emit("close", this.closeCode, this.closeSignal);
    });
    return true;
  }

  unref(): void {}
}

function createFakeCodexCliChild(options: {
  stdout: string;
  stderr?: string;
  exitCode: number;
  signal?: NodeJS.Signals | null;
}): FakeCodexCliChild {
  const child = new FakeCodexCliChild(
    options.exitCode,
    options.signal ?? null
  );

  queueMicrotask(() => {
    if (options.stdout) {
      child.stdout.emit("data", options.stdout);
    }
    if (options.stderr) {
      child.stderr.emit("data", options.stderr);
    }
    child.emit("close", options.exitCode, options.signal ?? null);
  });

  return child;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Read-only control chain acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
