# Run State

Status: governance validation surface slimming is split from the runtime fix;
PR #43 state metadata is being refreshed for the P1 review finding.

Current truth source:

- `docs/current/CURRENT_STATE.md`

Workspace:

- `A:\AGENTS_OS_Workspace\governance\codex-router`

Branch:

- `chore/governance-validation-surface-slimming`

Current head at latest local status refresh:

- `99f66db`

Upstream:

- `origin/chore/governance-validation-surface-slimming`

Worktree:

- clean at the latest PR #43 state refresh before this P1 metadata update

Current scope:

- local docs, tests, audit surfaces, and governance runner wiring
- no real Codex CLI execution
- no provider execute
- no workspace-write execution
- no release, tag, deployment, or protected remote action

Latest PR2 validation for this split:

- Absolute Windows docs-root link search across current docs surfaces: passed by
  no matches
- `git diff --check`: passed
- Legacy package-script alias reference search: passed by no matches
- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `104 / 104`
- `npm run validate:daily -- --test tests\governance-check.test.ts`: passed
  with `6 / 6`
- `npm test`: passed, `1107 / 1107`
- `npm run build`: passed
- `npm run governance -- list`: passed

Current local changes:

- `scripts/run-governance-check.ts` consolidates validation tiers and
  audit/acceptance/operator dispatch
- `scripts/run-governance-check.ts` resolves `npm` and `tsx` through Windows
  command shims on `win32`
- legacy per-check package script aliases were removed
- `packages/state-sync-audit` checks the consolidated `governance` package
  script
- `docs/README.md` and `docs/governance/README.md` now provide compact current
  doc maps
- `README.md` no longer carries the long historical governance link chain
- `docs/current/CURRENT_STATE.md` is compacted to current state, validation,
  execution boundary, and next action

Detailed validation history:

- `.agent_board/VALIDATION_LOG.md`
