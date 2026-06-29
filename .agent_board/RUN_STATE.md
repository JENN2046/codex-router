# Run State

Status: Main state-sync record is current and pushed.

Machine-authoritative claim:

- `docs/current/state-sync-record.json`

Display and evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

Branch:

- `capability/runtime-governance-example-evidence`

Current head:

- `8d2008c`

Validated source commit:

- `8d2008c`

Latest validated commit:

- `8d2008c`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 3 / behind 0`

Transition:

- `state_only_pending_push`

Validation recorded for this source commit:

- `git diff --check`: PASS
- `npm run demo:runtime-governance`: PASS
- `node --import tsx --test tests/runtime-governance-demo.test.ts
  tests/host-client-example.test.ts tests/execution-observation.test.ts
  tests/desktop-live-adapter-governance.test.ts`: PASS
- `npm test`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node --import tsx scripts/sync-state-sync-display.ts --check`: PASS
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS

State-sync audit expectation:

- structured claim: `capability/runtime-governance-example-evidence` / `state_only_pending_push` against
  `refs/remotes/origin/main`
- validated source commit: `8d2008c`
- latest validated commit: `8d2008c`
- recorded divergence baseline: `ahead 3 / behind 0`
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Git ancestry, divergence, source-tree digest, and strict state path
  checks remain enforced by the state-sync audit.
Boundary:

- this state record commit intentionally changes only state/docs display and
  handoff surfaces
- no package, dependency, provider, env, secret, user config, or system config
  change is part of this state record
- no manual CI rerun
- no real provider execution
- no real Codex CLI execution

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `capability/runtime-governance-example-evidence`
- upstream: `refs/remotes/origin/main`
- validated source commit: `8d2008c`
- latest validated commit: `8d2008c`
- recorded divergence baseline: `ahead 3 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
