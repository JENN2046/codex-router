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
| Current head | `b273603` |
| Upstream | `none` |
| Upstream divergence | `ahead -1 / behind -1` |
| Latest validated commit | `b273603` |
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
GPT commander R1-G1FIX2 state-sync documentation repair task book.

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

Implemented locally:

- Codex CLI host plans bind trusted runtime descriptors with command,
  argv-shape, workdir, workspace, and repository hash references.
- Controlled Codex CLI prompts use `exec-json-stdin-prompt.v1` and are sent
  through stdin instead of argv.
- Host validation rejects forged runtime bindings, platform drift, and
  prompt-in-argv plans before spawning a process.
- Codex provider plans reconstruct controlled CLI argv from structured fields
  and do not persist raw command, raw argv, or prompt text in provider
  metadata.
- Workspace-write approval and preflight artifacts use sanitized runtime
  previews and safe path references.
- State-sync audit blocks portable machine paths, including Windows drive
  absolute paths, UNC paths, extended Windows paths, selected POSIX workspace
  paths, and secret markers, while reporting only issue code, relative path,
  line, and risk.
- R1-G1FIX local remediation updated the contract smoke mock to classify model
  probes from stdin, not argv.
- R1-G1FIX local remediation updated smoke spawn evidence to safe contract
  facts only; raw command, cwd, argv, prompt, and stdin contents are not
  retained.
- R1-G1FIX local remediation updated the Windows helper-layout test so the
  simulated platform is established before plan creation and remains active
  through execution.
- Platform drift remains fail-closed with
  `codex_cli_runtime_binding_descriptor_mismatch` and zero spawner calls.
- R1-G1FIX2 repairs state documentation so state-sync does not misclassify CI
  run or job identifiers as commit-like state tokens.

## Remote State

- PR: `JENN2046/codex-router#46`
- PR state: `OPEN`, draft.
- Remote feature branch remains at
  `398bf0c41beb222cc188328adc71c0f50a8b5ee5`.
- Remote PR still contains the original three published commits.
- Failed CI run `28130303432` remains the latest observed remote validation
  evidence for that old remote head.
- The two diagnosed CI root causes have been locally remediated, but the fix
  has not been pushed and no new remote CI has run.
- Correct status phrase: locally remediated, remote validation pending.

## Validation Baseline

R1-G1FIX validation before the code-fix commit:

- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`: passed,
  `109 / 109`.
- Safe contract smoke with process-scoped temporary evidence path: passed;
  spawn call count `4`; raw workspace path and raw runtime fields absent.
- `npm test`: passed, `1153 / 1153`.
- `npm run build`: passed.

R1-G1FIX validation after the code-fix commit:

- `npm run typecheck`: passed.
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`: passed,
  `109 / 109`.
- Safe contract smoke with process-scoped temporary evidence path: passed;
  spawn call count `4`.

R1-G1FIX final validation after the state commit found a documentation-only
state-sync mismatch:

- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`: passed,
  `109 / 109`.
- Safe contract smoke with process-scoped temporary evidence path: passed;
  spawn call count `4`.
- `npm test`: failed only in state-sync audit coverage because state docs
  omitted the exact required command literal and agent board text retained
  non-state commit-like tokens.
- `npm run governance -- audit state-sync`: failed for the same documentation
  mismatch.

R1-G1FIX2 exact targeted validation before this documentation repair:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `109 / 109`.

Validation still required after this state repair commit:

- `git diff --check`
- `npm run typecheck`
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`
- `npx tsx --test tests\codex-cli-host.test.ts`
- Safe contract smoke with process-scoped temporary evidence path
- `npm test`
- `npm run build`
- `npm run governance -- audit state-sync`
- `npm run validate:pr`

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

Boundary facts for R1-G1FIX2:

- No real Codex CLI execution.
- No real provider execution.
- No workspace-write smoke.
- No persistent env/config/secret edit.
- No push, PR edit/comment/review/ready, workflow rerun/cancel, merge, branch
  deletion, release, deploy, or npm publish.
- The only environment changes were process-scoped validation variables and
  temporary smoke evidence paths; temporary evidence files were removed.

## Current Local Changes

Local remediation commits exist, but they have not been pushed:

- `fix(codex-runtime): align CI fixtures with stdin binding`
- `docs(state): record trusted runtime CI remediation`

This R1-G1FIX2 repair is documentation-only and limited to:

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

Because `Stale after commit` is `true`, this documentation-only state repair
commit may leave the recorded state head as its parent while still passing
state-sync.

## Next Safe Action

Create the documentation-only R1-G1FIX2 state repair commit, then run the
required post-commit validation set. Do not push or otherwise modify remote
state without a separate exact authorization token.
