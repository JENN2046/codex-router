# Target Host Embedding Starter

`packages/host-client-example/src/target-host-embedding-starter.ts` is the
highest-level copyable starter for a real embedding repo.

It combines:

- the target host-object contract template
- readiness inspection
- the target host-layer skeleton

into one small helper.

## Main Entry

- `createCodexDesktopTargetHostEmbeddingStarter()`

The returned starter exposes:

- `host`
- `inspect()`
- `getStatus()`
- `assertReady()`
- `createBundle()`

## What This File Is For

Some embedding repos do not want to wire three separate steps:

1. create the host contract object
2. inspect readiness
3. hand the host into the target host-layer skeleton

This starter keeps those steps together while still leaving the real host
methods mutable and local to the embedding repo.

## Minimal Shape

```ts
import { createCodexDesktopTargetHostEmbeddingStarter } from "../packages/host-client-example/src/index.js";

const starter = createCodexDesktopTargetHostEmbeddingStarter({
  policy,
  anchor: "codex-router@target-embedding",
  directiveBuilders: {
    shellCommand(invocation) {
      return {
        command: `npm test -- ${invocation.task.taskId}`
      };
    }
  }
});

starter.host.read_thread_terminal = () => read_thread_terminal();
starter.host.spawn_agent = (input) => spawn_agent(input);
starter.host.wait_agent = (input) => wait_agent(input);
starter.host.send_input = (input) => send_input(input);
starter.host.close_agent = (input) => close_agent(input);
starter.host.shell_command = (input) => shell_command(input);
starter.host.apply_patch = (patch) => apply_patch(patch);
starter.host.automation_update = (input) => automation_update(input);
starter.host.record_memory = (input) => record_memory(input);
starter.host.search_memory = (input) => search_memory(input);

starter.assertReady();
const bundle = starter.createBundle();
```

## Recommended Use

- use this when you want one embedding-facing entrypoint
- use `inspect()` while wiring methods incrementally
- use `getStatus()` when you want a structured view of what is already wired and
  what is still pending
- call `assertReady()` before the first live run
- then create the bundle and hand execution to `hostClient`

For the real step-by-step integration flow, use:

- `target-host-embedding-implementation-checklist`

If you prefer more explicit layers, use:

- `target-host-object-contract`
- `target-host-layer-skeleton`

directly instead.
