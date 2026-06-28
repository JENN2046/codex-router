# Validation Log

Current branch:

- `main`

Validated source commit:

- `ef2a675`

Latest validated commit:

- `ef2a675`

Structured claim:

- `docs/current/state-sync-record.json`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Recorded validation:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 79 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit observation:

- with the state/docs record committed,
  `node --import tsx scripts/run-state-sync-audit.ts --json` should PASS
- `state_only_pending_push` is expected while this focused branch is ahead of
  `origin/main`
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
