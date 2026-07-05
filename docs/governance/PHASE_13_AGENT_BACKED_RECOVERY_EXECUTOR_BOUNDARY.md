---
title: Phase 13 Agent-Backed Recovery Executor Boundary
status: active
owner: governance
created: 2026-07-06
last_verified: 2026-07-06
verified_by:
  - node --import tsx --test tests/phase13-agent-backed-recovery-executor-boundary.test.ts
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - recovery-control
  - operator-action-host-executor-dispatch
  - agent-backed-recovery-executor
---

# Phase 13 Agent-Backed Recovery Executor Boundary

## Decision

`codex-router` is a governance kernel, not a recovery engine.

Production recovery execution is host-provided. The host-provided executor may
be backed by Codex, a sub-agent, another host runtime, or a sandbox reference
implementation. `codex-router` remains responsible for approval binding,
dispatch boundary checks, audit emission, receipt normalization, and
fail-closed behavior.

This boundary does not authorize `codex-router` to embed project-specific
business recovery logic.

## Authorization Interpretation

`APPROVE_PHASE_13_REAL_HOST_EXECUTOR_DISPATCH_RUN` authorizes a narrow
validation of the existing Phase 13 injected dispatch contract.

Allowed:

- a real function call through `execute_injected`;
- an explicitly injected host-provided executor;
- an explicitly injected audit sink;
- sandbox-only controlled side effects used as contract proof.

Not allowed:

- production recovery execution;
- built-in business recovery logic;
- Codex CLI invocation;
- provider invocation;
- `dispatchToHost()` recovery execution;
- shell or arbitrary process execution;
- workspace-wide writes;
- external service writes;
- release, tag, publish, or deployment;
- secret, credential, token, `.env`, or private-state reads.

This run validates real dispatch mechanics against a sandbox-only
host-provided executor contract witness. It is not a real business recovery
run.

## Responsibility Boundary

| Layer | Responsibility |
| --- | --- |
| `codex-router` | Authorize, bind, dispatch, audit, normalize status, and fail closed. |
| Host-provided executor | Interpret approved recovery action into actual host or agent semantics. |
| Codex / sub-agent runtime | Perform task-control work only when explicitly selected and authorized by the host layer. |
| Sandbox reference executor | Prove the dispatch contract with controlled local sandbox artifacts only. |

`codex-router` must not assume control over a workspace, provider, deployment
target, shell, credential store, or agent runtime.

## Agent-Backed Recovery Semantics

These are task-control semantics for a host-provided agent executor, not
business implementation details.

| Action | Agent-backed executor meaning |
| --- | --- |
| `resume` | Continue from an approved recovery plan, step, or checkpoint reference. |
| `rollback` | Revert within the approved scope to a checkpoint, patch, or state reference supplied by the host layer. |
| `abort` | Stop or refuse continuation of a recovery run and return final status. |
| `fork` | Create an isolated lineage, branch, task context, or sub-agent path from an approved state. |

`codex-router` defines authorization semantics. The host executor defines
operational semantics.

## Sandbox Reference Executor

The sandbox reference executor exists only to prove the Phase 13
`execute_injected` dispatch contract.

Reference fixture:

```text
tests/fixtures/phase13-sandbox-reference-recovery-executor.ts
```

Boundary tests:

```text
tests/phase13-agent-backed-recovery-executor-boundary.test.ts
```

The fixture is intentionally outside `packages/recovery-control/src/` so it is
not mistaken for a product executor.

The sandbox reference executor:

- implements the existing injected executor interface;
- requires a caller-provided sandbox root;
- canonicalizes the sandbox root before writing;
- writes only hash/status/ref evidence under the sandbox root;
- records action files and status files as contract proof;
- hashes rollback checkpoint refs instead of writing raw checkpoint refs;
- rejects existing symlink run directories before writing;
- returns a sanitized `artifact:phase13-sandbox-reference:<sha256>` result ref.

The sandbox reference executor is not a production executor and must not be
used as evidence that `codex-router` can perform business recovery by itself.

## Required Fail-Closed Behavior

Dispatch must fail closed when:

- no executor is injected;
- no audit sink is injected;
- the Phase 10 gate is not planned;
- the Phase 11 review is blocked;
- the supplied authorization drifts from the recomputed review;
- the executor throws;
- the executor returns malformed or unsafe refs;
- sandbox root preparation fails;
- a sandbox write path would escape its root;
- an existing run directory is a symlink.

## Non-Goals

This boundary does not add:

- a production recovery executor;
- a Codex CLI adapter;
- a provider adapter;
- a shell executor;
- a command executor;
- a local process executor;
- git rollback implementation;
- arbitrary workspace mutation;
- external write behavior;
- release, publish, tag, or deployment behavior;
- secret discovery or credential handling.

Avoid names such as `RealRecoveryExecutor`,
`ProductionRecoveryExecutor`, `CodexCliRecoveryExecutor`, `ShellExecutor`,
`CommandExecutor`, or `LocalProcessExecutor` for this boundary. They imply a
capability that this phase does not authorize.

## Validation

The narrow boundary proof is:

```bash
node --import tsx --test tests/phase13-agent-backed-recovery-executor-boundary.test.ts
```

Broader Phase 13 regression should also include:

```bash
node --import tsx --test tests/recovery-control.test.ts tests/desktop-host-client.test.ts
npm run docs:governance
node --import tsx scripts/sync-state-sync-display.ts --check
npm run typecheck
npm run build
npm test
```

## Next Stop

Any production host executor, Codex CLI-backed executor, provider-backed
executor, arbitrary workspace-write executor, or business recovery executor
requires a separate taskbook, explicit authorization, rollback expectation,
evidence path, and host-specific safety review.
