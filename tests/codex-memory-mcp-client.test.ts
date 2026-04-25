import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
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

const activeServers = new Set<http.Server>();

afterEach(async () => {
  await Promise.all(
    [...activeServers].map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        activeServers.delete(server);
        resolve();
      });
    }))
  );
});

test("CodexMemoryMcpHttpClient talks to codex-memory over native MCP HTTP", async () => {
  const requests: RecordedRequest[] = [];
  const { origin } = await startMockCodexMemoryServer(requests);
  const client = createCodexMemoryMcpHttpClient({
    baseUrl: origin,
    bearerToken: "test-token"
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
  const overview = await client.memoryOverview({
    auditWindow: 7,
    limit: 5
  });
  await client.close();

  assert.equal(write.memoryId, "memory-http-1");
  assert.equal(search.results[0]?.memoryId, "memory-http-1");
  assert.deepEqual(overview, {
    adapterStatus: {
      codexMcp: "enabled"
    }
  });

  assert.equal(requests[0]?.method, "POST");
  assert.equal((requests[0]?.body as { method?: string })?.method, "initialize");
  assert.equal(requests[1]?.sessionId, "session-http-1");
  assert.equal(requests[1]?.authorization, "Bearer test-token");
  assert.equal((requests[1]?.body as { method?: string })?.method, "tools/call");
  assert.equal((requests.at(-1)?.method), "DELETE");
});

test("createCodexMemoryAdapterFromMcpHttp wires native MCP transport into CodexMemoryAdapter", async () => {
  const requests: RecordedRequest[] = [];
  const { origin } = await startMockCodexMemoryServer(requests);
  const { adapter, client } = createCodexMemoryAdapterFromMcpHttp({
    baseUrl: origin
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
    requests.filter((request) => (request.body as { method?: string })?.method === "tools/call").length,
    2
  );
});

function startMockCodexMemoryServer(recordedRequests: RecordedRequest[]): Promise<{ origin: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const rawBody = await readBody(req);
      const body = rawBody ? JSON.parse(rawBody) as MockJsonRpcBody : undefined;
      const sessionId = req.headers["mcp-session-id"];

      recordedRequests.push({
        method: req.method ?? "GET",
        path: req.url ?? "/",
        ...(typeof sessionId === "string" ? { sessionId } : {}),
        ...(typeof req.headers.authorization === "string"
          ? { authorization: req.headers.authorization }
          : {}),
        ...(body !== undefined ? { body } : {})
      });

      if (req.method === "DELETE") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (body?.method === "initialize") {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Mcp-Session-Id": "session-http-1"
        });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id ?? "1",
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {
              tools: {
                listChanged: true
              }
            },
            serverInfo: {
              name: "vcp_codex_memory",
              version: "0.1.0"
            }
          }
        }));
        return;
      }

      if (body?.method === "tools/call" && body.params?.name === "record_memory") {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8"
        });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id ?? "2",
          result: {
            structuredContent: {
              success: true,
              memoryId: "memory-http-1",
              filePath: "memory://memory-http-1"
            },
            content: [
              {
                type: "text",
                text: "{\"success\":true,\"memoryId\":\"memory-http-1\"}"
              }
            ],
            isError: false
          }
        }));
        return;
      }

      if (body?.method === "tools/call" && body.params?.name === "search_memory") {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8"
        });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id ?? "3",
          result: {
            structuredContent: {
              results: [
                {
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
                }
              ]
            },
            isError: false
          }
        }));
        return;
      }

      if (body?.method === "tools/call" && body.params?.name === "memory_overview") {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8"
        });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id ?? "4",
          result: {
            structuredContent: {
              adapterStatus: {
                codexMcp: "enabled"
              }
            },
            isError: false
          }
        }));
        return;
      }

      res.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8"
      });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: body?.id ?? null,
        error: {
          code: -32603,
          message: "unexpected test request"
        }
      }));
    });

    server.listen(0, "127.0.0.1", () => {
      activeServers.add(server);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("mock_server_address_unavailable"));
        return;
      }

      resolve({
        origin: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}
