# PR-20A Read-only Real Smoke Chain Index

## 1. Scope

PR-20A creates a local audit index for the read-only real smoke chain.

This index links the PR-13A historical real read-only smoke receipt, the PR-18
formal execution authorization and final preflight evidence, and the PR-19 local
RC closeout.

This index reads committed evidence only. It does not authorize invoking the
real Codex CLI, does not authorize provider execute, does not authorize
workspace-write, does not authorize push, release, or tag, and does not set an
execution operator flag.

## 2. Entry Point

Local index audit:

- `npm run audit:readonly-real-smoke-chain-index`
- `npm run audit:readonly-real-smoke-chain-index -- --json`

## 3. Required Inputs

The audit verifies:

- `docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX.md`
- `docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md`
- `docs/governance/PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT.md`
- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json`

## 4. Required Chain Facts

The chain must prove:

- worktree is clean
- branch is `main`
- local branch is not behind `origin/main`
- real smoke evidence is `passed`
- real smoke sandbox is `read-only`
- real smoke approval policy is `never`
- real smoke exit code is `0`
- PR-18 execution authorization remains local-only and closed for current execution
- PR-18 final preflight remains local-only and closed for current execution
- PR-19 closeout remains recorded
- workspace-write remains closed
- provider execute remains closed

## 5. Non-actions

The index audit must keep these counts at `0`:

- provider execute calls during index
- real Codex CLI calls during index
- workspace-write execute calls during index

## 6. Result

Result:

- `PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX_RECORDED`

The read-only real smoke chain now has a single local audit index without
re-running the real CLI.
