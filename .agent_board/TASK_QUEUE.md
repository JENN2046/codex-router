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
  selection, transition formulas, and claim allowed paths
- added current structured state-sync claim at `docs/current/state-sync-record.json`

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 63 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1196 tests

Todo:

- commit state/docs record surfaces
- decide branch publication/upstream workflow
- rerun final validation after any branch/upstream decision
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
