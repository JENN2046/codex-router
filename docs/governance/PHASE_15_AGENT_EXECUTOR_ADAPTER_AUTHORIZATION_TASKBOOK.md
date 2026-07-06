---
title: Phase 15 Agent Executor Adapter Authorization Taskbook
status: active taskbook
scope: pre-execution authorization boundary for future agent-backed executor adapters
---

# Phase 15 Agent Executor Adapter Authorization Taskbook

## Decision

Jenn's Phase 15 authorization is accepted only as permission to prepare the
next agent-backed executor adapter boundary.

It does not authorize `codex-router` to invoke Codex CLI, spawn a sub-agent,
call a provider, run a shell command, mutate a workspace, or perform business
recovery.

Phase 15 prepares the review path for a future adapter that may be backed by
Codex, a sub-agent, or a host runtime. The future adapter remains
host-provided. `codex-router` remains the governance kernel.

## Authorized Now

Allowed in this line:

- document the future adapter boundary;
- define the authorization packet expected before a real adapter run;
- define pre-execution review requirements;
- define rollback and abort expectations;
- define sanitized evidence and receipt requirements;
- add review-only schemas or tests if needed;
- keep the default runtime posture non-executing.

## Implemented Review-Only Readiness

`APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_IMPLEMENTATION` authorizes
only the review-only readiness surface. That surface is now implemented as
schema and policy review in `packages/recovery-control`.

The implemented boundary can validate:

- a review-only agent executor adapter descriptor;
- a review-only adapter packet carrying the exact approval string;
- binding to a ready Phase 11 host executor authorization result;
- adapter descriptor hash and action support;
- sanitized evidence refs.

The implemented boundary still cannot call an adapter. It exposes no Codex CLI,
sub-agent runtime, provider, shell, process, workspace-write, or recovery-action
invocation path.

## Still Blocked

This taskbook does not authorize:

- Codex CLI invocation;
- sub-agent process or runtime invocation;
- provider invocation;
- shell or arbitrary process execution;
- workspace-wide or project-file mutation;
- real `resume`, `rollback`, `abort`, or `fork` behavior;
- git rollback, branch mutation, tag, release, publish, or deployment;
- external service writes;
- secret, credential, token, `.env`, or private-state reads.

## Future Adapter Boundary

A future agent executor adapter may exist only as an explicitly injected host
dependency. It must not be auto-discovered.

The adapter may translate an approved recovery action into one of these
host-layer task-control requests:

| Action | Adapter request boundary |
| --- | --- |
| `resume` | Continue from an approved step, checkpoint, or plan reference. |
| `rollback` | Request rollback only within a previously approved checkpoint or patch scope. |
| `abort` | Stop or refuse continuation and return a final receipt. |
| `fork` | Create an isolated task, lineage, branch, or sub-agent context from an approved state. |

The adapter must return the Phase 14 executor receipt contract:

```text
executorStatus
executorReasonCode
executorResultRef
evidenceRefs
```

Terminal statuses require stable sanitized reason codes.

## Required Authorization Packet For A Real Run

A future real adapter run requires a separate packet that names:

- task id hash or sanitized task ref;
- action ref;
- receipt id;
- envelope hash;
- execution plan hash;
- recovery action;
- checkpoint ref hash when action is `rollback`;
- host executor descriptor id and hash;
- adapter kind;
- side-effect class;
- sandbox or workspace scope;
- rollback expectation;
- abort expectation;
- timeout expectation;
- audit sink;
- evidence sink;
- exact validation commands;
- explicit operator approval string.

The packet must not contain:

- raw prompts;
- raw workspace files;
- stdout or stderr transcripts;
- provider raw responses;
- secrets or secret-adjacent values;
- arbitrary filesystem paths beyond sanitized scope refs.

## Exact Future Approval Strings

Use explicit strings so future agents cannot treat a vague approval as a real
execution grant.

Review-only implementation approval:

```text
APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_IMPLEMENTATION
```

Single sandbox-only adapter contract run approval:

```text
APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_RUN
```

Real Codex-backed, sub-agent-backed, provider-backed, or workspace-write
adapter approval is intentionally not defined here. That class requires a
newer taskbook with host-specific scope and rollback evidence.

## Required Pre-Execution Review

Before any sandbox-only adapter contract run, a reviewer must confirm:

- the adapter is explicitly injected;
- no global host lookup is used;
- no shell/process runner is introduced;
- no Codex CLI binary is invoked;
- no provider API is invoked;
- no workspace files are mutated outside the named sandbox;
- no secrets or private-state contents are read;
- audit events contain only hashes, refs, statuses, timestamps, and reason codes;
- terminal executor receipts include sanitized reason codes;
- dispatch fails closed when authorization, audit sink, evidence sink, or scope is missing.

## Rollback And Abort Expectations

The rollback expectation for this phase is procedural, not operational:

- code changes must be reversible by reverting the PR;
- sandbox artifacts must be disposable;
- no production state is created;
- no release, tag, deployment, or external service write occurs;
- no business workspace rollback is attempted by `codex-router`.

Abort expectation:

- if any pre-execution review check fails, do not call the adapter;
- if any audit write fails before dispatch, do not call the adapter;
- if the adapter returns malformed output, return a sanitized failed dispatch result;
- if scope cannot be proven, block before dispatch.

## Acceptance Criteria

Phase 15 taskbook work is complete when:

1. this authorization boundary is recorded in the governance control plane;
2. current-state docs identify the line as pre-execution only;
3. blocked capabilities remain blocked;
4. validation passes without real Codex CLI, provider, shell, workspace-write,
   external write, release, publish, deploy, tag, or secret access.

Phase 15 review-only readiness implementation is complete when:

1. `packages/recovery-control` exposes review-only adapter descriptor, packet,
   result, hash, and readiness review surfaces;
2. the readiness review requires a ready Phase 11 host executor authorization;
3. adapter invocation remains unsupported by schema;
4. wrong approval strings, descriptor drift, unsupported actions, and unsafe
   invocation claims fail closed;
5. validation passes without real Codex CLI, provider, sub-agent runtime, shell,
   workspace-write, external write, release, publish, deploy, tag, or secret
   access.

## Next Stop

The next safe execution-adjacent stop is the sandbox-only adapter contract run:

```text
APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_RUN
```

Any actual sandbox contract run, Codex-backed adapter, sub-agent-backed adapter,
provider-backed adapter, workspace-write adapter, or production recovery path
requires a separate explicit approval and must satisfy this taskbook first.
