import { createHash } from "node:crypto";
import { z } from "zod";
import {
  parseTaskEnvelope,
  type TaskEnvelope,
  type TaskEnvelopeInput
} from "../../contracts/src/index.js";
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
  applyExecutionFailureToGovernanceState
} from "../../governance-failure-reducer/src/index.js";
import {
  createExecutionObservationRef,
  createObservationId,
  parseExecutionObservation,
  type ExecutionObservationBus
} from "../../execution-observation/src/index.js";
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
  createProviderExecutionPermitConsumptionKey,
  hashExecutorExecutionPlan,
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
import {
  createRecoveryOperatorAction,
  shouldLockdown,
  type ArbitrationPacket,
  type RecoveryOperatorAction,
  type RecoveryRecommendation
} from "../../recovery-control/src/index.js";
import {
  createSafeAuditDetails,
  redactText
} from "../../redaction/src/index.js";
import type {
  AnomalyRecord,
  GovernanceState
} from "../../state-manager/src/index.js";
import type {
  StrategyDecisionV2
} from "../../strategy-router/src/index.js";

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

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const NullableSha256Schema = z.union([Sha256Schema, z.null()]);
const NullableStringSchema = z.union([z.string().min(1), z.null()]);
const NullableBooleanSchema = z.union([z.boolean(), z.null()]);

export const ControlledReadOnlyExecutionEvidenceSchema = z.object({
  schemaVersion: z.literal("provider-execution-controlled-readonly-evidence.v2"),
  control: z.object({
    mode: z.literal("controlled-read-only"),
    dryRun: z.literal(false),
    status: ControlledReadOnlyProviderExecutionRunnerStatusSchema,
    providerExecuteInvoked: z.boolean(),
    providerExecuteAuthorized: z.boolean(),
    canWriteWorkspace: z.literal(false),
    workspaceWriteScope: z.literal("none"),
    generalWorkspaceWriteAuthorized: z.literal(false),
    localCommandAuthorized: z.literal(false),
    protectedRemoteAuthorized: z.literal(false),
    externalWriteAuthorized: z.literal(false),
    sandboxMode: z.string().min(1),
    approvalPolicy: z.literal("never")
  }),
  bindings: z.object({
    task: z.object({
      taskId: z.string().min(1),
      taskHash: NullableSha256Schema
    }),
    run: z.object({
      runId: z.string().min(1)
    }),
    principal: z.object({
      principalId: NullableStringSchema,
      principalHash: NullableSha256Schema
    }),
    policy: z.object({
      decisionId: z.string().min(1),
      policyDecisionHash: Sha256Schema
    }),
    providerExecutionPlan: z.object({
      planId: z.string().min(1),
      providerExecutionPlanHash: Sha256Schema,
      providerId: z.string().min(1),
      providerManifestHash: NullableSha256Schema,
      sideEffectClass: z.string().min(1),
      sandboxProfileId: z.string().min(1)
    }),
    executorPlan: z.object({
      present: z.boolean(),
      planId: NullableStringSchema,
      executorPlanHash: NullableSha256Schema,
      providerExecutionPlanHash: NullableSha256Schema,
      providerManifestHash: NullableSha256Schema
    }),
    providerRegistrySelection: z.object({
      present: z.boolean(),
      selected: NullableBooleanSchema,
      providerId: NullableStringSchema,
      manifestHash: NullableSha256Schema,
      kind: NullableStringSchema,
      enabled: NullableBooleanSchema,
      selectionHash: NullableSha256Schema
    }),
    environmentPreflight: z.object({
      present: z.boolean(),
      status: NullableStringSchema,
      artifactRef: NullableStringSchema,
      artifactHash: NullableSha256Schema,
      checksHash: NullableSha256Schema,
      blockingReasonCount: z.number().int().nonnegative()
    }),
    permit: z.object({
      present: z.boolean(),
      permitId: NullableStringSchema,
      planId: NullableStringSchema,
      planHash: NullableSha256Schema,
      providerExecutionPlanHash: NullableSha256Schema,
      providerManifestHash: NullableSha256Schema,
      policyDecisionHash: NullableSha256Schema,
      principalId: NullableStringSchema,
      principalHash: NullableSha256Schema,
      consumptionKey: NullableSha256Schema,
      nonceHash: NullableSha256Schema,
      consumedAtPresent: z.boolean(),
      consumptionStatus: z.enum([
        "missing",
        "input_unconsumed",
        "input_already_consumed"
      ])
    }),
    report: z.object({
      artifactId: z.string().min(1)
    })
  }),
  execution: z.object({
    executorPlanPresent: z.boolean(),
    executorPlanId: NullableStringSchema,
    executorPlanApprovalRequired: NullableBooleanSchema,
    providerResultOk: z.union([z.boolean(), z.null()]),
    failureClass: NullableStringSchema
  }),
  evidencePolicy: z.object({
    inputMaterialStored: z.literal(false),
    argvStored: z.literal(false),
    processOutputStored: z.literal(false),
    diagnosticOutputStored: z.literal(false),
    environmentValuesStored: z.literal(false),
    patchBodyStored: z.literal(false)
  }),
  reasons: z.array(z.string().min(1))
});

