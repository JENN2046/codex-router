# Current State

CURRENT_STATE_RECORDED

This is the compact operator-facing state surface for the repository. The
machine-authoritative state-sync claim is now:

- `docs/current/state-sync-record.json`

Markdown and `.agent_board/*` remain evidence and handoff surfaces. They are not
the authority for core machine facts such as validated source commit, upstream
divergence, transition kind, or allowed state-only paths.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `codex-router/repo` |
| Current branch | `chore/state-sync-reanchor-helper` |
| Current head | `70534db` |
| Validated source commit | `70534db` |
| Upstream | `refs/remotes/origin/main` |
| Upstream divergence | `ahead 3 / behind 0` |
| Latest validated commit | `70534db` |
| State record mode | `state-only descendant allowed` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

The `Current head` row records the validated source head represented by the
structured state-sync claim. A later state-only record commit may descend from
this source commit without making Markdown the source of truth again.

## Structured Record

The structured claim records:

- schema version: `1`
- policy version: `state-sync-policy.v1`
- transition kind: `state_only_pending_push`
- validated source commit: `70534db`
- latest validated commit: `70534db`
- upstream baseline: `refs/remotes/origin/main`
- recorded divergence baseline: `ahead 3 / behind 0`
- source tree digest: `git-ls-tree-sha256`
  `d9cd2628315eb605ad4c17eba72271b78efbfd6205f749882c4b221414a5b8f2`

Strict state record paths:

- `docs/current/CURRENT_STATE.md`
- `docs/current/state-sync-record.json`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Governance runner discovery: `npm run governance -- list`

## Current Scope

This state record commit records the PR branch anchor for the state-sync
reanchor preparation helper:

- adding `scripts/prepare-state-sync-reanchor.ts`;
- adding regression coverage in `tests/state-sync-reanchor-helper.test.ts`;
- documenting the helper in
  `docs/governance/STATE_SYNC_STRUCTURED_RECORD_PLAN.md`.

The helper prepares structured `state_only_pushed` records and generated display
surfaces, but it does not commit or push. It defaults to dry-run mode and fails
closed when `HEAD` appears to be only a state-only descendant unless an explicit
`--source` is supplied. This source chain does not change workflows,
dependencies, provider behavior, runtime configuration, env, secrets, user
config, or system config.

## Validation Baseline

Validation recorded for source commit `70534db`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 95 tests.
- `node --import tsx --test tests/state-sync-display-sync.test.ts`: PASS, 3
  tests.
- `node --import tsx --test tests/state-sync-reanchor-helper.test.ts`: PASS, 6
  tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Current structured state-sync audit status:

- This PR branch state record uses `state_only_pending_push` against
  `refs/remotes/origin/main`.
- Branch-head audit is expected to PASS for this pending-push state-only record
  with:
  `node --import tsx scripts/run-state-sync-audit.ts --json`.
- The collector verifies the structured claim upstream ref
  `refs/remotes/origin/main` exists locally, then computes divergence from Git
  instead of trusting the JSON divergence field. Structured claims do not let
  local feature-branch tracking override this baseline.
- The collector normalizes `origin/*` shorthand to `refs/remotes/origin/*`
  before calling Git, so same-named tags or local refs cannot change the
  divergence baseline.
- Structured claim upstream ref selection is bounded to `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs; `HEAD`, local branches, tags,
  bare SHAs, `origin/HEAD`, and revision expressions block.
- Structured claim verification accepts bounded detached branch-head and PR
  merge-ref checkout contexts when upstream, ancestry, divergence, and
  state-only path checks still pass.
- Structured claim verification accepts bounded squash-only checkout contexts
  without the side-branch source commit object only when live `HEAD` has the
  recorded filtered source tree digest.
- The audit enters `claimSource: structured` and validates the structured claim
  shape.
- Machine-mirrored Markdown and `.agent_board/*` evidence drift is now blocking
  through `state_sync_evidenceDriftAbsent`.
- Empty or missing machine-mirrored Markdown fields now also block as evidence
  drift unless the structured claim itself expects an empty value.
- Stale `## Structured Record` mirror fields in `CURRENT_STATE.md`, including
  source tree digest and strict state paths, now block as evidence drift.
- Stale `Validation recorded for source commit` and
  `## State Sync Expectations` fields in `CURRENT_STATE.md` now block as
  evidence drift.
- Stale or missing `.agent_board/*` generated display blocks are checked per
  file, so a duplicate block in one file cannot mask a missing block in another.
- Supported `.agent_board/*` heading mirrors also block as evidence drift.
- Unknown structured claim fields in schema v1 make the claim invalid.

## Execution Boundary

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

Current allowed-by-default behavior remains local and non-executing unless a
specific task and approval gate says otherwise.

Blocked capabilities:

- `general_workspace_write`
- `general_provider_execution`
- `protected_remote_write`
- `push_to_main`
- `release_tag_deploy`
- `secret_or_credential_change`
- `external_service_write`

Boundary facts for this state alignment:

- No package, dependency, workflow, provider, env, secret, user config, or system
  config file is changed by this state record.
- No real provider execution has occurred.
- No real Codex CLI execution has occurred.
- This state record commit intentionally changes only state/docs display and
  handoff surfaces.
- No release, deploy, provider execution, or environment/configuration change is
  part of this record.

## Current State-Only Record

This state-only record line is limited to:

- `docs/current/CURRENT_STATE.md`
- `docs/current/state-sync-record.json`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## State Sync Expectations

The structured claim records:

- branch: `chore/state-sync-reanchor-helper`
- upstream: `refs/remotes/origin/main`
- validated source commit: `70534db`
- recorded divergence baseline: `ahead 3 / behind 0`
- transition: `state_only_pending_push`

For this PR branch pending-push record, Git observation should compute the
validated source divergence as `ahead 3 / behind 0` against
`refs/remotes/origin/main`. After squash merge, `main` should receive the normal
`main` / `state_only_pushed` reanchor.

The collector uses the structured claim's `refs/remotes/origin/main` value as
the bounded upstream baseline ref. It must resolve that ref locally and then
compute divergence from Git. If the ref does not resolve, upstream-dependent
checks remain blocked.

Current state line:

- Structured state-sync plan: recorded.
- Phase 1 structured claim verifier: implemented and tested.
- Phase 2 missing-claim gate and Markdown authority removal: implemented and
  tested.
- Phase 3 display-sync script: implemented and tested.
- Phase 4 state-sync audit on `push` to `main`: implemented and gated on a
  committed `main` / `state_only_pushed` record.
- Bounded source tree digest verification for squash-only state records:
  implemented and tested.
- Evidence drift blocking for machine-mirrored Markdown fields: implemented and
  tested.
- Empty and missing machine-mirrored field blocking: implemented and tested.
- Structured `CURRENT_STATE.md` display mirror drift blocking: implemented and
  tested.
- `CURRENT_STATE.md` State Sync Expectations mirror drift blocking:
  implemented and tested.
- Per-file agent-board generated block count checks: implemented and tested.
- Unknown structured claim field fail-closed behavior: implemented and tested.
- Machine-authoritative claim file: introduced.
- Markdown and agent board: evidence/display surfaces.
- Strict state record path convergence: implemented, merged through PR #51, and
  reanchored on `main`.
- State/docs cleanup: merged through PR #52 and reanchored on `main`.
- Post-PR #53 `main` reanchor and state/docs cleanup: recorded.
- State-sync reanchor preparation helper: implemented and tested on this branch.
- Next: push the focused PR branch and let CI validate the helper.
