# Run State

Status: Post-PR #54 main state/docs reanchor is prepared for direct push.

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

- `c9c3e3f`

Validated source commit:

- `c9c3e3f`

Latest validated commit:

- `c9c3e3f`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Transition:

- `state_only_pushed`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 95 tests
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 3
  tests
- `node --import tsx --test tests/state-sync-reanchor-helper.test.ts`: PASS, 7
  tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit expectation:

- branch-head audit is expected to PASS with `claimSource: structured` and
  Git-computed divergence against verified `refs/remotes/origin/main`
- `state_only_pushed` is expected for this post-PR #54 `main` reanchor
- bounded squash-only checkout contexts should PASS without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest
- reanchor helper squash fallback must verify `HEAD` against the recorded
  filtered source tree digest before inferring it as source
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

- branch: `main`
- upstream: `refs/remotes/origin/main`
- validated source commit: `c9c3e3f`
- latest validated commit: `c9c3e3f`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pushed`
<!-- state-sync-display:end -->
