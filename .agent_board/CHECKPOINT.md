# Checkpoint

Current machine-authoritative state-sync claim:

- `docs/current/state-sync-record.json`

Operator evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/*`

Branch:

- `docs/state-sync-phase-4-main-push-ci`

Validated source commit:

- `786aa8b`

Latest validated commit:

- `786aa8b`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 3 / behind 0`

Checkpoint facts:

- The structured record plan is committed.
- The Phase 1 verifier reads, parses, and validates `StateSyncClaim`.
- Phase 2 blocks missing structured claims instead of falling back to Markdown.
- Phase 3 provides `scripts/sync-state-sync-display.ts` to update display
  surfaces from the structured claim.
- Phase 4 removes the State Sync Audit job's PR-only event gate so it also runs
  on `push` to `main`.
- The collector uses the structured claim upstream ref as the bounded baseline
  even when local feature-branch tracking exists, then computes divergence from
  Git.
- Structured claim upstream ref selection is bounded to `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs.
- Bounded detached branch-head and PR merge-ref checkout contexts are accepted
  only when upstream, ancestry, divergence, and state-only path checks pass.
- Bounded squash-only checkout contexts are accepted without the side-branch
  source commit object only when live `HEAD` has the recorded filtered source
  tree digest.
- A present but invalid structured claim blocks without Markdown fallback.
- A valid structured claim supplies core source and divergence facts.
- Markdown and `.agent_board/*` are evidence/display surfaces during the
  compatibility window.
- `docs/current/state-sync-record.json` is included in strict state-only paths.

Validation recorded:

- `git diff --check`: PASS
- `node --import tsx --test tests/canary-evidence.test.ts`: PASS, 4 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync observation:

- with this state/docs record committed, branch-head state-sync audit should
  PASS using `refs/remotes/origin/main` as a verified Git ref selected by the
  structured claim
- after the PR branch is pushed, CI should validate the same checkout and
  upstream contexts

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `docs/state-sync-phase-4-main-push-ci`
- upstream: `refs/remotes/origin/main`
- validated source commit: `786aa8b`
- latest validated commit: `786aa8b`
- recorded divergence baseline: `ahead 3 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
