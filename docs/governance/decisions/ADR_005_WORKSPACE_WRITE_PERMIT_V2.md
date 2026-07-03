---
title: ADR 005: Workspace-write Permit V2
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - workspace-write
  - permit
  - rollback
  - evidence
---

# ADR 005: Workspace-write Permit V2

## Context

Workspace-write is the highest-risk local capability in the current governance
surface. A real write can modify repository files, create misleading evidence,
or combine with a later push/release path. Existing fake canaries prove control
flow, but they do not justify broad real write execution.

The project needs a permit shape that can authorize a narrow canary without
promoting general workspace-write.

## Decision

Workspace-write permit v2 must be strongly bound and single-use before any real
workspace-write canary is treated as guarded.

The permit must bind:

- operator authorization id;
- task or run scope;
- principal;
- policy hash;
- manifest hash;
- provider execution plan hash;
- exact target allowlist;
- max changed files;
- max diff lines;
- expiration;
- nonce;
- consumption record;
- `beforeCommit`;
- rollback command identity.

The permit must fail closed when any binding is missing, stale, mismatched,
broadened, revoked, expired, or already consumed.

## Alternatives Considered

- Reuse human approval text as the only write permit.
  - Benefit: less implementation work.
  - Risk: weak replay protection and no machine-verifiable scope binding.
  - Status: rejected.
- Promote fake canary success to real workspace-write readiness.
  - Benefit: faster path to execution.
  - Risk: fake validation does not prove host write, rollback, or evidence
    safety.
  - Status: rejected.
- Allow broad workspace-write after one bounded canary.
  - Benefit: simpler operator flow.
  - Risk: a canary target is not evidence for arbitrary write targets.
  - Status: rejected.

## Consequences

- Workspace-write real canary remains blocked until permit v2 and its
  consumption semantics exist.
- General workspace-write remains blocked even after a bounded canary passes.
- Runtime and release reviews must check rollback, patch guards, secret-like
  patch blockers, and sanitized evidence.
- Future implementation PRs must add regression tests for replay, stale permit,
  hash mismatch, broad target, dirty worktree, protected branch, and rollback
  failure cases.

## Verification

- `npm run validate:daily`
- Workspace-write guard and permit tests in CI when implementation changes.

## Change Control

Changes to workspace-write permit semantics must update:

- [Workspace-write Release Gate](../WORKSPACE_WRITE_RELEASE_GATE.md);
- [Threat Model](../THREAT_MODEL.md);
- [Evidence Policy](../EVIDENCE_POLICY.md);
- [Release Gate Matrix](../RELEASE_GATE_MATRIX.md);
- workspace-write tests.
