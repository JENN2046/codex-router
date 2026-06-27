# Checkpoint

Current machine-authoritative state-sync claim:

- `docs/current/state-sync-record.json`

Operator evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/*`

Branch:

- `docs/state-sync-structured-record-plan`

Validated source commit:

- `9c0e7d1`

Latest validated commit:

- `9c0e7d1`

Upstream baseline:

- `origin/main`

Upstream divergence baseline:

- `ahead 2 / behind 0`

Checkpoint facts:

- The structured record plan is committed.
- The Phase 1 verifier reads, parses, and validates `StateSyncClaim`.
- A present but invalid structured claim blocks without Markdown fallback.
- A valid structured claim supplies core source and divergence facts.
- Markdown and `.agent_board/*` are evidence/display surfaces during the
  compatibility window.
- `docs/current/state-sync-record.json` is included in strict state-only paths.

Validation recorded:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 63 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1196 tests

Known local constraint:

- this feature branch has no configured `@{upstream}`, so local state-sync audit
  cannot prove upstream-dependent structured transition checks without a
  separately authorized branch/upstream workflow
