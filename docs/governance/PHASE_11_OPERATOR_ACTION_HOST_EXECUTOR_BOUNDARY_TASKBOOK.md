---
title: Phase 11 Operator Action Host Executor Boundary Taskbook
status: active
owner: governance
created: 2026-07-05
last_verified: 2026-07-05
verified_by:
  - git diff --check
  - npm run docs:governance
  - node --import tsx scripts/sync-state-sync-display.ts --check
  - pull_request-context state-sync audit
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - recovery-control
  - desktop-host-client
  - desktop-live-adapter
  - operator-action-host-executor-boundary
---

# Phase 11 Operator Action Host Executor Boundary Taskbook

## 1. Scope

Phase 11 defines the next non-executing boundary after the Phase 10 plan-only
operator action executor gate. It describes how a future host executor
authorization layer should bind a planned operator action to an explicitly
injected host executor surface without dispatching the action.

This taskbook is local-only. It does not authorize executing `resume`,
`rollback`, `abort`, or `fork`; does not authorize real provider execution;
does not authorize invoking the real Codex CLI; does not authorize
workspace-write; does not authorize local command execution; does not authorize
protected remote execution; does not authorize remote write; and does not
authorize release, tag, publish, deployment, or external service write.

## 2. Exact Future Gate

Exact token for a later non-executing implementation gate:

- `APPROVE_PHASE_11_HOST_EXECUTOR_BOUNDARY_DESIGN_SLICE`

Exact taskbook:

- `docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md`

Required prior closeouts:

- `docs/governance/PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md`
- `docs/governance/PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md`
- `docs/governance/PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md`

Required prior runtime facts:

- `planGovernanceOperatorActionExecution()` remains plan-only.
- Operator action receipt consumption remains durable and replay-protected.
- Host clients expose lifecycle state without executing the recommended action.
- Recovery-control stays a pure governance package, not a host executor.

## 3. Minimum Safe Future Slice

The first Phase 11 implementation may only add a non-executing authorization
and host-boundary design slice.

Allowed future implementation scope:

- define an explicit host executor authorization packet schema;
- bind authorization to task id, action ref, receipt id, envelope hash,
  recommended action, execution plan hash, checkpoint ref when present, and
  operator identity hash or authorization identity hash;
- require a `planGovernanceOperatorActionExecution()` result with
  `status: "planned"` and `executionMode: "plan_only"`;
- require a current lifecycle state that still matches the planned receipt and
  action envelope;
- require an explicit injected host executor descriptor or capability manifest;
- require the host executor descriptor to declare supported recovery actions;
- require the planned recommended action to be included in both the Phase 10
  action allowlist and the host executor descriptor allowlist;
- produce an authorization result such as `ready_for_host_executor_review` or
  `blocked`, without calling the executor;
- produce sanitized evidence refs, hashes, reason codes, and summaries only;
- add unit tests for schema binding, drift, stale lifecycle, missing host
  descriptor, unsupported action, checkpoint mismatch, and sanitized output;
- add host-client or desktop-live-adapter tests only if the boundary surface is
  exposed there without dispatch.

The first Phase 11 implementation must not introduce:

- automatic execution of `resume`, `rollback`, `abort`, or `fork`;
- a side-effecting host executor implementation;
- direct calls to `dispatchToHost()` for recovery action execution;
- provider execute calls;
- real Codex CLI calls;
- workspace-write execution;
- local shell or process execution;
- protected remote actions;
- release, tag, publish, deployment, or external service write;
- secret, credential, token, env, or private-state changes;
- default enablement of recovery execution from consumed receipts.

## 4. Required Boundary Model

Future Phase 11 design should keep these responsibilities separate:

- `recovery-control`: validates receipts, lifecycle, action allowlists, and
  plan-only executor readiness.
- `desktop-host-client`: may expose a host-facing authorization surface but must
  not execute the action by itself.
