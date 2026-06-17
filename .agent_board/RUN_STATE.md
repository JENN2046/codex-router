# Run State

Status: PR review fixes committed locally; state metadata refresh is in
progress.

Current truth source:

- `docs/current/CURRENT_STATE.md`

Workspace:

- `A:\AGENTS_OS_Workspace\governance\codex-router`

Branch:

- `fix/codex-cli-policy-bypass-flags`

Current head at latest local status refresh:

- `b2f0c1d`

Upstream:

- `origin/fix/codex-cli-policy-bypass-flags`

Worktree at last board refresh:

- dirty only with the post-review-fix state metadata refresh

Current scope:

- local docs and audit surfaces only
- no real Codex CLI execution
- no provider execute
- no workspace-write execution
- no release, tag, deployment, or protected remote action

Validation baseline for `b2f0c1d`:

- `npx tsx --test tests\codex-cli-host.test.ts tests\state-sync-audit.test.ts tests\readonly-formal-integration-readiness-matrix-audit.test.ts tests\readonly-productization-acceptance.test.ts tests\source-release-package-boundary-audit.test.ts tests\formal-real-readonly-smoke-rc-local-closeout-audit.test.ts tests\readonly-real-smoke-chain-index-audit.test.ts`: passed, `137 / 137`
- `npm run audit:state-sync`: passed after state refresh
- `npm run typecheck`: passed
- `npm test`: passed, `1089 / 1089`
- `npm run build`: passed

Latest local optimization:

- `turn.failed` JSONL events fail closed even if Codex CLI exits with code `0`
- state-sync audit checks recorded commit hashes against the real head or the
  stale-after-commit parent head
- read-only audit freshness collectors fail closed when `origin/main`
  divergence is unknown
- pure state-sync audit rules extracted to
  `packages/state-sync-audit/src/index.ts`
- `scripts/run-state-sync-audit.ts` remains the CLI and repo collection shell
- `tests/state-sync-audit.test.ts` imports the reusable module

Completed validation for this slice:

- `npx tsx --test tests\codex-cli-host.test.ts tests\state-sync-audit.test.ts tests\readonly-formal-integration-readiness-matrix-audit.test.ts tests\readonly-productization-acceptance.test.ts tests\source-release-package-boundary-audit.test.ts tests\formal-real-readonly-smoke-rc-local-closeout-audit.test.ts tests\readonly-real-smoke-chain-index-audit.test.ts`
- `npm run audit:state-sync`
- `npm run typecheck`
- `npm test`
- `npm run build`
