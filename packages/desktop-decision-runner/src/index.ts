import { randomUUID } from "node:crypto";
import type {
  ApprovalDecision,
  CheckpointRef,
  DesktopExecutionPlan,
  IntentClassification,
  RoutingDecision,
  TaskEnvelope,
  TaskEnvelopeInput
} from "../../contracts/src/index.js";
import { parseTaskEnvelope } from "../../contracts/src/index.js";
import { evaluateApprovalRequirement } from "../../approval-gate/src/index.js";
import type {
  AuditEvent,
  CheckpointRecallAdapter,
  MemoryAdapter,
  MemoryOverviewProvider
} from "../../audit-memory/src/index.js";
import { classifyIntent } from "../../intent-gate/src/index.js";
import type { PolicySnapshot } from "../../policy-config/src/index.js";
import {
  getMemoryHealthPolicyPack,
  resolveMemoryHealthPolicyPack
} from "../../policy-config/src/index.js";
import type { PreflightContext, PreflightResult } from "../../preflight/src/index.js";
import { runPreflight } from "../../preflight/src/index.js";
import { routeTask } from "../../routing-engine/src/index.js";
import { planAgentStrategy, type AgentStrategyPlan } from "../../desktop-agent-strategy/src/index.js";
import { createDesktopExecutionPlan } from "../../desktop-bridge/src/index.js";
import { createMemoryPreflightLogEvent, createPreflightLogEvent, type LogEvent } from "../../observability/src/index.js";
import type { TelemetrySink } from "../../observability/src/index.js";
import {
  createInitialGovernanceState,
  type GovernanceState
} from "../../state-manager/src/index.js";
import {
  routeStrategyV2,
  type StrategyDecisionV2
} from "../../strategy-router/src/index.js";

export type DesktopDecisionRunnerStatus =
  | "blocked_preflight"
  | "blocked_approval"
  | "ready";

export interface CheckpointStore {
  record(checkpoint: CheckpointRef): Promise<void>;
}

export interface CheckpointLookup {
  findLatestForTask(taskId: string): Promise<CheckpointRef | undefined>;
}

export interface AuditStore {
  record(event: AuditEvent): Promise<void>;
}

export interface DesktopDecisionRunnerInput {
  task: TaskEnvelopeInput;
  policy: PolicySnapshot;
  preflight: Omit<PreflightContext, "requiredTools" | "requestedToolAccess">;
  availableAgents?: number;
  persistence?: {
    checkpointStore?: CheckpointStore;
    auditStore?: AuditStore;
    memoryAdapter?: MemoryAdapter;
    memoryOverviewProvider?: MemoryOverviewProvider;
    telemetryStore?: TelemetrySink;
  };
  now?: () => string;
}

export type ResumeSource = "memory" | "checkpoint";

export interface DesktopDecisionResumeInput extends DesktopDecisionRunnerInput {
  resume?: {
    memoryRecall?: CheckpointRecallAdapter;
    checkpointStore?: CheckpointLookup;
    preferredSource?: ResumeSource;
    required?: boolean;
    stage?: string;
  };
}

export interface DesktopDecisionRunnerResult {
  status: DesktopDecisionRunnerStatus;
  task: TaskEnvelope;
  intent: IntentClassification;
  decision: RoutingDecision;
  preflight: PreflightResult;
  approval: ApprovalDecision;
  executionPlan: DesktopExecutionPlan;
  agentStrategy: AgentStrategyPlan;
  checkpoint: CheckpointRef;
  auditEvents: AuditEvent[];
  observabilityEvents: LogEvent[];
  blockingReasons: string[];
  resumedFrom?: CheckpointRef;
  resumeSource?: ResumeSource;
}

