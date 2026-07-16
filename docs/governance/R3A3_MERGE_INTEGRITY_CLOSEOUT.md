---
title: R3A-3 Merge Integrity Closeout
status: active
owner: governance
created: 2026-07-17
last_verified: 2026-07-17
verified_by:
  - read-only GitHub ruleset and applicable-rule inventory
  - closed, unmerged PR #194 and sanitized evidence comment
  - six terminal Merge Integrity workflow runs
  - git diff --check
  - npm run docs:governance
  - npm run governance -- audit execution-boundary-current-surface
  - npm run typecheck
  - npm test
  - npm run build
  - pull_request-context state-sync audit
supersedes: []
superseded_by: null
applies_to:
  - pull-request
  - merge-authorization
  - repository-ruleset
  - governance-closeout
---

# R3A-3 Merge Integrity Closeout

## Summary

`R3A-2` is accepted as `PASS_WITH_DISCLOSED_RESIDUAL_RISK`. GitHub now
mechanically requires the exact `Merge Integrity` context before `main` can be
updated under the configured ruleset. This closes the Merge Integrity line and
`R2_GOVERNANCE_INTEGRITY_CLOSEOUT` when this closeout enters `main`.

The result is deliberately narrow: merge authorization enforcement is active.
It is not a complete CI quality gate and does not authorize release, deploy,
publish, tag, provider execution, worker execution, App Server live execution,
remote CAS, or workspace-write.

## Applies To

| Field | Closed state |
| --- | --- |
| Repository | `JENN2046/codex-router` (`1220937060`) |
| Protected target | `refs/heads/main` |
| R3A-2 baseline and unchanged main | `97d391ec24d0ca6c5c58c746e9de13224650c4de` |
| Ruleset | `19069032`, `codex-router-merge-integrity-v1` |
| Canary | PR #194, closed and unmerged |
| Capability class | Pull-request merge authorization only |

## Active Ruleset

The independently re-read GitHub inventory returned exactly:

| Field | Value |
| --- | --- |
| Enforcement | `active` |
| Target | `branch` |
| Ref include | `refs/heads/main` |
| Ref exclude | none |
| Required contexts | exactly `Merge Integrity` |
| Strict required status | `true` |
| Enforce on branch creation | `true` (`do_not_enforce_on_create=false`) |
| Bypass actors | none (`[]`) |
| Expected status source | any source; no `integration_id` binding |

The rules applicable to `main` return the same sole required-status rule. No
ruleset or required-context change is part of this closeout.

## Never-Merged Canary Evidence

PR #194 was synthetic, non-sensitive, and text-only. It targeted the unchanged
R3A-2 baseline, moved from head A
`4e037ef39c77132e53c77b28e3e59e6b28c9c03f` to head B
`d677f775488495c0c75a5c77aa1e275d533f505f`, and finished closed with
`merged=false`, `mergedAt=null`, and `mergeCommit=null`. The canary branch is
absent and `main` remained unchanged.

