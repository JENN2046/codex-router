---
title: PR-23D Workspace-write Permit V2
status: active
owner: governance/runtime
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - node --import tsx --test tests/provider-core.test.ts
  - npm run typecheck
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - provider-execution
  - permit
  - workspace-write
---

# PR-23D Workspace-write Permit V2

PR_23D_WORKSPACE_WRITE_PERMIT_V2_RECORDED

## Summary

This is the Phase 6.4 workspace-write permit v2 closeout. It implements the
machine-verifiable permit contract and validator surface required before any
future workspace-write canary can be considered guarded.

This slice adds:

- `provider-workspace-write-execution-permit.v2`;
- required plan hash binding;
- required provider execution plan hash binding;
- required provider manifest hash binding;
- required policy decision hash binding;
- required principal hash binding;
- required operator authorization id;
- exact target allowlist binding;
- expiration and nonce;
- single-use consumption through the provider permit consumption store;
- `beforeCommit` and rollback command identity binding;
- protected branch and dirty worktree blockers.

## Implementation Boundary

The implementation lives in `packages/provider-core/src/index.ts` and is
covered by `tests/provider-core.test.ts`.

This slice does not wire permit v2 into the workspace-write fake canary yet.
That is the next Phase 6 slice.

## Non-authorization

This closeout does not authorize:

- workspace-write fake canary v2 execution;
- workspace-write real canary;
- general workspace-write;
- default provider execution;
- real Codex CLI execution by default;
- external write;
- protected remote action;
- push, release, publish, deploy, or tag;
- secret, credential, token, env, user config, or system config mutation.

## Next Safe Action

The next narrow Phase 6 slice is to update the workspace-write fake canary to
use permit v2 and patch/rollback guards while still proving zero real
workspace-write, zero real Codex CLI, and zero external writes.
