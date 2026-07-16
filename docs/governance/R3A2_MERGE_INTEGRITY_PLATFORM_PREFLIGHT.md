---
title: R3A-2 Merge Integrity Platform Preflight
status: proposed
owner: governance
created: 2026-07-17
last_verified: 2026-07-17
verified_by:
  - read-only GitHub repository ruleset inventory
  - read-only main branch protection and applicable-rules inventory
  - read-only Merge Integrity status inventory
  - GitHub REST rules API documentation, version 2026-03-10
supersedes: []
superseded_by: null
applies_to:
  - repository-ruleset
  - required-status
  - merge-integrity-canary
---

# R3A-2 Merge Integrity Platform Preflight

This document is the exact authorization package for `R3A-2`. It is a
proposal only. Merging this document does not authorize or perform a GitHub
ruleset change, required-status change, locked canary, merge, release, deploy,
publish, secret change, workflow change, or execution-capability expansion.

`R3A-1` is closed. The current gate remains an implementation candidate until
the platform operation below is separately authorized, executed without a
merge attempt, evidenced, and independently reviewed in `R3A-3`.

## Read-Only Baseline

The snapshot below was observed on 2026-07-17 before this preflight was
written.

| Fact | Observed value |
| --- | --- |
| Repository | `JENN2046/codex-router` (`1220937060`) |
| Default branch | `main` |
| Authoring-snapshot `main` SHA | `b6274d98219c8d77e92bb4ff007ddde1775fe7d7` |
| Repository rulesets | none (`[]`) |
| Branch protection | disabled; `main.protected=false` |
| Rules applicable to `main` | none (`[]`) |
| Required status checks | none |
| Repository owner permission | `admin` |
| Candidate status context | `Merge Integrity` |
| Candidate status type | commit status, not a check run |
| Candidate status source binding | no integration ID exposed |

No branch-protection object, repository rule, workflow, secret, Action
permission, merge method, or auto-merge setting may be changed by this scope.
The authoring-snapshot SHA is evidence of this document's input, not a future
execution anchor: merging the reviewed preflight will legitimately advance
`main`. Immediately before any authorized platform mutation, the executor must
capture the then-current SHA as `R3A2_BASELINE_MAIN_SHA`; that exact value binds
the canary and must remain unchanged throughout the canary.

## Exact Ruleset Diff

The only authorized platform mutation, if Jenn later supplies the exact
confirmation text in this document, is one repository ruleset created with:

```text
POST /repos/JENN2046/codex-router/rulesets
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
```

The request body must be byte-for-byte equivalent JSON data to:

```json
{
  "name": "codex-router-merge-integrity-v1",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {
    "ref_name": {
      "include": [
        "refs/heads/main"
      ],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {
            "context": "Merge Integrity"
          }
        ],
        "strict_required_status_checks_policy": true
      }
    }
  ]
}
```

The resulting diff is therefore:

| Field | Before | After |
| --- | --- | --- |
| Ruleset count | `0` | `1` |
| Ruleset name | absent | `codex-router-merge-integrity-v1` |
| Target | absent | branch `refs/heads/main` only |
| Enforcement | absent | `active` |
| Required contexts | none | exactly `Merge Integrity` |
| Strict latest-base policy | absent | `true` |
| Create exemption | absent | `false` |
| Bypass actors | none | empty list |
| Other rules | none | none added |

This single required-status rule applies to every attempted update of `main`,
including direct updates as well as PR merges. A missing or failing context is
expected to block the ref update. There is no ordinary bypass; recovery is the
explicit disable/delete rollback below.

The executor must stop before mutation if the structural baseline is no longer
exact. In particular, any existing ruleset, branch protection, applicable rule,
required status, changed default branch, or changed status-context spelling
requires a new preflight rather than reconciliation by guesswork. A changed
SHA caused solely by the reviewed preflight merge is expected; its current
value is captured as `R3A2_BASELINE_MAIN_SHA` before mutation.

