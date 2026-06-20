# Current State

CURRENT_STATE_RECORDED

This is the compact operational state surface for the repository. Historical
closeouts, receipts, and `.agent_board` files remain evidence; current facts
should be refreshed here first.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `A:\AGENTS_OS_Workspace\governance\codex-router` |
| Current branch | `chore/governance-validation-surface-slimming` |
| Current head | `bcaf257` |
| Upstream | `origin/main` |
| Upstream divergence | `ahead 2 / behind 0` |
| Latest validated commit | `bcaf257` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Governance runner discovery: `npm run governance -- list`

## Validation Baseline

Latest PR2 validation for the working tree based on `bcaf257`:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `104 / 104`.
- `npm run validate:daily -- --test tests\governance-check.test.ts`: passed;
  included `npm run typecheck` and `6 / 6`.
- `npm test`: passed, `1107 / 1107`.
- `npm run build`: passed.
- `npm run governance -- list`: passed.
- `git diff --check`: passed.
- Legacy package-script alias reference search: passed by no matches.

Detailed validation history remains in `.agent_board/VALIDATION_LOG.md`.

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

## Current Local Changes

- `scripts/run-governance-check.ts` consolidates validation tiers and
  audit/acceptance/operator dispatch.
- `scripts/run-governance-check.ts` now resolves both `npm` and `tsx` through
  Windows command shims when `process.platform` is `win32`.
- `package.json` keeps recommended validation entrypoints:
  `governance`, `validate:daily`, `validate:pr`, and `validate:release`.
- `packages/state-sync-audit` now requires the consolidated `governance`
  package script instead of the removed dedicated state-sync script alias.
- Legacy per-check package script aliases have been removed; use
  `npm run governance -- audit|acceptance|operator ...`.
- Old package-script command references and old package script keys were
  migrated out of docs, tests, scripts, and `package.json`.
- `README.md` now points to a compact documentation map instead of listing the
  full historical governance chain.
- `docs/README.md` and `docs/governance/README.md` separate current docs from
  historical evidence.
- Current state and `.agent_board` current surfaces were compacted; detailed
  validation history remains in `.agent_board/VALIDATION_LOG.md`.

## State Sync Expectations

The audit should verify this file, package script wiring, and `.agent_board`
handoff surfaces for stale current-state facts. After a new commit, refresh
`Current head`, `Latest validated commit`, validation facts, and `.agent_board`
before treating this state surface as current.

## Next Safe Action

Commit the PR2 branch and validate the committed split:

1. run `npm run governance -- audit state-sync`
2. run `npm run validate:pr`
3. report split branch names and commits
4. open a PR only after explicit user direction