export type ControlledReadOnlyExecutionEvidence =
  z.infer<typeof ControlledReadOnlyExecutionEvidenceSchema>;

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
  governanceState?: GovernanceState;
  taskEnvelope?: TaskEnvelopeInput;
  observationBus?: ExecutionObservationBus;
  onGovernanceUpdate?: (
    state: GovernanceState,
    strategy: StrategyDecisionV2
  ) => Promise<void>;
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
  executorPlan?: Record<string, unknown>;
  validation?: ExecutionValidationResult;
  providerResultSummary?: Record<string, unknown>;
  failureClass?: string;
  executionEvidence?: ControlledReadOnlyExecutionEvidence;
  governance?: ControlledReadOnlyProviderExecutionGovernance;
  reportArtifact?: StoredArtifact;
  kernelArtifact?: Artifact;
};

export type ControlledReadOnlyProviderExecutionGovernance = {
  schemaVersion: "provider-execution-controlled-readonly-governance.v1";
  state: GovernanceState;
  strategyDecision: StrategyDecisionV2;
  arbitrationPacket: ArbitrationPacket;
  anomaly: AnomalyRecord;
  evidenceRefs: string[];
  recoveryRequired: boolean;
  lockdown: boolean;
  recoveryRecommendation?: RecoveryRecommendation;
  operatorAction?: RecoveryOperatorAction;
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
    principal,
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
      ...(providerExecutionPlan.taskHash !== undefined ? { taskHash: providerExecutionPlan.taskHash } : {}),
      ...(providerExecutionPlan.principalId !== undefined ? { principalId: providerExecutionPlan.principalId } : {}),
      ...(providerExecutionPlan.principalHash !== undefined ? { principalHash: providerExecutionPlan.principalHash } : {}),
      providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan),
      ...(providerExecutionPlan.providerManifestHash !== undefined
        ? { providerManifestHash: providerExecutionPlan.providerManifestHash }
        : {}),
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
  const governanceBridge = prepareControlledReadOnlyGovernanceBridge({
    input,
    task
  });
  const createdAt = input.now();
  const eventIds: string[] = [];
  const artifactIds: string[] = [];
  const mode = (input as { mode?: unknown }).mode;
  const providerEntry = input.providerRegistry.getProvider(providerExecutionPlan.providerId);
  const providerAttestation = providerEntry === undefined
    ? undefined
    : createProviderAttestation(providerEntry.manifest, createdAt);
  const preflightReasons = uniqueStrings([
    ...governanceBridge.reasons,
    ...collectControlledReadOnlyPreflightReasons({
      mode,
      providerExecutionPlan,
      task,
      run,
      principal,
      policyDecision,
      providerRegistry: input.providerRegistry,
      ...(input.permit !== undefined ? { permit: input.permit } : {}),
      ...(input.executionMetadata !== undefined
        ? { executionMetadata: input.executionMetadata }
        : {})
    })
  ]);

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
          ...(providerExecutionPlan.taskHash !== undefined ? { taskHash: providerExecutionPlan.taskHash } : {}),
          ...(providerExecutionPlan.principalId !== undefined ? { principalId: providerExecutionPlan.principalId } : {}),
          ...(providerExecutionPlan.principalHash !== undefined
            ? { principalHash: providerExecutionPlan.principalHash }
            : {}),
          providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan),
          ...(providerExecutionPlan.providerManifestHash !== undefined
            ? { providerManifestHash: providerExecutionPlan.providerManifestHash }
            : {}),
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
      ...(providerAttestation !== undefined ? { providerAttestation } : {}),
      ...(governanceBridge.taskEnvelope !== undefined
        ? { governanceTaskEnvelope: governanceBridge.taskEnvelope }
        : {})
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
      ...(governanceBridge.taskEnvelope !== undefined
        ? { governanceTaskEnvelope: governanceBridge.taskEnvelope }
        : {}),
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
      reasons: [`provider_validation_failed:${normalizeSafeErrorMessage(error)}`]
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
      ...(governanceBridge.taskEnvelope !== undefined
        ? { governanceTaskEnvelope: governanceBridge.taskEnvelope }
        : {}),
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
          reasonPrefix: "controlled_readonly_provider_execution_permit",
          now: input.now()
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
      ...(governanceBridge.taskEnvelope !== undefined
        ? { governanceTaskEnvelope: governanceBridge.taskEnvelope }
        : {}),
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
      ...(governanceBridge.taskEnvelope !== undefined
        ? { governanceTaskEnvelope: governanceBridge.taskEnvelope }
        : {}),
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
      ...(governanceBridge.taskEnvelope !== undefined
        ? { governanceTaskEnvelope: governanceBridge.taskEnvelope }
        : {}),
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

