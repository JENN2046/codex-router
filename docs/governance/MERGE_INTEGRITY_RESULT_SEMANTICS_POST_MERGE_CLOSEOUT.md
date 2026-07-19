---
title: Merge Integrity Result Semantics Post-merge Closeout
status: closed
owner: governance
created: 2026-07-19
last_verified: 2026-07-19
verified_by:
  - pull-request-head@b8f1f8d7268089cd40ea7fddffd5668385582c99
  - merge-commit@6826b4620e94f1e496c2fcf8120fe12a94af93b9
  - pull-request-ci@29685974361
  - merge-integrity@29686073359
  - main-ci@29686550618
applies_to:
  - pull-request
  - merge-authorization
  - merge-integrity
  - continuous-integration
  - post-merge-closeout
---

# Merge Integrity Result Semantics Post-merge Closeout

## Closeout Scope

This record closes the Merge Integrity result-semantics maintenance line after
PR #212 entered `main`. The maintenance separates a completed policy decision
that blocks merge from a workflow operational failure while preserving the
same exact-head, fail-closed required status.

This closeout records reviewed delivery facts only. It does not modify the
Ruleset, structured lock or unlock semantics, event triggers, workflow
permissions, ordinary CI matrix, or the macOS Node 22 toolchain experiment.
It does not authorize merge, release, deploy, publish, tag, provider execution,
real Codex CLI execution, or real workspace-write.

## Delivered Result

PR #212 merged reviewed head
`b8f1f8d7268089cd40ea7fddffd5668385582c99` into `main` as merge commit
`6826b4620e94f1e496c2fcf8120fe12a94af93b9` on 2026-07-19 at 20:12:14
Asia/Shanghai.

The delivered result semantics are:

- a completed `blocked` policy evaluation publishes a failing exact-head
  `Merge Integrity` status without making the trusted-base workflow CheckRun
  an operational failure;
- malformed events, GitHub inventory failures, evaluation errors, and status
  publication failures still fail the workflow;
- when exact-head facts and status publication remain available, operational
  failures attempt to replace `pending` with a fail-closed exact-head status;
- the required context, protected-path classification, structured lock,
  canonical owner unlock, actor, timestamp, and exact-head bindings remain
  unchanged.

The change therefore makes policy outcome and runner health independently
observable. It does not weaken merge authorization or convert an operational
failure into an allowed merge state.

## Review And Validation Evidence

| Evidence | Result |
| --- | --- |
| PR #212 reviewed head | `b8f1f8d7268089cd40ea7fddffd5668385582c99` |
| Exact-head Codex review | No major issues reported for `b8f1f8d726` |
| Ready-state CI run `29685974361` | `20/20 PASS` |
| Final pre-merge Merge Integrity run `29686073359` | `Merge Integrity Evaluation PASS` |
| Merge commit | `6826b4620e94f1e496c2fcf8120fe12a94af93b9` |
| `main` push CI run `29686550618` | `20/20 PASS` |
| `main` macOS Node 22 acceptance | `PASS` |
| `main` State Sync Audit | `PASS` |
| `main` Execution Boundary Audit | `PASS` |
| `main` Evidence Collection | `PASS` |

The post-merge run started from the exact merge commit at
2026-07-19T12:12:16Z and completed successfully at 2026-07-19T12:22:01Z.
No manual rerun was used.

## Residual Risks

- Ruleset `19069032` still accepts the required status from any publisher
  source under the documented owner-equivalent trusted-writer model.
- Ordinary CI remains a PR-readiness signal rather than a Ruleset-required
  context.
- A GitHub outage or a failure that prevents status publication can still
  leave platform state requiring operator diagnosis; this maintenance makes
  the workflow failure visible but cannot eliminate external platform failure.
- Draft PR #209 and draft PR #211 remain evidence carriers for the separate
  macOS Node 22 TypeScript compiler-stack investigation. This closeout does not
  promote, rerun, merge, or otherwise change either experiment.

## Disposition

```text
MERGE_INTEGRITY_RESULT_SEMANTICS_MAINTENANCE CLOSED
EXACT_HEAD_MERGE_INTEGRITY FAIL_CLOSED
POLICY_BLOCKED / WORKFLOW_OPERATIONAL_FAILURE OBSERVABLY_DISTINCT
RULESET / LOCK / UNLOCK / EVENTS / PERMISSIONS UNCHANGED
ORDINARY_CI_MATRIX / MACOS_NODE22_TOOLCHAIN UNCHANGED
RELEASE / DEPLOY / PUBLISH / TAG NOT_AUTHORIZED
```

No further Merge Integrity maintenance task is activated by this closeout.
Any Ruleset, required-context, publisher-binding, event, permission, retry,
toolchain, or capability change requires a separate task and current
authorization.
