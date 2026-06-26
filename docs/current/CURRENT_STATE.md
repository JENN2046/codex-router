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
| Current head | `da47113` |
| Validated source commit | `da47113` |
| Upstream | `origin/fix/jsonl-event-log-structured-error` |
| Upstream divergence | `ahead 1 / behind 0` |
| Latest validated commit | `da47113` |
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

This branch now records the latest validated source fix for state-sync source
anchoring. The earlier JSONL structured error fix remains included in branch
history.

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

Verified local fix facts:

- Validated source commit `da47113` rejects unreachable validated source
  anchors and blocks non-state descendants after the validated source commit.
- `npm test`: PASS, `1158 / 1158`.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- state-sync targeted test
  `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, `25 / 25`.
- No package, dependency, remote, provider-execution, env, or secret change is
  part of this state record.

## Remote State

- No push or remote write is authorized for this state alignment.
- No PR edit, workflow action, release, deploy, or npm publish is authorized.
- Correct status phrase: locally validated, local state alignment in progress.

## Validation Baseline

Validated in normal WSL for source commit `da47113`:

- `git diff --check`: PASS.
- `npm test`: PASS, `1158 / 1158`.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- state-sync targeted test
  `node --import tsx --test tests/state-sync-audit.test.ts`: PASS, `25 / 25`.

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
- Source fix commit already recorded separately as `da47113`.
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
state-sync audit therefore expects recorded upstream divergence of
`ahead 1 / behind 0`.

The recorded validated source head and latest validated commit are both
`da47113`. The current task leaves state-only changes uncommitted; a later
state-only record commit may be `HEAD` without requiring tracked state files to
record that state commit hash.

## Next Safe Action

Report the changed state files and the state-sync audit result. Do not commit,
push, or otherwise modify remote state without a separate exact authorization
token.
