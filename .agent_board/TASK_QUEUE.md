# Task Queue

Current task:

- Keep policy v2 state-sync content attestation as the main path; no
  post-merge reanchor is pending. Legacy v1 reanchor automation remains
  compatibility fallback only.
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
- routed `codex-cli` host-dispatch failures through the shared runtime
  governance failure reducer when a governance state is supplied
- added regression coverage for host-dispatch observation emission,
  `onGovernanceUpdate`, recovery routing, and successful dispatch no-op behavior
- normalized opaque Codex CLI spawn and host-dispatch errors to
  `unknown_execution_error` before governance error class construction
- hardened display sync heading replacement for `## State Sync Expectations`
- added canonical execution-observation evidence ref helpers
- made `desktop-live-adapter` use the shared ref helper for runtime governance
  failure evidence
- added regression coverage for resolving recovery packet `rawEvidenceRefs`
  through an observation store
- added malformed-ref fail-closed coverage
- recorded the no-observationBus compatibility path as no consumable evidence
- legacy v1 direct reanchor safeguards are implemented and tested, but remain
  outside the normal operator task flow
- added `createRuntimeSignalFromGovernanceState()` in `runtime-control`
- added regression coverage for runtime-control no-op, escalation, open-circuit,
  and governance-state signal derivation

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/runtime-control.test.ts`: PASS
- `npm test`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS

Todo:

- use focused PRs for the next governance semantic changes unless separately
  authorized
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
