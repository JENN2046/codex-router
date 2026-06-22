# Task Queue

Active:

- Commit the P1 validation payload state refresh.
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
- final clean-worktree `npm run validate:pr`, including typecheck, full tests
  `1125 / 1125`, build, and state-sync
- P1 validation payload targeted provider-runner regression test, `21 / 21`
- P1 validation payload `npm run typecheck`

Boundaries:

- no real Codex CLI execution
- no workspace-write execution
- no external writes
- no secret changes
