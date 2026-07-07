---
title: Phase 16 Agent Executor Adapter Dispatch Authorization Review-Only Closeout
status: active boundary
scope: non-executing dispatch authorization review for future agent executor adapters
---

# Phase 16 Agent Executor Adapter Dispatch Authorization Review-Only Closeout

## Decision

Phase 16 now has a review-only dispatch authorization boundary for future agent
executor adapter dispatch.

`codex-router` can validate a dispatch authorization packet against the planned
Phase 10 gate, Phase 11 host executor review, and Phase 15 agent executor
adapter readiness result. The boundary is intentionally non-executing: it does
not invoke an adapter, Codex CLI, a sub-agent runtime, a provider, a shell
process, workspace-write, external write, or a recovery action.

## Implemented Surface

The review-only surface is implemented in
`packages/governance-internal-recovery-control`:

- `GovernanceOperatorActionAgentExecutorAdapterDispatchClassSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClassSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacketSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResultSchema`;
- `hashGovernanceOperatorActionAgentExecutorAdapterReviewResult()`;
- `reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization()`.

The accepted dispatch authorization packet must carry this approval string:

```text
APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION
```

This approval string authorizes only the review-only implementation slice.

## Boundary Rules

The implemented review can become ready only for:

```text
requestedDispatchClass = review_only
requestedSideEffectClass = none
nonAuthorizationDeclaration = phase16_review_only_no_adapter_invocation
```

The review requires:

- a planned Phase 10 execution gate;
- a ready Phase 11 host executor authorization result;
- a ready Phase 15 agent executor adapter readiness result;
- a dispatch authorization packet bound to the Phase 15 readiness hash;
- matching task, action, receipt, envelope, plan, descriptor, authorization,
  adapter id, adapter kind, and adapter descriptor hash;
- sanitized scope, audit sink, evidence sink, timeout, validation command, and
  evidence refs;
- rollback checkpoint binding by `checkpointRefHash` only.

## Fail-Closed Cases

The review blocks before any adapter invocation when:

- Phase 15 readiness is missing, invalid, blocked, or drifted;
- the dispatch authorization packet is missing, invalid, stale, or drifted;
- the packet does not carry the exact Phase 16 review-only approval string;
- the packet requests any dispatch class other than `review_only`;
- the packet requests any side-effect class other than `none`;
- the packet carries sandbox proof for a review-only request;
- rollback checkpoint hash or rollback expectation binding is malformed;
- any prior Phase 10, Phase 11, or Phase 15 binding fails.

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
- background unattended recovery execution.

## Validation

The review-only boundary is covered by targeted tests for:

- successful review-only dispatch authorization;
- non-review dispatch class blocking;
- side-effect class blocking;
- adapter readiness hash drift;
- sandbox contract proof requirements;
- supplied readiness drift;
- missing supplied readiness;
- rollback checkpoint hashing without raw checkpoint ref exposure.

Broader PR validation should include:

```bash
git diff --check
node --import tsx --test tests/phase16-agent-executor-adapter-dispatch-authorization.test.ts
npm run docs:governance
node --import tsx scripts/sync-state-sync-display.ts --check
npm run typecheck
npm test
npm run build
```

## Next Stop

Any sandbox dry-run extension, Codex-backed adapter, sub-agent-backed adapter,
provider-backed adapter, workspace-write adapter, shell/process executor,
production recovery path, or real recovery-action execution requires a new
taskbook with host-specific scope, rollback evidence, audit evidence, and a
fresh exact approval string.
