# Task Queue

## Done

- Refreshed `CURRENT_STATE.md` and `.agent_board` for the current branch.
- Split the runtime failure fix onto a separate local branch; this branch
  excludes those runtime files.
- Added `scripts/run-governance-check.ts` as the consolidated validation and
  governance check runner.
- Added recommended validation tiers: `validate:daily`, `validate:pr`, and
  `validate:release`.
- Removed legacy per-check package script aliases after moving dispatch into the
  consolidated `governance` runner.
- Migrated old package-script command references out of docs, tests, and
  `package.json`.
- Updated state-sync audit to require the consolidated `governance` package
  script.
- Added `docs/README.md` as the compact documentation map.
- Added `docs/governance/README.md` as the compact governance docs map.
- Reduced README's long historical document link chain.
- Compacted `docs/current/CURRENT_STATE.md` and `.agent_board` current
  surfaces.
- Validated document surface slimming with docs-level link search,
  `git diff --check`, state-sync targeted tests, and state-sync audit.
- Fixed PR review finding: governance runner now uses Windows command shims for
  `tsx` child commands.
- Validated the runner shim fix with targeted governance runner tests and
  `npm run validate:pr`.

## In Progress

- Commit PR2 and run committed-branch validation.

## Blocked

- General workspace-write or general provider execution remains blocked until a
  separate exact operator authorization and a new controlled execution gate are
  provided.
- Protected remote writes, release, tag, deployment, and secret changes remain
  blocked unless explicitly authorized in a future task.

## Remaining

- Run `npm run governance -- audit state-sync` after commit.
- Run `npm run validate:pr` after commit.
- Report split branch names, commits, validation, and remaining risk.
- Open a new PR only after explicit user direction.
