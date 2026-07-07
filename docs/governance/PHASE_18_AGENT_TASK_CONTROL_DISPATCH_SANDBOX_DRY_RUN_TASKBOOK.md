---
title: Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Taskbook
status: active taskbook
scope: pre-implementation boundary for a future sandbox-only agent task-control dispatch dry-run
---

# Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Taskbook

## Decision

Phase 18 defines the next narrow stop after the Phase 17 review-only
`agent_task_control` authorization boundary.

The intended future implementation is a sandbox-only task-control dispatch
dry-run. It may prove that a Phase 17 ready authorization can be bound to an
explicitly injected sandbox task-control adapter contract witness, but it must
not invoke Codex CLI, spawn a sub-agent, call a provider, run a shell command,
mutate a workspace, write to an external service, or perform real recovery.

This taskbook is planning authority only. It does not authorize implementation
or adapter invocation. A future implementation PR requires the exact approval
string named in this document.

## Why This Stop Exists

Phase 17 can validate a non-executing packet for:

```text
requestedDispatchClass = agent_task_control
requestedSideEffectClass = agent_context_only
```

That review-only boundary deliberately does not invoke any adapter. It also
blocks `sandbox_reference_adapter` for task-control dispatch because the Phase
15 sandbox reference adapter proves the generic executor adapter contract, not
the task-control adapter contract.

The next safe step is to define a separate sandbox-only task-control contract
witness before any implementation can call an adapter. This keeps the adapter
kind, packet, audit, evidence, and receipt semantics distinct from Phase 15
and Phase 16 sandbox proofs.

## Authorized Now

Allowed in this line:

- define the future sandbox-only task-control dry-run boundary;
- define the future task-control sandbox adapter contract witness;
- define packet, audit, evidence, receipt, timeout, and idempotency
  requirements;
- define fail-closed behavior and non-authorization boundaries;
- update governance docs and current-state surfaces.

This line is documentation and planning only. It does not add schemas, package
exports, test fixtures, adapter invocation, sandbox writes, or runtime code.

## Still Blocked

This taskbook does not authorize:

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
- adapter auto-discovery;
- background unattended recovery execution;
- production recovery execution.

## Future Implementation Shape

A future implementation may be considered only after Jenn provides the exact
approval string in this taskbook.

The future implementation shape is limited to:

- require a ready Phase 17 task-control dispatch authorization review;
- accept only `requestedDispatchClass = agent_task_control`;
- accept only `requestedSideEffectClass = agent_context_only`;
- require a new sandbox-only task-control adapter kind, such as
  `sandbox_task_control_adapter`;
- reject Phase 15 `sandbox_reference_adapter` for this path;
- require an explicitly injected adapter, audit sink, and evidence sink;
- require a caller-provided sandbox root and sanitized sandbox scope ref;
- write only controlled task-context artifacts under the sandbox root;
- normalize adapter output through the Phase 14 receipt contract;
- return only sanitized refs, hashes, statuses, reason codes, and evidence
  refs;
- record completion evidence only after final completed audit succeeds;
- fail closed before adapter invocation when any binding, sink, scope, or
  approval check is missing, unsafe, stale, or drifted.

## Future Adapter Contract Witness

The future sandbox adapter is a contract witness, not a recovery engine.

It may simulate task-control dispatch by writing sandbox-local records such as:

```text
target/phase18-task-control-sandbox/<run_id>/
  task-control-request.json
  task-control-receipt.json
  evidence.json
```

Those records may contain only:

- schema version;
- action;
- status;
- reason code;
- task id hash or sanitized task ref;
- action ref hash;
- receipt id hash;
- execution plan hash;
- checkpoint ref hash for `rollback`;
- context package hash;
- permitted operation ref;
- sandbox scope ref;
- evidence ref hashes.

Those records must not contain:

