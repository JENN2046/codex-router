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
  DEFAULT_CODEX_CLI_WORKSPACE_WRITE_SMOKE_TARGET_FILE,
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
const workspaceWriteBeforeCommit = "codex-cli-contract-smoke-before";
const forbiddenPersistedEvidenceKeys = [
  "command",
  "cwd",
  "repoRoot",
  "workdir",
  "args",
  "argv",
  "prompt",
  "stdin",
  "stdout",
  "stderr",
  "environment"
] as const;
const forbiddenPersistedEvidenceMarkers = [
  CODEX_CLI_MODEL_PROBE_OK,
  CODEX_CLI_READONLY_SMOKE_OK,
  CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION
];

interface ContractSpawnCall {
  kind: "model-probe" | "smoke-run" | "unclassified";
  commandMatchesConfigured: boolean;
  cwdMatchesRequestedWorkspace: boolean;
  promptChannel: "stdin";
  stdinAvailable: boolean;
  stdinObserved: boolean;
  stdinEndCount: number;
  responseEmittedAfterStdin: boolean;
  modelProbeClassifiedFromStdin: boolean;
  normalSmokeClassifiedFromStdin: boolean;
  argvPromptFree: boolean;
  approvalPolicy?: string;
  sandbox: string;
  usesJson: boolean;
  skipGitRepoCheck: boolean;
  ephemeral: boolean;
}

