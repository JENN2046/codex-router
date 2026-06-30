# Codex Router

`codex-router` is a Desktop-first policy SDK for Codex. It assumes Codex Desktop
already provides the execution runtime, then adds the missing governance layer:

- task classification and ambiguity gating
- model routing and execution profiles
- approval gates for protected actions
- escalation and circuit breaking
- desktop bridge planning
- checkpoint and audit helpers

## Layout

- `packages/contracts`
- `packages/policy-config`
- `packages/intent-gate`
- `packages/execution-profiles`
- `packages/routing-engine`
- `packages/approval-gate`
- `packages/runtime-control`
- `packages/desktop-bridge`
- `packages/desktop-host-client`
- `packages/desktop-decision-runner`
- `packages/desktop-live-adapter`
- `packages/desktop-agent-strategy`
- `packages/recon-policy`
- `packages/preflight`
- `packages/checkpoint-index`
- `packages/audit-memory`
- `packages/codex-desktop-bindings`
- `packages/codex-desktop-live-host`
- `packages/codex-cli-host`
- `packages/final-host-locator`
- `packages/codex-memory-adapter`
- `packages/codex-memory-host-client`
- `packages/codex-memory-mcp-client`
- `packages/host-client-example`
- `packages/observability`

## V1 Protocol

The current stable protocol surface is:

- `TaskEnvelope`
  - `schemaVersion`
  - `taskId`
  - `source`
  - `intent`
  - `repoContext`
  - `target`
  - `constraints`
  - `hints`
- `RoutingDecision`
  - `schemaVersion`
  - `decisionId`
  - `taskId`
  - `policyVersion`
  - `classification`
  - `execution`
  - `approval`
  - `parallelism`

Use `parseTaskEnvelope()` and `parseRoutingDecision()` from `packages/contracts`
to normalize caller input and apply defaults before routing or validation.

## Desktop Runner

`packages/desktop-decision-runner` is the first orchestration entrypoint for the
SDK. It connects:

- `classifyIntent`
- `routeTask`
- `runPreflight`
- `evaluateApprovalRequirement`
- `createDesktopExecutionPlan`
- `planAgentStrategy`

The runner returns one of three statuses:

- `blocked_preflight`
- `blocked_approval`
- `ready`

When a memory client also exposes `memoryOverview()`, the runner can fold
Codex-memory health into preflight. The current preflight layer can:

- require memory overview explicitly
- warn on recent rejected memory writes
- warn on pending shadow reconcile work
- fail when the Codex MCP adapter is present but not enabled

`PreflightResult` now also carries a structured `memory` state instead of
leaving memory health only as flat warning/error strings. The current states are:

- `ok`
- `degraded`
- `blocked`
- `unavailable`

This keeps backward-compatible `errors` / `warnings`, while giving hosts a more
stable memory-health object to inspect.

`DesktopDecisionRunnerResult` now also includes `observabilityEvents`, with:

- a preflight log event
- a memory-preflight log event

These are built from the structured memory state and can be forwarded by the
host into its own telemetry sink.

`packages/observability` now defines the shared telemetry contract:

- `TelemetrySink`
- `TelemetryAlertSink`
- `createRecordingTelemetrySink()`
- `createRecordingTelemetryAlertSink()`
- `createRecordingTelemetryAlertDeliveryMetricsCollector()`
- `createRecordingTelemetryDeliveryMetricsCollector()`
- `evaluateTelemetryAlertDeliveryAlerts()`
- `evaluateTelemetryDeliveryAlerts()`
- `createTelemetryDeliveryAlertLogEvents()`
- `createLoggerTelemetrySink()`
- `createLoggerTelemetryAlertSink()`
- `createTracingTelemetryAlertSink()`
- `createMetricsTelemetryAlertSink()`
- `createFanoutTelemetryAlertSink()`
- `createFanoutTelemetrySink()`
- `emitTelemetryAlerts()`
- `emitTelemetryEvents()`

So host integrations can either keep events in memory, or map them directly to
an existing logger/tracing backend without changing runner or live-adapter
contracts. If a host wants both local inspection and external forwarding, it
can fan out one event stream into multiple sinks. Fanout defaults to
`fail_fast`, but hosts can opt into `best_effort` and receive per-sink failure
callbacks when they want external forwarding to be non-blocking. Fanout entries
can also carry per-sink `timeoutMs`, `retries`, `retryDelayMs`, and `label`
fields, so hosts can start shaping production-style delivery behavior without
changing the top-level `TelemetrySink` contract.

If a host also needs delivery visibility, it can pass a
`TelemetryDeliveryMetricsCollector` into the fanout sink options and read back a
snapshot with:

- `totals.events`
- `totals.targetedSinks`
- `totals.attempts`
- `totals.successes`
- `totals.failures`
- `totals.timeouts`
- `totals.retries`

