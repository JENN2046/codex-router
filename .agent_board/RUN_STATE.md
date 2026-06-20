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

- `8480a6f`

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

Latest PR #43 validation for this split:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `104 / 104`
- `npx tsx --test tests\canary-evidence.test.ts tests\governance-check.test.ts`:
  passed, `8 / 8`
- `npm run typecheck`: passed
- `npm test`: passed, `1109 / 1109`
- `npm run build`: passed
- `git diff --check`: passed
- `npm run governance -- audit state-sync`: passed
- `npm run validate:pr`: passed

Current local changes:

- `scripts/run-governance-check.ts` consolidates validation tiers and
  audit/acceptance/operator dispatch
- `scripts/run-governance-check.ts` resolves `npm` and `tsx` through Windows
  command shims on `win32`
- `scripts/run-canary-test.ts` preserves low risk canary evidence by writing
  per-risk latest files before updating the legacy latest alias
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
