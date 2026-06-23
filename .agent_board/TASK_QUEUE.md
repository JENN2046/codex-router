# Task Queue

Active:

- Commit the final state documentation update.
- Rerun post-commit status, state-sync, PR validation, and diff whitespace
  checks.
- Push only after explicit external-write confirmation.

Completed validation:

- review hardening targeted tests recorded in `.agent_board/VALIDATION_LOG.md`
- permit replay hardening targeted tests:
  `npx tsx --test tests/provider-core.test.ts tests/codex-cli-provider.test.ts tests/provider-execution-runner.test.ts`,
  `79 / 79`
- permit replay hardening `npm run typecheck`
- permit replay hardening final `npm run validate:pr`, including typecheck,
  full tests `1146 / 1146`, build, and state-sync
- PR #45 review follow-up targeted tests:
  `npx tsx --test tests/execution-planner.test.ts tests/provider-core.test.ts`,
  `41 / 41`
- PR #45 review follow-up `npm run typecheck`
- PR #45 review follow-up affected tests:
  `npx tsx --test tests/execution-planner.test.ts tests/provider-core.test.ts tests/provider-execution-runner.test.ts`,
  `66 / 66`
- PR #45 review follow-up pre-state-doc `git diff --check`
- PR #45 state-sync CI event-scope targeted test:
  `npx tsx --test tests/canary-evidence.test.ts`, `4 / 4`
- PR #45 state-sync CI event-scope `npm run typecheck`
- PR #45 state-sync CI event-scope pre-state-doc `git diff --check`

Boundaries:

- no real Codex CLI execution
- no workspace-write execution
- no merge, tag, release, deploy, push to `main`
- no secret changes
- default provider permit consumption remains single-process and in-memory;
  persistent replay coverage requires an injected durable consumption store
