# Run State

Status: Phase 2 and Phase 3 state-sync structured record work is in local
validation before PR publication.

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

- `docs/state-sync-phase-2-missing-claim-gate`

Current head:

- `9e5afe9`

Validated source commit:

- `9e5afe9`

Latest validated commit:

- `9e5afe9`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Transition:

- `state_only_pending_push`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 77 tests
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 3
  tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1213 tests

State-sync audit expectation:

- after this state/docs record is committed and pushed to the PR branch,
  branch-head audit should PASS with `claimSource: structured` and Git-computed
  divergence against verified `refs/remotes/origin/main`
- bounded squash-only checkout contexts should PASS without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest

Boundary:

- no package, dependency, workflow, provider, env, secret, user config, or system
  config change is part of this state record
- no direct `main` push is part of this record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `docs/state-sync-phase-2-missing-claim-gate`
- upstream: `refs/remotes/origin/main`
- validated source commit: `9e5afe9`
- latest validated commit: `9e5afe9`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
