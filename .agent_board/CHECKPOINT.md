# Checkpoint

Current machine-authoritative state-sync claim:

- `docs/current/state-sync-record.json`

Operator evidence surfaces:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/*`

Branch:

- `main`

Validated source commit:

- `b0d5a45`

Latest validated commit:

- `b0d5a45`

Upstream baseline:

- `refs/remotes/origin/main`

Upstream divergence baseline:

- `ahead 1 / behind 0`

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
- Markdown and `.agent_board/*` display drift has been downgraded out of the
  branch-head state-sync audit; the structured JSON record is the machine
  authority.
- `scripts/sync-state-sync-display.ts` remains available as an optional display
  freshness helper.
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
- `codex-cli` host-dispatch failures now enter the shared runtime governance
  failure reducer when a governance state is supplied.
- Failed host dispatches emit `host_dispatch` execution observations and call
  `onGovernanceUpdate`; recovery governance is returned only when the reducer
  routes the failure to recovery.
- Opaque Codex CLI spawn and host-dispatch errors are normalized to
  `unknown_execution_error` before they become governance error classes.
- Display sync now targets standalone Markdown headings when replacing
  `## State Sync Expectations`, avoiding accidental prose matches.
- Execution-observation evidence refs now have shared create/parse/resolve
  helpers.
- Runtime governance failure evidence refs in `desktop-live-adapter` use the
  shared helper instead of hand-built strings.
- Recovery packet `rawEvidenceRefs` are covered by tests that resolve them back
  to emitted observations.
- Malformed execution-observation refs fail closed, and recovery without an
  observation bus remains compatible with no consumable evidence refs.
- Guarded local `main` state-sync reanchor runner is implemented as
  `npm run state-sync:reanchor-main`.
- The runner defaults to read-only, rejects non-`main` branches, requires local
  `HEAD` to match `refs/remotes/origin/main`, verifies strict state/docs diffs,
  and blocks stale pushes when `origin/main` moves before push.
- Full state-sync audit in the direct-push runner now runs only after a
  successful push, because `state_only_pushed` is not valid in the pre-push
  local commit state.
- README and the structured record plan now document the local runner as an
  operator-authorized direct-push path while preserving the conservative
  `state-sync/reanchor-main` PR workflow fallback.
- `runtime-control` now exposes
  `createRuntimeSignalFromGovernanceState()` for converting governance state
  into escalation-ready runtime signals.
- Runtime-control tests now cover no-op, failure threshold, scope expansion,
  validation failure, context pressure, high-risk open-circuit, and governance
  state signal derivation.
- Markdown and `.agent_board/*` are evidence/display surfaces, not governance
  authority.
- `docs/current/state-sync-record.json` is included in strict state-only paths.
- Broad `.agent_board/*` allowance has been removed from state path checks.

Validation recorded:

- `git diff --check`: PASS
- `node --import tsx --test tests/runtime-control.test.ts`: PASS
- `npm test`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS

State-sync observation:

- structured claim: `main` / `state_only_pushed` against
  `refs/remotes/origin/main`
- validated source commit: `b0d5a45`
- latest validated commit: `b0d5a45`
- recorded divergence baseline: `ahead 1 / behind 0`
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Git ancestry, divergence, source-tree digest, and strict state path
  checks remain enforced by the state-sync audit.
<!-- state-sync-display:start -->
Optional display generated from `docs/current/state-sync-record.json`.

- branch: `main`
- upstream: `refs/remotes/origin/main`
- validated source commit: `b0d5a45`
- latest validated commit: `b0d5a45`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pushed`
<!-- state-sync-display:end -->
