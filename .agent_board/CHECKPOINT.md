# Checkpoint

## Current Stage

Validation tier simplification, legacy alias cleanup, state-sync script
alignment, and document governance surface slimming are implemented on branch
`chore/governance-validation-surface-slimming` after PR branch commit `8480a6f`.

The current operational state should be read from:

- `docs/current/CURRENT_STATE.md`

## Completed In This Slice

- Added the consolidated `governance` runner and validation tier entrypoints.
- Removed legacy per-check package script aliases.
- Migrated old package-script command references out of docs, tests, scripts,
  and `package.json`.
- Updated `packages/state-sync-audit` to require the consolidated `governance`
  package script.
- Added `docs/README.md` and `docs/governance/README.md` as compact document
  entrypoints.
- Reduced README's historical document link chain.
- Compacted current state and agent-board surfaces; detailed validation history
  remains in `.agent_board/VALIDATION_LOG.md`.
- Fixed the governance runner to use Windows command shims for both `npm` and
  `tsx` child commands.
- Fixed canary evidence writes so low risk and medium risk canary results are
  preserved separately during release validation before the legacy latest alias
  is updated.

## Latest Validated Baseline

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `104 / 104`.
- `npx tsx --test tests\canary-evidence.test.ts tests\governance-check.test.ts`:
  passed, `8 / 8`.
- `npm run typecheck`: passed.
- `npm test`: passed, `1109 / 1109`.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run governance -- audit state-sync`: passed.
- `npm run validate:pr`: passed.

## Remaining Risk

- This branch is local and not reviewed in CI.
- The state-sync audit is a local read-only audit. It does not authorize real
  execution, provider work, workspace-write, or remote actions.
- No push, release, tag, deployment, external write, or secret change is
  authorized by this state refresh.
