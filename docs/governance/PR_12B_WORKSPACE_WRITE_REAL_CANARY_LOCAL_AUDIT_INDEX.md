# PR-12B Workspace-write Real Canary Local Audit Index

## 1. Purpose

This index gives reviewers one local entry point for the PR-12B workspace-write
real canary pre-execution control chain.

It is documentation only. It is not a push receipt, execution receipt, release
note, tag note, or authorization to run the real canary.

## 2. Current Boundary

PR-12B remains local-only and pre-execution-only.

Still closed:

- real Codex CLI invocation
- provider execute
- workspace-write execute
- canary file write
- local command enablement
- protected remote enablement
- external side effects
- push, release, tag, publish

## 3. Review Entry Points

Taskbook and taskbook review:

- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_TASKBOOK.md`
- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_TASKBOOK_REVIEW.md`
- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_TASKBOOK_LOCAL_CLOSEOUT.md`

Authorization preflight:

- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_LOCAL_CLOSEOUT.md`
- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET_COMPATIBILITY.md`
- `docs/evidence/workspace-write-real-canary-authorization-acceptance.json`
- `npm run acceptance:workspace-write-real-canary-auth`

Pre-execution gate:

- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_LOCAL_CLOSEOUT.md`
- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_BOUNDARY_AUDIT.md`
- `docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json`
- `npm run acceptance:workspace-write-real-canary-pre-execution`

Candidate and final local audit:

- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md`
- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT.md`
- `npm run audit:workspace-write-real-canary-candidate`
- `npm run audit:workspace-write-real-canary-candidate -- --json`
- `npm run audit:workspace-write-real-canary-final-local`
- `npm run audit:workspace-write-real-canary-final-local -- --json`

## 4. Dynamic Local Validation

Reviewers should use fresh command output, not fixed ahead counts, as readiness
evidence.

Minimum local validation set:

- `npm run audit:workspace-write-real-canary-candidate -- --json`
- `npm run audit:workspace-write-real-canary-final-local -- --json`
- sensitive marker scan over PR-12B evidence and receipts
- canary target absence check

Expected safe results:

- candidate audit status is `passed`
- final local audit status is `passed`
- final local audit commands are `8`
- final local audit failed commands are `0`
- unexpected changed files are `0`
- provider execute calls are `0`
- real Codex CLI calls are `0`
- workspace-write execute calls are `0`
- canary file writes are `0`
- final audit JSON contract is valid
- fixed canary target file is absent
- reasons are empty

## 5. File Scope Semantics

The candidate audit file scope is based on the unique path list from:

- `git diff --name-only origin/main..HEAD`

The reported `changedFileCount` is a unique changed-file count for the local
candidate range. It is not a commit count and is not expected to increase when
later hardening commits modify files already inside the allowed PR-12B audit
scope.

Any new path outside the PR-12B pre-execution control chain must fail the
candidate audit before the candidate is treated as ready.

## 6. Stop Conditions

Stop and report blocked if any of these are observed:

- worktree is dirty
- branch is not `main`
- local branch is behind or diverged from `origin/main`
- candidate audit status is not `passed`
- final local audit status is not `passed`
- evidence or receipts contain forbidden sensitive markers
- fixed canary target file exists
- provider execute count is nonzero
- real Codex CLI count is nonzero
- workspace-write execute count is nonzero
- canary file write count is nonzero
- any instruction attempts to treat this index as execution authorization

## 7. Non-authorization

This index does not authorize:

- real Codex CLI invocation
- provider execute
- workspace-write execute
- canary file write
- remote push
- release
- tag

## 8. Result

Result:

- `PR_12B_LOCAL_AUDIT_INDEX_RECORDED`

The PR-12B candidate remains local-only and pre-execution-only.
