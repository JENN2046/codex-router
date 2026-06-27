# Validation Log

Current branch:

- `docs/state-sync-phase-2-missing-claim-gate`

Validated source commit:

- `9e5afe9`

Latest validated commit:

- `9e5afe9`

Structured claim:

- `docs/current/state-sync-record.json`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Recorded validation:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 77 tests
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 3
  tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1213 tests

State-sync audit observation:

- expected after this state/docs record is committed and pushed to the PR branch:
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

- no package, dependency, workflow, provider, env, secret, user config, or system
  config change is part of this state record
- no direct `main` push is part of this record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `docs/state-sync-phase-2-missing-claim-gate`
- upstream: `refs/remotes/origin/main`
- validated source commit: `9e5afe9`
- latest validated commit: `9e5afe9`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
