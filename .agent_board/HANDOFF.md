# Handoff

Goal:

- Continue implementing the state-sync structured record plan so
  `docs/current/state-sync-record.json` becomes the machine-authoritative claim
  while Markdown and `.agent_board/*` become display/evidence surfaces.

Current branch:

- `docs/state-sync-phase-2-missing-claim-gate`

Current validated source:

- `9e5afe9`

Current structured claim:

- `docs/current/state-sync-record.json`

Current transition:

- `state_only_pending_push`

Upstream baseline:

- `refs/remotes/origin/main`

Recorded divergence baseline:

- `ahead 1 / behind 0`

Completed:

- final plan document committed
- Phase 1 structured claim parser and resolver implemented
- Phase 2 missing structured claim gate implemented
- Phase 3 display-sync script implemented
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
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 77 tests
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 3
  tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1213 tests

State-sync expectation:

- after this state/docs record is pushed to the PR branch, branch-head
  state-sync audit should PASS by resolving `refs/remotes/origin/main` as the
  structured claim upstream ref and computing divergence from Git

Not authorized:

- direct pushes to `main`
- workflow edits
- dependency changes
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `docs/state-sync-phase-2-missing-claim-gate`
- upstream: `refs/remotes/origin/main`
- validated source commit: `9e5afe9`
- latest validated commit: `9e5afe9`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
