# Run State

Status: Conservative post-merge state-sync reanchor PR automation is recorded
for branch validation.

Machine-authoritative claim:

- `docs/current/state-sync-record.json`

Display and evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

Branch:

- `automate/state-sync-reanchor-pr`

Current head:

- `86de435`

Validated source commit:

- `86de435`

Latest validated commit:

- `86de435`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 13 / behind 0`

Transition:

- `state_only_pending_push`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 98 tests
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 4
  tests
- `node --import tsx --test tests/state-sync-reanchor-helper.test.ts`: PASS, 7
  tests
- `node --import tsx --test tests/state-sync-reanchor-automation.test.ts`: PASS,
  8 tests
- `node --import tsx --test tests/canary-evidence.test.ts`: PASS, 5 tests
- `npm test`: PASS, 1251 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit expectation:

- branch-head audit is expected to PASS with `claimSource: structured` and
  Git-computed divergence against verified `refs/remotes/origin/main`
- `state_only_pending_push` is expected for this implementation branch state
  record
- bounded squash-only checkout contexts should PASS without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest
- reanchor helper squash fallback must verify `HEAD` against the recorded
  filtered source tree digest before inferring it as source
- fixed-branch `state-sync/reanchor-main` candidate PR checkouts are accepted
  only for a single state-only commit carrying a `main/state_only_pushed` claim
- the reanchor workflow fetches the fixed remote PR branch before push and binds
  `--force-with-lease` to an explicit expected SHA or empty create-only
  expectation
- generated reanchor PR bodies state that `GITHUB_TOKEN`-created or updated PR
  workflow runs may require write-permission approval before CI proceeds
- `## State Sync Expectations` divergence prose is generated from the
  structured transition instead of retaining stale pushed-main wording
- evidence drift blocking, empty/missing mirror-field blocking, structured
  display mirror blocking, State Sync Expectations mirror blocking, per-file
  agent-board generated block checks, and unknown structured claim field
  fail-closed behavior are implemented and covered by regression tests

Boundary:

- this state record commit intentionally changes only state/docs display and
  handoff surfaces
- no package, dependency, provider, env, secret, user config, or system config
  change is part of this state record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `automate/state-sync-reanchor-pr`
- upstream: `refs/remotes/origin/main`
- validated source commit: `86de435`
- latest validated commit: `86de435`
- recorded divergence baseline: `ahead 13 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
