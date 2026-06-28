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
| Current branch | `fix/state-sync-evidence-drift-schema` |
| Current head | `1216420` |
| Validated source commit | `1216420` |
| Upstream | `refs/remotes/origin/main` |
| Upstream divergence | `ahead 6 / behind 0` |
| Latest validated commit | `1216420` |
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
- validated source commit: `1216420`
- latest validated commit: `1216420`
- upstream baseline: `refs/remotes/origin/main`
- recorded divergence baseline: `ahead 6 / behind 0`
- source tree digest: `git-ls-tree-sha256`
  `ed49dbcec7aa938a902de77298975791f52023c81671251e035e4234dc00d58f`

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

This state record commit records the governance semantic PR for:

- blocking machine-mirrored Markdown evidence drift with
  `state_sync_evidenceDriftAbsent`
- blocking empty or missing machine-mirrored Markdown fields instead of treating
  them as absent evidence
- failing closed on unknown structured claim fields in schema v1
- updating `docs/governance/STATE_SYNC_STRUCTURED_RECORD_PLAN.md` to record
  those resolved semantics

The PR source chain changes only state-sync audit logic, its regression tests,
and the structured-record plan. The state/docs commit then reanchors the
structured claim and operator-facing evidence surfaces for this branch. It does
not change workflows, dependencies, provider behavior, runtime configuration,
env, secrets, user config, or system config.

## Validation Baseline

Validation recorded for source commit `1216420`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 89 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Current structured state-sync audit status:

- This branch state record uses `state_only_pending_push` against
  `refs/remotes/origin/main`.
- After the state/docs record is committed and pushed to the PR branch,
  branch-head audit should PASS locally and in PR CI with:
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
- Machine-mirrored Markdown evidence drift is now blocking through
  `state_sync_evidenceDriftAbsent`.
- Empty or missing machine-mirrored Markdown fields now also block as evidence
  drift unless the structured claim itself expects an empty value.
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

## Current Local Changes

Current state-only record changes are limited to:

- `docs/current/CURRENT_STATE.md`
- `docs/current/state-sync-record.json`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## State Sync Expectations

The structured claim records:

- branch: `fix/state-sync-evidence-drift-schema`
- upstream: `refs/remotes/origin/main`
- validated source commit: `1216420`
- recorded divergence baseline: `ahead 6 / behind 0`
- transition: `state_only_pending_push`

When this PR branch state record is committed and pushed, Git observation should
compute the validated source divergence as `ahead 6 / behind 0` against
`refs/remotes/origin/main`. This is not a `main` landing record; after squash
merge, `main` should receive the normal `main` / `state_only_pushed` reanchor.

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
- Unknown structured claim field fail-closed behavior: implemented and tested.
- Machine-authoritative claim file: introduced.
- Markdown and agent board: evidence/display surfaces.
- Strict state record path convergence: implemented, merged through PR #51, and
  reanchored on `main`.
- State/docs cleanup: merged through PR #52 and reanchored on `main`.
- Next: review PR #53 CI and feedback; after squash merge, perform the normal
  `main` state/docs reanchor.
