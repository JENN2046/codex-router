# Host Bridge Contract

`codex-router` stays Desktop-first by design:

- the SDK decides what should run
- the host decides how Desktop primitives are actually invoked

If a host does not want to build a raw `handlers` map manually, it can provide a
single bridge contract instead.

## Minimal Contract

```ts
interface DesktopHostBridge {
  invokePrimitive(invocation: DesktopPrimitiveInvocation): Promise<DesktopPrimitiveHandlerOutput> | DesktopPrimitiveHandlerOutput;
}
```

`DesktopPrimitiveInvocation` contains:

- `primitive`
- `taskId`
- `reason`
- `task`
- `decision`
- `executionPlan`
- `agentStrategy`
- `operation`
- `stepIndex`

This gives the host enough context to map a requested primitive into the real
Desktop runtime or another embedding environment.

## Result Envelope

Hosts may still return raw values, and the SDK will normalize them into a stable
result envelope automatically.

For stronger contracts, hosts should prefer returning typed envelopes from
`packages/desktop-live-adapter`:

- `createPrimitiveSuccessEnvelope()`
- `createPrimitiveFailureEnvelope()`

This lets hosts report explicit non-throwing failures while keeping primitive
results structurally consistent across fresh and resume-aware execution.

## Using A Bridge

```ts
import { runDesktopTask, createHostBridgeFromBindings } from "../packages/desktop-live-adapter/src/index.js";

const bridge = createHostBridgeFromBindings({
  read_thread_terminal: async () => readThreadTerminal(),
  spawn_agent: async (invocation) => ({
    primitive: "spawn_agent",
    ok: true,
    agentId: "agent-1",
    payload: await spawnAgent(invocation.reason)
  }),
  wait_agent: async () => waitForAgent(),
  shell_command: async (invocation) => runShellForTask(invocation.task.taskId)
});

const result = await runDesktopTask({
  task,
  policy,
  preflight,
  bridge
});
```

`runDesktopTask()` will convert the bridge into primitive handlers internally.

## Example Adapter

For tests and local prototyping, the SDK provides `createRecordingHostBridge()`.

It:

- records every primitive invocation
- returns a default success object when no custom binding is provided
- lets tests assert which primitives were requested and in what order

This is not a production transport. It is a stable adapter example for host
integrators and SDK tests.
