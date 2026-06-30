# Current State

CURRENT_STATE_RECORDED

This is the compact operator-facing state surface for the repository. The
machine-authoritative state-sync claim is now:

- `docs/current/state-sync-record.json`

Markdown and `.agent_board/*` remain evidence and handoff surfaces. They are not
the authority for core machine facts such as validated source commit, upstream
divergence, transition kind, or allowed state-only paths.

## Snapshot

| Field | Value |
| --- | --- |
| Workspace | `codex-router/repo` |
| Current branch | `improve/state-sync-main-reanchor-runner` |
| Current head | `88ca86c` |
| Validated source commit | `88ca86c` |
| Upstream | `refs/remotes/origin/main` |
| Upstream divergence | `ahead 1 / behind 0` |
| Latest validated commit | `88ca86c` |
| State record mode | `state-only descendant allowed` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

The `Current head` row records the validated source head represented by the
structured state-sync claim. A later state-only record commit may descend from
this source commit without making Markdown the source of truth again.

## Structured Record

The structured claim records:

- schema version: `1`
- policy version: `state-sync-policy.v1`
- transition kind: `state_only_pending_push`
- validated source commit: `88ca86c`
- latest validated commit: `88ca86c`
- upstream baseline: `refs/remotes/origin/main`
- recorded divergence baseline: `ahead 1 / behind 0`
- source tree digest: `git-ls-tree-sha256`
  `e0d0ed103db2b8553edad2d82b4c59744f519d4a65fc1e3fc99b969ab3f45d0d`

Strict state record paths:

- `docs/current/CURRENT_STATE.md`
- `docs/current/state-sync-record.json`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## Current Entrypoints

- Current docs map: `docs/README.md`
- Governance docs map: `docs/governance/README.md`
- Validation policy: `docs/validation-tiers.md`
- Current state audit: `npm run governance -- audit state-sync`
- Governance runner discovery: `npm run governance -- list`

## Current Scope

This state record commit records the source commit that:

- adds `scripts/run-state-sync-main-reanchor.ts` as a guarded local runner for
  operator-authorized post-merge `main` state-sync reanchors;
- keeps the default runner mode read-only and requires explicit write / commit /
  push flags for state changes;
- refuses to operate outside `main` and requires local `HEAD` to match
  `refs/remotes/origin/main` before writing;
- validates strict state/docs paths, generated display sync, and state-sync
  audit before committing when validation is enabled;
- fetches `origin/main` again immediately before push and blocks if the remote
  moved while the local reanchor was prepared;
- documents that the existing `state-sync/reanchor-main` PR workflow remains the
  conservative fallback when direct `main` push is not authorized; and
- records regression coverage for no-op, non-main branch rejection, bounded
  commit/push, and stale remote push blocking.

This work does not run real provider execution, does not run the real Codex CLI,
and does not push to `main`. Push behavior is covered with temporary local Git
remotes in tests.

## Validation Baseline

Validation recorded for source commit `88ca86c`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/state-sync-reanchor-automation.test.ts
  tests/state-sync-reanchor-helper.test.ts tests/state-sync-display-sync.test.ts
  tests/canary-evidence.test.ts`: PASS.
- `npm test`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `node --import tsx scripts/sync-state-sync-display.ts --check`: PASS.
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Current structured state-sync audit status:

- structured claim: `improve/state-sync-main-reanchor-runner` / `state_only_pending_push` against
  `refs/remotes/origin/main`
- validated source commit: `88ca86c`
- latest validated commit: `88ca86c`
- recorded divergence baseline: `ahead 1 / behind 0`
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Git ancestry, divergence, source-tree digest, and strict state path
  checks remain enforced by the state-sync audit.
- Generated display, Markdown mirrors, and `.agent_board/*` mirrors are
  evidence surfaces derived from `docs/current/state-sync-record.json`.
- Evidence drift remains blocking through `state_sync_evidenceDriftAbsent`.
## Execution Boundary

PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED

The controlled provider execution taskbook review audit remains part of the
current safety baseline:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- `controlled-provider-execution-taskbook-review`
- `general_provider_execution` remains closed by default
- `general_workspace_write` remains closed by default
- `secret_or_credential_change` remains closed by default

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

- No package, dependency, workflow, provider, env, secret, user config, or system
  config file is changed by this state record.
- No real provider execution has occurred.
- No real Codex CLI execution has occurred.
- This state record commit intentionally changes only state/docs display and
  handoff surfaces.
- No release, deploy, provider execution, or environment/configuration change is
  part of this record.

## Current State-Only Record

This state-only record line is limited to:

- `docs/current/CURRENT_STATE.md`
- `docs/current/state-sync-record.json`
- `.agent_board/CHECKPOINT.md`
- `.agent_board/HANDOFF.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/TASK_QUEUE.md`
- `.agent_board/VALIDATION_LOG.md`

## State Sync Expectations

The structured claim records:

- branch: `improve/state-sync-main-reanchor-runner`
- upstream: `refs/remotes/origin/main`
- validated source commit: `88ca86c`
- recorded divergence baseline: `ahead 1 / behind 0`
- transition: `state_only_pending_push`

For this `state_only_pending_push` record on branch `improve/state-sync-main-reanchor-runner`,
Git observation should compute the validated source divergence as
`ahead 1 / behind 0` against `refs/remotes/origin/main` before the state-only
record is pushed.

The collector uses the structured claim's `refs/remotes/origin/main` value as
the bounded upstream baseline ref. It must resolve that ref locally and then
compute divergence from Git. If the ref does not resolve, upstream-dependent
checks remain blocked.

Current state line:

- Structured state-sync plan: recorded.
- Phase 1 structured claim verifier: implemented and tested.
- Phase 2 missing-claim gate and Markdown authority removal: implemented and
  tested.
- Phase 3 display-sync script: implemented and tested.
- Phase 4 state-sync audit on `push` to `main`: implemented and gated on a
  committed `main` / `state_only_pushed` record.
- Bounded source tree digest verification for squash-only state records:
  implemented and tested.
- Evidence drift blocking for machine-mirrored Markdown fields: implemented and
  tested.
- Empty and missing machine-mirrored field blocking: implemented and tested.
- Structured `CURRENT_STATE.md` display mirror drift blocking: implemented and
  tested.
- `CURRENT_STATE.md` State Sync Expectations mirror drift blocking:
  implemented and tested.
- Per-file agent-board generated block count checks: implemented and tested.
- Unknown structured claim field fail-closed behavior: implemented and tested.
- Machine-authoritative claim file: introduced.
- Markdown and agent board: evidence/display surfaces.
- Strict state record path convergence: implemented, merged through PR #51, and
  reanchored on `main`.
- State/docs cleanup: merged through PR #52 and reanchored on `main`.
- Post-PR #53 `main` reanchor and state/docs cleanup: recorded.
- State-sync reanchor preparation helper: merged through PR #54.
- P1 squash fallback digest hardening: merged through PR #54.
- Post-PR #54 `main` reanchor: pushed and validated.
- Conservative post-merge reanchor PR automation: implemented on
  `automate/state-sync-reanchor-pr`.
