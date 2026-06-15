# Validation Log

Date: 2026-06-15
Branch: `main` / `origin/main` at `fe181cb`, then
`docs/post-push-execution-gate-final-anchor`

## Passed

- `npx tsx --test tests\approval-consumption-dispatch-matrix-audit.test.ts`
  - Result: `4 / 4`
- Targeted suite:
  - `tests\approval-permit.test.ts`
  - `tests\execution-eligibility.test.ts`
  - `tests\agent-os-mcp-local-runtime.test.ts`
  - `tests\host-dispatcher.test.ts`
  - `tests\redaction.test.ts`
  - `tests\jsonl-event-log.test.ts`
  - `tests\artifact-store.test.ts`
  - `tests\tool-invocation-planner.test.ts`
  - `tests\workspace-write-guard.test.ts`
  - `tests\approval-consumption-dispatch-matrix-audit.test.ts`
  - Result: `124 / 124`
- `npm run typecheck`
- `npm test`
  - Result: `1003 / 1003`
- `npm run build`
- `git diff --cached --check`
- `npm run audit:approval-consumption-dispatch-matrix`
  - Result: passed on clean `main` at `24c3508`
- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`
  - Result: passed
  - Evidence: `docs/evidence/codex-cli-real-readonly-smoke.json`
  - Boundary: read-only sandbox, approval policy `never`, no workspace-write
- Targeted real read-only smoke tests
  - Command: `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts tests\real-readonly-smoke-authorization-acceptance.test.ts tests\formal-real-readonly-smoke-execution-authorization-acceptance.test.ts tests\formal-real-readonly-smoke-receipt-local-audit.test.ts tests\readonly-real-smoke-chain-index-audit.test.ts tests\readonly-real-smoke-chain-local-candidate-consistency.test.ts tests\readonly-real-smoke-chain-local-closeout-audit.test.ts`
  - Result: `29 / 29`
- Main-only real read-only smoke audits on clean `main`
  - `npm run audit:formal-real-readonly-smoke-execution-local`: passed
  - `npm run audit:formal-real-readonly-smoke-receipt-local`: passed
  - `npm run audit:readonly-real-smoke-chain-index`: passed
  - `npm run audit:readonly-real-smoke-chain-candidate`: `APPROVE_LOCAL_CANDIDATE`
  - `npm run audit:readonly-real-smoke-chain-local-closeout`: passed
- Controlled execution gate design tests
  - Command: `npx tsx --test tests\controlled-execution-gate-design-audit.test.ts`
  - Result: `4 / 4`
- Controlled execution / workspace-write canary targeted suite
  - Command: `npx tsx --test tests\controlled-execution-gate-design-audit.test.ts tests\workspace-write-real-canary-authorization-acceptance.test.ts tests\workspace-write-real-canary-pre-execution-acceptance.test.ts tests\workspace-write-real-canary-local-candidate-consistency.test.ts`
  - Result: `18 / 18`
- `npm run typecheck`
  - Result: passed after adding `scripts/run-controlled-execution-gate-design-audit.ts`
- `npm run audit:controlled-execution-gate-design`
  - Result: passed after committing the design branch
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
- Future canary packet checklist tests
  - Command: `npx tsx --test tests\future-codex-cli-canary-packet-checklist-audit.test.ts`
  - Result: `5 / 5`
- `npm run typecheck`
  - Result: passed after adding `scripts/run-future-codex-cli-canary-packet-checklist-audit.ts`
- `npm run audit:future-codex-cli-canary-packet-checklist`
  - Result: passed on clean `main` at `2f16fa2`
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
- Future canary authorization packet tests
  - Command: `npx tsx --test tests\future-codex-cli-canary-authorization-packet-audit.test.ts`
  - Result: `5 / 5`
- `npm run typecheck`
  - Result: passed after adding
    `scripts/run-future-codex-cli-canary-authorization-packet-audit.ts`
- `npm run audit:future-codex-cli-canary-authorization-packet`
  - Result: expected blocked on `docs/future-canary-authorization-packet`
    because the worktree is dirty and branch is not `main`
  - Reasons:
    `future_codex_cli_canary_authorization_packet_worktreeClean`,
    `future_codex_cli_canary_authorization_packet_branchMain`
- `npm run audit:future-codex-cli-canary-authorization-packet`
  - Result: expected blocked after commit on clean
    `docs/future-canary-authorization-packet` because branch is not `main`
  - Reasons: `future_codex_cli_canary_authorization_packet_branchMain`
- `npm run audit:future-codex-cli-canary-authorization-packet`
  - Result: passed on clean local `main` at `57ae4a7`
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
- `Test-Path tmp\codex-cli-write-canary.txt`
  - Result: `False`
- `git push origin main`
  - Result: first attempt failed with an HTTPS/TLS handshake error; one
    automatic retry succeeded, pushing `4db8174..c73fa1b`
- Post-push checks
  - `git status -sb`: `main...origin/main`
  - `Test-Path tmp\codex-cli-write-canary.txt`: `False`
- `git push origin main`
  - Result: pushed `c73fa1b..19b3a5e`
- Future canary execution gate tests
  - Command: `npx tsx --test tests\future-codex-cli-canary-execution-gate-audit.test.ts`
  - Result: `5 / 5`
- `npm run typecheck`
  - Result: passed after adding
    `scripts/run-future-codex-cli-canary-execution-gate-audit.ts`
- `npm run audit:future-codex-cli-canary-execution-gate`
  - Result: expected blocked on `docs/future-canary-execution-gate`
    because the worktree is dirty and branch is not `main`
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
  - Reasons:
    `future_codex_cli_canary_execution_gate_worktreeClean`,
    `future_codex_cli_canary_execution_gate_branchMain`
- `Test-Path tmp\codex-cli-write-canary.txt`
  - Result: `False`
- `npm run audit:future-codex-cli-canary-execution-gate`
  - Result: expected blocked after commit on clean
    `docs/future-canary-execution-gate` because branch is not `main`
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
  - Reasons: `future_codex_cli_canary_execution_gate_branchMain`
- `npm run audit:future-codex-cli-canary-execution-gate`
  - Result: passed on clean local `main` at `6d05762`
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
- `Test-Path tmp\codex-cli-write-canary.txt`
  - Result: `False`
- `npm run audit:future-codex-cli-canary-execution-gate`
  - Result: expected blocked on `docs/post-merge-execution-gate-anchor`
    because the worktree is dirty and branch is not `main`
  - Reasons:
    `future_codex_cli_canary_execution_gate_worktreeClean`,
    `future_codex_cli_canary_execution_gate_branchMain`
- `git push origin main`
  - Result: pushed `19b3a5e..c679c58`
- Post-push checks
  - `git status -sb`: `main...origin/main`
  - `Test-Path tmp\codex-cli-write-canary.txt`: `False`
- `npm run audit:future-codex-cli-canary-execution-gate`
  - Result: expected blocked on `docs/post-push-execution-gate-anchor`
    because the worktree is dirty and branch is not `main`
  - Reasons:
    `future_codex_cli_canary_execution_gate_worktreeClean`,
    `future_codex_cli_canary_execution_gate_branchMain`
- `git push origin main`
  - Result: pushed `c679c58..fe181cb`
- Post-push checks
  - `git status -sb`: `main...origin/main`
  - `Test-Path tmp\codex-cli-write-canary.txt`: `False`
- `npm run audit:future-codex-cli-canary-execution-gate`
  - Result: expected blocked on `docs/post-push-execution-gate-final-anchor`
    because the worktree is dirty and branch is not `main`
  - Reasons:
    `future_codex_cli_canary_execution_gate_worktreeClean`,
    `future_codex_cli_canary_execution_gate_branchMain`
- Future canary pre-execution review tests
  - Command: `npx tsx --test tests\future-codex-cli-canary-pre-execution-review-audit.test.ts`
  - Result: `5 / 5`
- `npm run typecheck`
  - Result: passed after adding
    `scripts/run-future-codex-cli-canary-pre-execution-review-audit.ts`
- `npm run audit:future-codex-cli-canary-pre-execution-review`
  - Result: expected blocked on `docs/future-canary-pre-execution-review`
    because the worktree is dirty, branch is not `main`, and local HEAD is not
    aligned with `origin/main`
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
  - Reasons:
    `future_codex_cli_canary_pre_execution_review_worktreeClean`,
    `future_codex_cli_canary_pre_execution_review_branchMain`,
    `future_codex_cli_canary_pre_execution_review_mainAlignedWithOrigin`
- `Test-Path tmp\codex-cli-write-canary.txt`
  - Result: `False`
- `npm run audit:future-codex-cli-canary-pre-execution-review`
  - Result: expected blocked on
    `docs/post-merge-pre-execution-review-anchor` because the worktree is dirty,
    branch is not `main`, and local HEAD is not aligned with `origin/main`
  - Reasons:
    `future_codex_cli_canary_pre_execution_review_worktreeClean`,
    `future_codex_cli_canary_pre_execution_review_branchMain`,
    `future_codex_cli_canary_pre_execution_review_mainAlignedWithOrigin`
- `npm run audit:future-codex-cli-canary-pre-execution-review`
  - Result: expected blocked on clean local `main` because local `main` is not
    aligned with `origin/main`
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
  - Reasons: `future_codex_cli_canary_pre_execution_review_mainAlignedWithOrigin`
- `Test-Path tmp\codex-cli-write-canary.txt`
  - Result: `False`
- `git push origin main`
  - Result: pushed `fe181cb..3a71acc`
- `npm run audit:future-codex-cli-canary-pre-execution-review`
  - Result: passed on aligned clean `main` at `3a71acc`
  - Boundary: provider execute `0`, real CLI `0`, workspace-write execute `0`,
    canary file writes `0`
- `Test-Path tmp\codex-cli-write-canary.txt`
  - Result: `False`

## Not Run

- Workspace-write real CLI smoke.
- Canary file write.
- Release, tag, deployment, or external service writes beyond the explicitly
  requested `git push origin main`.
