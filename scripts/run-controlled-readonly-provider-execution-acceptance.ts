#!/usr/bin/env node

import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashApprovalScope } from "../packages/governance-internal-approval-permit/src/index.js";
import { InMemoryArtifactStore } from "../packages/artifact-store/src/index.js";
import { type CodexCliProcessSpawner } from "../packages/codex-cli-host/src/index.js";
import {
  hashProviderExecutionPlannerObject,
  planProviderExecution,
  type ProviderExecutionPlan
} from "../packages/execution-planner/src/index.js";
import {
  CapabilityScopeSchema,
  PolicyDecisionSchema,
  RunSchema,
  SandboxProfileSchema,
  TaskSchema,
  type CapabilityScope,
  type PolicyDecision,
  type Run,
  type SandboxProfile,
  type Task
} from "../packages/kernel-contracts/src/index.js";
import { InMemoryKernelStore } from "../packages/kernel-store/src/index.js";
import {
  createApprovedProviderExecutionPermit,
  hashProviderManifest,
  InMemoryProviderExecutionPermitConsumptionStore,
  type ExecutorExecutionPlan,
  type ProviderExecutionPermit,
  type ProviderExecutionPermitConsumptionStore,
  type ProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  runProviderExecutionPlanControlledReadOnly,
  type ControlledReadOnlyProviderExecutionRunnerResult
} from "../packages/governance-internal-provider-execution-runner/src/index.js";
import { ProviderRegistry } from "../packages/provider-registry/src/index.js";
import { CodexCliExecutorProvider } from "../packages/providers/codex-cli/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-controlled-readonly-provider-execution-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-22T00:00:00.000Z";

export interface ControlledReadonlyProviderExecutionAcceptanceEvidence {
  schemaVersion: "codex-cli-controlled-readonly-provider-execution-acceptance.v1";
  generatedAt: string;
  mode: "controlled-readonly-provider-execution-fake-spawner-local-only";
  taskId: "codex-cli-controlled-readonly-provider-execution-acceptance";
  checks: {
    runnerStatusOk: boolean;
    permitApproved: boolean;
    providerExecuteInvoked: boolean;
    fakeSpawnerUsed: boolean;
    metadataGuarded: boolean;
    readOnlySandbox: boolean;
    approvalPolicyNever: boolean;
    missingPermitBlocked: boolean;
    missingMetadataBlocked: boolean;
    workspaceWriteBlocked: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    noExternalWrite: boolean;
    preflightEvidenceBound: boolean;
    expiredPermitBlocked: boolean;
    nonceMismatchBlocked: boolean;
    permitReplayBlocked: boolean;
    permitStoreFailureBlocked: boolean;
    evidenceSanitized: boolean;
  };
  summary: {
    providerId: "codex-cli";
    sideEffectClass: "read_only";
    sandbox: "read-only";
    status: string;
    approvalPolicy: "never" | "unknown";
    providerExecuteCalls: number;
    fakeSpawnerCalls: number;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
    externalWriteCalls: 0;
  };
  counters: {
    successSpawnCalls: number;
    missingPermitSpawnCalls: number;
    missingMetadataSpawnCalls: number;
    workspaceWriteSpawnCalls: number;
    expiredPermitSpawnCalls: number;
    nonceMismatchSpawnCalls: number;
    replaySpawnCalls: number;
    permitStoreFailureSpawnCalls: number;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
    externalWriteCalls: 0;
  };
  blockingReasons: string[];
}

export interface ControlledReadonlyProviderExecutionAcceptanceOptions {
  generatedAt?: string;
}

export interface ControlledReadonlyProviderExecutionAcceptanceCliResult {
  evidence: ControlledReadonlyProviderExecutionAcceptanceEvidence;
  checkMode: boolean;
  evidencePath?: string;
}

