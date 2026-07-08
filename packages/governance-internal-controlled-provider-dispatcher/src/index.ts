import { z } from "zod";
import {
  hashProviderExecutionPlannerObject,
  ProviderExecutionPlanSchema,
  type ProviderExecutionPlan
} from "../../execution-planner/src/index.js";
import type {
  ArtifactStore
} from "../../artifact-store/src/index.js";
import type {
  ExecutionObservationBus
} from "../../governance-internal-execution-observation/src/index.js";
import {
  routeStrategyV2,
  type StrategyDecisionV2
} from "../../governance-internal-strategy-router/src/index.js";
import {
  runProviderExecutionPlanControlledReadOnly,
  type ControlledReadOnlyProviderExecutionRunnerResult
} from "../../governance-internal-provider-execution-runner/src/index.js";
import {
  parseGovernanceState,
  type GovernanceState
} from "../../governance-internal-state-manager/src/index.js";
import {
  parseTaskEnvelope,
  type TaskEnvelopeInput
} from "../../contracts/src/index.js";
import {
  PolicyDecisionSchema,
  PrincipalSchema,
  RunSchema,
  TaskSchema,
  type PolicyDecision,
  type Principal,
  type Run,
  type Task
} from "../../kernel-contracts/src/index.js";
import type {
  KernelStore
} from "../../kernel-store/src/index.js";
import {
  ExecutorExecutionPlanSchema,
  ProviderExecutionPermitSchema,
  hashProviderManifest,
  validateProviderExecutionPermitForPlan,
  type ExecutorExecutionPlan,
  type ProviderExecutionPermit,
  type ProviderManifest
} from "../../provider-core/src/index.js";
import {
  summarizeProviderSelectionResult,
  type ProviderRegistry,
  type ProviderSelectionSummary
} from "../../provider-registry/src/index.js";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const ControlledReadOnlyDispatchPreflightChecksSchema = z.object({
  injectedSpawner: z.literal(true),
  realCliAllowed: z.literal(true),
  versionProbe: z.string().min(1),
  noTaskEnvelope: z.literal(true),
  noPromptSent: z.literal(true),
  noWorkspaceWrite: z.literal(true),
  noRealCliFallback: z.literal(true)
});

export type ControlledReadOnlyDispatchPreflightChecks = z.infer<
  typeof ControlledReadOnlyDispatchPreflightChecksSchema
>;

export const ControlledReadOnlyDispatchEnvironmentPreflightSchema = z.object({
  status: z.literal("ready"),
  artifactRef: z.string().min(1),
  artifactHash: Sha256Schema,
  checks: ControlledReadOnlyDispatchPreflightChecksSchema,
  blockingReasons: z.array(z.string().min(1)).default([])
});

export type ControlledReadOnlyDispatchEnvironmentPreflight = z.infer<
  typeof ControlledReadOnlyDispatchEnvironmentPreflightSchema
>;

export const ControlledReadOnlyProviderDispatchPreflightSchema = z.object({
  schemaVersion: z.literal("controlled-provider-execution-dispatch-preflight.v1"),
  mode: z.literal("controlled-read-only"),
  providerExecutionPlanHash: Sha256Schema,
  runnerRealExecutionGuardRequired: z.literal(true),
  providerRegistrySelectionRequired: z.literal(true),
  permitRequired: z.literal(true),
  preflightArtifactBindingRequired: z.literal(true),
  dryRunDefaultPreserved: z.literal(true),
  environmentPreflight: ControlledReadOnlyDispatchEnvironmentPreflightSchema
});

export type ControlledReadOnlyProviderDispatchPreflight = z.infer<
  typeof ControlledReadOnlyProviderDispatchPreflightSchema
>;

export type RunControlledReadOnlyProviderDispatchInput = {
  providerExecutionPlan: ProviderExecutionPlan;
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision;
  providerRegistry: ProviderRegistry;
  kernelStore: KernelStore;
  artifactStore: ArtifactStore;
  permit: ProviderExecutionPermit;
  executorPlan: ExecutorExecutionPlan;
  dispatchPreflight: ControlledReadOnlyProviderDispatchPreflight;
  governanceState: GovernanceState;
  taskEnvelope: TaskEnvelopeInput;
  proposedInput?: unknown;
  observationBus?: ExecutionObservationBus;
  onGovernanceUpdate?: (
    state: GovernanceState,
    strategy: StrategyDecisionV2
  ) => Promise<void>;
  now: () => string;
};

