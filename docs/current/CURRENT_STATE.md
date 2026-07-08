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
  `0086bc0ae906ce4064bde2b278d9d07d9998ae66ec36ac00ffd7a6afab711dd2`

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
- Phase 6 controlled execution runtime hardening is closed out in
  `docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md`.
- Phase 7 runtime operator actionability is closed out in
  `docs/governance/PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md`.
- Phase 8 operator action lifecycle receipt validation and receipt-store
  primitives are closed out in
  `docs/governance/PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md`.
- Phase 9 operator action host lifecycle integration is closed out in
  `docs/governance/PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md`.
- Phase 10 operator action executor gate is closed out in
  `docs/governance/PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md`; the
  gate is plan-only and does not authorize recovery execution.
- Phase 11 operator action host executor boundary is recorded in
  `docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md`;
  this is a non-executing taskbook for future authorization packet and injected
  host executor descriptor work.
- Phase 11 operator action host executor boundary is closed out in
  `docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md`;
  the implemented boundary is non-executing and does not authorize recovery
  action dispatch.
- Phase 12 operator action host client review surface is closed out in
  `docs/governance/PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md`;
  host clients can expose Phase 11 review results from current lifecycle state,
  but still do not authorize recovery action dispatch.
- Phase 13 operator action host executor dispatch is recorded in
  `docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md`;
  this was the authorization stop before the first controlled implementation.
- Phase 13 operator action host executor dispatch is closed out in
  `docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md`;
  dry-run and explicit injected-executor dispatch control exist, but real
  recovery action dispatch remains blocked by default.
- Phase 13 agent-backed recovery executor boundary is recorded in
  `docs/governance/PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md`;
  host-provided / agent-backed executor semantics and a sandbox-only reference
  executor contract proof exist, but production recovery execution remains
  outside this repository.
- Phase 14 agent executor receipt contract is recorded in
  `docs/governance/PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md`; injected
  executor receipt statuses can now be normalized as `accepted`, `running`,
  `completed`, `failed`, `refused`, or `aborted` without authorizing real
  recovery execution.
- Phase 15 agent executor adapter authorization taskbook is recorded in
  `docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md`;
  it defines future adapter packet, pre-execution review, rollback expectation,
  and exact approval strings without authorizing Codex CLI, provider,
  sub-agent runtime, shell, workspace-write, or production recovery execution.
- Phase 15 agent executor adapter review-only readiness is closed out in
  `docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md`;
  it implements review-only adapter descriptor, packet, hash, and readiness
  review surfaces without adapter invocation, Codex CLI, provider,
  sub-agent runtime, shell, workspace-write, external write, or production
  recovery execution.
- Phase 15 agent executor adapter sandbox contract is closed out in
  `docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md`;
  it implements an explicitly injected sandbox reference adapter contract
  witness with sanitized audit and sandbox-contained test artifacts, without
  Codex CLI, provider, sub-agent runtime, shell, real workspace-write, external
  write, or production recovery execution.
- Phase 16 agent executor adapter dispatch authorization is recorded in
  `docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md`;
  it defines future adapter dispatch authorization packets, dispatch classes,
  side-effect classes, audit, receipt, scope, and fail-closed requirements
  without implementing adapter dispatch or authorizing Codex CLI, provider,
  sub-agent runtime, shell/process execution, real workspace-write, external
  write, or production recovery execution.
- Phase 16 agent executor adapter dispatch authorization review-only
  implementation is closed out in
  `docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md`;
  it implements packet/readiness binding for `review_only` + `none` without
  invoking an adapter, Codex CLI, provider, sub-agent runtime, shell/process
  execution, real workspace-write, external write, or production recovery
  execution.
- Phase 16 agent executor adapter dispatch sandbox dry-run taskbook is recorded
  in
  `docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md`;
  it records the planning boundary for binding Phase 16 dispatch authorization
  to the Phase 15 sandbox reference adapter contract witness under
  `sandbox_contract` and `sandbox_only`.
