import { z } from "zod";
import {
  capabilityScopeToCanonicalString
} from "../../capability/src/index.js";
import {
  hashProviderExecutionPlannerObject,
  ProviderExecutionPlanSchema,
  type ProviderExecutionPlan
} from "../../execution-planner/src/index.js";
import type {
  ArtifactStore,
  StoredArtifact
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
  type TaskClass,
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
  type ProviderManifest,
  type ProviderSideEffectClass
} from "../../provider-core/src/index.js";
import {
  summarizeProviderSelectionResult,
  type ProviderRegistry,
  type ProviderSelectionSummary
} from "../../provider-registry/src/index.js";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const GovernanceTaskClassHints = new Set<TaskClass>([
  "read_only",
  "small_edit",
  "engineering",
  "high_risk",
  "release_external_action"
]);

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

export type RecordControlledReadOnlyProviderDispatchPreflightArtifactInput = {
  artifactStore: ArtifactStore;
  dispatchPreflight: ControlledReadOnlyProviderDispatchPreflight;
  providerExecutionPlan: ProviderExecutionPlan;
  executorPlan: ExecutorExecutionPlan;
  policyDecision: PolicyDecision;
  task: Task;
  run: Run;
  now?: () => string;
};

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

export async function recordControlledReadOnlyProviderDispatchPreflightArtifact(
  input: RecordControlledReadOnlyProviderDispatchPreflightArtifactInput
): Promise<StoredArtifact> {
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse(
    input.providerExecutionPlan
  );
  const executorPlan = ExecutorExecutionPlanSchema.parse(input.executorPlan);
  const policyDecision = PolicyDecisionSchema.parse(input.policyDecision);
  const task = TaskSchema.parse(input.task);
  const run = RunSchema.parse(input.run);
  const dispatchPreflight = ControlledReadOnlyProviderDispatchPreflightSchema.parse(
    input.dispatchPreflight
  );
  const providerExecutionPlanHash =
    hashProviderExecutionPlannerObject(providerExecutionPlan);
  const executorPlanHash = hashProviderExecutionPlannerObject(executorPlan);
  const policyDecisionHash = hashProviderExecutionPlannerObject(policyDecision);
  const artifactId = dispatchPreflightArtifactId(
    dispatchPreflight.environmentPreflight.artifactRef
  );
  const binding = createDispatchPreflightArtifactBinding({
    dispatchPreflight,
    providerExecutionPlan,
    providerExecutionPlanHash,
    executorPlanHash,
    policyDecisionHash,
    task,
    run
  });

  return input.artifactStore.putArtifact({
    artifactId,
    taskId: task.taskId,
    runId: run.runId,
    type: "json",
    payload: {
      schemaVersion: "controlled-provider-execution-dispatch-preflight-artifact.v1",
      binding,
      checks: dispatchPreflight.environmentPreflight.checks,
      blockingReasonCount:
        dispatchPreflight.environmentPreflight.blockingReasons.length
    },
    metadata: {
      controlledReadOnlyDispatchPreflight: binding
    },
    provenance: {
      source: "controlled-provider-dispatcher"
    },
    ...(input.now !== undefined ? { createdAt: input.now() } : {}),
    alreadyRedacted: true
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
    requiredCapabilities: providerExecutionPlan.requiredCapabilities,
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
    ...collectExecutorPlanInvariantReasons({
      providerExecutionPlan,
      executorPlan
    }),
    ...collectExecutorApprovalPolicyReasons({
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

  const artifactStoreReasons = await collectDispatchPreflightArtifactStoreReasons({
    artifactStore: input.artifactStore,
    dispatchPreflight: input.dispatchPreflight,
    providerExecutionPlan: input.providerExecutionPlan,
    executorPlan: input.executorPlan,
    policyDecision: input.policyDecision,
    task: input.task,
    run: input.run,
    providerExecutionPlanHash: review.providerExecutionPlanHash,
    executorPlanHash: review.executorPlanHash
  });
  if (artifactStoreReasons.length > 0) {
    return {
      schemaVersion: "controlled-provider-execution-dispatch-result.v1",
      status: "dispatch_blocked",
      runnerInvoked: false,
      executeInvoked: false,
      reasons: artifactStoreReasons,
      providerExecutionPlanHash: review.providerExecutionPlanHash,
      executorPlanHash: review.executorPlanHash,
      providerRegistrySelection: review.providerRegistrySelection
    };
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
  if (providerExecutionPlan.providerManifestHash === undefined) {
    reasons.push("controlled_readonly_dispatch_provider_manifest_hash_required");
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
  if (providerExecutionPlan.requiredApprovals.length > 0) {
    reasons.push("controlled_readonly_dispatch_provider_plan_required_approvals_present");
  }
  if (providerExecutionPlan.taskId !== task.taskId) {
    reasons.push(`controlled_readonly_dispatch_task_mismatch:${providerExecutionPlan.taskId}:${task.taskId}`);
  }
  const expectedTaskHash = hashProviderExecutionPlannerObject(task);
  if (providerExecutionPlan.taskHash === undefined) {
    reasons.push("controlled_readonly_dispatch_task_hash_required");
  } else if (providerExecutionPlan.taskHash !== expectedTaskHash) {
    reasons.push("controlled_readonly_dispatch_task_hash_mismatch");
  }
  if (providerExecutionPlan.runId !== run.runId || run.taskId !== task.taskId) {
    reasons.push("controlled_readonly_dispatch_run_binding_mismatch");
  }
  if (run.status !== "running") {
    reasons.push(`controlled_readonly_dispatch_run_not_running:${run.status}`);
  }
  if (policyDecision.taskId !== task.taskId) {
    reasons.push(`controlled_readonly_dispatch_policy_task_mismatch:${policyDecision.taskId}:${task.taskId}`);
  }
  if (
    run.policyDecisionId !== undefined &&
    run.policyDecisionId !== policyDecision.decisionId
  ) {
    reasons.push(
      `controlled_readonly_dispatch_run_policy_decision_mismatch:${run.policyDecisionId}:${policyDecision.decisionId}`
    );
  }
  if (providerExecutionPlan.principalId !== principal.principalId) {
    reasons.push("controlled_readonly_dispatch_principal_mismatch");
  }
  const expectedPrincipalHash = hashProviderExecutionPlannerObject(principal);
  if (providerExecutionPlan.principalHash === undefined) {
    reasons.push("controlled_readonly_dispatch_principal_hash_required");
  } else if (providerExecutionPlan.principalHash !== expectedPrincipalHash) {
    reasons.push("controlled_readonly_dispatch_principal_hash_mismatch");
  }
  if (providerExecutionPlan.policyDecisionHash !== hashProviderExecutionPlannerObject(policyDecision)) {
    reasons.push("controlled_readonly_dispatch_policy_hash_mismatch");
  }
  if (executorPlan.providerExecutionPlanHash !== hashProviderExecutionPlannerObject(providerExecutionPlan)) {
    reasons.push("controlled_readonly_dispatch_executor_plan_hash_mismatch");
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
  reasons.push(...collectProviderPlanPolicyInvariantReasons({
    providerExecutionPlan,
    policyDecision
  }));

  return uniqueStrings(reasons);
}

function collectProviderPlanPolicyInvariantReasons(input: {
  providerExecutionPlan: ProviderExecutionPlan;
  policyDecision: PolicyDecision;
}): string[] {
  const reasons: string[] = [];
  const expectedSandboxProfile = input.policyDecision.execution.sandbox;
  const expectedRequiredCapabilities = input.policyDecision.capabilities.map(
    capabilityScopeToCanonicalString
  );
  const expectedSideEffectClass = resolvePolicySideEffectClass(input.policyDecision);

  if (
    hashProviderExecutionPlannerObject(input.providerExecutionPlan.sandboxProfile)
    !== hashProviderExecutionPlannerObject(expectedSandboxProfile)
  ) {
    reasons.push("controlled_readonly_dispatch_provider_plan_sandbox_profile_policy_mismatch");
  }

  if (!equalStringSets(
    input.providerExecutionPlan.requiredCapabilities,
    expectedRequiredCapabilities
  )) {
    reasons.push("controlled_readonly_dispatch_provider_plan_required_capabilities_policy_mismatch");
  }

  if (input.providerExecutionPlan.sideEffectClass !== expectedSideEffectClass) {
    reasons.push(
      `controlled_readonly_dispatch_provider_plan_side_effect_class_policy_mismatch:${input.providerExecutionPlan.sideEffectClass}:${expectedSideEffectClass}`
    );
  }

  return uniqueStrings(reasons);
}

function collectExecutorPlanInvariantReasons(input: {
  providerExecutionPlan: ProviderExecutionPlan;
  executorPlan: ExecutorExecutionPlan;
}): string[] {
  const reasons: string[] = [];
  const { providerExecutionPlan, executorPlan } = input;

  if (executorPlan.taskId !== providerExecutionPlan.taskId) {
    reasons.push(
      `controlled_readonly_dispatch_executor_plan_task_mismatch:${executorPlan.taskId}:${providerExecutionPlan.taskId}`
    );
  }
  if (executorPlan.taskHash !== providerExecutionPlan.taskHash) {
    reasons.push("controlled_readonly_dispatch_executor_plan_task_hash_mismatch");
  }
  if (executorPlan.runId !== providerExecutionPlan.runId) {
    reasons.push(
      `controlled_readonly_dispatch_executor_plan_run_mismatch:${executorPlan.runId}:${providerExecutionPlan.runId}`
    );
  }
  if (executorPlan.principalId !== providerExecutionPlan.principalId) {
    reasons.push("controlled_readonly_dispatch_executor_plan_principal_mismatch");
  }
  if (executorPlan.principalHash !== providerExecutionPlan.principalHash) {
    reasons.push("controlled_readonly_dispatch_executor_plan_principal_hash_mismatch");
  }
  if (executorPlan.providerId !== providerExecutionPlan.providerId) {
    reasons.push(
      `controlled_readonly_dispatch_executor_plan_provider_mismatch:${executorPlan.providerId}:${providerExecutionPlan.providerId}`
    );
  }
  const expectedProviderExecutionPlanHash =
    hashProviderExecutionPlannerObject(providerExecutionPlan);
  if (executorPlan.providerExecutionPlanHash !== expectedProviderExecutionPlanHash) {
    reasons.push("controlled_readonly_dispatch_executor_plan_provider_execution_plan_hash_mismatch");
  }
  if (
    providerExecutionPlan.providerManifestHash !== undefined &&
    executorPlan.providerManifestHash !== providerExecutionPlan.providerManifestHash
  ) {
    reasons.push("controlled_readonly_dispatch_executor_plan_provider_manifest_hash_mismatch");
  }
  if (executorPlan.policyDecisionHash !== providerExecutionPlan.policyDecisionHash) {
    reasons.push("controlled_readonly_dispatch_executor_plan_policy_decision_hash_mismatch");
  }
  if (executorPlan.inputHash !== providerExecutionPlan.inputHash) {
    reasons.push("controlled_readonly_dispatch_executor_plan_input_hash_mismatch");
  }
  if (!equalStringSets(
    executorPlan.requiredCapabilities,
    providerExecutionPlan.requiredCapabilities
  )) {
    reasons.push("controlled_readonly_dispatch_executor_plan_required_capabilities_mismatch");
  }
  if (
    hashProviderExecutionPlannerObject(executorPlan.sandboxProfile)
    !== hashProviderExecutionPlannerObject(providerExecutionPlan.sandboxProfile)
  ) {
    reasons.push("controlled_readonly_dispatch_executor_plan_sandbox_profile_mismatch");
  }
  if (executorPlan.sideEffectClass !== providerExecutionPlan.sideEffectClass) {
    reasons.push(
      `controlled_readonly_dispatch_executor_plan_side_effect_class_mismatch:${executorPlan.sideEffectClass}:${providerExecutionPlan.sideEffectClass}`
    );
  }

  return uniqueStrings(reasons);
}

function collectExecutorApprovalPolicyReasons(input: {
  executorPlan: ExecutorExecutionPlan;
}): string[] {
  const approvalPolicy = readCodexCliApprovalPolicy(input.executorPlan);
  if (approvalPolicy === "never") {
    return [];
  }

  return [
    approvalPolicy === undefined
      ? "controlled_readonly_dispatch_executor_plan_approval_policy_missing"
      : `controlled_readonly_dispatch_executor_plan_requires_approval_policy_never:${approvalPolicy}`
  ];
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
  if (containsForbiddenExecutionMaterial(input.dispatchPreflight.environmentPreflight)) {
    reasons.push("controlled_readonly_dispatch_preflight_metadata_not_sanitized");
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
  const expectedTaskEnvelope = createControlledReadOnlyDispatchTaskEnvelope(
    input.task
  );
  const actualTaskEnvelopeHash = hashProviderExecutionPlannerObject(
    input.taskEnvelope
  );
  const expectedTaskEnvelopeHash = hashProviderExecutionPlannerObject(
    expectedTaskEnvelope
  );
  if (actualTaskEnvelopeHash !== expectedTaskEnvelopeHash) {
    reasons.push("controlled_readonly_dispatch_task_envelope_hash_mismatch");
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

function createDispatchPreflightArtifactBinding(input: {
  dispatchPreflight: ControlledReadOnlyProviderDispatchPreflight;
  providerExecutionPlan: ProviderExecutionPlan;
  providerExecutionPlanHash: string;
  executorPlanHash: string;
  policyDecisionHash: string;
  task: Task;
  run: Run;
}): Record<string, string> {
  return {
    schemaVersion: "controlled-provider-execution-dispatch-preflight-artifact-binding.v1",
    artifactRef: input.dispatchPreflight.environmentPreflight.artifactRef,
    artifactHash: input.dispatchPreflight.environmentPreflight.artifactHash,
    providerExecutionPlanHash: input.providerExecutionPlanHash,
    executorPlanHash: input.executorPlanHash,
    providerManifestHash: input.providerExecutionPlan.providerManifestHash ?? "",
    policyDecisionHash: input.policyDecisionHash,
    providerId: input.providerExecutionPlan.providerId,
    taskId: input.task.taskId,
    runId: input.run.runId
  };
}

function readDispatchPreflightArtifactBinding(
  artifact: StoredArtifact
): Record<string, string> | undefined {
  const value = artifact.metadata.controlledReadOnlyDispatchPreflight;
  if (!isStringRecord(value)) {
    return undefined;
  }

  return value;
}

function dispatchPreflightArtifactId(artifactRef: string): string {
  return `artifact_${toSafeArtifactIdPart(artifactRef)}`;
}

function toSafeArtifactIdPart(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/^artifact:\/\//, "")
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe || "unnamed";
}

async function collectDispatchPreflightArtifactStoreReasons(input: {
  artifactStore: ArtifactStore;
  dispatchPreflight: ControlledReadOnlyProviderDispatchPreflight;
  providerExecutionPlan: ProviderExecutionPlan;
  executorPlan: ExecutorExecutionPlan;
  policyDecision: PolicyDecision;
  task: Task;
  run: Run;
  providerExecutionPlanHash: string;
  executorPlanHash: string;
}): Promise<string[]> {
  const dispatchPreflight = ControlledReadOnlyProviderDispatchPreflightSchema.parse(
    input.dispatchPreflight
  );
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse(
    input.providerExecutionPlan
  );
  const executorPlan = ExecutorExecutionPlanSchema.parse(input.executorPlan);
  const policyDecision = PolicyDecisionSchema.parse(input.policyDecision);
  const task = TaskSchema.parse(input.task);
  const run = RunSchema.parse(input.run);
  const artifactId = dispatchPreflightArtifactId(
    dispatchPreflight.environmentPreflight.artifactRef
  );
  const artifact = await input.artifactStore.getArtifact(artifactId);
  if (artifact === undefined) {
    return ["controlled_readonly_dispatch_preflight_artifact_store_missing"];
  }

  const verification = await input.artifactStore.verifyArtifact(artifactId);
  const reasons: string[] = [];
  if (verification.ok !== true) {
    reasons.push(
      `controlled_readonly_dispatch_preflight_artifact_store_verification_failed:${verification.reason ?? "unknown"}`
    );
  }

  if (artifact.taskId !== task.taskId) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_task_mismatch");
  }
  if (artifact.runId !== run.runId) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_run_mismatch");
  }
  if (artifact.type !== "json") {
    reasons.push(`controlled_readonly_dispatch_preflight_artifact_type_mismatch:${artifact.type}`);
  }

  const binding = readDispatchPreflightArtifactBinding(artifact);
  if (binding === undefined) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_binding_missing");
    return uniqueStrings(reasons);
  }

  const expectedBinding = createDispatchPreflightArtifactBinding({
    dispatchPreflight,
    providerExecutionPlan,
    providerExecutionPlanHash: input.providerExecutionPlanHash,
    executorPlanHash: input.executorPlanHash,
    policyDecisionHash: hashProviderExecutionPlannerObject(policyDecision),
    task,
    run
  });
  const actualExecutorPlanHash = hashProviderExecutionPlannerObject(executorPlan);

  if (binding.schemaVersion !== expectedBinding.schemaVersion) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_schema_mismatch");
  }
  if (binding.artifactRef !== expectedBinding.artifactRef) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_ref_mismatch");
  }
  if (binding.artifactHash !== expectedBinding.artifactHash) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_hash_mismatch");
  }
  if (binding.providerExecutionPlanHash !== expectedBinding.providerExecutionPlanHash) {
    reasons.push(
      "controlled_readonly_dispatch_preflight_artifact_provider_execution_plan_hash_mismatch"
    );
  }
  if (binding.executorPlanHash !== expectedBinding.executorPlanHash) {
    reasons.push(
      "controlled_readonly_dispatch_preflight_artifact_executor_plan_hash_mismatch"
    );
  }
  if (binding.executorPlanHash !== actualExecutorPlanHash) {
    reasons.push(
      "controlled_readonly_dispatch_preflight_artifact_executor_plan_current_hash_mismatch"
    );
  }
  if (binding.providerManifestHash !== expectedBinding.providerManifestHash) {
    reasons.push(
      "controlled_readonly_dispatch_preflight_artifact_provider_manifest_hash_mismatch"
    );
  }
  if (binding.policyDecisionHash !== expectedBinding.policyDecisionHash) {
    reasons.push(
      "controlled_readonly_dispatch_preflight_artifact_policy_decision_hash_mismatch"
    );
  }
  if (binding.providerId !== expectedBinding.providerId) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_provider_mismatch");
  }
  if (binding.taskId !== expectedBinding.taskId) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_task_binding_mismatch");
  }
  if (binding.runId !== expectedBinding.runId) {
    reasons.push("controlled_readonly_dispatch_preflight_artifact_run_binding_mismatch");
  }

  return uniqueStrings(reasons);
}

function createControlledReadOnlyDispatchTaskEnvelope(task: Task) {
  const repoContext = task.workspace ?? task.repo;
  const taskClassHint = resolveGovernanceTaskClassHint(task);

  return parseTaskEnvelope({
    schemaVersion: "task-envelope.v1",
    taskId: task.taskId,
    source: task.source,
    intent: task.intent ?? {
      summary: task.title,
      requestedAction: task.requestedAction,
      successCriteria: [...task.successCriteria],
      outOfScope: [...task.outOfScope]
    },
    repoContext: {
      ...(repoContext.root !== undefined ? { repoRoot: repoContext.root } : {}),
      ...(repoContext.branch !== undefined ? { branch: repoContext.branch } : {}),
      ...(repoContext.worktreeClean !== undefined
        ? { worktreeClean: repoContext.worktreeClean }
        : {}),
      ...(repoContext.protectedBranch !== undefined
        ? { protectedBranch: repoContext.protectedBranch }
        : {})
    },
    target: {
      branches: [...task.target.branches],
      files: [...task.target.files],
      modules: [...task.target.modules]
    },
    constraints: {
      ...(typeof task.constraints.requiresNetwork === "boolean"
        ? { requiresNetwork: task.constraints.requiresNetwork }
        : {}),
      ...(typeof task.constraints.explicitOwnership === "boolean"
        ? { explicitOwnership: task.constraints.explicitOwnership }
        : {}),
      ...(typeof task.constraints.allowBackgroundAutomation === "boolean"
        ? { allowBackgroundAutomation: task.constraints.allowBackgroundAutomation }
        : {})
    },
    hints: {
      ...(taskClassHint !== undefined ? { taskClassHint } : {}),
      riskHints: [...task.hints.riskHints],
      tags: [...task.hints.tags],
      provenance: task.hints.provenance.map((entry) => ({
        ...entry,
        field: entry.field === "taskClass" ? "taskClassHint" : entry.field
      }))
    }
  });
}

function resolveGovernanceTaskClassHint(task: Task): TaskClass | undefined {
  return toGovernanceTaskClassHint(task.hints.taskClass);
}

function toGovernanceTaskClassHint(value: string | undefined): TaskClass | undefined {
  if (value === undefined || !GovernanceTaskClassHints.has(value as TaskClass)) {
    return undefined;
  }

  return value as TaskClass;
}

function readCodexCliApprovalPolicy(plan: ExecutorExecutionPlan): string | undefined {
  const metadata = plan.metadata.codexCliProvider;
  if (!isRecord(metadata)) {
    return undefined;
  }

  const codexCliPlan = metadata.codexCliPlan;
  if (!isRecord(codexCliPlan) || typeof codexCliPlan.approvalPolicy !== "string") {
    return undefined;
  }

  return codexCliPlan.approvalPolicy;
}

function equalStringSets(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (
    leftSet.size !== left.length ||
    rightSet.size !== right.length ||
    leftSet.size !== rightSet.size
  ) {
    return false;
  }

  return [...leftSet].every((value) => rightSet.has(value));
}

function resolvePolicySideEffectClass(policyDecision: PolicyDecision): ProviderSideEffectClass {
  const sandboxProfile = policyDecision.execution.sandbox;

  if (hasProtectedRemoteSideEffect(policyDecision)) {
    return "protected_remote";
  }

  if (hasExternalSideEffect(policyDecision)) {
    return "external_side_effects";
  }

  if (hasSecretAccess(policyDecision)) {
    return "secret_access";
  }

  if (hasLocalCommand(policyDecision)) {
    return "local_command";
  }

  if (sandboxProfile.mode === "workspace-write") {
    return "workspace_write";
  }

  return "read_only";
}

function hasProtectedRemoteSideEffect(policyDecision: PolicyDecision): boolean {
  return policyDecision.legacy.toolAccess === "protected_remote"
    || policyDecision.capabilities.some((scope) => (
      scope.kind === "external"
      && scope.resource === "protected_remote"
      && scope.access !== "read"
    ));
}

function hasExternalSideEffect(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => (
    scope.kind === "external"
    && scope.access !== "read"
  ));
}

function hasSecretAccess(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => scope.kind === "secret");
}

function hasLocalCommand(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => (
    (scope.kind === "tool" || scope.kind === "process")
    && scope.access === "execute"
  ));
}

function containsForbiddenExecutionMaterial(value: unknown): boolean {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (typeof serialized !== "string") {
    return false;
  }

  return [
    /\brequestedaction\b/i,
    /\braw\s+(?:command|task envelope|env|token|patch|prompt|stdout|stderr|output)\b/i,
    /openai_api_key/i,
    /\bsk-(?:proj-)?[a-z0-9_-]{4,}\b/i,
    /\bbearer\s+[a-z0-9._~+/=-]+/i,
    /["'](?:prompt|args|argv|stdout|stderr|environment|env|processenv|token|secret|patch|authorization|apikey|api_key|access[-_]?token|client[-_]?secret|output|command|workdir|cwd)["']\s*:/i,
    /\b(?:prompt|stdout|stderr|processenv|authorization|apikey|api_key|access[-_]?token|client[-_]?secret)\b/i
  ].some((pattern) => pattern.test(serialized));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value)
    && Object.values(value).every((entry) => typeof entry === "string");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