export async function runDesktopDecision(
  input: DesktopDecisionRunnerInput
): Promise<DesktopDecisionRunnerResult> {
  const task = parseTaskEnvelope(input.task);
  const now = input.now ?? (() => new Date().toISOString());
  const intent = classifyIntent(task);
  const decision = routeTask(task, intent, input.policy);
  const candidateExecutionPlan = createDesktopExecutionPlan(decision);
  const memoryOverview = input.preflight.memoryOverview
    ?? await loadMemoryOverview(input.persistence?.memoryOverviewProvider);
  const explicitMemoryGuidance = input.preflight.memoryExecutionGuidance
    ?? (
      input.preflight.memoryOverviewPolicyPack
        ? getMemoryHealthPolicyPack(input.policy, input.preflight.memoryOverviewPolicyPack).guidance
        : undefined
    );
  const resolvedMemoryPolicyPack = input.preflight.memoryOverviewPolicy
    ? undefined
    : resolveMemoryHealthPolicyPack(input.policy, decision.execution.toolAccess);
  const preflight = runPreflight({
    ...input.preflight,
    ...(memoryOverview !== undefined ? { memoryOverview } : {}),
    ...(explicitMemoryGuidance !== undefined && input.preflight.memoryExecutionGuidance === undefined
      ? { memoryExecutionGuidance: explicitMemoryGuidance }
      : {}),
    ...(resolvedMemoryPolicyPack !== undefined
      ? {
          memoryOverviewPolicyPack: resolvedMemoryPolicyPack.packName,
          memoryExecutionGuidance: resolvedMemoryPolicyPack.guidance,
          memoryOverviewPolicy: resolvedMemoryPolicyPack.healthPolicy,
          requireMemoryOverview: resolvedMemoryPolicyPack.guidance.memoryRequired
            ? true
            : input.preflight.requireMemoryOverview
        }
      : {}),
    requiredTools: deriveRequiredTools(decision, candidateExecutionPlan),
    requestedToolAccess: decision.execution.toolAccess
  });
  const approval = evaluateApprovalRequirement(task, decision, input.policy);
  const agentStrategy = planAgentStrategy(decision, {
    availableAgents: input.availableAgents ?? 1,
    explicitOwnership: task.constraints.explicitOwnership ?? false,
    fileTargets: task.target.files
  });

  const status = resolveStatus(preflight, approval);
  const executionPlan = status === "ready"
    ? createDesktopExecutionPlan(decision, { authorized: true })
    : candidateExecutionPlan;
  const blockingReasons = collectBlockingReasons(preflight, approval);
  const checkpoint = buildCheckpoint(task.taskId, status, blockingReasons, now());
  const auditEvents = buildAuditEvents({
    task,
    intent,
    decision,
    preflight,
    approval,
    status,
    blockingReasons,
    timestamp: checkpoint.createdAt
  });
  const observabilityEvents = buildObservabilityEvents({
    task,
    decision,
    preflight,
    timestamp: checkpoint.createdAt
  });

  await persistRunnerArtifacts(checkpoint, auditEvents, input.persistence);

  return {
    status,
    task,
    intent,
    decision,
    preflight,
    approval,
    executionPlan,
    agentStrategy,
    checkpoint,
    auditEvents,
    observabilityEvents,
    blockingReasons
  };
}

export async function resumeDesktopDecision(
  input: DesktopDecisionResumeInput
): Promise<DesktopDecisionRunnerResult> {
  const task = parseTaskEnvelope(input.task);
  const now = input.now ?? (() => new Date().toISOString());
  const resolvedResume = await resolveResumeCheckpoint(task.taskId, input.resume);

  if (!resolvedResume && input.resume?.required) {
    throw new Error(`resume_checkpoint_not_found:${task.taskId}`);
  }

  const runnerInput: DesktopDecisionRunnerInput = {
    task,
    policy: input.policy,
    preflight: input.preflight,
    ...(input.availableAgents !== undefined ? { availableAgents: input.availableAgents } : {}),
    ...(input.persistence !== undefined ? { persistence: input.persistence } : {}),
    ...(input.now !== undefined ? { now: input.now } : {})
  };
  const result = await runDesktopDecision(runnerInput);

  if (!resolvedResume) {
    return result;
  }

  const resumeEvent: AuditEvent = {
    type: "task_resumed",
    taskId: task.taskId,
    timestamp: now(),
    details: {
      checkpointId: resolvedResume.checkpoint.checkpointId,
      stage: resolvedResume.checkpoint.stage,
      summary: resolvedResume.checkpoint.summary,
      source: resolvedResume.source
    }
  };

  if (input.persistence?.auditStore) {
    await input.persistence.auditStore.record(resumeEvent);
  }

  return {
    ...result,
    auditEvents: [resumeEvent, ...result.auditEvents],
    observabilityEvents: [
      ...result.observabilityEvents
    ],
    resumedFrom: resolvedResume.checkpoint,
    resumeSource: resolvedResume.source
  };
}

function deriveRequiredTools(
  decision: RoutingDecision,
  plan: DesktopExecutionPlan
): string[] {
  return [...new Set(
    [
      ...plan.primitives.map((primitive) => primitive.primitive),
      ...(decision.execution.toolAccess !== "read_only" ? ["shell_command" as const, "apply_patch" as const] : [])
    ]
      .filter((primitive) => primitive !== "automation_update")
  )];
}

function resolveStatus(
  preflight: PreflightResult,
  approval: ApprovalDecision
): DesktopDecisionRunnerStatus {
  if (!preflight.ok) {
    return "blocked_preflight";
  }

  if (approval.status === "pending") {
    return "blocked_approval";
  }

  return "ready";
}

function collectBlockingReasons(
  preflight: PreflightResult,
  approval: ApprovalDecision
): string[] {
  if (!preflight.ok) {
    return [...preflight.errors];
  }

  if (approval.status === "pending") {
    return [...approval.reasons];
  }

  return [];
}

function buildCheckpoint(
  taskId: string,
  status: DesktopDecisionRunnerStatus,
  blockingReasons: string[],
  createdAt: string
): CheckpointRef {
  const stage = status === "ready"
    ? "ready-for-desktop-execution"
    : status === "blocked_preflight"
      ? "preflight-blocked"
      : "approval-pending";

  const summary = status === "ready"
    ? "desktop decision runner produced a ready execution package"
    : `desktop decision runner blocked: ${blockingReasons.join(", ")}`;

  return {
    checkpointId: `${taskId}:${stage}:${randomUUID()}`,
    taskId,
    stage,
    createdAt,
    summary
  };
}

function buildAuditEvents(input: {
  task: TaskEnvelope;
  intent: IntentClassification;
  decision: RoutingDecision;
  preflight: PreflightResult;
  approval: ApprovalDecision;
  status: DesktopDecisionRunnerStatus;
  blockingReasons: string[];
  timestamp: string;
}): AuditEvent[] {
  const events: AuditEvent[] = [
    {
      type: "task_created",
      taskId: input.task.taskId,
      timestamp: input.timestamp,
      details: {
        source: input.task.source,
        repoRoot: input.task.repoContext.repoRoot ?? null
      }
    },
    {
      type: "intent_classified",
      taskId: input.task.taskId,
      timestamp: input.timestamp,
      details: {
        taskClass: input.intent.taskClass,
        ambiguityScore: input.intent.ambiguityScore
      }
    },
    {
      type: "routing_decided",
      taskId: input.task.taskId,
      timestamp: input.timestamp,
      details: {
        decisionId: input.decision.decisionId,
        model: input.decision.execution.selectedModel,
        profile: input.decision.execution.executionProfile
      }
    }
  ];

  if (input.intent.clarificationRequired) {
    events.push({
      type: "clarification_required",
      taskId: input.task.taskId,
      timestamp: input.timestamp,
      details: {
        reasons: input.intent.ambiguityReasons
      }
    });
  }

  events.push({
    type: input.preflight.ok ? "preflight_passed" : "preflight_failed",
    taskId: input.task.taskId,
    timestamp: input.timestamp,
    details: {
      errors: input.preflight.errors,
      warnings: input.preflight.warnings
    }
  });

  if (input.approval.status === "pending") {
    events.push({
      type: "approval_required",
      taskId: input.task.taskId,
      timestamp: input.timestamp,
      details: {
        reasons: input.approval.reasons,
        gateId: input.approval.gateId ?? null
      }
    });
  }

  events.push({
    type: input.status === "ready" ? "runner_ready" : "runner_blocked",
    taskId: input.task.taskId,
    timestamp: input.timestamp,
    details: {
      status: input.status,
      blockingReasons: input.blockingReasons
    }
  });

  return events;
}

