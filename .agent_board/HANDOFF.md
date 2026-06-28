# Handoff

Goal:

- Continue implementing the state-sync structured record plan so
  `docs/current/state-sync-record.json` becomes the machine-authoritative claim
  while Markdown and `.agent_board/*` become display/evidence surfaces.

Current branch:

- `fix/state-sync-evidence-drift-schema`

Current validated source:

- `c612787`

Current structured claim:

- `docs/current/state-sync-record.json`

Current transition:

- `state_only_pending_push`

Upstream baseline:

- `refs/remotes/origin/main`

Recorded divergence baseline:

- `ahead 8 / behind 0`

Completed:

- final plan document committed
- Phase 1 structured claim parser and resolver implemented
- Phase 2 missing structured claim gate implemented
- Phase 3 display-sync script implemented
- Phase 4 state-sync CI push-to-main coverage landed on `main` through the
  PR #50 squash merge, with main-push audit gated on a committed `main` /
  `state_only_pushed` record
- PR #51 strict state record path convergence was squash-merged into `main`
- post-PR #51 `main` state/docs reanchor was pushed and passed state-sync audit
  and main-push CI
- PR #52 state/docs cleanup was squash-merged into `main`
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
- machine-mirrored Markdown and `.agent_board/*` evidence drift blocks through
  `state_sync_evidenceDriftAbsent`
- empty or missing machine-mirrored Markdown fields block as evidence drift
  unless the structured claim itself expects an empty value
- stale or missing `.agent_board/*` generated mirror blocks and supported
  heading mirrors block as evidence drift
- unknown structured claim fields fail closed in schema v1
- transition formulas are enforced for structured claims
- strict state-only path set includes `docs/current/state-sync-record.json`

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 92 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync expectation:

- with this branch state/docs record committed and pushed, branch-head audit
  should PASS by resolving `refs/remotes/origin/main` as the structured claim
  upstream ref and computing divergence from Git
- `state_only_pending_push` is expected on this PR branch
- after squash merge, `main` should receive the normal `main` /
  `state_only_pushed` reanchor

Not authorized:

- direct pushes to `main`
- additional workflow edits beyond Phase 4 state-sync CI coverage
- dependency changes
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `fix/state-sync-evidence-drift-schema`
- upstream: `refs/remotes/origin/main`
- validated source commit: `c612787`
- latest validated commit: `c612787`
- recorded divergence baseline: `ahead 8 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
