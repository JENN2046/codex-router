# Run State

Status: Phase 4 state-sync CI coverage adjustment is ready for PR publication.

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

- `docs/state-sync-phase-4-main-push-ci`

Current head:

- `04ae358`

Validated source commit:

- `04ae358`

Latest validated commit:

- `04ae358`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 5 / behind 0`

Transition:

- `state_only_pending_push`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `node --import tsx --test tests/canary-evidence.test.ts`: PASS, 4 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit expectation:

- with this state/docs record committed, branch-head audit should PASS locally
  with `claimSource: structured` and Git-computed divergence against verified
  `refs/remotes/origin/main`
- after the PR branch is pushed, remote CI should validate the same checkout and
  upstream contexts
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

- branch: `docs/state-sync-phase-4-main-push-ci`
- upstream: `refs/remotes/origin/main`
- validated source commit: `04ae358`
- latest validated commit: `04ae358`
- recorded divergence baseline: `ahead 5 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
