---
title: Phase 14 Agent Executor Receipt Contract
status: active boundary
scope: non-executing host executor receipt normalization
---

# Phase 14 Agent Executor Receipt Contract

## Decision

Phase 14 extends the Phase 13 injected host executor dispatch contract with a
host executor receipt status.

`codex-router` still does not execute recovery actions. It records whether the
explicitly injected executor was called and normalizes the executor's receipt
into sanitized status, reason code, result ref, and evidence refs.

This is a contract evolution for future Codex-backed, sub-agent-backed, or
host-provided executors. It is not an authorization to invoke Codex CLI, call a
provider, run a shell command, mutate a workspace, or perform production
recovery.

## Receipt Statuses

The injected executor result now accepts:

| Status | Meaning |
| --- | --- |
| `accepted` | The host executor accepted the approved action for later or async handling. |
| `running` | The host executor reports that the approved action is in progress. |
| `completed` | The dispatch transaction completed and produced a final receipt. |
| `failed` | The host executor failed the approved action and returned a stable reason code. |
| `refused` | The host executor refused the approved action and returned a stable reason code. |
| `aborted` | The host executor stopped the approved action and returned a stable reason code. |

The outer dispatch result remains separate:

```text
dispatch.status = dispatched
```

means only that `codex-router` called the explicitly injected executor and
received a schema-valid receipt. It does not mean business recovery finished.

The executor-specific status is carried as:

```text
executorStatus
executorReasonCode
executorResultRef
evidenceRefs
```

## Required Safety Rules

Terminal executor statuses require a stable reason code:

```text
failed
refused
aborted
```

The reason code must be bounded and machine-safe. Raw exception messages,
stdout, stderr, prompts, provider payloads, workspace content, secret-like
strings, and unbounded prose are not valid reason codes.

If a terminal executor receipt omits `reasonCode`, dispatch fails closed with a
sanitized executor failure. The raw executor payload is not returned.

## Non-Authorization

This boundary does not add:

- a Codex CLI adapter;
- a provider adapter;
- a shell executor;
- a command executor;
- a local process executor;
- production recovery execution;
- real `resume`, `rollback`, `abort`, or `fork` execution;
- workspace-wide writes;
- external writes;
- release, publish, tag, or deployment behavior;
- secret, credential, token, `.env`, or private-state access.

## Validation

The contract is validated by:

```bash
node --import tsx --test tests/recovery-control.test.ts tests/desktop-host-client.test.ts tests/phase13-agent-backed-recovery-executor-boundary.test.ts
npm run typecheck
```

Broader PR validation should also include:

```bash
git diff --check
npm run docs:governance
node --import tsx scripts/sync-state-sync-display.ts --check
npm run build
npm test
```

## Next Stop

Any executor adapter that actually invokes Codex CLI, a sub-agent runtime, a
provider, a host process, shell, workspace-write operation, business rollback,
deployment, release, tag, external service, or production recovery path still
requires a separate taskbook, explicit authorization, rollback expectation,
evidence path, and host-specific safety review.