function prepareControlledReadOnlyGovernanceBridge(input: {
  input: RunProviderExecutionPlanControlledReadOnlyInput;
  task: Task;
}): {
  reasons: string[];
  taskEnvelope?: TaskEnvelope;
} {
  if (
    input.input.governanceState === undefined &&
    input.input.taskEnvelope === undefined
  ) {
    return { reasons: [] };
  }

  const reasons: string[] = [];
  let taskEnvelope: TaskEnvelope | undefined = undefined;

  if (input.input.governanceState === undefined) {
    reasons.push("controlled_readonly_provider_governance_state_required");
  }

  if (input.input.taskEnvelope === undefined) {
    reasons.push("controlled_readonly_provider_governance_task_envelope_required");
  } else {
    try {
      taskEnvelope = parseTaskEnvelope(input.input.taskEnvelope);
    } catch {
      reasons.push("controlled_readonly_provider_governance_task_envelope_invalid");
    }
  }

  if (
    input.input.governanceState !== undefined &&
    input.input.governanceState.taskId !== input.task.taskId
  ) {
    reasons.push(
      `controlled_readonly_provider_governance_state_task_mismatch:${input.input.governanceState.taskId}:${input.task.taskId}`
    );
  }

  if (taskEnvelope !== undefined && taskEnvelope.taskId !== input.task.taskId) {
    reasons.push(
      `controlled_readonly_provider_governance_task_envelope_mismatch:${taskEnvelope.taskId}:${input.task.taskId}`
    );
  }

  if (
    input.input.governanceState !== undefined &&
    taskEnvelope !== undefined &&
    input.input.governanceState.taskId !== taskEnvelope.taskId
  ) {
    reasons.push(
      `controlled_readonly_provider_governance_state_envelope_mismatch:${input.input.governanceState.taskId}:${taskEnvelope.taskId}`
    );
  }

  return reasons.length === 0 && taskEnvelope !== undefined
    ? { reasons, taskEnvelope }
    : { reasons };
}

async function createControlledReadOnlyProviderExecutionGovernance(input: {
  input: RunProviderExecutionPlanControlledReadOnlyInput;
  providerExecutionPlan: ProviderExecutionPlan;
  status: ControlledReadOnlyProviderExecutionRunnerStatus;
  reasons: string[];
  completedAt: string;
  reportArtifact: StoredArtifact;
  taskEnvelope?: TaskEnvelope;
  failureClass?: string;
}): Promise<ControlledReadOnlyProviderExecutionGovernance | undefined> {
  if (!controlledReadOnlyStatusUpdatesGovernance(input.status)) {
    return undefined;
  }
  if (
    input.input.governanceState === undefined ||
    input.taskEnvelope === undefined
  ) {
    return undefined;
  }

  const primitiveId = [
    "controlled_readonly_provider",
    input.providerExecutionPlan.providerId,
    input.providerExecutionPlan.planId
  ].join(":");
  const errorClass = createControlledReadOnlyProviderGovernanceErrorClass({
    status: input.status,
    reasons: input.reasons,
    ...(input.failureClass !== undefined ? { failureClass: input.failureClass } : {})
  });
  const evidenceRefs = await emitControlledReadOnlyProviderFailureObservationRefs({
    ...(input.input.observationBus !== undefined
      ? { observationBus: input.input.observationBus }
      : {}),
    taskId: input.taskEnvelope.taskId,
    primitiveId,
    errorClass,
    reportArtifactId: input.reportArtifact.artifactId,
    createdAt: input.completedAt
  });

  const failureResult = applyExecutionFailureToGovernanceState({
    state: input.input.governanceState,
    task: input.taskEnvelope,
    primitiveId,
    errorClass,
    evidenceRefs,
    stepIndex: 0,
    now: () => input.completedAt
  });

  if (input.input.onGovernanceUpdate !== undefined) {
    await input.input.onGovernanceUpdate(
      failureResult.state,
      failureResult.strategyDecision
    );
  }

  const recoveryRequired =
    failureResult.strategyDecision.actionFamily === "step_back" ||
    failureResult.strategyDecision.actionFamily === "abort";
  const lockdown = shouldLockdown(failureResult.arbitrationPacket) ||
    failureResult.strategyDecision.actionFamily === "abort";
  const recoveryRecommendation = recoveryRequired
    ? failureResult.arbitrationPacket.recoveryRecommendation
    : undefined;
  const operatorAction = recoveryRecommendation === undefined
    ? undefined
    : createRecoveryOperatorAction({
        arbitrationPacket: failureResult.arbitrationPacket,
        recoveryRecommendation,
        lockdown,
        blockingReasons: createControlledReadOnlyProviderGovernanceBlockingReasons(
          failureResult.strategyDecision
        )
      });

  return {
    schemaVersion: "provider-execution-controlled-readonly-governance.v1",
    state: failureResult.state,
    strategyDecision: failureResult.strategyDecision,
    arbitrationPacket: failureResult.arbitrationPacket,
    anomaly: failureResult.anomaly,
    evidenceRefs,
    recoveryRequired,
    lockdown,
    ...(recoveryRecommendation !== undefined ? { recoveryRecommendation } : {}),
    ...(operatorAction !== undefined ? { operatorAction } : {})
  };
}

