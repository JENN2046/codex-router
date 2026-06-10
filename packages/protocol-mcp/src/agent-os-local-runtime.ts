import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  EventSchema,
  PolicyDecisionSchema,
  PrincipalSchema,
  TaskSchema,
  type Artifact,
  type Event,
  type PolicyDecision,
  type Principal,
  type Run,
  type Task
} from "../../kernel-contracts/src/index.js";
import type { ExecutionEligibilityDecision } from "../../execution-eligibility/src/index.js";
import type { KernelStore } from "../../kernel-store/src/index.js";
import {
  planProviderExecution,
  type ProviderExecutionPlan,
  type ProviderExecutionPlanStore
} from "../../execution-planner/src/index.js";
import type { ProviderRegistry } from "../../provider-registry/src/index.js";
import { RunManager } from "../../run-manager/src/index.js";
import {
  AgentOsMcpToolNameSchema,
  agentOsMcpToolManifests,
  type AgentOsMcpToolManifest,
  type AgentOsMcpToolName
} from "./agent-os-server-manifest.js";

export const AGENT_OS_MCP_LOCAL_MUTATION_DISABLED =
  "agent_os_mcp_local_mutation_disabled";
export const AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED =
  "agent_os_mcp_tool_approval_required";
export const AGENT_OS_MCP_TOOL_CAPABILITY_MISSING =
  "agent_os_mcp_tool_capability_missing";
export const AGENT_OS_MCP_APPROVAL_RUNTIME_NOT_IMPLEMENTED =
  "agent_os_mcp_approval_runtime_not_implemented";
export const AGENT_OS_MCP_RUN_NOT_FOUND =
  "agent_os_run_not_found";
const AGENT_OS_LIST_RUNS_CURSOR = {
  prefix: "agentos-list-runs:",
  invalidReason: "agent_os_list_runs_invalid_cursor"
} as const;
const AGENT_OS_LIST_ARTIFACTS_CURSOR = {
  prefix: "agentos-list-artifacts:",
  invalidReason: "agent_os_list_artifacts_invalid_cursor"
} as const;
const AGENT_OS_SEARCH_EVENTS_CURSOR = {
  prefix: "agentos-search-events:",
  invalidReason: "agent_os_search_events_invalid_cursor"
} as const;

export type AgentOsMcpLocalRuntimeOptions = {
  kernelStore: KernelStore;
  providerExecutionPlanStore?: ProviderExecutionPlanStore;
  providerRegistry?: ProviderRegistry;
  principal: Principal;
  policyDecision?: PolicyDecision;
  executionEligibility?: ExecutionEligibilityDecision;
  grantedCapabilities?: string[];
  approvedMutatingTools?: AgentOsMcpToolName[];
  allowLocalMutations?: boolean;
  preferredProviderId?: string;
  publicSurface?: AgentOsPublicSurface;
  now?: () => string;
  createTaskId?: (input: AgentOsCreateTaskInput) => string;
  createRunId?: (task: Task) => string;
};

export type AgentOsMcpLocalToolCall = {
  toolName: AgentOsMcpToolName;
  input?: unknown;
  principal?: Principal;
  policyDecision?: PolicyDecision;
  executionEligibility?: ExecutionEligibilityDecision;
  grantedCapabilities?: string[];
  approvedMutatingTools?: AgentOsMcpToolName[];
  allowLocalMutations?: boolean;
  preferredProviderId?: string;
};

export type AgentOsMcpLocalRuntimeResult = {
  toolName: AgentOsMcpToolName;
  status: "succeeded" | "blocked";
  reasons: string[];
  output: Record<string, unknown>;
  audit: {
    publicSurface: AgentOsPublicSurface;
    liveMcpServerConnection: false;
    realProviderExecutionInvoked: false;
    localMutationAttempted: boolean;
    localMutationApplied: boolean;
    requiredCapabilities: string[];
    missingCapabilities: string[];
    approvalRequired: boolean;
    approved: boolean;
  };
};

export type AgentOsPublicSurface = "mcp" | "cli" | "app_server" | "sdk";

const AgentOsCreateTaskInputSchema = z.object({
  title: z.string().min(1),
  requestedAction: z.string().min(1),
  successCriteria: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  repoRoot: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  targetFiles: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({})
});

const AgentOsGetRunInputSchema = z.object({
  runId: z.string().min(1)
});

const AgentOsListRunsInputSchema = z.object({
  taskId: z.string().min(1).optional(),
  status: z.enum(["queued", "running", "blocked", "succeeded", "failed", "cancelled"]).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional()
});

const AgentOsCancelRunInputSchema = z.object({
  runId: z.string().min(1),
  reason: z.string().min(1)
});

const AgentOsApproveRunInputSchema = z.object({
  runId: z.string().min(1),
  capabilityScopes: z.array(z.string().min(1)).min(1),
  expiresAt: z.string().min(1).optional(),
  reason: z.string().min(1)
});

const AgentOsListArtifactsInputSchema = z.object({
  taskId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  kind: z.enum(["file", "log", "patch", "evidence", "checkpoint", "other"]).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional()
});

const AgentOsGetArtifactInputSchema = z.object({
  artifactId: z.string().min(1)
});

const AgentOsSearchEventsInputSchema = z.object({
  query: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  eventTypes: z.array(z.string().min(1)).default([]),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional()
});

export type AgentOsCreateTaskInput = z.infer<typeof AgentOsCreateTaskInputSchema>;

export class AgentOsMcpLocalRuntime {
  private readonly kernelStore: KernelStore;
  private readonly providerExecutionPlanStore: ProviderExecutionPlanStore | undefined;
  private readonly providerRegistry: ProviderRegistry | undefined;
  private readonly principal: Principal;
  private readonly policyDecision: PolicyDecision | undefined;
  private readonly executionEligibility: ExecutionEligibilityDecision | undefined;
  private readonly grantedCapabilities: string[];
  private readonly approvedMutatingTools: AgentOsMcpToolName[];
  private readonly allowLocalMutations: boolean;
  private readonly preferredProviderId: string | undefined;
  private readonly publicSurface: AgentOsPublicSurface;
  private readonly now: () => string;
  private readonly createTaskId: (input: AgentOsCreateTaskInput) => string;
  private readonly createRunId: (task: Task) => string;
  private runtimeEventSequence = 0;

  constructor(options: AgentOsMcpLocalRuntimeOptions) {
    this.kernelStore = options.kernelStore;
    this.providerExecutionPlanStore = options.providerExecutionPlanStore;
    this.providerRegistry = options.providerRegistry;
    this.principal = PrincipalSchema.parse(options.principal);
    this.policyDecision = options.policyDecision === undefined
      ? undefined
      : PolicyDecisionSchema.parse(options.policyDecision);
    this.executionEligibility = options.executionEligibility;
    this.grantedCapabilities = [...(options.grantedCapabilities ?? [])];
    this.approvedMutatingTools = [...(options.approvedMutatingTools ?? [])];
    this.allowLocalMutations = options.allowLocalMutations ?? false;
    this.preferredProviderId = options.preferredProviderId;
    this.publicSurface = options.publicSurface ?? "mcp";
    this.now = options.now ?? (() => new Date().toISOString());
    this.createTaskId = options.createTaskId ?? ((input) => this.createDefaultTaskId(input));
    this.createRunId = options.createRunId ?? ((task) => this.createDefaultRunId(task));
  }

  handleToolCall(call: AgentOsMcpLocalToolCall): AgentOsMcpLocalRuntimeResult {
    const toolName = AgentOsMcpToolNameSchema.parse(call.toolName);
    const tool = requireAgentOsMcpTool(toolName);
    const gate = this.evaluateGate(tool, call);

    if (gate.status === "blocked") {
      return this.createResult(toolName, gate.reasons, {}, {
        localMutationAttempted: isMutatingTool(toolName),
        localMutationApplied: false,
        gate
      });
    }

    switch (toolName) {
      case "agentos.create_task":
        return this.handleCreateTask(call, gate);
      case "agentos.get_run":
        return this.handleGetRun(call, gate);
      case "agentos.list_runs":
        return this.handleListRuns(call, gate);
      case "agentos.cancel_run":
        return this.handleCancelRun(call, gate);
      case "agentos.approve_run":
        return this.handleApproveRun(call, gate);
      case "agentos.list_artifacts":
        return this.handleListArtifacts(call, gate);
      case "agentos.get_artifact":
        return this.handleGetArtifact(call, gate);
      case "agentos.search_events":
        return this.handleSearchEvents(call, gate);
    }
  }

