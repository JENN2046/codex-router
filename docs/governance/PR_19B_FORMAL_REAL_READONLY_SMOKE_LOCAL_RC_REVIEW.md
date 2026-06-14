# PR-19B Formal Real Read-only Smoke Local RC Review

## 1. Scope

PR-19B records a local RC review for the formal real read-only smoke chain.

This review reads already committed preflight and receipt evidence. It does not
authorize invoking the real Codex CLI, does not authorize provider execute, does
not authorize workspace-write, does not authorize push, release, or tag, and
does not set the future execution operator flag.

## 2. Entry Point

Local review command:

- `npm run audit:formal-real-readonly-smoke-local-rc`
- `npm run audit:formal-real-readonly-smoke-local-rc -- --json`

## 3. Required Inputs

The review verifies:

- `docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md`
- `docs/governance/PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT.md`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json`
- `docs/evidence/codex-cli-real-readonly-smoke.json`

## 4. Required Candidate Facts

The local RC candidate requires:

- clean worktree
- branch `main`
- local branch not behind `origin/main`
- PR-18C local execution preflight closeout recorded
- PR-19A receipt audit recorded
- final preflight evidence remains passed and closed for current execution
- default receipt remains passed, read-only, and sanitized
- workspace-write remains closed
- provider execute remains closed

## 5. Non-actions

This review must keep these counts at `0`:

- provider execute calls during review
- real Codex CLI calls during review
- workspace-write execute calls during review

## 6. Result

Result:

- `PR_19B_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_REVIEW_RECORDED`

The formal real read-only smoke chain now has a local RC review gate without
re-running the real CLI.
