# Codex Desktop Bindings

`packages/codex-desktop-bindings` is the first concrete adapter from
`codex-router` primitives into Codex Desktop-style runtime calls.

It sits one level below `desktop-host-client`:

- `desktop-host-client` owns high-level `run()` / `resume()` wiring
- `codex-desktop-bindings` maps individual primitives into real Desktop tool
  calls

## What It Solves

The generic bridge contract is intentionally abstract, but real host wiring has
three extra problems:

1. `shell_command`, `apply_patch`, and `automation_update` need concrete payloads
2. `spawn_agent` / `wait_agent` / `close_agent` need task-local agent state
3. `send_input` needs a real target instead of a generic primitive name

This package handles those edges through:

- a typed runtime interface
- directive resolvers for payload-bearing primitives
- a small in-memory task session that tracks active spawned agents

## Main Surface

- `createCodexDesktopBindings()`
- `createCodexDesktopBridge()`
- `createCodexDesktopBindingSession()`
- `createToolStyleCodexDesktopRuntime()`

## Runtime Contract

The runtime is intentionally close to Codex Desktop tool names:

- `readThreadTerminal()`
- `spawnAgent(...)`
- `sendInput(...)`
- `waitAgent(...)`
- `closeAgent(...)`
- `automationUpdate(...)`
- `shellCommand(...)`
- `applyPatch(...)`

Your host is responsible for mapping these calls to the actual tool layer.

If your host already exposes Codex Desktop tool-style functions such as
`spawn_agent`, `wait_agent`, `shell_command`, and `apply_patch`, use
`createToolStyleCodexDesktopRuntime()` to convert those directly into a
`CodexDesktopRuntime` object.

## Example

```ts
import { createCodexDesktopBridge } from "../packages/codex-desktop-bindings/src/index.js";

const bridge = createCodexDesktopBridge(runtime, {
  shellCommand(invocation) {
    return {
      command: `npm test -- ${invocation.task.taskId}`,
      workdir: invocation.task.repoContext.repoRoot
    };
  },
  applyPatch(invocation) {
    return buildPatchForTask(invocation.task.taskId);
  },
  automationUpdate(invocation) {
    return {
      mode: "create",
      kind: "heartbeat",
      name: `follow-up-${invocation.task.taskId}`,
      prompt: invocation.reason,
      destination: "thread",
      status: "ACTIVE",
      rrule: "FREQ=DAILY;INTERVAL=1"
    };
  }
});
```

## Default Behavior

- `spawn_agent`
  - if you do not provide a resolver, the adapter will derive one request per
    `agentStrategy.assignment`
- `wait_agent`
  - defaults to all active agents tracked for the task
- `close_agent`
  - defaults to closing all active agents tracked for the task
- `send_input`
  - defaults to the most recently active tracked agent
  - if no tracked agent exists, the adapter can either `noop` or fail depending
    on `sendInputWithoutAgentMode`
- `shell_command`
  - requires an explicit resolver
- `apply_patch`
  - requires an explicit resolver
- `automation_update`
  - requires an explicit resolver

## Why This Is Useful

This is the first layer in the repo that is concrete enough for a real Codex
Desktop host to reuse directly instead of rebuilding per-primitive state and
payload resolution from scratch.
