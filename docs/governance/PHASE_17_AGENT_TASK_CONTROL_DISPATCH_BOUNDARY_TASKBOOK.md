---
title: Phase 17 Agent Task Control Dispatch Boundary Taskbook
status: active taskbook
scope: pre-implementation boundary for future agent task control dispatch
---

# Phase 17 Agent Task Control Dispatch Boundary Taskbook

## Decision

Phase 17 defines the boundary that must exist before `codex-router` can
consider any future `agent_task_control` dispatch path.

This taskbook does not authorize `codex-router` to invoke Codex CLI, spawn a
sub-agent, call a provider, run a shell command, mutate a workspace, dispatch a
real recovery action, or perform production recovery.

`codex-router` remains the governance kernel. A future agent task control
adapter would be host-provided, explicitly injected, separately authorized, and
responsible for any operational semantics outside this repository.

## Why This Phase Exists

Phase 16 proved two narrower things:

- review-only dispatch authorization can bind Phase 10, Phase 11, Phase 15, and
  Phase 16 packet identities without adapter invocation;
- sandbox dry-run dispatch can call only an explicitly injected
  `sandbox_reference_adapter` and record sanitized evidence after final audit
  succeeds.

That still is not enough to dispatch work to Codex, a sub-agent, another agent
runtime, or any host automation. Phase 17 records the next boundary for the
`agent_task_control` class while keeping real agent invocation blocked.

## Authorized Now

Allowed in this line:

- define the future `agent_task_control` packet shape;
- define the future `agent_context_only` side-effect boundary;
- define required host-agent runtime refs, capability refs, and context refs;
- define task control semantics for `resume`, `rollback`, `abort`, and `fork`;
- define host responsibilities and `codex-router` responsibilities;
- define audit, evidence, timeout, idempotency, and receipt requirements;
- define fail-closed cases and non-authorization boundaries;
- update governance docs and current-state surfaces.

This line is documentation and planning only. A later implementation PR may add
non-executing schema/review code, but that later PR must have its own exact
approval string.

## Still Blocked

This taskbook does not authorize:

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

## Future Dispatch Class

The future dispatch class is:

```text
requestedDispatchClass = agent_task_control
requestedSideEffectClass = agent_context_only
```

`agent_context_only` means the future adapter may be authorized only to create
or update an agent task context inside a host-defined boundary. It does not
mean workspace-write, provider execution, shell/process execution, external
write, production mutation, or business recovery is allowed.

The host layer, not `codex-router`, owns any future Codex, sub-agent, or agent
runtime integration.

## Future Packet Requirements

A future agent task control dispatch packet must bind:

- schema version;
- exact operator approval string for the specific implementation slice;
- task id or sanitized task ref;
- action ref;
- receipt id;
- envelope hash;
- recommended recovery action;
- execution plan hash;
- checkpoint ref hash when action is `rollback`;
- Phase 10 execution gate identity;
- Phase 11 host executor descriptor id and hash;
- Phase 11 authorization identity hash;
- Phase 15 adapter id, kind, and descriptor hash;
- Phase 15 review-only readiness result hash;
- Phase 16 dispatch authorization hash or review result hash;
- Phase 16 sandbox dry-run proof ref when required by adapter class;
- requested dispatch class;
- requested side-effect class;
- authorized task control scope ref;
- host agent runtime ref;
- host agent capability ref;
- context package ref;
- context package hash;
- permitted task control operation refs;
- prompt/content policy ref;
- workspace boundary ref;
- rollback expectation ref for `rollback`;
- abort expectation ref;
- timeout policy ref;
- idempotency key hash;
- audit sink identity ref;
- evidence sink identity ref;
- receipt contract version;
- validation command refs;
- non-authorization declaration.

The packet must not contain:

- raw prompts;
- raw workspace files;
- raw stdout or stderr;
- provider raw responses;
- raw patches;
- secrets or secret-adjacent values;
- arbitrary filesystem paths beyond sanitized scope refs;
- customer data;
- full private host configuration;
- unredacted agent context payloads.

## Task Control Semantics

Phase 17 defines only authorization semantics. Operational semantics belong to
the future host adapter.

| Action | Future task control request boundary |
| --- | --- |
| `resume` | Request continuation from an approved plan step, checkpoint, or context ref. |
| `rollback` | Request rollback planning inside an approved checkpoint or patch scope; no workspace mutation is implied. |
| `abort` | Request that the host agent stop, refuse continuation, or mark a task context terminal. |
| `fork` | Request an isolated task context or lineage from an approved state; no git branch or workspace write is implied. |

