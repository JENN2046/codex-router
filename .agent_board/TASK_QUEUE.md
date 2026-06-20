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
- Fixed PR review finding: low risk canary evidence is preserved across
  sequential release validation canaries.
- Refreshed `CURRENT_STATE.md` and `.agent_board` commit facts to the current
  PR #43 branch baseline.

## In Progress

- Commit the PR #43 P1 state metadata refresh and run synced-branch validation.

## Blocked

- General workspace-write or general provider execution remains blocked until a
  separate exact operator authorization and a new controlled execution gate are
  provided.
- Protected remote writes, release, tag, deployment, and secret changes remain
  blocked unless explicitly authorized in a future task.

## Remaining

- Run `npm run governance -- audit state-sync` after the P1 refresh commit is synced.
- Run `npm run validate:pr` after the P1 refresh commit is synced.
- Report PR #43 branch, commit, validation, and remaining risk.
- Do not open or retarget another PR in this slice.
