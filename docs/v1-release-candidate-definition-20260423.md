# Codex Router V1 Release Candidate Definition (2026-04-23)

This document freezes what counts as a V1 release candidate for
`A:/codex-router`.

It is an integration gate for the Desktop-first SDK, not a public GA
declaration and not a centralized control-plane launch.

## Terms

- `RC candidate`
  - all in-scope V1 surfaces are implemented, documented, and locally validated
  - only explicitly deferred items remain
- `integration-ready`
  - an `RC candidate` plus a frozen release-risk note for downstream hosts
  - a host team can start integrating without depending on undefined behavior

## Scope Required For V1 RC

- stable protocol contracts from `packages/contracts`
- decision flow through:
  - `intent-gate`
  - `routing-engine`
  - `approval-gate`
  - `preflight`
  - `desktop-decision-runner`
- execution flow through `desktop-live-adapter`, including:
  - `runDesktopTask()`
  - `resumeDesktopTask()`
- memory flow through:
  - `codex-memory-adapter`
  - `codex-memory-host-client`
  - `codex-memory-mcp-client` (HTTP MCP)
- observability flow for:
  - telemetry event sinks
  - alert sinks
  - threshold evaluation
  - delivery fanout
  - retry skeleton
  - delivery dedupe / cooldown continuity
- a runnable host example that demonstrates:
  - fresh execution
  - resume-aware execution
  - persisted checkpoint fallback
  - persisted alert suppression continuity

## Explicitly Deferred From V1 RC

- persisted `auditStore` continuity across sessions
- native stdio MCP transport for `codex-memory`
- centralized `router-api` / `router-worker` control plane
- non-Desktop-first runtime abstractions
- production certification of real external host integrations beyond local
  doubles and examples

## Evidence Required Before Calling It RC

### 1. Contract Evidence

- protocol docs are frozen for `TaskEnvelope` and `RoutingDecision`
- parser helpers remain the recommended package boundary:
  - `parseTaskEnvelope()`
  - `parseRoutingDecision()`
- public API surface is intentionally narrow and locked where practical by tests

### 2. Validation Evidence

- `npm run typecheck`
- `npm run build`
- `npm test`
- the same proposed snapshot is green across all three checks

### 3. Resume And Persistence Evidence

- `resumeDesktopTask()` restores from memory when a compatible memory client is
  available
- a local checkpoint fallback exists for hosts that need resume without relying
  only on memory
- alert suppression continuity survives host/session restarts when the host
  provides a persisted delivery-window store

### 4. Policy And Safety Evidence

- `routing-policy.yaml` pins a concrete `policyVersion`
- non-release and release posture is explicit for memory and telemetry
- preflight surfaces a structured memory state instead of only flat warnings or
  errors
- protected/release posture remains stricter than normal engineering posture

### 5. Integration Evidence

- the host bridge contract is documented
- `desktop-host-client` provides a production-shaped starter surface for real
  host wiring
- `codex-desktop-bindings` provides a concrete Codex Desktop primitive adapter
  for runtime calls plus task-local agent tracking, including
  `createToolStyleCodexDesktopRuntime()` for direct host-tool mapping
- `codex-desktop-live-host` provides a one-step composition layer for Desktop
  runtime, memory host operations, and host client setup, including
  `createCodexDesktopLiveHostStarter()` as the shortest real-host path,
  `createCodexDesktopLiveHostBundleFromHostObject()` for a real current-host
  object,
  fail-fast validation helpers for incomplete host objects, and
  `createCodexDesktopLiveHostBundleFromTools()` for direct host-tool composition
- the end-to-end host example is current
- the target-host-layer skeleton is current and copyable into a real embedding
  repo
- the memory host-client and transport-native MCP docs are current and do not
  contradict actual runner behavior

## Not Enough For RC

- green tests with drifting or undocumented public surfaces
- resume logic that only works inside one in-memory process
- a release posture that depends on memory/telemetry but does not expose a
  blocking or degraded state
- deferred work that is still implicitly required for the first real host
  integration

## Release Decision Rule

- call the snapshot `RC candidate` when all required V1 scope and evidence above
  are met, and only deferred items remain
- call the snapshot `integration-ready` only when the `RC candidate` also has a
  short release-risk / final-gate note that tells downstream integrators:
  - what is still out of scope
  - what assumptions remain
  - what is safe to integrate against now

## Current 2026-04-23 Assessment

- the validated `121/121` baseline satisfies the technical `RC candidate` bar for
  the Desktop-first V1 SDK
- the remaining gaps listed in
  `docs/v1-closeout-status-20260423.md` are treated as explicit deferrals, not
  hidden blockers
- the final-gate note is now frozen in
  [`docs/v1-integration-ready-final-gate-20260423.md`](A:/codex-router/docs/v1-integration-ready-final-gate-20260423.md)
- under that final-gate note, the current snapshot can be treated as
  `integration-ready` for the Desktop-first V1 scope

## Post-Freeze Addendum

For the `2026-04-24` final-host readiness update, smoke harness, and current
`145/145` validation baseline, see
[`docs/v1-final-host-readiness-addendum-20260424.md`](A:/codex-router/docs/v1-final-host-readiness-addendum-20260424.md).
