# Validation Log

Current branch:

- `docs/state-sync-structured-record-plan`

Validated source commit:

- `450efa9`

Latest validated commit:

- `450efa9`

Structured claim:

- `docs/current/state-sync-record.json`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 17 / behind 0`

Recorded validation:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 74 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1207 tests

State-sync audit observation:

- expected after this state/docs commit:
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
- no push yet
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution
