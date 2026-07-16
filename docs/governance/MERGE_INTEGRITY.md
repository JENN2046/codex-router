---
title: Merge Integrity Gate
status: active
owner: governance
created: 2026-07-16
last_verified: 2026-07-17
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

This active gate prevents code validation from being treated as merge
authorization. It applies only to GitHub pull requests targeting `main`; it
does not grant release, deploy, publish, tag, provider, runtime, worker,
remote-CAS, App Server live-execution, or workspace-write authority.

Repository ruleset `19069032` (`codex-router-merge-integrity-v1`) is active for
`refs/heads/main`. It requires only the exact `Merge Integrity` context, uses
strict required-status semantics, and has `bypass_actors: []`. R3A-2 proved the
platform behavior through the harmless, never-merged PR #194 canary; the
independent R3A-3 closeout records the accepted residual risks.

## Structured Lock Metadata

Natural-language phrases such as `do not merge`, `must remain draft`, or
`不得合并` are explanatory prose only. They are not parsed and never determine
the authoritative lock state.

The authoritative lock is exactly one JSON object inside this PR-body block:

```text
<!-- codex-router-merge-lock:v1
{"schemaVersion":1,"lockId":"example-lock-123","repository":"OWNER/REPOSITORY","pullRequest":123,"baseRef":"main","reason":"awaiting_owner_authorization","locked":true}
-->
```

Every field is required, unknown fields are rejected, `schemaVersion` is fixed
at `1`, and `locked` must be exactly `true`. The `lockId` is an opaque stable
identifier; `reason` is a bounded non-empty explanation. Repository, PR number,
and base ref must match the current GitHub PR facts.

Missing metadata, duplicate blocks, conflicting blocks, malformed JSON,
unknown fields, `locked: false`, or mismatched bindings fail closed whenever a
lock is required. If any lock marker is present, malformed or contradictory
metadata also blocks an otherwise non-protected PR.

## Fail-Closed Metadata Scope

The trusted gate always reads the current PR changed-file inventory. Exactly
one valid structured lock is required when any changed path is in this set:

```text
.github/actions/**
.github/workflows/**
package-lock.json
package.json
scripts/run-governance-check.ts
scripts/run-merge-integrity-check.ts
tests/merge-integrity-check.test.ts
docs/governance/MERGE_INTEGRITY.md
docs/governance/RELEASE_GATE_MATRIX.md
```

These paths cover the privileged workflow source, locally referenced actions,
dependency graph, governance dispatcher, validator, regression contract, and
human authority documents. Rename records check both `filename` and
`previous_filename`, so moving a protected file cannot escape the scope. A PR
that changes none of these paths and contains
no structured lock passes with `no_merge_lock_required`; natural-language prose
does not change that result. A valid structured lock on an otherwise
non-protected PR remains active and requires a valid unlock.

Missing credentials, API errors, malformed file records, invalid paths,
pagination overflow, or any inability to read the complete changed-file
inventory fail closed.

## Structured Unlock

An unlock is an exact JSON object in a top-level GitHub PR comment:

```text
<!-- codex-router-merge-authorization:v1
{"schemaVersion":1,"decision":"unlock","lockId":"example-lock-123","lockDigest":"<64-hex-sha256>","repository":"OWNER/REPOSITORY","pullRequest":123,"baseRef":"main","headSha":"<40-hex-sha>","approver":"OWNER","approvedAt":"2026-07-17T12:00:00.000Z"}
-->
```

The gate computes `lockDigest` as SHA-256 over UTF-8 bytes of the canonical
JSON object whose keys are ordered as `schemaVersion`, `lockId`, `repository`,
`pullRequest`, `baseRef`, `reason`, and `locked`. This binds every current lock
field, so changing the reason or any other lock metadata invalidates an old
unlock even if its `lockId` is reused.

The comment body must contain exactly one canonical authorization block and no
additional prose. Duplicate claims, reordered or reformatted JSON, unknown
fields, and malformed blocks fail closed.

The unlock must bind the current `lockId`, computed `lockDigest`, exact head
SHA, base ref, repository, and PR number. The self-declared `approver` must equal
the GitHub-owned comment author, that author must be in the configured owner
allowlist, and the GitHub author association must be `OWNER`, `MEMBER`, or
`COLLABORATOR`.

