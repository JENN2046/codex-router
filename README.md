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

See [docs/host-bridge-contract.md](A:/codex-router/docs/host-bridge-contract.md)
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

## End-To-End Example

`packages/host-client-example` provides a runnable host-side example that
combines:

- `CodexMemoryAdapter`
- `runDesktopTask()`
- `resumeDesktopTask()`
- typed primitive result envelopes

For cross-session recovery, the example can now:

- reuse a shared or real `memoryClient` for memory-backed resume across host instances
- persist the local checkpoint fallback with `checkpointStorePath`
- persist alert suppression continuity with `telemetryAlertDeliveryWindowStorePath`

See [docs/end-to-end-host-client-example.md](A:/codex-router/docs/end-to-end-host-client-example.md)
for the walkthrough.

For the real host-side memory bridge, see
[docs/real-codex-memory-host-client.md](A:/codex-router/docs/real-codex-memory-host-client.md).

For the production-shaped host starter that keeps real bridge and persistence
wiring but drops the in-memory demo defaults, see
[docs/desktop-host-client.md](A:/codex-router/docs/desktop-host-client.md).

For the concrete Codex Desktop primitive adapter that maps runner primitives into
runtime calls, task-local agent tracking, and direct host-tool mapping, see
[docs/codex-desktop-bindings.md](A:/codex-router/docs/codex-desktop-bindings.md).

For the composed live host bundle that wires Desktop runtime + memory host ops +
host client into one surface, including `createCodexDesktopLiveHostStarter()`,
`createCodexDesktopLiveHostBundleFromHostObject()`, and direct current-host tool
composition, plus the final-host
`createCodexDesktopLiveHostEmbeddingStarter()` readiness scaffold, fail-fast
current-host validation, structured current-host readiness inspection, and
host-source-aware smoke tasks with compact final-host evidence capture, which
can also model a future Codex CLI host, see
[docs/codex-desktop-live-host.md](A:/codex-router/docs/codex-desktop-live-host.md).

For the first narrow Codex CLI host seam that builds safe
`codex exec --json` command plans, parses JSONL output, and now includes
guarded read-only and workspace-write smoke helpers with compact evidence
persistence, see
[docs/codex-cli-host.md](A:/codex-router/docs/codex-cli-host.md).

For the concrete checklist to wire this SDK into the final Codex Desktop host,
see
[docs/final-codex-desktop-host-integration-checklist-20260424.md](A:/codex-router/docs/final-codex-desktop-host-integration-checklist-20260424.md).

For the read-only preflight that records what is currently known about the final
host source boundary and the VCPChat reference seams, see
[docs/final-host-readonly-preflight-20260424.md](A:/codex-router/docs/final-host-readonly-preflight-20260424.md).

For the reusable read-only gate that classifies final-host source candidates,
packaged runtimes, and reference hosts, see
[docs/final-host-locator.md](A:/codex-router/docs/final-host-locator.md).

The older `target-host-*` docs remain useful for external or trial embedding
repos. For the final Codex Desktop host, prefer the `codex-desktop-live-host`
starter above. For the copyable target embedding module that turns a real host
object plus directive builders into a host-layer skeleton, see
[docs/target-host-layer-skeleton.md](A:/codex-router/docs/target-host-layer-skeleton.md).

For the copyable host-object contract template that wires explicit placeholder
methods and preflight-ready inspection into target embeddings, see
[docs/target-host-object-contract.md](A:/codex-router/docs/target-host-object-contract.md).

For the highest-level copyable embedding helper that combines the host contract,
inspection, and target host-layer bundle creation, see
[docs/target-host-embedding-starter.md](A:/codex-router/docs/target-host-embedding-starter.md).

For the concrete step-by-step checklist to wire `codex-router` into a real
embedding repo, see
[docs/target-host-embedding-implementation-checklist.md](A:/codex-router/docs/target-host-embedding-implementation-checklist.md).

For the execution sheet to use on the first real target repo, see
[docs/first-target-embedding-repo-task-sheet.md](A:/codex-router/docs/first-target-embedding-repo-task-sheet.md).

For the current repo-specific first target choice, see
[docs/first-target-embedding-repo-task-sheet-vcpchat.md](A:/codex-router/docs/first-target-embedding-repo-task-sheet-vcpchat.md).

For the prefilled working draft of that first target task sheet, see
[docs/first-target-embedding-repo-task-sheet-prefill.md](A:/codex-router/docs/first-target-embedding-repo-task-sheet-prefill.md).

For the first direct MCP transport client, see
[docs/transport-native-codex-memory-mcp-client.md](A:/codex-router/docs/transport-native-codex-memory-mcp-client.md).

For the current V1 closeout snapshot, validated baseline, and remaining gaps,
see [docs/v1-closeout-status-20260423.md](A:/codex-router/docs/v1-closeout-status-20260423.md).

For the frozen V1 release-candidate and integration-ready definition, see
[docs/v1-release-candidate-definition-20260423.md](A:/codex-router/docs/v1-release-candidate-definition-20260423.md).

For the short final-gate note that marks the current snapshot integration-ready
within the Desktop-first V1 scope, see
[docs/v1-integration-ready-final-gate-20260423.md](A:/codex-router/docs/v1-integration-ready-final-gate-20260423.md).

For the post-freeze update that adds the final Codex Desktop host readiness
starter, smoke harness, and current `145/145` validation baseline, see
[docs/v1-final-host-readiness-addendum-20260424.md](A:/codex-router/docs/v1-final-host-readiness-addendum-20260424.md).

## Commands

```bash
npm install
npm run typecheck
npm test
```