export type ControlledReadOnlyProviderDispatchReady = {
  schemaVersion: "controlled-provider-execution-dispatch-review.v1";
  status: "dispatch_ready";
  runnerInvoked: false;
  executeInvoked: false;
  reasons: string[];
  providerExecutionPlanHash: string;
  executorPlanHash: string;
  providerRegistrySelection: ProviderSelectionSummary;
  executionMetadata: Record<string, unknown>;
};

export type ControlledReadOnlyProviderDispatchBlocked = {
  schemaVersion: "controlled-provider-execution-dispatch-result.v1";
  status: "dispatch_blocked";
  runnerInvoked: false;
  executeInvoked: false;
  reasons: string[];
  providerExecutionPlanHash: string;
  executorPlanHash: string;
  providerRegistrySelection: ProviderSelectionSummary;
};

export type ControlledReadOnlyProviderDispatchCompleted = {
  schemaVersion: "controlled-provider-execution-dispatch-result.v1";
  status: "runner_completed";
  runnerInvoked: true;
  executeInvoked: boolean;
  reasons: string[];
  providerExecutionPlanHash: string;
  executorPlanHash: string;
  providerRegistrySelection: ProviderSelectionSummary;
  runnerResult: ControlledReadOnlyProviderExecutionRunnerResult;
};

export type ControlledReadOnlyProviderDispatchResult =
  | ControlledReadOnlyProviderDispatchBlocked
  | ControlledReadOnlyProviderDispatchCompleted;

export function createControlledReadOnlyProviderDispatchPreflight(input: {
  providerExecutionPlan: ProviderExecutionPlan;
  environmentChecks?: Partial<ControlledReadOnlyDispatchPreflightChecks> & {
    versionProbe?: string;
  };
}): ControlledReadOnlyProviderDispatchPreflight {
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse(
    input.providerExecutionPlan
  );
  const checks = ControlledReadOnlyDispatchPreflightChecksSchema.parse({
    injectedSpawner: true,
    realCliAllowed: true,
    versionProbe: input.environmentChecks?.versionProbe ?? "passed",
    noTaskEnvelope: true,
    noPromptSent: true,
    noWorkspaceWrite: true,
    noRealCliFallback: true,
    ...input.environmentChecks
  });
  const providerExecutionPlanHash =
    hashProviderExecutionPlannerObject(providerExecutionPlan);
  const environmentPreflight = createEnvironmentPreflight({
    providerId: providerExecutionPlan.providerId,
    providerKind: providerExecutionPlan.providerKind,
    checks,
    ...(providerExecutionPlan.providerManifestHash !== undefined
      ? { manifestHash: providerExecutionPlan.providerManifestHash }
      : {})
  });

  return ControlledReadOnlyProviderDispatchPreflightSchema.parse({
    schemaVersion: "controlled-provider-execution-dispatch-preflight.v1",
    mode: "controlled-read-only",
    providerExecutionPlanHash,
    runnerRealExecutionGuardRequired: true,
    providerRegistrySelectionRequired: true,
    permitRequired: true,
    preflightArtifactBindingRequired: true,
    dryRunDefaultPreserved: true,
    environmentPreflight
  });
}

