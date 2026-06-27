# Validation Log

Current branch:

- `main`

Validated source commit:

- `959e173`

Latest validated commit:

- `959e173`

Structured claim:

- `docs/current/state-sync-record.json`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Recorded validation:

- `git diff --check`: PASS
- `node --import tsx --test tests/canary-evidence.test.ts`: PASS, 4 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit observation:

- after this state/docs record is pushed to `main`:
  `node --import tsx scripts/run-state-sync-audit.ts --json` should PASS
- before that push, local audit may block because `state_only_pushed` requires
  `HEAD...refs/remotes/origin/main` to be aligned
- main-push CI should validate the same checkout and upstream contexts after the
  reanchor push lands
- expected `claimSource`: `structured`
- expected upstream observation: verified local Git ref `refs/remotes/origin/main`
- expected upstream ref boundary: only `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs may be claim-selected
- expected checkout compatibility: bounded detached branch-head and PR merge-ref
  contexts pass only when all non-branch transition checks still pass
- expected squash compatibility: bounded squash-only state records pass without
  the side-branch source commit object only when live `HEAD` has the recorded
  filtered source tree digest

Execution boundary:

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

- branch: `main`
- upstream: `refs/remotes/origin/main`
- validated source commit: `959e173`
- latest validated commit: `959e173`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pushed`
<!-- state-sync-display:end -->
