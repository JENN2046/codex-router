# Handoff

PR2 scope: reduce meta-governance weight, remove old per-check aliases, align
state-sync with the consolidated runner, and slim the document governance
surface.

Current status:

- Branch: `chore/governance-validation-surface-slimming`
- Current head at this metadata refresh: `dcb7b2d`
- Upstream: `origin/main`
- Current state source: `docs/current/CURRENT_STATE.md`
- Work in progress: prepare local PR2 commit after branch split

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

Latest PR2 validation before commit:

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

Hard boundaries:

- Do not treat the recorded bounded workspace-write canary as general
  workspace-write permission.
- Do not run general provider execution.
- Do not push to `main`, release, tag, deploy, or write to external services
  without a separate explicit instruction.
- Do not modify secrets or env files.

Next safe action:

1. commit the local PR2 branch
2. run `npm run governance -- audit state-sync`
3. run `npm run validate:pr`
4. open a new PR only after explicit user direction
