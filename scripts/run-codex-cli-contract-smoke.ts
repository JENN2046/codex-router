#!/usr/bin/env node

import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import {
  CODEX_CLI_MODEL_PROBE_OK,
  CODEX_CLI_READONLY_SMOKE_OK,
  CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
  DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL,
  clearCodexCliModelProbeCache,
  createCodexCliReadOnlySmokeEvidence,
  createCodexCliWorkspaceWriteSmokeEvidence,
  runCodexCliReadOnlySmoke,
  runCodexCliWorkspaceWriteSmoke,
  type CodexCliChildProcess,
  type CodexCliProcessSpawner
} from "../packages/codex-cli-host/src/index.js";

const evidencePath = process.env.CODEX_CLI_CONTRACT_SMOKE_EVIDENCE_PATH
  ?? "docs/evidence/codex-cli-contract-smoke-latest.json";
const model = process.env.CODEX_CLI_CONTRACT_SMOKE_MODEL
  ?? DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL;
const cwd = process.cwd();
const codexCommand = "codex-contract-smoke";
const generatedAt = new Date().toISOString();

interface ContractSpawnCall {
  kind: "model-probe" | "smoke-run";
  command: string;
  cwd?: string;
  approvalPolicy?: string;
  sandbox: string;
  usesJson: boolean;
  skipGitRepoCheck: boolean;
  ephemeral: boolean;
}

