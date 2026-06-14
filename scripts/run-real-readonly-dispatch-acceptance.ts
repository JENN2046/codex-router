#!/usr/bin/env node

import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { type CodexCliProcessSpawner } from "../packages/codex-cli-host/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";
import {
  dispatchReadOnlyRunnerResultToProvider
} from "../packages/host-dispatcher/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { hashProviderManifest } from "../packages/provider-core/src/index.js";
import { createProviderRegistry } from "../packages/provider-registry/src/index.js";
import {
  CodexCliExecutorProvider,
  codexCliProviderManifest,
  type CodexCliProviderRealExecutionGuard
} from "../packages/providers/codex-cli/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-real-readonly-dispatch-acceptance.json"
);
const DEFAULT_POLICY_PATH = join(__dirname, "..", "routing-policy.yaml");
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";

export interface RealReadOnlyDispatchAcceptanceEvidence {
  schemaVersion: "codex-cli-real-readonly-dispatch-acceptance.v1";
  generatedAt: string;
  mode: "real-readonly-provider-dispatch-fake";
  taskId: string;
  checks: {
    runnerReady: boolean;
    registrySelectionOk: boolean;
    realModeGuardProvided: boolean;
    permitIssued: boolean;
    dispatchOk: boolean;
    fakeSpawnerUsed: boolean;
    injectedSpawnerGuarded: boolean;
    guardMissingBlocked: boolean;
    registryMismatchBlocked: boolean;
    workspaceWriteBlocked: boolean;
    noRealCodexCli: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    providerId: string;
    manifestHash: string;
    sideEffectClass: string;
    sandbox: string;
    status: string;
    eventCount: number;
    parseErrorCount: number;
    warningCount: number;
    timedOut: boolean;
    killed: boolean;
  };
  counters: {
    successSpawnCalls: number;
    guardMissingSpawnCalls: number;
    registryMismatchSpawnCalls: number;
    workspaceWriteSpawnCalls: number;
  };
  blockingReasons: string[];
}

export interface RealReadOnlyDispatchAcceptanceOptions {
  generatedAt?: string;
  policyPath?: string;
}

