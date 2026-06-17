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
| Current head | `bcec97a` |
| Upstream | `origin/fix/codex-cli-policy-bypass-flags` |
| Upstream divergence | `ahead 2 / behind 0` |
| Latest validated commit | `bcec97a` |
| Stale after commit | `true` |

## Validation Baseline

Latest validated commands for `bcec97a` plus the local state-sync audit-core
extraction working tree:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `101 / 101`.
- `npm run typecheck`: passed.
- `npm test`: passed, `1082 / 1082`.
- `npm run build`: passed.

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

- `npx tsx --test tests\state-sync-audit.test.ts`: passed, `5 / 5`.
- `npm run audit:state-sync`: passed.
- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `101 / 101`.
- `npm run typecheck`: passed.
- `npm test`: passed, `1082 / 1082`.
- `npm run build`: passed.

Current local optimization:

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
3. either commit the state-sync audit-core extraction and refresh this file
   after commit, or continue with a docs/current split pass before committing
