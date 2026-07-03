---
title: ADR 001: Protocol V1 Stable Contract Surface
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - protocol-v1
  - task-envelope
  - routing-decision
---

# ADR 001: Protocol V1 Stable Contract Surface

## Context

`codex-router` is a reusable governance and execution-control layer. Its
protocol surface must stay stable enough for host adapters, policy modules, and
runtime governance packages to compose without copying app-specific workflows.

The important stable concepts include task envelopes, routing decisions,
approval gates, evidence refs, and failure states.

## Decision

Keep Protocol V1 as the stable contract surface for current integrations. New
runtime behavior should extend around the protocol through typed packages,
reducers, adapters, or policy modules rather than replacing the core envelope
shape for every feature.

## Alternatives Considered

- Add feature-specific fields directly to task payloads.
  - Benefit: fast for a single feature.
  - Risk: app-specific shape leaks into the reusable SDK.
  - Status: rejected for generic governance surfaces.
- Create a new protocol version for every new governance feature.
  - Benefit: strict migration boundary.
  - Risk: excessive migration churn for packages that only need optional
    metadata.
  - Status: deferred until a real breaking contract change exists.

## Consequences

- Runtime packages must preserve backwards-compatible Protocol V1 behavior.
- New evidence or recovery features should prefer additive metadata and typed
  helper APIs.
- Breaking schema changes require a new ADR and release-gate review.

## Verification

- `npm run validate:daily`
- Package and contract tests in CI.

## Change Control

Revisit this ADR when a change alters task envelope shape, routing decision
semantics, approval-gate meaning, or evidence ref contracts.

