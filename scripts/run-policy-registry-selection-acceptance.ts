#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import {
  runDesktopDecision,
  type DesktopDecisionRunnerResult
} from "../packages/desktop-decision-runner/src/index.js";
import {
  dispatchReadOnlyRunnerResultToProvider
} from "../packages/host-dispatcher/src/index.js";
import {
  type ExecutionPlanInput,
  hashProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  createProviderRegistry,
  type ProviderRegistry
} from "../packages/provider-registry/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import {
  CodexCliExecutorProvider,
  codexCliProviderManifest
} from "../packages/providers/codex-cli/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "policy-registry-selection-acceptance.json"
);
const DEFAULT_POLICY_PATH = join(__dirname, "..", "routing-policy.yaml");
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";

export interface PolicyRegistrySelectionAcceptanceEvidence {
  schemaVersion: "policy-registry-selection-acceptance.v1";
  generatedAt: string;
  mode: "read-only-policy-registry-selection";
  taskId: string;
  checks: {
    routingGrantPresent: boolean;
    routingGrantManifestHashRecorded: boolean;
    runnerReadyWithRegistry: boolean;
    runnerSelectionRecorded: boolean;
    runnerSelectionOk: boolean;
    runnerMissingProviderBlocked: boolean;
    runnerDisabledProviderBlocked: boolean;
    runnerManifestMismatchBlocked: boolean;
    dispatcherMissingProviderBlocked: boolean;
    dispatcherDisabledProviderBlocked: boolean;
    dispatcherManifestMismatchBlocked: boolean;
    dispatcherBlockedBeforePlan: boolean;
    workspaceWriteRemainsBlocked: boolean;
    noRunPath: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    providerId: string;
    kind: string;
    manifestHash: string;
    capabilityCount: number;
    sandboxProfileCount: number;
    sideEffectClassCount: number;
  };
  counters: {
    providerPlanCalls: number;
    providerSpawnCalls: number;
  };
  blockingReasons: string[];
}

export interface PolicyRegistrySelectionAcceptanceOptions {
  generatedAt?: string;
  policyPath?: string;
}

