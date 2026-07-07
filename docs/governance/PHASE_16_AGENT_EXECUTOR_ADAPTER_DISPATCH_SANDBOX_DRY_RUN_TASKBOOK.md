---
title: Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Taskbook
status: active taskbook
scope: pre-implementation boundary for a sandbox-only dispatch dry-run extension
---

# Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Taskbook

## Decision

This taskbook defines the next narrow Phase 16 stop after the review-only
dispatch authorization closeout.

The intended future implementation is a sandbox-only dispatch dry-run that
reuses existing Phase 16 dispatch authorization binding and the Phase 15
sandbox reference adapter contract witness. It must not become a Codex-backed,
sub-agent-backed, provider-backed, shell/process, workspace-write, external
write, or production recovery path.

This taskbook is planning authority only. It does not authorize implementation
by itself and does not consume an execution approval string.

## Why This Stop Exists

Phase 16 review-only dispatch authorization can validate that a packet is bound
to a ready Phase 15 adapter readiness result, but it deliberately accepts only:

```text
requestedDispatchClass = review_only
requestedSideEffectClass = none
```

Phase 15 already proved a sandbox-only adapter contract call, but that proof
does not yet sit behind the Phase 16 dispatch authorization packet. The next
safe step is to define exactly how a later implementation may connect those two
surfaces while staying inside sandbox-only evidence.

## Authorized Future Shape

A later implementation PR may be considered only if Jenn provides the exact
approval string named below and the implementation remains inside this
taskbook.

Allowed future implementation shape:

- add a Phase 16 sandbox dry-run review/run surface;
- accept only `requestedDispatchClass = sandbox_contract`;
- accept only `requestedSideEffectClass = sandbox_only`;
- require a ready Phase 15 adapter readiness result;
- require a completed Phase 15 sandbox contract proof ref or a freshly
  generated sandbox contract result from an explicitly injected
  `sandbox_reference_adapter`;
- require a caller-provided sandbox scope ref and sandbox root;
- require explicitly injected audit and evidence sinks;
- normalize the sandbox adapter result through the Phase 14 receipt contract;
- return only sanitized refs, hashes, statuses, reason codes, and evidence refs;
- fail closed before adapter invocation when any binding, sink, sandbox, or
  authorization check is missing or stale.

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
- background unattended recovery execution.

## Exact Future Approval String

The future implementation must require this exact approval string:

```text
APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN
```

This string is not active until Jenn provides it in the current task context.
Prior Phase 15 approvals, Phase 16 review-only approval, branch names, PR
titles, or vague "continue" instructions must not be treated as this approval.

## Boundary Semantics

The sandbox dry-run is not business recovery execution.

It may prove that Phase 16 dispatch authorization can hand a sanitized,
authorized request to a sandbox-only adapter contract witness and record a
bounded receipt. It must not claim that `resume`, `rollback`, `abort`, or
`fork` actually occurred in a real workspace or host runtime.

`completed` means the sandbox dispatch transaction completed, not that recovery
completed.

## Required Packet Binding

The future sandbox dry-run must bind:

- Phase 10 planned execution gate identity;
- Phase 11 host executor descriptor and authorization identity;
- Phase 15 adapter descriptor and review-only readiness result;
- Phase 15 sandbox contract proof ref when reusing an existing proof;
- Phase 16 dispatch authorization packet;
- task id or sanitized task ref;
- action ref;
- receipt id;
- envelope hash;
- recommended action;
- execution plan hash;
- checkpoint ref hash for `rollback`;
- adapter readiness hash;
- requested dispatch class;
- requested side-effect class;
- authorized scope ref;
- sandbox scope ref;
- rollback expectation ref for `rollback`;
- abort expectation ref;
- timeout policy ref;
- audit sink identity ref;
- evidence sink identity ref;
- receipt contract version;
- validation command refs;
- non-authorization declaration.

The packet and result must not contain raw prompts, raw workspace contents, raw
patches, provider payloads, stdout, stderr, secrets, private-state contents, or
arbitrary host filesystem paths.

## Fail-Closed Requirements

The future sandbox dry-run must block before adapter invocation when:

- the exact sandbox dry-run approval string is missing;
- the Phase 15 readiness result is missing, blocked, invalid, or drifted;
- the Phase 16 dispatch authorization packet is missing, blocked, invalid, or
  drifted;
- `requestedDispatchClass` is not `sandbox_contract`;
- `requestedSideEffectClass` is not `sandbox_only`;
- the adapter kind is not `sandbox_reference_adapter`;
- the sandbox scope ref is missing or unsafe;
- the sandbox root is missing, escapes containment, or is symlink-escaped;
- audit sink or evidence sink identity binding is missing;
- audit or evidence sink injection is missing;
- rollback checkpoint hash or rollback expectation binding is malformed;
- a raw checkpoint ref is present in the dispatch packet or result;
- any evidence ref, result ref, reason code, or scope ref is unsafe;
- adapter output is malformed or omits required terminal reason codes.

The future sandbox dry-run must return a sanitized failed result when:

- the sandbox adapter throws;
- final audit recording fails after adapter invocation;
- final evidence recording fails after adapter invocation;
- sandbox containment fails after adapter invocation.

## Expected Tests For A Later Implementation

A later implementation PR should add targeted tests for:

- successful sandbox dry-run using an explicitly injected
  `sandbox_reference_adapter`;
- no adapter call when audit sink or evidence sink is missing;
- no adapter call when dispatch packet binding drifts;
- no adapter call when readiness hash drifts;
- no adapter call when dispatch class or side-effect class is wrong;
- rollback checkpoint refs are represented only by hashes;
- unsafe result refs, evidence refs, and reason codes fail closed without raw
  leakage;
- sandbox path traversal and symlink escape are rejected;
- malformed adapter receipts fail closed;
- terminal failed, refused, and aborted receipts require reason codes.

## Acceptance Criteria

This taskbook slice is complete when:

1. the sandbox dry-run boundary is recorded in governance docs;
2. current-state docs identify it as planning-only and non-executing;
3. the control plane lists the capability as a future sandbox-only stop;
4. blocked capabilities remain blocked;
5. validation passes without Codex CLI invocation, provider invocation,
   sub-agent runtime invocation, shell/process execution, real workspace-write,
   external write, release, publish, deploy, tag, or secret access.

## Next Stop

The next implementation stop is blocked until Jenn explicitly provides:

```text
APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN
```

Without that exact approval, the safe continuation remains review, planning,
or documentation only.
