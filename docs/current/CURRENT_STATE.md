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
| Current branch | `docs/state-sync-phase-4-main-push-ci` |
| Current head | `cacd546` |
| Validated source commit | `cacd546` |
| Upstream | `refs/remotes/origin/main` |
| Upstream divergence | `ahead 1 / behind 0` |
| Latest validated commit | `cacd546` |
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
- validated source commit: `cacd546`
- latest validated commit: `cacd546`
- upstream baseline: `refs/remotes/origin/main`
- recorded divergence baseline: `ahead 1 / behind 0`
- source tree digest: `git-ls-tree-sha256`
  `62900f7fdfa80048c4673c17264fa97e68f9b0d3fcf008c93d673a1dda2f6d19`

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

This branch contains the Phase 4 state-sync CI coverage adjustment:

- `.github/workflows/ci.yml`
- `docs/governance/STATE_SYNC_STRUCTURED_RECORD_PLAN.md`
- `tests/canary-evidence.test.ts`
- `docs/current/state-sync-record.json`

The Phase 4 change removes the State Sync Audit job's PR-only event gate so the
audit runs under both workflow top-level triggers: `pull_request` to `main` and
`push` to `main`.

## Validation Baseline

Validation recorded for source commit `cacd546`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/canary-evidence.test.ts`: PASS, 4 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Current structured state-sync audit status:

- expected after this state record is committed and pushed to the PR branch:
  `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS.
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
- The source commit intentionally changes `.github/workflows/ci.yml` for
  Phase 4 state-sync CI coverage.
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

- branch: `docs/state-sync-phase-4-main-push-ci`
- upstream: `refs/remotes/origin/main`
- validated source commit: `cacd546`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pending_push`

After the state record is pushed, Git observation should compute the validated
source divergence as `ahead 1 / behind 0` against
`refs/remotes/origin/main`.

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
- Phase 4 state-sync audit on `push` to `main`: implemented locally and ready
  for PR validation.
- Bounded source tree digest verification for squash-only state records:
  implemented and tested.
- Machine-authoritative claim file: introduced.
- Markdown and agent board: evidence/display surfaces.
- Next: commit the state/docs reanchor, push the Phase 4 branch, and open a
  focused PR.
