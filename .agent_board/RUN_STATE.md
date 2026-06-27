# Run State

Status: Main reanchor is in progress after PR #48 squash merge.

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

- `d913f09`

Validated source commit:

- `d913f09`

Latest validated commit:

- `d913f09`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Transition:

- `state_only_pushed`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 75 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1208 tests

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
