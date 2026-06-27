# Checkpoint

Current machine-authoritative state-sync claim:

- `docs/current/state-sync-record.json`

Operator evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/*`

Branch:

- `docs/state-sync-structured-record-plan`

Validated source commit:

- `125ec54`

Latest validated commit:

- `125ec54`

Upstream baseline:

- `origin/main`

Upstream divergence baseline:

- `ahead 5 / behind 0`

Checkpoint facts:

- The structured record plan is committed.
- The Phase 1 verifier reads, parses, and validates `StateSyncClaim`.
- The collector can verify a structured claim upstream ref when no local
  `@{upstream}` is configured, then compute divergence from Git.
- A present but invalid structured claim blocks without Markdown fallback.
- A valid structured claim supplies core source and divergence facts.
- Markdown and `.agent_board/*` are evidence/display surfaces during the
  compatibility window.
- `docs/current/state-sync-record.json` is included in strict state-only paths.

Validation recorded:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 64 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1197 tests

State-sync observation:

- expected after this state/docs commit: local state-sync audit PASS using
  `origin/main` as a verified Git ref selected by the structured claim
