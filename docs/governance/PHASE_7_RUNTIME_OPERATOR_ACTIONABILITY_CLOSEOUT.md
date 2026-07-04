---
title: Phase 7 Runtime Operator Actionability Closeout
status: active
owner: governance
created: 2026-07-04
last_verified: 2026-07-04
verified_by:
  - git diff --check
  - node --import tsx --test tests/recovery-control.test.ts
  - node --import tsx --test tests/provider-execution-runner.test.ts
  - node --import tsx --test tests/desktop-live-adapter-governance.test.ts
  - node --import tsx --test tests/desktop-host-client.test.ts
  - node --import tsx --test tests/host-client-example.test.ts
  - npm run typecheck
  - npm run build
  - npm test
  - npm run validate:daily
  - npm run docs:governance
  - pull_request-context state-sync audit
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - recovery-control
  - controlled-readonly-provider-execution
  - operator-actionability
---

# Phase 7 Runtime Operator Actionability Closeout

Phase 7 turns runtime-governance blocks and recovery decisions into stable,
host-consumable operator action surfaces. It does not broaden execution
authorization.

## Included PRs

| Slice | Merge commit | Result |
| --- | --- | --- |
| Preflight governance block surface | `a8055c1` | Controlled read-only runner returns structured preflight governance when prior state requires step-back, abort, or simulate. |
| Operator action envelope | `52db3db` | Controlled read-only runner exposes a stable `GovernanceOperatorActionEnvelope` for preflight and runtime failure paths. |
| Operator action summary and event surface | `091821a` | Runner result and completed event include a compact `GovernanceOperatorActionSummary`. |
| Host-client action envelope surface | `3f35215` | Desktop live adapter, `DesktopHostClient`, and example host client expose top-level operator action envelope and summary fields. |
| Evidence resolution surface | `9f49139` | Recovery control resolves operator action evidence refs into sanitized, task-scoped summaries without raw payloads. |

## Capability Status

| Capability | Status | Real execution allowed | Notes |
| --- | --- | ---: | --- |
| Preflight governance block reporting | active | No by itself | Blocked controlled read-only runs can report strategy, recovery, lockdown, and operator-action context before provider hooks. |
| Governance operator action envelope | active | No by itself | Standard envelope covers source, task, trigger, recommended action, approval, lockdown, blocking reasons, evidence refs, and artifact refs. |
| Governance operator action summary | active | No by itself | Compact summary is suitable for events, host logs, and UI badges without raw evidence payloads. |
| Host-client operator action surface | active | No by itself | Desktop host client results expose the same envelope and summary as the lower runtime result. |
| Operator action evidence resolution | active | No by itself | Resolves `execution-observation:*` and `artifact:*` refs through explicit stores; malformed, unavailable, cross-task, or unsupported refs remain unresolved. |

## Closed Risks

- Prior governance blocks were visible mainly as raw result details; hosts now
  have a stable action envelope and summary.
- Third-anomaly and human-approval invariants are schema checked for operator
  actions and envelopes.
- Host clients no longer need to inspect lower-level runtime internals to find
  recommended action, lockdown, or evidence refs.
- Evidence refs can be resolved into sanitized summaries without exposing
  artifact payloads, raw stdout/stderr, env, argv, provider responses, prompts,
  or patches.
- Artifact evidence resolution is task-scoped and rejects unsafe artifact refs.

## Remaining Risks

- No dedicated interactive UI renderer is included in Phase 7; host/UI layers
  must consume the envelope, summary, and evidence-resolution helper.
- Missing observation or artifact stores produce unresolved evidence summaries;
  this is intentional fail-closed behavior, not proof that evidence exists.
- Phase 7 does not authorize recovery action execution. It only standardizes
  what action should be presented to the operator.

## Non-Authorizations

This closeout does not authorize:

- real workspace-write by default;
- general workspace-write;
- external write;
- protected remote action;
- release, publish, deploy, tag, or package publication;
- default real Codex CLI execution;
- general provider execution;
- bypassing permits, preflight, state-sync, or review gates.

## Current Operator Path

For controlled read-only runtime-governance results:

1. Read `operatorActionSummary` first for compact status.
2. Read `operatorActionEnvelope` when an action is present.
3. Resolve `operatorActionEnvelope.evidenceRefs` with
   `resolveGovernanceOperatorActionEvidence()` only when explicit observation
   or artifact stores are available.
4. Treat unresolved evidence as unresolved; do not infer success from missing
   stores or unsupported refs.

