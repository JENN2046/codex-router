# Checkpoint

Current machine-authoritative state-sync claim:

- `docs/current/state-sync-record.json`

Operator evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/*`

Branch:

- `fix/state-sync-evidence-drift-schema`

Validated source commit:

- `b2d18d3`

Latest validated commit:

- `b2d18d3`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 10 / behind 0`

Checkpoint facts:

- The structured record plan is committed.
- The Phase 1 verifier reads, parses, and validates `StateSyncClaim`.
- Phase 2 blocks missing structured claims instead of falling back to Markdown.
- Phase 3 provides `scripts/sync-state-sync-display.ts` to update display
  surfaces from the structured claim.
- Phase 4 removes the State Sync Audit job's PR-only event gate and gates
  `push` audits on a committed `main` / `state_only_pushed` record.
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
- Machine-mirrored Markdown and `.agent_board/*` evidence drift now blocks
  through `state_sync_evidenceDriftAbsent`.
- Empty or missing machine-mirrored Markdown fields block as evidence drift
  unless the structured claim itself expects an empty value.
- Stale `## Structured Record` mirror fields in `CURRENT_STATE.md`, including
  source tree digest and strict state paths, block as evidence drift.
- Stale or missing `.agent_board/*` generated mirror blocks are checked per
  file, so aggregate block count cannot hide a missing or duplicate file block.
- Supported `.agent_board/*` heading mirrors block as evidence drift.
- Unknown structured claim fields fail closed in schema v1.
- Markdown and `.agent_board/*` are evidence/display surfaces, not governance
  authority.
- `docs/current/state-sync-record.json` is included in strict state-only paths.
- Broad `.agent_board/*` allowance has been removed from state path checks.

Validation recorded:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 94 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync observation:

- with this state/docs record committed and pushed, branch-head state-sync audit
  should PASS using `refs/remotes/origin/main` as a verified Git ref selected by
  the structured claim
- `state_only_pending_push` is expected on this PR branch; after squash merge,
  `main` should receive the normal `main` / `state_only_pushed` reanchor

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `fix/state-sync-evidence-drift-schema`
- upstream: `refs/remotes/origin/main`
- validated source commit: `b2d18d3`
- latest validated commit: `b2d18d3`
- recorded divergence baseline: `ahead 10 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
