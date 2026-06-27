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
| Current branch | `docs/state-sync-structured-record-plan` |
| Current head | `a5ecd0b` |
| Validated source commit | `a5ecd0b` |
| Upstream | `origin/main` |
| Upstream divergence | `ahead 13 / behind 0` |
| Latest validated commit | `a5ecd0b` |
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
- validated source commit: `a5ecd0b`
- latest validated commit: `a5ecd0b`
- upstream baseline: `origin/main`
- recorded divergence baseline: `ahead 13 / behind 0`

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

This branch introduces the state-sync structured record plan and Phase 1
verifier support:

- `docs/governance/STATE_SYNC_STRUCTURED_RECORD_PLAN.md`
- `packages/state-sync-audit/src/index.ts`
- `scripts/run-state-sync-audit.ts`
- `tests/state-sync-audit.test.ts`
- `docs/current/state-sync-record.json`

The important governance change is that `StateSyncClaim + Git Observation +
Policy Verification` becomes the core PASS / BLOCK path. Markdown and
`.agent_board/*` are downgraded to display and evidence surfaces during the
compatibility window.

## Validation Baseline

Validation recorded for source commit `a5ecd0b`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, 69 tests.
- `node --import tsx --test tests/governance-check.test.ts`: PASS, 6 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm test`: PASS, 1202 tests.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Current structured state-sync audit status:

- expected after this state record commit:
  `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS.
- The collector verifies the structured claim upstream ref `origin/main` exists
  locally, then computes divergence from Git instead of trusting the JSON
  divergence field. Structured claims do not let local feature-branch tracking
  override this baseline.
- Structured claim upstream ref selection is bounded to `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs; `HEAD`, local branches, tags,
  bare SHAs, `origin/HEAD`, and revision expressions block.
- Structured claim verification accepts bounded detached branch-head and PR
  merge-ref checkout contexts when upstream, ancestry, divergence, and
  state-only path checks still pass.
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
- No push or PR publication is performed by this local record.

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

The structured claim expects the branch-head audit context to observe:

- branch: `docs/state-sync-structured-record-plan`
- upstream: `origin/main`
- validated source commit: `a5ecd0b`
- validated source divergence: `ahead 13 / behind 0`
- transition: `state_only_pending_push`

The collector uses the structured claim's `origin/main` value as the bounded
upstream baseline ref. It must resolve that ref locally and then compute
divergence from Git. If the ref does not resolve, upstream-dependent checks
remain blocked.

Current state line:

- Structured state-sync plan: recorded.
- Phase 1 structured claim verifier: implemented and tested.
- Machine-authoritative claim file: introduced.
- Markdown and agent board: evidence/display surfaces.
- Next: decide whether to publish the feature branch or configure an upstream
  through a separately authorized branch workflow.
