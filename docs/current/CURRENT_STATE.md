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
| Current branch | `content-attestation` |
| Current head | `observed at audit time` |
| Validated source commit | `content digest only` |
| Upstream | `refs/remotes/origin/main` |
| Upstream divergence | `observed at audit time` |
| Latest validated commit | `content digest only` |
| State record mode | `content attestation` |
| Stale after commit | `true` |
| Synthetic review checkout | `allowed` |

The `Current head` row records the validated source head represented by the
structured state-sync claim. A later state-only record commit may descend from
this source commit without making Markdown the source of truth again.

## Structured Record

The structured claim records:

- schema version: `2`
- policy version: `state-sync-policy.v2`
- transition kind: `content_attestation`
- validated source commit: `content digest only`
- latest validated commit: `content digest only`
- upstream baseline: `refs/remotes/origin/main`
- recorded divergence baseline: `observed at audit time`
- source tree digest: `git-ls-tree-sha256`
  `470be529697f3bbaccda303bbb2099e7d42f08e006a37eb1a8684d25e10d0a4a`

Source digest excluded paths:

- `docs/current/state-sync-record.json`
- `docs/current/CURRENT_STATE.md`
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

Current repository governance status:

- State-sync authority is the policy v2 content-attestation record at
  `docs/current/state-sync-record.json`.
- Markdown and `.agent_board/*` are current-state display and handoff surfaces,
  not machine authority.
- Legacy v1 reanchor tools remain available only as explicit compatibility
  fallback for old state-only records.
- Runtime governance hardening and operator-action work is merged; this state
  surface should describe current repository status rather than any old PR as
  the active task.
- Real provider execution, real Codex CLI execution, secret changes, dependency
  changes, workflow changes, and direct `main` pushes remain outside normal
  display-only pruning work.

## Validation Baseline

Validation recorded for source commit `content digest only`:

Current validation posture:

- routine PR validation remains `npm run validate:pr`;
- display-only state pruning should at minimum run `git diff --check`,
  `node --import tsx scripts/sync-state-sync-display.ts --check`, and a PR
  context state-sync audit simulation;
- runtime, package, workflow, dependency, or provider changes require their
  own targeted tests and broader validation.

Current structured state-sync audit status:

- structured claim: `state-sync-policy.v2` content attestation
- upstream target: `refs/remotes/origin/main`
- source identity: filtered tree digest, not a recorded commit SHA
- branch, commit, and divergence are observed by the audit at runtime
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Source-tree digest, allowed context, clean worktree, and read-only
  checks remain enforced by the state-sync audit.
- Generated display, Markdown mirrors, and `.agent_board/*` mirrors are
  optional operator-facing views derived from `docs/current/state-sync-record.json`.
- Display drift is informational; branch-head audit reads the structured
  record directly and does not require display sync.
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

The machine state-only record line is limited to:

- `docs/current/state-sync-record.json`

Markdown and `.agent_board/*` display updates are optional operator evidence,
not state-only authority.

## State Sync Expectations

The structured claim records:

- branch: `content-attestation`
- upstream: `refs/remotes/origin/main`
- validated source commit: `content digest only`
- recorded divergence baseline: `observed at audit time`
- transition: `content_attestation`

Policy v2 records bind the filtered source tree digest to explicit local, pull_request, and push contexts; branch identity, commit identity, and divergence are audit-time observations.

The collector uses the structured claim's `refs/remotes/origin/main` value as
the bounded upstream baseline ref. It must resolve that ref locally and then
compute divergence from Git. If the ref does not resolve, upstream-dependent
checks remain blocked.

Current state line:

- State-sync authority: `docs/current/state-sync-record.json` using
  `state-sync-policy.v2` content attestation.
- Main path: local, pull_request, and main-push audits verify the filtered
  source tree digest; squash merges do not require routine post-merge
  reanchors.
- Markdown and `.agent_board/*`: evidence/display surfaces only; display sync is
  an optional freshness helper, not a governance authority.
- Legacy v1 reanchor tooling and workflow: retained only as explicit
  compatibility fallback for old v1 state-only records.
