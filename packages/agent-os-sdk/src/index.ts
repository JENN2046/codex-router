import {
  createAgentOsMcpLocalRuntime,
  type AgentOsMcpLocalRuntime,
  type AgentOsMcpLocalRuntimeOptions,
  type AgentOsMcpLocalRuntimeResult,
  type AgentOsMcpLocalToolCall,
  type AgentOsMcpToolName
} from "../../protocol-mcp/src/index.js";
import type { ExecutionEligibilityDecision } from "../../execution-eligibility/src/index.js";
import type {
  Artifact,
  PolicyDecision,
  Principal,
  Run
} from "../../kernel-contracts/src/index.js";

export type AgentOsSdkOptions = Omit<AgentOsMcpLocalRuntimeOptions, "publicSurface">;

export type AgentOsSdkCallOptions = {
  principal?: Principal;
  policyDecision?: PolicyDecision;
  executionEligibility?: ExecutionEligibilityDecision;
  grantedCapabilities?: string[];
  approvedMutatingTools?: AgentOsMcpToolName[];
  allowLocalMutations?: boolean;
  preferredProviderId?: string;
};

export type AgentOsSdkOperation =
  | "createTask"
  | "getRun"
  | "listRuns"
  | "cancelRun"
  | "approveRun"
  | "listArtifacts"
  | "getArtifact"
  | "searchEvents";

export type AgentOsSdkResult = AgentOsMcpLocalRuntimeResult & {
  surface: "sdk";
  operation: AgentOsSdkOperation;
};

export type AgentOsSdkCreateTaskInput = {
  title: string;
  requestedAction: string;
  successCriteria?: string[];
  outOfScope?: string[];
  repoRoot?: string;
  branch?: string;
  targetFiles?: string[];
  metadata?: Record<string, unknown>;
};

export type AgentOsSdkGetRunInput = {
  runId: string;
};

export type AgentOsSdkListRunsInput = {
  taskId?: string;
  status?: Run["status"];
  limit?: number;
  cursor?: string;
};

export type AgentOsSdkCancelRunInput = {
  runId: string;
  reason: string;
};

export type AgentOsSdkApproveRunInput = {
  runId: string;
  capabilityScopes: string[];
  expiresAt?: string;
  reason: string;
};

export type AgentOsSdkListArtifactsInput = {
  taskId?: string;
  runId?: string;
  kind?: Artifact["kind"];
  limit?: number;
  cursor?: string;
};

export type AgentOsSdkGetArtifactInput = {
  artifactId: string;
};

export type AgentOsSdkSearchEventsInput = {
  query?: string;
  taskId?: string;
  runId?: string;
  eventTypes?: string[];
  limit?: number;
  cursor?: string;
};

export class AgentOsSdk {
  private readonly runtime: AgentOsMcpLocalRuntime;

  constructor(options: AgentOsSdkOptions) {
    this.runtime = createAgentOsMcpLocalRuntime({
      ...options,
      publicSurface: "sdk"
    });
  }

  createTask(
    input: AgentOsSdkCreateTaskInput,
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime("createTask", "agentos.create_task", input, options);
  }

  getRun(
    input: AgentOsSdkGetRunInput | string,
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime("getRun", "agentos.get_run", normalizeRunInput(input), options);
  }

  listRuns(
    input: AgentOsSdkListRunsInput = {},
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime("listRuns", "agentos.list_runs", input, options);
  }

  cancelRun(
    input: AgentOsSdkCancelRunInput,
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime("cancelRun", "agentos.cancel_run", input, options);
  }

  approveRun(
    input: AgentOsSdkApproveRunInput,
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime("approveRun", "agentos.approve_run", input, options);
  }

  listArtifacts(
    input: AgentOsSdkListArtifactsInput = {},
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime("listArtifacts", "agentos.list_artifacts", input, options);
  }

  getArtifact(
    input: AgentOsSdkGetArtifactInput | string,
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime(
      "getArtifact",
      "agentos.get_artifact",
      normalizeArtifactInput(input),
      options
    );
  }

  searchEvents(
    input: AgentOsSdkSearchEventsInput = {},
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime("searchEvents", "agentos.search_events", input, options);
  }

  callTool(
    toolName: AgentOsMcpToolName,
    input: Record<string, unknown> = {},
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    return this.callRuntime(operationForToolName(toolName), toolName, input, options);
  }

  private callRuntime(
    operation: AgentOsSdkOperation,
    toolName: AgentOsMcpToolName,
    input: unknown,
    options?: AgentOsSdkCallOptions
  ): AgentOsSdkResult {
    const call = createRuntimeCall(toolName, input, options);
    const result = this.runtime.handleToolCall(call);
    return {
      ...result,
      surface: "sdk",
      operation
    };
  }
}

export function createAgentOsSdk(options: AgentOsSdkOptions): AgentOsSdk {
  return new AgentOsSdk(options);
}

function createRuntimeCall(
  toolName: AgentOsMcpToolName,
  input: unknown,
  options?: AgentOsSdkCallOptions
): AgentOsMcpLocalToolCall {
  const call: AgentOsMcpLocalToolCall = {
    toolName,
    input
  };

  if (options?.principal !== undefined) {
    call.principal = options.principal;
  }
  if (options?.policyDecision !== undefined) {
    call.policyDecision = options.policyDecision;
  }
  if (options?.executionEligibility !== undefined) {
    call.executionEligibility = options.executionEligibility;
  }
  if (options?.grantedCapabilities !== undefined) {
    call.grantedCapabilities = options.grantedCapabilities;
  }
  if (options?.approvedMutatingTools !== undefined) {
    call.approvedMutatingTools = options.approvedMutatingTools;
  }
  if (options?.allowLocalMutations !== undefined) {
    call.allowLocalMutations = options.allowLocalMutations;
  }
  if (options?.preferredProviderId !== undefined) {
    call.preferredProviderId = options.preferredProviderId;
  }

  return call;
}

function normalizeRunInput(input: AgentOsSdkGetRunInput | string): AgentOsSdkGetRunInput {
  return typeof input === "string"
    ? { runId: input }
    : input;
}

function normalizeArtifactInput(
  input: AgentOsSdkGetArtifactInput | string
): AgentOsSdkGetArtifactInput {
  return typeof input === "string"
    ? { artifactId: input }
    : input;
}

function operationForToolName(toolName: AgentOsMcpToolName): AgentOsSdkOperation {
  switch (toolName) {
    case "agentos.create_task":
      return "createTask";
    case "agentos.get_run":
      return "getRun";
    case "agentos.list_runs":
      return "listRuns";
    case "agentos.cancel_run":
      return "cancelRun";
    case "agentos.approve_run":
      return "approveRun";
    case "agentos.list_artifacts":
      return "listArtifacts";
    case "agentos.get_artifact":
      return "getArtifact";
    case "agentos.search_events":
      return "searchEvents";
  }
}