export async function runRealReadOnlyDispatchAcceptance(
  options: RealReadOnlyDispatchAcceptanceOptions = {}
): Promise<RealReadOnlyDispatchAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const policy = await loadPolicyFromFile(options.policyPath ?? DEFAULT_POLICY_PATH);
  const registry = createProviderRegistry();
  registry.register(codexCliProviderManifest, {
    registeredAt: generatedAt
  });
  const expectedHash = hashProviderManifest(codexCliProviderManifest);
  const runnerResult = await runDesktopDecision({
    task: createRealReadOnlyDispatchAcceptanceTask(),
    policy,
    providerRegistry: registry,
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    now: () => generatedAt
  });

  let successSpawnCalls = 0;
  const successProvider = createRealModeProvider(() => {
    successSpawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"REAL_READONLY_DISPATCH_ACCEPTANCE_OK\"}\n",
      exitCode: 0
    });
  });
  const guard = createRealExecutionGuard(expectedHash);
  const dispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider: successProvider,
    providerRegistry: registry,
    now: generatedAt,
    providerExecutionMetadata: {
      codexCliProviderRealExecutionGuard: guard
    }
  });

  let guardMissingSpawnCalls = 0;
  const guardMissingDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider: createRealModeProvider(() => {
      guardMissingSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }),
    providerRegistry: registry,
    now: generatedAt
  });

  let registryMismatchSpawnCalls = 0;
  const registryMismatchDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider: createRealModeProvider(() => {
      registryMismatchSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }),
    providerRegistry: registry,
    now: generatedAt,
    providerExecutionMetadata: {
      codexCliProviderRealExecutionGuard: createRealExecutionGuard("b".repeat(64))
    }
  });

  let workspaceWriteSpawnCalls = 0;
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
    provider: createRealModeProvider(() => {
      workspaceWriteSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }),
    providerRegistry: registry,
    now: generatedAt,
    providerExecutionMetadata: {
      codexCliProviderRealExecutionGuard: guard
    }
  });

  const evidenceWithoutLeakCheck: Omit<
    RealReadOnlyDispatchAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<RealReadOnlyDispatchAcceptanceEvidence["checks"], "leakCheckPassed">;
  } = {
    schemaVersion: "codex-cli-real-readonly-dispatch-acceptance.v1",
    generatedAt,
    mode: "real-readonly-provider-dispatch-fake",
    taskId: runnerResult.task.taskId,
    checks: {
      runnerReady: runnerResult.status === "ready",
      registrySelectionOk: runnerResult.providerSelection?.selected === true
        && runnerResult.providerSelection.providerId === "codex-cli",
      realModeGuardProvided: guard.realExecutionAllowed === true
        && guard.environmentPreflight.status === "ready",
      permitIssued: dispatch.permit?.status === "approved",
      dispatchOk: dispatch.ok === true && dispatch.status === "completed",
      fakeSpawnerUsed: successSpawnCalls === 1,
      injectedSpawnerGuarded: guard.environmentPreflight.checks.injectedSpawner === true
        && successSpawnCalls === 1,
      guardMissingBlocked: guardMissingDispatch.ok === false
        && guardMissingSpawnCalls === 0
        && collectDispatchReasons(guardMissingDispatch).includes(
          "codex_cli_provider_real_execute_guard_missing"
        ),
      registryMismatchBlocked: registryMismatchDispatch.ok === false
        && registryMismatchSpawnCalls === 0
        && collectDispatchReasons(registryMismatchDispatch).includes(
          "codex_cli_provider_real_execute_registry_manifest_mismatch"
        ),
      workspaceWriteBlocked: workspaceWriteDispatch.ok === false
        && workspaceWriteSpawnCalls === 0
        && workspaceWriteDispatch.blockingReasons?.includes(
          "runner_result_tool_access_not_read_only"
        ) === true,
      noRealCodexCli: true
    },
    summary: {
      providerId: dispatch.providerId ?? "codex-cli",
      manifestHash: expectedHash,
      sideEffectClass: dispatch.sideEffectClass ?? "read_only",
      sandbox: dispatch.sandbox ?? "read-only",
      status: dispatch.status,
      eventCount: dispatch.eventCount ?? 0,
      parseErrorCount: dispatch.parseErrorCount ?? 0,
      warningCount: dispatch.warningCount ?? 0,
      timedOut: dispatch.timedOut ?? false,
      killed: dispatch.killed ?? false
    },
    counters: {
      successSpawnCalls,
      guardMissingSpawnCalls,
      registryMismatchSpawnCalls,
      workspaceWriteSpawnCalls
    },
    blockingReasons: uniqueStrings([
      ...collectDispatchReasons(dispatch),
      ...collectDispatchReasons(guardMissingDispatch),
      ...collectDispatchReasons(registryMismatchDispatch),
      ...collectDispatchReasons(workspaceWriteDispatch)
    ])
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

function collectDispatchReasons(input: {
  blockingReasons?: string[];
  error?: { reasons: string[] };
}): string[] {
  return [
    ...(input.blockingReasons ?? []),
    ...(input.error?.reasons ?? [])
  ];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export async function writeRealReadOnlyDispatchAcceptanceEvidence(
  evidence: RealReadOnlyDispatchAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{ path: string; evidence: RealReadOnlyDispatchAcceptanceEvidence }> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function createRealModeProvider(spawn: CodexCliProcessSpawner): CodexCliExecutorProvider {
  return new CodexCliExecutorProvider({
    executionEnabled: true,
    executionMode: "real",
    realExecutionAllowed: true,
    timeoutMs: 1_000,
    spawn
  });
}

function createRealExecutionGuard(
  manifestHash: string
): CodexCliProviderRealExecutionGuard {
  return {
    schemaVersion: "codex-cli-provider-real-execution-guard.v1",
    realExecutionAllowed: true,
    providerRegistrySelection: {
      selected: true,
      providerId: "codex-cli",
      manifestHash,
      kind: "executor",
      enabled: true
    },
    environmentPreflight: {
      status: "ready",
      checks: {
        injectedSpawner: true,
        realCliAllowed: true,
        versionProbe: "passed",
        noTaskEnvelope: true,
        noPromptSent: true,
        noWorkspaceWrite: true,
        noRealCliFallback: true
      },
      blockingReasons: []
    }
  };
}

function createRealReadOnlyDispatchAcceptanceTask() {
  return parseTaskEnvelope({
    taskId: "codex-cli-real-readonly-dispatch-acceptance",
    source: "desktop-thread",
    intent: {
      summary: "Codex CLI real read-only dispatch acceptance",
      requestedAction: "Inspect the provider dispatch chain without edits",
      successCriteria: ["real-mode read-only provider dispatch is guarded"],
      outOfScope: ["workspace writes", "remote writes", "real Codex CLI process"]
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
      tags: ["acceptance", "real-readonly-dispatch"]
    }
  });
}

function containsRawExecutionMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "requestedAction",
    "prompt",
    "args",
    "stdout",
    "stderr",
    "raw command",
    "raw task envelope",
    "raw env",
    "raw token",
    "raw patch",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer"
  ].some((marker) => serialized.includes(marker));
}

async function main(): Promise<void> {
  const outputIdx = process.argv.indexOf("--output");
  const outputPath = outputIdx >= 0
    ? process.argv[outputIdx + 1]!
    : DEFAULT_EVIDENCE_PATH;
  const evidence = await runRealReadOnlyDispatchAcceptance();
  const write = await writeRealReadOnlyDispatchAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI real read-only dispatch acceptance");
  console.log(`dispatch ok: ${evidence.checks.dispatchOk}`);
  console.log(`guard missing blocked: ${evidence.checks.guardMissingBlocked}`);
  console.log(`registry mismatch blocked: ${evidence.checks.registryMismatchBlocked}`);
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
      "Codex CLI real read-only dispatch acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
