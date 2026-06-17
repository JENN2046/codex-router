# Current State

CURRENT_STATE_RECORDED

This file is the compact state surface for the repository. Historical closeout
documents and `.agent_board` files may explain how the project arrived here,
but current operational facts should be refreshed here first.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `A:\AGENTS_OS_Workspace\governance\codex-router` |
| Current branch | `fix/codex-cli-policy-bypass-flags` |
| Current head | `c1bbc9d` |
| Upstream | `origin/fix/codex-cli-policy-bypass-flags` |
| Upstream divergence | `ahead 0 / behind 0` |
| Latest validated commit | `c1bbc9d` |
| Stale after commit | `true` |

## Validation Baseline

Latest validated commands for `c1bbc9d`:

- `npx tsx --test tests\state-sync-audit.test.ts`: passed, `11 / 11`.
- `npm run typecheck`: passed.
- `npm test`: passed, `1096 / 1096`.
- `npm run build`: passed.
- `npm run audit:state-sync`: passed before state refresh.

## Execution Boundary

Current allowed-by-default behavior remains local and non-executing unless a
specific task and approval gate says otherwise.

- `read_only_real_cli_smoke`: recorded and controlled; not a default execution
  capability.
- `bounded_workspace_write_canary`: one historical fixed-target canary was
  recorded; it does not authorize general writes.
- `state_sync_audit`: local read-only audit only.

Blocked capabilities:

- `general_workspace_write`
- `general_provider_execution`
- `protected_remote_write`
- `push_to_main`
- `release_tag_deploy`
- `secret_or_credential_change`
- `external_service_write`

## State Sync

State sync command:

- `npm run audit:state-sync`

Current state-sync slice validation:

- `npx tsx --test tests\state-sync-audit.test.ts`: passed, `11 / 11`.
- `npm run typecheck`: passed.
- `npm test`: passed, `1096 / 1096`.
- `npm run build`: passed.
- `npm run audit:state-sync`: passed before state refresh.

Latest local optimization:

- PR review fixes now fail closed on `turn.failed` JSONL events even when the
  Codex CLI exits with code `0`.
- State-sync audit now requires `Current head` and `Latest validated commit` to
  match the real head, or the parent head when this file intentionally records
  `Stale after commit: true`.
- State-sync audit now requires `Upstream divergence` to match the actual
  `git rev-list --left-right --count` result and blocks unknown divergence.
- Codex CLI probe and read-only smoke validation now treat web search events as
  unexpected tool use.
- State-sync audit now accepts stale state hashes from PR merge checkout
  second-parent ancestry while still blocking stale hashes outside that
  ancestry.
- Read-only audit freshness collectors now fail closed when `origin/main`
  divergence is unknown instead of pretending `0 / 0`.
- Pure state-sync audit rules were extracted to
  `packages/state-sync-audit/src/index.ts`.
- `scripts/run-state-sync-audit.ts` now stays focused on repository collection
  and CLI output.
- `tests/state-sync-audit.test.ts` now imports the reusable audit module instead
  of the CLI script.

The audit should check this file, package script wiring, and `.agent_board`
handoff surfaces for stale current-state facts. If a new commit is created,
refresh `Current head`, `Latest validated commit`, validation facts, and
`.agent_board` before treating this state surface as current.

## Next Safe Action

Continue the state-surface cleanup locally:

1. keep `CURRENT_STATE.md` as the source of current operational facts
2. keep `.agent_board` aligned with this file
3. commit this state refresh, push PR #41, then wait for checks
