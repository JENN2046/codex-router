import { z } from "zod";
import {
  createAgentOsMcpLocalRuntime,
  type AgentOsMcpLocalRuntimeOptions,
  type AgentOsMcpLocalRuntimeResult,
  type AgentOsMcpLocalToolCall,
  type AgentOsMcpToolName
} from "../../protocol-mcp/src/index.js";

export const AgentOsAppServerMethodSchema = z.enum(["GET", "POST"]);

export type AgentOsAppServerMethod = z.infer<typeof AgentOsAppServerMethodSchema>;

export type AgentOsAppServerRequest = {
  method: AgentOsAppServerMethod | string;
  path: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  grantedCapabilities?: string[];
  approvedMutatingTools?: AgentOsMcpToolName[];
  allowLocalMutations?: boolean;
  preferredProviderId?: string;
};

export type HandleAgentOsAppServerRequestInput = Omit<
  AgentOsMcpLocalRuntimeOptions,
  "publicSurface"
> & {
  request: AgentOsAppServerRequest;
};

export type AgentOsAppServerRoute = {
  toolName: AgentOsMcpToolName;
  input: Record<string, unknown>;
};

export type AgentOsAppServerResponse = {
  statusCode: number;
  body: Record<string, unknown>;
  audit: {
    publicSurface: "app_server";
    liveHttpServerStarted: false;
    networkAccessed: false;
    realProviderExecutionInvoked: false;
  };
};

const RUN_PATH_PATTERN = /^\/agent-os\/runs\/([^/]+)$/;
const CANCEL_RUN_PATH_PATTERN = /^\/agent-os\/runs\/([^/]+)\/cancel$/;
const ARTIFACT_PATH_PATTERN = /^\/agent-os\/artifacts\/([^/]+)$/;

export function handleAgentOsAppServerRequest(
  input: HandleAgentOsAppServerRequestInput
): AgentOsAppServerResponse {
  const { request, ...runtimeOptions } = input;
  const route = routeAgentOsAppServerRequest(request);
  if (route === undefined) {
    return createAppServerResponse(404, {
      status: "blocked",
      reasons: ["agent_os_app_server_route_not_found"]
    });
  }

  const runtime = createAgentOsMcpLocalRuntime({
    ...runtimeOptions,
    publicSurface: "app_server",
    ...(request.preferredProviderId !== undefined
      ? { preferredProviderId: request.preferredProviderId }
      : {})
  });
  const call: AgentOsMcpLocalToolCall = {
    toolName: route.toolName,
    input: route.input
  };

  if (request.grantedCapabilities !== undefined) {
    call.grantedCapabilities = request.grantedCapabilities;
  }
  if (request.approvedMutatingTools !== undefined) {
    call.approvedMutatingTools = request.approvedMutatingTools;
  }
  if (request.allowLocalMutations !== undefined) {
    call.allowLocalMutations = request.allowLocalMutations;
  }
  if (request.preferredProviderId !== undefined) {
    call.preferredProviderId = request.preferredProviderId;
  }

  const result = runtime.handleToolCall(call);
  return createAppServerResponse(statusCodeForRuntimeResult(result), {
    result
  });
}

export function routeAgentOsAppServerRequest(
  request: AgentOsAppServerRequest
): AgentOsAppServerRoute | undefined {
  const method = AgentOsAppServerMethodSchema.parse(request.method);
  const path = normalizePath(request.path);

  if (method === "POST" && path === "/agent-os/tasks") {
    return {
      toolName: "agentos.create_task",
      input: parseBodyRecord(request.body)
    };
  }

  if (method === "GET" && path === "/agent-os/runs") {
    return {
      toolName: "agentos.list_runs",
      input: queryToInput(request.query ?? {}, {
        taskId: "taskId",
        status: "status",
        limit: "limit"
      })
    };
  }

  const runMatch = RUN_PATH_PATTERN.exec(path);
  if (method === "GET" && runMatch?.[1] !== undefined) {
    return {
      toolName: "agentos.get_run",
      input: {
        runId: decodeURIComponent(runMatch[1])
      }
    };
  }

  const cancelRunMatch = CANCEL_RUN_PATH_PATTERN.exec(path);
  if (method === "POST" && cancelRunMatch?.[1] !== undefined) {
    return {
      toolName: "agentos.cancel_run",
      input: {
        runId: decodeURIComponent(cancelRunMatch[1]),
        ...parseBodyRecord(request.body)
      }
    };
  }

  if (method === "GET" && path === "/agent-os/artifacts") {
    return {
      toolName: "agentos.list_artifacts",
      input: queryToInput(request.query ?? {}, {
        taskId: "taskId",
        runId: "runId",
        kind: "kind",
        limit: "limit"
      })
    };
  }

  const artifactMatch = ARTIFACT_PATH_PATTERN.exec(path);
  if (method === "GET" && artifactMatch?.[1] !== undefined) {
    return {
      toolName: "agentos.get_artifact",
      input: {
        artifactId: decodeURIComponent(artifactMatch[1])
      }
    };
  }

  if (method === "GET" && path === "/agent-os/events") {
    return {
      toolName: "agentos.search_events",
      input: queryToInput(request.query ?? {}, {
        query: "query",
        taskId: "taskId",
        runId: "runId",
        eventTypes: "eventTypes",
        limit: "limit"
      })
    };
  }

  return undefined;
}

function statusCodeForRuntimeResult(result: AgentOsMcpLocalRuntimeResult): number {
  return result.status === "succeeded" ? 200 : 403;
}

function createAppServerResponse(
  statusCode: number,
  body: Record<string, unknown>
): AgentOsAppServerResponse {
  return {
    statusCode,
    body,
    audit: {
      publicSurface: "app_server",
      liveHttpServerStarted: false,
      networkAccessed: false,
      realProviderExecutionInvoked: false
    }
  };
}

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? path;
  const normalized = withoutQuery.endsWith("/") && withoutQuery !== "/"
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
  return normalized || "/";
}

function parseBodyRecord(body: unknown): Record<string, unknown> {
  if (body === undefined) {
    return {};
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("agent_os_app_server_body_must_be_object");
  }
  return body as Record<string, unknown>;
}

function queryToInput(
  query: Record<string, string | string[] | undefined>,
  mapping: Record<string, string>
): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  for (const [queryKey, inputKey] of Object.entries(mapping)) {
    const value = query[queryKey];
    if (value === undefined) {
      continue;
    }

    if (inputKey === "limit") {
      input[inputKey] = parseQueryInteger(firstQueryValue(value), queryKey);
    } else if (inputKey === "eventTypes") {
      input[inputKey] = Array.isArray(value) ? value : [value];
    } else {
      input[inputKey] = firstQueryValue(value);
    }
  }

  return input;
}

function firstQueryValue(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function parseQueryInteger(value: string, key: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`agent_os_app_server_query_must_be_integer:${key}`);
  }
  return parsed;
}
