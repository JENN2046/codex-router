import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  ArtifactStore,
  StoredArtifact
} from "../../artifact-store/src/index.js";
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
  ExecutorExecutionPlanSchema,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider
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
  executorPlan?: ExecutorExecutionPlan;
  validation?: ExecutionValidationResult;
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
      createdAt
    });
  }

  const entry = input.providerRegistry.getProvider(providerExecutionPlan.providerId);
  if (entry === undefined || !isExecutorProvider(entry.provider)) {
    return finalizeRunnerResult({
      input,
      providerExecutionPlan,
      status: "blocked",
      reasons: [`provider_not_executable:${providerExecutionPlan.providerId}`],
      eventIds,
      artifactIds,
      createdAt
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
    executorPlan = ExecutorExecutionPlanSchema.parse(await entry.provider.planExecution({
      task,
      run,
      policyDecision,
      sandboxProfile: providerExecutionPlan.sandboxProfile,
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
      createdAt
    });
  }

  let validation: ExecutionValidationResult;
  try {
    validation = await entry.provider.validateExecutionPlan(executorPlan);
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
    executorPlan,
    validation
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

  const entry = input.providerRegistry.getProvider(input.providerExecutionPlan.providerId);
  if (entry === undefined) {
    reasons.push(`provider_not_found:${input.providerExecutionPlan.providerId}`);
  } else if (entry.manifest.kind !== input.providerExecutionPlan.providerKind) {
    reasons.push(
      `provider_kind_mismatch:${entry.manifest.kind}:${input.providerExecutionPlan.providerKind}`
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
    ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
    ...(input.validation !== undefined ? { validation: input.validation } : {})
  });
  input.artifactIds.push(reportArtifact.artifactId);

  const kernelArtifact = createKernelArtifactForReport({
    input: input.input,
    providerExecutionPlan: input.providerExecutionPlan,
    reportArtifact
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
    ...(input.executorPlan !== undefined ? { executorPlan: input.executorPlan } : {}),
    ...(input.validation !== undefined ? { validation: input.validation } : {})
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
      ...(input.executorPlan !== undefined
        ? { executorPlan: summarizeExecutorPlan(input.executorPlan) }
        : {}),
      ...(input.validation !== undefined ? { validation: input.validation } : {})
    },
    metadata: {
      providerId: input.providerExecutionPlan.providerId,
      providerKind: input.providerExecutionPlan.providerKind,
      status: input.status,
      dryRun: true
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
  input: RunProviderExecutionPlanDryRunInput;
  providerExecutionPlan: ProviderExecutionPlan;
  reportArtifact: StoredArtifact;
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
      dryRun: true
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

function eventStatusSuffix(status: ProviderExecutionRunnerStatus): string {
  switch (status) {
    case "dry_run_succeeded":
      return "succeeded";
    case "blocked":
      return "blocked";
    case "provider_plan_failed":
    case "validation_failed":
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
  status: ProviderExecutionRunnerStatus,
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
