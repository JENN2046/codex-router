---
title: ADR 004: Evidence And Redaction Policy
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - evidence
  - redaction
  - runtime-governance
---

# ADR 004: Evidence And Redaction Policy

## Context

Governance decisions need evidence, but raw execution material can contain
secrets, prompts, provider payloads, stdout/stderr, env values, cookies, private
memory, or other sensitive data. Storing that material would make auditability
itself a data leak.

## Decision

Governance evidence stores sanitized refs, digests, statuses, reason codes,
counts, bounded paths, and summaries. It must not store forbidden raw material
listed in [Evidence Policy](../EVIDENCE_POLICY.md).

Runtime governance should prefer consumable evidence refs over raw payloads.

## Alternatives Considered

- Store raw transcripts and redact later.
  - Benefit: maximum debugging detail.
  - Risk: secrets can be committed or copied before redaction.
  - Status: rejected.
- Store no evidence for sensitive paths.
  - Benefit: lowest leak risk.
  - Risk: failures become unreviewable.
  - Status: rejected; sanitized refs and summaries are required instead.

## Consequences

- Evidence producers must normalize and summarize.
- Reviewers should reject raw secret-like or provider payload material in docs,
  PR bodies, and artifacts.
- Evidence schema changes must update policy, templates, and tests.

## Verification

- `npm run validate:daily`
- Evidence collection and runtime governance tests in CI.

## Change Control

Any change to evidence output fields, redaction behavior, observation refs, or
artifact storage must update this ADR and [Evidence Policy](../EVIDENCE_POLICY.md).

