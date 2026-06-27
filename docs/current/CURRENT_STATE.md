# Current State

CURRENT_STATE_RECORDED

This is the compact operational state surface for the repository. Historical
closeouts and `.agent_board` files remain evidence; current facts should be
refreshed here first.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `codex-router/repo` |
| Current branch | `main` |
| Current head | `42fc8e3` |
| Validated source commit | `42fc8e3` |
| Upstream | `origin/main` |
| Upstream divergence | `ahead 1 / behind 0` |
| Latest validated commit | `42fc8e3` |
| State record mode | `state-only descendant allowed` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

The `Current head` row records the validated source head for audit
compatibility. Dirty state-only record changes are allowed before a state
commit, and state-only record commits may descend from this source commit
without writing their own commit hash back into tracked state files.

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Governance runner discovery: `npm run governance -- list`

## Current Scope

PR #47 has been squash-merged into `main`. This direct state/docs repair
reanchors the current state after the squash merge so tracked state no longer
depends on PR-branch-internal commits that are not ancestors of `main`.

The current validated source anchor is `42fc8e3`, an empty post-squash source
anchor on `main`. The recorded upstream divergence is the validated source
baseline at the state-record moment, not the future state-only commit's own
ahead / behind value.

The State Sync Audit bounded divergence snapshot behavior remains active:
recorded upstream divergence may pass only through exact recomputed matches,
detached synthetic checkout compatibility, or the bounded pushed state-only
inverse snapshot path. Syntax-only upstream divergence fields do not satisfy
the check.

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

Recorded source facts for the post-squash state reanchor:

- Current branch is `main`.
- Current head is `42fc8e3`.
- Validated source commit is `42fc8e3`.
- Latest validated commit is `42fc8e3`.
- Upstream is `origin/main`.
- Upstream divergence is `ahead 1 / behind 0`.
- State record mode is `state-only descendant allowed`.
- Reachability checks, non-state descendant blocking, and validated-evidence
  synthetic anchor hardening remain closed.
- No workflow checkout change, package change, dependency change, provider
  execution, env edit, secret edit, user config edit, or system config edit is
  part of this state record.

## Remote State

- Direct push to `main` is authorized only for this post-squash state/docs
  repair, after local validation passes and the worktree is clean.
- No PR edit, manual CI rerun, review-thread resolution, release, deploy, or
  npm publish is authorized.
- Correct status phrase before final push: locally validated, state alignment
  in progress.

## Validation Baseline

Validation baseline for source commit `42fc8e3`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Local post-squash state reanchor validation:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS,
  `status: passed`, `dirtyWorktreeStateOnly: true`, `reasons: []`,
  `issues: []`.

## Execution Boundary

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

- PR #47 is merged by squash into `main`.
- A post-squash empty source anchor exists at `42fc8e3`.
- No source, package, dependency, workflow, provider, env, secret, user config,
  or system config file is changed by this state/docs reanchor.
- Current source head is recorded as `42fc8e3`.
- This state/docs update is not committed yet.
- No push for the reanchor commits has happened yet.
- No real provider execution has occurred.

## Current Local Changes

The validated source commit exists and is the current validated state anchor.
Current local state changes are limited to:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## State Sync Expectations

This local branch tracks `origin/main`. The state-sync audit expects recorded
validated source baseline divergence of `ahead 1 / behind 0` for `42fc8e3`
before the state/docs commit is pushed.

After the state/docs commit is pushed, `main` should be aligned with upstream.
The same recorded baseline should then pass through the bounded pushed
state-only inverse snapshot rule because the only committed paths since the
validated source are strict state record files.

Current state line:

- PR47 JSONL/state-sync fixes: merged by squash.
- Synthetic anchor hardening: correct.
- Bounded divergence snapshot fallback: correct.
- Remote CI for the merged PR: passed before merge.
- Post-squash main state anchor: locally validated.
- Merge: complete.
- Next: commit and push state/docs reanchor only if local validation passes.

## Next Safe Action

Run the state-sync audit, commit state/docs only, run final validation, then
push `main` only if the final validation passes and the worktree is clean.
