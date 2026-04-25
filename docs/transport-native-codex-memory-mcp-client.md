# Transport-Native Codex Memory MCP Client

`packages/codex-memory-mcp-client` is the first host-independent memory client
for `codex-router`.

It talks to `codex-memory` through its native **HTTP MCP** transport instead of
requiring the host to pre-wrap `record_memory`, `search_memory`, and
`memory_overview` as local function calls.

## Why This Exists

Before this package, `codex-router` had two memory integration layers:

- `packages/codex-memory-adapter`
- `packages/codex-memory-host-client`

That was enough when the host already had direct access to memory tools, but it
still meant the host owned the transport.

This package closes that gap:

- `codex-router` can now connect directly to a live `codex-memory` MCP server
- session negotiation happens inside the client
- tool calls use the actual `tools/call` MCP contract
- the returned payloads are normalized back into the existing
  `CodexMemoryClient` interface

## Main Exports

- `CodexMemoryMcpHttpClient`
- `createCodexMemoryMcpHttpClient()`
- `createCodexMemoryAdapterFromMcpHttp()`

## Example

```ts
import { createCodexMemoryAdapterFromMcpHttp } from "../packages/codex-memory-mcp-client/src/index.js";

const { client, adapter } = createCodexMemoryAdapterFromMcpHttp({
  baseUrl: "http://127.0.0.1:7605",
  bearerToken: process.env.CODEX_MEMORY_BEARER_TOKEN
}, {
  anchor: "codex-router@A:/codex-router"
});

await adapter.recordCheckpoint({
  checkpointId: "cp-1",
  taskId: "task-1",
  stage: "ready-for-desktop-execution",
  createdAt: new Date().toISOString(),
  summary: "ready to continue"
});

const overview = await client.memoryOverview({
  auditWindow: 7,
  limit: 5
});

await client.close();
```

## Current Scope

This first version is intentionally narrow:

- native MCP transport: **HTTP**
- supported tools:
  - `record_memory`
  - `search_memory`
  - `memory_overview`

It does **not** yet add:

- native stdio MCP transport
- richer `context_text` recall inputs for checkpoint resume

If the host passes this client into the Desktop runner path and also forwards
`memoryOverview()` as a `MemoryOverviewProvider`, memory health can already be
consumed during preflight. The remaining gap is narrower: this package does not
yet ship a higher-level host runtime that auto-wires that provider end-to-end.