function controlledReadOnlyStatusUpdatesGovernance(
  status: ControlledReadOnlyProviderExecutionRunnerStatus
): boolean {
  return status === "provider_plan_failed" ||
    status === "validation_failed" ||
    status === "execution_failed";
}

async function emitControlledReadOnlyProviderFailureObservationRefs(input: {
  observationBus?: ExecutionObservationBus;
  taskId: string;
  primitiveId: string;
  errorClass: string;
  reportArtifactId: string;
  createdAt: string;
}): Promise<string[]> {
  if (input.observationBus === undefined) {
    return [];
  }

  const observationId = createObservationId({
    taskId: input.taskId,
    primitiveId: input.primitiveId,
    status: "failed",
    createdAt: input.createdAt
  });
  await input.observationBus.emit(parseExecutionObservation({
    observationId,
    taskId: input.taskId,
    primitiveId: input.primitiveId,
    stage: "controlled_readonly_provider_execution",
    status: "failed",
    signals: { errorClass: input.errorClass },
    evidenceRef: `artifact:${input.reportArtifactId}`,
    createdAt: input.createdAt
  }));

  return [createExecutionObservationRef(observationId)];
}

function createControlledReadOnlyProviderGovernanceErrorClass(input: {
  status: ControlledReadOnlyProviderExecutionRunnerStatus;
  reasons: string[];
  failureClass?: string;
}): string {
  return sanitizeProviderFailureClass(
    input.failureClass ?? input.reasons[0],
    `controlled_readonly_provider_${input.status}`
  );
}

function createControlledReadOnlyProviderGovernanceBlockingReasons(
  strategyDecision: StrategyDecisionV2
): string[] {
  if (
    strategyDecision.actionFamily !== "step_back" &&
    strategyDecision.actionFamily !== "abort"
  ) {
    return [];
  }

  return [
    strategyDecision.actionFamily === "abort"
      ? "governance_abort_triggered"
      : "governance_step_back_triggered",
    "arbitration_required"
  ];
}

function summarizeControlledReadOnlyProviderExecutionGovernance(
  governance: ControlledReadOnlyProviderExecutionGovernance
): Record<string, unknown> {
  return {
    schemaVersion: governance.schemaVersion,
    taskId: governance.state.taskId,
    anomalyId: governance.anomaly.anomalyId,
    anomalyCount: governance.state.anomalies.length,
    latestStrikeNumber: governance.anomaly.strikeNumber,
    actionFamily: governance.strategyDecision.actionFamily,
    arbitrationTrigger: governance.arbitrationPacket.trigger,
    evidenceRefCount: governance.evidenceRefs.length,
    recoveryRequired: governance.recoveryRequired,
    lockdown: governance.lockdown,
    ...(governance.operatorAction !== undefined
      ? {
          operatorAction: {
            status: governance.operatorAction.status,
            trigger: governance.operatorAction.trigger,
            recommendedAction: governance.operatorAction.recommendedAction,
            requiresHumanApproval: governance.operatorAction.requiresHumanApproval,
            lockdown: governance.operatorAction.lockdown
          }
        }
      : {})
  };
}

