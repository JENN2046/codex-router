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

- `content-attestation`

Current head:

- `observed at audit time`

Validated source commit:

- `content digest only`

Latest validated commit:

- `content digest only`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `observed at audit time`

Transition:

- `content_attestation`

Recent display-only validation:

- `git diff --check`: PASS
- `node --import tsx scripts/sync-state-sync-display.ts --check`: PASS
- simulated PR state-sync audit: PASS

State-sync audit expectation:

- structured claim: `state-sync-policy.v2` content attestation
- upstream target: `refs/remotes/origin/main`
- source identity: filtered tree digest, not a recorded commit SHA
- branch, commit, and divergence are observed by the audit at runtime
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Source-tree digest, allowed context, clean worktree, and read-only
  checks remain enforced by the state-sync audit.
Current safety boundary:

- state-sync authority remains `docs/current/state-sync-record.json`
- display and handoff surfaces may be pruned without changing audit semantics
- package, dependency, workflow, runtime, provider, env, secret, user config, and
  system config changes are outside this pruning lane
- real provider execution and real Codex CLI execution are not part of this lane
- direct push to `main` requires separate explicit authorization

<!-- state-sync-display:start -->
Optional display generated from `docs/current/state-sync-record.json`.

- schema version: `2`
- policy version: `state-sync-policy.v2`
- branch: `content-attestation`
- upstream: `refs/remotes/origin/main`
- validated source commit: `content digest only`
- latest validated commit: `content digest only`
- recorded divergence baseline: `observed at audit time`
- transition: `content_attestation`
<!-- state-sync-display:end -->
