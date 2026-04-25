# Target Host Layer Skeleton

`packages/host-client-example/src/target-host-layer-skeleton.ts` is the
copyable host-layer module for a real embedding repo.

It is also re-exported from `packages/host-client-example/src/index.ts` as part
of the public example-host surface.

Use it when you want one file that:

- accepts a real current host object
- accepts host-specific directive builders
- calls `createCodexDesktopLiveHostStarter()` for you

## Main Entry

- `createCodexDesktopTargetHostDirectives()`
- `createCodexDesktopTargetHostLayerSkeleton()`

## What This File Is For

The core package already exposes the starter and live-host helpers.

This skeleton is the next layer up:

- a module you can copy into the target host repo
- a place to keep host-specific shell / patch / automation directive logic
- a thin seam between real host tools and the shared `codex-router` runtime
- a wiring layer that now fails on unwired host-contract placeholders before
  bundle creation

## Minimal Shape

```ts
import { createCodexDesktopTargetHostLayerSkeleton } from "../packages/host-client-example/src/index.js";

const bundle = createCodexDesktopTargetHostLayerSkeleton({
  policy,
  anchor: "codex-router@target-host",
  host: codexDesktopHost,
  directiveBuilders: {
    shellCommand(invocation) {
      return {
        command: `npm test -- ${invocation.task.taskId}`
      };
    },
    applyPatch() {
      return buildPatch();
    }
  },
  telemetryStore
});
```

## Recommended Use

- build the `host` object from `target-host-object-contract` first
- keep the real imported tool hooks in one local `host` object
- keep task-to-command / task-to-patch logic in `directiveBuilders`
- use the built-in fail-fast host validation from the starter before the first
  live execution
- rely on the contract-level fail-fast check to catch placeholder methods before
  they reach the starter
