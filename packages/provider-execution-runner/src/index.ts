import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  ArtifactStore,
  StoredArtifact
} from "../../artifact-store/src/index.js";
import {
  capabilityScopeToCanonicalString
} from "../../capability/src/index.js";
import {
  hashProviderExecutionPlannerObject,
  ProviderExecutionPlanSchema,
  type ProviderExecutionPlan
} from "../../execution-planner/src/index.js";
import {
  ArtifactSchema,
  EventSchema,
  PolicyDecisionSchema,
  PrincipalSchema,
  RunSchema,
  TaskSchema,
  type Artifact,
  type Event,
  type PolicyDecision,
  type Principal,
  type Run,
  type Task
} from "../../kernel-contracts/src/index.js";
import type {
  KernelStore
} from "../../kernel-store/src/index.js";
import {
  createProviderAttestation,
  ExecutorExecutionPlanSchema,
  hashProviderManifest,
  validateProviderExecutionPermitForPlan,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderAttestation,
  type ProviderExecutionPermit,
  type ProviderExecutionResult,
  type ProviderSideEffectClass
} from "../../provider-core/src/index.js";
import type {
  ProviderRegistry
} from "../../provider-registry/src/index.js";

export const ProviderExecutionRunnerStatusSchema = z.enum([
  "dry_run_succeeded",
  "blocked",
  "provider_plan_failed",
  "validation_failed"
]);

export type ProviderExecutionRunnerStatus =
  z.infer<typeof ProviderExecutionRunnerStatusSchema>;

export const ControlledReadOnlyProviderExecutionRunnerStatusSchema = z.enum([
  "controlled_readonly_succeeded",
  "blocked",
  "provider_plan_failed",
  "validation_failed",
  "execution_failed"
]);

export type ControlledReadOnlyProviderExecutionRunnerStatus =
  z.infer<typeof ControlledReadOnlyProviderExecutionRunnerStatusSchema>;

export type RunProviderExecutionPlanDryRunInput = {
  providerExecutionPlan: ProviderExecutionPlan;
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision;
  providerRegistry: ProviderRegistry;
  kernelStore: KernelStore;
  artifactStore: ArtifactStore;
  proposedInput?: unknown;
  now: () => string;
  mode?: "dry-run";
};

export type RunProviderExecutionPlanControlledReadOnlyInput = {
  providerExecutionPlan: ProviderExecutionPlan;
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision;
  providerRegistry: ProviderRegistry;
  kernelStore: KernelStore;
  artifactStore: ArtifactStore;
  permit?: ProviderExecutionPermit;
  executorPlan?: ExecutorExecutionPlan;
  proposedInput?: unknown;
  executionMetadata?: Record<string, unknown>;
  now: () => string;
  mode: "controlled-read-only";
};

export type ProviderExecutionRunnerResult = {
  schemaVersion: "provider-execution-runner-result.v1";
  status: ProviderExecutionRunnerStatus;
  planId: string;
  taskId: string;
  runId: string;
  providerId: string;
  providerKind: ProviderExecutionPlan["providerKind"];
  dryRun: true;
  executeInvoked: false;
  reasons: string[];
  eventIds: string[];
  artifactIds: string[];
  createdAt: string;
  completedAt: string;
  providerAttestation?: ProviderAttestation;
  executorPlan?: ExecutorExecutionPlan;
  validation?: ExecutionValidationResult;
  reportArtifact?: StoredArtifact;
  kernelArtifact?: Artifact;
};

export type ControlledReadOnlyProviderExecutionRunnerResult = {
  schemaVersion: "provider-execution-controlled-readonly-runner-result.v1";
  status: ControlledReadOnlyProviderExecutionRunnerStatus;
  planId: string;
  taskId: string;
  runId: string;
  providerId: string;
  providerKind: ProviderExecutionPlan["providerKind"];
  dryRun: false;
  executeInvoked: boolean;
  reasons: string[];
  eventIds: string[];
  artifactIds: string[];
  createdAt: string;
  completedAt: string;
  providerAttestation?: ProviderAttestation;
  executorPlan?: ExecutorExecutionPlan;
  validation?: ExecutionValidationResult;
  providerResultSummary?: Record<string, unknown>;
  failureClass?: string;
  executionEvidence?: Record<string, unknown>;
  reportArtifact?: StoredArtifact;
  kernelArtifact?: Artifact;
};

export async function runProviderExecutionPlanDryRun(
  input: RunProviderExecutionPlanDryRunInput
): Promise<ProviderExecutionRunnerResult> {
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse(input.providerExecutionPlan);
  const task = TaskSchema.parse(input.task);
  const run = RunSchema.parse(input.run);
  const principal = PrincipalSchema.parse(input.principal);
  const policyDecision = PolicyDecisionSchema.parse(input.policyDecision);
  const createdAt = input.now();
  const eventIds: string[] = [];
  const artifactIds: string[] = [];
  const mode = (input as { mode?: unknown }).mode ?? "dry-run";
  const providerEntry = input.providerRegistry.getProvider(providerExecutionPlan.providerId);
  const providerAttestation = providerEntry === undefined
    ? undefined
    : createProviderAttestation(providerEntry.manifest, createdAt);
  const preflightReasons = collectRunnerPreflightReasons({
    mode,
    providerExecutionPlan,
    task,
    run,
    policyDecision,
    providerRegistry: input.providerRegistry
  });

  if (preflightReasons.length > 0) {
    return finalizeRunnerResult({
      input,
      providerExecutionPlan,
      status: "blocked",
      reasons: preflightReasons,
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {})
    });
  }

  if (providerEntry === undefined || !isExecutorProvider(providerEntry.provider)) {
    return finalizeRunnerResult({
      input,
      providerExecutionPlan,
      status: "blocked",
      reasons: [`provider_not_executable:${providerExecutionPlan.providerId}`],
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {})
    });
  }

  const startedEvent = appendRunnerEvent(input.kernelStore, {
    providerExecutionPlan,
    task,
    run,
    principal,
    createdAt: input.now(),
    eventType: "kernel.provider.execution.dry_run.started",
    eventIds,
    payload: {
      status: "started",
      dryRun: true,
      executeInvoked: false
    }
  });
  eventIds.push(startedEvent.eventId);

  let executorPlan: ExecutorExecutionPlan;
  try {
    executorPlan = ExecutorExecutionPlanSchema.parse(await providerEntry.provider.planExecution({
      task,
      run,
      policyDecision,
      sandboxProfile: providerExecutionPlan.sandboxProfile,
      inputHash: providerExecutionPlan.inputHash,
      ...(input.proposedInput !== undefined ? { proposedInput: input.proposedInput } : {}),
      now: input.now()
    }));
  } catch (error) {
    return finalizeRunnerResult({
      input,
      providerExecutionPlan,
      status: "provider_plan_failed",
      reasons: [`provider_plan_failed:${normalizeErrorMessage(error)}`],
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {})
    });
  }

  const executorPlanInvariantReasons = collectExecutorPlanInvariantReasons({
    providerExecutionPlan,
    executorPlan
  });
  if (executorPlanInvariantReasons.length > 0) {
    const validation = {
      valid: false,
      reasons: executorPlanInvariantReasons
    };

    return finalizeRunnerResult({
      input,
      providerExecutionPlan,
      status: "validation_failed",
      reasons: uniqueStrings([
        "executor_plan_invariant_mismatch",
        ...executorPlanInvariantReasons
      ]),
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {}),
      executorPlan,
      validation
    });
  }

  let validation: ExecutionValidationResult;
  try {
    validation = await providerEntry.provider.validateExecutionPlan(executorPlan);
  } catch (error) {
    validation = {
      valid: false,
      reasons: [`provider_validation_failed:${normalizeErrorMessage(error)}`]
    };
  }

  if (!validation.valid) {
    return finalizeRunnerResult({
      input,
      providerExecutionPlan,
      status: "validation_failed",
      reasons: uniqueStrings(["provider_validation_failed", ...validation.reasons]),
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {}),
      executorPlan,
      validation
    });
  }

  return finalizeRunnerResult({
    input,
    providerExecutionPlan,
    status: "dry_run_succeeded",
    reasons: ["provider_execution_dry_run_succeeded"],
    eventIds,
    artifactIds,
    createdAt,
    ...(providerAttestation !== undefined ? { providerAttestation } : {}),
    executorPlan,
    validation
  });
}