  private handleCreateTask(
    call: AgentOsMcpLocalToolCall,
    gate: AgentOsMcpLocalRuntimeGate
  ): AgentOsMcpLocalRuntimeResult {
    const input = AgentOsCreateTaskInputSchema.parse(call.input ?? {});
    const principal = this.resolvePrincipal(call);
    const createdAt = this.now();
    const task = TaskSchema.parse({
      schemaVersion: "kernel-task.v1",
      taskId: this.createTaskId(input),
      source: "api",
      title: input.title,
      requestedAction: input.requestedAction,
      successCriteria: input.successCriteria,
      outOfScope: input.outOfScope,
      createdBy: principal,
      repo: {
        ...(input.repoRoot ? { root: input.repoRoot } : {}),
        ...(input.branch ? { branch: input.branch } : {})
      },
      target: {
        branches: input.branch ? [input.branch] : [],
        files: input.targetFiles,
        modules: []
      },
      hints: {
        taskClass: `agent_os_${this.publicSurface}_entry`,
        riskHints: [],
        tags: ["agent-os", this.publicSurface, "public-surface"]
      },
      constraints: {
        realExecutionDefault: "disabled"
      },
      context: {
        metadata: input.metadata,
        publicSurface: this.publicSurface,
        toolName: "agentos.create_task"
      },
      createdAt
    });
    const policyDecision = this.resolvePolicyDecision(call);
    const manager = new RunManager({
      store: this.kernelStore,
      now: this.now
    });
    const run = manager.createRunFromTask(task, principal, {
      runId: this.createRunId(task),
      ...(policyDecision ? { policyDecisionId: policyDecision.decisionId } : {}),
      metadata: {
        legacy: {
          publicSurface: this.publicSurface,
          agentOsToolName: "agentos.create_task",
          realExecutionDefault: "disabled"
        }
      }
    });
    const planning = this.maybePlanProviderExecution(task, run, call);

    this.appendRuntimeEvent(`kernel.public_surface.${this.publicSurface}.create_task`, run, {
      toolName: "agentos.create_task",
      publicSurface: this.publicSurface,
      providerPlanId: planning.plan?.planId,
      providerPlanningReasons: planning.reasons,
      liveMcpServerConnection: false,
      realProviderExecutionInvoked: false
    });

    return this.createResult("agentos.create_task", [], {
      taskId: task.taskId,
      runId: run.runId,
      status: run.status,
      createdAt: task.createdAt,
      providerPlanId: planning.plan?.planId,
      providerPlanStatus: planning.plan?.status,
      providerPlanningReasons: planning.reasons
    }, {
      localMutationAttempted: true,
      localMutationApplied: true,
      gate
    });
  }

  private handleGetRun(
    call: AgentOsMcpLocalToolCall,
    gate: AgentOsMcpLocalRuntimeGate
  ): AgentOsMcpLocalRuntimeResult {
    const input = AgentOsGetRunInputSchema.parse(call.input ?? {});
    const run = this.kernelStore.getRun(input.runId);
    if (run === undefined) {
      return this.createResult("agentos.get_run", [`${AGENT_OS_MCP_RUN_NOT_FOUND}:${input.runId}`], {}, {
        localMutationAttempted: false,
        localMutationApplied: false,
        gate
      });
    }

    return this.createResult("agentos.get_run", [], {
      run
    }, {
      localMutationAttempted: false,
      localMutationApplied: false,
      gate
    });
  }

