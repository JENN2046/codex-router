---
title: Merge Integrity Gate
status: active
owner: governance
created: 2026-07-16
last_verified: 2026-07-16
verified_by:
  - node --import tsx --test tests/merge-integrity-check.test.ts
  - npm run typecheck
  - npm test
  - npm run build
supersedes: []
superseded_by: null
applies_to:
  - pull-request
  - merge-authorization
  - continuous-integration
---

# Merge Integrity Gate

This gate prevents code validation from being treated as merge authorization.
It applies only to GitHub pull requests targeting `main`; it does not grant
release, deploy, publish, tag, provider, runtime, or workspace-write authority.

## Lock Detection

`scripts/run-merge-integrity-check.ts` treats the following instructions in the
current PR body as an active merge lock, case-insensitively where applicable:

- `must remain draft`;
- `do not merge` or `don't merge`;
- `必须保持 Draft`;
- `不得合并`;
- `禁止合并`.

A locked PR fails the exact-head `Merge Integrity` commit status even when
typecheck, tests, build, state-sync, and every other CI check succeeds. The lock text stays in the PR
body under the governance procedure so the authorization record cannot be
confused with removal of the original instruction. The validator evaluates the
current event body; repository rules and authorized maintainers remain
responsible for preserving that source record.

## Structured Authorization

The current workflow allows only the repository owner named by
`github.repository_owner` to authorize a locked PR. The authorization must be
an exact JSON object inside this block:

```text
<!-- codex-router-merge-authorization:v1
{"schemaVersion":1,"decision":"unlock","repository":"JENN2046/codex-router","pullRequest":189,"headSha":"<40-hex-sha>","approver":"JENN2046","approvedAt":"2026-07-16T12:00:00.000Z","scope":{"operation":"merge","baseRef":"main"}}
-->
```

Unknown or missing fields, malformed JSON, a different repository, PR, base
branch, actor, scope, or stale head binding fail closed. `approvedAt` must be a
valid timestamp no more than fifteen minutes before the GitHub-owned comment
timestamp, with one minute of clock-skew tolerance.

### PR Comment Route

An allowed approver may post the structured block as a top-level PR comment.
The gate checks the GitHub comment author and association, not only the
self-declared `approver` field. `headSha` must equal the exact current PR head.

Creating, editing, or deleting any top-level PR comment automatically
re-evaluates the current PR body, current head, and complete current comment
inventory. A later code push changes the head and invalidates the old comment
authorization. An explicitly authorized workflow rerun remains available for a
transient platform failure.

## Fail-Closed Inputs

When a lock is active, the gate reads the PR's top-level comments using a
short-lived `GITHUB_TOKEN`. The trusted job has only `contents: read`,
`pull-requests: read`, and `statuses: write`; the write permission is limited to
publishing the gate result on the exact current PR head. Missing credentials,
API errors, malformed inventories, or 1,000 or more comments block the gate.
Raw comment bodies are not printed in the result or status.

The ordinary CI workflow has top-level `contents: read` only. The combined
governance workflow retains write permissions for its manual legacy state-sync
reanchor job because creating its narrowly scoped fallback PR requires them;
the merge-integrity job overrides those permissions with `contents: read`,
`pull-requests: read`, and `statuses: write` only.

## Trusted Execution Source

The gate runs for `pull_request_target` and for PR-only `issue_comment`
`created`, `edited`, and `deleted` events. A target event explicitly checks out
`github.event.pull_request.base.sha`; a comment event checks out the immutable
default-branch `github.sha` supplied by that event. Both routes execute only the
trusted base/default-branch validator and never check out or execute the PR head
in the privileged event context. All build, test, canary, state-sync, and
evidence jobs remain restricted to `push` or ordinary `pull_request` events.

The trusted job first publishes `pending`, then `success` or `failure`, to the
exact refreshed PR head SHA using the fixed `Merge Integrity` context. The
Actions job is deliberately named `Merge Integrity Evaluation`, so repository
rules can require the exact `Merge Integrity` commit status without selecting a
same-named workflow check. The workflow does not handle ordinary
`pull_request` events.

If GitHub cannot return the current PR head or cannot accept a status write, the
trusted workflow fails. No gate can revoke an earlier status while the status
API itself is unavailable, so maintainers must treat that platform failure as a
manual merge block and rerun the trusted event after service recovery.

The PR that first introduces this design is a bootstrap change: the trusted
base workflow cannot enforce code that is not yet on the base. Its review and
merge authorization therefore remain manual, and the required status may only
be configured after the trusted workflow lands.

## Supply-Chain Boundary

All shipped `actions/checkout`, `actions/setup-node`,
`actions/upload-artifact`, and `actions/download-artifact` uses are pinned to
full commit SHAs. A major-version comment remains beside each pin for human
upgrade review; a floating tag is not execution authority.

## Validation

```bash
git diff --check
node --import tsx --test tests/merge-integrity-check.test.ts
npm run docs:governance
npm run typecheck
npm test
npm run build
```

No real provider, Codex CLI, App Server file apply, remote CAS, real worker,
source-workspace execution, release, deploy, or package publish belongs in this
gate or its validation.
