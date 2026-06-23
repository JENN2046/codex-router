# Current State

CURRENT_STATE_RECORDED

This is the compact operational state surface for the repository. Historical
closeouts and `.agent_board` files remain evidence; current facts should be
refreshed here first.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `codex-router` |
| Current branch | `fix/p1-controlled-output-safety` |
| Current head | `c01871f` |
| Upstream | `origin/main` |
| Upstream divergence | `ahead 12 / behind 0` |
| Latest validated commit | `c01871f` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Controlled provider execution taskbook:
  `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- Controlled provider execution taskbook review audit:
  `npm run governance -- audit controlled-provider-execution-taskbook-review`
- Governance runner discovery: `npm run governance -- list`

## Current Scope

This branch addresses the GPT Pro review blockers for the controlled provider
execution line after PR #44 was merged into `main`.

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

Implemented in local commits through `c01871f`:

- controlled read-only runner result/report/event outputs now use one safe
  representation for executor plans and provider summaries
- controlled runner results no longer expose full executor metadata
- provider failure, validation, and artifact summary surfaces use stricter
  redaction, field omission, and size limits before `alreadyRedacted` reports
  are written
- routing-derived `workspace-write` Codex CLI plans now use `on-request`
  approval instead of `never`
- host run validation rejects every `workspace-write + approvalPolicy never`
  combination before spawn
- provider execution plans bind full Task and Principal snapshots through
  stable hashes
- controlled executor plans copy Task, Principal, provider plan, and manifest
  bindings, and the runner rejects mismatches before provider execution
- read-only provider permits bind the full executor plan hash, required run,
  plan, manifest, policy, Task, Principal, nonce, expiration, and consumed
  status where available
- provider-core now owns a trusted in-memory read-only permit consumption
  registry keyed by execution identity rather than caller-controlled
  `permitId`, `nonce`, or `consumedAt` fields
- Codex provider execution consumes both the one-shot prompt handoff and the
  provider permit before fake/real execution; replayed handoffs, concurrent
  duplicate execution, caller-side permit-id tampering, and post-spawn-failure
  retries are blocked before a second spawn
- Codex provider plans carry the new binding fields into executor plans
- smoke/operator evidence builders now write sanitized errors and telemetry
  payloads instead of raw `error` values
- Codex provider fake mode now uses in-memory execution only and rejects
  configured process spawners
- the default Codex CLI process spawner no longer falls back to `shell: true`
- CI now runs a real state-sync audit before evidence collection
- state-sync audit now blocks machine absolute paths in state surfaces
- state-sync audit accepts explicitly allowed, clean, detached PR merge
  checkouts with unknown upstream divergence
- PR #45 review follow-up keeps legacy file plan-store records without the new
  Task/Principal binding fields loadable and appendable
- PR #45 review follow-up returns blocked read-only provider permits with
  `provider_execution_permit_policy_hash_required` when an old/custom executor
  plan omits `policyDecisionHash`, instead of throwing during permit parsing
- controlled runner preflight now fails closed with explicit
  `provider_plan_*_required` reasons if an old provider execution plan lacks
  Task or Principal binding fields

## Validation Baseline

Validation already completed before the local commit split:

- `npx tsx --test --test-name-pattern "evidence never writes raw|redacts sensitive process errors" tests/codex-cli-host.test.ts`:
  passed, `2 / 2`.
- `npx tsx --test --test-name-pattern "default process spawner|evidence never writes raw|redacts sensitive process errors|converts synchronous spawner failure" tests/codex-cli-host.test.ts`:
  passed, `4 / 4`.
- `npx tsx --test --test-name-pattern "fake mode|handoff|read-only provider dispatch|runner results through provider|registry selection" tests/codex-cli-provider.test.ts tests/host-dispatcher.test.ts`:
  passed, `8 / 8`.
- `npx tsx --test tests/canary-evidence.test.ts tests/state-sync-audit.test.ts`:
  passed, `21 / 21`.
- `npx tsx --test tests/codex-cli-provider.test.ts tests/host-dispatcher.test.ts tests/desktop-decision-runner.test.ts tests/provider-execution-runner.test.ts`:
  passed, `89 / 89`.
- `npx tsx --test tests/read-only-control-chain-acceptance.test.ts tests/approval-consumption-dispatch-matrix-audit.test.ts`:
  passed, `6 / 6`.
- `npm run typecheck`: passed.
- `npm test`: passed, `1146 / 1146`.
- `npm run validate:pr`: passed; this includes `npm run typecheck`,
  `npm test` with `1146 / 1146`, `npm run build`, and
  `npm run governance -- audit state-sync`.
- `npm run typecheck`: passed after the permit replay registry update.
- `npx tsx --test tests/provider-core.test.ts tests/codex-cli-provider.test.ts tests/provider-execution-runner.test.ts`:
  passed, `79 / 79`.
- `npm run validate:pr`: passed after the PR closeout review; this includes
  `npm run typecheck`, `npm test` with `1146 / 1146`,
  `npm run build`, and `npm run governance -- audit state-sync`.
- `npx tsx --test tests/execution-planner.test.ts tests/provider-core.test.ts`:
  passed after the PR #45 review follow-up, `41 / 41`.
- `npm run typecheck`: passed after the PR #45 review follow-up.
- `npx tsx --test tests/execution-planner.test.ts tests/provider-core.test.ts tests/provider-execution-runner.test.ts`:
  passed after the PR #45 review follow-up, `66 / 66`.
- `git diff --check`: passed before the PR #45 review follow-up state
  documentation commit.

Validation commands required by the state-sync audit remain:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Detailed validation history remains in `.agent_board/VALIDATION_LOG.md`.

## Execution Boundary

Current allowed-by-default behavior remains local and non-executing unless a
specific task and approval gate says otherwise.

- `read_only_real_cli_smoke`: recorded and controlled; not a default execution
  capability.
- `bounded_workspace_write_canary`: historical fixed-target canary only; it
  does not authorize general writes.
- `state_sync_audit`: local read-only audit only.
- `controlled_readonly_provider_execution`: explicit controlled read-only
  implementation slice only; tests use fake or injected spawners where the
  test explicitly enters a guarded real-mode path.
- `provider_permit_consumption`: single-process in-memory replay control by
  default; the `ProviderExecutionPermitConsumptionStore` interface is the
  injection point for a persistent or distributed registry if this boundary is
  expanded later.

Blocked capabilities:

- `general_workspace_write`
- `general_provider_execution`
- `protected_remote_write`
- `push_to_main`
- `release_tag_deploy`
- `secret_or_credential_change`
- `external_service_write`

## Current Local Changes

Local commits on `fix/p1-controlled-output-safety`:

- `feat(provider-core): harden read-only execution permits`
- `fix(provider-runner): bind controlled execution outputs`
- `fix(codex-provider): consume permits before execution`
- `fix(codex-cli-host): sanitize evidence before persistence`
- `ci(governance): audit state sync before evidence`
- `fix(state-sync): accept detached PR merge checkout`
- `test(state-sync): omit absent merge parent`
- `fix(provider): preserve legacy execution audit paths`
- final state documentation commit

After the final state documentation commit, the intended worktree state is
clean. PR #45 update is authorized by the current PR-fix task; merge, tag,
release, deployment, secret changes, and push to `main` remain prohibited
without separate explicit authorization.

## State Sync Expectations

This branch tracks `origin/main`. This state surface records `c01871f`, the
last code/test commit before the final state documentation commit. Because
`Stale after commit` is `true`, the state-sync audit accepts the documented
parent commit after the final state documentation commit changes `HEAD`.

## Next Safe Action

After the final state documentation commit, rerun `git status --short`,
`npm run governance -- audit state-sync`, `npm run validate:pr`, and
`git diff --check`. Do not run real Codex CLI, workspace-write execution, tag,
release, deploy, modify secrets, push to `main`, or merge without a separate
explicit instruction.
