# Validation Log

Current branch:

- `fix/runtime-governance-evidence-refs`

Validated source commit:

- `745c1ac`

Latest validated commit:

- `745c1ac`

Structured claim:

- `docs/current/state-sync-record.json`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

Recorded validation:

- `git diff --check`: PASS
- `node --import tsx --test tests/codex-cli-host.test.ts
  tests/desktop-live-adapter-governance.test.ts tests/desktop-live-adapter.test.ts
  tests/host-dispatcher.test.ts tests/governance-failure-reducer.test.ts`: PASS
- `node --import tsx --test tests/state-sync-display-sync.test.ts
  tests/state-sync-audit.test.ts`: PASS
- `npm test`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node --import tsx scripts/sync-state-sync-display.ts --check`: PASS
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS

State-sync audit observation:

- structured claim: `fix/runtime-governance-evidence-refs` / `state_only_pending_push` against
  `refs/remotes/origin/main`
- validated source commit: `745c1ac`
- latest validated commit: `745c1ac`
- recorded divergence baseline: `ahead 1 / behind 0`
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Git ancestry, divergence, source-tree digest, and strict state path
  checks remain enforced by the state-sync audit.
Execution boundary:

- this commit intentionally changes only state/docs display and handoff surfaces
- no package, dependency, provider, env, secret, user config, or system config
  change is part of this state record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `fix/runtime-governance-evidence-refs`
- upstream: `refs/remotes/origin/main`
- validated source commit: `745c1ac`
- latest validated commit: `745c1ac`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
