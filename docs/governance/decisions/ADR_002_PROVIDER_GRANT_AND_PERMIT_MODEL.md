---
title: ADR 002: Provider Grant And Permit Model
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - grants
  - permits
  - approval
  - provider-execution
---

# ADR 002: Provider Grant And Permit Model

## Context

The project needs to distinguish capability scope from execution
authorization. A host or policy may declare that a task could require a
capability, but that declaration must not itself authorize a real action.

## Decision

Use `grant` for capability scope and `permit` for bounded execution
authorization.

- A grant describes what class of capability may be requested or routed.
- A permit authorizes a specific bounded action under named scope, task, policy,
  expiry, and evidence conditions.
- Approval consumes or validates permits; it does not broaden grants.

## Alternatives Considered

- Treat grant as authorization.
  - Benefit: simpler implementation.
  - Risk: capability declarations could accidentally execute real providers or
    workspace writes.
  - Status: rejected.
- Use only human approval text without typed permits.
  - Benefit: flexible.
  - Risk: replay, scope drift, and weak auditability.
  - Status: rejected for runtime governance.

## Consequences

- Permit logic must fail closed on stale, revoked, expired, broadened, or
  mismatched scopes.
- Provider execution and workspace-write canary flows must bind evidence to the
  specific permit.
- Tests must cover grant/permit separation when approval logic changes.

## Verification

- `npm run validate:daily`
- Approval and permit tests in CI.

## Change Control

Permit schema, approval consumption, provider routing, or capability taxonomy
changes must update this ADR, [Threat Model](../THREAT_MODEL.md), and
[Release Gate Matrix](../RELEASE_GATE_MATRIX.md).

