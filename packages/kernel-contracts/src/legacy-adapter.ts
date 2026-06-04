import {
  parseRoutingDecision,
  parseTaskEnvelope,
  type RoutingDecision,
  type RoutingDecisionInput,
  type TaskEnvelope,
  type TaskEnvelopeInput,
  type ToolAccessLevel
} from "../../contracts/src/index.js";
import {
  CapabilityScopeSchema,
  EventSchema,
  PolicyDecisionSchema,
  RunSchema,
  SandboxProfileSchema,
  TaskSchema,
  type CapabilityScope,
  type Event,
  type PolicyDecision,
  type Principal,
  type Run,
  type SandboxProfile,
  type Task
} from "./index.js";

const defaultCreatedAt = "1970-01-01T00:00:00.000Z";

export type LegacyTaskEnvelopeToKernelTaskOptions = {
  createdAt?: string;
  createdBy?: Principal;
};

export type LegacyRoutingDecisionToPolicyDecisionOptions = {
  createdAt?: string;
};

export type LegacyTaskAndRoutingToRunSeedOptions = {
  createdAt?: string;
  runId?: string;
};

export type LegacyCompatibilityEventInput = {
  taskEnvelope?: TaskEnvelope | TaskEnvelopeInput;
  routingDecision?: RoutingDecision | RoutingDecisionInput;
  eventId?: string;
  eventType?: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
};

export function legacyTaskEnvelopeToKernelTask(
  input: TaskEnvelope | TaskEnvelopeInput,
  options: LegacyTaskEnvelopeToKernelTaskOptions = {}
): Task {
  const legacy = parseTaskEnvelope(input);
  const workspace = {
    root: legacy.repoContext.repoRoot,
    branch: legacy.repoContext.branch,
    worktreeClean: legacy.repoContext.worktreeClean,
    protectedBranch: legacy.repoContext.protectedBranch
  };

  return TaskSchema.parse({
    taskId: legacy.taskId,
    source: legacy.source,
    title: legacy.intent.summary,
    requestedAction: legacy.intent.requestedAction,
    successCriteria: legacy.intent.successCriteria,
    outOfScope: legacy.intent.outOfScope,
    intent: legacy.intent,
    ...(options.createdBy ? { createdBy: options.createdBy } : {}),
    repo: workspace,
    workspace,
    context: {
      repoContext: legacy.repoContext,
      target: legacy.target
    },
    target: legacy.target,
    hints: {
      taskClass: legacy.hints.taskClassHint,
      riskHints: legacy.hints.riskHints,
      tags: legacy.hints.tags
    },
    constraints: legacy.constraints,
    metadata: {
      legacySource: legacy.source,
      legacyHints: legacy.hints,
      legacy: {
        schemaVersion: legacy.schemaVersion,
        source: legacy.source,
        intent: legacy.intent,
        repoContext: legacy.repoContext,
        target: legacy.target,
        constraints: legacy.constraints,
        hints: legacy.hints
      }
    },
    createdAt: options.createdAt ?? defaultCreatedAt
  });
}

export function legacyRoutingDecisionToPolicyDecision(
  input: RoutingDecision | RoutingDecisionInput,
  options: LegacyRoutingDecisionToPolicyDecisionOptions = {}
): PolicyDecision {
  const legacy = parseRoutingDecision(input);

  return PolicyDecisionSchema.parse({
    decisionId: legacy.decisionId,
    taskId: legacy.taskId,
    policyVersion: legacy.policyVersion,
    classification: legacy.classification,
    risk: {
      level: legacy.classification.taskClass === "release_external_action"
        ? "critical"
        : legacy.classification.riskLevel,
      factors: legacy.classification.riskFactors,
      ambiguityScore: legacy.classification.ambiguityScore,
      clarificationRequired: legacy.classification.clarificationRequired
    },
    execution: {
      executor: legacy.hostRoute === "codex-cli" ? "codex-cli" : "codex-desktop",
      model: legacy.execution.selectedModel,
      profile: legacy.execution.executionProfile,
      reasoningEffort: legacy.execution.reasoningEffort,
      sandbox: createSandboxProfileFromToolAccess(legacy.execution.toolAccess)
    },
    capabilities: createCapabilityScopesFromToolAccess(legacy.execution.toolAccess),
    approval: legacy.approval,
    parallelism: legacy.parallelism,
    hostRoute: legacy.hostRoute,
    metadata: {
      legacy: {
        schemaVersion: legacy.schemaVersion,
        classification: legacy.classification,
        execution: legacy.execution,
        approval: legacy.approval,
        parallelism: legacy.parallelism,
        hostRoute: legacy.hostRoute
      }
    },
    createdAt: options.createdAt ?? defaultCreatedAt,
    legacy: {
      routingDecisionId: legacy.decisionId,
      taskClass: legacy.classification.taskClass,
      toolAccess: legacy.execution.toolAccess
    }
  });
}

export function legacyTaskAndRoutingToRunSeed(
  taskEnvelope: TaskEnvelope | TaskEnvelopeInput,
  routingDecision: RoutingDecision | RoutingDecisionInput,
  options: LegacyTaskAndRoutingToRunSeedOptions = {}
): Run {
  const task = parseTaskEnvelope(taskEnvelope);
  const decision = parseRoutingDecision(routingDecision);

  if (task.taskId !== decision.taskId) {
    throw new Error(
      `legacy taskId mismatch: task envelope ${task.taskId} does not match routing decision ${decision.taskId}`
    );
  }

  const createdAt = options.createdAt ?? defaultCreatedAt;

  return RunSchema.parse({
    runId: options.runId ?? `run_seed_${task.taskId}_${decision.decisionId}`,
    taskId: task.taskId,
    status: decision.approval.required || decision.classification.clarificationRequired
      ? "blocked"
      : "queued",
    policyDecisionId: decision.decisionId,
    metadata: {
      legacy: {
        taskEnvelope: task,
        routingDecision: decision
      }
    },
    createdAt,
    updatedAt: createdAt
  });
}

export function createLegacyCompatibilityEvent(
  input: LegacyCompatibilityEventInput
): Event {
  const task = input.taskEnvelope ? parseTaskEnvelope(input.taskEnvelope) : undefined;
  const decision = input.routingDecision
    ? parseRoutingDecision(input.routingDecision)
    : undefined;

  if (task && decision && task.taskId !== decision.taskId) {
    throw new Error(
      `legacy taskId mismatch: task envelope ${task.taskId} does not match routing decision ${decision.taskId}`
    );
  }

  const taskId = task?.taskId ?? decision?.taskId;
  const decisionId = decision?.decisionId ?? "no_decision";

  return EventSchema.parse({
    eventId: input.eventId ?? `event_legacy_compat_${taskId ?? "unbound"}_${decisionId}`,
    eventType: input.eventType ?? "kernel.legacy.compatibility_mapped",
    ...(taskId ? { taskId } : {}),
    createdAt: input.createdAt ?? defaultCreatedAt,
    payload: {
      mapping: "legacy_to_kernel",
      ...(input.payload ?? {}),
      legacy: {
        ...(task ? { taskEnvelope: task } : {}),
        ...(decision ? { routingDecision: decision } : {})
      }
    }
  });
}

export function createTaskFromLegacyTaskEnvelope(
  input: TaskEnvelope | TaskEnvelopeInput,
  options: LegacyTaskEnvelopeToKernelTaskOptions = {}
): Task {
  return legacyTaskEnvelopeToKernelTask(input, options);
}

export function createPolicyDecisionFromLegacyRoutingDecision(
  input: RoutingDecision | RoutingDecisionInput,
  options: LegacyRoutingDecisionToPolicyDecisionOptions = {}
): PolicyDecision {
  return legacyRoutingDecisionToPolicyDecision(input, options);
}

function createSandboxProfileFromToolAccess(toolAccess: ToolAccessLevel): SandboxProfile {
  if (toolAccess === "read_only") {
    return SandboxProfileSchema.parse({
      sandboxId: "legacy-read-only",
      mode: "read-only"
    });
  }

  return SandboxProfileSchema.parse({
    sandboxId: "legacy-workspace-write",
    mode: "workspace-write",
    writableRoots: ["workspace"]
  });
}

function createCapabilityScopesFromToolAccess(toolAccess: ToolAccessLevel): CapabilityScope[] {
  switch (toolAccess) {
    case "read_only":
      return [
        CapabilityScopeSchema.parse({
          kind: "file",
          resource: "workspace/**",
          access: "read"
        })
      ];
    case "local_write":
      return [
        CapabilityScopeSchema.parse({
          kind: "file",
          resource: "workspace/**",
          access: "read"
        }),
        CapabilityScopeSchema.parse({
          kind: "file",
          resource: "workspace/**",
          access: "write"
        })
      ];
    case "engineering_write":
      return [
        CapabilityScopeSchema.parse({
          kind: "file",
          resource: "workspace/**",
          access: "write"
        }),
        CapabilityScopeSchema.parse({
          kind: "tool",
          resource: "shell_command",
          access: "execute"
        }),
        CapabilityScopeSchema.parse({
          kind: "tool",
          resource: "apply_patch",
          access: "execute"
        })
      ];
    case "protected_remote":
      return [
        CapabilityScopeSchema.parse({
          kind: "external",
          resource: "protected_remote",
          access: "write"
        })
      ];
  }
}