| Transition | Trusted run | Result |
| --- | --- | --- |
| Structured lock on Draft | [29531502348](https://github.com/JENN2046/codex-router/actions/runs/29531502348) | `failure / merge_lock_active` |
| Ready while still locked | [29531560928](https://github.com/JENN2046/codex-router/actions/runs/29531560928) | `failure / merge_lock_active` |
| Exact-head owner unlock | [29531685797](https://github.com/JENN2046/codex-router/actions/runs/29531685797) | `success` |
| Authorization comment deletion | [29531764826](https://github.com/JENN2046/codex-router/actions/runs/29531764826) | `failure / merge_lock_active` |
| Fresh exact-head owner unlock | [29531827501](https://github.com/JENN2046/codex-router/actions/runs/29531827501) | `success` |
| Head B with only the head-A unlock | [29531885283](https://github.com/JENN2046/codex-router/actions/runs/29531885283) | `failure / invalid_unlock_claim` |

All six runs used the trusted base/default-branch revision. The privileged job
did not check out or execute canary-head code. No merge endpoint or merge UI
action was used to prove blocking. The sanitized GitHub-native evidence is
retained in [PR #194](https://github.com/JENN2046/codex-router/pull/194#issuecomment-4996260031).

GitHub may return a non-empty REST `merge_commit_sha` for an unmerged PR because
it creates a test merge commit when calculating mergeability. That value does
not contradict the authoritative closed/unmerged GraphQL facts or mean the
test commit entered either branch. See
[GitHub's pull-request REST documentation](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request).

## Accepted Any-Source Risk

The required context is not bound to a GitHub App `integration_id`. GitHub
documents that a person or integration with repository write permission can
set status checks and that a ruleset may instead select a specific App as the
expected source. The current rule accepts any source. See
[GitHub's ruleset status-check documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-status-checks-to-pass-before-merging).

This is accepted only under the current personal-repository threat model:
every principal with repository write or `statuses: write` authority is treated
as an owner-equivalent trusted principal. Under a multi-maintainer,
third-party-App, or potentially malicious-writer model, any-source publication
would become a blocking provenance gap and would require a separately designed
and authorized source-bound ruleset change.

This closeout does not claim that the `Merge Integrity` publisher is
cryptographically or mechanically unforgeable.

## Merge Authorization Is Not CI Quality

Ruleset `19069032` requires only `Merge Integrity`. Typecheck, tests, builds,
state-sync, package-consumer checks, and other ordinary CI jobs are not required
contexts in the GitHub ruleset. During the canary, exact-head authorization
could satisfy the required context while older intentionally failing,
non-required CheckRuns kept the PR rollup `UNSTABLE`.

Therefore this closeout proves that an unsatisfied merge-authorization context
blocks `main` under the current trusted-writer model. It does not prove that
code with failing ordinary CI cannot enter `main`, and `Merge Integrity` must
not be described as a replacement for ordinary CI. Adding required CI contexts
would be a new ruleset diff requiring separate design and authorization.

## Risks Closed

- Protected merge-integrity paths now require structured lock metadata rather
  than natural-language interpretation.
- An active lock cannot pass without an exact repository, PR, base, lock digest,
  head, owner comment, and unedited GitHub timestamp binding.
- Comment deletion and head movement mechanically re-evaluate and restore the
  failing required context.
- The owner has no configured ruleset bypass actor.
- GitHub required-status and PR merge-state evidence prove blocking without a
  potentially successful merge attempt.

## Remaining Risks

- The any-source `Merge Integrity` status has no App-bound publisher provenance.
- Ordinary CI is not mechanically required by the current ruleset.
- The comment timestamp rule binds authorization to an unedited GitHub comment;
  it does not create wall-clock expiry.
- Repository rules remain an external platform dependency and must be re-read
  before future claims about current enforcement.

## Closeout Disposition

| Work item | Status |
| --- | --- |
| `R3-0` | closed |
| `R3A-1` | closed by PR #191 |
| `R3A-2` | executed; `PASS_WITH_DISCLOSED_RESIDUAL_RISK` |
| `R3A-3` | independently reviewed and closed by this record upon merge |
| `R2_GOVERNANCE_INTEGRITY_CLOSEOUT` | closed upon merge of this record |
| Merge Integrity mainline | closed; active enforcement remains operational governance |

The only next governed entry point is `R3B`: a read-only parallel-runtime
inventory before any clean-build, core-only artifact, or import-firewall
implementation. R3B does not itself authorize a runtime split or capability
expansion.

## Non-Authorizations

This closeout does not authorize or modify:

- the ruleset, its required contexts, or its bypass policy;
- a GitHub App, merge bot, or timed workflow;
- release, deploy, publish, tag, secrets, or provider/auth configuration;
- provider, worker, remote-CAS, workspace-write, or App Server live execution;
- ADR 012 or any other execution-capability expansion.
