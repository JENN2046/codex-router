# DGP Field Validation: VCPToolBox AI Image Agent

> Date: 2026-04-28
> Scope: Phase 21.5 field feedback appendix
> Source boundary: VCPToolBox AI Image Agent release experience only; no
> VCPToolBox business code is copied into `codex-router`.

## Summary

VCPToolBox AI Image Agent work validates several `codex-router` DGP patterns in
a real guarded-agent release setting:

- dry-run before real execution
- explicit gates before production exposure
- dependency injection for executors and host-side effects
- allowlists and env flags as operational safety switches
- audit and validation evidence before merge / release confidence
- runtime artifact cleanup as part of the execution boundary

The takeaway for `codex-router` is architectural, not product-specific:
agentic pipelines should expose their safety state as typed governance data
before they receive permission to write, generate, train, inspect externally, or
persist audit records.

## Generic Field Mapping

| Field Lesson | DGP Surface | Reusable `codex-router` Pattern |
|---|---|---|
| Agent starts closed by default | `preflight`, `approval-gate`, policy config | Treat write-capable agent paths as blocked until explicit gates are satisfied |
| Dry-run proves intent and payload shape | `strategy-router`, `desktop-decision-runner` | Route unknown or high-impact work through simulation / inspectable execution first |
| Real execution has separate confirmation | `approval-gate`, `DesktopLiveExecutionResult.governance` | Keep dry-run readiness distinct from permission to perform side effects |
| Executor is injected, not global | host bridge / adapter boundary | Pass runtime executors explicitly so tests and hosts can substitute safe doubles |
| Route / tool access is constrained | `routing-engine`, `policy-config` | Use allowlists and policy rules rather than implicit plugin discovery |
| Audit evidence is release input | `audit-memory`, `observability`, evidence docs | Record sanitized status, gates, and validation results without secrets |
| Recovery must be actionable | `recovery-control`, `desktop-live-adapter` | Return arbitration packet and recovery actions when governance stops execution |
| Temporary runtime files need cleanup rules | checkpoint / evidence hygiene | Declare which artifacts are intentional, temporary, or forbidden in commits |

## Dry-Run To Real Execution Gate

A safe agent pipeline should separate four states:

1. `closed`: real execution disabled by default.
2. `dry_run_ready`: the agent can plan, inspect, and produce sanitized evidence.
3. `operator_approved`: a human has approved a bounded live action.
4. `live_enabled`: execution can proceed only within the approved scope.

This maps cleanly to DGP:

```text
preflight checks
→ dry-run execution
→ evidence summary
→ explicit approval gate
→ bounded live execution
→ audit / recovery outcome
```

Do not collapse dry-run success into live permission. A dry-run can prove shape,
policy compliance, and expected side effects; it cannot prove the operator has
accepted the production boundary.

## Dependency Injection Boundary

The VCPToolBox field lesson reinforces a core DGP rule: host effects should be
passed into the governance layer explicitly.

Recommended generic boundary:

```text
planner / router
  receives task + policy + observed host capability

executor adapter
  receives injected executor, allowlist, audit sink, artifact policy

host
  owns real side effects and exposes only bounded methods
```

This keeps `codex-router` reusable. The SDK should not know business-specific
route handlers, plugin names, generation providers, or admin UI details. It
should know whether an action is dry-run, write-capable, audited, reversible,
and operator-approved.

## Env Flags, Allowlists, And Audit

Field validation supports using multiple independent switches before live work:

- feature flag: enables the surface at all
- dry-run flag: keeps execution inspectable and non-side-effecting
- live-execution flag: allows real side effects only after explicit approval
- allowlist: constrains which executor targets / capabilities may be used
- audit sink: records what was attempted and which gates were satisfied

For `codex-router`, these map to policy inputs and preflight evidence rather
than hidden global state. Missing or closed gates should produce stable blocking
reasons such as:

```text
agent_surface_disabled
dry_run_required
live_execution_requires_approval
target_not_allowlisted
audit_sink_required
```

The exact strings can differ by host, but they should be stable enough for UI,
logs, and regression tests.

## Runtime Artifact Hygiene

Agent pipelines that produce files should classify artifacts before execution:

- `intentional_output`: expected user-visible output or evidence
- `temporary_runtime`: scratch files that must be cleaned or ignored
- `audit_evidence`: sanitized records that may be committed or archived
- `forbidden_source`: generated or runtime files that must not enter commits
- `secret_sensitive`: env, tokens, provider credentials, and raw service output

This mirrors the repository hygiene rules in `codex-router`: do not commit local
runtime artifacts unless they are intentional evidence, and never expose secrets
through logs, docs, memory, or release notes.

## Validation Pattern

The release experience maps to a reusable validation stack:

```text
syntax / type checks
→ focused safety gate tests
→ frontend or host build when applicable
→ forbidden-file / forbidden-config scan
→ default-closed gate verification
→ post-merge or post-release status check
```

For `codex-router`, the closest equivalents are:

- `npm run typecheck`
- `npm test`
- `npm run build`
- canary / evidence commands for runtime-sensitive changes
- explicit local smoke for real host boundaries

## Codex Router Design Implications

This field validation supports the current DGP direction:

- Keep runtime governance in generic reducers, packets, and typed result
  contracts.
- Keep host-specific code outside `codex-router`; document field lessons as
  architecture feedback.
- Prefer explicit injection and typed preflight data over environment probing.
- Keep recovery data host-consumable: packet, action list, evidence refs, and
  stable blocking reasons.
- Treat default-closed production gates as a feature, not friction.

## Non-Goals

This appendix does not:

- define VCPToolBox product behavior
- include VCPToolBox route handlers, plugin manifests, admin UI code, or
  provider-specific implementation
- authorize live generation, training, external inspection, retry execution, or
  audit persistence
- change `codex-router` runtime behavior by itself

Those remain separate host decisions with their own preflight, approval, and
validation gates.
