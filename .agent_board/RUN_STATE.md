# Run State

Status: active local state-surface cleanup.

Current truth source:

- `docs/current/CURRENT_STATE.md`

Workspace:

- `A:\AGENTS_OS_Workspace\governance\codex-router`

Branch:

- `fix/codex-cli-policy-bypass-flags`

Current head before metadata refresh:

- `e574f95`

Upstream:

- `origin/fix/codex-cli-policy-bypass-flags`

Worktree at last board refresh:

- dirty only because the post-commit state metadata refresh is in progress

Current scope:

- local docs and audit surfaces only
- no real Codex CLI execution
- no provider execute
- no workspace-write execution
- no release, tag, deployment, or protected remote action

Validation baseline for `e574f95` before the post-commit metadata refresh:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `98 / 98`
- `npm run typecheck`: passed
- `npm test`: passed, `1074 / 1074`
- `npm run build`: passed

Next validation for this slice:

- `npx tsx --test tests\state-sync-audit.test.ts`
- `npm run audit:state-sync`
- `npm run typecheck`
- `npm test`
- `npm run build`
