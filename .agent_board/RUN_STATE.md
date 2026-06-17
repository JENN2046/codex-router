# Run State

Status: state-sync audit-core extraction committed locally; state metadata
refresh is in progress.

Current truth source:

- `docs/current/CURRENT_STATE.md`

Workspace:

- `A:\AGENTS_OS_Workspace\governance\codex-router`

Branch:

- `fix/codex-cli-policy-bypass-flags`

Current head at latest local status refresh:

- `986cd8b`

Upstream:

- `origin/fix/codex-cli-policy-bypass-flags`

Worktree at last board refresh:

- dirty only with the post-commit state metadata refresh

Current scope:

- local docs and audit surfaces only
- no real Codex CLI execution
- no provider execute
- no workspace-write execution
- no release, tag, deployment, or protected remote action

Validation baseline for `986cd8b`:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `101 / 101`
- `npm run typecheck`: passed
- `npm test`: passed, `1082 / 1082`
- `npm run build`: passed

Latest local optimization:

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
