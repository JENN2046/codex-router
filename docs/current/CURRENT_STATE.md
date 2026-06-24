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
| Current head | `3396b2b` |
| Upstream | `none` |
| Upstream divergence | `ahead -1 / behind -1` |
| Latest validated commit | `3396b2b` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Governance runner discovery: `npm run governance -- list`

## Current Scope

This branch closes the PR-23A-S1 trusted Codex CLI runtime slice under the web
GPT commander V2 local-closeout task book.

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

Implemented locally:

- Codex CLI host plans now bind a trusted runtime descriptor with command,
  argv-shape, workdir, workspace, and repository hash references.
- The controlled Codex CLI prompt path is `exec-json-stdin-prompt.v1`, with
  prompt delivery through stdin instead of argv.
- `validateCodexCliExecPlanForRun()` rejects forged runtime bindings and
  forged prompt-in-argv plans before spawning a process.
- Codex provider plans reconstruct the controlled CLI argv from structured
  fields and no longer persist raw command, raw argv, or prompt text in
  provider metadata.
- Provider dry-run, fake execution, real execution summaries, and evidence
  artifacts expose only safe runtime hash summaries.
- Workspace-write approval and preflight artifacts use sanitized runtime
  previews and safe path references.
- State-sync audit now blocks portable machine paths, including Windows drive
  absolute paths, UNC paths, extended Windows paths, selected POSIX workspace
  paths, and secret markers, while reporting only issue code, relative path,
  line, and risk.
- Focused tests cover stdin prompt binding, forged runtime rejection,
  sanitized runtime summaries, Windows path blocking, UNC path blocking, URL
  allowlisting, repo-relative allowlisting, and sentinel path non-disclosure.
- Governance runner validation avoids Windows `.cmd` tsx shims by invoking the
  local tsx CLI through the current Node executable.

## Validation Baseline

V2 pre-commit validation completed locally:

- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npx --no-install tsx --test tests/state-sync-audit.test.ts tests/governance-check.test.ts`:
  passed, `26 / 26`.
- `npx --no-install tsx --test tests/codex-cli-provider.test.ts tests/codex-cli-host.test.ts tests/provider-execution-runner.test.ts`:
  passed, `169 / 169`.
- `npm test`: passed, `1152 / 1152`.
- `npm run build`: passed.
- `npm run governance -- audit state-sync`: passed before local closeout
  commits.
- `npm run validate:pr`: passed; this includes `npm run typecheck`,
  `npm test` with `1152 / 1152`, `npm run build`, and state-sync audit.

Local closeout validation completed so far:

- Commit 1 follow-up `npm run typecheck`: passed.
- Commit 1 follow-up provider/host/runner targeted tests: passed,
  `169 / 169`.
- Commit 2 follow-up state-sync/governance targeted tests: passed,
  `26 / 26`.
- Commit 2 follow-up state-sync audit initially blocked because these state
  surfaces still recorded the previous local head; this documentation refresh
  is the corrective Commit 3 scope.
- State-sync audit after this state surface refresh: passed.

Validation commands required by the state-sync audit remain:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Post-Commit 3 validation remains required before the commander receipt.
Detailed validation history remains in `.agent_board/VALIDATION_LOG.md`.

## Execution Boundary

Current allowed-by-default behavior remains local and non-executing unless a
specific task and approval gate says otherwise.

- `trusted_codex_cli_runtime_binding`: local plan/validation hardening only.
- `controlled_readonly_provider_execution`: tests use fake or injected
  spawners where the test explicitly enters a guarded real-mode path.
- `state_sync_audit`: local read-only audit only.
- `provider_permit_consumption`: single-process in-memory replay control by
  default; a persistent or distributed registry remains a future explicit
  boundary.

Blocked capabilities:

- `general_workspace_write`
- `general_provider_execution`
- `protected_remote_write`
- `push_to_main`
- `release_tag_deploy`
- `secret_or_credential_change`
- `external_service_write`

## Current Local Changes

Two authorized local implementation commits have been created. The remaining
local change is the documentation-only state surface refresh for Commit 3:

- `docs/current/CURRENT_STATE.md`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

No push, PR creation, merge, release, deployment, npm publish, secret change,
real Codex CLI smoke, or workspace-write telemetry smoke is authorized by the
current local task book.

## State Sync Expectations

This local branch does not currently track an upstream branch. The state-sync
audit therefore expects unknown upstream divergence, recorded as
`ahead -1 / behind -1`.

Because `Stale after commit` is `true`, the documentation-only closeout commit
may leave the recorded code head as its parent while still passing state-sync.

## Next Safe Action

Create the documentation-only Commit 3, then run the V2 post-commit validation
set. Do not run real Codex CLI, workspace-write execution, tag, release,
deploy, modify secrets, push, merge, or create remote objects without separate
explicit authorization.
