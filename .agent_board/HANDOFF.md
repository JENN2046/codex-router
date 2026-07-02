# Handoff

Goal:

- Keep the repository handoff surfaces aligned with current governance status:
  policy v2 state-sync is the main authority path, `.agent_board/*` is display
  evidence, and old implementation PRs are not current tasks.

Current branch:

- `content-attestation`

Current validated source:

- `content digest only`

Current structured claim:

- `docs/current/state-sync-record.json`

Current transition:

- `content_attestation`

Upstream baseline:

- `refs/remotes/origin/main`

Recorded divergence baseline:

- `observed at audit time`

Current governance status:

- `docs/current/state-sync-record.json` is the machine-authoritative state-sync
  claim.
- Policy v2 content attestation is the main path for local, pull_request, and
  main-push audit.
- Markdown and `.agent_board/*` are evidence/display surfaces. They should stay
  concise and should not reintroduce old PRs as active work.
- Legacy v1 reanchor helper scripts, local runner, and manual PR workflow remain
  available only as explicit compatibility fallback for old v1 state-only
  records.
- Runtime governance hardening, execution-observation refs, recovery operator
  actions, and runtime-control signal derivation are merged capabilities, not
  current handoff tasks.

Recent display-only validation:

- `git diff --check`: PASS
- `node --import tsx scripts/sync-state-sync-display.ts --check`: PASS
- simulated PR state-sync audit: PASS

State-sync status:

- structured claim: `state-sync-policy.v2` content attestation
- upstream target: `refs/remotes/origin/main`
- source identity: filtered tree digest, not a recorded commit SHA
- branch, commit, and divergence are observed by the audit at runtime
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Source-tree digest, allowed context, clean worktree, and read-only
  checks remain enforced by the state-sync audit.
Not authorized:

- direct pushes to `main` for source, workflow, dependency, runtime, provider,
  env, secret, user config, or system config changes
- additional workflow edits beyond Phase 4 state-sync CI coverage
- dependency changes
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits

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
