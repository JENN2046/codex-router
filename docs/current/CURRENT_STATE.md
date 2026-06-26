# Current State

CURRENT_STATE_RECORDED

This is the compact operational state surface for the repository. Historical
closeouts and `.agent_board` files remain evidence; current facts should be
refreshed here first.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `codex-router/repo` |
| Current branch | `fix/jsonl-event-log-structured-error` |
| Current head | `6ea36d5` |
| Validated source commit | `6ea36d5` |
| Upstream | `origin/fix/jsonl-event-log-structured-error` |
| Upstream divergence | `ahead 4 / behind 0` |
| Latest validated commit | `6ea36d5` |
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

This branch now records the current validated source head and upstream
divergence for `fix/jsonl-event-log-structured-error`. The divergence is the
validated source baseline for `6ea36d5`, not a future state-only commit's
own ahead / behind value. The earlier JSONL structured error fix remains
included in branch history.

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

Verified local fix facts:

- Current head is `6ea36d5`.
- Validated source commit is `6ea36d5`.
- Latest validated commit is `6ea36d5`.
- Upstream is `origin/fix/jsonl-event-log-structured-error`.
- Upstream divergence is `ahead 4 / behind 0`.
- `npm test`: PASS, `1163 / 1163`.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- state-sync targeted test: PASS.
- No package, dependency, remote, provider-execution, env, or secret change is
  part of this state record.

## Remote State

- No push or remote write is authorized for this state alignment.
- No PR edit, workflow action, release, deploy, or npm publish is authorized.
- Correct status phrase: locally validated, local state alignment in progress.

## Validation Baseline

Validated in normal WSL for source commit `6ea36d5`:

- `git diff --check`: PASS.
- `npm test`: PASS, `1163 / 1163`.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- state-sync targeted test: PASS.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Validation requested for this state alignment:

- `git diff --check`
- `node --import tsx scripts/run-state-sync-audit.ts --json`

Dirty state-only validation:

- `git diff --check`: PASS.
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS.

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

- No source code changes.
- No package or dependency changes.
- Current source head is recorded as `6ea36d5`.
- This state update is state-only.
- No commit.
- No push or remote write.
- No real provider execution.
- No env, secret, user config, or system config edit.

## Current Local Changes

The validated source commit exists and is the current validated state anchor.
State record changes are limited to:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## State Sync Expectations

This local branch tracks `origin/fix/jsonl-event-log-structured-error`. The
state-sync audit therefore expects recorded validated source baseline
divergence of `ahead 4 / behind 0`.

The recorded validated source head and latest validated commit are both
`6ea36d5`. The current task leaves state-only changes uncommitted; a later
state-only record commit may be `HEAD` without requiring tracked state files to
record that state commit hash or its own future ahead / behind value.

## Next Safe Action

Report the changed state files and the state-sync audit result. Do not commit,
push, or otherwise modify remote state without a separate exact authorization
token.
