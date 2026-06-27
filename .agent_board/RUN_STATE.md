# Run State

Status: Authorized post-PR #50 squash `main` state/docs reanchor is in progress.

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

- `main`

Current head:

- `959e173`

Validated source commit:

- `959e173`

Latest validated commit:

- `959e173`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Transition:

- `state_only_pushed`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/canary-evidence.test.ts`: PASS, 4 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit expectation:

- after this state/docs record is pushed to `main`, branch-head audit should
  PASS with `claimSource: structured` and Git-computed divergence against
  verified `refs/remotes/origin/main`
- before that push, local audit may block because `state_only_pushed` requires
  `HEAD...refs/remotes/origin/main` to be aligned
- main-push CI should validate the same checkout and upstream contexts after the
  reanchor push lands
- bounded squash-only checkout contexts should PASS without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest

Boundary:

- source changes intentionally update `.github/workflows/ci.yml` for Phase 4
  state-sync CI coverage and gate main-push audit on a committed
  `main` / `state_only_pushed` record
- no package, dependency, provider, env, secret, user config, or system config
  change is part of this state record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `main`
- upstream: `refs/remotes/origin/main`
- validated source commit: `959e173`
- latest validated commit: `959e173`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pushed`
<!-- state-sync-display:end -->