export function reviewControlledReadOnlyProviderDispatch(
  input: RunControlledReadOnlyProviderDispatchInput
): ControlledReadOnlyProviderDispatchReady | ControlledReadOnlyProviderDispatchBlocked {
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse(
    input.providerExecutionPlan
  );
  const task = TaskSchema.parse(input.task);
  const run = RunSchema.parse(input.run);
  const principal = PrincipalSchema.parse(input.principal);
  const policyDecision = PolicyDecisionSchema.parse(input.policyDecision);
  const executorPlan = ExecutorExecutionPlanSchema.parse(input.executorPlan);
  const permit = ProviderExecutionPermitSchema.parse(input.permit);
  const dispatchPreflight = ControlledReadOnlyProviderDispatchPreflightSchema.parse(
    input.dispatchPreflight
  );
  const governanceState = parseGovernanceState(input.governanceState);
  const taskEnvelope = parseTaskEnvelope(input.taskEnvelope);
  const providerExecutionPlanHash =
    hashProviderExecutionPlannerObject(providerExecutionPlan);
  const executorPlanHash = hashProviderExecutionPlannerObject(executorPlan);
  const providerEntry = input.providerRegistry.getProvider(
    providerExecutionPlan.providerId
  );
  const selection = input.providerRegistry.select({
    providerId: providerExecutionPlan.providerId,
    kind: "executor",
    requiredSandboxProfile: providerExecutionPlan.sandboxProfile,
    requiredSideEffectClass: "read_only",
    ...(providerExecutionPlan.providerManifestHash !== undefined
      ? { expectedManifestHash: providerExecutionPlan.providerManifestHash }
      : {}),
    requireEnabled: true
  });
  const providerRegistrySelection = summarizeProviderSelectionResult(selection);
  const strategyDecision = routeStrategyV2({
    state: governanceState,
    now: input.now
  });
  const reasons = uniqueStrings([
    ...collectPlanReasons({
      providerExecutionPlan,
      task,
      run,
      principal,
      policyDecision,
      executorPlan
    }),
    ...collectDispatchPreflightReasons({
      dispatchPreflight,
      providerExecutionPlan,
      providerExecutionPlanHash,
      providerRegistrySelection
    }),
    ...collectGovernanceReasons({
      governanceState,
      task,
      taskEnvelope,
      strategyDecision
    }),
    ...collectProviderSelectionReasons({
      providerRegistrySelection,
      ...(providerEntry !== undefined
        ? { providerEntryManifestHash: hashProviderManifest(providerEntry.manifest) }
        : {})
    }),
    ...collectPermitReasons({
      permit,
      executorPlan,
      now: input.now(),
      ...(providerEntry !== undefined
        ? { providerEntryManifest: providerEntry.manifest }
        : {})
    })
  ]);

  if (reasons.length > 0) {
    return {
      schemaVersion: "controlled-provider-execution-dispatch-result.v1",
      status: "dispatch_blocked",
      runnerInvoked: false,
      executeInvoked: false,
      reasons,
      providerExecutionPlanHash,
      executorPlanHash,
      providerRegistrySelection
    };
  }

  const executionMetadata = {
    codexCliProviderRealExecutionGuard: {
      schemaVersion: "codex-cli-provider-real-execution-guard.v1",
      realExecutionAllowed: true,
      providerRegistrySelection: {
        selected: true,
        providerId: providerRegistrySelection.providerId,
        manifestHash: providerRegistrySelection.manifestHash,
        kind: providerRegistrySelection.kind,
        enabled: providerRegistrySelection.enabled
      },
      environmentPreflight: dispatchPreflight.environmentPreflight
    }
  };

  return {
    schemaVersion: "controlled-provider-execution-dispatch-review.v1",
    status: "dispatch_ready",
    runnerInvoked: false,
    executeInvoked: false,
    reasons: ["controlled_readonly_provider_dispatch_ready"],
    providerExecutionPlanHash,
    executorPlanHash,
    providerRegistrySelection,
    executionMetadata
  };
}

export async function dispatchControlledReadOnlyProviderExecution(
  input: RunControlledReadOnlyProviderDispatchInput
): Promise<ControlledReadOnlyProviderDispatchResult> {
  const review = reviewControlledReadOnlyProviderDispatch(input);
  if (review.status === "dispatch_blocked") {
    return review;
  }

  const runnerResult = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: input.providerExecutionPlan,
    task: input.task,
    run: input.run,
    principal: input.principal,
    policyDecision: input.policyDecision,
    providerRegistry: input.providerRegistry,
    kernelStore: input.kernelStore,
    artifactStore: input.artifactStore,
    permit: input.permit,
    executorPlan: input.executorPlan,
    executionMetadata: review.executionMetadata,
    governanceState: input.governanceState,
    taskEnvelope: input.taskEnvelope,
    ...(input.proposedInput !== undefined ? { proposedInput: input.proposedInput } : {}),
    ...(input.observationBus !== undefined ? { observationBus: input.observationBus } : {}),
    ...(input.onGovernanceUpdate !== undefined
      ? { onGovernanceUpdate: input.onGovernanceUpdate }
      : {}),
    now: input.now,
    mode: "controlled-read-only"
  });

  return {
    schemaVersion: "controlled-provider-execution-dispatch-result.v1",
    status: "runner_completed",
    runnerInvoked: true,
    executeInvoked: runnerResult.executeInvoked,
    reasons: uniqueStrings([
      "controlled_readonly_provider_dispatch_runner_completed",
      ...runnerResult.reasons
    ]),
    providerExecutionPlanHash: review.providerExecutionPlanHash,
    executorPlanHash: review.executorPlanHash,
    providerRegistrySelection: review.providerRegistrySelection,
    runnerResult
  };
}

function collectPlanReasons(input: {
  providerExecutionPlan: ProviderExecutionPlan;
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision;
  executorPlan: ExecutorExecutionPlan;
}): string[] {
  const reasons: string[] = [];
  const { providerExecutionPlan, task, run, principal, policyDecision, executorPlan } = input;

  if (providerExecutionPlan.status !== "planned") {
    reasons.push(`controlled_readonly_dispatch_plan_not_planned:${providerExecutionPlan.status}`);
  }
  if (providerExecutionPlan.providerId !== "codex-cli") {
    reasons.push("controlled_readonly_dispatch_requires_codex_cli_provider");
  }
  if (providerExecutionPlan.providerKind !== "executor") {
    reasons.push(`controlled_readonly_dispatch_requires_executor_provider:${providerExecutionPlan.providerKind}`);
  }
  if (providerExecutionPlan.sideEffectClass !== "read_only") {
    reasons.push(`controlled_readonly_dispatch_requires_read_only_side_effect:${providerExecutionPlan.sideEffectClass}`);
  }
  if (providerExecutionPlan.sandboxProfile.mode !== "read-only") {
    reasons.push(`controlled_readonly_dispatch_requires_read_only_sandbox:${providerExecutionPlan.sandboxProfile.mode}`);
  }
  if (providerExecutionPlan.sandboxProfile.writableRoots.length > 0) {
    reasons.push("controlled_readonly_dispatch_requires_no_writable_roots");
  }
  if (policyDecision.approval.required !== false) {
    reasons.push("controlled_readonly_dispatch_requires_approval_policy_never");
  }
  if (providerExecutionPlan.taskId !== task.taskId) {
    reasons.push(`controlled_readonly_dispatch_task_mismatch:${providerExecutionPlan.taskId}:${task.taskId}`);
  }
  if (providerExecutionPlan.runId !== run.runId || run.taskId !== task.taskId) {
    reasons.push("controlled_readonly_dispatch_run_binding_mismatch");
  }
  if (providerExecutionPlan.principalId !== principal.principalId) {
    reasons.push("controlled_readonly_dispatch_principal_mismatch");
  }
  if (providerExecutionPlan.policyDecisionHash !== hashProviderExecutionPlannerObject(policyDecision)) {
    reasons.push("controlled_readonly_dispatch_policy_hash_mismatch");
  }
  if (executorPlan.providerExecutionPlanHash !== hashProviderExecutionPlannerObject(providerExecutionPlan)) {
    reasons.push("controlled_readonly_dispatch_executor_plan_hash_mismatch");
  }
  if (executorPlan.providerId !== providerExecutionPlan.providerId) {
    reasons.push("controlled_readonly_dispatch_executor_provider_mismatch");
  }
  if (executorPlan.sideEffectClass !== "read_only") {
    reasons.push(`controlled_readonly_dispatch_executor_requires_read_only_side_effect:${executorPlan.sideEffectClass}`);
  }
  if (executorPlan.sandboxProfile.mode !== "read-only") {
    reasons.push(`controlled_readonly_dispatch_executor_requires_read_only_sandbox:${executorPlan.sandboxProfile.mode}`);
  }
  if (executorPlan.approvalRequired !== false) {
    reasons.push("controlled_readonly_dispatch_executor_requires_approval_policy_never");
  }

  return uniqueStrings(reasons);
}

function collectDispatchPreflightReasons(input: {
  dispatchPreflight: ControlledReadOnlyProviderDispatchPreflight;
  providerExecutionPlan: ProviderExecutionPlan;
  providerExecutionPlanHash: string;
  providerRegistrySelection: ProviderSelectionSummary;
}): string[] {
  const reasons: string[] = [];
  const expectedPreflight = createEnvironmentPreflight({
    providerId: input.providerExecutionPlan.providerId,
    providerKind: input.providerExecutionPlan.providerKind,
    checks: input.dispatchPreflight.environmentPreflight.checks,
    ...(input.providerExecutionPlan.providerManifestHash !== undefined
      ? { manifestHash: input.providerExecutionPlan.providerManifestHash }
      : {})
  });

  if (input.dispatchPreflight.providerExecutionPlanHash !== input.providerExecutionPlanHash) {
    reasons.push("controlled_readonly_dispatch_provider_execution_plan_hash_mismatch");
  }
  if (input.dispatchPreflight.environmentPreflight.blockingReasons.length > 0) {
    reasons.push("controlled_readonly_dispatch_environment_preflight_blocked");
  }
  if (input.dispatchPreflight.environmentPreflight.artifactRef !== expectedPreflight.artifactRef) {
    reasons.push("controlled_readonly_dispatch_environment_preflight_artifact_ref_mismatch");
  }
  if (input.dispatchPreflight.environmentPreflight.artifactHash !== expectedPreflight.artifactHash) {
    reasons.push("controlled_readonly_dispatch_environment_preflight_artifact_hash_mismatch");
  }
  if (input.providerRegistrySelection.selected !== true) {
    reasons.push("controlled_readonly_dispatch_provider_registry_selection_required");
  }

  return uniqueStrings(reasons);
}

