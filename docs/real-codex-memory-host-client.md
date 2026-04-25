# Real Codex-Memory Host Client

`packages/codex-memory-host-client` is the host-side adapter for real
`vcp_codex_memory` integration.

Its role is narrow:

- the host owns the actual MCP or tool invocation
- the package normalizes those calls into `CodexMemoryClient`
- `packages/codex-memory-adapter` then uses that client for checkpoint writes
  and recall

## Main Entry Points

Use:

- `createCodexMemoryHostClient()`
- `createCodexMemoryAdapterFromHost()`
- `createMcpToolStyleCodexMemoryOperations()`

from:

- [packages/codex-memory-host-client/src/index.ts](A:/codex-router/packages/codex-memory-host-client/src/index.ts)

The public surface is intentionally limited to those real host-wiring entry
points. Recording helpers stay test-local so the package contract stays focused
on production-shaped host integration.

## Minimal Host Wiring

```ts
const operations = createMcpToolStyleCodexMemoryOperations({
  recordMemoryTool(input) {
    return host.record_memory(input);
  },
  searchMemoryTool(input) {
    return host.search_memory(input);
  },
  memoryOverviewTool(input) {
    return host.memory_overview(input);
  }
});

const { client, adapter } = createCodexMemoryAdapterFromHost(operations, {
  anchor: "codex-router@A:/codex-router"
});
```

At that point:

- `client` is a real `CodexMemoryClient`
- `adapter` is a real `CodexMemoryAdapter`

and both can be plugged into the rest of the SDK.

## Why This Package Exists

Without this package, hosts have to:

- manually map tool names
- manually validate tool responses
- manually normalize record/search payloads

This package centralizes that work so the rest of the SDK can stay focused on
task routing and resume logic.