- `desktop-live-adapter`: may carry sanitized operator action summaries and
  authorization outcomes but must not hide host executor side effects.
- host executor boundary: explicit injected dependency only; no global process,
  shell, env, provider, or host lookup.
- future side-effecting executor: separate task, separate authorization,
  separate tests, separate closeout.

The host executor boundary must be fail-closed. Missing authorization packet,
missing planned gate, stale lifecycle, mismatched receipt id, mismatched
envelope hash, unsupported action, missing checkpoint for rollback, raw evidence
material, or missing injected descriptor must block.

## 5. Required Failure Cases

Future Phase 11 tests must cover these blocking cases:

- planned gate is missing;
- planned gate is blocked;
- planned gate execution mode is not `plan_only`;
- planned gate task id, action ref, receipt id, envelope hash, recommended
  action, or checkpoint ref drifts from the authorization packet;
- lifecycle state no longer reports the same consumed receipt;
- receipt consumption is replayed, stale, non-durable, or forged;
- host executor descriptor is missing;
- host executor descriptor does not support the recommended action;
- host executor descriptor attempts to broaden side effects beyond recovery
  action review;
- rollback is requested without the reviewed checkpoint ref;
- authorization packet omits operator identity hash or equivalent authorization
  identity binding;
- authorization result contains raw prompt, raw provider response, stdout,
  stderr, argv, env values, patch body, secret-like values, or private-state
  material;
- any code path attempts to execute the action during authorization review.

## 6. Required Local Validation For Future Implementation

Before any future Phase 11 implementation can be considered complete, rerun:

```bash
git diff --check
node --import tsx --test tests/recovery-control.test.ts
node --import tsx --test tests/desktop-host-client.test.ts
npm run typecheck
npm test
npm run build
```

If the implementation touches governance docs or state surfaces, also rerun:

```bash
npm run docs:governance
node --import tsx scripts/sync-state-sync-display.ts --check
```

For branch / PR validation, also run state-sync in pull-request context.

Required validation result:

- targeted tests pass;
- typecheck passes;
- full tests pass;
- build passes;
- governance docs check passes when docs are touched;
- provider execute calls during Phase 11 boundary review: `0`;
- real Codex CLI calls during Phase 11 boundary review: `0`;
- workspace-write calls during Phase 11 boundary review: `0`;
- recovery action dispatch calls during Phase 11 boundary review: `0`;
- external write calls during Phase 11 boundary review: `0`.

## 7. Stop Conditions

Stop before implementation or execution if any of these are true:

- requested scope includes actual `resume`, `rollback`, `abort`, or `fork`
  dispatch;
- requested scope changes Phase 10 from plan-only to execution;
- requested scope introduces a side-effecting host executor;
- requested scope uses global process, shell, env, provider, or host lookup;
- requested scope includes workspace-write, local command, protected remote, or
  external write;
- requested scope changes default provider execution posture;
- requested scope bundles release, tag, publish, deployment, or remote write;
- requested scope requires secret, credential, env, or private-state changes;
- rollback checkpoint targeting is unspecified;
- evidence or logs would expose raw execution material or secret-like values.

## 8. Non-Authorization

This taskbook does not authorize:

- running a recovery action executor;
- executing `resume`, `rollback`, `abort`, or `fork`;
- calling `dispatchToHost()` for recovery action execution;
- invoking a real provider;
- invoking the real Codex CLI;
- workspace-write execute;
- local command execute;
- protected remote execute;
- external service write;
- release, tag, publish, or deployment;
- secret or credential changes.

The next safe action after this taskbook is a local taskbook review or a
separate, narrow, non-executing implementation PR for the authorization packet
and injected host executor descriptor boundary.

## 9. Result

Result:

- `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK_RECORDED`

The project now has a Phase 11 boundary taskbook for moving from plan-only
operator action readiness toward an explicitly authorized, still non-executing
host executor review surface. Recovery execution remains closed.
