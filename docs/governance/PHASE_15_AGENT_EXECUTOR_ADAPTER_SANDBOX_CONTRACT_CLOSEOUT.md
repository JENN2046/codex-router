---
title: Phase 15 Agent Executor Adapter Sandbox Contract Closeout
status: active boundary
scope: sandbox-only contract witness for future agent-backed executor adapters
---

# Phase 15 Agent Executor Adapter Sandbox Contract Closeout

## Decision

Phase 15 now has a sandbox-only adapter contract run boundary.

`codex-router` can call one explicitly injected sandbox reference adapter
contract witness after Phase 15 review-only readiness passes and a sandbox
contract packet carries the exact approval string:

```text
APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_RUN
```

This validates contract mechanics only. It is not a Codex CLI adapter, sub-agent
runtime adapter, provider adapter, shell/process executor, workspace-write
executor, or production recovery engine.

## Implemented Surface

The core boundary is implemented in `packages/recovery-control`:

- `GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacketSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocationSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResultSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEventSchema`;
- `GovernanceOperatorActionAgentExecutorAdapterSandboxContractResultSchema`;
- `runGovernanceOperatorActionAgentExecutorAdapterSandboxContract()`.

The sandbox reference adapter remains a test fixture:

```text
tests/fixtures/phase15-sandbox-reference-agent-executor-adapter.ts
```

Boundary tests are in:

```text
tests/phase15-agent-executor-adapter-sandbox-contract.test.ts
```

## Boundary Rules

The sandbox contract packet is limited to:

```text
adapterKind = sandbox_reference_adapter
sideEffectBoundary = sandbox_only
```

The run requires:

- a planned Phase 10 execution gate;
- a ready Phase 11 host executor authorization result;
- a ready Phase 15 review-only adapter readiness result;
- a matching sandbox contract packet;
- an explicitly injected sandbox adapter;
- an explicitly injected audit sink;
- sanitized refs only.

No global adapter lookup is allowed.

## Controlled Sandbox Side Effects

The sandbox reference adapter writes only under a caller-provided temporary
sandbox root during tests. It records hash/status/ref artifacts such as:

```text
contract.json
status.json
<action>.completed.json
lineage/lineage.json
```

The artifact contents hash task id, action ref, receipt id, checkpoint refs,
adapter id, sandbox scope, and evidence refs. Raw prompts, raw workspace
content, stdout, stderr, provider payloads, secrets, and private-state contents
are not written.

## Fail-Closed Cases

The sandbox contract run blocks before adapter invocation when:

- review-only readiness is missing, invalid, blocked, or drifted;
- the sandbox contract packet is missing, invalid, or drifted;
- the packet does not carry the exact sandbox approval string;
- the packet is not `sandbox_reference_adapter`;
- the adapter is missing;
- the audit sink is missing;
- pre-invocation audit recording fails.

The run returns a sanitized failed result when:

- the sandbox adapter throws;
- the sandbox adapter returns malformed output;
- the sandbox adapter returns unsafe refs or reason codes;
- final audit recording fails after adapter invocation;
- sandbox path containment checks fail.

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
- secret, credential, token, `.env`, or private-state reads.

## Validation

The sandbox contract boundary is covered by tests for:

- successful sandbox contract artifact creation;
- missing audit sink blocking before adapter invocation;
- packet drift blocking before adapter invocation;
- rollback checkpoint ref hashing;
- unsafe adapter refs failing closed without leaking raw refs;
- symlink run directory escape rejection.

Broader PR validation should include:

```bash
git diff --check
node --import tsx --test tests/phase15-agent-executor-adapter-sandbox-contract.test.ts tests/recovery-control.test.ts
npm run docs:governance
node --import tsx scripts/sync-state-sync-display.ts --check
npm run typecheck
npm test
npm run build
```

## Next Stop

Any Codex-backed adapter, sub-agent-backed adapter, provider-backed adapter,
workspace-write adapter, shell/process executor, production recovery path, or
real recovery-action execution requires a new taskbook with host-specific
scope, rollback evidence, audit evidence, and a fresh exact approval string.