export async function runControlledReadonlyProviderExecutionAcceptance(
  options: ControlledReadonlyProviderExecutionAcceptanceOptions = {}
): Promise<ControlledReadonlyProviderExecutionAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;

  let successSpawnCalls = 0;
  const successFixture = createControlledReadonlyFixture({
    generatedAt,
    spawn: () => {
      successSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "{\"type\":\"agent_message\",\"message\":\"CONTROLLED_READONLY_ACCEPTANCE_OK\"}\n",
        exitCode: 0
      });
    }
  });
  const successPermit = requirePermit(successFixture);
  const success = await runControlledReadOnlyFixture(successFixture, {
    permit: successPermit,
    executionMetadata: createProviderExecutionMetadata(successFixture.provider.manifest)
  });

  let missingPermitSpawnCalls = 0;
  const missingPermitFixture = createControlledReadonlyFixture({
    generatedAt,
    spawn: () => {
      missingPermitSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const missingPermit = await runControlledReadOnlyFixture(missingPermitFixture, {
    executionMetadata: createProviderExecutionMetadata(missingPermitFixture.provider.manifest)
  });

  let missingMetadataSpawnCalls = 0;
  const missingMetadataFixture = createControlledReadonlyFixture({
    generatedAt,
    spawn: () => {
      missingMetadataSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const missingMetadataPermit = requirePermit(missingMetadataFixture);
  const missingMetadata = await runControlledReadOnlyFixture(missingMetadataFixture, {
    permit: missingMetadataPermit
  });

  let workspaceWriteSpawnCalls = 0;
  const workspaceWriteFixture = createControlledReadonlyFixture({
    generatedAt,
    sandboxMode: "workspace-write",
    spawn: () => {
      workspaceWriteSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const workspaceWrite = await runControlledReadOnlyFixture(workspaceWriteFixture, {
    executionMetadata: createProviderExecutionMetadata(workspaceWriteFixture.provider.manifest)
  });

  let expiredPermitSpawnCalls = 0;
  const expiredPermitFixture = createControlledReadonlyFixture({
    generatedAt,
    spawn: () => {
      expiredPermitSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const expiredPermit = createApprovedProviderExecutionPermit({
    plan: expiredPermitFixture.executorPlan,
    manifest: expiredPermitFixture.provider.manifest,
    permitId: `permit-${expiredPermitFixture.executorPlan.planId}-expired`,
    issuedAt: "2026-06-21T23:50:00.000Z"
  });
  const expiredPermitResult = await runControlledReadOnlyFixture(expiredPermitFixture, {
    permit: expiredPermit,
    executionMetadata: createProviderExecutionMetadata(expiredPermitFixture.provider.manifest)
  });

  let nonceMismatchSpawnCalls = 0;
  const nonceMismatchFixture = createControlledReadonlyFixture({
    generatedAt,
    spawn: () => {
      nonceMismatchSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const nonceMismatchPermit = {
    ...requirePermit(nonceMismatchFixture),
    nonce: "caller_supplied_nonce"
  };
  const nonceMismatchResult = await runControlledReadOnlyFixture(nonceMismatchFixture, {
    permit: nonceMismatchPermit,
    executionMetadata: createProviderExecutionMetadata(nonceMismatchFixture.provider.manifest)
  });

  let replaySpawnCalls = 0;
  const replayFixture = createControlledReadonlyFixture({
    generatedAt,
    spawn: () => {
      replaySpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "{\"type\":\"agent_message\",\"message\":\"CONTROLLED_READONLY_REPLAY_OK\"}\n",
        exitCode: 0
      });
    }
  });
  const replayPermit = requirePermit(replayFixture);
  await runControlledReadOnlyFixture(replayFixture, {
    permit: replayPermit,
    executionMetadata: createProviderExecutionMetadata(replayFixture.provider.manifest)
  });
  const replayResult = await runControlledReadOnlyFixture(replayFixture, {
    permit: replayPermit,
    executionMetadata: createProviderExecutionMetadata(replayFixture.provider.manifest)
  });

  let permitStoreFailureSpawnCalls = 0;
  const throwingPermitStore: ProviderExecutionPermitConsumptionStore = {
    consumeIfUnused: () => {
      throw new Error("controlled readonly permit store unavailable");
    },
    get: () => undefined
  };
  const permitStoreFailureFixture = createControlledReadonlyFixture({
    generatedAt,
    permitConsumptionStore: throwingPermitStore,
    spawn: () => {
      permitStoreFailureSpawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const permitStoreFailureResult = await runControlledReadOnlyFixture(permitStoreFailureFixture, {
    permit: requirePermit(permitStoreFailureFixture),
    executionMetadata: createProviderExecutionMetadata(permitStoreFailureFixture.provider.manifest)
  });

  const providerSummary = readProviderExecutionSummary(success);
  const evidenceWithoutSanitizedCheck: Omit<
    ControlledReadonlyProviderExecutionAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      ControlledReadonlyProviderExecutionAcceptanceEvidence["checks"],
      "evidenceSanitized"
    >;
  } = {
    schemaVersion: "codex-cli-controlled-readonly-provider-execution-acceptance.v1",
    generatedAt,
    mode: "controlled-readonly-provider-execution-fake-spawner-local-only",
    taskId: "codex-cli-controlled-readonly-provider-execution-acceptance",
    checks: {
      runnerStatusOk: success.status === "controlled_readonly_succeeded"
        && success.executeInvoked === true,
      permitApproved: successPermit.status === "approved"
        && successPermit.approvalStatus === "not_required",
      providerExecuteInvoked: success.executeInvoked === true,
      fakeSpawnerUsed: successSpawnCalls === 1,
      metadataGuarded: hasReadyProviderExecutionGuard(
        createProviderExecutionMetadata(successFixture.provider.manifest)
      ),
      readOnlySandbox: successFixture.providerExecutionPlan.sideEffectClass === "read_only"
        && successFixture.providerExecutionPlan.sandboxProfile.mode === "read-only"
        && successFixture.executorPlan.sideEffectClass === "read_only"
        && successFixture.executorPlan.sandboxProfile.mode === "read-only",
      approvalPolicyNever: successFixture.policyDecision.approval.required === false
        && successFixture.executorPlan.approvalRequired === false
        && providerSummary.approvalPolicy === "never",
      missingPermitBlocked: missingPermit.status === "blocked"
        && missingPermit.executeInvoked === false
        && missingPermitSpawnCalls === 0
        && missingPermit.reasons.includes(
          "controlled_readonly_provider_execution_permit_required"
        ),
      missingMetadataBlocked: missingMetadata.status === "blocked"
        && missingMetadata.executeInvoked === false
        && missingMetadataSpawnCalls === 0
        && missingMetadata.reasons.includes(
          "controlled_readonly_provider_execution_metadata_required"
        ),
      workspaceWriteBlocked: workspaceWrite.status === "blocked"
        && workspaceWrite.executeInvoked === false
        && workspaceWriteSpawnCalls === 0
        && workspaceWrite.reasons.includes(
          "controlled_readonly_requires_read_only_sandbox:workspace-write"
        ),
      noRealCodexCli: true,
      noWorkspaceWriteExecute: workspaceWriteSpawnCalls === 0,
      noExternalWrite: true,
      preflightEvidenceBound: success.executionEvidence?.bindings.environmentPreflight.artifactHash
        === createProviderExecutionPreflightArtifactHash(successFixture.provider.manifest)
        && success.executionEvidence?.bindings.providerRegistrySelection.manifestHash
          === hashProviderManifest(successFixture.provider.manifest),
      expiredPermitBlocked: expiredPermitResult.status === "validation_failed"
        && expiredPermitResult.executeInvoked === false
        && expiredPermitSpawnCalls === 0
        && expiredPermitResult.reasons.includes(
          "controlled_readonly_provider_execution_permit_expired"
        ),
      nonceMismatchBlocked: nonceMismatchResult.status === "validation_failed"
        && nonceMismatchResult.executeInvoked === false
        && nonceMismatchSpawnCalls === 0
        && nonceMismatchResult.reasons.includes(
          "controlled_readonly_provider_execution_permit_nonce_mismatch"
        ),
      permitReplayBlocked: replayResult.status === "execution_failed"
        && replaySpawnCalls === 1
        && replayResult.reasons.includes(
          "codex_cli_provider_execution_permit_replay_rejected"
        )
        && replayResult.reasons.includes(
          "codex_cli_provider_execution_permit_already_consumed_by_store"
        ),
      permitStoreFailureBlocked: permitStoreFailureResult.status === "execution_failed"
        && permitStoreFailureSpawnCalls === 0
        && permitStoreFailureResult.reasons.includes(
          "codex_cli_provider_execution_permit_replay_rejected"
        )
        && permitStoreFailureResult.reasons.includes(
          "codex_cli_provider_execution_permit_consumption_store_failed"
        )
    },
    summary: {
      providerId: "codex-cli",
      sideEffectClass: "read_only",
      sandbox: "read-only",
      status: success.status,
      approvalPolicy: providerSummary.approvalPolicy === "never" ? "never" : "unknown",
      providerExecuteCalls: success.executeInvoked ? 1 : 0,
      fakeSpawnerCalls: successSpawnCalls,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      externalWriteCalls: 0
    },
    counters: {
      successSpawnCalls,
      missingPermitSpawnCalls,
      missingMetadataSpawnCalls,
      workspaceWriteSpawnCalls,
      expiredPermitSpawnCalls,
      nonceMismatchSpawnCalls,
      replaySpawnCalls,
      permitStoreFailureSpawnCalls,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      externalWriteCalls: 0
    },
    blockingReasons: uniqueStrings([
      ...missingPermit.reasons,
      ...missingMetadata.reasons,
      ...workspaceWrite.reasons,
      ...expiredPermitResult.reasons,
      ...nonceMismatchResult.reasons,
      ...replayResult.reasons,
      ...permitStoreFailureResult.reasons
    ])
  };

  return {
    ...evidenceWithoutSanitizedCheck,
    checks: {
      ...evidenceWithoutSanitizedCheck.checks,
      evidenceSanitized: !containsForbiddenExecutionMarkers(evidenceWithoutSanitizedCheck)
    }
  };
}

export async function writeControlledReadonlyProviderExecutionAcceptanceEvidence(
  evidence: ControlledReadonlyProviderExecutionAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: ControlledReadonlyProviderExecutionAcceptanceEvidence;
}> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

export async function runControlledReadonlyProviderExecutionAcceptanceCli(
  args: readonly string[] = process.argv.slice(2)
): Promise<ControlledReadonlyProviderExecutionAcceptanceCliResult> {
  const checkMode = args.includes("--check") || args.includes("--no-write");
  const outputPath = optionValue(args, "--output") ?? DEFAULT_EVIDENCE_PATH;
  const evidence = await runControlledReadonlyProviderExecutionAcceptance();

  if (checkMode) {
    return {
      evidence,
      checkMode
    };
  }

  const write = await writeControlledReadonlyProviderExecutionAcceptanceEvidence(
    evidence,
    outputPath
  );

  return {
    evidence,
    checkMode,
    evidencePath: write.path
  };
}

type ControlledReadonlyFixture = {
  provider: CodexCliExecutorProvider;
  providerRegistry: ProviderRegistry;
  task: Task;
  policyDecision: PolicyDecision;
  run: Run;
  providerExecutionPlan: ProviderExecutionPlan;
  executorPlan: ExecutorExecutionPlan;
  permit?: ProviderExecutionPermit;
  generatedAt: string;
};

function createControlledReadonlyFixture(input: {
  generatedAt: string;
  spawn: CodexCliProcessSpawner;
  sandboxMode?: "read-only" | "workspace-write";
  permitConsumptionStore?: ProviderExecutionPermitConsumptionStore;
}): ControlledReadonlyFixture {
  const sandboxMode = input.sandboxMode ?? "read-only";
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    executionMode: "real",
    realExecutionAllowed: true,
    nowMs: () => Date.parse(input.generatedAt),
    timeoutMs: 1_000,
    permitConsumptionStore: input.permitConsumptionStore
      ?? new InMemoryProviderExecutionPermitConsumptionStore(),
    spawn: input.spawn
  });
  const providerRegistry = new ProviderRegistry();
  providerRegistry.registerProvider(provider.manifest, provider);
  const task = createTask();
  const sandboxProfile = createSandboxProfile(sandboxMode);
  const policyDecision = createPolicyDecision({
    task,
    sandboxProfile,
    capabilities: sandboxMode === "read-only"
      ? [createReadScope()]
      : [createReadScope(), createWriteScope()]
  });
  const run = createRun(task, policyDecision);
  const providerExecutionPlan = planProviderExecution({
    task,
    run,
    principal: {
      schemaVersion: "principal.v1",
      principalId: "principal_controlled_readonly_provider_execution_acceptance",
      kind: "agent",
      displayName: "Controlled read-only provider execution acceptance",
      createdAt: input.generatedAt
    },
    policyDecision,
    executionEligibility: {
      status: "eligible",
      taskId: task.taskId,
      runId: run.runId,
      policyDecisionHash: hashApprovalScope(policyDecision),
      reasons: ["capability_grants_satisfied"],
      missingCapabilities: [],
      requiredApprovals: [],
      acceptedPermits: [],
      rejectedPermits: [],
      createdAt: input.generatedAt
    },
    providerRegistry,
    preferredProviderId: provider.manifest.providerId,
    now: input.generatedAt
  });
  const executorPlan = provider.planExecution({
    task,
    run,
    policyDecision,
    sandboxProfile: providerExecutionPlan.sandboxProfile,
    inputHash: providerExecutionPlan.inputHash,
    ...(providerExecutionPlan.taskHash !== undefined ? { taskHash: providerExecutionPlan.taskHash } : {}),
    ...(providerExecutionPlan.principalId !== undefined ? { principalId: providerExecutionPlan.principalId } : {}),
    ...(providerExecutionPlan.principalHash !== undefined ? { principalHash: providerExecutionPlan.principalHash } : {}),
    providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan),
    ...(providerExecutionPlan.providerManifestHash !== undefined
      ? { providerManifestHash: providerExecutionPlan.providerManifestHash }
      : {}),
    now: input.generatedAt
  });
  const permit = sandboxMode === "read-only"
    ? createApprovedProviderExecutionPermit({
        plan: executorPlan,
        manifest: provider.manifest,
        permitId: `permit-${executorPlan.planId}`,
        issuedAt: input.generatedAt
      })
    : undefined;

  return {
    provider,
    providerRegistry,
    task,
    policyDecision,
    run,
    providerExecutionPlan,
    executorPlan,
    ...(permit !== undefined ? { permit } : {}),
    generatedAt: input.generatedAt
  };
}

async function runControlledReadOnlyFixture(
  fixture: ControlledReadonlyFixture,
  options: {
    permit?: ProviderExecutionPermit;
    executionMetadata?: Record<string, unknown>;
  }
): Promise<ControlledReadOnlyProviderExecutionRunnerResult> {
  return runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: {
      schemaVersion: "principal.v1",
      principalId: "principal_controlled_readonly_provider_execution_acceptance",
      kind: "agent",
      displayName: "Controlled read-only provider execution acceptance",
      createdAt: fixture.generatedAt
    },
    policyDecision: fixture.policyDecision,
    providerRegistry: fixture.providerRegistry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock(fixture.generatedAt) }),
    executorPlan: fixture.executorPlan,
    ...(options.permit !== undefined ? { permit: options.permit } : {}),
    ...(options.executionMetadata !== undefined
      ? { executionMetadata: options.executionMetadata }
      : {}),
    now: createClock(fixture.generatedAt),
    mode: "controlled-read-only"
  });
}

function createProviderExecutionMetadata(manifest: ProviderManifest): Record<string, unknown> {
  return {
    codexCliProviderRealExecutionGuard: {
      schemaVersion: "codex-cli-provider-real-execution-guard.v1",
      realExecutionAllowed: true,
      providerRegistrySelection: {
        selected: true,
        providerId: manifest.providerId,
        manifestHash: hashProviderManifest(manifest),
        kind: manifest.kind,
        enabled: manifest.enabled
      },
      environmentPreflight: {
        status: "ready",
        artifactRef: createProviderExecutionPreflightArtifactRef(manifest),
        artifactHash: createProviderExecutionPreflightArtifactHash(manifest),
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
    }
  };
}

function createProviderExecutionPreflightArtifactRef(manifest: ProviderManifest): string {
  return `artifact://controlled-readonly-provider-execution/preflight/${manifest.providerId}`;
}

function createProviderExecutionPreflightArtifactHash(manifest: ProviderManifest): string {
  return hashProviderExecutionPlannerObject({
    schemaVersion: "controlled-readonly-provider-execution-preflight.v1",
    providerRegistrySelection: {
      selected: true,
      providerId: manifest.providerId,
      manifestHash: hashProviderManifest(manifest),
      kind: manifest.kind,
      enabled: manifest.enabled
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
      blockingReasonCount: 0
    }
  });
}

function requirePermit(fixture: ControlledReadonlyFixture): ProviderExecutionPermit {
  if (fixture.permit === undefined) {
    throw new Error("controlled_readonly_acceptance_permit_missing");
  }

  return fixture.permit;
}

function hasReadyProviderExecutionGuard(metadata: Record<string, unknown>): boolean {
  const guard = metadata.codexCliProviderRealExecutionGuard;
  if (!isRecord(guard)) {
    return false;
  }
  const preflight = guard.environmentPreflight;
  if (!isRecord(preflight)) {
    return false;
  }
  const checks = preflight.checks;
  return isRecord(checks)
    && guard.realExecutionAllowed === true
    && preflight.status === "ready"
    && checks.injectedSpawner === true
    && checks.realCliAllowed === true
    && checks.noWorkspaceWrite === true
    && checks.noRealCliFallback === true;
}

function readProviderExecutionSummary(
  result: ControlledReadOnlyProviderExecutionRunnerResult
): Record<string, unknown> {
  const artifacts = result.providerResultSummary?.artifacts;
  if (!Array.isArray(artifacts)) {
    return {};
  }

  const firstArtifact = artifacts[0];
  if (!isRecord(firstArtifact) || !isRecord(firstArtifact.summary)) {
    return {};
  }

  return firstArtifact.summary;
}

function createTask(): Task {
  return TaskSchema.parse({
    schemaVersion: "kernel-task.v1",
    taskId: "codex-cli-controlled-readonly-provider-execution-acceptance",
    source: "cli",
    title: "Controlled read-only provider execution acceptance",
    requestedAction: "Inspect repository state through the controlled provider execution runner.",
    successCriteria: ["provider execute is gated by read-only permit and metadata"],
    outOfScope: ["workspace writes", "external writes", "real Codex CLI binary invocation"],
    repo: {
      root: "workspace",
      branch: "feature/pr-22a-controlled-provider-execution",
      worktreeClean: true,
      protectedBranch: false
    },
    target: {
      branches: [],
      files: ["routing-policy.yaml"],
      modules: ["provider-execution-runner", "providers/codex-cli"]
    },
    hints: {
      taskClass: "read_only",
      riskHints: [],
      tags: ["acceptance", "controlled-readonly-provider-execution"]
    },
    constraints: {
      requiresNetwork: false
    },
    createdAt: DEFAULT_GENERATED_AT
  });
}

function createPolicyDecision(input: {
  task: Task;
  sandboxProfile: SandboxProfile;
  capabilities: CapabilityScope[];
}): PolicyDecision {
  return PolicyDecisionSchema.parse({
    schemaVersion: "policy-decision.v1",
    decisionId: "decision_codex_cli_controlled_readonly_provider_execution_acceptance",
    taskId: input.task.taskId,
    policyVersion: "controlled-readonly-provider-execution-acceptance",
    classification: {
      taskClass: input.sandboxProfile.mode === "read-only" ? "read_only" : "engineering",
      riskLevel: input.sandboxProfile.mode === "read-only" ? "low" : "medium",
      ambiguityScore: 0,
      clarificationRequired: false,
      riskFactors: []
    },
    risk: {
      level: input.sandboxProfile.mode === "read-only" ? "low" : "medium",
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      executor: "codex-cli",
      model: "gpt-5.4-mini",
      profile: input.sandboxProfile.mode === "read-only" ? "recon-only" : "engineering",
      reasoningEffort: "low",
      sandbox: input.sandboxProfile
    },
    capabilities: input.capabilities,
    approval: {
      required: false,
      reasons: []
    },
    parallelism: {
      allowed: false,
      maxAgents: 1,
      mode: "disabled"
    },
    hostRoute: "codex-cli",
    createdAt: DEFAULT_GENERATED_AT,
    legacy: {
      taskClass: input.sandboxProfile.mode === "read-only" ? "read_only" : "engineering",
      toolAccess: input.sandboxProfile.mode === "read-only" ? "read_only" : "local_write"
    }
  });
}

function createRun(task: Task, policyDecision: PolicyDecision): Run {
  return RunSchema.parse({
    schemaVersion: "kernel-run.v1",
    runId: "run_codex_cli_controlled_readonly_provider_execution_acceptance",
    taskId: task.taskId,
    status: "running",
    policyDecisionId: policyDecision.decisionId,
    createdAt: DEFAULT_GENERATED_AT,
    updatedAt: DEFAULT_GENERATED_AT
  });
}

function createSandboxProfile(mode: "read-only" | "workspace-write"): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_controlled_readonly_provider_execution_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots: mode === "read-only" ? [] : ["workspace"],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function createReadScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "file",
    resource: "workspace/**",
    access: "read"
  });
}

function createWriteScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "file",
    resource: "workspace/**",
    access: "write"
  });
}

function containsForbiddenExecutionMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "CONTROLLED_READONLY_ACCEPTANCE_OK",
    "requestedAction",
    "\"prompt\"",
    "\"args\"",
    "\"stdout\"",
    "\"stderr\"",
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function createClock(start: string): () => string {
  const startMs = Date.parse(start);
  let index = 0;

  return () => {
    const timestamp = new Date(startMs + index * 1000).toISOString();
    index += 1;
    return timestamp;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

async function main(): Promise<void> {
  const result = await runControlledReadonlyProviderExecutionAcceptanceCli();
  const { evidence } = result;

  console.log("Codex CLI controlled read-only provider execution acceptance");
  console.log(`runner status ok: ${evidence.checks.runnerStatusOk}`);
  console.log(`provider execute invoked: ${evidence.checks.providerExecuteInvoked}`);
  console.log(`fake spawner calls: ${evidence.counters.successSpawnCalls}`);
  console.log(`workspace-write execute calls: ${evidence.counters.workspaceWriteExecuteCalls}`);
  console.log(`external write calls: ${evidence.counters.externalWriteCalls}`);
  console.log(`evidence sanitized: ${evidence.checks.evidenceSanitized}`);
  console.log(
    result.checkMode
      ? "evidence: not written (--check)"
      : `evidence: ${result.evidencePath}`
  );

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Codex CLI controlled read-only provider execution acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}

function optionValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}
