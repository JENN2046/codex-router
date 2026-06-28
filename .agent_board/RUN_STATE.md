# Run State

Status: Governance semantic PR state/docs reanchor is prepared.

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

- `fix/state-sync-evidence-drift-schema`

Current head:

- `b2d18d3`

Validated source commit:

- `b2d18d3`

Latest validated commit:

- `b2d18d3`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 10 / behind 0`

Transition:

- `state_only_pending_push`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 94 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit expectation:

- with this state/docs record committed and pushed, branch-head audit should PASS
  with `claimSource: structured` and Git-computed divergence against verified
  `refs/remotes/origin/main`
- `state_only_pending_push` is expected on this PR branch
- after squash merge, `main` should receive the normal `main` /
  `state_only_pushed` reanchor
- bounded squash-only checkout contexts should PASS without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest
- evidence drift blocking, empty/missing mirror-field blocking, structured
  display mirror blocking, per-file agent-board generated block checks, and
  unknown structured claim field fail-closed behavior are implemented and
  covered by regression tests

Boundary:

- this commit intentionally changes only state/docs display and handoff surfaces
- no package, dependency, provider, env, secret, user config, or system config
  change is part of this state record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `fix/state-sync-evidence-drift-schema`
- upstream: `refs/remotes/origin/main`
- validated source commit: `b2d18d3`
- latest validated commit: `b2d18d3`
- recorded divergence baseline: `ahead 10 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
