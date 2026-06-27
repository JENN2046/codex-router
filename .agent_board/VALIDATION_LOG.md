# Validation Log

Current branch:

- `docs/state-sync-phase-4-main-push-ci`

Validated source commit:

- `cacd546`

Latest validated commit:

- `cacd546`

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

- expected after this state/docs record is pushed to the PR branch:
  `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS
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
  state-sync CI coverage
- no package, dependency, provider, env, secret, user config, or system config
  change is part of this state record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `docs/state-sync-phase-4-main-push-ci`
- upstream: `refs/remotes/origin/main`
- validated source commit: `cacd546`
- latest validated commit: `cacd546`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