export async function runPolicyRegistrySelectionAcceptance(
  options: PolicyRegistrySelectionAcceptanceOptions = {}
): Promise<PolicyRegistrySelectionAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const policy = await loadPolicyFromFile(options.policyPath ?? DEFAULT_POLICY_PATH);
  const task = createPolicyRegistrySelectionTask();
  const expectedHash = hashProviderManifest(codexCliProviderManifest);
  const registry = createCodexRegistry(generatedAt);
  const runnerResult = await runDesktopDecision({
    task,
    policy,
    providerRegistry: registry,
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    now: () => generatedAt
  });
  const missingProviderRunner = await runDesktopDecision({
    task: createPolicyRegistrySelectionTask("policy-registry-selection-missing"),
    policy,
    providerRegistry: createProviderRegistry(),
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    now: () => generatedAt
  });
  const disabledProviderRunner = await runDesktopDecision({
    task: createPolicyRegistrySelectionTask("policy-registry-selection-disabled"),
    policy,
    providerRegistry: createDisabledCodexRegistry(generatedAt),
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    now: () => generatedAt
  });
  const manifestMismatchRunner = await runDesktopDecision({
    task: createPolicyRegistrySelectionTask("policy-registry-selection-mismatch"),
    policy,
    providerRegistry: createMismatchedCodexRegistry(generatedAt),
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    now: () => generatedAt
  });

  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn: () => {
      counters.providerSpawnCalls += 1;
      throw new Error("policy_registry_selection_acceptance_no_run_path");
    }
  });
  const counters = {
    providerPlanCalls: 0,
    providerSpawnCalls: 0
  };
  const originalPlan = provider.planExecution.bind(provider);
  provider.planExecution = ((input: ExecutionPlanInput) => {
    counters.providerPlanCalls += 1;
    return originalPlan(input);
  }) as typeof provider.planExecution;

  const missingProviderDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    providerRegistry: createProviderRegistry(),
    now: generatedAt
  });
  const disabledProviderDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    providerRegistry: createDisabledCodexRegistry(generatedAt),
    now: generatedAt
  });
  const manifestMismatchDispatch = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    providerRegistry: createMismatchedCodexRegistry(generatedAt),
    now: generatedAt
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
    providerRegistry: registry,
    now: generatedAt
  });

  const blockingReasons = [
    ...missingProviderRunner.blockingReasons,
    ...disabledProviderRunner.blockingReasons,
    ...manifestMismatchRunner.blockingReasons,
    ...(missingProviderDispatch.blockingReasons ?? []),
    ...(disabledProviderDispatch.blockingReasons ?? []),
    ...(manifestMismatchDispatch.blockingReasons ?? []),
    ...(workspaceWriteDispatch.blockingReasons ?? [])
  ];

  const evidenceWithoutLeakCheck: Omit<
    PolicyRegistrySelectionAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<PolicyRegistrySelectionAcceptanceEvidence["checks"], "leakCheckPassed">;
  } = {
    schemaVersion: "policy-registry-selection-acceptance.v1",
    generatedAt,
    mode: "read-only-policy-registry-selection",
    taskId: runnerResult.task.taskId,
    checks: {
      routingGrantPresent: runnerResult.decision.providerGrant?.providerId === "codex-cli",
      routingGrantManifestHashRecorded: runnerResult.decision.providerGrant?.manifestHash === expectedHash,
      runnerReadyWithRegistry: runnerResult.status === "ready",
      runnerSelectionRecorded: runnerResult.providerSelection !== undefined,
      runnerSelectionOk: runnerResult.providerSelection?.selected === true
        && runnerResult.providerSelection.providerId === "codex-cli",
      runnerMissingProviderBlocked: missingProviderRunner.status === "blocked_preflight"
        && missingProviderRunner.blockingReasons.includes(
          "provider_selection_provider_missing:codex-cli"
        ),
      runnerDisabledProviderBlocked: disabledProviderRunner.status === "blocked_preflight"
        && disabledProviderRunner.blockingReasons.includes(
          "provider_selection_provider_disabled:codex-cli"
        ),
      runnerManifestMismatchBlocked: manifestMismatchRunner.status === "blocked_preflight"
        && manifestMismatchRunner.blockingReasons.includes(
          "provider_selection_manifest_hash_mismatch"
        ),
      dispatcherMissingProviderBlocked: missingProviderDispatch.ok === false
        && missingProviderDispatch.blockingReasons?.includes(
          "provider_selection_provider_missing:codex-cli"
        ) === true,
      dispatcherDisabledProviderBlocked: disabledProviderDispatch.ok === false
        && disabledProviderDispatch.blockingReasons?.includes(
          "provider_selection_provider_disabled:codex-cli"
        ) === true,
      dispatcherManifestMismatchBlocked: manifestMismatchDispatch.ok === false
        && manifestMismatchDispatch.blockingReasons?.includes(
          "provider_selection_manifest_hash_mismatch"
        ) === true,
      dispatcherBlockedBeforePlan: counters.providerPlanCalls === 0
        && counters.providerSpawnCalls === 0,
      workspaceWriteRemainsBlocked: workspaceWriteDispatch.ok === false
        && workspaceWriteDispatch.blockingReasons?.includes(
          "runner_result_tool_access_not_read_only"
        ) === true,
      noRunPath: counters.providerPlanCalls === 0 && counters.providerSpawnCalls === 0
    },
    summary: {
      providerId: runnerResult.providerSelection?.providerId ?? "codex-cli",
      kind: runnerResult.providerSelection?.kind ?? "executor",
      manifestHash: runnerResult.providerSelection?.manifestHash ?? expectedHash,
      capabilityCount: runnerResult.providerSelection?.capabilityCount ?? 0,
      sandboxProfileCount: runnerResult.providerSelection?.sandboxProfileCount ?? 0,
      sideEffectClassCount: runnerResult.providerSelection?.sideEffectClassCount ?? 0
    },
    counters,
    blockingReasons
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

export async function writePolicyRegistrySelectionAcceptanceEvidence(
  evidence: PolicyRegistrySelectionAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{ path: string; evidence: PolicyRegistrySelectionAcceptanceEvidence }> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function createCodexRegistry(registeredAt: string): ProviderRegistry {
  const registry = createProviderRegistry();
  registry.register(codexCliProviderManifest, {
    registeredAt
  });
  return registry;
}

function createDisabledCodexRegistry(registeredAt: string): ProviderRegistry {
  const registry = createProviderRegistry();
  registry.register({
    ...codexCliProviderManifest,
    enabled: false
  }, {
    registeredAt
  });
  return registry;
}

function createMismatchedCodexRegistry(registeredAt: string): ProviderRegistry {
  const registry = createProviderRegistry();
  registry.register({
    ...codexCliProviderManifest,
    version: "0.0.0-policy-registry-selection-mismatch"
  }, {
    registeredAt
  });
  return registry;
}

function createPolicyRegistrySelectionTask(
  taskId = "policy-registry-selection-acceptance"
) {
  return parseTaskEnvelope({
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "Policy registry selection acceptance",
      requestedAction: "Inspect policy routing to provider registry selection without edits",
      successCriteria: ["provider registry selection is recorded and blocks mismatches"],
      outOfScope: ["workspace writes", "remote writes", "real Codex CLI execution"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["routing-policy.yaml"],
      modules: ["provider-registry", "desktop-decision-runner", "host-dispatcher"]
    },
    constraints: {
      requiresNetwork: false
    },
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: ["acceptance", "policy-registry-selection"]
    }
  });
}

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "execute",
    "invoke",
    "function",
    "secret",
    "token",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer",
    "raw env",
    "raw command",
    "prompt",
    "args",
    "stdout",
    "stderr"
  ].some((marker) => serialized.includes(marker));
}

async function main(): Promise<void> {
  const outputIdx = process.argv.indexOf("--output");
  const outputPath = outputIdx >= 0
    ? process.argv[outputIdx + 1]!
    : DEFAULT_EVIDENCE_PATH;
  const evidence = await runPolicyRegistrySelectionAcceptance();
  const write = await writePolicyRegistrySelectionAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Policy registry selection acceptance");
  console.log(`runner selection ok: ${evidence.checks.runnerSelectionOk}`);
  console.log(`dispatcher blocked before plan: ${evidence.checks.dispatcherBlockedBeforePlan}`);
  console.log(`workspace-write blocked: ${evidence.checks.workspaceWriteRemainsBlocked}`);
  console.log(`leak check: ${evidence.checks.leakCheckPassed}`);
  console.log(`evidence: ${write.path}`);

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Policy registry selection acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
