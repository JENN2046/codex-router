# Validation Log

Current branch:

- `docs/state-sync-structured-record-plan`

Validated source commit:

- `4af16d8`

Latest validated commit:

- `4af16d8`

Structured claim:

- `docs/current/state-sync-record.json`

Upstream baseline:

- `origin/main`

Upstream divergence baseline:

- `ahead 15 / behind 0`

Recorded validation:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 71 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1204 tests

State-sync audit observation:

- expected after this state/docs commit:
  `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS
- expected `claimSource`: `structured`
- expected upstream observation: verified local Git ref `origin/main`
- expected upstream ref boundary: only `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs may be claim-selected
- expected checkout compatibility: bounded detached branch-head and PR merge-ref
  contexts pass only when all non-branch transition checks still pass
- expected squash compatibility: bounded squash-equivalent state records pass
  only when the tree diff from the validated source commit to live `HEAD`
  contains strict state record paths only

Execution boundary:

- no package, dependency, workflow, provider, env, secret, user config, or system
  config change is part of this state record
- no push yet
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution
