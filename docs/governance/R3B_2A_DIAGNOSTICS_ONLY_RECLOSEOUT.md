---
title: R3B-2A Diagnostics-only Re-closeout
status: closeout_candidate
owner: governance
created: 2026-07-17
last_verified: 2026-07-17
verified_by:
  - PR #198 merged as d9312acec1389a65c532685ee1b1122f065f853d
  - Codex Router CI run 29582276105
  - Codex Router CI run 29583678323
  - exact-head state-sync digest review
  - bounded diagnostics implementation diff review
  - git diff --check
  - npm run docs:governance
  - node --import tsx --test tests/clean-build-determinism.test.ts
  - npm run audit:clean-build-determinism
  - npm run governance -- audit execution-boundary-current-surface
  - npm run typecheck
  - npm test
  - npm run build
supersedes:
  - R3B_2A_DIAGNOSTICS_ONLY_TASKBOOK.md
superseded_by: null
applies_to:
  - R3B-2A
  - clean-build-determinism
  - diagnostic-normalization
  - governance-closeout
---

# R3B-2A Diagnostics-only Re-closeout

## Summary

PR #198 added a bounded diagnostic projection to the existing clean-build
determinism audit and merged to `main` as
`d9312acec1389a65c532685ee1b1122f065f853d`. The projection identifies only a
fixed audit stage and a closed error category, with bounded exit, signal, or
filesystem-code detail where applicable.

This closes the diagnostic-observability gap that reopened R3B-2A. It does not
claim that the earlier transient macOS failure was reproduced or repaired. The
underlying determinism claim remains unchanged, and the disclosed transient CI
risk remains a runtime/host risk rather than an unbounded diagnostic-output
risk.

R3B-2A is re-closed by this record when it enters `main`. R3B-2B remains
unauthorized and does not follow automatically.

## Applies To

| Field | Closed state |
| --- | --- |
| Repository | `JENN2046/codex-router` (`1220937060`) |
| Diagnostics PR | [#198](https://github.com/JENN2046/codex-router/pull/198) |
| Reviewed PR head | `12edc0454fe3502d902ec37e11a905775d3a2d91` |
| Merge commit | `d9312acec1389a65c532685ee1b1122f065f853d` |
| Capability class | Clean-build audit diagnostics only |

## Closed Diagnostic Contract

The audit binds failures to exactly:

```text
copy | build | pack | manifest | cleanup
```

It emits only the closed categories:

```text
child_process_exit | filesystem_error | json_parse_error |
manifest_mismatch | unknown_error
```

The allowlisted projection may contain `stage`, `category`, `reason`, and only
the applicable bounded `exitCodeCategory`, `signalCategory`, or
`filesystemCode`. It does not preserve or return the original error object.

Synthetic normalization tests cover every stage, child-process exit/signal
classification, approved filesystem codes, JSON parsing, manifest mismatch,
unknown shapes, cleanup precedence, deduplication, and forbidden-field
redaction. The reviewed projection contains no raw path, stdout, stderr,
command, argv, cwd, environment, provider/runtime content, or unrestricted
message.

## Preserved Boundaries

The change does not modify:

- the clean-build sequence, fixture inputs, comparison rules, or pass/fail
  semantics;
- retry, timing, concurrency, cleanup policy, or platform behavior;
- `package.json`, `package-lock.json`, `tsconfig.json`, package exports, the
  compiled source surface, or the packed artifact surface;
- GitHub workflows, Ruleset `19069032`, required contexts, or bypass policy;
- provider, worker, App Server, remote-CAS, workspace-write, release, deploy,
  publish, or other execution authority.

`coreOnlyArtifactProven`, `artifactAllowlistChanged`, and
`runtimeSurfaceChanged` remain `false`.

## Delivery Evidence

- PR-head CI [run 29582276105](https://github.com/JENN2046/codex-router/actions/runs/29582276105)
  completed successfully at the exact reviewed head. Its 20 jobs included
  Linux, macOS, and Windows acceptance on Node 20 and 22, State Sync Audit,
  Execution Boundary Audit, and Evidence Collection.
- PR #198 had no review request, submitted review, top-level comment, inline
  comment, or unresolved review thread at merge time.
- The `Merge Integrity` context passed, the PR was mergeable, and the regular
  merge commit entered `main` only after Jenn's current merge authorization.
- Post-merge CI [run 29583678323](https://github.com/JENN2046/codex-router/actions/runs/29583678323)
  completed successfully at the exact merge commit with all 20 jobs passing.
- The state-sync filtered source-tree digest matched the exact PR head before
  merge and passed again on `main` after merge.

No workflow rerun or dispatch was used for the diagnostics delivery or this
re-closeout review.

## Re-closeout Disposition

```text
R3B-1: COMPLETE
R3B-2A: CLOSED_WITH_BOUNDED_DIAGNOSTICS_AND_DISCLOSED_TRANSIENT_CI_RISK
R3B-2B: NOT_AUTHORIZED
```

The diagnostic-observability risk is closed: a future supported error shape is
classified without retaining forbidden raw data. The historical intermittent
host/runtime cause remains unknown, so this record does not claim the CI
environment is failure-free or that the earlier transient was fixed.

## Remaining Risks

- Unrecognized error shapes intentionally fail closed to `unknown_error`.
- The earlier intermittent macOS / Node 22 cause was not reproduced.
- GitHub-hosted runner and action-runtime behavior remains an external
  platform dependency.
- The repository still builds and packs the existing broad source surface;
  no core-only artifact has been proven.

## Non-authorizations

This re-closeout does not authorize R3B-2B, artifact allowlisting, an import
firewall, Runtime deletion or migration, a workflow or Ruleset change, Node 20
maintenance, ADR 012, provider execution, a real worker, App Server live
execution, remote CAS, workspace-write, release, deploy, publish, or tag.

The next possible governed entry point is a separately scoped and separately
authorized R3B-2B proposal. Nothing in this record activates that work.