- Phase 16 agent executor adapter dispatch sandbox dry-run implementation is
  closed out in
  `docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md`;
  it implements the exact approved sandbox dry-run path using only an explicitly
  injected `sandbox_reference_adapter`, sanitized audit/evidence sinks, and
  Phase 15 sandbox contract binding. It does not authorize Codex CLI, provider,
  sub-agent runtime, shell/process execution, real workspace-write, external
  write, production recovery, or real `resume`, `rollback`, `abort`, or `fork`
  execution.
- Phase 17 agent task control dispatch boundary is recorded in
  `docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md`;
  it defines future `agent_task_control` + `agent_context_only` packet,
  host-responsibility, audit/evidence, and fail-closed requirements. It is a
  taskbook boundary and does not authorize Codex CLI, provider, sub-agent
  runtime, shell/process execution, real workspace-write, external write,
  production recovery, or real recovery-action execution.
- Phase 17 agent task control dispatch authorization review-only
  implementation is closed out in
  `docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md`;
  it implements non-executing `agent_task_control` + `agent_context_only`
  packet binding against Phase 10/11/15/16 identities, host-agent refs,
  context refs, idempotency, timeout, and sink identities. It does not invoke
  an adapter, Codex CLI, provider, sub-agent runtime, shell/process execution,
  real workspace-write, external write, production recovery, or real recovery
  action.
- Phase 18 agent task control dispatch sandbox dry-run taskbook is recorded in
  `docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md`;
  it defines the sandbox-only task-control contract witness and separate
  sandbox task-control adapter boundary.
- Phase 18 agent task control dispatch sandbox dry-run implementation is closed
  out in
  `docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md`;
  it binds a ready Phase 17 authorization review to an explicitly injected
  `sandbox_task_control_adapter`, sanitized audit/evidence sinks, and
  sandbox-contained test artifacts. It does not authorize Codex CLI, provider,
  sub-agent runtime, shell/process execution, real workspace-write, external
  write, production recovery, or real recovery action.
- Public contract compatibility closeout is recorded in
  `docs/governance/PUBLIC_CONTRACT_COMPATIBILITY_CLOSEOUT.md`; new consumers
  should use `codex-router/protocol`, `kernel-contracts` is the canonical
  public contract source behind that facade, and `contracts` remains legacy
  compatibility only.
- Controlled read-only provider execution is now exposed as the current
  acceptance line
  `npm run governance -- acceptance controlled-readonly-provider-execution`.
  Use `--check` for no-write local review; omit it only to intentionally
  refresh committed acceptance evidence.
- Controlled read-only execution evidence binding is recorded in
  `docs/governance/PR_23C_EXECUTION_EVIDENCE_BINDING.md`; it strengthens
  sanitized refs and hashes without authorizing broader execution.
- The execution-boundary current surface records
  `narrow_readonly_provider_dispatch_without_boundary_inheritance`: read-only
  provider dispatch does not inherit into host executor authorization, read-only
  provider dispatch does not inherit into sub-agent runtime authorization,
  read-only provider dispatch does not inherit into workspace-write
  authorization, and read-only provider dispatch does not inherit into release
  authorization. The same lattice does not promote real Codex CLI
  authorization or external-write authorization.
  Codex CLI host does not authorize host executor or sub-agent runtime;
  sub-agent runtime does not invoke Codex CLI or provider execution; host
  executor does not execute provider or sub-agent runtime.
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
  targeted `npm test` / `npm run build` when warranted, the execution-boundary
  current surface audit, display sync checks, and GitHub CI's `pull_request`
  State Sync Audit or an explicit local pull-request context simulation;
