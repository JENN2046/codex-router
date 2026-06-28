# Run State

Status: Strict state record path convergence is implemented locally and ready
for PR publication.

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

- `ef2a675`

Validated source commit:

- `ef2a675`

Latest validated commit:

- `ef2a675`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Transition:

- `state_only_pushed`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 79 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit expectation:

- with the state/docs record committed, branch-head audit should PASS with
  `claimSource: structured` and Git-computed divergence against verified
  `refs/remotes/origin/main`
- `state_only_pending_push` is expected while this focused branch is ahead of
  `origin/main`
- bounded squash-only checkout contexts should PASS without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest

Boundary:

- source changes intentionally update state-sync strict path policy, regression
  tests, and the structured record plan
- no package, dependency, provider, env, secret, user config, or system config
  change is part of this state record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `main`
- upstream: `refs/remotes/origin/main`
- validated source commit: `ef2a675`
- latest validated commit: `ef2a675`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pushed`
<!-- state-sync-display:end -->