async function main(): Promise<void> {
  const spawnCalls: ContractSpawnCall[] = [];
  const spawn = createContractSpawner(spawnCalls);
  const telemetryStore = createRecordingTelemetrySink();

  clearCodexCliModelProbeCache();

  const commonPlanOptions = {
    model,
    codexCommand,
    cwd,
    skipGitRepoCheck: true,
    ephemeral: true
  };

  const readOnlyFirst = await runCodexCliReadOnlySmoke({
    telemetryStore,
    planOptions: commonPlanOptions,
    taskOptions: {
      taskId: "codex-cli-contract-smoke-readonly-first",
      repoRoot: cwd
    },
    spawn
  });

  const readOnlySecond = await runCodexCliReadOnlySmoke({
    telemetryStore,
    planOptions: commonPlanOptions,
    taskOptions: {
      taskId: "codex-cli-contract-smoke-readonly-second",
      repoRoot: cwd
    },
    spawn
  });

  const spawnCountBeforeBlockedRun = spawnCalls.length;
  const workspaceWriteBlocked = await runCodexCliWorkspaceWriteSmoke({
    telemetryStore,
    planOptions: commonPlanOptions,
    taskOptions: {
      taskId: "codex-cli-contract-smoke-workspace-write-blocked",
      repoRoot: cwd,
      file: "docs/evidence/codex-cli-contract-smoke-workspace-write.txt"
    },
    spawn
  });
  const blockedRunSpawned = spawnCalls.length !== spawnCountBeforeBlockedRun;

  const workspaceWriteReady = await runCodexCliWorkspaceWriteSmoke({
    telemetryStore,
    planOptions: commonPlanOptions,
    taskOptions: {
      taskId: "codex-cli-contract-smoke-workspace-write-ready",
      repoRoot: cwd,
      file: "docs/evidence/codex-cli-contract-smoke-workspace-write.txt"
    },
    allowWriteSandbox: true,
    confirmation: CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
    spawn
  });

  const telemetryEvents = await telemetryStore.loadAll();
  const telemetryMessages = telemetryEvents.map((event) => event.message);
  const readOnlyFirstEvidence = createCodexCliReadOnlySmokeEvidence(readOnlyFirst, {
    generatedAt,
    host: "Codex CLI contract smoke",
    notes: ["contract smoke uses a mock CodexCliProcessSpawner; real Codex CLI is not invoked"]
  });
  const readOnlySecondEvidence = createCodexCliReadOnlySmokeEvidence(readOnlySecond, {
    generatedAt,
    host: "Codex CLI contract smoke",
    notes: ["second read-only run verifies model probe cache hit telemetry"]
  });
  const workspaceWriteBlockedEvidence = createCodexCliWorkspaceWriteSmokeEvidence(
    workspaceWriteBlocked,
    {
      generatedAt,
      host: "Codex CLI contract smoke",
      notes: ["blocked workspace-write contract smoke must not spawn"]
    }
  );
  const workspaceWriteReadyEvidence = createCodexCliWorkspaceWriteSmokeEvidence(
    workspaceWriteReady,
    {
      generatedAt,
      host: "Codex CLI contract smoke",
      notes: ["ready workspace-write contract smoke uses a mock process, not a real file edit"]
    }
  );
  const serializedNestedEvidence = JSON.stringify([
    readOnlyFirstEvidence,
    readOnlySecondEvidence,
    workspaceWriteBlockedEvidence,
    workspaceWriteReadyEvidence
  ]);
  const nestedEvidenceOmitsRawPrompt = !serializedNestedEvidence.includes("Task envelope")
    && !serializedNestedEvidence.includes("requestedAction")
    && !serializedNestedEvidence.includes("successCriteria");

  const checks = {
    readOnlyFirstPassed: readOnlyFirst.status === "passed",
    readOnlySecondPassed: readOnlySecond.status === "passed",
    workspaceWriteBlockedBeforeSpawn: workspaceWriteBlocked.status === "blocked"
      && workspaceWriteBlocked.validationBlockers.includes(
        "codex_cli_write_sandbox_requires_explicit_allowance"
      )
      && workspaceWriteBlocked.validationBlockers.includes(
        "codex_cli_workspace_write_smoke_requires_confirmation"
      )
      && !blockedRunSpawned,
    workspaceWriteReadyPassed: workspaceWriteReady.status === "passed"
      && workspaceWriteReady.preflight.status === "ready"
      && workspaceWriteReady.plan.sandbox === "workspace-write",
    telemetryCacheMissAndHit: telemetryMessages.includes("codex cli model probe cache miss")
      && telemetryMessages.includes("codex cli model probe cache hit"),
    nestedEvidenceOmitsRawPrompt
  };
  const passed = Object.values(checks).every(Boolean);

  const evidence = {
    schemaVersion: "codex-cli-contract-smoke-evidence.v1",
    generatedAt,
    host: "Codex CLI contract smoke",
    model,
    summary: {
      passed,
      checks,
      realCodexCliInvoked: false,
      realHostSmoke: false,
      spawnCallCount: spawnCalls.length
    },
    contract: {
      boundary: "mock CodexCliProcessSpawner",
      ciSafe: true,
      covers: [
        "read-only smoke plan and execution contract",
        "workspace-write smoke preflight blocks before spawning when gates are missing",
        "workspace-write smoke can pass after explicit allowance and confirmation",
        "model probe telemetry emits cache miss and cache hit",
        "nested smoke evidence omits raw task prompt and full argv"
      ],
      doesNotCover: [
        "real Codex CLI binary availability",
        "logged-in Codex account state",
        "real model availability",
        "real workspace file edits",
        "external writes or production host behavior"
      ]
    },
    telemetry: telemetryEvents.map((event) => ({
      level: event.level,
      message: event.message,
      context: event.context ?? {}
    })),
    spawnCalls,
    runs: {
      readOnlyFirst: summarizeReadOnly(readOnlyFirst),
      readOnlySecond: summarizeReadOnly(readOnlySecond),
      workspaceWriteBlocked: summarizeWorkspaceWrite(workspaceWriteBlocked),
      workspaceWriteReady: summarizeWorkspaceWrite(workspaceWriteReady)
    },
    nestedEvidence: {
      readOnlyFirst: readOnlyFirstEvidence,
      readOnlySecond: readOnlySecondEvidence,
      workspaceWriteBlocked: workspaceWriteBlockedEvidence,
      workspaceWriteReady: workspaceWriteReadyEvidence
    }
  };

  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log("Codex CLI contract smoke");
  console.log(`model: ${model}`);
  console.log(`read-only first: ${readOnlyFirst.status}`);
  console.log(`read-only second: ${readOnlySecond.status}`);
  console.log(`workspace-write blocked: ${workspaceWriteBlocked.status}`);
  console.log(`workspace-write ready: ${workspaceWriteReady.status}`);
  console.log(`telemetry events: ${telemetryMessages.join(", ") || "(none)"}`);
  console.log(`evidence: ${evidencePath}`);

  if (!passed) {
    console.error("Codex CLI contract smoke failed");
    process.exitCode = 1;
  }
}

