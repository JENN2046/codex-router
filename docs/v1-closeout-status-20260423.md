# Codex Router V1 Closeout Status (2026-04-23)

This document freezes the current V1 closeout state for `A:/codex-router`.

## Current Baseline

- rollout mode: `desktop-first`
- policy version: `2026-04-23.desktop-first.v1.1`
- validation baseline:
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
- current result: `121/121` tests passing

## What Is Now Stable

- `desktop-decision-runner`
  - routing, preflight, approval, checkpoint creation, resume-aware decision flow
- `desktop-live-adapter`
  - typed primitive execution, bridge wiring, telemetry gating, execution checkpoints
- `desktop-host-client`
  - production-shaped host starter around real bridge, persistence, telemetry, and resume wiring
- `codex-desktop-bindings`
  - concrete Codex Desktop primitive adapter with payload resolvers, task-local agent tracking, and `createToolStyleCodexDesktopRuntime()` for direct host-tool mapping
- `codex-desktop-live-host`
  - composed live wiring bundle for Desktop runtime, memory host operations, and host client setup, including `createCodexDesktopLiveHostStarter()` as the shortest real-host path, `createCodexDesktopLiveHostBundleFromHostObject()` for an explicit current-host object, `createCodexDesktopLiveHostBundleFromTools()` for direct current-host tool wiring, fail-fast validation helpers for incomplete host objects, and structured current-host readiness inspection / preflight derivation helpers
- `codex-memory-adapter`
  - checkpoint writes, recall queries, checkpoint parsing
- `codex-memory-host-client`
  - real host operation normalization for `record_memory`, `search_memory`, `memory_overview`
- `codex-memory-mcp-client`
  - transport-native HTTP MCP client for live `codex-memory`
- `host-client-example`
  - end-to-end run/resume example with cross-instance recovery paths plus a copyable target-host-layer skeleton, a copyable target-host-object contract template with placeholder-aware fail-fast validation, and a highest-level target-host embedding starter

## Persistence And Resume Status

The three recovery lanes are now covered:

- memory-backed resume across host instances
  - provide the same real or shared `memoryClient`
- persisted checkpoint fallback across host instances
  - provide `checkpointStorePath`
- alert suppression continuity across sessions
  - provide `telemetryAlertDeliveryWindowStorePath`

## Policy Posture

The current V1 posture is intentionally risk-weighted:

- `read_only`
  - permissive, no required memory or telemetry
- `local_write`
  - memory issues degrade to warnings unless the task is escalated further
- `engineering`
  - telemetry remains expected, but disabled `codex-memory` degrades instead of blocking
- `release`
  - strict path: memory required, telemetry mandatory, blocking memory health issues

## Public Surface Notes

The recent closeout work narrowed the public API surface:

- `host-client-example` no longer exports its internal in-memory store classes
- `codex-memory-host-client` no longer exports recording helpers that were only test scaffolding
- surface-lock tests now assert those internal helpers stay private

## Remaining Gaps

These are still outside the current validated V1 baseline:

- persisted `auditStore` continuity across sessions
- native stdio MCP transport for `codex-memory`
- real external-host integration validation beyond local test doubles
- centralized multi-machine control plane / router service

## Release Candidate Gate

The V1 RC gate is now frozen in
[`docs/v1-release-candidate-definition-20260423.md`](A:/codex-router/docs/v1-release-candidate-definition-20260423.md).

Current position against that definition:

- the validated `121/121` baseline now qualifies as an `RC candidate`
- the remaining gaps above stay explicit V1 deferrals
- the final-gate note is now frozen in
  [`docs/v1-integration-ready-final-gate-20260423.md`](A:/codex-router/docs/v1-integration-ready-final-gate-20260423.md)
- under that note, the current snapshot can now be treated as
  `integration-ready` for the Desktop-first V1 scope

## Post-Freeze Addendum

For the `2026-04-24` update that adds the final Codex Desktop host readiness
starter, smoke harness, Codex CLI-shaped smoke task generation, and current
`145/145` validation baseline, see
[`docs/v1-final-host-readiness-addendum-20260424.md`](A:/codex-router/docs/v1-final-host-readiness-addendum-20260424.md).
