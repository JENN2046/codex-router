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

- `a5ecd0b`

Validated source commit:

- `a5ecd0b`

Latest validated commit:

- `a5ecd0b`

Upstream baseline:

- `origin/main`

Upstream divergence baseline:

- `ahead 13 / behind 0`

Transition:

- `state_only_pending_push`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 69 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1202 tests

State-sync audit expectation:

- after this state/docs commit, local audit should PASS with `claimSource:
  structured` and Git-computed divergence against verified `origin/main`

Boundary:

- no package, dependency, workflow, provider, env, secret, user config, or system
  config change is part of this state record
- no push is performed by this local record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution
