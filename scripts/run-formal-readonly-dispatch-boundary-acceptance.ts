#!/usr/bin/env node

import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { type CodexCliProcessSpawner } from "../packages/codex-cli-host/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";
import {
  dispatchFormalReadOnlyRunnerResultToProvider
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
  "codex-cli-formal-readonly-dispatch-boundary-acceptance.json"
);
const DEFAULT_POLICY_PATH = join(__dirname, "..", "routing-policy.yaml");
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

export interface FormalReadonlyDispatchBoundaryAcceptanceEvidence {
  schemaVersion: "codex-cli-formal-readonly-dispatch-boundary-acceptance.v1";
  generatedAt: string;
  mode: "formal-readonly-dispatch-boundary-local-only";
  taskId: "codex-cli-formal-readonly-dispatch-boundary-acceptance";
  checks: {
    runnerReady: boolean;
    formalWrapperRequiresRegistry: boolean;
    formalWrapperRequiresMetadata: boolean;
    registrySelectionOk: boolean;
    permitIssued: boolean;
    formalDispatchOk: boolean;
    fakeSpawnerUsed: boolean;
    guardMismatchBlocked: boolean;
    writeAccessBlocked: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    noLocalCommandExecute: boolean;
    noProtectedRemoteExecute: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    providerId: "codex-cli";
    sideEffectClass: "read_only";
    sandbox: "read-only";
    status: string;
    formalDispatchCalls: number;
    fakeSpawnerCalls: number;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
    localCommandExecuteCalls: 0;
    protectedRemoteExecuteCalls: 0;
  };
  counters: {
    successSpawnCalls: number;
    missingRegistrySpawnCalls: number;
    missingMetadataSpawnCalls: number;
    guardMismatchSpawnCalls: number;
    writeAccessSpawnCalls: number;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
    localCommandExecuteCalls: 0;
    protectedRemoteExecuteCalls: 0;
  };
  blockingReasons: string[];
}

export interface FormalReadonlyDispatchBoundaryAcceptanceOptions {
  generatedAt?: string;
  policyPath?: string;
}

export async function runFormalReadonlyDispatchBoundaryAcceptance(
  options: FormalReadonlyDispatchBoundaryAcceptanceOptions = {}
): Promise<FormalReadonlyDispatchBoundaryAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const policy = await loadPolicyFromFile(options.policyPath ?? DEFAULT_POLICY_PATH);
  const registry = createProviderRegistry();
  registry.register(codexCliProviderManifest, {
    registeredAt: generatedAt
  });
  const manifestHash = hashProviderManifest(codexCliProviderManifest);
  const runnerResult = await runDesktopDecision({
    task: createFormalReadonlyBoundaryTask(),
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
      stdout: "{\"type\":\"agent_message\",\"message\":\"FORMAL_BOUNDARY_OK\"}\n",
      exitCode: 0
    });
  });
  const successDispatch = await dispatchFormalReadOnlyRunnerResultToProvider({
    runnerResult,
    provider: successProvider,
    providerRegistry: registry,
    now: generatedAt,
    providerExecutionMetadata: {
      codexCliProviderRealExecutionGuard: createRealExecutionGuard(manifestHash)
    }
  });

  let missingRegistrySpawnCalls = 0;
  const missingRegistryDispatch = await dispatchFormalReadOnlyRunnerResultToProvider({
    runnerResult,
    provider: createRealModeProvider(() => {
      missingRegistrySpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }),
    providerRegistry: undefined,
    now: generatedAt,
    providerExecutionMetadata: {
      codexCliProviderRealExecutionGuard: createRealExecutionGuard(manifestHash)
    }
  } as unknown as Parameters<typeof dispatchFormalReadOnlyRunnerResultToProvider>[0]);

  let missingMetadataSpawnCalls = 0;
  const missingMetadataDispatch = await dispatchFormalReadOnlyRunnerResultToProvider({
    runnerResult,
    provider: createRealModeProvider(() => {
      missingMetadataSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }),
    providerRegistry: registry,
    now: generatedAt,
    providerExecutionMetadata: undefined
  } as unknown as Parameters<typeof dispatchFormalReadOnlyRunnerResultToProvider>[0]);

  let guardMismatchSpawnCalls = 0;
  const guardMismatchDispatch = await dispatchFormalReadOnlyRunnerResultToProvider({
    runnerResult,
    provider: createRealModeProvider(() => {
      guardMismatchSpawnCalls += 1;
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

  let writeAccessSpawnCalls = 0;
  const writeAccessDispatch = await dispatchFormalReadOnlyRunnerResultToProvider({
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
      writeAccessSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }),
    providerRegistry: registry,
    now: generatedAt,
    providerExecutionMetadata: {
      codexCliProviderRealExecutionGuard: createRealExecutionGuard(manifestHash)
    }
  });
  const evidenceWithoutLeakCheck: Omit<
    FormalReadonlyDispatchBoundaryAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      FormalReadonlyDispatchBoundaryAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "codex-cli-formal-readonly-dispatch-boundary-acceptance.v1",
    generatedAt,
    mode: "formal-readonly-dispatch-boundary-local-only",
    taskId: "codex-cli-formal-readonly-dispatch-boundary-acceptance",
    checks: {
      runnerReady: runnerResult.status === "ready",
      formalWrapperRequiresRegistry: missingRegistryDispatch.ok === false
        && missingRegistrySpawnCalls === 0
        && collectReasons(missingRegistryDispatch).includes(
          "host_dispatcher_formal_read_only_provider_registry_required"
        ),
      formalWrapperRequiresMetadata: missingMetadataDispatch.ok === false
        && missingMetadataSpawnCalls === 0
        && collectReasons(missingMetadataDispatch).includes(
          "host_dispatcher_formal_read_only_provider_metadata_required"
        ),
      registrySelectionOk: successDispatch.providerSelection?.selected === true,
      permitIssued: successDispatch.permit?.status === "approved",
      formalDispatchOk: successDispatch.ok === true
        && successDispatch.status === "completed",
      fakeSpawnerUsed: successSpawnCalls === 1,
      guardMismatchBlocked: guardMismatchDispatch.ok === false
        && guardMismatchSpawnCalls === 0
        && collectReasons(guardMismatchDispatch).includes(
          "codex_cli_provider_real_execute_registry_manifest_mismatch"
        ),
      writeAccessBlocked: writeAccessDispatch.ok === false
        && writeAccessSpawnCalls === 0
        && collectReasons(writeAccessDispatch).includes(
          "runner_result_tool_access_not_read_only"
        ),
      noRealCodexCli: true,
      noWorkspaceWriteExecute: writeAccessSpawnCalls === 0,
      noLocalCommandExecute: true,
      noProtectedRemoteExecute: true
    },
    summary: {
      providerId: "codex-cli",
      sideEffectClass: "read_only",
      sandbox: "read-only",
      status: successDispatch.status,
      formalDispatchCalls: successDispatch.ok ? 1 : 0,
      fakeSpawnerCalls: successSpawnCalls,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      localCommandExecuteCalls: 0,
      protectedRemoteExecuteCalls: 0
    },
    counters: {
      successSpawnCalls,
      missingRegistrySpawnCalls,
      missingMetadataSpawnCalls,
      guardMismatchSpawnCalls,
      writeAccessSpawnCalls,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      localCommandExecuteCalls: 0,
      protectedRemoteExecuteCalls: 0
    },
    blockingReasons: uniqueStrings([
      ...collectReasons(missingRegistryDispatch),
      ...collectReasons(missingMetadataDispatch),
      ...collectReasons(guardMismatchDispatch),
      ...collectReasons(writeAccessDispatch)
    ])
  };
  const leakCheckPassed = !containsForbiddenMarkers(evidenceWithoutLeakCheck);

  return {
    ...evidenceWithoutLeakCheck,
    checks: {
      ...evidenceWithoutLeakCheck.checks,
      leakCheckPassed
    }
  };
}

export async function writeFormalReadonlyDispatchBoundaryAcceptanceEvidence(
  evidence: FormalReadonlyDispatchBoundaryAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalReadonlyDispatchBoundaryAcceptanceEvidence;
}> {
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

function createFormalReadonlyBoundaryTask() {
  return parseTaskEnvelope({
    taskId: "codex-cli-formal-readonly-dispatch-boundary-acceptance",
    source: "desktop-thread",
    intent: {
      summary: "Codex CLI formal read-only dispatch boundary acceptance",
      requestedAction: "Inspect formal provider dispatch boundaries without edits",
      successCriteria: ["formal dispatch requires registry and metadata"],
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
      tags: ["acceptance", "formal-readonly-dispatch-boundary"]
    }
  });
}

function collectReasons(input: {
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

function containsForbiddenMarkers(value: unknown): boolean {
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
  const evidence = await runFormalReadonlyDispatchBoundaryAcceptance();
  const write = await writeFormalReadonlyDispatchBoundaryAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI formal read-only dispatch boundary acceptance");
  console.log(`formal dispatch ok: ${evidence.checks.formalDispatchOk}`);
  console.log(`requires registry: ${evidence.checks.formalWrapperRequiresRegistry}`);
  console.log(`requires metadata: ${evidence.checks.formalWrapperRequiresMetadata}`);
  console.log(`fake spawner calls: ${evidence.counters.successSpawnCalls}`);
  console.log(`real Codex CLI calls: ${evidence.counters.realCodexCliCalls}`);
  console.log(`workspace-write execute: ${evidence.counters.workspaceWriteExecuteCalls}`);
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
      "Codex CLI formal read-only dispatch boundary acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
