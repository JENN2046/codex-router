# Run State

Status: upstream divergence review fix pushed; state metadata refresh is in
progress.

Current truth source:

- `docs/current/CURRENT_STATE.md`

Workspace:

- `A:\AGENTS_OS_Workspace\governance\codex-router`

Branch:

- `fix/codex-cli-policy-bypass-flags`

Current head at latest local status refresh:

- `ebd1906`

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

Validation baseline for `ebd1906`:

- `npx tsx --test tests\state-sync-audit.test.ts`: passed, `8 / 8`
- `npm run audit:state-sync`: passed after state refresh
- `npm run typecheck`: passed
- `npm test`: passed, `1091 / 1091`
- `npm run build`: passed

Latest local optimization:

- `turn.failed` JSONL events fail closed even if Codex CLI exits with code `0`
- state-sync audit checks recorded commit hashes against the real head or the
  stale-after-commit parent head
- state-sync audit checks recorded upstream divergence against the actual
  ahead/behind result and blocks unknown divergence
- read-only audit freshness collectors fail closed when `origin/main`
  divergence is unknown
- pure state-sync audit rules extracted to
  `packages/state-sync-audit/src/index.ts`
- `scripts/run-state-sync-audit.ts` remains the CLI and repo collection shell
- `tests/state-sync-audit.test.ts` imports the reusable module

Completed validation for this slice:

- `npx tsx --test tests\state-sync-audit.test.ts`
- `npm run audit:state-sync`
- `npm run typecheck`
- `npm test`
- `npm run build`
