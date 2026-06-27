# Run State

Status: Phase 1 state-sync structured record work is in progress on
`docs/state-sync-structured-record-plan`.

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

- `docs/state-sync-structured-record-plan`

Current head:

- `0b373ff`

Validated source commit:

- `0b373ff`

Latest validated commit:

- `0b373ff`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 19 / behind 0`

Transition:

- `state_only_pending_push`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 75 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1208 tests

State-sync audit expectation:

- after this state/docs commit, local audit should PASS with `claimSource:
  structured` and Git-computed divergence against verified `refs/remotes/origin/main`
- bounded squash-only checkout contexts should PASS without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest

Boundary:

- no package, dependency, workflow, provider, env, secret, user config, or system
  config change is part of this state record
- no push is performed by this local record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution
