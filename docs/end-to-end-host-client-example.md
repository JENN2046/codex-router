# End-To-End Host Client Example

`packages/host-client-example` is the shortest path to understanding how a real
host can embed `codex-router`.

It wires together:

- in-memory `codex-memory` client
- `CodexMemoryAdapter`
- in-memory checkpoint and audit stores
- in-memory execution observation store
- typed primitive result envelopes
- `runDesktopTask()`
- `resumeDesktopTask()`

## What The Example Covers

The example host client demonstrates:

1. fresh task execution through `run()`
2. checkpoint persistence into memory
3. checkpoint persistence into a local checkpoint store
4. resume-aware execution through `resume()`
5. memory-first resume with checkpoint fallback
6. typed primitive success and failure results
7. execution observations that can be referenced from recovery evidence
8. telemetry alert delivery window presets
9. alert dedupe/cooldown state persistence across sessions
10. resume across client instances through shared memory or persisted checkpoint fallback

## Main Entry

Use:

- `createExampleDesktopHostClient()`

from:

- [packages/host-client-example/src/index.ts](A:/codex-router/packages/host-client-example/src/index.ts)

The package keeps its in-memory checkpoint, audit, and codex-memory store
implementations internal. Treat the public surface as the example client,
observation store access, and bridge helpers rather than importing the backing
store classes directly.

## Example Usage

```ts
const client = createExampleDesktopHostClient({
  policy
});

await client.run({
  taskId: "example-run",
  source: "desktop-thread",
  intent: {
    summary: "review current config",
    requestedAction: "inspect and summarize the current config state",
    successCriteria: [],
    outOfScope: []
  },
  repoContext: { repoRoot: "A:/codex-router" },
  target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
  constraints: {},
  hints: { riskHints: [], tags: [] }
});

await client.resume({
  taskId: "example-run",
  source: "desktop-thread",
  intent: {
    summary: "review current config",
    requestedAction: "inspect and summarize the current config state",
    successCriteria: [],
    outOfScope: []
  },
  repoContext: { repoRoot: "A:/codex-router" },
  target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
  constraints: {},
  hints: { riskHints: [], tags: [] }
}, {
  required: true
});
```

## Run The Demo

For a deterministic local walkthrough, run:

```bash
npm run demo:runtime-governance
```

The demo runs entirely in memory. It covers:

- a successful example host execution
- a primitive failure with a resolvable `execution-observation:*` evidence ref
- a third execution failure that returns a recovery arbitration packet

It does not invoke the real Codex CLI, call a provider, or write
`docs/evidence` files.

## Execution Evidence

The example client records execution observations by default. A failed primitive
emits an observation, and runtime governance can place an
`execution-observation:*` ref in recovery evidence.

```ts
const result = await client.run(task);
const state = await client.getState();

const failedObservation = state.observations.find(
  (observation) => observation.status === "failed"
);
```

Hosts that already own observation persistence can pass `observationStore` or
`observationBus` when creating the client. Passing only `observationBus` keeps
execution compatible but `getState().observations` will be empty because the
example client has no query surface for that external bus.

## Cross-Session Resume

For memory-backed resume across host instances, provide the same real or shared
`memoryClient` implementation to each client.

For local fallback resume when memory recall misses, provide:

```ts
const client = createExampleDesktopHostClient({
  policy,
  checkpointStorePath: "A:/tmp/codex-router-checkpoints.json"
});
```

That path uses `packages/checkpoint-index` under the hood so a later host
instance can fall back to the latest local checkpoint even after process
restart.

## Telemetry Delivery Window Presets and Cross-Session Suppression

The example host client can now resolve alert-delivery suppression behavior directly from
`routing-policy.yaml` so teams can tune `dedupe` and `cooldown` from policy instead
of hardcoded host logic.

In `routing-policy.yaml`, configure:

```yaml
telemetryAlertDeliveryWindow:
  defaultPreset: "engineering"
  presetByToolAccess:
    read_only: "read_only"
    local_write: "local_write"
    engineering_write: "engineering"
    protected_remote: "release"
  presets:
    engineering:
      dedupeWindowMs: 30000
      cooldownWindowMs: 60000
```

Then create the host with:

```ts
const client = createExampleDesktopHostClient({
  policy,
  telemetryAlertDeliveryWindowStorePath: "A:/tmp/alert-window-state.json",
  telemetryAlertThresholds: {
    error: {
      totals: { failures: 0 }
    }
  },
  telemetrySink: {
    label: "example-external-telemetry",
    sink: {
      async record() {
        throw new Error("simulated_telemetry_failure");
      }
    }
  }
});
```

At runtime, `decision.execution.toolAccess` drives preset selection.
For the same session and across new process sessions, the client loads and persists
`telemetryAlertDeliveryWindowStore` to avoid duplicate alert noise:

- same alert within `dedupeWindowMs`: suppressed as `dedupe`
- same alert shape with changed value within `cooldownWindowMs`: suppressed as `cooldown`
- different alert shape within windows: not suppressed

## Notes

- This package is intentionally in-memory and deterministic.
- It is meant to show the integration shape, not production persistence.
- For a real host, replace the in-memory memory client and bridge with live
  implementations while keeping the same contract surface.
