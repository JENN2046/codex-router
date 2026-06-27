# Validation Log

Current branch:

- `docs/state-sync-structured-record-plan`

Validated source commit:

- `a5ecd0b`

Latest validated commit:

- `a5ecd0b`

Structured claim:

- `docs/current/state-sync-record.json`

Upstream baseline:

- `origin/main`

Upstream divergence baseline:

- `ahead 13 / behind 0`

Recorded validation:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 69 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1202 tests

State-sync audit observation:

- expected after this state/docs commit:
  `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS
- expected `claimSource`: `structured`
- expected upstream observation: verified local Git ref `origin/main`
- expected upstream ref boundary: only `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs may be claim-selected
- expected checkout compatibility: bounded detached branch-head and PR merge-ref
  contexts pass only when all non-branch transition checks still pass

Execution boundary:

- no package, dependency, workflow, provider, env, secret, user config, or system
  config change is part of this state record
- no push yet
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution
