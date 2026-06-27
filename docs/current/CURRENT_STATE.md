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
| Current head | `dceb4c7` |
| Validated source commit | `dceb4c7` |
| Upstream | `origin/fix/jsonl-event-log-structured-error` |
| Upstream divergence | `ahead 1 / behind 0` |
| Latest validated commit | `dceb4c7` |
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
validated source baseline for `dceb4c7`, not a future state-only commit's
own ahead / behind value. The earlier JSONL structured error fix remains
included in branch history. The current source change is limited to the State
Sync Audit CI checkout shape.

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

Recorded source facts for PR47-P1-CI-CHECKOUT-STATE-SYNC-ANCHOR-REACHABILITY:

- Current head is `dceb4c7`.
- Validated source commit is `dceb4c7`.
- Latest validated commit is `dceb4c7`.
- Upstream is `origin/fix/jsonl-event-log-structured-error`.
- Upstream divergence is `ahead 1 / behind 0`.
- State Sync Audit CI now checks out the PR branch ref with full history using
  `fetch-depth: 0` and `ref: ${{ github.head_ref || github.ref_name }}`.
- Previous validated source commit `09e2e9a` is expected to remain reachable
  from the PR branch head that failed remote CI.
- The known failure cause is CI checkout / ancestry verification shape, not a
  weakening of state-sync audit logic.
- No package, dependency, remote, provider-execution, env, or secret change is
  part of this state record.

## Remote State

- Push is authorized only after final local validation passes and the worktree
  is clean.
- No PR edit, manual CI rerun, review-thread resolution, release, deploy, or
  npm publish is authorized.
- Correct status phrase before final push: locally validated, state alignment
  in progress.

## Validation Baseline

Validation baseline for source commit `dceb4c7`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Local PR #47 P1 CI checkout remediation validation:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS,
  `status: passed`, `dirtyWorktreeStateOnly: true`, `reasons: []`,
  `issues: []`.

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

- CI workflow checkout changes are committed in `dceb4c7`.
- No package or dependency changes.
- Current source head is recorded as `dceb4c7`.
- This state/docs update is not committed yet.
- No push or remote write has happened yet.
- No real provider execution.
- No env, secret, user config, or system config edit.

## Current Local Changes

The validated source commit exists and is the current validated state anchor.
Current local state changes are limited to:

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
`dceb4c7`. The state-only record commit may descend from this source commit
without writing its own commit hash back into tracked state files.

Current state line:

- PR47 JSONL/state-sync fixes: mostly correct.
- Synthetic anchor hardening: correct.
- Remote CI: failed.
- Failure cause: State Sync Audit checkout/ancestry verification.
- Active P1: yes.
- Merge: blocked.
- Next: fix CI checkout, not weaken audit logic.

## Next Safe Action

Run the state-sync audit, commit state/docs only, run final validation, then
push this branch only if the final validation passes and the worktree is clean.
