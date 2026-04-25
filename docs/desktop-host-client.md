# Desktop Host Client

`packages/desktop-host-client` is the thin production-shaped starter for hosts
that want to embed `codex-router` without copying wiring from the example
package.

It keeps the same Desktop-first architecture:

- the router SDK decides what should run
- the host still owns primitive execution
- persistence, memory, telemetry, and resume behavior stay host-injected

## What It Adds

Compared with `packages/host-client-example`, this package removes the in-memory
demo defaults and keeps only the reusable host-side surface:

- `createDesktopHostClient()`
- `DesktopHostClient`
- `run(task)`
- `resume(task, options?)`

For a concrete Codex Desktop primitive adapter below this layer, pair it with
`packages/codex-desktop-bindings`.

## What The Host Must Provide

- a real `bridge` or `bridgeBindings`
- a real `preflight` view:
  - `authAvailable`
  - `availableTools`
- optional persistence wiring:
  - `checkpointStore`
  - `auditStore`
  - `memoryAdapter`
  - `memoryRecall`
  - `memoryOverviewProvider`
  - `telemetryStore`

## Minimal Example

```ts
import {
  createCodexMemoryAdapterFromHost,
  createMcpToolStyleCodexMemoryOperations
} from "../packages/codex-memory-host-client/src/index.js";
import { createDesktopHostClient } from "../packages/desktop-host-client/src/index.js";

const memoryOperations = createMcpToolStyleCodexMemoryOperations({
  recordMemoryTool(input) {
    return record_memory(input);
  },
  searchMemoryTool(input) {
    return search_memory(input);
  },
  memoryOverviewTool(input) {
    return memory_overview(input);
  }
});

const { client: memoryClient, adapter: memoryAdapter } = createCodexMemoryAdapterFromHost(memoryOperations, {
  anchor: "codex-router@desktop-host",
  target: "process",
  tags: ["desktop-host"]
});

const hostClient = createDesktopHostClient({
  policy,
  preflight: {
    authAvailable: true,
    availableTools: [
      "read_thread_terminal",
      "spawn_agent",
      "wait_agent",
      "send_input",
      "shell_command",
      "apply_patch",
      "automation_update",
      "close_agent"
    ]
  },
  bridgeBindings: {
    read_thread_terminal: (invocation) => readThreadTerminal(invocation),
    spawn_agent: (invocation) => spawnAgent(invocation),
    wait_agent: (invocation) => waitAgent(invocation),
    send_input: (invocation) => sendInput(invocation),
    close_agent: (invocation) => closeAgent(invocation),
    automation_update: (invocation) => updateAutomation(invocation),
    shell_command: (invocation) => runShell(invocation),
    apply_patch: (invocation) => applyPatch(invocation)
  },
  persistence: {
    checkpointStore,
    auditStore,
    memoryAdapter,
    memoryOverviewProvider: memoryClient,
    telemetryStore
  },
  availableAgents: 2
});

const result = await hostClient.run(task);
const resumed = await hostClient.resume(task, {
  required: true
});
```

## Resume Behavior

`resume()` resolves in this order:

1. explicit `resume()` overrides
2. `persistence.memoryRecall`
3. `persistence.memoryAdapter` if it also supports checkpoint recall
4. `persistence.checkpointStore` if it supports latest-checkpoint lookup

This means a host can start with one store and grow into memory-backed resume
without changing the outer `DesktopHostClient` surface.

## When To Use Which Package

- use `packages/host-client-example` when you want a deterministic demo or test
  harness
- use `packages/desktop-host-client` when you are wiring a real host embedding
  and want a stable starter surface