interface SafeNestedEvidenceSummary {
  schemaVersion: string;
  status: string;
  taskId: string;
  sandbox?: string;
  approvalPolicy?: string;
  usesJson?: boolean;
  skipGitRepoCheck?: boolean;
  ephemeral?: boolean;
  executionStatus?: string;
  eventCount?: number;
  parseErrorCount?: number;
  passed?: boolean;
  blockingReasons: string[];
  warningCount: number;
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
      worktreeClean: true,
      file: DEFAULT_CODEX_CLI_WORKSPACE_WRITE_SMOKE_TARGET_FILE
    },
    beforeCommit: workspaceWriteBeforeCommit,
    spawn
  });
  const blockedRunSpawned = spawnCalls.length !== spawnCountBeforeBlockedRun;

  const workspaceWriteReady = await runCodexCliWorkspaceWriteSmoke({
    telemetryStore,
    planOptions: commonPlanOptions,
    taskOptions: {
      taskId: "codex-cli-contract-smoke-workspace-write-ready",
      repoRoot: cwd,
      worktreeClean: true,
      file: DEFAULT_CODEX_CLI_WORKSPACE_WRITE_SMOKE_TARGET_FILE
    },
    beforeCommit: workspaceWriteBeforeCommit,
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
  const nestedEvidenceSummaries = {
    readOnlyFirst: summarizeNestedEvidence(readOnlyFirstEvidence),
    readOnlySecond: summarizeNestedEvidence(readOnlySecondEvidence),
    workspaceWriteBlocked: summarizeNestedEvidence(workspaceWriteBlockedEvidence),
    workspaceWriteReady: summarizeNestedEvidence(workspaceWriteReadyEvidence)
  };
  const serializedSpawnCalls = JSON.stringify(spawnCalls);
  const modelProbeClassifiedFromStdin = spawnCalls.some((call) => (
    call.kind === "model-probe"
    && call.modelProbeClassifiedFromStdin
  ));
  const normalSmokeClassifiedFromStdin = spawnCalls.some((call) => (
    call.kind === "smoke-run"
    && call.normalSmokeClassifiedFromStdin
  ));
  const allPromptsDeliveredThroughStdin = spawnCalls.every((call) => (
    call.promptChannel === "stdin"
    && call.stdinAvailable
    && call.stdinObserved
    && call.stdinEndCount === 1
    && call.responseEmittedAfterStdin
  ));
  const argvContainsNoPromptMarker = spawnCalls.every((call) => call.argvPromptFree);
  const allCommandsMatchConfiguredRuntime = spawnCalls.every((call) => (
    call.commandMatchesConfigured
  ));
  const allWorkdirsMatchRequestedWorkspace = spawnCalls.every((call) => (
    call.cwdMatchesRequestedWorkspace
  ));
  const spawnCallEvidenceOmitsRawRuntimeMaterial = ![
    /"command"\s*:/,
    /"cwd"\s*:/,
    /"args"\s*:/,
    /"prompt"\s*:/,
    /"stdin"\s*:/
  ].some((pattern) => pattern.test(serializedSpawnCalls))
    && !serializedSpawnCalls.includes(cwd)
    && !serializedSpawnCalls.includes(CODEX_CLI_MODEL_PROBE_OK)
    && !serializedSpawnCalls.includes(CODEX_CLI_READONLY_SMOKE_OK)
    && !serializedSpawnCalls.includes(CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION);

  const baseChecks = {
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
    nestedEvidenceOmitsRawPrompt,
    modelProbeClassifiedFromStdin,
    normalSmokeClassifiedFromStdin,
    allPromptsDeliveredThroughStdin,
    argvContainsNoPromptMarker,
    spawnCallEvidenceOmitsRawRuntimeMaterial,
    allCommandsMatchConfiguredRuntime,
    allWorkdirsMatchRequestedWorkspace
  };
  const provisionalArtifactChecks = {
    generatedEvidenceOmitsActiveWorkspacePath: true,
    generatedEvidenceOmitsForbiddenRawRuntimeKeys: true,
    generatedEvidenceOmitsPromptMarkers: true
  };
  const provisionalChecks = {
    ...baseChecks,
    ...provisionalArtifactChecks
  };
  const commonRuns = {
    readOnlyFirst: summarizeReadOnly(readOnlyFirst),
    readOnlySecond: summarizeReadOnly(readOnlySecond),
    workspaceWriteBlocked: summarizeWorkspaceWrite(workspaceWriteBlocked),
    workspaceWriteReady: summarizeWorkspaceWrite(workspaceWriteReady)
  };
  const provisionalEvidence = createPersistedContractSmokeEvidence({
    generatedAt,
    model,
    checks: provisionalChecks,
    passed: Object.values(provisionalChecks).every(Boolean),
    spawnCalls,
    telemetryEvents,
    nestedEvidenceSummaries,
    runs: commonRuns
  });
  const artifactChecks = inspectPersistedContractSmokeArtifact(
    `${JSON.stringify(provisionalEvidence, null, 2)}\n`,
    cwd
  );
  const checks = {
    ...baseChecks,
    ...artifactChecks
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = createPersistedContractSmokeEvidence({
    generatedAt,
    model,
    checks,
    passed,
    spawnCalls,
    telemetryEvents,
    nestedEvidenceSummaries,
    runs: commonRuns
  });
  const serializedEvidence = `${JSON.stringify(evidence, null, 2)}\n`;
  const finalArtifactChecks = inspectPersistedContractSmokeArtifact(serializedEvidence, cwd);
  if (!Object.entries(finalArtifactChecks).every(([key, value]) => (
    checks[key as keyof typeof finalArtifactChecks] === value
  ))) {
    throw new Error("codex_cli_contract_smoke_artifact_check_drift");
  }

  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, serializedEvidence, "utf8");

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
    console.error("failed checks:");
    for (const [name, ok] of Object.entries(checks)) {
      if (!ok) {
        console.error(`- ${name}`);
      }
    }
    process.exitCode = 1;
  }
}

