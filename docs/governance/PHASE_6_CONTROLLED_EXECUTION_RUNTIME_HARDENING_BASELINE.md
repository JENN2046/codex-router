---
title: Phase 6 Controlled Execution Runtime Hardening Baseline
status: active
owner: governance/runtime
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run docs:governance
  - npm run validate:daily
  - node --import tsx --test tests/readonly-productization-acceptance.test.ts tests/controlled-provider-execution-taskbook-review-audit.test.ts
  - node --import tsx scripts/sync-state-sync-display.ts --check
  - npm test
  - npm run build
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - provider-execution
  - permit
  - evidence
  - workspace-write-readiness
---

# Phase 6 Controlled Execution Runtime Hardening Baseline

PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE_RECORDED

## Summary

Phase 6 converts the accepted document-governance control plane into the next
runtime-governance implementation line. This baseline freezes the current
boundary before runtime changes begin.

The next implementation work must start with controlled read-only provider
execution. It must not start with real workspace-write, default provider
execution, hidden host spawning, external writes, protected remote actions, or
release actions.

## Baseline Inputs

| Item | Value |
| --- | --- |
| Baseline commit | `743e8d477fd5657580edf7ce598ce97c647eca02` |
| Baseline branch | `main` |
| Accepted document-governance status | Phase 0-5 accepted with non-blocking follow-up |
| Next-stage plan package | `codex-router-next-stage-runtime-governance-plan.zip` |
| Next-stage plan package SHA-256 | `b2501ca6c16a25b50dbcb717e8ec412794a6feed4d8e6f7fa00f7b0b82925db2` |
| Stage name | `PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING` |
| Task prefix | `RTG-` |

## Current Authority Alignment

Current authority documents already agree on these boundaries:

- `GOVERNANCE_CONTROL_PLANE.md` lists controlled read-only execution as
  guarded and narrow, while general provider execution remains blocked.
- `RELEASE_GATE_MATRIX.md` keeps real host smoke, provider execution, external
  canaries, and workspace-write real canary outside routine validation.
- `EVIDENCE_POLICY.md` forbids raw prompts, raw provider responses,
  unredacted stdout/stderr, raw env values, tokens, secrets, credentials, and
  raw patch bodies as governance evidence.
- `WORKSPACE_WRITE_RELEASE_GATE.md` keeps workspace-write real canary blocked
  by default until a fresh target-specific authorization and permit v2 controls
  exist.
- `PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md` defines the local-only
  minimum safe slice and remains a non-authorization taskbook.

## PR-23 Slicing

| PR | Purpose | Runtime execution authorization |
| --- | --- | --- |
| PR-23A | Baseline runtime-governance readiness | None |
| PR-23B | Controlled read-only provider execution minimal slice | Current fake-spawner acceptance line; no default real Codex CLI authorization |
| PR-23C | Execution evidence binding | Evidence refs/hashes for PR-23B boundary; no broader execution authorization |
| Phase 6.3 | Read-only provider permit lifecycle hardening | Current acceptance line covers expiration, nonce, replay, and store failure; no broader execution authorization |
| PR-23D | Workspace-write permit v2 schema and validators | Permit v2 schema, validator, rollback binding, and consumption helper; no workspace-write execution authorization |
| PR-23E | Workspace-write fake canary v2 | Permit v2, patch guard, rollback evidence, and replay blocking; no real workspace-write |
| PR-23F | Runtime-governance closeout and release gates | No new execution authorization by itself |

PR-23B must preserve the PR-22A non-authorization boundary unless a reviewed
authority document and PR explicitly activate the exact controlled read-only
implementation gate.

## Phase 6.0 Baseline Tasks

| ID | Status | Evidence |
| --- | --- | --- |
| RTG-000 | completed | Baseline commit and plan package recorded above. |
| RTG-010 | completed | Validation commands listed in this document. |
| RTG-020 | completed | PR-22A taskbook, control plane, release matrix, evidence policy, and workspace-write release gate alignment recorded above. |
| RTG-030 | completed | Affected package, script, and test surfaces listed below. |
| RTG-040 | completed | This baseline document is the PR-23A closeout note. |

## Affected Surfaces For Later PRs

Expected package surfaces:

- `packages/provider-execution-runner`
- `packages/host-dispatcher`
- `packages/provider-core`
- `packages/provider-registry`
- `packages/providers`
- `packages/approval-permit`
- `packages/runtime-control`
- `packages/workspace-write-guard`
- `packages/redaction`
- `packages/execution-observation`
- `packages/governance-failure-reducer`
- `packages/desktop-live-adapter`
- `packages/desktop-host-client`

Expected script and audit surfaces:

- `scripts/run-governance-check.ts`
- `scripts/run-readonly-productization-acceptance.ts`
- `scripts/run-controlled-provider-execution-taskbook-review-audit.ts`
- `scripts/run-controlled-readonly-provider-execution-acceptance.ts`
- `scripts/run-readonly-control-chain-acceptance.ts`
- `scripts/run-workspace-write-fake-canary-acceptance.ts`
- `scripts/run-canary-test.ts`

Expected test surfaces:

- `tests/approval-permit.test.ts`
- `tests/read-only-control-chain-acceptance.test.ts`
- `tests/readonly-productization-acceptance.test.ts`
- `tests/controlled-provider-execution-taskbook-review-audit.test.ts`
- `tests/runtime-control.test.ts`
- `tests/workspace-write-fake-canary-acceptance.test.ts`
- targeted provider execution, provider-core, redaction, and workspace-write
  guard tests added by later PRs.

## Validation Baseline

PR-23A records the following local baseline commands:

```bash
npm run docs:governance
npm run validate:daily
node --import tsx --test tests/readonly-productization-acceptance.test.ts tests/controlled-provider-execution-taskbook-review-audit.test.ts
node --import tsx scripts/sync-state-sync-display.ts --check
npm test
npm run build
```

The current `readonly-productization` and
`controlled-provider-execution-taskbook-review` audits are main/clean-context
guards. On this PR branch with an in-progress docs diff, they fail closed on
branch or worktree guard checks and report zero provider execute calls, zero
real Codex CLI calls, zero workspace-write calls, and zero external writes.
That behavior is expected; PR branch validation uses the targeted tests above
and GitHub pull-request state-sync context.

Real host smoke remains explicit and is not part of this baseline PR:

```bash
npm run smoke:telemetry
npm run smoke:workspace-write:telemetry
```

Those commands require a separate target-specific authorization before use.

## Non-authorization

This baseline does not authorize:

- provider execution by default;
- invoking the real Codex CLI by default;
- hidden global process spawning;
- workspace-write real canary;
- general workspace-write;
- external write;
- protected remote action;
- push, release, publish, deploy, or tag;
- secret, credential, token, env, user config, or system config mutation.

## Stop Conditions For Phase 6

Stop the stage if a PR introduces:

- default provider execution enablement;
- real workspace-write execution before workspace-write permit v2 and explicit
  target authorization;
- hidden global process, shell, env, or host executor access;
- raw prompt, argv, stdout, stderr, command, task envelope, env, token,
  credential, provider payload, or patch body storage;
- permit replay or optional hash binding;
- external write, protected remote action, release, publish, deploy, tag, or
  push mixed into runtime hardening.

## Next Safe Action

After PR-23E, the next narrow runtime-governance work should close out Phase 6
release-gate alignment. That slice should update capability status and
validation gates while still proving zero default real workspace-write, zero
default real Codex CLI, and zero external writes.