function buildObservabilityEvents(input: {
  task: TaskEnvelope;
  decision: RoutingDecision;
  preflight: PreflightResult;
  timestamp: string;
}): LogEvent[] {
  return [
    createPreflightLogEvent(input.preflight, {
      taskId: input.task.taskId,
      timestamp: input.timestamp,
      decisionId: input.decision.decisionId
    }),
    createMemoryPreflightLogEvent(input.preflight.memory, {
      taskId: input.task.taskId,
      timestamp: input.timestamp,
      decisionId: input.decision.decisionId
    })
  ];
}

async function persistRunnerArtifacts(
  checkpoint: CheckpointRef,
  auditEvents: AuditEvent[],
  persistence?: DesktopDecisionRunnerInput["persistence"]
): Promise<void> {
  if (!persistence) {
    return;
  }

  if (persistence.checkpointStore) {
    await persistence.checkpointStore.record(checkpoint);
  }

  if (persistence.memoryAdapter) {
    await persistence.memoryAdapter.recordCheckpoint(checkpoint);
  }

  if (persistence.auditStore) {
    for (const event of auditEvents) {
      await persistence.auditStore.record(event);
    }
  }
}

async function loadMemoryOverview(
  provider?: MemoryOverviewProvider
): Promise<PreflightContext["memoryOverview"] | undefined> {
  if (!provider) {
    return undefined;
  }

  return provider.memoryOverview();
}

async function resolveResumeCheckpoint(
  taskId: string,
  resume?: DesktopDecisionResumeInput["resume"]
): Promise<{ checkpoint: CheckpointRef; source: ResumeSource } | undefined> {
  if (!resume) {
    return undefined;
  }

  const preferredSource = resume.preferredSource ?? "memory";
  const orderedSources = preferredSource === "memory"
    ? ["memory", "checkpoint"] as const
    : ["checkpoint", "memory"] as const;

  for (const source of orderedSources) {
    if (source === "memory" && resume.memoryRecall) {
      const checkpoint = await resume.memoryRecall.recallLatestCheckpointRef({
        taskId,
        ...(resume.stage !== undefined ? { stage: resume.stage } : {})
      });

      if (checkpoint) {
        return {
          checkpoint,
          source
        };
      }
    }

    if (source === "checkpoint" && resume.checkpointStore) {
      const checkpoint = await resume.checkpointStore.findLatestForTask(taskId);
      if (checkpoint) {
        return {
          checkpoint,
          source
        };
      }
    }
  }

  return undefined;
}

// ── Governance wrapper ─────────────────────────────────────────────────────

export interface DesktopDecisionWithGovernanceResult {
  base: DesktopDecisionRunnerResult;
  governanceState: GovernanceState;
  strategyDecision: StrategyDecisionV2;
}

export async function runDesktopDecisionWithGovernance(
  input: DesktopDecisionRunnerInput
): Promise<DesktopDecisionWithGovernanceResult> {
  const base = await runDesktopDecision(input);
  const governanceState = createInitialGovernanceState({
    task: base.task,
    decision: base.decision,
    ...(base.checkpoint !== undefined ? { checkpoint: base.checkpoint } : {}),
    ...(input.now !== undefined ? { now: input.now } : {})
  });
  const strategyDecision = routeStrategyV2({
    state: governanceState,
    ...(input.now !== undefined ? { now: input.now } : {})
  });

  return {
    base,
    governanceState,
    strategyDecision
  };
}
