# PR-21A Read-only Formal Integration Readiness Matrix

## 1. Scope

PR-21A records a local readiness matrix for the read-only formal Codex CLI
integration chain.

This matrix reads existing local closeout evidence only. It does not authorize
invoking the real Codex CLI, does not authorize provider execute, does not
authorize workspace-write, does not authorize push, release, or tag, and does
not set an execution operator flag.

## 2. Entry Point

Local matrix audit:

- `npm run governance -- audit readonly-formal-integration-matrix`
- `npm run governance -- audit readonly-formal-integration-matrix -- --json`

Required upstream closeout:

- `npm run governance -- audit readonly-real-smoke-chain-local-closeout`

## 3. Matrix Rows

The matrix verifies these rows are closed:

- PR-14C formal read-only CLI integration local closeout:
  `PR_14C_FORMAL_READONLY_CLI_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE`
- PR-15C formal read-only provider integration local closeout:
  `PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE`
- PR-16B formal read-only dispatch boundary local closeout:
  `PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT_COMPLETE`
- PR-19C formal real read-only smoke local RC closeout:
  `PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT_COMPLETE`
- PR-20C read-only real smoke chain local closeout:
  `PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE`

## 4. Required Matrix Facts

The matrix must prove:

- worktree is clean
- branch is `main`
- local branch is not behind `origin/main`
- all matrix rows pass their local closeout audit
- read-only boundary is preserved
- workspace-write remains closed
- provider execute is not called by the matrix
- real Codex CLI is not called by the matrix
- evidence remains sanitized

## 5. Non-actions

The matrix audit must keep these counts at `0`:

- provider execute calls during matrix
- real Codex CLI calls during matrix
- workspace-write execute calls during matrix

## 6. Result

Result:

- `PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX_RECORDED`

The read-only formal integration chain now has a local readiness matrix without
re-running the real CLI.
