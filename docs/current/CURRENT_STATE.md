# Current State

CURRENT_STATE_RECORDED

This is the compact operational state surface for the repository. Historical
closeouts, receipts, and `.agent_board` files remain evidence; current facts
should be refreshed here first.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `/mnt/datadisk0/apps/AGENTS_OS_Workspace/governance/codex-router` |
| Current branch | `feature/pr-22a-controlled-provider-execution` |
| Current head | `b531807` |
| Upstream | `origin/feature/pr-22a-controlled-provider-execution` |
| Upstream divergence | `ahead 2 / behind 0` |
| Latest validated commit | `b531807` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Controlled provider execution taskbook review audit:
  `npm run governance -- audit controlled-provider-execution-taskbook-review`
- Governance runner discovery: `npm run governance -- list`

## Current Baseline

The implementation branch was created from clean `main` after
`npm run governance -- audit readonly-productization` passed on `main` with
ahead `0`, behind `0`, evidence `10/10`, readiness matrix `passed`, and
provider execute / real CLI / workspace-write / evidence writes all `0`.

The PR-22A controlled provider execution planning line is recorded by:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_RECORDED`
- `PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED`
- `npm run governance -- audit controlled-provider-execution-taskbook-review`

The PR-22A implementation line now includes the minimal controlled read-only
provider execution slice. It remains bounded to explicit `controlled-read-only`
mode, provider id `codex-cli`, side effect class `read_only`, sandbox
`read-only`, approval policy `never`, provider execution metadata, exact
provider execution permit validation, and injected execution dependency checks.

## Validation Baseline

Latest PR #43 validation for the updated `main` baseline:

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

Pre-implementation gate validation on clean `main`:

- `git pull --ff-only origin main`: already up to date.
- `npm run governance -- audit readonly-productization`: passed.

PR-22A review validation on this branch:

- `npm run governance -- audit controlled-provider-execution-taskbook-review`:
  passed before implementation on the fresh branch.
- `npm run governance -- audit state-sync`: passed before implementation on the
  fresh branch.

PR-22A minimal controlled read-only provider execution validation before the
post-review failure-surface fix:

- `npm run validate:pr`: passed; included `npm run typecheck`, `npm test`
  passed `1123 / 1123`, `npm run build`, and final
  `npm run governance -- audit state-sync`.
- `npm run typecheck`: passed.
- `npx tsx --test tests/provider-execution-runner.test.ts`: passed, `17 / 17`.
- `npx tsx --test tests/codex-cli-provider.test.ts`: passed, `29 / 29`.
- `npx tsx --test tests/codex-cli-host.test.ts`: passed, `104 / 104`.
- `npm run governance -- acceptance controlled-readonly-provider-execution`:
  passed; fake spawner calls `1`, real Codex CLI calls `0`, workspace-write
  execute calls `0`, external write calls `0`, sanitized evidence `true`.
- `npx tsx --test tests/state-sync-audit.test.ts`: passed, `16 / 16`.
- `npm test`: passed, `1123 / 1123`.
- `npm run build`: passed.
- Post-review failure-surface regression validation:
  `npx tsx --test tests/provider-execution-runner.test.ts` passed `19 / 19`,
  `npm run typecheck` passed, and the pre-state-refresh `npm run validate:pr`
  run passed typecheck, full tests `1125 / 1125`, and build before blocking on
  the intentionally stale state-sync surface.
- Final clean-worktree `npm run validate:pr`: passed before the P1 validation
  payload follow-up; included
  `npm run typecheck`, `npm test` passed `1125 / 1125`, `npm run build`, and
  final state-sync passed with git status entries `0`, state writes `0`, and
  remote writes `0`.
- P1 validation payload follow-up:
  `npx tsx --test tests/provider-execution-runner.test.ts` passed `21 / 21`,
  `npm run typecheck` passed, and final clean-worktree `npm run validate:pr`
  is pending after this state refresh commit.

Detailed validation history remains in `.agent_board/VALIDATION_LOG.md`.

## Execution Boundary

Current allowed-by-default behavior remains local and non-executing unless a
specific task and approval gate says otherwise.

- `read_only_real_cli_smoke`: recorded and controlled; not a default execution
  capability.
- `bounded_workspace_write_canary`: one historical fixed-target canary was
  recorded; it does not authorize general writes.
- `state_sync_audit`: local read-only audit only.
- `controlled_provider_execution_taskbook_review`: local read-only planning
  audit only; it does not authorize provider execute, real Codex CLI execution,
  workspace-write, evidence refresh, push, release, tag, deployment, external
  write, or secret changes.
- `controlled_readonly_provider_execution`: explicit minimal implementation
  slice only; acceptance uses a fake injected spawner, records real Codex CLI
  calls `0`, workspace-write execute calls `0`, and external write calls `0`.

Blocked capabilities:

- `general_workspace_write`
- `general_provider_execution`
- `protected_remote_write`
- `push_to_main`
- `release_tag_deploy`
- `secret_or_credential_change`
- `external_service_write`

## Current Local Changes

- `packages/provider-execution-runner/src/index.ts` adds the explicit
  controlled read-only execution runner while preserving dry-run behavior, and
  sanitizes controlled read-only provider failure classes, provider reasons,
  validation reasons, and thrown validation / execution messages before they are
  emitted to results, events, reports, or execution evidence.
- `packages/codex-cli-host/src/index-impl.ts` maps routing decisions with
  `approval.required=false` to CLI approval policy `never`.
- `scripts/run-controlled-readonly-provider-execution-acceptance.ts` records the
  fake-spawner local acceptance for the minimal slice.
- `docs/evidence/codex-cli-controlled-readonly-provider-execution-acceptance.json`
  stores the sanitized acceptance evidence.
- `scripts/run-governance-check.ts` registers
  `controlled-readonly-provider-execution`.
- `tests/provider-execution-runner.test.ts` covers success, blocked paths,
  provider-returned failures, thrown execution failures, provider validation
  failures, and thrown validation failures for the controlled read-only runner.
- `tests/state-sync-audit.test.ts` handles the no-upstream `-1/-1` divergence
  sentinel used by this fresh local branch.

## State Sync Expectations

This branch tracks `origin/feature/pr-22a-controlled-provider-execution`. After
the P1 validation payload fix and state refresh commit, audit divergence is
expected to be `ahead 2 / behind 0` until the branch is pushed. After each new
commit, refresh `Current head`, `Latest validated commit`, validation facts,
and `.agent_board` before treating this state surface as current.

## Next Safe Action

Run `npm run validate:pr` after this state refresh commit, then push the branch
only after explicit external-write confirmation. Do not run real Codex CLI,
workspace-write execution, tag, release, deploy, modify secrets, or write other
external services without a separate explicit instruction.
