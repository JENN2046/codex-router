# Validation Log

Current branch:

- `fix/state-sync-evidence-drift-schema`

Validated source commit:

- `c612787`

Latest validated commit:

- `c612787`

Structured claim:

- `docs/current/state-sync-record.json`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 8 / behind 0`

Recorded validation:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 92 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync audit observation:

- with the state/docs record committed,
  `node --import tsx scripts/run-state-sync-audit.ts --json` should PASS
- `state_only_pending_push` is expected on this PR branch
- after squash merge, `main` should receive the normal `main` /
  `state_only_pushed` reanchor
- expected `claimSource`: `structured`
- expected upstream observation: verified local Git ref `refs/remotes/origin/main`
- expected upstream ref boundary: only `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs may be claim-selected
- expected checkout compatibility: bounded detached branch-head and PR merge-ref
  contexts pass only when all non-branch transition checks still pass
- expected squash compatibility: bounded squash-only state records pass without
  the side-branch source commit object only when live `HEAD` has the recorded
  filtered source tree digest
- expected evidence drift behavior: machine-mirrored Markdown and
  `.agent_board/*` conflicts block through `state_sync_evidenceDriftAbsent`
- expected mirror-field behavior: empty or missing machine-mirrored Markdown
  fields block unless the structured claim itself expects an empty value
- expected agent-board mirror behavior: stale or missing generated mirror blocks
  and supported heading mirrors block as evidence drift
- expected schema behavior: unknown structured claim fields fail closed

Execution boundary:

- this commit intentionally changes only state/docs display and handoff surfaces
- no package, dependency, provider, env, secret, user config, or system config
  change is part of this state record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `fix/state-sync-evidence-drift-schema`
- upstream: `refs/remotes/origin/main`
- validated source commit: `c612787`
- latest validated commit: `c612787`
- recorded divergence baseline: `ahead 8 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