  private handleListRuns(
    call: AgentOsMcpLocalToolCall,
    gate: AgentOsMcpLocalRuntimeGate
  ): AgentOsMcpLocalRuntimeResult {
    const input = AgentOsListRunsInputSchema.parse(call.input ?? {});
    const allRuns = this.kernelStore.listRuns({
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.status ? { status: input.status } : {})
    });
    const page = pageByOffset(allRuns, input.limit, input.cursor, AGENT_OS_LIST_RUNS_CURSOR);

    return this.createResult("agentos.list_runs", [], {
      runs: page.items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {})
    }, {
      localMutationAttempted: false,
      localMutationApplied: false,
      gate
    });
  }

  private handleCancelRun(
    call: AgentOsMcpLocalToolCall,
    gate: AgentOsMcpLocalRuntimeGate
  ): AgentOsMcpLocalRuntimeResult {
    const input = AgentOsCancelRunInputSchema.parse(call.input ?? {});
    const manager = new RunManager({
      store: this.kernelStore,
      now: this.now
    });
    const run = manager.cancelRun(input.runId, input.reason);
    const event = this.kernelStore.listEvents({
      runId: run.runId,
      type: "kernel.run.cancelled"
    }).at(-1);

    return this.createResult("agentos.cancel_run", [], {
      runId: run.runId,
      status: run.status,
      eventId: event?.eventId
    }, {
      localMutationAttempted: true,
      localMutationApplied: true,
      gate
    });
  }

  private handleApproveRun(
    call: AgentOsMcpLocalToolCall,
    gate: AgentOsMcpLocalRuntimeGate
  ): AgentOsMcpLocalRuntimeResult {
    AgentOsApproveRunInputSchema.parse(call.input ?? {});
    return this.createResult("agentos.approve_run", [AGENT_OS_MCP_APPROVAL_RUNTIME_NOT_IMPLEMENTED], {
      status: "blocked"
    }, {
      localMutationAttempted: true,
      localMutationApplied: false,
      gate
    });
  }

  private handleListArtifacts(
    call: AgentOsMcpLocalToolCall,
    gate: AgentOsMcpLocalRuntimeGate
  ): AgentOsMcpLocalRuntimeResult {
    const input = AgentOsListArtifactsInputSchema.parse(call.input ?? {});
    const allArtifacts = this.kernelStore.listArtifacts({
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.kind ? { type: input.kind } : {})
    });
    const page = pageByOffset(
      allArtifacts,
      input.limit,
      input.cursor,
      AGENT_OS_LIST_ARTIFACTS_CURSOR
    );

    return this.createResult("agentos.list_artifacts", [], {
      artifacts: page.items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {})
    }, {
      localMutationAttempted: false,
      localMutationApplied: false,
      gate
    });
  }

  private handleGetArtifact(
    call: AgentOsMcpLocalToolCall,
    gate: AgentOsMcpLocalRuntimeGate
  ): AgentOsMcpLocalRuntimeResult {
    const input = AgentOsGetArtifactInputSchema.parse(call.input ?? {});
    return this.createResult("agentos.get_artifact", [], {
      artifact: this.kernelStore.getArtifact(input.artifactId)
    }, {
      localMutationAttempted: false,
      localMutationApplied: false,
      gate
    });
  }

  private handleSearchEvents(
    call: AgentOsMcpLocalToolCall,
    gate: AgentOsMcpLocalRuntimeGate
  ): AgentOsMcpLocalRuntimeResult {
    const input = AgentOsSearchEventsInputSchema.parse(call.input ?? {});
    let events = this.kernelStore.listEvents({
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.runId ? { runId: input.runId } : {})
    });

    if (input.eventTypes.length > 0) {
      events = events.filter((event) => input.eventTypes.includes(event.eventType));
    }

    if (input.query !== undefined) {
      events = events.filter((event) => eventMatchesQuery(event, input.query!));
    }

    const page = pageByOffset(events, input.limit, input.cursor, AGENT_OS_SEARCH_EVENTS_CURSOR);

    return this.createResult("agentos.search_events", [], {
      events: page.items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {})
    }, {
      localMutationAttempted: false,
      localMutationApplied: false,
      gate
    });
  }

  private evaluateGate(
    tool: AgentOsMcpToolManifest,
    call: AgentOsMcpLocalToolCall
  ): AgentOsMcpLocalRuntimeGate {
    const grantedCapabilities = new Set([
      ...this.grantedCapabilities,
      ...(call.grantedCapabilities ?? [])
    ]);
    const missingCapabilities = tool.requiredCapabilities.filter((capability) => (
      !grantedCapabilities.has(capability)
    ));
    const approvedMutatingTools = new Set([
      ...this.approvedMutatingTools,
      ...(call.approvedMutatingTools ?? [])
    ]);
    const approved = !tool.approvalRequired || approvedMutatingTools.has(tool.name);
    const localMutationAllowed = call.allowLocalMutations ?? this.allowLocalMutations;
    const reasons: string[] = [];

    for (const capability of missingCapabilities) {
      reasons.push(`${AGENT_OS_MCP_TOOL_CAPABILITY_MISSING}:${capability}`);
    }

    if (tool.approvalRequired && !approved) {
      reasons.push(`${AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED}:${tool.name}`);
    }

    if (isMutatingTool(tool.name) && !localMutationAllowed) {
      reasons.push(`${AGENT_OS_MCP_LOCAL_MUTATION_DISABLED}:${tool.name}`);
    }

    return {
      status: reasons.length > 0 ? "blocked" : "succeeded",
      reasons,
      requiredCapabilities: [...tool.requiredCapabilities],
      missingCapabilities,
      approvalRequired: tool.approvalRequired,
      approved
    };
  }

  private maybePlanProviderExecution(
    task: Task,
    run: Run,
    call: AgentOsMcpLocalToolCall
  ): {
    plan?: ProviderExecutionPlan;
    reasons: string[];
  } {
    const providerExecutionPlanStore = this.providerExecutionPlanStore;
    const providerRegistry = this.providerRegistry;
    const policyDecision = this.resolvePolicyDecision(call);
    const executionEligibility = this.resolveExecutionEligibility(call);

    if (
      providerExecutionPlanStore === undefined
      || providerRegistry === undefined
      || policyDecision === undefined
      || executionEligibility === undefined
    ) {
      return {
        reasons: ["provider_planning_context_missing"]
      };
    }

    const preferredProviderId = call.preferredProviderId ?? this.preferredProviderId;
    const plan = planProviderExecution({
      task,
      run,
      principal: this.resolvePrincipal(call),
      policyDecision,
      executionEligibility,
      providerRegistry,
      ...(preferredProviderId !== undefined ? { preferredProviderId } : {}),
      now: this.now()
    });
    providerExecutionPlanStore.savePlan(plan);
    return {
      plan,
      reasons: ["provider_execution_plan_stored"]
    };
  }

  private resolvePrincipal(call: AgentOsMcpLocalToolCall): Principal {
    return call.principal === undefined
      ? this.principal
      : PrincipalSchema.parse(call.principal);
  }

  private resolvePolicyDecision(call: AgentOsMcpLocalToolCall): PolicyDecision | undefined {
    if (call.policyDecision !== undefined) {
      return PolicyDecisionSchema.parse(call.policyDecision);
    }
    return this.policyDecision;
  }

  private resolveExecutionEligibility(
    call: AgentOsMcpLocalToolCall
  ): ExecutionEligibilityDecision | undefined {
    return call.executionEligibility ?? this.executionEligibility;
  }

  private appendRuntimeEvent(
    eventType: string,
    run: Run,
    payload: Record<string, unknown>
  ): Event {
    this.runtimeEventSequence += 1;
    return this.kernelStore.appendEvent(EventSchema.parse({
      schemaVersion: "kernel-event.v1",
      eventId: [
        "event",
        "agent_os_mcp",
        sanitizeIdPart(run.runId),
        String(this.runtimeEventSequence).padStart(4, "0")
      ].join("_"),
      eventType,
      taskId: run.taskId,
      runId: run.runId,
      createdAt: this.now(),
      payload
    }));
  }

  private createResult(
    toolName: AgentOsMcpToolName,
    reasons: string[],
    output: Record<string, unknown>,
    input: {
      localMutationAttempted: boolean;
      localMutationApplied: boolean;
      gate: AgentOsMcpLocalRuntimeGate;
    }
  ): AgentOsMcpLocalRuntimeResult {
    return {
      toolName,
      status: reasons.length > 0 ? "blocked" : "succeeded",
      reasons,
      output,
      audit: {
        publicSurface: this.publicSurface,
        liveMcpServerConnection: false,
        realProviderExecutionInvoked: false,
        localMutationAttempted: input.localMutationAttempted,
        localMutationApplied: input.localMutationApplied,
        requiredCapabilities: input.gate.requiredCapabilities,
        missingCapabilities: input.gate.missingCapabilities,
        approvalRequired: input.gate.approvalRequired,
        approved: input.gate.approved
      }
    };
  }

  private createDefaultTaskId(input: AgentOsCreateTaskInput): string {
    return [
      "task_agentos_mcp",
      sanitizeIdPart(input.title).toLowerCase(),
      randomUUID()
    ].join("_");
  }

  private createDefaultRunId(task: Task): string {
    return `run_${sanitizeIdPart(task.taskId)}_001`;
  }
}