function createPersistedContractSmokeEvidence(input: {
  generatedAt: string;
  model: string;
  checks: Record<string, boolean>;
  passed: boolean;
  spawnCalls: ContractSpawnCall[];
  telemetryEvents: Array<{ level: string; message: string }>;
  nestedEvidenceSummaries: {
    readOnlyFirst: SafeNestedEvidenceSummary;
    readOnlySecond: SafeNestedEvidenceSummary;
    workspaceWriteBlocked: SafeNestedEvidenceSummary;
    workspaceWriteReady: SafeNestedEvidenceSummary;
  };
  runs: {
    readOnlyFirst: ReturnType<typeof summarizeReadOnly>;
    readOnlySecond: ReturnType<typeof summarizeReadOnly>;
    workspaceWriteBlocked: ReturnType<typeof summarizeWorkspaceWrite>;
    workspaceWriteReady: ReturnType<typeof summarizeWorkspaceWrite>;
  };
}): {
  schemaVersion: "codex-cli-contract-smoke-evidence.v1";
  generatedAt: string;
  host: string;
  model: string;
  summary: {
    passed: boolean;
    checks: Record<string, boolean>;
    realCodexCliInvoked: false;
    realHostSmoke: false;
    spawnCallCount: number;
  };
  contract: {
    boundary: string;
    ciSafe: boolean;
    covers: string[];
    doesNotCover: string[];
  };
  telemetry: Array<{ level: string; message: string }>;
  spawnCalls: ContractSpawnCall[];
  runs: typeof input.runs;
  nestedEvidenceSummaries: typeof input.nestedEvidenceSummaries;
} {
  return {
    schemaVersion: "codex-cli-contract-smoke-evidence.v1",
    generatedAt: input.generatedAt,
    host: "Codex CLI contract smoke",
    model: input.model,
    summary: {
      passed: input.passed,
      checks: input.checks,
      realCodexCliInvoked: false,
      realHostSmoke: false,
      spawnCallCount: input.spawnCalls.length
    },
    contract: {
      boundary: "mock CodexCliProcessSpawner",
      ciSafe: true,
      covers: [
        "read-only smoke plan and execution contract",
        "workspace-write smoke preflight blocks before spawning when gates are missing",
        "workspace-write smoke can pass after explicit allowance and confirmation",
        "model probe telemetry emits cache miss and cache hit",
        "mock spawner validates stdin prompt transport",
        "nested smoke evidence omits raw task prompt and full argv",
        "spawn call evidence contains safe contract facts only"
      ],
      doesNotCover: [
        "real Codex CLI binary availability",
        "logged-in Codex account state",
        "real model availability",
        "real workspace file edits",
        "external writes or production host behavior"
      ]
    },
    telemetry: input.telemetryEvents.map((event) => ({
      level: event.level,
      message: event.message
    })),
    spawnCalls: input.spawnCalls,
    runs: input.runs,
    nestedEvidenceSummaries: input.nestedEvidenceSummaries
  };
}

function summarizeNestedEvidence(input: {
  schemaVersion: string;
  status: string;
  taskId: string;
  plan: {
    sandbox: string;
    approvalPolicy: string;
    usesJson: boolean;
    skipGitRepoCheck: boolean;
    ephemeral: boolean;
    warnings?: string[];
  };
  run?: {
    executionStatus?: string;
    eventCount?: number;
    parseErrorCount?: number;
    warnings?: string[];
  };
  summary: {
    passed?: boolean;
    blockingReasons?: string[];
    warnings?: string[];
  };
}): SafeNestedEvidenceSummary {
  return {
    schemaVersion: input.schemaVersion,
    status: input.status,
    taskId: input.taskId,
    sandbox: input.plan.sandbox,
    approvalPolicy: input.plan.approvalPolicy,
    usesJson: input.plan.usesJson,
    skipGitRepoCheck: input.plan.skipGitRepoCheck,
    ephemeral: input.plan.ephemeral,
    ...(input.run?.executionStatus !== undefined
      ? { executionStatus: input.run.executionStatus }
      : {}),
    ...(input.run?.eventCount !== undefined ? { eventCount: input.run.eventCount } : {}),
    ...(input.run?.parseErrorCount !== undefined
      ? { parseErrorCount: input.run.parseErrorCount }
      : {}),
    ...(input.summary.passed !== undefined ? { passed: input.summary.passed } : {}),
    blockingReasons: [...(input.summary.blockingReasons ?? [])],
    warningCount: [
      ...(input.plan.warnings ?? []),
      ...(input.run?.warnings ?? []),
      ...(input.summary.warnings ?? [])
    ].length
  };
}

