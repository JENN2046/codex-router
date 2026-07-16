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

A locked PR fails the `Merge Integrity (pull_request_target)` check even when
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

If the check already failed, leave the lock text in place and re-evaluate the
same head by editing and saving the PR body or by an explicitly authorized
workflow rerun. A later code push changes the head and invalidates the old
comment authorization.

## Fail-Closed Inputs

When a lock is active, the gate reads the PR's top-level comments using a
short-lived `GITHUB_TOKEN` with only `contents: read` and
`pull-requests: read`. Missing credentials, API errors, malformed inventories,
or 1,000 or more comments block the gate. Raw comment bodies are not printed
in the result.

The ordinary CI workflow has top-level `contents: read` only. The manual legacy
state-sync reanchor workflow retains its separately declared write permissions
because creating its narrowly scoped fallback PR requires them.

## Trusted Execution Source

The gate runs only for `pull_request_target`. It explicitly checks out
`github.event.pull_request.base.sha` and executes the validator from that trusted
base revision; it never checks out or executes the PR head in the privileged
event context. All build, test, canary, state-sync, and evidence jobs are
restricted to `push` or ordinary `pull_request` events.

Repository rules must require the exact
`Merge Integrity (pull_request_target)` status. The distinct event-qualified
name prevents a skipped job in the ordinary PR run from satisfying this gate.
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