export function createAgentOsMcpLocalRuntime(
  options: AgentOsMcpLocalRuntimeOptions
): AgentOsMcpLocalRuntime {
  return new AgentOsMcpLocalRuntime(options);
}

type AgentOsMcpLocalRuntimeGate = {
  status: "succeeded" | "blocked";
  reasons: string[];
  requiredCapabilities: string[];
  missingCapabilities: string[];
  approvalRequired: boolean;
  approved: boolean;
};

function requireAgentOsMcpTool(toolName: AgentOsMcpToolName): AgentOsMcpToolManifest {
  const tool = agentOsMcpToolManifests.find((candidate) => candidate.name === toolName);
  if (tool === undefined) {
    throw new Error(`agent_os_mcp_tool_not_found:${toolName}`);
  }
  return tool;
}

function isMutatingTool(toolName: AgentOsMcpToolName): boolean {
  return toolName === "agentos.create_task"
    || toolName === "agentos.cancel_run"
    || toolName === "agentos.approve_run";
}

function eventMatchesQuery(event: Event, query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  return event.eventId.toLowerCase().includes(normalizedQuery)
    || event.eventType.toLowerCase().includes(normalizedQuery)
    || JSON.stringify(event.payload).toLowerCase().includes(normalizedQuery);
}

function pageByOffset<T>(
  items: T[],
  limit: number,
  cursor: string | undefined,
  config: AgentOsOffsetCursorConfig
): {
  items: T[];
  nextCursor?: string;
} {
  const offset = parseOffsetCursor(cursor, config);
  const pageItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pageItems.length;

  return {
    items: pageItems,
    ...(nextOffset < items.length ? {
      nextCursor: formatOffsetCursor(nextOffset, config)
    } : {})
  };
}

type AgentOsOffsetCursorConfig = {
  prefix: string;
  invalidReason: string;
};

function parseOffsetCursor(cursor: string | undefined, config: AgentOsOffsetCursorConfig): number {
  if (cursor === undefined) {
    return 0;
  }

  if (!cursor.startsWith(config.prefix)) {
    throw new Error(`${config.invalidReason}:${cursor}`);
  }

  const rawOffset = cursor.slice(config.prefix.length);
  if (!/^\d+$/.test(rawOffset)) {
    throw new Error(`${config.invalidReason}:${cursor}`);
  }

  return Number(rawOffset);
}

function formatOffsetCursor(offset: number, config: AgentOsOffsetCursorConfig): string {
  return `${config.prefix}${offset}`;
}

function sanitizeIdPart(value: string): string {
  const safe = value
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe || "unnamed";
}

export type AgentOsMcpLocalRuntimeArtifact = Artifact;