function collectRunnerPreflightReasons(input: {
  mode: unknown;
  providerExecutionPlan: ProviderExecutionPlan;
  task: Task;
  run: Run;
  principal: Principal;
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

  const expectedTaskHash = hashProviderExecutionPlannerObject(input.task);
  if (input.providerExecutionPlan.taskHash === undefined) {
    reasons.push("provider_plan_task_hash_required");
  } else if (input.providerExecutionPlan.taskHash !== expectedTaskHash) {
    reasons.push("provider_plan_task_hash_mismatch");
  }

  if (input.providerExecutionPlan.principalId === undefined) {
    reasons.push("provider_plan_principal_required");
  } else if (input.providerExecutionPlan.principalId !== input.principal.principalId) {
    reasons.push(
      `provider_plan_principal_mismatch:${input.providerExecutionPlan.principalId}:${input.principal.principalId}`
    );
  }

  const expectedPrincipalHash = hashProviderExecutionPlannerObject(input.principal);
  if (input.providerExecutionPlan.principalHash === undefined) {
    reasons.push("provider_plan_principal_hash_required");
  } else if (input.providerExecutionPlan.principalHash !== expectedPrincipalHash) {
    reasons.push("provider_plan_principal_hash_mismatch");
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
  principal: Principal;
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
    principal: input.principal,
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

  if (executorPlan.taskHash !== providerExecutionPlan.taskHash) {
    reasons.push("executor_plan_task_hash_mismatch");
  }

  if (executorPlan.runId !== providerExecutionPlan.runId) {
    reasons.push(`executor_plan_run_mismatch:${executorPlan.runId}:${providerExecutionPlan.runId}`);
  }

  if (executorPlan.principalId !== providerExecutionPlan.principalId) {
    reasons.push("executor_plan_principal_mismatch");
  }

  if (executorPlan.principalHash !== providerExecutionPlan.principalHash) {
    reasons.push("executor_plan_principal_hash_mismatch");
  }

  if (executorPlan.providerId !== providerExecutionPlan.providerId) {
    reasons.push(
      `executor_plan_provider_mismatch:${executorPlan.providerId}:${providerExecutionPlan.providerId}`
    );
  }

  const expectedProviderExecutionPlanHash = hashProviderExecutionPlannerObject(providerExecutionPlan);
  if (executorPlan.providerExecutionPlanHash !== expectedProviderExecutionPlanHash) {
    reasons.push("executor_plan_provider_execution_plan_hash_mismatch");
  }

  if (
    providerExecutionPlan.providerManifestHash !== undefined
    && executorPlan.providerManifestHash !== providerExecutionPlan.providerManifestHash
  ) {
    reasons.push("executor_plan_provider_manifest_hash_mismatch");
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
  governanceTaskEnvelope?: TaskEnvelope;
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
  const validation = input.validation === undefined
    ? undefined
    : sanitizeExecutionValidationResult(input.validation);
  const executorPlanSummary = input.executorPlan === undefined
    ? undefined
    : summarizeExecutorPlan(input.executorPlan);
  const providerResultSummary = input.providerResultSummary === undefined
    ? undefined
    : sanitizeSafeRecord(input.providerResultSummary);
  const reportArtifactId = createArtifactId(
    input.providerExecutionPlan.planId,
    input.status,
    completedAt
  );
  const executionEvidence = createControlledReadOnlyExecutionEvidence({
    input: input.input,
    providerExecutionPlan: input.providerExecutionPlan,
    executeInvoked: input.executeInvoked,
    status: input.status,
    reasons,
    reportArtifactId,
    ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
    ...(providerResultSummary !== undefined
      ? { providerResultSummary }
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
    artifactId: reportArtifactId,
    executionEvidence,
    ...(input.providerAttestation !== undefined ? { providerAttestation: input.providerAttestation } : {}),
    ...(executorPlanSummary !== undefined ? { executorPlan: executorPlanSummary } : {}),
    ...(validation !== undefined ? { validation } : {}),
    ...(providerResultSummary !== undefined
      ? { providerResultSummary }
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
  const governance = await createControlledReadOnlyProviderExecutionGovernance({
    input: input.input,
    providerExecutionPlan: input.providerExecutionPlan,
    status: input.status,
    reasons,
    completedAt,
    reportArtifact,
    ...(input.governanceTaskEnvelope !== undefined
      ? { taskEnvelope: input.governanceTaskEnvelope }
      : {}),
    ...(failureClass !== undefined ? { failureClass } : {})
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
      ...(validation !== undefined ? { validation } : {}),
      ...(executorPlanSummary !== undefined
        ? { executorPlan: executorPlanSummary }
        : {}),
      ...(providerResultSummary !== undefined
        ? { providerResultSummary }
        : {}),
      executionEvidence: summarizeControlledReadOnlyExecutionEvidence(executionEvidence),
      ...(governance !== undefined
        ? { governance: summarizeControlledReadOnlyProviderExecutionGovernance(governance) }
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
    ...(governance !== undefined ? { governance } : {}),
    reportArtifact,
    kernelArtifact,
    ...(input.providerAttestation !== undefined
      ? { providerAttestation: input.providerAttestation }
      : {}),
    ...(executorPlanSummary !== undefined ? { executorPlan: executorPlanSummary } : {}),
    ...(validation !== undefined ? { validation } : {}),
    ...(providerResultSummary !== undefined
      ? { providerResultSummary }
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
  artifactId: string;
  executionEvidence: ControlledReadOnlyExecutionEvidence;
  providerAttestation?: ProviderAttestation;
  executorPlan?: Record<string, unknown>;
  validation?: ExecutionValidationResult;
  providerResultSummary?: Record<string, unknown>;
  failureClass?: string;
}): Promise<StoredArtifact> {
  return input.input.artifactStore.putArtifact({
    artifactId: input.artifactId,
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
      ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
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
    taskHash: plan.taskHash,
    runId: plan.runId,
    principalId: plan.principalId,
    principalHash: plan.principalHash,
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
    taskHash: plan.taskHash ?? null,
    runId: plan.runId,
    principalId: plan.principalId ?? null,
    principalHash: plan.principalHash ?? null,
    providerExecutionPlanHash: plan.providerExecutionPlanHash ?? null,
    providerManifestHash: plan.providerManifestHash ?? null,
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
          artifacts: result.artifacts.map((artifact, index) => summarizeProviderArtifact(artifact, index))
        }
      : {})
  };
}

function summarizeProviderArtifact(
  artifact: Artifact,
  index: number
): Record<string, unknown> {
  return sanitizeSafeRecord({
    artifactIndex: index,
    artifactRef: shortHash({
      artifactId: artifact.artifactId,
      uri: artifact.uri,
      kind: artifact.kind,
      sha256: artifact.sha256
    }),
    kind: artifact.kind,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    createdAt: artifact.createdAt,
    summary: isRecord(artifact.metadata) && isRecord(artifact.metadata.summary)
      ? sanitizeJsonValue(artifact.metadata.summary)
      : undefined
  });
}

function createControlledReadOnlyExecutionEvidence(input: {
  input: RunProviderExecutionPlanControlledReadOnlyInput;
  providerExecutionPlan: ProviderExecutionPlan;
  status: ControlledReadOnlyProviderExecutionRunnerStatus;
  executeInvoked: boolean;
  reasons: string[];
  reportArtifactId: string;
  executorPlan?: ExecutorExecutionPlan;
  providerResultSummary?: Record<string, unknown>;
  failureClass?: string;
}): ControlledReadOnlyExecutionEvidence {
  const selection = readProviderRegistrySelection(input.input.executionMetadata);
  const environmentPreflight = readEnvironmentPreflight(input.input.executionMetadata);
  const permit = input.input.permit;

  return ControlledReadOnlyExecutionEvidenceSchema.parse({
    schemaVersion: "provider-execution-controlled-readonly-evidence.v2",
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
    bindings: {
      task: {
        taskId: input.providerExecutionPlan.taskId,
        taskHash: input.providerExecutionPlan.taskHash ?? null
      },
      run: {
        runId: input.providerExecutionPlan.runId
      },
      principal: {
        principalId: input.providerExecutionPlan.principalId ?? null,
        principalHash: input.providerExecutionPlan.principalHash ?? null
      },
      policy: {
        decisionId: input.input.policyDecision.decisionId,
        policyDecisionHash: input.providerExecutionPlan.policyDecisionHash
      },
      providerExecutionPlan: {
        planId: input.providerExecutionPlan.planId,
        providerExecutionPlanHash: hashProviderExecutionPlannerObject(input.providerExecutionPlan),
        providerId: input.providerExecutionPlan.providerId,
        providerManifestHash: input.providerExecutionPlan.providerManifestHash ?? null,
        sideEffectClass: input.providerExecutionPlan.sideEffectClass,
        sandboxProfileId: input.providerExecutionPlan.sandboxProfile.sandboxId
      },
      executorPlan: {
        present: input.executorPlan !== undefined,
        planId: input.executorPlan?.planId ?? null,
        executorPlanHash: input.executorPlan === undefined
          ? null
          : hashExecutorExecutionPlan(input.executorPlan),
        providerExecutionPlanHash: input.executorPlan?.providerExecutionPlanHash ?? null,
        providerManifestHash: input.executorPlan?.providerManifestHash ?? null
      },
      providerRegistrySelection: {
        present: selection !== undefined,
        selected: readBooleanField(selection, "selected"),
        providerId: readStringField(selection, "providerId"),
        manifestHash: readSha256Field(selection, "manifestHash"),
        kind: readStringField(selection, "kind"),
        enabled: readBooleanField(selection, "enabled"),
        selectionHash: selection === undefined ? null : hashProviderExecutionPlannerObject({
          selected: readBooleanField(selection, "selected"),
          providerId: readStringField(selection, "providerId"),
          manifestHash: readSha256Field(selection, "manifestHash"),
          kind: readStringField(selection, "kind"),
          enabled: readBooleanField(selection, "enabled")
        })
      },
      environmentPreflight: {
        present: environmentPreflight !== undefined,
        status: readStringField(environmentPreflight, "status"),
        artifactRef: readStringField(environmentPreflight, "artifactRef"),
        artifactHash: readSha256Field(environmentPreflight, "artifactHash"),
        checksHash: environmentPreflight === undefined
          ? null
          : hashProviderExecutionPlannerObject(readEnvironmentPreflightChecks(environmentPreflight)),
        blockingReasonCount: readStringArrayField(environmentPreflight, "blockingReasons").length
      },
      permit: {
        present: permit !== undefined,
        permitId: permit?.permitId ?? null,
        planId: permit?.planId ?? null,
        planHash: toNullableSha256(permit?.planHash),
        providerExecutionPlanHash: toNullableSha256(permit?.providerExecutionPlanHash),
        providerManifestHash: toNullableSha256(permit?.providerManifestHash),
        policyDecisionHash: toNullableSha256(permit?.policyDecisionHash),
        principalId: permit?.principalId ?? null,
        principalHash: toNullableSha256(permit?.principalHash),
        consumptionKey: permit === undefined
          ? null
          : createProviderExecutionPermitConsumptionKey(permit),
        nonceHash: permit === undefined
          ? null
          : hashProviderExecutionPlannerObject({ nonce: permit.nonce }),
        consumedAtPresent: permit?.consumedAt !== undefined,
        consumptionStatus: permit === undefined
          ? "missing"
          : permit.consumedAt === undefined
            ? "input_unconsumed"
            : "input_already_consumed"
      },
      report: {
        artifactId: input.reportArtifactId
      }
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
  });
}

function summarizeControlledReadOnlyExecutionEvidence(
  evidence: ControlledReadOnlyExecutionEvidence
): Record<string, unknown> {
  return {
    schemaVersion: "provider-execution-controlled-readonly-evidence-summary.v1",
    status: evidence.control.status,
    providerExecuteInvoked: evidence.control.providerExecuteInvoked,
    reportArtifactId: evidence.bindings.report.artifactId,
    providerId: evidence.bindings.providerExecutionPlan.providerId,
    providerExecutionPlanHash: evidence.bindings.providerExecutionPlan.providerExecutionPlanHash,
    executorPlanHash: evidence.bindings.executorPlan.executorPlanHash,
    providerManifestHash: evidence.bindings.providerExecutionPlan.providerManifestHash,
    policyDecisionHash: evidence.bindings.policy.policyDecisionHash,
    principalHash: evidence.bindings.principal.principalHash,
    permitId: evidence.bindings.permit.permitId,
    permitConsumptionStatus: evidence.bindings.permit.consumptionStatus,
    providerRegistrySelectionHash: evidence.bindings.providerRegistrySelection.selectionHash,
    environmentPreflightArtifactRef: evidence.bindings.environmentPreflight.artifactRef,
    environmentPreflightArtifactHash: evidence.bindings.environmentPreflight.artifactHash,
    evidencePolicy: evidence.evidencePolicy
  };
}

function readProviderRegistrySelection(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const guard = readControlledReadOnlyGuard(metadata);
  const selection = guard?.providerRegistrySelection;
  return isRecord(selection) ? selection : undefined;
}

function readEnvironmentPreflight(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const guard = readControlledReadOnlyGuard(metadata);
  const preflight = guard?.environmentPreflight;
  return isRecord(preflight) ? preflight : undefined;
}

function readControlledReadOnlyGuard(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }

  const guard = metadata.codexCliProviderRealExecutionGuard;
  return isRecord(guard) ? guard : undefined;
}

function readEnvironmentPreflightChecks(
  preflight: Record<string, unknown>
): Record<string, unknown> {
  const checks = preflight.checks;
  if (!isRecord(checks)) {
    return {};
  }

  return {
    injectedSpawner: readBooleanField(checks, "injectedSpawner"),
    realCliAllowed: readBooleanField(checks, "realCliAllowed"),
    versionProbe: readStringField(checks, "versionProbe"),
    noTaskEnvelope: readBooleanField(checks, "noTaskEnvelope"),
    noPromptSent: readBooleanField(checks, "noPromptSent"),
    noWorkspaceWrite: readBooleanField(checks, "noWorkspaceWrite"),
    noRealCliFallback: readBooleanField(checks, "noRealCliFallback")
  };
}

function createControlledReadOnlyPreflightArtifactRef(
  selection: Record<string, unknown>
): string | undefined {
  const providerId = readStringField(selection, "providerId");
  return providerId === null
    ? undefined
    : `artifact://controlled-readonly-provider-execution/preflight/${providerId}`;
}

function createControlledReadOnlyPreflightArtifactHash(
  selection: Record<string, unknown>,
  preflight: Record<string, unknown>
): string | undefined {
  const providerId = readStringField(selection, "providerId");
  const manifestHash = readSha256Field(selection, "manifestHash");
  const status = readStringField(preflight, "status");
  if (providerId === null || manifestHash === null || status === null) {
    return undefined;
  }

  return hashProviderExecutionPlannerObject({
    schemaVersion: "controlled-readonly-provider-execution-preflight.v1",
    providerRegistrySelection: {
      selected: readBooleanField(selection, "selected"),
      providerId,
      manifestHash,
      kind: readStringField(selection, "kind"),
      enabled: readBooleanField(selection, "enabled")
    },
    environmentPreflight: {
      status,
      checks: readEnvironmentPreflightChecks(preflight),
      blockingReasonCount: readStringArrayField(preflight, "blockingReasons").length
    }
  });
}

function readStringField(
  record: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readSha256Field(
  record: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = readStringField(record, key);
  return value !== null && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function toNullableSha256(value: string | undefined): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
    ? value
    : null;
}

function readBooleanField(
  record: Record<string, unknown> | undefined,
  key: string
): boolean | null {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

function readStringArrayField(
  record: Record<string, unknown> | undefined,
  key: string
): string[] {
  const value = record?.[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
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

  const preflightArtifactRef = readStringField(preflight, "artifactRef");
  const expectedPreflightArtifactRef =
    createControlledReadOnlyPreflightArtifactRef(selection);
  if (preflightArtifactRef === null) {
    reasons.push("controlled_readonly_environment_preflight_artifact_ref_required");
  } else if (
    expectedPreflightArtifactRef !== undefined
    && preflightArtifactRef !== expectedPreflightArtifactRef
  ) {
    reasons.push("controlled_readonly_environment_preflight_artifact_ref_mismatch");
  }

  const preflightArtifactHash = readSha256Field(preflight, "artifactHash");
  const expectedPreflightArtifactHash =
    createControlledReadOnlyPreflightArtifactHash(selection, preflight);
  if (preflightArtifactHash === null) {
    reasons.push("controlled_readonly_environment_preflight_artifact_hash_required");
  } else if (
    expectedPreflightArtifactHash !== undefined
    && preflightArtifactHash !== expectedPreflightArtifactHash
  ) {
    reasons.push("controlled_readonly_environment_preflight_artifact_hash_mismatch");
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
  return sanitizeSafeRecord({
    code: sanitizeProviderFailureClass(
      typeof error.code === "string" ? error.code : undefined
    ),
    reasons: Array.isArray(error.reasons)
      ? sanitizeProviderFailureReasons(
          error.reasons.filter((reason): reason is string => typeof reason === "string")
        )
      : []
  });
}

function sanitizeExecutionValidationResult(
  validation: ExecutionValidationResult
): ExecutionValidationResult {
  return {
    valid: validation.valid,
    reasons: sanitizeProviderFailureReasons(validation.reasons)
  };
}

function sanitizeProviderFailureClass(
  value: string | undefined,
  fallback = "provider_execution_failed"
): string {
  const candidate = value?.trim() || fallback;
  return containsForbiddenExecutionMaterial(candidate) ? fallback : candidate;
}

function sanitizeProviderFailureReason(reason: string): string {
  const candidate = sanitizeSafeText(reason.trim(), "provider_execution_reason_unknown", 256);
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
    const sanitized = sanitizeSafeText(value, "<redacted>", 512);
    return containsForbiddenExecutionMaterial(sanitized)
      ? "<redacted>"
      : sanitized;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeJsonValue);
  }

  if (!isRecord(value)) {
    return null;
  }

  const sanitized: Record<string, unknown> = {};
  let omittedUnsafeFields = 0;
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isForbiddenExecutionMaterialKey(key)) {
      omittedUnsafeFields += 1;
      continue;
    }
    sanitized[key] = sanitizeJsonValue(nestedValue);
  }

  if (omittedUnsafeFields > 0) {
    sanitized.omittedUnsafeFields = omittedUnsafeFields;
  }

  return sanitized;
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

function isForbiddenExecutionMaterialKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return new Set([
    "prompt",
    "args",
    "argv",
    "stdout",
    "stderr",
    "environment",
    "env",
    "processenv",
    "processenvironment",
    "token",
    "secret",
    "patch",
    "authorization",
    "apikey",
    "accesskey",
    "accesstoken",
    "clientsecret",
    "output",
    "rawoutput",
    "rawstdout",
    "rawstderr",
    "rawprompt",
    "rawenv",
    "rawtoken",
    "command",
    "workdir",
    "cwd",
    "requestedaction"
  ]).has(normalized);
}

function sanitizeSafeRecord(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeJsonValue(value);
  const record = isRecord(sanitized) ? sanitized : {};
  return createSafeAuditDetails(record, {
    additionalSecretKeys: [
      "prompt",
      "args",
      "argv",
      "stdout",
      "stderr",
      "environment",
      "env",
      "processEnv",
      "authorization",
      "apiKey",
      "accessToken",
      "clientSecret",
      "output",
      "command",
      "workdir",
      "cwd"
    ],
    maxFieldChars: 512,
    maxRecordChars: 8192
  });
}

function sanitizeSafeText(
  value: string,
  fallback: string,
  maxFieldChars: number
): string {
  const redacted = redactText(value, {
    additionalSecretKeys: [
      "prompt",
      "args",
      "argv",
      "stdout",
      "stderr",
      "environment",
      "env",
      "processEnv",
      "authorization",
      "apiKey",
      "accessToken",
      "clientSecret",
      "output",
      "command",
      "workdir",
      "cwd"
    ],
    maxFieldChars
  }).trim();
  return redacted || fallback;
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
