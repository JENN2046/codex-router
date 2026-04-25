# End-To-End Host Client Example

`packages/host-client-example` is the shortest path to understanding how a real
host can embed `codex-router`.

It wires together:

- in-memory `codex-memory` client
- `CodexMemoryAdapter`
- in-memory checkpoint and audit stores
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
7. telemetry alert delivery window presets
8. alert dedupe/cooldown state persistence across sessions
9. resume across client instances through shared memory or persisted checkpoint fallback

## Main Entry

Use:

- `createExampleDesktopHostClient()`

from:

- [packages/host-client-example/src/index.ts](A:/codex-router/packages/host-client-example/src/index.ts)

The package keeps its in-memory checkpoint, audit, and codex-memory store
implementations internal. Treat the public surface as the example client and
bridge helpers rather than importing the backing store classes directly.

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