export async function runProviderExecutionPlanControlledReadOnly(
  input: RunProviderExecutionPlanControlledReadOnlyInput
): Promise<ControlledReadOnlyProviderExecutionRunnerResult> {
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse(input.providerExecutionPlan);
  const task = TaskSchema.parse(input.task);
  const run = RunSchema.parse(input.run);
  const principal = PrincipalSchema.parse(input.principal);
  const policyDecision = PolicyDecisionSchema.parse(input.policyDecision);
  const createdAt = input.now();
  const eventIds: string[] = [];
  const artifactIds: string[] = [];
  const mode = (input as { mode?: unknown }).mode;
  const providerEntry = input.providerRegistry.getProvider(providerExecutionPlan.providerId);
  const providerAttestation = providerEntry === undefined
    ? undefined
    : createProviderAttestation(providerEntry.manifest, createdAt);
  const preflightReasons = collectControlledReadOnlyPreflightReasons({
    mode,
    providerExecutionPlan,
    task,
    run,
    policyDecision,
    providerRegistry: input.providerRegistry,
    ...(input.permit !== undefined ? { permit: input.permit } : {}),
    ...(input.executionMetadata !== undefined
      ? { executionMetadata: input.executionMetadata }
      : {})
  });

  if (preflightReasons.length > 0) {
    return finalizeControlledReadOnlyRunnerResult({
      input,
      providerExecutionPlan,
      status: "blocked",
      executeInvoked: false,
      reasons: preflightReasons,
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {})
    });
  }

  if (providerEntry === undefined || !isExecutorProvider(providerEntry.provider)) {
    return finalizeControlledReadOnlyRunnerResult({
      input,
      providerExecutionPlan,
      status: "blocked",
      executeInvoked: false,
      reasons: [`provider_not_executable:${providerExecutionPlan.providerId}`],
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {})
    });
  }

  const startedEvent = appendRunnerEvent(input.kernelStore, {
    providerExecutionPlan,
    task,
    run,
    principal,
    createdAt: input.now(),
    eventType: "kernel.provider.execution.controlled_readonly.started",
    eventIds,
    payload: {
      status: "started",
      dryRun: false,
      executeInvoked: false,
      control: "controlled-read-only"
    }
  });
  eventIds.push(startedEvent.eventId);

  let executorPlan: ExecutorExecutionPlan;
  try {
    executorPlan = input.executorPlan === undefined
      ? ExecutorExecutionPlanSchema.parse(await providerEntry.provider.planExecution({
          task,
          run,
          policyDecision,
          sandboxProfile: providerExecutionPlan.sandboxProfile,
          inputHash: providerExecutionPlan.inputHash,
          ...(input.proposedInput !== undefined ? { proposedInput: input.proposedInput } : {}),
          now: input.now()
        }))
      : ExecutorExecutionPlanSchema.parse(input.executorPlan);
  } catch (error) {
    return finalizeControlledReadOnlyRunnerResult({
      input,
      providerExecutionPlan,
      status: "provider_plan_failed",
      executeInvoked: false,
      reasons: [`provider_plan_failed:${normalizeErrorMessage(error)}`],
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {})
    });
  }

  const executorPlanInvariantReasons = [
    ...collectExecutorPlanInvariantReasons({
      providerExecutionPlan,
      executorPlan
    }),
    ...collectControlledReadOnlyExecutorPlanReasons(executorPlan)
  ];
  if (executorPlanInvariantReasons.length > 0) {
    const validation = {
      valid: false,
      reasons: uniqueStrings(executorPlanInvariantReasons)
    };

    return finalizeControlledReadOnlyRunnerResult({
      input,
      providerExecutionPlan,
      status: "validation_failed",
      executeInvoked: false,
      reasons: uniqueStrings([
        "executor_plan_invariant_mismatch",
        ...executorPlanInvariantReasons
      ]),
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {}),
      executorPlan,
      validation
    });
  }

  let validation: ExecutionValidationResult;
  try {
    validation = await providerEntry.provider.validateExecutionPlan(executorPlan);
  } catch (error) {
    validation = {
      valid: false,
      reasons: [`provider_validation_failed:${normalizeErrorMessage(error)}`]
    };
  }

  if (!validation.valid) {
    return finalizeControlledReadOnlyRunnerResult({
      input,
      providerExecutionPlan,
      status: "validation_failed",
      executeInvoked: false,
      reasons: uniqueStrings(["provider_validation_failed", ...validation.reasons]),
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {}),
      executorPlan,
      validation
    });
  }

  const permitReasons = input.permit === undefined
    ? ["controlled_readonly_provider_execution_permit_required"]
    : validateProviderExecutionPermitForPlan(
        input.permit,
        executorPlan,
        providerEntry.manifest,
        {
          reasonPrefix: "controlled_readonly_provider_execution_permit"
        }
      );
  if (permitReasons.length > 0) {
    return finalizeControlledReadOnlyRunnerResult({
      input,
      providerExecutionPlan,
      status: "validation_failed",
      executeInvoked: false,
      reasons: uniqueStrings(["provider_execution_permit_invalid", ...permitReasons]),
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {}),
      executorPlan,
      validation
    });
  }

  let providerResult: ProviderExecutionResult;
  try {
    providerResult = await providerEntry.provider.execute(executorPlan, {
      dryRun: false,
      ...(input.permit !== undefined ? { permit: input.permit } : {}),
      ...(input.executionMetadata !== undefined ? { metadata: input.executionMetadata } : {})
    });
  } catch (error) {
    return finalizeControlledReadOnlyRunnerResult({
      input,
      providerExecutionPlan,
      status: "execution_failed",
      executeInvoked: true,
      reasons: [`provider_execute_threw:${normalizeSafeErrorMessage(error)}`],
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {}),
      executorPlan,
      validation,
      failureClass: "provider_execute_threw"
    });
  }

  const providerResultSummary = summarizeProviderExecutionResult(providerResult);
  if (!providerResult.ok) {
    const failureClass = extractProviderResultFailureClass(providerResult);
    return finalizeControlledReadOnlyRunnerResult({
      input,
      providerExecutionPlan,
      status: "execution_failed",
      executeInvoked: true,
      reasons: uniqueStrings([
        failureClass,
        ...extractProviderResultReasons(providerResult)
      ]),
      eventIds,
      artifactIds,
      createdAt,
      ...(providerAttestation !== undefined ? { providerAttestation } : {}),
      executorPlan,
      validation,
      providerResultSummary,
      failureClass
    });
  }

  return finalizeControlledReadOnlyRunnerResult({
    input,
    providerExecutionPlan,
    status: "controlled_readonly_succeeded",
    executeInvoked: true,
    reasons: ["controlled_readonly_provider_execution_succeeded"],
    eventIds,
    artifactIds,
    createdAt,
    ...(providerAttestation !== undefined ? { providerAttestation } : {}),
    executorPlan,
    validation,
    providerResultSummary
  });
}