function createContractSpawner(calls: ContractSpawnCall[]): CodexCliProcessSpawner {
  return (command, args, options) => {
    const isModelProbe = args.some((arg) => arg.includes(CODEX_CLI_MODEL_PROBE_OK));
    const approvalPolicy = getArgValue(args, "-a");
    calls.push({
      kind: isModelProbe ? "model-probe" : "smoke-run",
      command,
      ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
      ...(approvalPolicy !== undefined ? { approvalPolicy } : {}),
      sandbox: getArgValue(args, "--sandbox") ?? "read-only",
      usesJson: args.includes("--json"),
      skipGitRepoCheck: args.includes("--skip-git-repo-check"),
      ephemeral: args.includes("--ephemeral")
    });

    return createFakeCodexCliChild({
      stdout: isModelProbe
        ? `{"type":"agent_message","message":"${CODEX_CLI_MODEL_PROBE_OK}"}\n`
        : `{"type":"agent_message","message":"${CODEX_CLI_READONLY_SMOKE_OK}"}\n`,
      exitCode: 0
    });
  };
}

function summarizeReadOnly(
  result: Awaited<ReturnType<typeof runCodexCliReadOnlySmoke>>
): {
  status: string;
  sandbox: string;
  approvalPolicy: string;
  executionStatus?: string;
  eventCount?: number;
  blockingReasons: string[];
} {
  return {
    status: result.status,
    sandbox: result.plan.sandbox,
    approvalPolicy: result.plan.approvalPolicy,
    ...(result.run?.inspection.status !== undefined
      ? { executionStatus: result.run.inspection.status }
      : {}),
    ...(result.run?.inspection.events.length !== undefined
      ? { eventCount: result.run.inspection.events.length }
      : {}),
    blockingReasons: [
      ...result.validationBlockers,
      ...(result.run?.inspection.blockingReasons ?? []),
      ...(result.error ? [`codex_cli_process_error:${result.error}`] : [])
    ]
  };
}

function summarizeWorkspaceWrite(
  result: Awaited<ReturnType<typeof runCodexCliWorkspaceWriteSmoke>>
): {
  status: string;
  preflightStatus: string;
  sandbox: string;
  approvalPolicy: string;
  executionStatus?: string;
  eventCount?: number;
  blockingReasons: string[];
} {
  return {
    status: result.status,
    preflightStatus: result.preflight.status,
    sandbox: result.plan.sandbox,
    approvalPolicy: result.plan.approvalPolicy,
    ...(result.run?.inspection.status !== undefined
      ? { executionStatus: result.run.inspection.status }
      : {}),
    ...(result.run?.inspection.events.length !== undefined
      ? { eventCount: result.run.inspection.events.length }
      : {}),
    blockingReasons: [
      ...result.validationBlockers,
      ...(result.run?.inspection.blockingReasons ?? []),
      ...(result.error ? [`codex_cli_process_error:${result.error}`] : [])
    ]
  };
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

class FakeCodexCliStream extends EventEmitter {
  setEncoding(_encoding: BufferEncoding): void {}
}

class FakeCodexCliChild extends EventEmitter implements CodexCliChildProcess {
  readonly stdout = new FakeCodexCliStream();
  readonly stderr = new FakeCodexCliStream();
  private readonly closeCode: number;
  private readonly closeSignal: NodeJS.Signals | null;

  constructor(closeCode: number, closeSignal: NodeJS.Signals | null) {
    super();
    this.closeCode = closeCode;
    this.closeSignal = closeSignal;
  }

  kill(_signal?: NodeJS.Signals | number): boolean {
    queueMicrotask(() => {
      this.emit("close", this.closeCode, this.closeSignal);
    });
    return true;
  }
}

function createFakeCodexCliChild(options: {
  stdout: string;
  stderr?: string;
  exitCode: number;
  signal?: NodeJS.Signals | null;
}): FakeCodexCliChild {
  const child = new FakeCodexCliChild(options.exitCode, options.signal ?? null);

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

main().catch((error) => {
  console.error("Codex CLI contract smoke failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
