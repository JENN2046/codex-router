---
title: PR-23E Workspace-write Fake Canary V2
status: active
owner: governance/runtime
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - node --import tsx --test tests/workspace-write-fake-canary-acceptance.test.ts tests/workspace-write-guard.test.ts tests/provider-core.test.ts
  - npm run typecheck
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - workspace-write
  - permit
  - canary
  - rollback
---

# PR-23E Workspace-write Fake Canary V2

PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2_RECORDED

## Summary

This is the Phase 6.5 workspace-write fake canary v2 closeout. It wires the
local fake canary acceptance path to the
`provider-workspace-write-execution-permit.v2` contract added in PR-23D while
preserving the non-executing boundary.

This slice adds:

- fake canary permit creation through workspace-write permit v2;
- provider manifest, provider execution plan, policy, principal, and plan hash
  bindings on the fake canary plan;
- single-use permit consumption through the provider permit consumption store;
- replay-block evidence for the same permit;
- permit v2 support in workspace-write patch guard, rollback evidence, and
  canary readiness;
- v2 regression coverage for fixed target, rollback readiness, out-of-bounds
  paths, too many files, secret-like patch content, and sanitized evidence.

## Implementation Boundary

The implementation updates:

- `scripts/run-workspace-write-fake-canary-acceptance.ts`;
- `packages/workspace-write-guard/src/index.ts`;
- `tests/workspace-write-fake-canary-acceptance.test.ts`;
- `tests/workspace-write-guard.test.ts`.

The fake canary remains local-only and non-executing. It proves the controls
can be evaluated without writing the canary file, invoking a provider, invoking
the real Codex CLI, or performing external writes.

## Non-authorization

This closeout does not authorize:

- workspace-write real canary;
- general workspace-write;
- default provider execution;
- real Codex CLI execution by default;
- external write;
- protected remote action;
- push, release, publish, deploy, or tag;
- secret, credential, token, env, user config, or system config mutation.

## Next Safe Action

The next narrow Phase 6 slice is runtime-governance closeout and release-gate
alignment. It should update capability status and validation gates without
authorizing real workspace-write by default.
