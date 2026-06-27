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
| Current head | `d2a3e47` |
| Validated source commit | `d2a3e47` |
| Upstream | `origin/fix/jsonl-event-log-structured-error` |
| Upstream divergence | `ahead 1 / behind 0` |
| Latest validated commit | `d2a3e47` |
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
validated source baseline for `d2a3e47`, not a future state-only commit's
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

Recorded baseline facts before the local PR #47 P1 remediation:

- Current head is `d2a3e47`.
- Validated source commit is `d2a3e47`.
- Latest validated commit is `d2a3e47`.
- Upstream is `origin/fix/jsonl-event-log-structured-error`.
- Upstream divergence is `ahead 1 / behind 0`.
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

Validation baseline previously recorded for source commit `d2a3e47`:

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

Local PR #47 P1 remediation validation:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm test`: not completed because the `tsx` CLI could not open its IPC pipe
  in this sandbox.
- `node --import tsx --test tests/*.test.ts`: 122 files passed, 2 files failed
  for environment-gated behavior outside this remediation:
  `tests/arbitrate.test.ts` invokes `npx tsx`, and
  `tests/codex-memory-mcp-client.test.ts` needs local loopback listen.
- `node --import tsx scripts/run-state-sync-audit.ts --json`: BLOCKED only by
  `state_sync_dirtyWorktreeStateOnly` while this local remediation remains
  uncommitted.

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

- Source code changes are limited to PR #47 P1 state-sync audit remediation.
- No package or dependency changes.
- Current source head is recorded as `d2a3e47`.
- This local update is not committed.
- No commit.
- No push or remote write.
- No real provider execution.
- No env, secret, user config, or system config edit.

## Current Local Changes

The validated source commit exists and is the current validated state anchor.
Local changes are limited to:

- `packages/state-sync-audit/src/index.ts`
- `tests/state-sync-audit.test.ts`
- `docs/current/CURRENT_STATE.md`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## State Sync Expectations

This local branch tracks `origin/fix/jsonl-event-log-structured-error`. The
state-sync audit therefore expects recorded validated source baseline
divergence of `ahead 1 / behind 0` for the current PR head.

The recorded validated source head and latest validated commit are both
`d2a3e47`. The current task leaves local P1 remediation uncommitted; a later
source commit plus state-only record commit should refresh this anchor again.

## Next Safe Action

Report the changed state files and the state-sync audit result. Do not commit,
push, or otherwise modify remote state without a separate exact authorization
token.