GitHub documents that a required-status rule prevents a matching ref update
until its configured context passes, and that strict mode tests against the
latest target-branch code. The REST schema also makes `integration_id`
optional. See [REST API endpoints for rules](https://docs.github.com/en/rest/repos/rules?apiVersion=2026-03-10)
and [available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

## Required-Status Source Limitation

The candidate publishes `Merge Integrity` through the commit-status API. The
read-only inventory exposes no integration ID for that status, so the exact
payload intentionally omits `integration_id`. GitHub will therefore require
the context name from any source; it will not mechanically bind the status to
a particular GitHub App.

This is a disclosed residual risk, not a claim of publisher provenance. During
the canary, each accepted transition must be correlated to the trusted
`Merge Integrity Evaluation` workflow event, run, exact head SHA, timestamp,
status state, and description, and the combined status must contain exactly one
`Merge Integrity` entry. That correlation supplies review evidence but does
not turn an any-source status into an App-bound check.

If Jenn does not accept this residual risk, `R3A-2` must stop. Changing the
publisher model, adding a GitHub App, adding a merge bot, or changing the
workflow is outside this preflight and requires a separate reviewed work item.

## Administrator Bypass Policy

`bypass_actors` is exactly `[]`. No repository role, user, integration, team,
deploy key, or administrator receives a configured merge bypass. In
particular, repository-owner or administrator status is not itself a canary
exception.

An administrator with repository-administration authority can still update,
disable, or delete the ruleset. That is governance recovery, not merge bypass,
and it creates ruleset-history evidence. Normal successful execution leaves
the ruleset active. Disable or delete is allowed only by the failure rollback
below, under the same later exact authorization.

The canary must prove this policy from the returned ruleset JSON, the rules
applicable to `main`, GitHub ruleset evaluation, and the owner-authored PR's
merge-state status. It must not test administrator behavior by invoking any
merge endpoint or UI merge action.

## Harmless Never-Merged Canary

The canary is synthetic repository metadata only. It uses branch
`canary/r3a2-merge-integrity`, targets `main`, changes one non-executable text
file under `docs/evidence/`, and is always closed without merge. It must not
change code, workflows, dependencies, configuration, secrets, provider state,
runtime state, or executable behavior.

The exact operation sequence is:

1. Re-read repository identity, default branch, `main` SHA, all repository
   rulesets, branch protection, rules applicable to `main`, and the current
   `Merge Integrity` context. Stop if the structural facts differ from the
   baseline above. Record the exact current SHA as `R3A2_BASELINE_MAIN_SHA`.
2. Create exactly the ruleset described in **Exact Ruleset Diff**. Capture its
   returned ID, full rule data, timestamps, and links without authentication
   headers.
3. Re-read the created ruleset and rules applicable to `main`. Require exact
   equality with the proposed name, target, active enforcement, empty bypass
   list, `main` condition, sole status context, and strict policy. Stop and
   roll back on any extra or normalized value that changes the meaning.
4. From `R3A2_BASELINE_MAIN_SHA`, create
   `canary/r3a2-merge-integrity` with one synthetic text file named
   `docs/evidence/r3a2-merge-integrity-canary.txt`. Its exact initial content
   is:

   ```text
   R3A-2 Merge Integrity canary.
   Synthetic and non-sensitive.
   This PR must never be merged.
   ```

5. Push the canary branch and open a Draft PR targeting `main`. The initial PR
   body must already contain one deliberately non-authorizing structured lock
   with `pullRequest: 0`; this fail-closed placeholder avoids an unlocked event
   before GitHub assigns the PR number.
6. Immediately replace the placeholder with exactly one valid
   `codex-router-merge-lock:v1` block bound to repository
   `JENN2046/codex-router`, the assigned PR number, base `main`, canary
   `lockId` `r3a2-platform-canary-v1`, reason
   `awaiting_owner_authorization`, and `locked: true`. Confirm the candidate
   returns `merge_lock_active`, then mark the PR ready.
7. With the PR ready, require all of the following without attempting merge:
   the exact-head `Merge Integrity` status is `failure`; the ruleset evaluation
   identifies the required context as unsatisfied; the PR merge-state is
   blocked; and the owner receives no configured bypass.
8. Publish one canonical top-level
   `codex-router-merge-authorization:v1` comment. It must bind the current lock
   digest, repository, PR, base `main`, exact current head SHA, GitHub owner
   author, and GitHub-owned timestamps according to
   `MERGE_INTEGRITY.md`. Require the trusted workflow transition to one exact
   `Merge Integrity=success` status and require the ruleset/merge-state to show
   the required context satisfied. Do not merge.
9. Delete that authorization comment. Require a new trusted evaluation and an
   exact-head `Merge Integrity=failure` status, unsatisfied ruleset
   evaluation, and blocked merge-state. This proves comment deletion revokes
   authorization without relying on elapsed time.
10. Publish a fresh valid authorization for head A and require success. Then
    append exactly `Head invalidation marker: 2.` plus a newline to the same
    canary file and push that second harmless text-only commit, creating head B.
    Require the old head-A authorization to fail on head B and require the new
    exact-head status, ruleset evaluation, and merge-state to block.
11. Confirm again that the active ruleset has `bypass_actors: []` and that the
    owner-authored PR remains blocked at head B. Do not invoke a merge attempt
    to demonstrate this fact.
12. Post one sanitized evidence-summary comment on the canary PR, close the PR
    unmerged, delete `canary/r3a2-merge-integrity`, and verify the PR records
    `merged=false`, the canary ref is absent, and `main` still equals
    `R3A2_BASELINE_MAIN_SHA`. Any concurrent mainline activity stops the
    canary, invokes failure rollback, and must be reported rather than folded
    into the evidence.
13. Re-read the ruleset and applicable rules. On successful completion the
    exact ruleset remains active for `main`; only the canary PR and branch are
    closed. Proceed no further than the `R3A-3` independent-review gate.

At every step, an API inventory failure, timeout, duplicate status context,
unexpected state transition, changed base, changed ruleset, changed default
branch, unrelated canary diff, or ambiguous merge-state causes an immediate
stop and failure rollback. No real merge attempt is ever an allowed diagnostic.

## Failure Rollback

Rollback is a contingency, not the successful end state. If any failure occurs
after ruleset creation:

1. Preserve the sanitized failing observation and the returned ruleset ID.
2. Immediately update that exact ruleset through
   `PUT /repos/JENN2046/codex-router/rulesets/{ruleset_id}` using the same full
   payload, changing only `enforcement` from `active` to `disabled`.
3. Confirm no active rule applies to `main`.
4. Delete that exact ruleset through
   `DELETE /repos/JENN2046/codex-router/rulesets/{ruleset_id}`.
5. Confirm the repository ruleset inventory is again `[]`, branch protection
   remains disabled, applicable rules for `main` are `[]`, and no required
   status remains configured.
6. If the canary PR exists, record `merged=false`, close it, delete only its
   canary branch, and confirm no canary commit entered `main`.

Do not modify an unexpected pre-existing or concurrently created ruleset. If
the exact created ruleset cannot be disabled or deleted, stop and report the
live repository configuration as a P3 incident; do not attempt broader branch,
workflow, credential, or authorization changes.

GitHub documents `PUT` for ruleset update and `DELETE` for ruleset deletion in
the [repository rules REST API](https://docs.github.com/en/rest/repos/rules?apiVersion=2026-03-10).

## Sanitized Evidence Retention

Retain only the minimum reviewable facts:

- repository ID/name, baseline and observed `main` SHA;
- ruleset ID/name, target, enforcement, conditions, bypass list, required
  context, strict flag, timestamps, history version, and public GitHub links;
- canary PR number/URL, base, head SHAs, draft/ready/closed state, merge-state,
  and final `merged=false` fact;
- canonical lock metadata and computed lock digest;
- authorization comment ID, author login/association, created/updated/deleted
  event timestamps, and the bound non-secret fields;
- trusted workflow run/job IDs, event types, conclusions, exact head SHAs, and
  GitHub links;
- exact `Merge Integrity` state, description, SHA, and timestamps at each
  transition;
- applicable-rule and ruleset-evaluation summaries;
- canary branch deletion and post-operation ruleset inventory;
- rollback API status and final restored baseline only if rollback occurs.

The closed, unmerged canary PR, GitHub-native workflow/status/ruleset history,
and one sanitized evidence-summary comment are the retained platform evidence.
Do not retain authentication headers, tokens, cookies, secrets, credential
values, raw runner logs, environment dumps, provider responses, private memory,
or unrelated repository data. Do not commit the canary content to `main`.

## Acceptance and Stop Conditions

`R3A-2` passes only when the active ruleset exactly matches this preflight and
the never-merged canary proves locked failure, exact-head unlock success,
comment-deletion revocation, head-change invalidation, and no administrator
bypass using platform state rather than a merge attempt.

Completion does not itself close Merge Integrity. The next and only route is
independent `R3A-3` review. The review must preserve the disclosed any-source
status limitation and may not claim App-bound publisher provenance.

`R3A-2` does not authorize release, deploy, publish, tag, merge bot, timed
workflow, workflow edits, secret edits, provider or Codex execution, real
worker, remote CAS, workspace-write, App Server live execution, ADR 012, or
`R3B` work.

## Exact Confirmation Text

Execution remains prohibited until Jenn supplies the following exact text, or
directly states that she authorizes execution of this exact text:

```text
授权执行 R3A-2：仅允许为 JENN2046/codex-router 的 main 创建 R3A2_MERGE_INTEGRITY_PLATFORM_PREFLIGHT.md 精确描述的 codex-router-merge-integrity-v1 ruleset，required status 仅为 Merge Integrity，strict=true，bypass_actors=[]，并接受该 commit status 当前无法绑定 integration_id、因而是 any-source context 的已披露残余风险；允许执行文档中的无害、永不合并 locked canary 序列、失败时精确回滚以及脱敏证据记录。不授权任何 merge、release、deploy、publish、tag、secret 或 workflow 修改、merge bot、定时 workflow、代码修改、provider/worker/workspace-write/App Server live execution、R3B 或其他执行能力扩张。
```

This confirmation authorizes only the future operation described here. It does
not authorize merging the preflight PR itself; that remains a separate exact
merge decision after review and checks.
