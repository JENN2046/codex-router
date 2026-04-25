# Target Host Embedding Implementation Checklist

This checklist is the concrete path for wiring `codex-router` into a real
embedding repo.

Default recommended entrypoint:

- `createCodexDesktopTargetHostEmbeddingStarter()`

If the embedding wants more explicit layers, it can instead use:

- `target-host-object-contract`
- `target-host-layer-skeleton`

For the first actual repo, pair this checklist with:

- `first-target-embedding-repo-task-sheet`
- `first-target-embedding-repo-task-sheet-vcpchat`

## 1. Freeze The Entrypoint

Choose one integration layer for the target repo:

- recommended: `target-host-embedding-starter`
- more explicit: `target-host-object-contract + target-host-layer-skeleton`
- only use `codex-desktop-live-host` directly if the host already owns full
  wiring

Pass bar:

- the repo adopts one path and does not keep two competing integration layers

## 2. Create The Local Host Scaffold

Create a local wiring file in the target repo and start with:

```ts
import { createCodexDesktopTargetHostEmbeddingStarter } from "codex-router/...";

const starter = createCodexDesktopTargetHostEmbeddingStarter({
  policy,
  anchor: "your-host@codex-router",
  directiveBuilders
});
```

Pass bar:

- the local wiring file exists
- `starter.host` is the single assembly point for the real host object

## 3. Wire Required Runtime Methods

Required runtime methods:

- `read_thread_terminal`
- `spawn_agent`
- `wait_agent`
- `send_input`
- `close_agent`
- `shell_command`
- `apply_patch`
- `automation_update`

Pass bar:

- every required runtime method is replaced with a real host implementation
- no runtime placeholders remain

## 4. Wire Required Memory Methods

Required memory methods:

- `record_memory`
- `search_memory`

Optional:

- `memory_overview`

Pass bar:

- `record_memory` and `search_memory` are real implementations
- if the host supports memory health / preflight, wire `memory_overview` too

## 5. Run Contract Inspection

Before bundle creation:

```ts
const inspection = starter.inspect();
starter.assertReady();
```

Pass bar:

- `inspection.ready === true`
- `inspection.placeholderMethods.length === 0`
- `inspection.missingMethods.length === 0`

Failure signals:

- `codex_desktop_target_host_contract_unwired_methods:...`
- `codex_desktop_live_host_missing_methods:...`

## 6. Add Directive Builders

At minimum, decide whether the host needs:

- `shellCommand`
- `applyPatch`
- `automationUpdate`

Recommended posture:

- keep task-to-command mapping inside `directiveBuilders`
- do not bury task-specific routing inside raw host methods

Pass bar:

- directive logic and raw host execution are clearly separated

## 7. Create The Bundle

```ts
const bundle = starter.createBundle();
```

Pass bar:

- bundle creation succeeds without throwing
- `hostClient`, `bridge`, `session`, and `memoryClient` are usable

## 8. Run A Read-Only Sanity Check

Start with one read-only task:

- it should at least touch `read_thread_terminal`
- it should not require patching or destructive writes

Pass bar:

- the runner is not blocked unexpectedly by preflight or approval
- the task reaches a real execution result

## 9. Run An Engineering Sanity Check

Then run one minimal engineering task that covers at least:

- `spawn_agent`
- `wait_agent`
- `shell_command`
- `apply_patch`
- `record_memory`
- `search_memory`

Pass bar:

- `executionResult.status === "completed"`
- memory checkpoint write succeeds
- no placeholder or missing-method errors appear

## 10. Confirm Preflight And Telemetry Posture

Review the host-specific defaults for:

- `availableTools`
- `workspaceClean`
- `protectedBranch`
- memory preflight posture
- telemetry sink / alert sink behavior

Pass bar:

- preflight defaults match the real host
- release posture still enforces the intended memory / telemetry behavior

## 11. Record The First Wiring Result

After the first real wiring pass, record at least:

- embedding repo name
- chosen entrypoint layer
- wired required methods
- unwired optional capabilities
- read-only sanity result
- engineering sanity result
- remaining risk

Pass bar:

- the next integrator can resume without rediscovering the current state

## Minimum Acceptance Bar

A real embedding repo counts as wired only if all of these are true:

- one integration layer is selected
- all required runtime methods are wired
- all required memory methods are wired
- `starter.inspect().ready === true`
- `starter.createBundle()` succeeds
- one read-only sanity check passes
- one engineering sanity check passes

## Not Good Enough Yet

These do not count as a completed integration:

- docs exist, but no local wiring file exists
- a scaffold exists, but placeholders were not replaced
- the starter can be created, but the bundle cannot
- only read-only flow works while engineering flow fails
- memory methods are still mocks or no-ops
- method names exist, but they are not actually connected to the live host
