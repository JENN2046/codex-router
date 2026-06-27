# Run State

Status: Main reanchor is in local validation after PR #49 squash merge.

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

- `59b9eba`

Validated source commit:

- `59b9eba`

Latest validated commit:

- `59b9eba`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Transition:

- `state_only_pushed`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 77 tests
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 3
  tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1213 tests

State-sync audit expectation:

- after this state/docs record is pushed to `main`, branch-head audit should
  PASS with `claimSource: structured` and Git-computed divergence against
  verified `refs/remotes/origin/main`
- bounded squash-only checkout contexts should PASS without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest

Boundary:

- no package, dependency, workflow, provider, env, secret, user config, or system
  config change is part of this state record
- direct `main` reanchor push is authorized for this state record only
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `main`
- upstream: `refs/remotes/origin/main`
- validated source commit: `59b9eba`
- latest validated commit: `59b9eba`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pushed`
<!-- state-sync-display:end -->
