import { z } from "zod";
import {
  AGENT_OS_MCP_ARTIFACT_NOT_FOUND,
  AGENT_OS_MCP_RUN_NOT_FOUND,
  createAgentOsMcpLocalRuntime,
  type AgentOsMcpLocalRuntimeOptions,
  type AgentOsMcpLocalRuntimeResult,
  type AgentOsMcpToolName
} from "../../protocol-mcp/src/index.js";

export const AgentOsAppServerMethodSchema = z.enum(["GET", "POST"]);

export type AgentOsAppServerMethod = z.infer<typeof AgentOsAppServerMethodSchema>;

export type AgentOsAppServerRequest = {
  method: AgentOsAppServerMethod | string;
  path: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

// Capability grants and approvals belong in these trusted server-side options,
// never in the client-controlled request envelope.
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
const AGENT_OS_APP_SERVER_INVALID_METHOD = "agent_os_app_server_invalid_method";
const AGENT_OS_APP_SERVER_INVALID_PATH = "agent_os_app_server_invalid_path";
const AGENT_OS_APP_SERVER_INVALID_REQUEST = "agent_os_app_server_invalid_request";
const AGENT_OS_RUNTIME_INVALID_CURSOR_PREFIXES = [
  "agent_os_list_runs_invalid_cursor:",
  "agent_os_list_artifacts_invalid_cursor:",
  "agent_os_search_events_invalid_cursor:"
] as const;

export function handleAgentOsAppServerRequest(
  input: HandleAgentOsAppServerRequestInput
): AgentOsAppServerResponse {
  const { request, ...trustedRuntimeOptions } = input;
  const routeResult = routeAgentOsAppServerRequestSafely(request);
  if (routeResult.status === "invalid") {
    return createBadRequestResponse(routeResult.reason);
  }

  const route = routeResult.route;
  if (route === undefined) {
    return createAppServerResponse(404, {
      status: "blocked",
      reasons: ["agent_os_app_server_route_not_found"]
    });
  }

  const runtime = createAgentOsMcpLocalRuntime({
    ...trustedRuntimeOptions,
    publicSurface: "app_server"
  });

  let result: AgentOsMcpLocalRuntimeResult;
  try {
    result = runtime.handleToolCall({
      toolName: route.toolName,
      input: route.input
    });
  } catch (error) {
    const badRequestReason = appServerRuntimeBadRequestReason(error);
    if (badRequestReason !== undefined) {
      return createBadRequestResponse(badRequestReason);
    }
    throw error;
  }

  return createAppServerResponse(statusCodeForRuntimeResult(result), {
    result
  });
}

export function routeAgentOsAppServerRequest(
  request: AgentOsAppServerRequest
): AgentOsAppServerRoute | undefined {
  const methodResult = AgentOsAppServerMethodSchema.safeParse(request.method);
  if (!methodResult.success) {
    throw new Error(AGENT_OS_APP_SERVER_INVALID_METHOD);
  }
  const method = methodResult.data;
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
        limit: "limit",
        cursor: "cursor"
      })
    };
  }

  const runMatch = RUN_PATH_PATTERN.exec(path);
  if (method === "GET" && runMatch?.[1] !== undefined) {
    return {
      toolName: "agentos.get_run",
      input: {
        runId: decodePathSegment(runMatch[1])
      }
    };
  }

  const cancelRunMatch = CANCEL_RUN_PATH_PATTERN.exec(path);
  if (method === "POST" && cancelRunMatch?.[1] !== undefined) {
    return {
      toolName: "agentos.cancel_run",
      input: {
        runId: decodePathSegment(cancelRunMatch[1]),
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
        limit: "limit",
        cursor: "cursor"
      })
    };
  }

  const artifactMatch = ARTIFACT_PATH_PATTERN.exec(path);
  if (method === "GET" && artifactMatch?.[1] !== undefined) {
    return {
      toolName: "agentos.get_artifact",
      input: {
        artifactId: decodePathSegment(artifactMatch[1])
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
        limit: "limit",
        cursor: "cursor"
      })
    };
  }

  return undefined;
}

type SafeRouteResult =
  | {
    status: "ok";
    route: AgentOsAppServerRoute | undefined;
  }
  | {
    status: "invalid";
    reason: string;
  };

function routeAgentOsAppServerRequestSafely(
  request: AgentOsAppServerRequest
): SafeRouteResult {
  try {
    return {
      status: "ok",
      route: routeAgentOsAppServerRequest(request)
    };
  } catch (error) {
    return {
      status: "invalid",
      reason: appServerRequestErrorReason(error)
    };
  }
}

function statusCodeForRuntimeResult(result: AgentOsMcpLocalRuntimeResult): number {
  if (
    resultHasReasonPrefix(result, AGENT_OS_MCP_RUN_NOT_FOUND)
    || resultHasReasonPrefix(result, AGENT_OS_MCP_ARTIFACT_NOT_FOUND)
  ) {
    return 404;
  }
  return result.status === "succeeded" ? 200 : 403;
}

function resultHasReasonPrefix(result: AgentOsMcpLocalRuntimeResult, prefix: string): boolean {
  return result.reasons.some((reason) => reason.startsWith(`${prefix}:`));
}

function createBadRequestResponse(reason: string): AgentOsAppServerResponse {
  return createAppServerResponse(400, {
    status: "blocked",
    reasons: [reason]
  });
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
  assertValidPathEncoding(withoutQuery);
  const normalized = withoutQuery.endsWith("/") && withoutQuery !== "/"
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
  return normalized || "/";
}

function assertValidPathEncoding(path: string): void {
  try {
    decodeURI(path);
  } catch (error) {
    if (error instanceof URIError) {
      throw new Error(AGENT_OS_APP_SERVER_INVALID_PATH);
    }
    throw error;
  }
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    if (error instanceof URIError) {
      throw new Error(AGENT_OS_APP_SERVER_INVALID_PATH);
    }
    throw error;
  }
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

function appServerRequestErrorReason(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("agent_os_app_server_")) {
    return error.message;
  }
  return AGENT_OS_APP_SERVER_INVALID_REQUEST;
}

function appServerRuntimeBadRequestReason(error: unknown): string | undefined {
  if (error instanceof z.ZodError) {
    return AGENT_OS_APP_SERVER_INVALID_REQUEST;
  }
  if (!(error instanceof Error)) {
    return undefined;
  }
  return AGENT_OS_RUNTIME_INVALID_CURSOR_PREFIXES.some((prefix) => error.message.startsWith(prefix))
    ? error.message
    : undefined;
}