function collectRunnerPreflightReasons(input: {
  mode: unknown;
  providerExecutionPlan: ProviderExecutionPlan;
  task: Task;
  run: Run;
  policyDecision: PolicyDecision;
  providerRegistry: ProviderRegistry;
}): string[] {
  const reasons: string[] = [];

  if (input.mode !== "dry-run") {
    reasons.push(`real_execution_mode_not_supported:${String(input.mode)}`);
  }

  if (input.providerExecutionPlan.status !== "planned") {
    reasons.push(`provider_plan_not_planned:${input.providerExecutionPlan.status}`);
  }

  if (input.providerExecutionPlan.providerKind !== "executor") {
    reasons.push(`provider_plan_kind_not_supported:${input.providerExecutionPlan.providerKind}`);
  }

  if (input.task.taskId !== input.providerExecutionPlan.taskId) {
    reasons.push(`task_plan_mismatch:${input.task.taskId}:${input.providerExecutionPlan.taskId}`);
  }

  if (input.run.runId !== input.providerExecutionPlan.runId) {
    reasons.push(`run_plan_mismatch:${input.run.runId}:${input.providerExecutionPlan.runId}`);
  }

  if (input.run.taskId !== input.task.taskId) {
    reasons.push(`task_run_mismatch:${input.task.taskId}:${input.run.taskId}`);
  }

  if (input.run.status !== "running") {
    reasons.push(`run_not_running:${input.run.status}`);
  }

  if (input.policyDecision.taskId !== input.task.taskId) {
    reasons.push(`policy_task_mismatch:${input.policyDecision.taskId}:${input.task.taskId}`);
  }

  if (
    input.run.policyDecisionId !== undefined
    && input.run.policyDecisionId !== input.policyDecision.decisionId
  ) {
    reasons.push(
      `run_policy_decision_mismatch:${input.run.policyDecisionId}:${input.policyDecision.decisionId}`
    );
  }

  const expectedPolicyDecisionHash = hashProviderExecutionPlannerObject(input.policyDecision);
  if (input.providerExecutionPlan.policyDecisionHash !== expectedPolicyDecisionHash) {
    reasons.push("provider_plan_policy_decision_hash_mismatch");
  }

  reasons.push(...collectProviderPlanPolicyInvariantReasons({
    providerExecutionPlan: input.providerExecutionPlan,
    policyDecision: input.policyDecision
  }));

  const entry = input.providerRegistry.getProvider(input.providerExecutionPlan.providerId);
  if (entry === undefined) {
    reasons.push(`provider_not_found:${input.providerExecutionPlan.providerId}`);
  } else if (!entry.manifest.enabled) {
    reasons.push(`provider_disabled:${input.providerExecutionPlan.providerId}`);
  } else if (entry.manifest.kind !== input.providerExecutionPlan.providerKind) {
    reasons.push(
      `provider_kind_mismatch:${entry.manifest.kind}:${input.providerExecutionPlan.providerKind}`
    );
  } else if (
    input.providerExecutionPlan.providerManifestHash !== undefined
    && input.providerExecutionPlan.providerManifestHash !== hashProviderManifest(entry.manifest)
  ) {
    reasons.push("provider_plan_manifest_hash_mismatch");
  }

  return uniqueStrings(reasons);
}

