# Validation Log

Current branch:

- `feature/pr-22a-controlled-provider-execution`

Baseline:

- `4a39eac`

Pre-branch validation:

- `git pull --ff-only origin main`: passed, already up to date.
- `npm run governance -- audit readonly-productization`: passed on `main`;
  branch `main`, ahead `0`, behind `0`, evidence files `10/10`, evidence
  schema/status `10/10`, governance docs `2/2`, readiness matrix `passed`,
  missing items `0`, provider execute calls `0`, real CLI calls `0`,
  workspace-write calls `0`, evidence writes `0`.

PR-22A review validation before implementation:

- `npm run governance -- audit controlled-provider-execution-taskbook-review`:
  passed on `feature/pr-22a-controlled-provider-execution`.
- `npm run governance -- audit state-sync`: passed on
  `feature/pr-22a-controlled-provider-execution`.

PR-22A minimal controlled read-only provider execution validation before the
post-review failure-surface fix:

- `npm run validate:pr`: passed; included `npm run typecheck`, `npm test`
  passed `1123 / 1123`, `npm run build`, and final
  `npm run governance -- audit state-sync`.
- `npm run typecheck`: passed.
- `npx tsx --test tests/provider-execution-runner.test.ts`: passed, `17 / 17`.
- `npx tsx --test tests/codex-cli-provider.test.ts`: passed, `29 / 29`.
- `npm run governance -- acceptance controlled-readonly-provider-execution`:
  passed; fake spawner calls `1`, real Codex CLI calls `0`,
  workspace-write execute calls `0`, external write calls `0`, sanitized
  evidence `true`.
- `npx tsx --test tests/codex-cli-host.test.ts`: passed, `104 / 104`.
- `npm run build`: passed.
- `npm test`: first run exposed state-sync test assumptions around the local
  no-upstream `ahead -1 / behind -1` sentinel; after the targeted helper fix,
  the final full run passed, `1123 / 1123`.
- `npx tsx --test tests/state-sync-audit.test.ts`: passed, `16 / 16`.

Post-review failure-surface fix validation:

- `npx tsx --test tests/provider-execution-runner.test.ts`: passed, `19 / 19`.
- `npm run typecheck`: passed.
- Pre-state-refresh `npm run validate:pr`: typecheck passed, full `npm test`
  passed `1125 / 1125`, and `npm run build` passed; final state-sync blocked
  because current-state records still described the pre-push upstream state.
- Final clean-worktree `npm run validate:pr`: passed on `4a39eac`; included
  `npm run typecheck`, full `npm test` passed `1125 / 1125`,
  `npm run build`, and final state-sync passed with git status entries `0`,
  state writes `0`, and remote writes `0`.
