# Run State

Status: active local state-surface cleanup with state-sync audit-core extraction
validated locally.

Current truth source:

- `docs/current/CURRENT_STATE.md`

Workspace:

- `A:\AGENTS_OS_Workspace\governance\codex-router`

Branch:

- `fix/codex-cli-policy-bypass-flags`

Current head at latest local status refresh:

- `bcec97a`

Upstream:

- `origin/fix/codex-cli-policy-bypass-flags`

Worktree at last board refresh:

- dirty with the local state-sync audit-core extraction and state metadata
  refresh

Current scope:

- local docs and audit surfaces only
- no real Codex CLI execution
- no provider execute
- no workspace-write execution
- no release, tag, deployment, or protected remote action

Validation baseline for `bcec97a` plus the local audit-core extraction working
tree:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `101 / 101`
- `npm run typecheck`: passed
- `npm test`: passed, `1082 / 1082`
- `npm run build`: passed

Current local optimization:

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
