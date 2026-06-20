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
| Current head | `8480a6f` |
| Upstream | `origin/chore/governance-validation-surface-slimming` |
| Upstream divergence | `ahead 0 / behind 0` |
| Latest validated commit | `8480a6f` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Governance runner discovery: `npm run governance -- list`

## Validation Baseline

Latest PR #43 validation for the working tree based on `8480a6f`:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `104 / 104`.
- `npx tsx --test tests\canary-evidence.test.ts tests\governance-check.test.ts`:
  passed, `8 / 8`.
- `npm run typecheck`: passed.
- `npm test`: passed, `1109 / 1109`.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run governance -- audit state-sync`: passed.
- `npm run validate:pr`: passed; included `npm run typecheck`, `npm test`,
  `npm run build`, and final state-sync audit.

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
- `scripts/run-canary-test.ts` now writes per-risk canary evidence files
  while preserving the legacy latest alias.
- `tests/canary-evidence.test.ts` covers low-risk and medium-risk canary
  evidence preservation across sequential release validation canaries.
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

Commit the PR #43 P1 state refresh and validate the synced branch:

1. run `npm run governance -- audit state-sync`
2. run `npm run validate:pr`
3. push `chore/governance-validation-surface-slimming`
4. report PR #43 commit, validation, and remaining risk
