import test from "node:test";
import assert from "node:assert/strict";
import {
  createCodexMemoryAdapterFromMcpHttp,
  createCodexMemoryMcpHttpClient
} from "../packages/codex-memory-mcp-client/src/index.js";

interface RecordedRequest {
  method: string;
  path: string;
  sessionId?: string;
  authorization?: string;
  body?: unknown;
}

interface MockJsonRpcBody {
  id?: string | number | null;
  method?: string;
  params?: {
    name?: string;
  };
}

test("CodexMemoryMcpHttpClient uses the injected native-MCP fetch transport", async () => {
  const requests: RecordedRequest[] = [];
  const client = createCodexMemoryMcpHttpClient({
    baseUrl: "http://codex-memory.invalid",
    bearerToken: "test-token",
    fetchImpl: createMockCodexMemoryFetch(requests)
  });

  const write = await client.recordMemory({
    target: "process",
    title: "checkpoint: router task-http ready",
    content: "content",
    evidence: "evidence",
    reusable: true,
    sensitivity: "internal",
    validated: true
  });
  const search = await client.searchMemory({
    query: "router task-http checkpoint",
    target: "process",
    includeContent: true,
    limit: 3
  });
  const overview = await client.memoryOverview({ auditWindow: 7, limit: 5 });
  await client.close();

  assert.equal(write.memoryId, "memory-http-1");
  assert.equal(search.results[0]?.memoryId, "memory-http-1");
  assert.deepEqual(overview, { adapterStatus: { codexMcp: "enabled" } });
  assert.equal(requests[0]?.method, "POST");
  assert.equal(requests[0]?.path, "/mcp/codex-memory");
  assert.equal((requests[0]?.body as { method?: string })?.method, "initialize");
  assert.equal(requests[1]?.sessionId, "session-http-1");
  assert.equal(requests[1]?.authorization, "Bearer test-token");
  assert.equal((requests[1]?.body as { method?: string })?.method, "tools/call");
  assert.equal(requests.at(-1)?.method, "DELETE");
});

test("createCodexMemoryAdapterFromMcpHttp wires the injected MCP transport", async () => {
  const requests: RecordedRequest[] = [];
  const { adapter, client } = createCodexMemoryAdapterFromMcpHttp({
    baseUrl: "http://codex-memory.invalid",
    fetchImpl: createMockCodexMemoryFetch(requests)
  }, {
    anchor: "codex-router@A:/codex-router"
  });

  const result = await adapter.recordCheckpointDetailed({
    checkpointId: "cp-http-2",
    taskId: "task-http-2",
    stage: "ready-for-desktop-execution",
    createdAt: "2026-04-23T13:00:00.000Z",
    summary: "ready to continue"
  });
  await client.close();

  assert.equal(result.write.memoryId, "memory-http-1");
  assert.equal(result.recall?.memoryId, "memory-http-1");
  assert.equal(
    requests.filter((request) => (
      (request.body as { method?: string })?.method === "tools/call"
    )).length,
    2
  );
});

function createMockCodexMemoryFetch(recordedRequests: RecordedRequest[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? String(input));
    const method = init?.method ?? request?.method ?? "GET";
    const headers = new Headers(init?.headers ?? request?.headers);
    const rawBody = typeof init?.body === "string" ? init.body : undefined;
    const body = rawBody === undefined
      ? undefined
      : JSON.parse(rawBody) as MockJsonRpcBody;
    const sessionId = headers.get("Mcp-Session-Id");
    const authorization = headers.get("Authorization");

    recordedRequests.push({
      method,
      path: url.pathname,
      ...(sessionId === null ? {} : { sessionId }),
      ...(authorization === null ? {} : { authorization }),
      ...(body === undefined ? {} : { body })
    });

    if (method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (body?.method === "initialize") {
      return jsonRpcResponse({
        jsonrpc: "2.0",
        id: body.id ?? "1",
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: "vcp_codex_memory", version: "0.1.0" }
        }
      }, { "Mcp-Session-Id": "session-http-1" });
    }
    if (body?.method === "tools/call" && body.params?.name === "record_memory") {
      return jsonRpcResponse({
        jsonrpc: "2.0",
        id: body.id ?? "2",
        result: {
          structuredContent: {
            success: true,
            memoryId: "memory-http-1",
            filePath: "memory://memory-http-1"
          },
          isError: false
        }
      });
    }
    if (body?.method === "tools/call" && body.params?.name === "search_memory") {
      return jsonRpcResponse({
        jsonrpc: "2.0",
        id: body.id ?? "3",
        result: {
          structuredContent: {
            results: [{
              title: "checkpoint: codex-router@A:/codex-router task-http-2 ready-for-desktop-execution",
              memoryId: "memory-http-1",
              content: [
                "Checkpoint ID: cp-http-2",
                "Checkpoint anchor: codex-router@A:/codex-router",
                "Task ID: task-http-2",
                "Stage conclusion: ready-for-desktop-execution",
                "Created at: 2026-04-23T13:00:00.000Z",
                "Summary: ready to continue"
              ].join("\n")
            }]
          },
          isError: false
        }
      });
    }
    if (body?.method === "tools/call" && body.params?.name === "memory_overview") {
      return jsonRpcResponse({
        jsonrpc: "2.0",
        id: body.id ?? "4",
        result: {
          structuredContent: { adapterStatus: { codexMcp: "enabled" } },
          isError: false
        }
      });
    }
    return jsonRpcResponse({
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: { code: -32603, message: "unexpected test request" }
    }, {}, 500);
  }) as typeof fetch;
}

function jsonRpcResponse(
  body: unknown,
  headers: Record<string, string> = {},
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
