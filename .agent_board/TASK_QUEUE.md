# Task Queue

Active:

- Commit the refreshed PR-22A current-state validation record.
- Rerun clean-worktree `npm run validate:pr`.
- Push the branch only after explicit external-write confirmation.

Completed validation:

- `npm run governance -- audit controlled-provider-execution-taskbook-review`
- `npm run validate:pr`
- `npm run typecheck`
- `npx tsx --test tests/provider-execution-runner.test.ts`
- `npx tsx --test tests/codex-cli-provider.test.ts`
- `npx tsx --test tests/codex-cli-host.test.ts`
- `npm run governance -- acceptance controlled-readonly-provider-execution`
- `npx tsx --test tests/state-sync-audit.test.ts`
- `npm test`
- `npm run build`
- post-review targeted provider-runner regression test, `19 / 19`
- post-review pre-state-refresh PR validation through typecheck, full tests,
  and build

Boundaries:

- no real Codex CLI execution
- no workspace-write execution
- no external writes
- no secret changes
