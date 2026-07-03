---
title: Phase 6 Controlled Execution Runtime Hardening Closeout
status: active
owner: governance/runtime
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run docs:governance
  - npm run validate:daily
  - npm test
  - npm run build
  - node --import tsx scripts/sync-state-sync-display.ts --check
  - pull_request-context state-sync audit
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - provider-execution
  - permit
  - evidence
  - workspace-write-readiness
  - release-review
---

# Phase 6 Controlled Execution Runtime Hardening Closeout

PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT_RECORDED

## Summary

Phase 6 converted the accepted document-governance control plane into a
minimal, testable, auditable runtime execution boundary. The completed stage
productizes a narrow controlled read-only provider acceptance line, binds its
evidence, hardens read-only permit lifecycle behavior, implements
workspace-write permit v2, and upgrades the workspace-write fake canary to use
permit v2 without authorizing real workspace-write.

## Included PRs

| Slice | Main commit | Result |
| --- | --- | --- |
| PR-23A baseline readiness | `92b0d80` | Phase 6 baseline and affected surfaces recorded. |
| PR-23B controlled read-only minimal slice | `dc87a64` | Explicit controlled read-only acceptance with injected fake spawner. |
| PR-23C execution evidence binding | `4e446d6` | Preflight, registry, permit, plan, policy, principal, and report evidence refs/hashes recorded. |
| Phase 6.3 read-only permit lifecycle | `965fa9c` | Expiration, nonce, replay, and store-failure behavior covered. |
| PR-23D workspace-write permit v2 | `404b197` | Permit v2 schema, validators, rollback binding, and single-use consumption helper implemented. |
| PR-23E workspace-write fake canary v2 | `bdb880f` | Fake canary uses permit v2, patch guard, rollback evidence, and replay blocking with zero real execution. |

## Capability Status Changes

| Capability | Phase 6 closeout status | Real execution allowed |
| --- | --- | ---: |
| Controlled read-only provider execution | guarded / productized narrow path | Yes, only through the read-only controlled execution runbook and explicit controlled mode |
| Read-only permit lifecycle | hardened for expiration, nonce, replay, and store failure | No by itself |
| Execution evidence binding | active refs/hash summary for the controlled read-only path | No by itself |
| Workspace-write permit v2 | schema, validators, rollback binding, and single-use consumption helper implemented | No |
| Workspace-write fake canary v2 | guarded local acceptance using permit v2 and rollback evidence | No |
| Workspace-write real canary | experimental / blocked by default | No by default |
| General workspace-write | blocked | No |
| General provider execution | blocked | No |
| External write | blocked | No |
| Protected remote action | blocked | No |
| Release, package publish, tag, deploy | blocked by default | No |

## Validation Evidence

Routine validation for Phase 6 closeout uses:

```bash
npm run docs:governance
npm run validate:daily
npm test
npm run build
node --import tsx scripts/sync-state-sync-display.ts --check
node --import tsx scripts/run-state-sync-audit.ts --json
```

Runtime-governance slices also used targeted acceptance tests and PR CI for:

- controlled read-only provider execution acceptance;
- execution evidence binding;
- read-only permit lifecycle regression coverage;
- provider-core workspace-write permit v2 validators;
- workspace-write fake canary v2 acceptance and guard coverage.

## Closed Risks

- Controlled read-only execution now requires explicit controlled mode and
  injected execution dependency in the accepted path.
- Controlled read-only evidence is represented as refs, hashes, statuses, and
  summaries instead of raw provider material.
- Read-only permit replay, expiration, nonce mismatch, and store failure have
  regression coverage.
- Workspace-write readiness now has a permit v2 contract with plan, provider
  plan, manifest, policy, principal, target, rollback, and nonce bindings.
- Workspace-write fake canary v2 proves the v2 controls without writing the
  canary file or invoking a real provider.

## Remaining Risks

- Real Codex CLI execution remains outside the default path and requires a
  target-specific controlled read-only runbook invocation.
- Workspace-write real canary remains blocked by default and requires a fresh
  exact authorization packet before any future promotion review.
- General workspace-write and general provider execution remain blocked until
  separate gates exist.
- Evidence collection still depends on CI artifact availability for CI-level
  completeness.

## Non-authorization

This closeout does not authorize:

- real workspace-write by default;
- workspace-write real canary;
- general workspace-write;
- general provider execution;
- real Codex CLI execution by default;
- external write;
- protected remote action;
- push, release, publish, deploy, or tag;
- secret, credential, token, env, user config, or system config mutation.

## Next Safe Action

The next work should start with a fresh read-only runtime-governance review to
identify the next narrow core capability. It should not promote real
workspace-write by default.
