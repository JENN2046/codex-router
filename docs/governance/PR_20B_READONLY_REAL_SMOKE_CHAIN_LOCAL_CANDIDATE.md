# PR-20B Read-only Real Smoke Chain Local Candidate

## 1. Scope

PR-20B records a local candidate consistency audit for the read-only real smoke
chain.

This candidate review depends on PR-20A's chain index and verifies the current
local chain remains recorded, sanitized, and closed to new execution.

This review reads committed evidence only. It does not authorize invoking the
real Codex CLI, does not authorize provider execute, does not authorize
workspace-write, does not authorize push, release, or tag, and does not set an
execution operator flag.

## 2. Entry Point

Local candidate audit:

- `npm run governance -- audit readonly-real-smoke-chain-candidate`
- `npm run governance -- audit readonly-real-smoke-chain-candidate -- --json`

Underlying chain index:

- `npm run governance -- audit readonly-real-smoke-chain-index`

## 3. Required Inputs

The candidate audit verifies:

- `docs/governance/PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX.md`
- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json`

## 4. Required Candidate Facts

The candidate must prove:

- worktree is clean
- branch is `main`
- local branch is not behind `origin/main`
- PR-20A chain index audit is `passed`
- real smoke evidence is `passed`
- real smoke sandbox is `read-only`
- real smoke approval policy is `never`
- real smoke exit code is `0`
- formal execution authorization remains closed
- formal final preflight remains closed
- workspace-write remains closed
- provider execute remains closed
- evidence remains sanitized

## 5. Non-actions

The candidate audit must keep these counts at `0`:

- provider execute calls during candidate
- real Codex CLI calls during candidate
- workspace-write execute calls during candidate

## 6. Result

Result:

- `PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE_RECORDED`

The read-only real smoke chain has a local candidate consistency gate without
re-running the real CLI.
