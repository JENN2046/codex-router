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
  `c24b1c0e2eb00f45da1f59eddb9d7b3a77c95841867c5c7c54243ef3b08f79df`

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
- Phase 6 controlled execution runtime hardening is the next staged runtime
  line. Its baseline is recorded in
  `docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE.md`.
- Controlled read-only provider execution is now exposed as the current
  acceptance line `npm run governance -- acceptance controlled-readonly-provider-execution`.
- Controlled read-only execution evidence binding is recorded in
  `docs/governance/PR_23C_EXECUTION_EVIDENCE_BINDING.md`; it strengthens
  sanitized refs and hashes without authorizing broader execution.
- Phase 6 read-only provider permit lifecycle hardening is recorded in
  `docs/governance/PHASE_6_READONLY_PROVIDER_PERMIT_LIFECYCLE_HARDENING.md`;
  the current controlled read-only acceptance covers expiration, nonce, replay,
  and permit store-failure behavior.
- Workspace-write permit v2 schema, validators, rollback binding, and
  single-use consumption helper are recorded in
  `docs/governance/PR_23D_WORKSPACE_WRITE_PERMIT_V2.md`; this is readiness
  infrastructure only, not workspace-write execution authorization.
- Real provider execution, real Codex CLI execution, secret changes, dependency
  changes, workflow changes, and direct `main` pushes remain outside normal
  display-only pruning work.

## Validation Baseline

Validation recorded for source commit `content digest only`:

Current validation posture:

- non-`main` PR branch validation should use `npm run validate:daily`,
  targeted `npm test` / `npm run build` when warranted, display sync checks,
  and GitHub CI's `pull_request` State Sync Audit or an explicit local
  pull-request context simulation;
- bare `npm run validate:pr` includes the local state-sync audit tier and is
  only appropriate on local `main` or when the state-sync audit has an explicit
  PR event context;
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

Current allowed-by-default behavior is local and non-executing unless a specific
task and approval gate says otherwise. The controlled provider execution
baseline remains documented at
`docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`, with the
current audit entry point `npm run governance -- audit controlled-provider-execution-taskbook-review`.
Phase 6 now records the PR-23A runtime-hardening baseline at
`docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE.md`;
that baseline sequences future work but does not authorize real provider,
real Codex CLI, or real workspace-write execution.
The PR-23B controlled read-only minimal slice is recorded at
`docs/governance/PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md`
and exposed through `npm run governance -- acceptance controlled-readonly-provider-execution`.
The PR-23C evidence-binding line is recorded at
`docs/governance/PR_23C_EXECUTION_EVIDENCE_BINDING.md`; it binds controlled
read-only evidence to preflight, registry, permit, plan, policy, principal, and
report refs/hashes.
The Phase 6 read-only provider permit lifecycle line is recorded at
`docs/governance/PHASE_6_READONLY_PROVIDER_PERMIT_LIFECYCLE_HARDENING.md`;
it keeps the same acceptance entry point while adding expiration, nonce, replay,
and store-failure coverage.
The PR-23D workspace-write permit v2 line is recorded at
`docs/governance/PR_23D_WORKSPACE_WRITE_PERMIT_V2.md`; it adds schema,
validator, rollback-binding, and single-use consumption readiness without
authorizing real workspace-write.
The PR-23E workspace-write fake canary v2 line is recorded at
`docs/governance/PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2.md`; it wires the fake
canary to permit v2, patch guard, rollback evidence, and replay blocking while
still proving zero real workspace-write, zero real Codex CLI, and zero external
writes.
The Phase 6 controlled execution runtime hardening closeout is recorded at
`docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md`;
it closes the PR-23A through PR-23F runtime-hardening stage without authorizing
real workspace-write by default.

Boundary audit marker:

- `PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED`

Blocked capabilities:

- `general_workspace_write`
- `general_provider_execution`
- `protected_remote_write`
- `push_to_main`
- `release_tag_deploy`
- `secret_or_credential_change`
- `external_service_write`

Boundary facts for display/handoff-only pruning:

- display and handoff surfaces do not authorize execution;
- package, dependency, workflow, provider, env, secret, user config, and system
  config changes remain outside display-only pruning;
- real provider execution and real Codex CLI execution remain closed without a
  separate explicit task and approval gate;
- release, deploy, provider execution, and environment/configuration changes
  remain out of scope.

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
