---
title: Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Closeout
status: active boundary
scope: sandbox-only contract witness for agent task-control dispatch
---

# Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Closeout

## Decision

Phase 18 now implements a sandbox-only dry-run boundary for
`agent_task_control` dispatch under the `agent_context_only` side-effect class.

The implementation proves that a ready Phase 17 task-control authorization can
be bound to an explicitly injected sandbox task-control adapter contract
witness. It does not invoke Codex CLI, spawn a sub-agent runtime, call a
provider, run a shell/process executor, mutate a real workspace, write to an
external service, perform production recovery, or execute real `resume`,
`rollback`, `abort`, or `fork` behavior.

## Implemented Surface

The sandbox dry-run surface is implemented in
`packages/governance-internal-recovery-control`:

- `GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_APPROVAL`;
- `GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunPacketSchema`;
- `GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunInvocationSchema`;
- `GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAdapterResultSchema`;
- `GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAuditEventSchema`;
- `GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunResultSchema`;
- `hashGovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResult()`;
- `runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun()`.

The accepted packet must carry this approval string:

```text
APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION
```

This approval string authorizes only the sandbox dry-run contract witness
implemented by this slice.

## Boundary Rules

The dry-run can complete only when:

```text
requestedDispatchClass = agent_task_control
requestedSideEffectClass = agent_context_only
adapterKind = sandbox_task_control_adapter
nonAuthorizationDeclaration = phase18_task_control_sandbox_dry_run_no_real_recovery_execution
```

The run requires:

- a recomputed ready Phase 17 task-control authorization review;
- a supplied Phase 17 review that matches the recomputed review hash;
- a Phase 18 packet bound to the task, action, receipt, envelope, plan,
  execution gate, host descriptor, authorization identity, Phase 16 review
  hash, Phase 17 review hash, context refs, operation ref, timeout,
  idempotency, and sink identities;
- a separate sandbox task-control adapter kind;
- an explicitly injected adapter, audit sink, and evidence sink;
- sanitized refs, hashes, statuses, reason codes, and evidence refs only.

The Phase 15 `sandbox_reference_adapter` remains incompatible with this path.
Phase 18 uses a separate `sandbox_task_control_adapter` contract witness so the
task-control boundary cannot be confused with the earlier generic sandbox
adapter proof.

## Fail-Closed Cases

The dry-run blocks before adapter invocation when:

- the supplied Phase 17 authorization review is missing, invalid, blocked, or
  drifted;
- the Phase 18 packet is missing, invalid, stale, or drifted;
- the packet does not carry the exact Phase 18 approval string;
- the packet requests any dispatch class other than `agent_task_control`;
- the packet requests any side-effect class other than `agent_context_only`;
- the packet uses `sandbox_reference_adapter` or any adapter kind other than
  `sandbox_task_control_adapter`;
- the permitted operation ref does not exactly match
  `task-control-operation:${recommendedAction}`;
- the adapter, audit sink, or evidence sink is missing.

After adapter invocation, the dry-run returns a sanitized failed result when:

- the adapter throws;
- the adapter returns malformed output;
- the final completed audit fails;
- evidence recording fails.

Completion evidence is recorded only after the final completed audit succeeds.

## Sandbox Reference Fixture

The repository test fixture
`tests/fixtures/phase18-sandbox-task-control-adapter.ts` writes only
sandbox-local contract witness files under a caller-provided sandbox root:

```text
task-control-request.json
task-control-receipt.json
evidence.json
```

Those files contain sanitized hashes, stable statuses, reason codes, and
sanitized refs. They do not contain raw prompts, raw context payloads, raw
workspace contents, raw patches, raw stdout/stderr, provider payloads, secret
or private-state contents, arbitrary host filesystem paths, or customer data.

## Validation

Local validation for this slice:

```text
node --import tsx --test tests/phase18-agent-task-control-dispatch-sandbox-dry-run.test.ts
npm run typecheck
```

The implementation did not run real Codex CLI, provider execution, sub-agent
runtime invocation, shell/process execution, real workspace-write, external
write, release, publish, deploy, tag, or secret access.
