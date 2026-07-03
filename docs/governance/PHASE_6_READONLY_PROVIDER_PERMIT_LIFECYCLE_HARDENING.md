---
title: Phase 6 Read-only Provider Permit Lifecycle Hardening
status: active
owner: governance/runtime
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - node --import tsx --test tests/provider-core.test.ts tests/codex-cli-provider.test.ts tests/controlled-readonly-provider-execution-acceptance.test.ts
  - npm run governance -- acceptance controlled-readonly-provider-execution -- --output /tmp/codex-router-controlled-readonly-provider-execution-acceptance-phase63.json
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - provider-execution
  - permit
  - read-only
---

# Phase 6 Read-only Provider Permit Lifecycle Hardening

PHASE_6_READONLY_PROVIDER_PERMIT_LIFECYCLE_HARDENING_RECORDED

## Summary

This is the Phase 6.3 read-only permit lifecycle hardening closeout. It sits
between PR-23C execution evidence binding and the later workspace-write permit
v2 work.

The existing provider-core and codex-cli provider permit lifecycle controls are
now represented in the current controlled read-only acceptance evidence. The
acceptance line covers:

- approved read-only permit success;
- missing permit fail-closed behavior;
- expired permit fail-closed behavior before spawn;
- nonce mismatch fail-closed behavior before spawn;
- single-use replay rejection after first consumption;
- permit consumption store failure rejection before spawn;
- zero real Codex CLI calls;
- zero workspace-write calls;
- zero external writes.

## Implementation Boundary

This slice does not introduce a new default governance command. It strengthens
the existing current command:

```bash
npm run governance -- acceptance controlled-readonly-provider-execution
```

The acceptance fixture now uses an explicitly injected read-only permit
consumption store for each scenario. It does not rely on the codex-cli
provider's default process-global fallback store.

## Existing Core Coverage

The lifecycle core remains in:

- `packages/provider-core/src/index.ts`
- `packages/providers/codex-cli/src/index.ts`

Existing tests already cover provider-core expiration, nonce, caller-side
`consumedAt`, single-use store consumption, permit id tampering, and store
failure behavior. Codex-cli provider tests cover replay rejection, cross-instance
replay rejection, permit consumption before real spawn, and store failure before
spawn.

This slice adds a current acceptance-level regression test:

- `tests/controlled-readonly-provider-execution-acceptance.test.ts`

## Non-authorization

This closeout does not authorize:

- default provider execution;
- real Codex CLI execution by default;
- workspace-write permit v2;
- workspace-write fake canary v2;
- workspace-write real canary;
- general workspace-write;
- external write;
- protected remote action;
- push, release, publish, deploy, or tag.

## Next Safe Action

After this lifecycle closeout, the next Phase 6 runtime-governance slice may
start workspace-write permit v2 schema and validators. That next slice must
still avoid real workspace-write execution and must keep workspace-write real
canary blocked by default.
