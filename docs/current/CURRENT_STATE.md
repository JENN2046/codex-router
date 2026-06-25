# Current State

CURRENT_STATE_RECORDED

This is the compact operational state surface for the repository. Historical
closeouts and `.agent_board` files remain evidence; current facts should be
refreshed here first.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `codex-router/repo` |
| Current branch | `feat/pr-23a-s1-trusted-runtime` |
| Current head | `c687b0f` |
| Upstream | `none` |
| Upstream divergence | `ahead -1 / behind -1` |
| Latest validated commit | `c687b0f` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Governance runner discovery: `npm run governance -- list`

## Current Scope

This branch is in PR-23A-S1 trusted Codex CLI runtime remediation under the web
GPT commander R1-G1FIX5 local CI remediation task book.

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

Verified local remediation facts:

- The smoke artifact projection issue is locally remediated. Persisted contract
  smoke evidence now records safe nested evidence summaries instead of raw
  nested runtime evidence.
- Persisted smoke telemetry omits raw runtime context and keeps only safe
  message facts.
- Persisted smoke artifact inspection rejects active workspace path material,
  exact raw runtime keys, and prompt transport markers before writing evidence.
- The platform-drift test isolation issue is locally remediated. The drift test
  now creates the plan under the real platform and changes the observed platform
  only for run validation.
- Platform drift remains fail-closed with
  `codex_cli_runtime_binding_descriptor_mismatch` and zero spawner calls.
- No production runtime code changed. The source change is limited to the smoke
  contract script and the targeted host test.
- No real Codex CLI execution, real provider execution, or workspace-write
  smoke was performed.

## Remote State

- PR: `JENN2046/codex-router#46`
- PR state: `OPEN`, draft.
- The published feature branch still points at the pre-remediation remote head.
- Failed remote CI existed before this local remediation.
- Remote CI has not run for the new local remediation commit.
- The local remediation has not been pushed.
- Correct status phrase: locally remediated, remote validation pending.

## Validation Baseline

R1-G1FIX5 validation before the local code remediation commit:

- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`: passed,
  `109 / 109`.
- Safe contract smoke with process-scoped temporary evidence path: passed.
- `npm test`: passed, `1153 / 1153`.
- `npm run build`: passed.

R1-G1FIX5 validation after the local code remediation commit:

- `npm run typecheck`: passed.
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`: passed,
  `109 / 109`.
- Safe contract smoke with process-scoped temporary evidence path: passed.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Validation still required before the state commit:

- exact dirty-set check for the six authorized state files
- `git diff --check`
- process-scoped offline `npx tsx --test tests\codex-cli-host.test.ts`
- `npm test`
- `npm run build`
- `npm run governance -- audit state-sync`
- `npm run validate:pr`

Validation still required after the state commit:

- clean worktree and local ahead/behind check
- `git diff --check`
- `npm run typecheck`
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`
- process-scoped offline `npx tsx --test tests\codex-cli-host.test.ts`
- safe contract smoke with process-scoped temporary evidence path
- `npm test`
- `npm run build`
- `npm run governance -- audit state-sync`
- `npm run validate:pr`
- final remote read-only ref and PR metadata verification

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

Boundary facts for R1-G1FIX5:

- No push, PR edit/comment/review/ready, workflow rerun/cancel/dispatch/watch,
  merge, rebase, branch deletion, release, deploy, or npm publish.
- No additional CI logs, artifacts, workflow actions, real Codex CLI, real
  provider execution, or workspace-write smoke.
- No env, secret, user config, or system config edit.
- The only environment changes were process-scoped validation variables and
  process-scoped temporary smoke evidence paths.

## Current Local Changes

The local remediation code commit exists and is the current state anchor. The
next local change is documentation-only and limited to:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## State Sync Expectations

This local branch does not currently track an upstream branch. The state-sync
audit therefore expects unknown upstream divergence, recorded as
`ahead -1 / behind -1`.

Because `Stale after commit` is `true`, the documentation-only state commit may
leave the recorded state head as its parent while still passing state-sync.

## Next Safe Action

Run the required pre-commit local validation set, create the documentation-only
state commit if it passes, then run the required post-commit validation and
remote read-only verification. Do not push or otherwise modify remote state
without a separate exact authorization token.
