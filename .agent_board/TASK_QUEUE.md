# Task Queue

Current task:

- Open a focused PR for the guarded local `main` state-sync reanchor runner
  after final branch validation.
Done:

- committed `docs/governance/STATE_SYNC_STRUCTURED_RECORD_PLAN.md`
- implemented structured claim parser and fail-closed resolver
- updated collector to read `docs/current/state-sync-record.json`
- prevented invalid structured claims from falling back to Markdown
- added `claimSource` summary output
- added `state_document_evidence_drift` issue output
- enforced structured transition formulas
- added `docs/current/state-sync-record.json` to strict state record paths
- added regression tests for structured claim, fallback, drift, collector anchor
  selection, collector upstream ref observation, transition formulas, and claim
  allowed paths
- added current structured state-sync claim at `docs/current/state-sync-record.json`
- reanchored state/docs surfaces after prior squash merges
- bounded structured claim upstream ref fallback to `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs
- made structured claim upstream the audit baseline even when local
  feature-branch tracking exists
- added bounded detached branch-head and PR merge-ref checkout compatibility
- added bounded squash-only checkout compatibility with filtered source tree
  digest checks
- blocked missing structured claims instead of falling back to Markdown
- added `scripts/sync-state-sync-display.ts` for generated display surfaces
- added display-sync regression tests
- removed the State Sync Audit job's PR-only event gate locally
- gated main-push audit on a committed `main` / `state_only_pushed` record
- updated workflow structure regression coverage
- recorded the Phase 4 main reanchor expectation after squash merge
- completed the post-PR #50 state/docs reanchor on `main`
- squash-merged PR #50 into `main`
- pushed the post-PR #50 `main` state/docs reanchor
- verified branch-head state-sync audit and main-push CI for the previous main
  reanchor
- implemented strict state record path convergence
- added regression tests for unlisted `.agent_board` paths
- squash-merged PR #51 into `main`
- pushed the post-PR #51 `main` state/docs reanchor
- verified the post-PR #51 `main` state-sync audit and main-push CI
- squash-merged PR #52 into `main`
- pushed the post-PR #52 `main` state/docs reanchor
- implemented `state_sync_evidenceDriftAbsent` blocking for machine-mirrored
  Markdown and `.agent_board/*` / structured claim conflicts
- blocked empty or missing machine-mirrored Markdown fields as evidence drift
  unless the structured claim itself expects an empty value
- blocked stale `## Structured Record` mirror fields in `CURRENT_STATE.md`,
  including source tree digest and strict state paths
- blocked stale `Validation recorded for source commit` and
  `## State Sync Expectations` fields in `CURRENT_STATE.md`
- blocked stale or missing `.agent_board/*` generated mirror blocks per file,
  so aggregate block count cannot hide a missing or duplicate file block
- blocked supported `.agent_board/*` heading mirrors as evidence drift
- made unknown structured claim fields fail closed in schema v1
- updated the structured record plan to record those resolved semantics
- implemented `scripts/prepare-state-sync-reanchor.ts`
- added reanchor helper regression tests
- hardened squash fallback reanchors to verify `HEAD` against the recorded
  filtered source tree digest before inferring it as source
- implemented `State Sync Reanchor PR` workflow for post-merge reanchor PR
  creation
- added reanchor PR gate, diff verifier, and PR create/update helper scripts
- added bounded state-sync audit compatibility for the fixed
  `state-sync/reanchor-main` PR branch
- hardened the reanchor PR branch push by fetching the fixed remote branch and
  binding `--force-with-lease` to an explicit expected SHA or empty create-only
  expectation
- added generated PR body language that treats `GITHUB_TOKEN` approval-required
  workflow state as an expected authorization gate, not a missed CI trigger
- added volatile operator prose cleanup for `main/state_only_pushed` display sync
- generated `## State Sync Expectations` divergence prose from the structured
  transition instead of only replacing the divergence value
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
- added `scripts/run-state-sync-main-reanchor.ts`
- added `npm run state-sync:reanchor-main`
- covered no-op, non-main branch rejection, bounded local commit/push, and stale
  remote push blocking with tests
- fixed the reviewed P1 by proving state-sync audit is not invoked until after
  the direct-push runner has pushed the reanchor commit
- documented the operator-authorized direct-push runner while preserving the
  conservative `state-sync/reanchor-main` PR fallback

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-reanchor-automation.test.ts
  tests/state-sync-reanchor-helper.test.ts tests/state-sync-display-sync.test.ts
  tests/canary-evidence.test.ts`: PASS
- `npm test`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node --import tsx scripts/sync-state-sync-display.ts --check`: PASS
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
Generated from `docs/current/state-sync-record.json`.

- branch: `improve/state-sync-main-reanchor-runner`
- upstream: `refs/remotes/origin/main`
- validated source commit: `6e31871`
- latest validated commit: `6e31871`
- recorded divergence baseline: `ahead 9 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
