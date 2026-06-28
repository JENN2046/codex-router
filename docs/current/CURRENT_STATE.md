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
| Current branch | `fix/runtime-governance-host-dispatch-failure` |
| Current head | `363e587` |
| Validated source commit | `363e587` |
| Upstream | `refs/remotes/origin/main` |
| Upstream divergence | `ahead 2 / behind 0` |
| Latest validated commit | `363e587` |
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
- validated source commit: `363e587`
- latest validated commit: `363e587`
- upstream baseline: `refs/remotes/origin/main`
- recorded divergence baseline: `ahead 2 / behind 0`
- source tree digest: `git-ls-tree-sha256`
  `e8aa449dd7c913f4a0c4bf5d4c9442516e02d1992d9b5ceed11f021a986c6456`

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

This state record commit records the source commits that:

- route `codex-cli` host-dispatch failures through the shared runtime
  governance failure reducer when a governance state is supplied;
- emit a `host_dispatch` execution observation for failed host dispatches;
- call `onGovernanceUpdate` with the reduced governance state and strategy
  decision;
- return recovery governance only when the shared reducer routes the failure to
  recovery;
- preserve successful host-dispatch behavior without governance updates; and
- harden display sync so `## State Sync Expectations` replacements match the
  standalone Markdown heading, not prose that merely mentions the heading text.

This work does not run real provider execution and does not run the real Codex
CLI. Runtime validation uses injected handlers, fake dispatchers, and local test
harnesses only.

## Validation Baseline

Validation recorded for source commit `363e587`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/desktop-live-adapter-governance.test.ts
  tests/desktop-live-adapter.test.ts tests/host-dispatcher.test.ts
  tests/governance-failure-reducer.test.ts`: PASS.
- `node --import tsx --test tests/state-sync-display-sync.test.ts
  tests/state-sync-audit.test.ts`: PASS.
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

- structured claim: `fix/runtime-governance-host-dispatch-failure` / `state_only_pending_push` against
  `refs/remotes/origin/main`
- validated source commit: `363e587`
- latest validated commit: `363e587`
- recorded divergence baseline: `ahead 2 / behind 0`
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

- branch: `fix/runtime-governance-host-dispatch-failure`
- upstream: `refs/remotes/origin/main`
- validated source commit: `363e587`
- recorded divergence baseline: `ahead 2 / behind 0`
- transition: `state_only_pending_push`

For this `state_only_pending_push` record on branch `fix/runtime-governance-host-dispatch-failure`,
Git observation should compute the validated source divergence as
`ahead 2 / behind 0` against `refs/remotes/origin/main` before the state-only
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