plus per-sink breakdowns for labels, last error, and recent delivery timestamps.

If the host also wants governance-style alerting, it can evaluate a snapshot
against threshold packs with:

- `evaluateTelemetryDeliveryAlerts(snapshot, thresholds)`
- `createTelemetryDeliveryAlertLogEvents(alerts, context?)`

If the host also wants the same visibility for alert backend delivery itself,
`packages/observability` now also supports a second layer:

- `createRecordingTelemetryAlertDeliveryMetricsCollector()`
- `evaluateTelemetryAlertDeliveryAlerts(snapshot, thresholds)`
- `createRecordingTelemetryAlertDeliveryWindowStore()`
- `partitionTelemetryAlertsForDelivery(alerts, store, policy, now?)`

That delivery-window layer can suppress repeated outbound alert sends with:

- `dedupeWindowMs` for identical alert payloads
- `cooldownWindowMs` for repeated alerts on the same alert key

The current threshold surface supports:

- `warn.totals`
- `warn.perSink`
- `error.totals`
- `error.perSink`

Each scope can alert on:

- `failures`
- `timeouts`
- `retries`
- `failureRate`
- `timeoutRate`

Once alerts are evaluated, hosts can now forward them through dedicated backend
adapters instead of converting everything back into plain log events first:

- logger backends via `createLoggerTelemetryAlertSink()`
- tracing backends via `createTracingTelemetryAlertSink()`
- metrics backends via `createMetricsTelemetryAlertSink()`

If alert forwarding needs the same delivery posture as normal telemetry events,
hosts can also use `createFanoutTelemetryAlertSink()` with:

- `fail_fast` or `best_effort`
- per-sink `timeoutMs`
- per-sink `retries`
- per-sink `retryDelayMs`
- `onSinkError(...)`

This keeps alert routing separate from normal log-event delivery while still
reusing the same alert structure and threshold packs.

Alert thresholds can now also be preset in `routing-policy.yaml`, aligned with
the same execution-oriented surface we already use elsewhere:

- `read_only`
- `local_write`
- `engineering`
- `release`

The config helpers are:

- `resolveTelemetryAlertThresholdPreset(policy, toolAccess, overridePreset?)`
- `getTelemetryAlertThresholdPreset(policy, presetName)`

The same preset surface now also exists for alert-backend delivery under
`telemetryAlertDeliveryAlerts`, with matching helpers:

- `resolveTelemetryAlertDeliveryThresholdPreset(policy, toolAccess, overridePreset?)`
- `getTelemetryAlertDeliveryThresholdPreset(policy, presetName)`

Memory health policy is now fixed into execution-oriented policy packs in
`routing-policy.yaml`:

- `read_only`
- `local_write`
- `engineering`
- `release`

The runner resolves the policy pack automatically from routed `toolAccess`
unless the host explicitly overrides `memoryOverviewPolicy`. The resolved pack
is surfaced back through `PreflightResult.memory.policyPack`.

Each pack now also carries host-facing execution guidance, currently:

- `memoryRequired`
- `resumeExpected`
- `telemetryMandatory`
- `checkpointFrequency`

That guidance is surfaced through `PreflightResult.memory.guidance`, so hosts
can treat the pack as an execution-time policy bundle instead of only a health
threshold profile.

The V1 default posture is intentionally risk-weighted:

- `read_only` stays permissive and does not require memory or telemetry
- `local_write` and `engineering` degrade into warnings when `codex-memory`
  is unavailable, so ordinary Desktop work can continue with visibility
- `release` keeps the strict path: memory stays required, telemetry stays
  mandatory, and `codex-memory` adapter issues still block execution

`packages/desktop-live-adapter` now consumes part of that guidance directly:

- `checkpointFrequency` can trigger execution-time checkpoints beyond the
  initial runner checkpoint
- `telemetryMandatory` can block live execution when the host does not provide
  a telemetry sink

`packages/host-client-example` includes an in-memory telemetry store and
demonstrates both:

- extra execution checkpoints for `engineering`
- a blocked `release` execution when telemetry is disabled
- fanout telemetry into a custom host sink while preserving local recorded
  events for `getState()`
- optional telemetry delivery metrics surfaced through `getState()`
- optional threshold-based telemetry alerts surfaced through `getState()`
- optional alert threshold preset resolution via `telemetryAlertPreset`
- optional alert sink fanout into custom alert backends while preserving local
  alert state for `getState()`
- optional alert-delivery metrics and alert-delivery threshold preset
  resolution surfaced through `getState()`
- optional alert-delivery dedupe / cooldown state surfaced through
  `telemetryAlertDeliverySuppressions`

## Live Adapter