function collectGovernanceReasons(input: {
  governanceState: GovernanceState;
  task: Task;
  taskEnvelope: ReturnType<typeof parseTaskEnvelope>;
  strategyDecision: StrategyDecisionV2;
}): string[] {
  const reasons: string[] = [];

  if (input.governanceState.taskId !== input.task.taskId) {
    reasons.push("controlled_readonly_dispatch_governance_state_task_mismatch");
  }
  if (input.taskEnvelope.taskId !== input.task.taskId) {
    reasons.push("controlled_readonly_dispatch_task_envelope_mismatch");
  }
  if (
    input.governanceState.phase === "recovery" ||
    input.governanceState.phase === "closed"
  ) {
    reasons.push(`controlled_readonly_dispatch_governance_phase_blocked:${input.governanceState.phase}`);
  }
  if (
    input.strategyDecision.actionFamily === "step_back" ||
    input.strategyDecision.actionFamily === "abort" ||
    input.strategyDecision.actionFamily === "simulate" ||
    input.strategyDecision.agentBudget.executor === 0
  ) {
    reasons.push(`controlled_readonly_dispatch_governance_strategy_blocked:${input.strategyDecision.actionFamily}`);
  }

  return uniqueStrings(reasons);
}

function collectProviderSelectionReasons(input: {
  providerRegistrySelection: ProviderSelectionSummary;
  providerEntryManifestHash?: string;
}): string[] {
  const reasons = [...input.providerRegistrySelection.reasons];

  if (input.providerRegistrySelection.selected !== true) {
    reasons.push("controlled_readonly_dispatch_provider_not_selected");
  }
  if (input.providerRegistrySelection.providerId !== "codex-cli") {
    reasons.push("controlled_readonly_dispatch_provider_selection_mismatch");
  }
  if (input.providerRegistrySelection.kind !== "executor") {
    reasons.push("controlled_readonly_dispatch_provider_selection_kind_mismatch");
  }
  if (input.providerRegistrySelection.enabled !== true) {
    reasons.push("controlled_readonly_dispatch_provider_selection_disabled");
  }
  if (
    input.providerEntryManifestHash !== undefined &&
    input.providerRegistrySelection.manifestHash !== input.providerEntryManifestHash
  ) {
    reasons.push("controlled_readonly_dispatch_provider_manifest_hash_mismatch");
  }

  return uniqueStrings(reasons);
}

function collectPermitReasons(input: {
  permit: ProviderExecutionPermit;
  executorPlan: ExecutorExecutionPlan;
  providerEntryManifest?: ProviderManifest;
  now: string;
}): string[] {
  if (input.providerEntryManifest === undefined) {
    return ["controlled_readonly_dispatch_provider_manifest_required"];
  }

  return validateProviderExecutionPermitForPlan(
    input.permit,
    input.executorPlan,
    input.providerEntryManifest,
    {
      reasonPrefix: "controlled_readonly_dispatch_permit",
      now: input.now
    }
  );
}

function createEnvironmentPreflight(input: {
  providerId: string;
  manifestHash?: string;
  providerKind: string;
  checks: ControlledReadOnlyDispatchPreflightChecks;
}): ControlledReadOnlyDispatchEnvironmentPreflight {
  const manifestHash = input.manifestHash ?? "0".repeat(64);
  const artifactRef =
    `artifact://controlled-readonly-provider-execution/preflight/${input.providerId}`;
  const artifactHash = hashProviderExecutionPlannerObject({
    schemaVersion: "controlled-readonly-provider-execution-preflight.v1",
    providerRegistrySelection: {
      selected: true,
      providerId: input.providerId,
      manifestHash,
      kind: input.providerKind,
      enabled: true
    },
    environmentPreflight: {
      status: "ready",
      checks: input.checks,
      blockingReasonCount: 0
    }
  });

  return ControlledReadOnlyDispatchEnvironmentPreflightSchema.parse({
    status: "ready",
    artifactRef,
    artifactHash,
    checks: input.checks,
    blockingReasons: []
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