- bare `npm run validate:pr` includes the local execution-boundary audit and
  local state-sync audit tier, and is only appropriate on local `main` or when
  the state-sync audit has an explicit PR event context;
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
current static boundary entry point
`npm run governance -- audit controlled-provider-execution-taskbook-review-boundary`.
The deeper `controlled-provider-execution-taskbook-review` audit remains an
explicit main/clean-context review gate.
The state-sync current static boundary entry point is
`npm run governance -- audit state-sync-boundary`. The deeper `state-sync`
audit remains the PR/local state consistency gate and observes branch, commit,
divergence, clean-worktree, repository identity, source-tree digest, and
structured record facts at runtime; it does not authorize provider execute,
real Codex CLI, workspace-write, host executor, sub-agent runtime, external
write, evidence refresh, push, or release.
The capability taxonomy escalation policy current static boundary entry point is
`npm run governance -- audit capability-taxonomy-escalation-policy-boundary`.
The deeper `capability-taxonomy-escalation-policy` audit remains an explicit
main/clean-context taxonomy and evidence review gate.
The approval consumption dispatch matrix current static boundary entry point is
`npm run governance -- audit approval-consumption-dispatch-matrix-boundary`.
The deeper `approval-consumption-dispatch-matrix` audit remains an explicit
main/clean-context matrix review gate.
The read-only productization current static boundary entry point is
`npm run governance -- audit readonly-productization-boundary`. The deeper
`readonly-productization` audit remains an explicit main/clean-context
productization acceptance gate.
Phase 6 now records the PR-23A runtime-hardening baseline at
`docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE.md`;
that baseline sequences future work but does not authorize real provider,
real Codex CLI, or real workspace-write execution.
The PR-23B controlled read-only minimal slice is recorded at
`docs/governance/PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md`
and exposed through
`npm run governance -- acceptance controlled-readonly-provider-execution --check`
for no-write local review.
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
The Phase 7 runtime operator actionability closeout is recorded at
`docs/governance/PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md`; it
standardizes preflight governance blocks, operator action envelopes, host
surfaces, summaries, and evidence resolution without authorizing recovery
execution.
The Phase 8 operator action lifecycle closeout is recorded at
`docs/governance/PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md`; it validates
operator action receipts, expiry, replay blocking, durable receipt-store
primitives, and lockdown receipt policy without executing the recommended
action.
The Phase 9 operator action host lifecycle closeout is recorded at
`docs/governance/PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md`; it wires
receipt consumption, receipt authoring, and current lifecycle state into host
clients without authorizing recovery execution.
The Phase 10 operator action executor gate closeout is recorded at
`docs/governance/PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md`; it adds a
plan-only executor gate that requires durable receipt proof, lifecycle binding,
action allowlists, and checkpoint-preserving plans without authorizing recovery
execution.
The Phase 11 operator action host executor boundary taskbook is recorded at
`docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md`;
it defines a future non-executing authorization packet and injected host
executor descriptor boundary without authorizing recovery action dispatch.
The Phase 11 operator action host executor boundary closeout is recorded at
`docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md`;
it implements the descriptor, authorization packet, lifecycle binding, and
review result boundary without calling or exposing a side-effecting host
executor.
The Phase 12 operator action host client review surface closeout is recorded at
`docs/governance/PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md`;
it exposes the Phase 11 non-executing review through `DesktopHostClient`
current lifecycle state without bridge calls, `dispatchToHost()`, provider
execution, Codex CLI execution, workspace-write, or recovery action dispatch.
The Phase 13 operator action host executor dispatch taskbook is recorded at
`docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md`;
it defines the authorization token and stop conditions for the first controlled
implementation.
The Phase 13 operator action host executor dispatch closeout is recorded at
`docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md`;
it adds dry-run and explicit injected-executor dispatch control without adding
a real recovery executor, provider execution, Codex CLI execution,
workspace-write, or `dispatchToHost()` recovery execution.
The Phase 13 agent-backed recovery executor boundary is recorded at
`docs/governance/PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md`;
it defines host-provided / agent-backed executor semantics and a sandbox-only
reference executor contract proof without adding production recovery logic,
Codex CLI execution, provider execution, shell execution, external writes, or
arbitrary workspace-write.
The Phase 14 agent executor receipt contract is recorded at
`docs/governance/PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md`; it normalizes
injected executor receipt statuses and stable reason codes without adding a
Codex CLI adapter, provider adapter, shell/process executor, external write,
workspace-write, or production recovery execution.
The Phase 15 agent executor adapter authorization taskbook is recorded at
`docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md`;
it defines future adapter pre-execution requirements and exact approval
strings without authorizing Codex CLI invocation, provider invocation,
sub-agent runtime invocation, shell/process execution, external write,
workspace-write, or production recovery execution.
The Phase 15 agent executor adapter review-only closeout is recorded at
`docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md`;
it implements review-only adapter descriptor, packet, hash, and readiness
review surfaces without adding adapter invocation, Codex CLI invocation,
provider invocation, sub-agent runtime invocation, shell/process execution,
external write, workspace-write, or production recovery execution.
The Phase 15 agent executor adapter sandbox contract closeout is recorded at
`docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md`;
it implements a sandbox-only reference adapter contract witness with explicit
injection, sanitized audit, packet/readiness binding, and sandbox-contained
test artifacts without adding Codex CLI invocation, provider invocation,
sub-agent runtime invocation, shell/process execution, real workspace-write,
external write, or production recovery execution.
The Phase 16 agent executor adapter dispatch authorization taskbook is recorded
at
`docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md`;
it defines future dispatch authorization requirements for adapter packets,
dispatch classes, side-effect classes, audit, receipts, scope, and fail-closed
behavior without implementing adapter dispatch or authorizing Codex CLI
invocation, provider invocation, sub-agent runtime invocation, shell/process
execution, real workspace-write, external write, or production recovery
execution.
The Phase 16 agent executor adapter dispatch authorization review-only closeout
is recorded at
`docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md`;
it implements dispatch authorization packet/readiness binding for `review_only`
and `none` without invoking an adapter, Codex CLI, provider, sub-agent runtime,
shell/process execution, real workspace-write, external write, or production
recovery execution.
The Phase 16 agent executor adapter dispatch sandbox dry-run taskbook is
recorded at
`docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md`;
it records the planning boundary for binding Phase 16 dispatch authorization to
the Phase 15 sandbox reference adapter contract witness under
`sandbox_contract` and `sandbox_only`.
The Phase 16 agent executor adapter dispatch sandbox dry-run closeout is
recorded at
`docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md`;
it implements the exact approved sandbox dry-run path with an explicitly
injected `sandbox_reference_adapter`, sanitized audit/evidence, and fail-closed
packet binding, without Codex CLI invocation, provider invocation, sub-agent
runtime invocation, shell/process execution, real workspace-write, external
write, production recovery, or real recovery-action execution.
The Phase 17 agent task control dispatch boundary taskbook is recorded at
`docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md`;
it defines future `agent_task_control` and `agent_context_only` authorization
requirements for host-provided agent adapters while keeping Codex CLI
invocation, provider invocation, sub-agent runtime invocation, shell/process
execution, real workspace-write, external write, production recovery, and real
recovery-action execution blocked.
The Phase 18 agent task control dispatch sandbox dry-run taskbook is recorded
at
`docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md`;
it defines the sandbox-only task-control contract witness boundary.
The Phase 18 agent task control dispatch sandbox dry-run implementation is
closed out at
`docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md`;
it can call only an explicitly injected `sandbox_task_control_adapter` contract
witness after the Phase 18 packet and ready Phase 17 authorization review bind.
Codex CLI invocation, provider invocation, sub-agent runtime invocation,
shell/process execution, real workspace-write, external write, production
recovery, and real recovery-action execution remain blocked.

Boundary audit marker:

- `PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED`
- `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK_RECORDED`
- `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT_RECORDED`
- `PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT_RECORDED`
- `PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK_RECORDED`
- `PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT_RECORDED`
- `PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY_RECORDED`
- `PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT_RECORDED`
- `PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK_RECORDED`
- `PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT_RECORDED`
- `PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT_RECORDED`
- `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK_RECORDED`
- `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT_RECORDED`
- `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK_RECORDED`
- `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT_RECORDED`
- `PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK_RECORDED`
- `PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT_RECORDED`
- `PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK_RECORDED`
- `PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT_RECORDED`

Blocked capabilities:

- `real_agent_task_control_dispatch`
- `general_workspace_write`
- `general_provider_execution`
- `recovery_action_dispatch`
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
