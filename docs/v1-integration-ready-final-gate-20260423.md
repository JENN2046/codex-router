# Codex Router V1 Integration-Ready Final Gate Note (2026-04-23)

This note is the final gate on top of the V1 RC definition for
`A:/codex-router`.

Its purpose is narrow: decide whether downstream host teams can begin
integration against the current Desktop-first SDK surface without depending on
undefined behavior.

## Final Decision

The current `2026-04-23` snapshot may be treated as `integration-ready` for the
Desktop-first V1 scope.

This is not a GA declaration.
This is not a centralized control-plane launch.
This is not production certification for every external host environment.

## Safe To Integrate Against Now

- protocol parsing and routing contracts in `packages/contracts`
- decision path through `desktop-decision-runner`
- execution path through `desktop-live-adapter`
- production-shaped host starter through `desktop-host-client`
- concrete Codex Desktop primitive adapter through `codex-desktop-bindings`,
  including `createToolStyleCodexDesktopRuntime()`
- composed live host bundle through `codex-desktop-live-host`, including
  `createCodexDesktopLiveHostStarter()`,
  `createCodexDesktopLiveHostBundleFromHostObject()` and
  `createCodexDesktopLiveHostBundleFromTools()`, with fail-fast validation for
  incomplete current-host objects
- resume-aware execution through `resumeDesktopTask()`
- host bridge integration shape documented in `docs/host-bridge-contract.md`
- codex-memory integration through:
  - host-side operations adapter
  - HTTP MCP client
  - memory-backed resume flow
- observability surface for:
  - telemetry sinks
  - alert sinks
  - fanout / retry skeleton
  - threshold evaluation
  - persisted dedupe / cooldown suppression

## Assumptions Carried By This Decision

- the host is Desktop-first and already owns primitive execution
- the host treats `routing-policy.yaml` as the active V1 policy source
- the host respects explicit degraded / blocked memory and telemetry posture
- the host uses the documented public entrypoints rather than internal test
  scaffolding
- the host understands that deferred items below are out of scope for the first
  integration pass

## Known Deferred Items Still Carried As Risk

- persisted `auditStore` continuity is still missing
- stdio transport for `codex-memory` is still missing
- real external host integrations beyond local doubles/examples are not yet
  certified here
- centralized multi-machine router services remain V2 work, not a hidden V1
  dependency

## Why This Still Qualifies As Integration-Ready

- the required V1 scope is implemented and documented
- the current baseline has already been validated locally with:
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
- the remaining items are explicit deferrals, not hidden prerequisites for the
  Desktop-first SDK embedding flow
- downstream hosts now have a stable enough contract to wire the SDK into a real
  Desktop embedding path and discover host-specific gaps from there

## What This Decision Does Not Claim

- that every host transport or every MCP topology has already been validated
- that the SDK owns a server-side control plane
- that production operations or compliance review are complete
- that deferred items should be treated as optional forever

## Recommended Immediate Next Step

Use this snapshot as the first integration baseline and open the next work item
only when a host integration exposes a concrete missing capability, drift in the
public surface, or a risk that should be pulled forward from V2.

## Post-Freeze Addendum

For the `2026-04-24` final-host readiness update, smoke harness, and current
`145/145` validation baseline, see
[`docs/v1-final-host-readiness-addendum-20260424.md`](A:/codex-router/docs/v1-final-host-readiness-addendum-20260424.md).