`approvedAt` is not a wall-clock expiry. It is a comment-update binding window:
it must be no more than fifteen minutes before the GitHub `updated_at` value,
with one minute of future clock-skew tolerance. The gate also requires
GitHub-owned `created_at` and `updated_at` to be equal, so any comment edit
invalidates the authorization even when the edited timestamp remains inside
that window.

## Mechanical Invalidation

The gate re-evaluates and blocks an old unlock when any of these facts changes:

- the exact PR head SHA;
- the base ref;
- any structured lock metadata field or its digest;
- the authorization comment body or GitHub `updated_at` timestamp;
- deletion of the authorization comment;
- the `lockId` binding;
- repository or PR identity;
- allowed author or association;
- the complete file or comment inventory becoming unavailable.

Creating, editing, or deleting a top-level PR comment triggers re-evaluation.
PR synchronize and edited events re-evaluate current head, base, body metadata,
and changed paths.

A head change leaves the earlier exact-head comment in GitHub as superseded
audit evidence. That old comment cannot unlock the new head and, by itself, the
lock remains blocked. A fresh valid authorization for the current head may
re-authorize the PR without deleting the earlier comment. Malformed claims or
claims with a wrong lock, digest, base, repository, PR, author, edit state, or
timestamp remain fail-closed even when a current-head authorization exists.

## Fail-Closed GitHub Inputs

The trusted job reads changed files for every applicable PR and reads the full
top-level comment inventory for a valid active lock. Each inventory is bounded
to ten pages of 100 items. Missing credentials, non-array responses, malformed
records, API errors, or reaching the page limit fail the workflow after it
attempts to replace `pending` with a failure status. Raw PR bodies and comment
bodies are never printed in status output.

The job has only `contents: read`, `pull-requests: read`, and `statuses: write`;
the write permission is limited to the exact-head `Merge Integrity` commit
status. The ordinary CI workflow retains top-level `contents: read` only.

## Trusted Execution Source

The gate runs for `pull_request_target` and PR-only `issue_comment` events. A
target event checks out `github.event.pull_request.base.sha`; a comment event
checks out the immutable default-branch `github.sha`. Neither route checks out
or executes the PR head in the privileged context.

The job first publishes `pending`, then `success` or `failure`, to the refreshed
exact PR head. It is named `Merge Integrity Evaluation`, keeping the commit
status context distinct from the workflow check name.

R3A-1 was a bootstrap change: until it entered the trusted base, the existing
base validator could not enforce the new metadata schema against its own PR.
R3A-2 then activated the separately authorized exact ruleset and proved the
trusted-base workflow, required status, deletion revocation, and head
invalidation through harmless PR #194 without attempting merge.

## Platform Enforcement Boundary

The active ruleset mechanically requires the exact `Merge Integrity` context
before `main` can be updated. The required status is strict, so the topic branch
must also be current with the base. No bypass actor is configured.

The context currently accepts any publisher source because the ruleset has no
GitHub App `integration_id` binding. This is accepted only for the current
personal-repository model in which every repository writer and every principal
with `statuses: write` is treated as an owner-equivalent trusted principal. It
is not a claim of unforgeable publisher provenance. A multi-maintainer,
third-party-App, or potentially malicious-writer threat model requires a
separately designed and authorized source-binding change.

`Merge Integrity` is also the only required context. Typecheck, tests, build,
state-sync, package-consumer, and other ordinary CI checks are not mechanically
required by ruleset `19069032`. A successful merge-authorization status does
not replace those quality signals and does not prove that failing code cannot
enter `main`.

## Supply-Chain Boundary

All existing GitHub Actions remain pinned to full commit SHAs. R3A-2 configured
only the separately authorized ruleset; it did not modify workflows, add a
merge bot, or add a timed workflow. R3A-3 does not change the ruleset or add
required CI contexts.

## Validation

```bash
git diff --check
node --import tsx --test tests/merge-integrity-check.test.ts
npm run docs:governance
npm run typecheck
npm test
npm run build
```

See `R3A3_MERGE_INTEGRITY_CLOSEOUT.md` for the independent platform evidence,
threat-model limitation, and closeout disposition. The next entry is R3B
parallel-runtime inventory only. Do not modify the ruleset, add a merge bot or
timer, implement runtime separation, or add provider, worker, App Server live,
remote-CAS, or workspace-write capability under this closeout.