function collectControlledReadOnlyPreflightReasons(input: {
  mode: unknown;
  providerExecutionPlan: ProviderExecutionPlan;
  task: Task;
  run: Run;
  policyDecision: PolicyDecision;
  providerRegistry: ProviderRegistry;
  permit?: ProviderExecutionPermit;
  executionMetadata?: Record<string, unknown>;
}): string[] {
  const reasons = collectRunnerPreflightReasons({
    mode: "dry-run",
    providerExecutionPlan: input.providerExecutionPlan,
    task: input.task,
    run: input.run,
    policyDecision: input.policyDecision,
    providerRegistry: input.providerRegistry
  });
  const providerEntry = input.providerRegistry.getProvider(input.providerExecutionPlan.providerId);

  if (input.mode !== "controlled-read-only") {
    reasons.push(`controlled_readonly_mode_required:${String(input.mode)}`);
  }

  if (input.providerExecutionPlan.providerId !== "codex-cli") {
    reasons.push("controlled_readonly_requires_codex_cli_provider");
  }

  if (input.providerExecutionPlan.sideEffectClass !== "read_only") {
    reasons.push(
      `controlled_readonly_requires_read_only_side_effect:${input.providerExecutionPlan.sideEffectClass}`
    );
  }

  if (input.providerExecutionPlan.sandboxProfile.mode !== "read-only") {
    reasons.push(
      `controlled_readonly_requires_read_only_sandbox:${input.providerExecutionPlan.sandboxProfile.mode}`
    );
  }

  if (input.providerExecutionPlan.sandboxProfile.writableRoots.length > 0) {
    reasons.push("controlled_readonly_requires_no_writable_roots");
  }

  if (input.policyDecision.approval.required !== false) {
    reasons.push("controlled_readonly_requires_approval_policy_never");
  }

  if (input.permit === undefined) {
    reasons.push("controlled_readonly_provider_execution_permit_required");
  }

  reasons.push(...collectControlledReadOnlyExecutionMetadataReasons({
    ...(input.executionMetadata !== undefined
      ? { executionMetadata: input.executionMetadata }
      : {}),
    ...(providerEntry !== undefined
      ? { manifestHash: hashProviderManifest(providerEntry.manifest) }
      : {})
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
    reasons.push("provider_plan_sandbox_profile_policy_mismatch");
  }

  if (!equalStringSets(input.providerExecutionPlan.requiredCapabilities, expectedRequiredCapabilities)) {
    reasons.push("provider_plan_required_capabilities_policy_mismatch");
  }

  if (input.providerExecutionPlan.sideEffectClass !== expectedSideEffectClass) {
    reasons.push(
      `provider_plan_side_effect_class_policy_mismatch:${input.providerExecutionPlan.sideEffectClass}:${expectedSideEffectClass}`
    );
  }

  return uniqueStrings(reasons);
}

function collectControlledReadOnlyExecutorPlanReasons(
  executorPlan: ExecutorExecutionPlan
): string[] {
  const reasons: string[] = [];

  if (executorPlan.approvalRequired !== false) {
    reasons.push("controlled_readonly_executor_plan_requires_approval_policy_never");
  }

  if (executorPlan.sideEffectClass !== "read_only") {
    reasons.push(
      `controlled_readonly_executor_plan_requires_read_only_side_effect:${executorPlan.sideEffectClass}`
    );
  }

  if (executorPlan.sandboxProfile.mode !== "read-only") {
    reasons.push(
      `controlled_readonly_executor_plan_requires_read_only_sandbox:${executorPlan.sandboxProfile.mode}`
    );
  }

  if (executorPlan.sandboxProfile.writableRoots.length > 0) {
    reasons.push("controlled_readonly_executor_plan_requires_no_writable_roots");
  }

  const approvalPolicy = readCodexCliApprovalPolicy(executorPlan);
  if (approvalPolicy !== "never") {
    reasons.push(
      approvalPolicy === undefined
        ? "controlled_readonly_executor_plan_approval_policy_missing"
        : `controlled_readonly_executor_plan_requires_approval_policy_never:${approvalPolicy}`
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
    reasons.push(`executor_plan_task_mismatch:${executorPlan.taskId}:${providerExecutionPlan.taskId}`);
  }

  if (executorPlan.runId !== providerExecutionPlan.runId) {
    reasons.push(`executor_plan_run_mismatch:${executorPlan.runId}:${providerExecutionPlan.runId}`);
  }

  if (executorPlan.providerId !== providerExecutionPlan.providerId) {
    reasons.push(
      `executor_plan_provider_mismatch:${executorPlan.providerId}:${providerExecutionPlan.providerId}`
    );
  }

  if (executorPlan.policyDecisionHash !== providerExecutionPlan.policyDecisionHash) {
    reasons.push("executor_plan_policy_decision_hash_mismatch");
  }

  if (executorPlan.inputHash !== providerExecutionPlan.inputHash) {
    reasons.push("executor_plan_input_hash_mismatch");
  }

  if (!equalStringSets(executorPlan.requiredCapabilities, providerExecutionPlan.requiredCapabilities)) {
    reasons.push("executor_plan_required_capabilities_mismatch");
  }

  if (
    hashProviderExecutionPlannerObject(executorPlan.sandboxProfile)
    !== hashProviderExecutionPlannerObject(providerExecutionPlan.sandboxProfile)
  ) {
    reasons.push("executor_plan_sandbox_profile_mismatch");
  }

  if (executorPlan.sideEffectClass !== providerExecutionPlan.sideEffectClass) {
    reasons.push(
      `executor_plan_side_effect_class_mismatch:${executorPlan.sideEffectClass}:${providerExecutionPlan.sideEffectClass}`
    );
  }

  return uniqueStrings(reasons);
}

async function finalizeRunnerResult(input: {
  input: RunProviderExecutionPlanDryRunInput;
  providerExecutionPlan: ProviderExecutionPlan;
  status: ProviderExecutionRunnerStatus;
  reasons: string[];
  eventIds: string[];
  artifactIds: string[];
  createdAt: string;
  providerAttestation?: ProviderAttestation;
  executorPlan?: ExecutorExecutionPlan;
  validation?: ExecutionValidationResult;
}): Promise<ProviderExecutionRunnerResult> {
  const completedAt = input.input.now();
  const reportArtifact = await writeRunnerReportArtifact({
    input: input.input,
    providerExecutionPlan: input.providerExecutionPlan,
    status: input.status,
    reasons: input.reasons,
    eventIds: input.eventIds,
    createdAt: input.createdAt,
    completedAt,
    ...(input.providerAttestation !== undefined ? { providerAttestation: input.providerAttestation } : {}),
    ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
    ...(input.validation !== undefined ? { validation: input.validation } : {})
  });
  input.artifactIds.push(reportArtifact.artifactId);

  const kernelArtifact = createKernelArtifactForReport({
    input: input.input,
    providerExecutionPlan: input.providerExecutionPlan,
    reportArtifact,
    dryRun: true
  });

  const completedEvent = appendRunnerEvent(input.input.kernelStore, {
    providerExecutionPlan: input.providerExecutionPlan,
    task: input.input.task,
    run: input.input.run,
    principal: input.input.principal,
    createdAt: completedAt,
    eventType: `kernel.provider.execution.dry_run.${eventStatusSuffix(input.status)}`,
    eventIds: input.eventIds,
    payload: {
      status: input.status,
      dryRun: true,
      executeInvoked: false,
      reasons: input.reasons,
      artifactIds: input.artifactIds,
      ...(input.providerAttestation !== undefined
        ? { providerAttestation: summarizeProviderAttestation(input.providerAttestation) }
        : {}),
      ...(input.validation !== undefined ? { validation: input.validation } : {}),
      ...(input.executorPlan !== undefined
        ? { executorPlan: summarizeExecutorPlan(input.executorPlan) }
        : {})
    }
  });
  input.eventIds.push(completedEvent.eventId);

  return {
    schemaVersion: "provider-execution-runner-result.v1",
    status: input.status,
    planId: input.providerExecutionPlan.planId,
    taskId: input.providerExecutionPlan.taskId,
    runId: input.providerExecutionPlan.runId,
    providerId: input.providerExecutionPlan.providerId,
    providerKind: input.providerExecutionPlan.providerKind,
    dryRun: true,
    executeInvoked: false,
    reasons: uniqueStrings(input.reasons),
    eventIds: [...input.eventIds],
    artifactIds: [...input.artifactIds],
    createdAt: input.createdAt,
    completedAt,
    reportArtifact,
    kernelArtifact,
    ...(input.providerAttestation !== undefined
      ? { providerAttestation: input.providerAttestation }
      : {}),
    ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
    ...(input.validation !== undefined ? { validation: input.validation } : {})
  };
}

async function finalizeControlledReadOnlyRunnerResult(input: {
  input: RunProviderExecutionPlanControlledReadOnlyInput;
  providerExecutionPlan: ProviderExecutionPlan;
  status: ControlledReadOnlyProviderExecutionRunnerStatus;
  executeInvoked: boolean;
  reasons: string[];
  eventIds: string[];
  artifactIds: string[];
  createdAt: string;
  providerAttestation?: ProviderAttestation;
  executorPlan?: ExecutorExecutionPlan;
  validation?: ExecutionValidationResult;
  providerResultSummary?: Record<string, unknown>;
  failureClass?: string;
}): Promise<ControlledReadOnlyProviderExecutionRunnerResult> {
  const completedAt = input.input.now();
  const reasons = sanitizeProviderFailureReasons(input.reasons);
  const failureClass = input.failureClass === undefined
    ? undefined
    : sanitizeProviderFailureClass(input.failureClass);
  const executionEvidence = createControlledReadOnlyExecutionEvidence({
    input: input.input,
    providerExecutionPlan: input.providerExecutionPlan,
    executeInvoked: input.executeInvoked,
    status: input.status,
    reasons,
    ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
    ...(input.providerResultSummary !== undefined
      ? { providerResultSummary: input.providerResultSummary }
      : {}),
    ...(failureClass !== undefined ? { failureClass } : {})
  });
  const reportArtifact = await writeControlledReadOnlyRunnerReportArtifact({
    input: input.input,
    providerExecutionPlan: input.providerExecutionPlan,
    status: input.status,
    executeInvoked: input.executeInvoked,
    reasons,
    eventIds: input.eventIds,
    createdAt: input.createdAt,
    completedAt,
    executionEvidence,
    ...(input.providerAttestation !== undefined ? { providerAttestation: input.providerAttestation } : {}),
    ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
    ...(input.validation !== undefined ? { validation: input.validation } : {}),
    ...(input.providerResultSummary !== undefined
      ? { providerResultSummary: input.providerResultSummary }
      : {}),
    ...(failureClass !== undefined ? { failureClass } : {})
  });
  input.artifactIds.push(reportArtifact.artifactId);

  const kernelArtifact = createKernelArtifactForReport({
    input: input.input,
    providerExecutionPlan: input.providerExecutionPlan,
    reportArtifact,
    dryRun: false
  });

  const completedEvent = appendRunnerEvent(input.input.kernelStore, {
    providerExecutionPlan: input.providerExecutionPlan,
    task: input.input.task,
    run: input.input.run,
    principal: input.input.principal,
    createdAt: completedAt,
    eventType: `kernel.provider.execution.controlled_readonly.${eventStatusSuffix(input.status)}`,
    eventIds: input.eventIds,
    payload: {
      status: input.status,
      dryRun: false,
      executeInvoked: input.executeInvoked,
      reasons,
      artifactIds: input.artifactIds,
      control: "controlled-read-only",
      ...(input.providerAttestation !== undefined
        ? { providerAttestation: summarizeProviderAttestation(input.providerAttestation) }
        : {}),
      ...(input.validation !== undefined ? { validation: input.validation } : {}),
      ...(input.executorPlan !== undefined
        ? { executorPlan: summarizeExecutorPlan(input.executorPlan) }
        : {}),
      ...(input.providerResultSummary !== undefined
        ? { providerResultSummary: input.providerResultSummary }
        : {}),
      ...(failureClass !== undefined ? { failureClass } : {})
    }
  });
  input.eventIds.push(completedEvent.eventId);

  return {
    schemaVersion: "provider-execution-controlled-readonly-runner-result.v1",
    status: input.status,
    planId: input.providerExecutionPlan.planId,
    taskId: input.providerExecutionPlan.taskId,
    runId: input.providerExecutionPlan.runId,
    providerId: input.providerExecutionPlan.providerId,
    providerKind: input.providerExecutionPlan.providerKind,
    dryRun: false,
    executeInvoked: input.executeInvoked,
    reasons,
    eventIds: [...input.eventIds],
    artifactIds: [...input.artifactIds],
    createdAt: input.createdAt,
    completedAt,
    executionEvidence,
    reportArtifact,
    kernelArtifact,
    ...(input.providerAttestation !== undefined
      ? { providerAttestation: input.providerAttestation }
      : {}),
    ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
    ...(input.validation !== undefined ? { validation: input.validation } : {}),
    ...(input.providerResultSummary !== undefined
      ? { providerResultSummary: input.providerResultSummary }
      : {}),
    ...(failureClass !== undefined ? { failureClass } : {})
  };
}

async function writeRunnerReportArtifact(input: {
  input: RunProviderExecutionPlanDryRunInput;
  providerExecutionPlan: ProviderExecutionPlan;
  status: ProviderExecutionRunnerStatus;
  reasons: string[];
  eventIds: string[];
  createdAt: string;
  completedAt: string;
  providerAttestation?: ProviderAttestation;
  executorPlan?: ExecutorExecutionPlan;
  validation?: ExecutionValidationResult;
}): Promise<StoredArtifact> {
  const artifactId = createArtifactId(
    input.providerExecutionPlan.planId,
    input.status,
    input.completedAt
  );

  return input.input.artifactStore.putArtifact({
    artifactId,
    taskId: input.providerExecutionPlan.taskId,
    runId: input.providerExecutionPlan.runId,
    type: "report",
    payload: {
      schemaVersion: "provider-execution-runner-report.v1",
      status: input.status,
      dryRun: true,
      executeInvoked: false,
      reasons: input.reasons,
      eventIds: input.eventIds,
      providerExecutionPlan: summarizeProviderExecutionPlan(input.providerExecutionPlan),
      ...(input.providerAttestation !== undefined
        ? { providerAttestation: summarizeProviderAttestation(input.providerAttestation) }
        : {}),
      ...(input.executorPlan !== undefined
        ? { executorPlan: summarizeExecutorPlan(input.executorPlan) }
        : {}),
      ...(input.validation !== undefined ? { validation: input.validation } : {})
    },
    metadata: {
      providerId: input.providerExecutionPlan.providerId,
      providerKind: input.providerExecutionPlan.providerKind,
      status: input.status,
      dryRun: true,
      ...(input.providerAttestation !== undefined
        ? { providerAttestationManifestHash: input.providerAttestation.manifestHash }
        : {})
    },
    provenance: {
      principalId: input.input.principal.principalId,
      source: "provider-execution-runner",
      planId: input.providerExecutionPlan.planId
    },
    createdAt: input.completedAt,
    alreadyRedacted: true
  });
}

async function writeControlledReadOnlyRunnerReportArtifact(input: {
  input: RunProviderExecutionPlanControlledReadOnlyInput;
  providerExecutionPlan: ProviderExecutionPlan;
  status: ControlledReadOnlyProviderExecutionRunnerStatus;
  executeInvoked: boolean;
  reasons: string[];
  eventIds: string[];
  createdAt: string;
  completedAt: string;
  executionEvidence: Record<string, unknown>;
  providerAttestation?: ProviderAttestation;
  executorPlan?: ExecutorExecutionPlan;
  validation?: ExecutionValidationResult;
  providerResultSummary?: Record<string, unknown>;
  failureClass?: string;
}): Promise<StoredArtifact> {
  const artifactId = createArtifactId(
    input.providerExecutionPlan.planId,
    input.status,
    input.completedAt
  );

  return input.input.artifactStore.putArtifact({
    artifactId,
    taskId: input.providerExecutionPlan.taskId,
    runId: input.providerExecutionPlan.runId,
    type: "report",
    payload: {
      schemaVersion: "provider-execution-controlled-readonly-report.v1",
      status: input.status,
      dryRun: false,
      executeInvoked: input.executeInvoked,
      reasons: input.reasons,
      eventIds: input.eventIds,
      providerExecutionPlan: summarizeProviderExecutionPlan(input.providerExecutionPlan),
      executionEvidence: input.executionEvidence,
      ...(input.providerAttestation !== undefined
        ? { providerAttestation: summarizeProviderAttestation(input.providerAttestation) }
        : {}),
      ...(input.executorPlan !== undefined
        ? { executorPlan: summarizeExecutorPlan(input.executorPlan) }
        : {}),
      ...(input.validation !== undefined ? { validation: input.validation } : {}),
      ...(input.providerResultSummary !== undefined
        ? { providerResultSummary: input.providerResultSummary }
        : {}),
      ...(input.failureClass !== undefined ? { failureClass: input.failureClass } : {})
    },
    metadata: {
      providerId: input.providerExecutionPlan.providerId,
      providerKind: input.providerExecutionPlan.providerKind,
      status: input.status,
      dryRun: false,
      executeInvoked: input.executeInvoked,
      controlledReadOnly: true,
      ...(input.providerAttestation !== undefined
        ? { providerAttestationManifestHash: input.providerAttestation.manifestHash }
        : {}),
      ...(input.failureClass !== undefined ? { failureClass: input.failureClass } : {})
    },
    provenance: {
      principalId: input.input.principal.principalId,
      source: "provider-execution-runner",
      planId: input.providerExecutionPlan.planId
    },
    createdAt: input.completedAt,
    alreadyRedacted: true
  });
}

function createKernelArtifactForReport(input: {
  input: Pick<RunProviderExecutionPlanDryRunInput, "kernelStore">;
  providerExecutionPlan: ProviderExecutionPlan;
  reportArtifact: StoredArtifact;
  dryRun: boolean;
}): Artifact {
  const kernelArtifact = ArtifactSchema.parse({
    schemaVersion: "artifact.v1",
    artifactId: `kernel_${input.reportArtifact.artifactId}`,
    taskId: input.reportArtifact.taskId,
    runId: input.reportArtifact.runId,
    kind: "evidence",
    uri: input.reportArtifact.uri,
    sha256: input.reportArtifact.sha256,
    sizeBytes: input.reportArtifact.sizeBytes,
    createdAt: input.reportArtifact.createdAt,
    metadata: {
      source: "provider-execution-runner",
      providerId: input.providerExecutionPlan.providerId,
      providerKind: input.providerExecutionPlan.providerKind,
      reportArtifactId: input.reportArtifact.artifactId,
      dryRun: input.dryRun
    }
  });
  const existing = input.input.kernelStore.getArtifact(kernelArtifact.artifactId);

  return existing ?? input.input.kernelStore.createArtifact(kernelArtifact);
}

function appendRunnerEvent(
  kernelStore: KernelStore,
  input: {
    providerExecutionPlan: ProviderExecutionPlan;
    task: Task;
    run: Run;
    principal: Principal;
    createdAt: string;
    eventType: string;
    eventIds: string[];
    payload: Record<string, unknown>;
  }
): Event {
  return kernelStore.appendEvent(EventSchema.parse({
    schemaVersion: "kernel-event.v1",
    eventId: createEventId(
      input.eventType,
      input.providerExecutionPlan.planId,
      input.createdAt,
      input.eventIds.length
    ),
    eventType: input.eventType,
    taskId: input.task.taskId,
    runId: input.run.runId,
    principalId: input.principal.principalId,
    createdAt: input.createdAt,
    payload: {
      schemaVersion: "provider-execution-runner-event.v1",
      planId: input.providerExecutionPlan.planId,
      providerId: input.providerExecutionPlan.providerId,
      providerKind: input.providerExecutionPlan.providerKind,
      ...input.payload
    }
  }));
}

function summarizeProviderExecutionPlan(plan: ProviderExecutionPlan): Record<string, unknown> {
  return {
    schemaVersion: plan.schemaVersion,
    planId: plan.planId,
    taskId: plan.taskId,
    runId: plan.runId,
    providerId: plan.providerId,
    providerKind: plan.providerKind,
    providerManifestHash: plan.providerManifestHash ?? null,
    status: plan.status,
    inputHash: plan.inputHash,
    policyDecisionHash: plan.policyDecisionHash,
    requiredCapabilities: [...plan.requiredCapabilities],
    requiredApprovals: [...plan.requiredApprovals],
    sandboxProfile: plan.sandboxProfile,
    sideEffectClass: plan.sideEffectClass,
    reasons: [...plan.reasons],
    createdAt: plan.createdAt
  };
}

function summarizeExecutorPlan(plan: ExecutorExecutionPlan): Record<string, unknown> {
  return {
    schemaVersion: plan.schemaVersion,
    kind: plan.kind,
    planId: plan.planId,
    taskId: plan.taskId,
    runId: plan.runId,
    providerId: plan.providerId,
    inputHash: plan.inputHash,
    policyDecisionHash: plan.policyDecisionHash,
    requiredCapabilities: [...plan.requiredCapabilities],
    approvalRequired: plan.approvalRequired,
    sandboxProfile: plan.sandboxProfile,
    sideEffectClass: plan.sideEffectClass,
    createdAt: plan.createdAt
  };
}

function summarizeProviderAttestation(attestation: ProviderAttestation): Record<string, unknown> {
  return {
    schemaVersion: attestation.schemaVersion,
    providerId: attestation.providerId,
    kind: attestation.kind,
    displayName: attestation.displayName,
    version: attestation.version,
    manifestHash: attestation.manifestHash,
    capabilities: [...attestation.capabilities],
    securityBoundary: attestation.securityBoundary,
    supportedSandboxProfiles: attestation.supportedSandboxProfiles,
    supportedSideEffectClasses: [...attestation.supportedSideEffectClasses],
    attestedAt: attestation.attestedAt
  };
}

function summarizeProviderExecutionResult(
  result: ProviderExecutionResult
): Record<string, unknown> {
  return {
    ok: result.ok,
    artifactCount: result.artifacts?.length ?? 0,
    eventCount: result.events?.length ?? 0,
    ...(result.error !== undefined ? { error: sanitizeProviderResultError(result.error) } : {}),
    ...(result.artifacts !== undefined
      ? {
          artifacts: result.artifacts.map((artifact) => ({
            artifactId: artifact.artifactId,
            kind: artifact.kind,
            uri: artifact.uri,
            sha256: artifact.sha256,
            sizeBytes: artifact.sizeBytes,
            createdAt: artifact.createdAt,
            summaryKind: isRecord(artifact.metadata)
              && typeof artifact.metadata.summaryKind === "string"
              ? artifact.metadata.summaryKind
              : undefined,
            summary: isRecord(artifact.metadata)
              && isRecord(artifact.metadata.summary)
              ? sanitizeJsonValue(artifact.metadata.summary)
              : undefined
          }))
        }
      : {})
  };
}

function createControlledReadOnlyExecutionEvidence(input: {
  input: RunProviderExecutionPlanControlledReadOnlyInput;
  providerExecutionPlan: ProviderExecutionPlan;
  status: ControlledReadOnlyProviderExecutionRunnerStatus;
  executeInvoked: boolean;
  reasons: string[];
  executorPlan?: ExecutorExecutionPlan;
  providerResultSummary?: Record<string, unknown>;
  failureClass?: string;
}): Record<string, unknown> {
  return {
    schemaVersion: "provider-execution-controlled-readonly-evidence.v1",
    control: {
      mode: "controlled-read-only",
      dryRun: false,
      status: input.status,
      providerExecuteInvoked: input.executeInvoked,
      providerExecuteAuthorized: input.executeInvoked,
      canWriteWorkspace: false,
      workspaceWriteScope: "none",
      generalWorkspaceWriteAuthorized: false,
      localCommandAuthorized: false,
      protectedRemoteAuthorized: false,
      externalWriteAuthorized: false,
      sandboxMode: input.providerExecutionPlan.sandboxProfile.mode,
      approvalPolicy: "never"
    },
    approval: {
      authorizerKind: "provider-execution-permit",
      permitPresent: input.input.permit !== undefined,
      permitId: input.input.permit?.permitId ?? null,
      providerId: input.providerExecutionPlan.providerId,
      planId: input.providerExecutionPlan.planId,
      taskId: input.providerExecutionPlan.taskId,
      runId: input.providerExecutionPlan.runId,
      policyDecisionHash: input.providerExecutionPlan.policyDecisionHash,
      providerManifestHash: input.providerExecutionPlan.providerManifestHash ?? null,
      sideEffectClass: input.providerExecutionPlan.sideEffectClass,
      sandboxProfileId: input.providerExecutionPlan.sandboxProfile.sandboxId,
      requiredCapabilities: [...input.providerExecutionPlan.requiredCapabilities],
      requiredApprovals: [...input.providerExecutionPlan.requiredApprovals]
    },
    execution: {
      executorPlanPresent: input.executorPlan !== undefined,
      executorPlanId: input.executorPlan?.planId ?? null,
      executorPlanApprovalRequired: input.executorPlan?.approvalRequired ?? null,
      providerResultOk: input.providerResultSummary?.ok ?? null,
      failureClass: input.failureClass ?? null
    },
    evidencePolicy: {
      inputMaterialStored: false,
      argvStored: false,
      processOutputStored: false,
      diagnosticOutputStored: false,
      environmentValuesStored: false,
      patchBodyStored: false
    },
    reasons: uniqueStrings(input.reasons)
  };
}

function eventStatusSuffix(
  status: ProviderExecutionRunnerStatus | ControlledReadOnlyProviderExecutionRunnerStatus
): string {
  switch (status) {
    case "dry_run_succeeded":
    case "controlled_readonly_succeeded":
      return "succeeded";
    case "blocked":
      return "blocked";
    case "provider_plan_failed":
    case "validation_failed":
    case "execution_failed":
      return "failed";
  }
}

function isExecutorProvider(input: unknown): input is ExecutorProvider {
  return isRecord(input)
    && typeof input.planExecution === "function"
    && typeof input.validateExecutionPlan === "function"
    && typeof input.execute === "function";
}

function createEventId(
  eventType: string,
  planId: string,
  createdAt: string,
  sequence: number
): string {
  const hash = shortHash({ eventType, planId, createdAt, sequence });
  return `event_${toSafeIdPart(eventType)}_${toSafeIdPart(planId)}_${hash}`;
}

function createArtifactId(
  planId: string,
  status: ProviderExecutionRunnerStatus | ControlledReadOnlyProviderExecutionRunnerStatus,
  completedAt: string
): string {
  return `artifact_${toSafeIdPart(planId)}_${status}_${shortHash({ planId, status, completedAt })}`;
}

function shortHash(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 12);
}

function toSafeIdPart(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe || "unnamed";
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeSafeErrorMessage(error: unknown): string {
  const message = normalizeErrorMessage(error).trim();
  if (message.length === 0) {
    return "unknown_execution_error";
  }

  return containsForbiddenExecutionMaterial(message)
    ? "redacted_execution_error"
    : message;
}

function collectControlledReadOnlyExecutionMetadataReasons(input: {
  executionMetadata?: Record<string, unknown>;
  manifestHash?: string;
}): string[] {
  const reasons: string[] = [];

  if (input.executionMetadata === undefined) {
    return ["controlled_readonly_provider_execution_metadata_required"];
  }

  if (!isRecord(input.executionMetadata)) {
    return ["controlled_readonly_provider_execution_metadata_invalid"];
  }

  if (containsForbiddenExecutionMaterial(input.executionMetadata)) {
    reasons.push("controlled_readonly_provider_execution_metadata_not_sanitized");
  }

  const guard = input.executionMetadata.codexCliProviderRealExecutionGuard;
  if (!isRecord(guard)) {
    reasons.push("controlled_readonly_codex_cli_real_execution_guard_required");
    return uniqueStrings(reasons);
  }

  const selection = guard.providerRegistrySelection;
  const preflight = guard.environmentPreflight;
  if (!isRecord(selection) || !isRecord(preflight)) {
    reasons.push("controlled_readonly_codex_cli_real_execution_guard_invalid");
    return uniqueStrings(reasons);
  }

  const checks = preflight.checks;
  if (!isRecord(checks) || !Array.isArray(preflight.blockingReasons)) {
    reasons.push("controlled_readonly_codex_cli_real_execution_guard_invalid");
    return uniqueStrings(reasons);
  }

  if (guard.schemaVersion !== "codex-cli-provider-real-execution-guard.v1") {
    reasons.push("controlled_readonly_codex_cli_real_execution_guard_invalid");
  }

  if (guard.realExecutionAllowed !== true) {
    reasons.push("controlled_readonly_codex_cli_real_execution_guard_not_allowed");
  }

  if (selection.selected !== true) {
    reasons.push("controlled_readonly_provider_registry_selection_required");
  }

  if (selection.providerId !== "codex-cli") {
    reasons.push("controlled_readonly_provider_registry_selection_mismatch");
  }

  if (input.manifestHash !== undefined && selection.manifestHash !== input.manifestHash) {
    reasons.push("controlled_readonly_provider_manifest_mismatch");
  }

  if (selection.kind !== undefined && selection.kind !== "executor") {
    reasons.push("controlled_readonly_provider_registry_kind_mismatch");
  }

  if (selection.enabled !== undefined && selection.enabled !== true) {
    reasons.push("controlled_readonly_provider_registry_provider_disabled");
  }

  if (preflight.status !== "ready") {
    reasons.push("controlled_readonly_environment_preflight_not_ready");
  }

  if (preflight.blockingReasons.length > 0) {
    reasons.push("controlled_readonly_environment_preflight_blocked");
  }

  if (checks.injectedSpawner !== true) {
    reasons.push("controlled_readonly_requires_injected_spawner");
  }

  if (checks.realCliAllowed !== true) {
    reasons.push("controlled_readonly_requires_real_cli_allowance");
  }

  if (checks.noWorkspaceWrite !== true) {
    reasons.push("controlled_readonly_requires_no_workspace_write");
  }

  if (checks.noPromptSent !== true || checks.noTaskEnvelope !== true) {
    reasons.push("controlled_readonly_must_not_send_raw_prompt_or_task_envelope");
  }

  if (checks.noRealCliFallback !== true) {
    reasons.push("controlled_readonly_disallows_real_cli_fallback");
  }

  return uniqueStrings(reasons);
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

function extractProviderResultFailureClass(result: ProviderExecutionResult): string {
  const errorCode = isRecord(result.error) && typeof result.error.code === "string"
    ? result.error.code
    : undefined;

  return sanitizeProviderFailureClass(errorCode);
}

function extractProviderResultReasons(result: ProviderExecutionResult): string[] {
  if (!isRecord(result.error)) {
    return ["provider_execution_failed"];
  }

  const reasons = result.error.reasons;
  if (Array.isArray(reasons) && reasons.every((reason) => typeof reason === "string")) {
    return sanitizeProviderFailureReasons(reasons);
  }

  return [extractProviderResultFailureClass(result)];
}

function sanitizeProviderResultError(
  error: Record<string, unknown>
): Record<string, unknown> {
  return sanitizeJsonValue({
    code: sanitizeProviderFailureClass(
      typeof error.code === "string" ? error.code : undefined
    ),
    reasons: Array.isArray(error.reasons)
      ? sanitizeProviderFailureReasons(
          error.reasons.filter((reason): reason is string => typeof reason === "string")
        )
      : []
  }) as Record<string, unknown>;
}

function sanitizeProviderFailureClass(
  value: string | undefined,
  fallback = "provider_execution_failed"
): string {
  const candidate = value?.trim() || fallback;
  return containsForbiddenExecutionMaterial(candidate) ? fallback : candidate;
}

function sanitizeProviderFailureReason(reason: string): string {
  const candidate = reason.trim();
  if (candidate.length === 0) {
    return "provider_execution_reason_unknown";
  }

  return containsForbiddenExecutionMaterial(candidate)
    ? "provider_execution_reason_redacted"
    : candidate;
}

function sanitizeProviderFailureReasons(reasons: string[]): string[] {
  return uniqueStrings(reasons.map(sanitizeProviderFailureReason));
}

function sanitizeJsonValue(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return containsForbiddenExecutionMaterial(value)
      ? "<redacted>"
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue);
  }

  if (!isRecord(value)) {
    return null;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isForbiddenExecutionMaterialKey(key)) {
      sanitized[key] = "<redacted>";
      continue;
    }
    sanitized[key] = sanitizeJsonValue(nestedValue);
  }

  return sanitized;
}

function containsForbiddenExecutionMaterial(value: unknown): boolean {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return [
    "requestedAction",
    "raw command",
    "raw task envelope",
    "raw env",
    "raw token",
    "raw patch",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer",
    "\"prompt\"",
    "\"args\"",
    "\"stdout\"",
    "\"stderr\""
  ].some((marker) => serialized.includes(marker));
}

function isForbiddenExecutionMaterialKey(key: string): boolean {
  return [
    "prompt",
    "args",
    "argv",
    "stdout",
    "stderr",
    "environment",
    "env",
    "token",
    "secret",
    "patch"
  ].includes(key);
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function sortedUniqueStrings(values: string[]): string[] {
  return uniqueStrings(values).sort();
}

function equalStringSets(left: string[], right: string[]): boolean {
  const normalizedLeft = sortedUniqueStrings(left);
  const normalizedRight = sortedUniqueStrings(right);

  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
