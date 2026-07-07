---
title: Phase 17 Agent Task Control Dispatch Authorization Review-Only Closeout
status: active boundary
scope: non-executing authorization review for future agent task control dispatch
---

# Phase 17 Agent Task Control Dispatch Authorization Review-Only Closeout

## Decision

Phase 17 now has a review-only authorization boundary for future
`agent_task_control` dispatch under the `agent_context_only` side-effect class.

`codex-router` can validate a task-control dispatch authorization packet
against the Phase 10 execution gate, Phase 11 host executor review, Phase 15
adapter readiness, and Phase 16 dispatch authorization review. The boundary is
intentionally non-executing: it does not invoke an adapter, Codex CLI, a
sub-agent runtime, a provider, a shell process, workspace-write, external
write, production recovery, or a real recovery action.

## Implemented Surface

The review-only surface is implemented in
`packages/governance-internal-recovery-control`:

- `GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL`;
- `GovernanceOperatorActionAgentTaskControlDispatchAuthorizationPacketSchema`;
- `GovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResultSchema`;
- `hashGovernanceOperatorActionExecutionGateResult()`;
- `hashGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult()`;
- `reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization()`.

The accepted packet must carry this approval string:

```text
APPROVE_PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION
```

This approval string authorizes only the review-only schema and policy slice.

## Boundary Rules

The implemented review can become ready only for:

```text
requestedDispatchClass = agent_task_control
requestedSideEffectClass = agent_context_only
nonAuthorizationDeclaration = phase17_agent_task_control_review_only_no_adapter_invocation
```

The review requires:

- a planned Phase 10 execution gate hash;
- a ready Phase 16 dispatch authorization review hash;
- matching task, action, receipt, envelope, plan, host descriptor,
  authorization, adapter id, adapter kind, adapter descriptor, and adapter
  readiness hashes;
- sanitized host agent runtime and capability refs;
- sanitized context package ref plus context package hash;
- sanitized permitted task-control operation refs;
- prompt/content policy and workspace boundary refs;
- rollback checkpoint hash and rollback expectation ref for `rollback`;
- abort expectation, timeout policy, and idempotency key hash;
- audit sink and evidence sink identity refs;
- receipt contract version, validation command refs, and sanitized evidence refs.

## Fail-Closed Cases

The review blocks before any adapter invocation when:

- the Phase 16 dispatch authorization review is missing, blocked, invalid, or
  drifted;
- the Phase 17 packet is missing, invalid, stale, or drifted;
- the packet does not carry the exact Phase 17 review-only approval string;
- the packet requests any dispatch class other than `agent_task_control`;
- the packet requests any side-effect class other than `agent_context_only`;
- the packet binds an incompatible `sandbox_reference_adapter` as a task
  control adapter;
- the Phase 10 gate hash, Phase 16 review hash, adapter readiness hash, or any
  prior task/action/receipt/plan binding drifts;
- rollback checkpoint hash or rollback expectation binding is malformed.

## Non-Authorization

This closeout does not authorize:

- adapter invocation;
- Codex CLI invocation;
- sub-agent process or runtime invocation;
- provider invocation;
- shell or arbitrary process execution;
- workspace-wide or project-file mutation;
- real `resume`, `rollback`, `abort`, or `fork` execution;
- git rollback, branch mutation, tag, release, publish, or deployment;
- external service writes;
- secret, credential, token, `.env`, or private-state reads;
- background unattended recovery execution;
- production recovery execution.

## Validation

The review-only boundary is covered by targeted tests for:

- successful `agent_task_control` + `agent_context_only` review readiness;
- wrong dispatch class and side-effect class blocking;
- Phase 16 dispatch authorization review hash drift;
- incompatible sandbox reference adapter kind blocking;
- rollback checkpoint hashing without raw checkpoint ref exposure.

Expected PR validation:

```bash
git diff --check
node --import tsx --test tests/phase16-agent-executor-adapter-dispatch-authorization.test.ts tests/phase17-agent-task-control-dispatch-authorization.test.ts
npm run docs:governance
node --import tsx scripts/sync-state-sync-display.ts --check
npm run typecheck
npm test
npm run build
```

## Next Stop

Any Codex-backed adapter, sub-agent-backed adapter, host-runtime invocation,
provider-backed adapter, workspace-write adapter, shell/process executor,
production recovery path, or real recovery-action execution requires a new
host-specific taskbook with rollback evidence, audit evidence, sink injection
requirements, and a fresh exact approval string.
