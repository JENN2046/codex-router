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
  `e5ca3b77812a5f8a0e5b193fa6289c2cde44f55e9c1238b6c1b8c73e4c0a52b9`

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

This state record commit records the source commit that:

- adds `createRuntimeSignalFromGovernanceState()` to `runtime-control`;
- derives runtime failure count from `execution_failure` governance anomalies;
- maps high and critical governance risk to sticky `risk_detected` runtime
  signals;
- carries governance context pressure into the runtime signal consumed by
  `evaluateRuntimeSignals()`;
- preserves caller-provided runtime event overrides for validation and scope
  signals; and
- expands `tests/runtime-control.test.ts` to cover no-op, failure-threshold
  escalation, scope expansion, validation failure, context pressure, high-risk
  open-circuit, and governance-state signal derivation.

This work does not run real provider execution, does not run the real Codex CLI,
and does not push to `main`.

## Validation Baseline

Validation recorded for source commit `content digest only`:

- `git diff --check`: PASS.
- `node --import tsx --test tests/runtime-control.test.ts`: PASS.
- `npm test`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS.

State-sync required validation command literals retained in this state surface:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

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

- Structured state-sync plan: recorded.
- Phase 1 structured claim verifier: implemented and tested.
- Phase 2 missing-claim gate and Markdown authority removal: implemented and
  tested.
- Phase 3 display-sync script: implemented and tested.
- Phase 4 state-sync audit on `push` to `main`: implemented and gated on a
  committed `main` / `state_only_pushed` record.
- Bounded source tree digest verification for squash-only state records:
  implemented and tested.
- Markdown and `.agent_board/*` display drift blocking: retired from the
  branch-head state-sync audit; display sync is now an optional freshness tool.
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
