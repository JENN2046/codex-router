# Task Queue

Current task:

- Publish a narrow state/docs cleanup PR that removes stale Todo, Next, and
  handoff wording after PR #51 and the post-squash `main` reanchor.

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
- verified post-push `main` state-sync audit and main-push CI for `b553b3f`

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 79 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

Todo:

- review and merge this state/docs cleanup PR
- then open a separate governance semantic PR for evidence drift blocking and
  unknown structured claim field handling
- keep Markdown and `.agent_board/*` as evidence/display, not authority

Blocked until separately authorized:

- direct pushes to `main`
- dependency changes
- additional workflow edits beyond Phase 4 state-sync CI coverage
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `docs/state-sync-state-docs-cleanup`
- upstream: `refs/remotes/origin/main`
- validated source commit: `b553b3f`
- latest validated commit: `b553b3f`
- recorded divergence baseline: `ahead 0 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
