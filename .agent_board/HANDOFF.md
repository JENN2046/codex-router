# Handoff

Goal:

- Continue implementing the state-sync structured record plan so
  `docs/current/state-sync-record.json` becomes the machine-authoritative claim
  while Markdown and `.agent_board/*` become display/evidence surfaces.

Current branch:

- `main`

Current validated source:

- `959e173`

Current structured claim:

- `docs/current/state-sync-record.json`

Current transition:

- `state_only_pushed`

Upstream baseline:

- `refs/remotes/origin/main`

Recorded divergence baseline:

- `ahead 2 / behind 0`

Completed:

- final plan document committed
- Phase 1 structured claim parser and resolver implemented
- Phase 2 missing structured claim gate implemented
- Phase 3 display-sync script implemented
- Phase 4 state-sync CI push-to-main coverage landed on `main` through the
  PR #50 squash merge, with main-push audit gated on a committed `main` /
  `state_only_pushed` record
- collector reads `docs/current/state-sync-record.json`
- collector uses the structured claim upstream ref as the bounded baseline even
  when local feature-branch tracking exists, then computes divergence from Git
- collector rejects structured claim upstream refs outside `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs
- bounded detached branch-head and PR merge-ref checkout contexts pass only when
  upstream, ancestry, divergence, and state-only path checks still pass
- bounded squash-only checkout contexts pass without the side-branch source
  commit object only when live `HEAD` has the recorded filtered source tree
  digest
- invalid structured claim does not fall back to Markdown
- evidence drift issues are emitted for Markdown / claim conflicts
- transition formulas are enforced for structured claims
- strict state-only path set includes `docs/current/state-sync-record.json`

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/canary-evidence.test.ts`: PASS, 4 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync expectation:

- the PR #50 post-squash main reanchor passed local branch-head audit and remote
  main-push CI
- a new local unpushed `state_only_pushed` record may block until it is pushed,
  because `state_only_pushed` requires `HEAD...refs/remotes/origin/main` to be
  aligned
- once pushed, branch-head audit should PASS by resolving
  `refs/remotes/origin/main` as the structured claim upstream ref and computing
  divergence from Git

Not authorized:

- direct pushes to `main` beyond explicitly authorized state/docs cleanup
- additional workflow edits beyond Phase 4 state-sync CI coverage
- dependency changes
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `main`
- upstream: `refs/remotes/origin/main`
- validated source commit: `959e173`
- latest validated commit: `959e173`
- recorded divergence baseline: `ahead 2 / behind 0`
- transition: `state_only_pushed`
<!-- state-sync-display:end -->
