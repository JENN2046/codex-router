# Task Queue

Current task:

- Finish Phase 2 and Phase 3 of the state-sync structured record plan, then open
  a focused PR.

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
- reanchored state/docs surfaces to the latest validated source
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

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 77 tests
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 3
  tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1213 tests

Todo:

- commit the state/docs reanchor
- verify the branch-head state-sync audit
- push the PR branch
- open the PR
- keep Markdown and `.agent_board/*` as evidence/display, not authority

Blocked until separately authorized:

- direct pushes to `main`
- dependency changes
- workflow edits
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `docs/state-sync-phase-2-missing-claim-gate`
- upstream: `refs/remotes/origin/main`
- validated source commit: `9e5afe9`
- latest validated commit: `9e5afe9`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
