---
title: Phase 8 Operator Action Lifecycle Closeout
status: active
owner: governance
created: 2026-07-04
last_verified: 2026-07-04
verified_by:
  - git diff --check
  - npm run validate:daily
  - npm run docs:governance
  - node --import tsx --test tests/recovery-control.test.ts
  - pull_request-context state-sync audit
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - recovery-control
  - operator-action-lifecycle
---

# Phase 8 Operator Action Lifecycle Closeout

Phase 8 turns host-consumable operator actions into acknowledgeable,
rejectable, deferrable, or consumable lifecycle receipts. It does not authorize
executing a recovery action.

## Included PRs

| Slice | Merge commit | Result |
| --- | --- | --- |
| Operator action lifecycle receipts | `09a9e6f` | `GovernanceOperatorActionReceipt` and validation helpers bind task, action ref, optional envelope hash, operator identity hash, timestamp, evidence refs, expiry, and replay state. |

## Capability Status

| Capability | Status | Real execution allowed | Notes |
| --- | --- | ---: | --- |
| Operator action receipt schema | active | No by itself | Receipts record `acknowledged`, `rejected`, `deferred`, or `consumed` decisions for an issued operator action. |
| Receipt identity binding | active | No by itself | Receipt ids are derived from a normalized receipt payload and bind task id, action ref, optional envelope hash, action issue time, decision, operator id hash, created time, and evidence refs. |
| Receipt validation | active | No by itself | Validation blocks task mismatch, action ref mismatch, envelope hash mismatch, malformed receipts, stale actions, receipts dated before the action, future-dated receipts, replayed actions, and replayed receipt ids. |
| Lockdown receipt policy | active | No by itself | Lockdown actions require an explicit `consumed` or `rejected` decision before the lifecycle receipt can pass. |

## Closed Risks

- Host/UI layers can now store an explicit operator decision against a stable
  action ref instead of relying on an unstructured note.
- Receipt validation fails closed for malformed receipts, stale receipts,
  replayed receipts, task mismatch, and action mismatch.
- Receipt ids are generated from the same canonical schema shape that
  validation uses, including default `evidenceRefs: []`.
- Receipt timelines reject decisions that appear before the issued operator
  action.

## Remaining Risks

- Phase 8 does not include a durable receipt store implementation. Callers must
  provide consumed action refs and consumed receipt ids from their own store.
- Phase 8 does not execute, resume, abort, or roll back any task. It only
  validates the operator decision receipt for an already surfaced action.
- Receipt evidence remains refs and summaries only; raw payload, raw prompt,
  stdout/stderr, env, argv, provider responses, and patches remain forbidden.

## Verification Commands

Use these for a local Phase 8 regression pass:

```bash
git diff --check
npm run validate:daily
npm run docs:governance
node --import tsx --test tests/recovery-control.test.ts
```

For acceptance checks that normally refresh committed evidence, use `--check`
when reviewing without changing files:

```bash
npm run governance -- acceptance readonly-chain --check
npm run governance -- acceptance controlled-readonly-provider-execution --check
```

## Non-Authorizations

This closeout does not authorize:

- executing recovery actions automatically;
- real workspace-write by default;
- general workspace-write;
- external write;
- protected remote action;
- release, publish, deploy, tag, or package publication;
- default real Codex CLI execution;
- general provider execution;
- bypassing permits, preflight, state-sync, receipt validation, or review gates.
