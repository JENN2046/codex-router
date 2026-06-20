# Handoff

PR2 scope: reduce meta-governance weight, remove old per-check aliases, align
state-sync with the consolidated runner, and slim the document governance
surface.

Current status:

- Branch: `chore/governance-validation-surface-slimming`
- Current head at this metadata refresh: `8480a6f`
- Upstream: `origin/chore/governance-validation-surface-slimming`
- Current state source: `docs/current/CURRENT_STATE.md`
- Work in progress: address PR #43 P1 state metadata refresh

What changed in this PR2 scope:

- Added `scripts/run-governance-check.ts` as the consolidated validation and
  governance check runner.
- Removed legacy per-check package script aliases from `package.json`.
- Migrated old package-script command references to `npm run governance -- ...`.
- Updated state-sync audit to require the consolidated `governance` package
  script.
- Added `docs/README.md` as the current documentation map.
- Added `docs/governance/README.md` as the compact governance evidence map.
- Reduced README's long historical document chain to a short current docs list.
- Compacted `docs/current/CURRENT_STATE.md` to current facts and boundaries.
- Compacted `.agent_board` current surfaces; detailed historical validation
  remains in `.agent_board/VALIDATION_LOG.md`.
- Preserved low risk canary evidence by writing per-risk canary latest
  files before updating the legacy latest alias.

Latest recorded PR #43 validation before this P1 refresh:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `104 / 104`
- `npx tsx --test tests\canary-evidence.test.ts tests\governance-check.test.ts`:
  passed, `8 / 8`
- `npm run typecheck`: passed
- `npm test`: passed, `1109 / 1109`
- `npm run build`: passed
- `git diff --check`: passed
- `npm run governance -- audit state-sync`: passed
- `npm run validate:pr`: passed

Hard boundaries:

- Do not treat the recorded bounded workspace-write canary as general
  workspace-write permission.
- Do not run general provider execution.
- Do not push to `main`, release, tag, deploy, or write to external services
  without a separate explicit instruction.
- Do not modify secrets or env files.

Next safe action:

1. commit the PR #43 P1 state refresh
2. run `npm run governance -- audit state-sync`
3. run `npm run validate:pr`
4. push `chore/governance-validation-surface-slimming`
