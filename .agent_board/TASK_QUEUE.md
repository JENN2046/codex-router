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

Boundaries:

- no real Codex CLI execution
- no workspace-write execution
- no external writes
- no secret changes
- default provider permit consumption remains single-process and in-memory;
  persistent replay coverage requires an injected durable consumption store
