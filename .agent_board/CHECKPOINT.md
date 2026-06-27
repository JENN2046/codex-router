# Checkpoint

Current machine-authoritative state-sync claim:

- `docs/current/state-sync-record.json`

Operator evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/*`

Branch:

- `docs/state-sync-structured-record-plan`

Validated source commit:

- `120124a`

Latest validated commit:

- `120124a`

Upstream baseline:

- `origin/main`

Upstream divergence baseline:

- `ahead 11 / behind 0`

Checkpoint facts:

- The structured record plan is committed.
- The Phase 1 verifier reads, parses, and validates `StateSyncClaim`.
- The collector uses the structured claim upstream ref as the bounded baseline
  even when local feature-branch tracking exists, then computes divergence from
  Git.
- Structured claim upstream ref selection is bounded to `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs.
- Bounded detached branch-head and PR merge-ref checkout contexts are accepted
  only when upstream, ancestry, divergence, and state-only path checks pass.
- A present but invalid structured claim blocks without Markdown fallback.
- A valid structured claim supplies core source and divergence facts.
- Markdown and `.agent_board/*` are evidence/display surfaces during the
  compatibility window.
- `docs/current/state-sync-record.json` is included in strict state-only paths.

Validation recorded:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 68 tests
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 1201 tests

State-sync observation:

- expected after this state/docs commit: local state-sync audit PASS using
  `origin/main` as a verified Git ref selected by the structured claim
