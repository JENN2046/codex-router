# Task Queue

Active:

- Commit the PR-22A minimal controlled read-only provider execution slice.
- Rerun clean-worktree state sync and taskbook review audits if preparing a PR.

Completed validation:

- `npm run governance -- audit controlled-provider-execution-taskbook-review`
- `npm run typecheck`
- `npx tsx --test tests/provider-execution-runner.test.ts`
- `npx tsx --test tests/codex-cli-provider.test.ts`
- `npx tsx --test tests/codex-cli-host.test.ts`
- `npm run governance -- acceptance controlled-readonly-provider-execution`
- `npx tsx --test tests/state-sync-audit.test.ts`
- `npm test`
- `npm run build`

Boundaries:

- no real Codex CLI execution
- no workspace-write execution
- no external writes
- no secret changes
