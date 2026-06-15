# PR-20C Read-only Real Smoke Chain Local Closeout

## 1. Scope

PR-20C closes out the local read-only real smoke chain audit sequence.

This closeout depends on PR-20A's chain index and PR-20B's local candidate
consistency audit. It reads committed evidence and governance receipts only.

This closeout does not authorize invoking the real Codex CLI, does not
authorize provider execute, does not authorize workspace-write, does not
authorize push, release, or tag, and does not set an execution operator flag.

## 2. Entry Point

Local closeout audit:

- `npm run audit:readonly-real-smoke-chain-local-closeout`
- `npm run audit:readonly-real-smoke-chain-local-closeout -- --json`

Required upstream audits:

- `npm run audit:readonly-real-smoke-chain-candidate`
- `npm run audit:readonly-real-smoke-chain-index`

## 3. Required Inputs

The closeout audit verifies:

- `docs/governance/PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX.md`
- `docs/governance/PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE.md`
- `docs/governance/PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT.md`
- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json`

## 4. Required Closeout Facts

The closeout must prove:

- worktree is clean
- branch is `main`
- local branch is not behind `origin/main`
- PR-20A chain index audit is `passed`
- PR-20B candidate audit is `APPROVE_LOCAL_CANDIDATE`
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

The closeout audit must keep these counts at `0`:

- provider execute calls during closeout
- real Codex CLI calls during closeout
- workspace-write execute calls during closeout

## 6. Result

Result:

- `PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE`

The read-only real smoke chain is locally closed out without re-running the
real CLI.
