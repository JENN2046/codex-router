---
title: Phase 13 Operator Action Host Executor Dispatch Taskbook
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
  - operator-action-host-executor-dispatch
---

# Phase 13 Operator Action Host Executor Dispatch Taskbook

## 1. Scope

Phase 13 defines the authorization boundary for any future side-effecting host
executor dispatch after Phase 10, Phase 11, and Phase 12.

This taskbook is design and governance memory only. It does not authorize
implementing, testing, invoking, simulating as real, or running recovery action
dispatch for `resume`, `rollback`, `abort`, or `fork`.

It also does not authorize real provider execution, real Codex CLI execution,
workspace-write execution, local command execution, protected remote actions,
release, tag, publish, deployment, external service write, or secret /
credential changes.

## 2. Authorization Stop

The next implementation step is blocked until Jenn explicitly authorizes the
exact future dispatch slice.

Exact token for a future implementation:

- `APPROVE_PHASE_13_HOST_EXECUTOR_DISPATCH_IMPLEMENTATION_SLICE`

Exact taskbook:

- `docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md`

Required prior closeouts:

- `docs/governance/PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md`
- `docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md`
- `docs/governance/PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md`

Required prior runtime facts:

- Phase 10 planned gates remain `executionMode: "plan_only"`.
- Phase 11 authorization review remains non-executing.
- Phase 12 host-client review surface remains non-executing.
- A host executor descriptor must stay explicitly injected and review-bound
  until a separate authorized dispatch implementation changes that boundary.

## 3. Minimum Future Dispatch Boundary

Any future implementation may only start after the authorization token above is
present in the active task instruction and all hard stops still allow the work.

Minimum required future implementation constraints:

- dispatch must be an explicit injected dependency, not a global lookup;
- dispatch must require a fresh Phase 10 planned gate;
- dispatch must require a fresh Phase 11
  `ready_for_host_executor_review` result;
- dispatch must bind task id, action ref, receipt id, envelope hash,
  recommended action, plan hash, host executor descriptor id/hash,
  authorization identity hash, and checkpoint ref when present;
- dispatch must re-read or receive current lifecycle state and fail closed if
  it differs from the reviewed lifecycle;
- dispatch must restrict the action to the descriptor's supported action
  allowlist and to the gate's planned recommended action;
- dispatch must emit sanitized refs, hashes, statuses, and stable reason codes;
- dispatch must record durable audit evidence without raw provider output,
  raw prompts, stdout/stderr transcripts, env values, patches, credentials, or
  private-state material;
- dispatch must have a dry-run / pre-dispatch validation mode before any real
  side effect;
- dispatch must fail closed on missing checkpoint refs for rollback, replayed
  receipts, expired receipts, stale lifecycle state, descriptor drift, packet
  drift, missing audit sink, unsafe evidence refs, and executor exceptions;
- dispatch must not broaden into provider execution, real Codex CLI execution,
  workspace-write, shell/process execution, protected remote writes, release,
  deployment, or external service writes without separate explicit gates.

## 4. Required Future Tests

A future authorized implementation must include tests for:

- ready review result dispatching only through the injected executor;
- no dispatch when Phase 10 gate is blocked;
- no dispatch when Phase 11 review is blocked;
- no dispatch when Phase 12 current lifecycle state has drifted;
- no dispatch when descriptor, packet, plan hash, action ref, receipt id, or
  envelope hash drifts;
- rollback requires the reviewed checkpoint ref;
- replayed, expired, non-durable, or forged receipt consumption blocks;
- executor exceptions become stable failure classes and sanitized evidence;
- dry-run mode reports dispatch intent without side effects;
- no provider, Codex CLI, workspace-write, shell, protected remote, release,
  deployment, or external write call occurs unless a separate authorization
  explicitly covers that class.

## 5. Required Future Validation

Before any future dispatch implementation can be considered for merge, rerun:

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

## 6. Stop Conditions

Stop and report `BLOCK` unless Jenn's active instruction contains the exact
Phase 13 authorization token and the requested implementation remains inside
the taskbook boundary.

Stop before coding, testing, or running any future dispatch path if the work
would require:

- executing `resume`, `rollback`, `abort`, or `fork`;
- calling a side-effecting host executor;
- changing Phase 10 from plan-only to execution;
- weakening Phase 11 or Phase 12 non-executing review boundaries;
- using global process, shell, env, provider, host lookup, or hidden bridge
  dependencies;
- invoking a real provider;
- invoking the real Codex CLI;
- workspace-write execution;
- protected remote execution;
- release, tag, publish, deployment, or external service write;
- secret, credential, token, env, or private-state access or mutation;
- committing raw execution material, raw stdout/stderr, raw prompts, raw
  provider responses, patches, or secret-like evidence.

## 7. Non-Authorization

This taskbook does not authorize:

- implementing a recovery action executor;
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

The next safe step without Jenn's explicit authorization is limited to
read-only review of this taskbook and related already-merged non-executing
boundaries.
