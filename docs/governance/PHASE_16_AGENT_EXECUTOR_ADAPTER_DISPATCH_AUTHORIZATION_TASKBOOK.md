---
title: Phase 16 Agent Executor Adapter Dispatch Authorization Taskbook
status: active taskbook
scope: pre-implementation authorization boundary for future agent executor adapter dispatch
---

# Phase 16 Agent Executor Adapter Dispatch Authorization Taskbook

## Decision

Phase 16 defines the authorization boundary that must exist before any future
agent executor adapter dispatch implementation can be considered.

This taskbook does not authorize `codex-router` to invoke Codex CLI, spawn a
sub-agent, call a provider, run a shell command, mutate a workspace, dispatch a
real recovery action, or perform production recovery.

`codex-router` remains the governance kernel. Future operational execution
belongs to the host layer and must be explicitly injected, scoped, audited, and
separately authorized.

## Why This Phase Exists

Phase 15 proved only a sandbox contract witness:

- Phase 15 review-only readiness can bind adapter descriptors and packets.
- Phase 15 sandbox contract run can call one explicitly injected
  `sandbox_reference_adapter`.
- Sandbox side effects are contained to caller-provided test roots.

That proof is not enough to dispatch to Codex, a sub-agent, a provider, a shell,
or a workspace-write adapter. Phase 16 records the authorization shape required
before any such adapter can be implemented.

## Authorized Now

Allowed in this line:

- define the future adapter dispatch authorization packet;
- define the future adapter dispatch review result;
- define pre-dispatch audit requirements;
- define receipt and evidence requirements;
- define required host responsibilities;
- define `resume`, `rollback`, `abort`, and `fork` dispatch semantics at the
  authorization layer only;
- define fail-closed cases and non-authorization boundaries;
- update governance docs and current-state surfaces.

This line may include design-only documentation and, in a later separate PR,
non-executing schema/review code. The current taskbook itself does not
implement a dispatch runner.

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
- background unattended execution outside the current approved PR delivery
  workflow.

## Future Dispatch Authorization Packet

A future agent executor adapter dispatch authorization packet must bind all
prior gates and name the exact requested dispatch class.

Required packet fields:

- schema version;
- exact operator approval string;
- task id or sanitized task ref;
- action ref;
- receipt id;
- envelope hash;
- recommended recovery action;
- execution plan hash;
- checkpoint ref hash when action is `rollback`;
- Phase 11 host executor descriptor id and hash;
- Phase 11 authorization identity hash;
- Phase 15 adapter id, kind, and descriptor hash;
- Phase 15 review-only readiness result hash or identity;
- Phase 15 sandbox contract proof ref when the adapter kind requires prior
  sandbox proof;
- requested dispatch class;
- requested side-effect class;
- authorized scope ref;
- rollback expectation ref;
- abort expectation ref;
- timeout policy ref;
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
- full private host configuration.

## Dispatch Classes

Future work must distinguish these classes before implementation:

| Dispatch class | Meaning | Phase 16 status |
| --- | --- | --- |
| `review_only` | Recompute and bind authorization without invoking an adapter. | Allowed for future non-executing implementation. |
| `sandbox_contract` | Call a sandbox-only reference adapter under a caller-provided sandbox root. | Already proven by Phase 15; not production execution. |
| `agent_task_control` | Ask a host-provided agent adapter to perform task-control work. | Blocked until a separate implementation taskbook and exact approval. |
| `provider_backed` | Dispatch through a provider-backed adapter. | Blocked until a provider-specific taskbook and exact approval. |
| `workspace_write` | Dispatch that can mutate project workspace files. | Blocked until workspace-write authorization, rollback evidence, and exact approval. |
| `shell_process` | Dispatch through a shell, command, or local process executor. | Blocked; not a default project direction. |

## Side-Effect Classes

Future dispatch authorization must classify side effects before any adapter is
called:

| Side-effect class | Allowed by this taskbook | Requirement |
| --- | ---: | --- |
| `none` | Yes | Review-only analysis; no adapter invocation. |
| `sandbox_only` | Already proven by Phase 15 | Explicit sandbox root and containment proof. |
| `agent_context_only` | No | Requires a later host-specific taskbook. |
| `workspace_write` | No | Requires workspace-write permit, rollback evidence, and explicit approval. |
| `external_write` | No | Requires external-write authorization and target-specific safety review. |
| `production` | No | Hard stop unless Jenn gives separate production-specific authorization. |

## Action Semantics At Authorization Layer

Phase 16 defines only authorization semantics. The host adapter defines
operational semantics later.

| Action | Authorization requirement |
| --- | --- |
| `resume` | Must bind to an approved plan step, checkpoint, or continuation scope and include an abort expectation. |
| `rollback` | Must include a checkpoint ref hash, rollback expectation ref, and proof that the target is inside the approved scope. |
| `abort` | Must include a final-state expectation and must not require additional side effects beyond the approved scope. |
| `fork` | Must define the isolated lineage or task-context scope and must not imply branch, workspace, or external writes unless separately authorized. |

