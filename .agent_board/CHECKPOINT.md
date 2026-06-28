# Checkpoint

Current machine-authoritative state-sync claim:

- `docs/current/state-sync-record.json`

Operator evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/*`

Branch:

- `automate/state-sync-reanchor-pr`

Validated source commit:

- `bbd22ca`

Latest validated commit:

- `bbd22ca`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 9 / behind 0`

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
- Stale `Validation recorded for source commit` and
  `## State Sync Expectations` fields in `CURRENT_STATE.md` block as evidence
  drift.
- Stale or missing `.agent_board/*` generated mirror blocks are checked per
  file, so aggregate block count cannot hide a missing or duplicate file block.
- Supported `.agent_board/*` heading mirrors block as evidence drift.
- Unknown structured claim fields fail closed in schema v1.
- The reanchor preparation helper is merged through PR #54, remains
  non-committing and non-pushing, and verifies squash fallback `HEAD` against
  the recorded filtered source tree digest before reanchoring to it.
- Conservative post-merge reanchor PR automation is implemented on
  `automate/state-sync-reanchor-pr`; it creates or updates only the fixed
  `state-sync/reanchor-main` PR branch and never pushes directly to `main`.
- The workflow fetches the fixed reanchor branch before push and uses an
  explicit `--force-with-lease` expected SHA or empty create-only expectation.
- The generated reanchor PR body records that `GITHUB_TOKEN`-created or updated
  PR workflow runs may require write-permission approval before CI proceeds.
- `## State Sync Expectations` divergence prose is generated from the
  structured transition, so pending-push records cannot retain pushed-main
  operator wording.
- Markdown and `.agent_board/*` are evidence/display surfaces, not governance
  authority.
- `docs/current/state-sync-record.json` is included in strict state-only paths.
- Broad `.agent_board/*` allowance has been removed from state path checks.

Validation recorded:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 98 tests
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 4
  tests
- `node --import tsx --test tests/state-sync-reanchor-helper.test.ts`: PASS, 7
  tests
- `node --import tsx --test tests/state-sync-reanchor-automation.test.ts`: PASS,
  8 tests
- `node --import tsx --test tests/canary-evidence.test.ts`: PASS, 5 tests
- `npm test`: PASS, 1251 tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

State-sync observation:

- branch-head state-sync audit is expected to PASS using
  `refs/remotes/origin/main` as a verified Git ref selected by the structured
  claim
- `state_only_pending_push` is expected for this implementation branch state
  record

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `automate/state-sync-reanchor-pr`
- upstream: `refs/remotes/origin/main`
- validated source commit: `bbd22ca`
- latest validated commit: `bbd22ca`
- recorded divergence baseline: `ahead 9 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
