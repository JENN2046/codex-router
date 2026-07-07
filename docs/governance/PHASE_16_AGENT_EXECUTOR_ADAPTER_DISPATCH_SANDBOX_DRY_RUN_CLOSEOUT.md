---
title: Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Closeout
status: active boundary
scope: sandbox-only dispatch dry-run for agent executor adapter authorization
---

# Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Closeout

## Decision

Phase 16 now has a sandbox-only dispatch dry-run boundary for agent executor
adapter authorization.

`codex-router` can validate a Phase 16 dispatch sandbox dry-run packet, bind it
to the Phase 15 adapter readiness result, and call only an explicitly injected
`sandbox_reference_adapter` through the existing Phase 15 sandbox contract
witness. The result is a dispatch contract proof, not real recovery execution.

## Implemented Surface

The sandbox dry-run surface is implemented in
`packages/governance-internal-recovery-control`:

- `GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunPacketSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunAuditEventSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunResultSchema`;
- `runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun()`.

The accepted packet must carry this approval string:

```text
APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN
```

This approval authorizes only this sandbox dry-run slice.

## Boundary Rules

The sandbox dry-run can complete only for:

```text
requestedDispatchClass = sandbox_contract
requestedSideEffectClass = sandbox_only
adapterKind = sandbox_reference_adapter
nonAuthorizationDeclaration = phase16_sandbox_dry_run_no_real_recovery_execution
```

The run requires:

- a planned Phase 10 execution gate;
- a ready Phase 11 host executor authorization result;
- a ready Phase 15 agent executor adapter readiness result;
- a Phase 16 sandbox dry-run packet bound to the readiness hash;
- a Phase 15 sandbox contract packet bound to the same task, action, receipt,
  plan, descriptor, authorization, adapter, and sandbox scope;
- explicitly injected sandbox adapter, audit sink, and evidence sink;
- rollback checkpoint binding by `checkpointRefHash` only.

## Fail-Closed Cases

The dry-run blocks before adapter invocation when:

- the Phase 15 readiness result is missing, invalid, blocked, or drifted;
- the sandbox dry-run packet is missing, invalid, stale, or drifted;
- the sandbox contract packet is missing, invalid, stale, or drifted;
- the packet requests any dispatch class other than `sandbox_contract`;
- the packet requests any side-effect class other than `sandbox_only`;
- the adapter kind is not `sandbox_reference_adapter`;
- the injected adapter, audit sink, or evidence sink is missing;
- rollback checkpoint hash or rollback expectation binding is malformed;
- the sandbox scope binding drifts.

The dry-run returns a sanitized failed result when the sandbox contract witness
fails, the adapter returns malformed or unsafe refs, or final audit/evidence
recording fails after the adapter call.

## Non-Authorization

This closeout does not authorize:

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

The sandbox dry-run boundary is covered by targeted tests for:

- successful sandbox dry-run with an explicitly injected sandbox adapter;
- missing evidence sink blocking before adapter invocation;
- dispatch packet readiness hash drift blocking before adapter invocation;
- non-sandbox dispatch and side-effect classes blocking;
- rollback checkpoint hash binding without raw checkpoint refs in Phase 16
  packets, audit events, evidence records, or results;
- unsafe adapter refs failing closed without raw leakage;
- sandbox contract packet scope drift blocking before adapter invocation.

Broader PR validation should include:

```bash
git diff --check
node --import tsx --test tests/phase15-agent-executor-adapter-sandbox-contract.test.ts tests/phase16-agent-executor-adapter-dispatch-authorization.test.ts tests/phase16-agent-executor-adapter-dispatch-sandbox-dry-run.test.ts
npm run docs:governance
node --import tsx scripts/sync-state-sync-display.ts --check
npm run typecheck
npm test
npm run build
```

## Next Stop

Any Codex-backed adapter, sub-agent-backed adapter, provider-backed adapter,
workspace-write adapter, shell/process executor, production recovery path, or
real recovery-action execution still requires a new taskbook, host-specific
scope, rollback evidence, audit evidence, and a fresh exact approval string.