## Required Pre-Dispatch Review

Before any future adapter dispatch implementation, review must confirm:

- the adapter is explicitly injected;
- no adapter is selected by global lookup, environment discovery, or implicit
  host state;
- the dispatch class is compatible with the side-effect class;
- the requested action is supported by both the host executor descriptor and
  adapter descriptor;
- all prior hashes and identity bindings match recomputed review;
- rollback and abort expectations are present when required;
- audit and evidence sinks are explicitly injected;
- receipt status normalization follows the Phase 14 contract;
- terminal receipts include sanitized reason codes;
- all evidence refs are sanitized;
- raw prompts, raw workspace content, raw provider payloads, stdout, stderr,
  secrets, and private-state contents are excluded;
- missing authorization, stale authorization, scope mismatch, unsafe refs,
  malformed receipts, audit failure, or evidence failure blocks before or
  fails closed after dispatch as appropriate.

## Audit Requirements

Any future dispatch path must emit sanitized audit events for:

- authorization review attempted;
- dispatch authorization accepted or blocked;
- adapter invocation attempted;
- adapter receipt accepted, refused, failed, or rejected as malformed;
- final dispatch result normalized.

Audit records may contain only:

- schema versions;
- task refs;
- action refs;
- receipt ids;
- hashes;
- sanitized refs;
- adapter kind;
- dispatch class;
- side-effect class;
- statuses;
- stable reason codes;
- timestamps;
- evidence refs.

Audit records must not contain raw prompts, raw workspace content, stdout,
stderr, provider payloads, secrets, private-state contents, or arbitrary
filesystem paths.

## Receipt Requirements

Future adapter dispatch must normalize adapter output through the Phase 14
receipt contract:

```text
accepted | running | completed | failed | refused | aborted
```

Terminal statuses require stable sanitized reason codes:

```text
completed
failed
refused
aborted
```

Non-terminal statuses must not be treated as proof that recovery completed.
`completed` means the adapter dispatch transaction completed, not that business
recovery succeeded, unless a later host-specific taskbook explicitly defines
and validates that meaning.

## Fail-Closed Requirements

Future dispatch authorization must block before adapter invocation when:

- Phase 10 execution gate is not planned;
- Phase 11 host executor authorization is missing, blocked, or drifted;
- Phase 15 adapter readiness is missing, blocked, or drifted;
- required Phase 15 sandbox proof is missing for the chosen adapter class;
- dispatch authorization packet is missing, malformed, stale, or drifted;
- adapter descriptor does not support the requested action;
- adapter kind and dispatch class are incompatible;
- side-effect class exceeds the authorized scope;
- audit sink or evidence sink is missing;
- pre-dispatch audit write fails;
- secret/private-state access would be required.

Future dispatch authorization must return a sanitized failed result when:

- adapter output is malformed;
- adapter output includes unsafe refs;
- adapter output omits required terminal reason codes;
- adapter throws;
- final audit or evidence recording fails after invocation;
- a sandbox or scope containment proof fails.

## Exact Future Approval Strings

No Phase 16 implementation approval is consumed by this taskbook.

Future implementation work must define and require a fresh exact approval
string for the specific class it implements. Vague approval, branch names,
task names, or prior Phase 15 approvals must not be treated as execution
authorization.

Candidate future stops:

```text
APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION
APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN
```

These candidate strings are not active grants. They become usable only if Jenn
explicitly provides one in a later task and the implementation remains within
the named boundary.

Any Codex-backed, sub-agent-backed, provider-backed, workspace-write, or
shell/process dispatch path requires a newer, narrower approval string and a
host-specific taskbook.

## Acceptance Criteria

This design slice is complete when:

1. the Phase 16 dispatch authorization boundary is recorded in governance docs;
2. current-state docs identify it as pre-implementation and non-executing;
3. the control plane lists the capability as design-only;
4. blocked capabilities remain blocked;
5. validation passes without Codex CLI invocation, provider invocation,
   sub-agent runtime invocation, shell/process execution, real workspace-write,
   external write, release, publish, deploy, tag, or secret access.

## Next Stop

The next safe implementation stop is a non-executing review-only schema and
policy slice for the Phase 16 dispatch authorization packet.

That next stop still must not call Codex CLI, spawn a sub-agent, call a
provider, execute a shell/process runner, mutate a workspace, dispatch a real
recovery action, or perform production recovery.

## Implementation Follow-Up

The review-only implementation stop is closed out in:

```text
docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md
```

The remaining future stops still require fresh taskbooks and exact approval
strings before any sandbox dry-run extension, Codex-backed adapter,
sub-agent-backed adapter, provider-backed adapter, workspace-write adapter,
shell/process executor, external write, or production recovery path is
implemented.