`completed` on a future receipt would mean the task control dispatch transaction
completed. It must not be treated as proof that business recovery completed
unless a later host-specific taskbook defines and validates that meaning.

## Responsibility Boundary

`codex-router` may be responsible only for:

- reviewing prior gate, host executor, adapter readiness, and dispatch packet
  bindings;
- confirming dispatch class and side-effect class compatibility;
- requiring explicit injection for adapters, audit sinks, and evidence sinks;
- normalizing receipts through the Phase 14 contract;
- recording sanitized audit and evidence refs;
- failing closed when bindings, sinks, scopes, or receipts are invalid.

The future host adapter would be responsible for:

- selecting and managing any Codex, sub-agent, or host runtime;
- managing runtime permissions, workspace access, credentials, and process
  boundaries;
- interpreting task control requests into host operations;
- enforcing its own scope and safety limits;
- returning sanitized receipts only.

`codex-router` must not infer host runtime behavior from adapter names, env
vars, global state, or filesystem discovery.

## Required Pre-Dispatch Review

Before any future agent task control implementation, review must confirm:

- the adapter is explicitly injected;
- no adapter is selected by global lookup, environment discovery, or implicit
  host state;
- `requestedDispatchClass` is `agent_task_control`;
- `requestedSideEffectClass` is `agent_context_only`;
- the host agent runtime ref is sanitized and explicitly approved;
- the context package is represented by refs and hashes, not raw prompts or raw
  workspace content;
- rollback and abort expectations are present when required;
- idempotency and timeout policies are bound;
- audit and evidence sinks are explicitly injected;
- terminal receipts include sanitized reason codes;
- raw prompts, raw workspace content, provider payloads, stdout, stderr,
  secrets, and private-state contents are excluded.

## Audit And Evidence Requirements

Any future agent task control path must emit sanitized audit events for:

- authorization review attempted;
- dispatch authorization accepted or blocked;
- task control adapter invocation attempted;
- adapter receipt accepted, refused, failed, or rejected as malformed;
- final dispatch result normalized.

Completion evidence must be recorded only after final completed audit succeeds.

Audit and evidence records may contain only refs, hashes, statuses, reason
codes, timestamps, adapter kind, dispatch class, side-effect class, and receipt
metadata. They must not contain raw prompts, raw context payloads, raw workspace
content, stdout, stderr, provider payloads, secrets, private-state contents, or
arbitrary host filesystem paths.

## Fail-Closed Requirements

Future agent task control authorization must block before adapter invocation
when:

- Phase 10, Phase 11, Phase 15, or Phase 16 binding is missing, blocked,
  invalid, stale, or drifted;
- the exact approval string for the implementation slice is missing;
- dispatch class is not `agent_task_control`;
- side-effect class is not `agent_context_only`;
- host agent runtime ref, capability ref, or context package hash is missing;
- adapter kind is incompatible with task control dispatch;
- rollback checkpoint hash or rollback expectation binding is malformed;
- audit sink or evidence sink identity binding is missing;
- audit or evidence sink injection is missing;
- secret/private-state access would be required.

Future agent task control authorization must return a sanitized failed result
when:

- adapter output is malformed;
- adapter output includes unsafe refs;
- adapter output omits required terminal reason codes;
- adapter throws;
- final audit or evidence recording fails after invocation;
- scope containment cannot be proven.

## Exact Future Approval Strings

No Phase 17 implementation approval is consumed by this taskbook.

The next safe implementation stop, if approved later, would be review-only
schema/policy for the agent task control packet:

```text
APPROVE_PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION
```

That string is not active unless Jenn provides it in a later task context.

Implementation note: Jenn later provided this exact approval string for the
review-only implementation slice. The implemented non-executing boundary is
closed out in
`PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md`.

Real Codex-backed, sub-agent-backed, provider-backed, workspace-write,
shell/process, external-write, or production recovery dispatch approval is
intentionally not defined here. Those classes require newer host-specific
taskbooks, rollback evidence, audit evidence, and fresh exact approval strings.

## Acceptance Criteria

This taskbook slice is complete when:

1. the Phase 17 agent task control boundary is recorded in governance docs;
2. current-state docs identify it as planning-only and non-executing;
3. the control plane lists the capability as taskbook-only;
4. blocked capabilities remain blocked;
5. validation passes without Codex CLI invocation, provider invocation,
   sub-agent runtime invocation, shell/process execution, real workspace-write,
   external write, release, publish, deploy, tag, or secret access.

## Next Stop

The next safe implementation stop is blocked until Jenn explicitly provides:

```text
APPROVE_PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION
```

Without that exact approval, continuation remains review, planning, or
documentation only.
