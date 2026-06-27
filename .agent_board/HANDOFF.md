# Handoff

Goal:

- Continue implementing the state-sync structured record plan so
  `docs/current/state-sync-record.json` becomes the machine-authoritative claim
  while Markdown and `.agent_board/*` become display/evidence surfaces.

Current branch:

- `docs/state-sync-structured-record-plan`

Current validated source:

- `195ba4a`

Current structured claim:

- `docs/current/state-sync-record.json`

Current transition:

- `source_exact`

Upstream baseline:

- `origin/main`

Recorded divergence baseline:

- `ahead 8 / behind 0`

Completed:

- final plan document committed
- Phase 1 structured claim parser and resolver implemented
- collector reads `docs/current/state-sync-record.json`
- collector verifies the structured claim upstream ref when no local
  `@{upstream}` is configured, then computes divergence from Git
- collector rejects structured claim upstream refs outside `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs
- invalid structured claim does not fall back to Markdown
- evidence drift issues are emitted for Markdown / claim conflicts
- transition formulas are enforced for structured claims
- strict state-only path set includes `docs/current/state-sync-record.json`

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 65 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1198 tests

State-sync expectation:

- after this state/docs commit, local state-sync audit should PASS by resolving
  `origin/main` as the structured claim upstream ref and computing divergence
  from Git

Not authorized:

- direct push to `main`
- workflow edits
- dependency changes
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits
