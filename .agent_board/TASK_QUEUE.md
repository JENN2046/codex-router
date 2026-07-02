# Task Queue

Current task:

- Prune current-task drift from state and handoff displays so they describe
  current repository governance status, not old implementation PRs.
Done:

- state-sync authority moved to `docs/current/state-sync-record.json`
- policy v2 content attestation is the main path for local, pull_request, and
  main-push audit
- Markdown and `.agent_board/*` are display/evidence surfaces; display sync is
  optional freshness tooling
- legacy v1 reanchor helpers, local runner, and manual PR workflow remain only
  as explicit compatibility fallback for old v1 state-only records
- prior post-merge reanchor events are complete history, not current operator
  steps
- runtime governance observation, recovery, and host-dispatch hardening are
  merged capabilities, not current task steps
- display sync heading replacement and execution-observation ref helpers are
  merged support capabilities, not current task steps
- legacy v1 direct reanchor safeguards are implemented and tested, but remain
  outside the normal operator task flow
- runtime-control signal derivation is a merged capability, not the active
  handoff goal

Validation completed:

- `git diff --check`: PASS
- `node --import tsx scripts/sync-state-sync-display.ts --check`: PASS
- simulated PR state-sync audit: PASS

Todo:

- keep future governance changes in focused PRs unless separately authorized

Blocked until separately authorized:

- direct pushes to `main` for source, workflow, dependency, runtime, provider,
  env, secret, user config, or system config changes
- dependency changes
- additional workflow edits beyond Phase 4 state-sync CI coverage
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