- raw prompts;
- raw context payloads;
- raw workspace contents;
- raw patches;
- raw stdout or stderr;
- provider payloads;
- secret or private-state contents;
- arbitrary host filesystem paths;
- customer data.

## Required Packet Binding

The future sandbox dry-run packet must bind:

- exact Phase 18 sandbox dry-run approval string;
- ready Phase 17 authorization review hash;
- Phase 10 execution gate identity;
- Phase 11 host executor descriptor and authorization identity;
- Phase 15 adapter descriptor and readiness identity when reused for lineage
  evidence only;
- Phase 16 dispatch authorization review hash;
- task id hash or sanitized task ref;
- action ref;
- receipt id;
- envelope hash;
- recommended recovery action;
- execution plan hash;
- checkpoint ref hash when action is `rollback`;
- requested dispatch class;
- requested side-effect class;
- sandbox task-control adapter id, kind, and descriptor hash;
- host agent runtime ref;
- host agent capability ref;
- context package ref and context package hash;
- permitted task-control operation ref exactly matching
  `task-control-operation:${recommendedAction}`;
- prompt/content policy ref;
- workspace boundary ref;
- sandbox scope ref and sandbox root binding hash;
- rollback expectation ref for `rollback`;
- abort expectation ref;
- timeout policy ref;
- idempotency key hash;
- audit sink identity ref;
- evidence sink identity ref;
- receipt contract version;
- validation command refs;
- non-authorization declaration.

## Fail-Closed Requirements

The future sandbox dry-run must block before adapter invocation when:

- the exact Phase 18 approval string is missing;
- the Phase 17 authorization review is missing, blocked, invalid, or drifted;
- Phase 10, Phase 11, Phase 15, or Phase 16 binding is missing, invalid, or
  drifted;
- `requestedDispatchClass` is not `agent_task_control`;
- `requestedSideEffectClass` is not `agent_context_only`;
- adapter kind is missing, unsafe, or not the future sandbox task-control
  adapter kind;
- adapter kind is `sandbox_reference_adapter`;
- permitted task-control operation ref does not exactly match
  `task-control-operation:${recommendedAction}`;
- host agent runtime ref, capability ref, context package ref, or context
  package hash is missing or unsafe;
- sandbox root is missing, unsafe, path-traversed, or symlink-escaped;
- sandbox scope ref is missing or unsafe;
- rollback checkpoint hash or rollback expectation binding is malformed;
- abort expectation binding is malformed;
- audit sink or evidence sink identity binding is missing;
- audit sink, evidence sink, or adapter injection is missing;
- a raw checkpoint ref, prompt, workspace path, or private host path appears in
  the packet.

The future sandbox dry-run must return a sanitized failed result when:

- adapter output is malformed;
- adapter output includes unsafe refs;
- adapter output omits required terminal reason codes;
- adapter throws;
- final audit recording fails after adapter invocation;
- final evidence recording fails after adapter invocation;
- sandbox containment cannot be proven after adapter invocation.

## Exact Future Approval String

No Phase 18 implementation approval is consumed by this taskbook.

The next safe implementation stop, if approved later, is:

```text
APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION
```

That string is not active unless Jenn provides it in a later task context.

Vague instructions such as "continue", "next phase", "sandbox dry-run", or
branch names must not be treated as this approval.

## Acceptance Criteria

This taskbook slice is complete when:

1. the Phase 18 sandbox dry-run boundary is recorded in governance docs;
2. current-state docs identify it as planning-only and non-executing;
3. the control plane lists the capability as taskbook-only;
4. blocked capabilities remain blocked;
5. validation passes without adapter invocation, Codex CLI invocation,
   provider invocation, sub-agent runtime invocation, shell/process execution,
   real workspace-write, external write, release, publish, deploy, tag, or
   secret access.

## Next Stop

The next implementation stop is blocked until Jenn explicitly provides:

```text
APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION
```

Without that exact approval, continuation remains review, planning, or
documentation only.