`packages/desktop-live-adapter` executes a ready `DesktopExecutionPlan` through
host-provided primitive handlers. It is intentionally thin:

- the SDK decides what should run
- the host decides how each desktop primitive is actually invoked
- execution is sequential and fail-fast by default

If the host wants a single end-to-end entrypoint, use `runDesktopTask()` from
the same package. It composes:

- `runDesktopDecision()`
- `executeDesktopPlan()`

This keeps the policy decision and primitive execution in one call while still
letting the host own the actual Desktop primitive handlers.

For resume-aware execution, use `resumeDesktopTask()`. It composes:

- `resumeDesktopDecision()`
- `executeDesktopPlan()`

This gives the host the same one-call entrypoint while restoring the latest
checkpoint from memory first and then falling back to local checkpoint lookup
when configured.

If the host prefers a single bridge surface instead of raw per-primitive
handlers, `packages/desktop-live-adapter` also provides:

- `createPrimitiveHandlersFromBridge()`
- `createHostBridgeFromBindings()`
- `createRecordingHostBridge()`

See [docs/host-bridge-contract.md](docs/host-bridge-contract.md)
for the minimal bridge contract and example adapter shape.

## Memory Integration

`packages/codex-memory-adapter` provides a concrete `MemoryAdapter`
implementation for hosts that want `CheckpointRef` writes and recall helpers to
flow through a codex-memory compatible client.

`packages/desktop-decision-runner` can now use memory-backed checkpoint recall
through `resumeDesktopDecision()`, preferring memory recall first and then
falling back to a local checkpoint lookup when configured.

`packages/codex-memory-host-client` adapts real host-side
`record_memory/search_memory/memory_overview` operations into the
`CodexMemoryClient` interface expected by `packages/codex-memory-adapter`.

`packages/codex-memory-mcp-client` is the first transport-native client. It
talks directly to a live `codex-memory` HTTP MCP endpoint and maps the native
`initialize` + `tools/call` protocol flow back into the same
`CodexMemoryClient` interface.

If that client is passed into the Desktop runner path, `memory_overview()` can
now be consumed automatically during preflight.

## Docs

Start with [docs/README.md](docs/README.md). It separates current operating
facts from historical closeouts and evidence.

Current docs:

- [current state](docs/current/CURRENT_STATE.md)
- [validation tiers](docs/validation-tiers.md)
- [governance docs](docs/governance/README.md)
- [Codex CLI host](docs/codex-cli-host.md)
- [Desktop live host](docs/codex-desktop-live-host.md)
- [host-client example](docs/end-to-end-host-client-example.md)

## Commands

```bash
npm install
npm run demo:runtime-governance
npm run validate:daily
npm run validate:pr
npm run governance -- list
```

`npm run demo:runtime-governance` is deterministic and in-memory. It exercises
the example host client, execution observation refs, and a third-failure
recovery packet without invoking the real Codex CLI or writing evidence files.
The recovery scenario is intentionally routed as an `engineering` Desktop task
so it uses the injected example bridge instead of the policy default
`read_only` / `codex-cli` host route.
Before executing any scenario, the script verifies that every demo task resolves
to the `desktop` host route and fails closed if a policy change would route it
to `codex-cli`.

Validation is tiered to keep routine checks lightweight:

- `npm run validate:daily`: typecheck plus optional targeted tests, for example `npm run validate:daily -- --test tests/desktop-live-adapter.test.ts`.
- `npm run validate:pr`: typecheck, full tests, build, and `npm run governance -- audit state-sync`.
- `npm run validate:release`: PR tier plus deterministic canary, contract smoke, and evidence collection. Real Codex CLI smoke and external canary checks stay explicitly local and are not included by default.

Audit and acceptance checks are available through the consolidated runner:

```bash
npm run governance -- audit state-sync
npm run governance -- acceptance readonly-chain
npm run governance -- operator readonly
```

Post-merge `main` state-sync reanchors have a guarded local runner for
operator-authorized direct pushes:

```bash
npm run state-sync:reanchor-main
npm run state-sync:reanchor-main -- --write --commit
npm run state-sync:reanchor-main -- --write --commit --push
```

The first form is read-only. The commit form creates a local reanchor commit
without running the full state-sync audit because `state_only_pushed` becomes
valid only after upstream contains that commit. A later `--push` run can resume
that exact commit-only state when local `main` is clean, exactly `ahead 1 /
behind 0`, and the local commit changes only strict state/docs paths. The push
form runs the full state-sync audit after the successful push and refuses to
push if `origin/main` moved while the local reanchor was being prepared. The
existing reanchor PR workflow remains the conservative fallback when direct
`main` push is not authorized.

The old per-check package script aliases have been removed; use `npm run governance -- audit|acceptance|operator ...` instead.