function inspectPersistedContractSmokeArtifact(
  serializedEvidence: string,
  workspace: string
): {
  generatedEvidenceOmitsActiveWorkspacePath: boolean;
  generatedEvidenceOmitsForbiddenRawRuntimeKeys: boolean;
  generatedEvidenceOmitsPromptMarkers: boolean;
} {
  const normalizedEvidence = serializedEvidence
    .replace(/\\\\/g, "/")
    .toLowerCase();
  const normalizedWorkspace = workspace
    .replace(/\\/g, "/")
    .toLowerCase();
  const forbiddenKeyPattern = new RegExp(
    `"(${forbiddenPersistedEvidenceKeys.join("|")})"\\s*:`
  );

  return {
    generatedEvidenceOmitsActiveWorkspacePath: !normalizedEvidence.includes(
      normalizedWorkspace
    ),
    generatedEvidenceOmitsForbiddenRawRuntimeKeys: !forbiddenKeyPattern.test(
      serializedEvidence
    ),
    generatedEvidenceOmitsPromptMarkers: forbiddenPersistedEvidenceMarkers.every(
      (marker) => !serializedEvidence.includes(marker)
    )
  };
}

function createContractSpawner(calls: ContractSpawnCall[]): CodexCliProcessSpawner {
  return (command, args, options) => {
    const approvalPolicy = getArgValue(args, "-a");
    const call: ContractSpawnCall = {
      kind: "unclassified",
      commandMatchesConfigured: command === codexCommand,
      cwdMatchesRequestedWorkspace: options.cwd === cwd,
      promptChannel: "stdin",
      stdinAvailable: true,
      stdinObserved: false,
      stdinEndCount: 0,
      responseEmittedAfterStdin: false,
      modelProbeClassifiedFromStdin: false,
      normalSmokeClassifiedFromStdin: false,
      argvPromptFree: [
        CODEX_CLI_MODEL_PROBE_OK,
        CODEX_CLI_READONLY_SMOKE_OK,
        CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
        "Task envelope",
        "requestedAction"
      ].every((marker) => !args.some((arg) => arg.includes(marker))),
      ...(approvalPolicy !== undefined ? { approvalPolicy } : {}),
      sandbox: getArgValue(args, "--sandbox") ?? "read-only",
      usesJson: args.includes("--json"),
      skipGitRepoCheck: args.includes("--skip-git-repo-check"),
      ephemeral: args.includes("--ephemeral")
    };

    calls.push(call);
    return createFakeCodexCliChild(call);
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

class FakeCodexCliWritableStream {
  private readonly call: ContractSpawnCall;
  private readonly child: FakeCodexCliChild;

  constructor(call: ContractSpawnCall, child: FakeCodexCliChild) {
    this.call = call;
    this.child = child;
  }

  end(chunk?: string): void {
    this.call.stdinEndCount += 1;
    this.call.stdinObserved = true;

    if (this.call.stdinEndCount !== 1) {
      queueMicrotask(() => {
        this.child.stderr.emit("data", "codex_cli_contract_smoke_duplicate_stdin_end\n");
        this.child.emit("close", 1, null);
      });
      return;
    }

    const prompt = chunk ?? "";
    const isModelProbe = prompt.includes(CODEX_CLI_MODEL_PROBE_OK);
    this.call.kind = isModelProbe ? "model-probe" : "smoke-run";
    this.call.modelProbeClassifiedFromStdin = isModelProbe;
    this.call.normalSmokeClassifiedFromStdin = !isModelProbe;
    const stdout = isModelProbe
      ? `{"type":"agent_message","message":"${CODEX_CLI_MODEL_PROBE_OK}"}\n`
      : `{"type":"agent_message","message":"${CODEX_CLI_READONLY_SMOKE_OK}"}\n`;

    queueMicrotask(() => {
      this.call.responseEmittedAfterStdin = true;
      this.child.stdout.emit("data", stdout);
      this.child.emit("close", 0, null);
    });
  }

  destroy(): void {}
}

class FakeCodexCliChild extends EventEmitter implements CodexCliChildProcess {
  readonly stdin: FakeCodexCliWritableStream;
  readonly stdout = new FakeCodexCliStream();
  readonly stderr = new FakeCodexCliStream();

  constructor(call: ContractSpawnCall) {
    super();
    this.stdin = new FakeCodexCliWritableStream(call, this);
  }

  kill(_signal?: NodeJS.Signals | number): boolean {
    queueMicrotask(() => {
      this.emit("close", 1, null);
    });
    return true;
  }
}

function createFakeCodexCliChild(call: ContractSpawnCall): FakeCodexCliChild {
  return new FakeCodexCliChild(call);
}

main().catch((error) => {
  console.error("Codex CLI contract smoke failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
