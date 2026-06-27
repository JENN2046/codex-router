# Task Queue

Current task:

- Finish Phase 1 state-sync structured record rollout on
  `docs/state-sync-structured-record-plan`.

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

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 68 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1201 tests

Todo:

- commit state/docs record surfaces
- rerun final local validation after state/docs commit
- decide branch publication workflow
- keep Markdown and `.agent_board/*` as evidence/display, not authority

Blocked until separately authorized:

- direct push to `main`
- dependency changes
- workflow edits
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits
