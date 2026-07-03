---
title: ADR 003: Codex CLI Real Execution Gates
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - codex-cli
  - real-execution
  - host-dispatch
---

# ADR 003: Codex CLI Real Execution Gates

## Context

The repository can model routes that eventually reach a real Codex CLI or
provider host. Real execution can read local context, produce transcripts, or
write workspace state depending on the route and host permissions. That makes
implicit execution unsafe as a default.

## Decision

Real Codex CLI and provider execution are blocked by default. A real execution
path must have an explicit host boundary, explicit dependency injection,
preflight metadata, a bounded permit where required, and sanitized evidence.

Demo, test, and CI paths must use deterministic fake, dry-run, contract, or
in-memory execution unless a runbook explicitly states otherwise.

## Alternatives Considered

- Let route policy select real CLI by default.
  - Benefit: closer to production behavior.
  - Risk: tests and demos could invoke real host/provider paths unexpectedly.
  - Status: rejected.
- Allow real read-only execution without evidence.
  - Benefit: faster operator loop.
  - Risk: failures become unauditable and hard to recover.
  - Status: rejected.

## Consequences

- Demos must prove they do not route to `codex-cli` unless explicitly intended.
- Host dispatch failures must normalize unknown thrown values before governance
  records them.
- Real execution runbooks must state preconditions, evidence, and stop
  conditions.

## Verification

- `npm run validate:daily`
- `npm run smoke:contract`
- Runtime governance tests in CI.

## Change Control

Any change to host dispatch, Codex CLI routing, real smoke behavior, or provider
execution gates must update this ADR and the relevant runbook.

