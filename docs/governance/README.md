# Governance Docs

This directory is evidence-heavy by design. Use this current surface first.
PR-specific taskbooks, phase closeouts, authorization packets, receipts, and
dated plans remain historical evidence unless a current authority document
explicitly promotes them.

## Current Surface

- [current state](../current/CURRENT_STATE.md): machine authority, current
  capability posture, freeze, validation baseline, and next governed step.
- [Codex execution-governance architecture](CODEX_EXECUTION_GOVERNANCE_ARCHITECTURE.md):
  product boundary, authorization chain, App Server adapter, preview, retain,
  rollback, and supported public surface.
- [Codex governance baseline](CODEX_GOVERNANCE_BASELINE.md): frozen API,
  classification counterexamples, CI posture, and execution boundaries.
- [governance control plane](GOVERNANCE_CONTROL_PLANE.md): authority model,
  capability status, and default runtime posture.
- [release gate matrix](RELEASE_GATE_MATRIX.md): PR, main, and release gates
  plus failure consequences.
- [evidence policy](EVIDENCE_POLICY.md): allowed evidence fields, forbidden raw
  material, and evidence-reference rules.
- [threat model](THREAT_MODEL.md): current threats and controls.
- [change control](CHANGE_CONTROL.md): required docs and validation for a
  governance boundary change.
- [merge integrity gate](MERGE_INTEGRITY.md): protected-path structured lock
  metadata, lock-digest and exact-head unlock records, fail-closed GitHub
  inventory, minimum workflow permissions, and pinned GitHub Action revisions.
- [R3A-2 Merge Integrity platform preflight](R3A2_MERGE_INTEGRITY_PLATFORM_PREFLIGHT.md):
  executed authorization package containing the exact ruleset diff,
  required-status limitation, no-bypass policy, never-merged canary, rollback,
  evidence scope, and confirmation text.
- [R3A-3 Merge Integrity closeout](R3A3_MERGE_INTEGRITY_CLOSEOUT.md):
  independent platform evidence, accepted any-source threat model, ordinary-CI
  limitation, and R2/R3A closeout disposition.
- [R3B clean-build determinism](R3B_CLEAN_BUILD_DETERMINISM.md): independently
  reviewed R3B-2A baseline that removes validated stale `dist` output before
  build and compares dirty/empty build plus pack manifests; no core-only
  artifact claim.
- [TypeScript toolchain stability experiment](TYPESCRIPT_TOOLCHAIN_STABILITY_EXPERIMENT.md):
  samples bounded macOS Node 20/22 compiler controls without adding retry or
  weakening the existing CI matrix.
- [R3B-2A diagnostics-only re-closeout](R3B_2A_DIAGNOSTICS_ONLY_RECLOSEOUT.md):
  closes the diagnostic-observability gap with fixed stage/category labels,
  forbidden-field redaction, exact-head and post-merge CI evidence, and no
  determinism, workflow, Ruleset, or package-surface change.
- [R3B-2B core-only artifact post-merge closeout](R3B_2B_CORE_ONLY_ARTIFACT_POST_MERGE_CLOSEOUT.md):
  closes the reviewed five-export artifact decomposition at 17 runtime files,
  15 declarations, and 35 packed entries while retaining release, provider,
  workspace-write, and capability-expansion prohibitions.
- [glossary](GLOSSARY.md): shared governance terminology.
- [App Server file-change governance runbook](runbooks/CODEX_APP_SERVER_FILE_CHANGE_GOVERNANCE.md):
  deterministic offline acceptance and the explicit live-acceptance stop.
- [validation tiers](../validation-tiers.md): deterministic validation entry
  points and explicit host-sensitive boundaries.

## Current Decisions

- [ADR 006: Codex App Server governance adapter](decisions/ADR_006_CODEX_APP_SERVER_GOVERNANCE_ADAPTER.md):
  App Server remains the runtime; unproven interception remains observe-only.
- [ADR 007: App Server proposal before apply](decisions/ADR_007_APP_SERVER_PROPOSAL_BEFORE_APPLY.md):
  approval must bind an exact proposal before any real apply could be eligible.
- [ADR 008: App Server exact-version security review](decisions/ADR_008_APP_SERVER_EXACT_VERSION_SECURITY_REVIEW.md):
  the reviewed `0.144.1` artifact remains `blocked / no_go` for live file
  change.
- [ADR 009: App Server no-environment proposal contract](decisions/ADR_009_APP_SERVER_NO_ENVIRONMENT_PROPOSAL_CONTRACT.md):
  strict offline proposal verification remains non-live and non-promotable.
- [ADR 010: Runtime tool-inventory attestation](decisions/ADR_010_RUNTIME_TOOL_INVENTORY_ATTESTATION.md):
  only a test-only fake attestor ships; runtime verification remains unproven.
- [ADR 011: Offline execution capsule contract](decisions/ADR_011_OFFLINE_EXECUTION_CAPSULE.md):
  synthetic fixtures, the shipped in-memory CAS, a registered in-process fake
  transform, prestore limits, and independent verification produce only
  `verified_offline` evidence. The capsule is not a sandbox, live worker,
  promotable receipt, or workspace-write authorization.

ADRs 001-005 remain accepted foundation decisions for protocol, provider grant,
real-execution gates, evidence/redaction, and workspace-write permit semantics.
They do not independently open an execution path.

## Capability Posture

| Surface | Current disposition |
| --- | --- |
| Authorization, preview, retain, reconciliation, rollback | Pre-production governance contracts |
| App Server deterministic harness | Offline contract evidence only |
| App Server exact-version file change | `NO-GO` |
| No-environment proposal and runtime inventory | `verified_offline / no_go` |
| Offline execution capsule | `test_only_simulated`; non-promotable |
| Pull-request merge authorization | Active for `main` through ruleset `19069032`; exact `Merge Integrity` context only, strict, no bypass actors, any-source publisher risk accepted under the owner-equivalent trusted-writer model |
| Ordinary CI as GitHub required status | Not configured by the Merge Integrity ruleset |
| Real App Server file apply | Not authorized |
| Real Codex CLI or provider execution | Not authorized |
| Real worker, remote CAS, retain/apply integration | Not implemented or authorized |
| Real source-workspace write, release, deploy, publish | Not authorized |

R3A closes Merge Integrity and `R2_GOVERNANCE_INTEGRITY_CLOSEOUT`. R3B-1
read-only inventory is complete, and R3B-2A clean-build determinism is closed
with bounded redacted diagnostics and a disclosed transient CI runtime risk.
R3B-2B is closed by the reviewed core-only artifact and its post-merge record.
The five formal exports remain unchanged, and the package remains private.
This closeout does not authorize dependency cleanup, publication, ADR 012, a
real worker, remote CAS, or a further App Server execution probe.

## Runner Entry Points

Use the consolidated runner for discovery and read-only audits:

```bash
npm run governance -- list
npm run governance -- list --all
npm run docs:governance
npm run governance -- audit merge-integrity
npm run governance -- audit state-sync
npm run governance -- audit state-sync-boundary
npm run governance -- audit execution-boundary-current-surface
npm run governance -- audit workspace-write-release-gate
npm run governance -- audit workspace-write-real-canary-authorization-design
npm run governance -- audit source-release-package-boundary
npm run governance -- audit offline-execution-capsule-boundary
```

`list --all` exposes historical one-off audit and acceptance commands for
deliberate evidence review. Their presence does not make the corresponding
runtime route current or authorized. Acceptance commands that can refresh
committed evidence must use their documented no-write/check mode during review.

The `execution-boundary-current-surface` audit records that read-only provider
dispatch does not inherit into host-executor, sub-agent-runtime,
workspace-write, or release authorization. Codex CLI host presence likewise
does not authorize those surfaces.

## Historical Evidence

The following remain searchable audit material, not current roadmap entries:

- `PHASE_*`: historical Phase 6-18 runtime, recovery, adapter, and Agent OS
  closeouts or taskbooks.
- `PR_*_TASKBOOK.md` and `PR_*_AUTHORIZATION_PACKET.md`: scoped planning and
  proposed future gates; never authorization by themselves.
- `PR_*_LOCAL_CLOSEOUT.md` and `PR_*_RECEIPT*.md`: historical local evidence.
- `FUTURE_*`: archived pre-execution designs.
- DGP, provider-runtime, Desktop, VCPToolBox, and Agent OS roadmaps elsewhere in
  `docs/`: historical implementation or research context.

GitHub Issue #2 is covered by
[the Phase 21 closeout audit](../phase-21-closeout-audit-20260611.md). Its
21.1-21.6 scope is complete; it must not be used to infer Phase 22 or parallel
runtime expansion.

## Templates

- [closeout template](templates/CLOSEOUT_TEMPLATE.md)
- [runbook template](templates/RUNBOOK_TEMPLATE.md)
- [ADR template](templates/ADR_TEMPLATE.md)

## Decision Archive

- [ADR 001: Protocol V1 stable contract surface](decisions/ADR_001_PROTOCOL_V1.md)
- [ADR 002: Provider grant and permit model](decisions/ADR_002_PROVIDER_GRANT_AND_PERMIT_MODEL.md)
- [ADR 003: Codex CLI real execution gates](decisions/ADR_003_CODEX_CLI_REAL_EXECUTION_GATES.md)
- [ADR 004: Evidence and redaction policy](decisions/ADR_004_EVIDENCE_AND_REDACTION_POLICY.md)
- [ADR 005: Workspace-write permit v2](decisions/ADR_005_WORKSPACE_WRITE_PERMIT_V2.md)
- [ADR 006: Codex App Server governance adapter](decisions/ADR_006_CODEX_APP_SERVER_GOVERNANCE_ADAPTER.md)
- [ADR 007: App Server proposal-before-apply](decisions/ADR_007_APP_SERVER_PROPOSAL_BEFORE_APPLY.md)
- [ADR 008: App Server exact-version security review](decisions/ADR_008_APP_SERVER_EXACT_VERSION_SECURITY_REVIEW.md)
- [ADR 009: App Server no-environment proposal contract](decisions/ADR_009_APP_SERVER_NO_ENVIRONMENT_PROPOSAL_CONTRACT.md)
- [ADR 010: Runtime tool-inventory attestation](decisions/ADR_010_RUNTIME_TOOL_INVENTORY_ATTESTATION.md)
- [ADR 011: Offline execution capsule contract](decisions/ADR_011_OFFLINE_EXECUTION_CAPSULE.md)


## Historical Audit Compatibility

Existing boundary audits intentionally fail closed unless their source module,
evidence document, and audit command remain registered. The following registry
retains those exact historical markers. Registration means the boundary stays
testable and constrained; it does not make the route a current roadmap or grant
live execution authority.
## Historical Boundary Compatibility Registry

- [Codex execution-governance architecture](CODEX_EXECUTION_GOVERNANCE_ARCHITECTURE.md):
  the two-page product boundary, authorization chain, App Server adapter,
  preview, retain, rollback, and public surface.
- [Codex governance baseline](CODEX_GOVERNANCE_BASELINE.md): frozen API,
  classification counterexamples, CI posture, and execution boundaries.
- [App Server governance adapter ADR](decisions/ADR_006_CODEX_APP_SERVER_GOVERNANCE_ADAPTER.md):
  why App Server remains the runtime and why unproven interception is
  observe-only.
- [Runtime tool-inventory attestation ADR](decisions/ADR_010_RUNTIME_TOOL_INVENTORY_ATTESTATION.md):
  the test-only runtime-owned issuer contract and continuing live `NO-GO`.
- [App Server file-change governance runbook](runbooks/CODEX_APP_SERVER_FILE_CHANGE_GOVERNANCE.md):
  deterministic fake-transport acceptance and the explicit live-acceptance
  authorization stop.
- [governance control plane](GOVERNANCE_CONTROL_PLANE.md): current capability
  status, authority model, and default runtime posture.
- [release gate matrix](RELEASE_GATE_MATRIX.md): PR, main, and release gate
  policy plus failure consequences.
- [evidence policy](EVIDENCE_POLICY.md): allowed evidence fields, forbidden raw
  material, and evidence ref rules.
- [threat model](THREAT_MODEL.md): current governance threats and controls.
- [change control](CHANGE_CONTROL.md): required docs/tests for governance
  boundary changes.
- [workspace-write release gate](WORKSPACE_WRITE_RELEASE_GATE.md):
  workspace-write promotion and block rules.
- [governance docs automation spec](DOCS_AUTOMATION_SPEC.md):
  lightweight documentation check scope.
- [glossary](GLOSSARY.md): shared governance terminology.
- [read-only controlled execution runbook](runbooks/READONLY_CONTROLLED_EXECUTION_RUNBOOK.md):
  guarded read-only host execution procedure.
- [workspace-write canary runbook](runbooks/WORKSPACE_WRITE_CANARY_RUNBOOK.md):
  blocked-by-default workspace-write canary procedure.
- [current state](../current/CURRENT_STATE.md): current branch, validation,
  execution boundary, and next safe action.
- [validation tiers](../validation-tiers.md): recommended local validation
  entry points and explicit smoke boundaries.
- [read-only productization acceptance](READONLY_PRODUCTIZATION_ACCEPTANCE.md):
  current read-only acceptance boundary.
- [source/release package boundary](SOURCE_RELEASE_PACKAGE_BOUNDARY.md):
  source and release package separation.
- [capability taxonomy escalation policy](CAPABILITY_TAXONOMY_ESCALATION_POLICY.md):
  capability classes and escalation stops.
- [approval consumption dispatch matrix](APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md):
  approval consumption and dispatch evidence matrix.
- [API surface convergence review](API_SURFACE_CONVERGENCE_REVIEW.md):
  current source-level review of product APIs, extension contracts, internal
  governance implementation modules, and recommended facade boundaries; this is
  not an API change.
- [API testing and diagnostics surface plan](API_TESTING_DIAGNOSTICS_SURFACE_PLAN.md):
  narrow follow-up decision keeping `./testing` and `./diagnostics` closed until
  separate curation; this is not a new public export.
- [Public contract compatibility closeout](PUBLIC_CONTRACT_COMPATIBILITY_CLOSEOUT.md):
  final narrow API surface closeout that directs new consumers to
  `codex-router/protocol`, records `kernel-contracts` as the canonical public
  contract source, and keeps `contracts` as legacy compatibility only.
- [PR-22A controlled provider execution taskbook](PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md):
  local-only planning line for the next controlled provider execution slice;
  this is not execution authorization.
- [Controlled provider execution dispatch preflight matrix](CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX.md):
  current pre-runner dispatch matrix for controlled read-only provider
  execution; this does not authorize provider execute and leaves final execute
  gating with the provider execution runner boundary.
- Controlled provider execution dispatcher boundary:
  `packages/governance-internal-controlled-provider-dispatcher` consumes the
  dispatch preflight schema, provider registry selection, permit, executor plan,
  environment preflight artifact binding, and governance stop checks before
  handing off to the provider execution runner boundary. It supports controlled
  read-only dispatch and controlled workspace-write dispatch to the local
  runner, but does not call `provider.execute` directly, does not spawn Codex
  CLI, and does not authorize general workspace-write.
- [Phase 6 controlled execution runtime hardening baseline](PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE.md):
  current baseline for PR-23A through PR-23F; this records the next runtime
  hardening sequence and is not workspace-write authorization.
- [Phase 6 controlled execution runtime hardening closeout](PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md):
  current closeout for Phase 6 capability status, validation evidence, closed
  risks, remaining risks, and non-authorizations.
- [PR-23B controlled read-only provider execution minimal slice](PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md):
  current acceptance line for the explicit controlled read-only provider
  execution path; this uses injected fake-spawner validation and is not real
  Codex CLI authorization.
- [PR-23C execution evidence binding](PR_23C_EXECUTION_EVIDENCE_BINDING.md):
  current evidence-binding line for controlled read-only provider execution;
  this strengthens refs and hashes without broadening execution authorization.
- [Phase 6 read-only provider permit lifecycle hardening](PHASE_6_READONLY_PROVIDER_PERMIT_LIFECYCLE_HARDENING.md):
  current lifecycle closeout for expiration, nonce, replay, and store-failure
  checks in the controlled read-only acceptance line.
- [PR-23D workspace-write permit v2](PR_23D_WORKSPACE_WRITE_PERMIT_V2.md):
  current permit v2 schema and validator line for workspace-write readiness;
  this is not workspace-write execution authorization.
- [PR-23E workspace-write fake canary v2](PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2.md):
  current fake-canary line using permit v2, patch guard, rollback evidence, and
  replay blocking without real workspace-write execution.
- Controlled generic workspace-write acceptance:
  `npm run governance -- acceptance controlled-generic-workspace-write -- --check`
  proves the local runner can preflight, execute, roll back, and replay-block
  explicit create/update/delete operations in a temporary repository with
  sanitized evidence, without provider `execute`, Codex CLI, or external write.
- Controlled generic workspace-write completion audit:
  `npm run governance -- audit controlled-generic-workspace-write-completion`
  ties executor, runner, dispatcher, host/desktop routing, Agent OS public
  surfaces, public host facade structural dispatch types, committed acceptance
  evidence, and release gate posture into one read-only completion matrix.
- [Phase 7 runtime operator actionability closeout](PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md):
  current closeout for preflight governance blocks, operator action envelopes,
  summaries, host-client surfaces, and sanitized evidence resolution; this is
  not recovery-action execution authorization.
- [Phase 8 operator action lifecycle closeout](PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md):
  current closeout for operator action receipts, lifecycle stores, replay
  blocking, expiry, lockdown receipt policy, and receipt validation; this is
  not recovery-action execution authorization.
- [Phase 9 operator action host lifecycle closeout](PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md):
  current closeout for host/client receipt consumption, receipt authoring, and
  current operator action lifecycle state; this is not recovery-action
  execution authorization.
- [Phase 10 operator action executor gate closeout](PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md):
  current closeout for the plan-only operator action executor gate, durable
  receipt proof binding, lifecycle binding, action allowlists, checkpoint
  propagation, and sanitized evidence summaries; this is not recovery-action
  execution authorization.
- [Phase 11 operator action host executor boundary taskbook](PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md):
  current taskbook for a future non-executing authorization packet and injected
  host executor descriptor boundary; this is not recovery-action execution
  authorization.
- [Phase 11 operator action host executor boundary closeout](PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md):
  current closeout for the non-executing host executor descriptor,
  authorization packet, and authorization review boundary; this is not
  recovery-action execution authorization.
- [Phase 12 operator action host client review surface closeout](PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md):
  current closeout for exposing the Phase 11 non-executing authorization review
  through `DesktopHostClient` current lifecycle state; this is not
  recovery-action execution authorization.
- [Phase 13 operator action host executor dispatch taskbook](PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md):
  current authorization stop for any future side-effecting recovery action
  dispatch implementation; this is not recovery-action execution authorization.
- [Phase 13 operator action host executor dispatch closeout](PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md):
  current closeout for dry-run and explicit injected-executor dispatch control;
  real recovery-action dispatch remains blocked by default.
- [Phase 13 agent-backed recovery executor boundary](PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md):
  current boundary for host-provided / agent-backed recovery executor semantics
  and the sandbox-only reference executor contract proof; this is not
  production recovery execution authorization.
- [Phase 14 agent executor receipt contract](PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md):
  current boundary for executor receipt status normalization across
  `accepted`, `running`, `completed`, `failed`, `refused`, and `aborted`;
  this is not real recovery-action execution authorization.
- [Phase 15 agent executor adapter authorization taskbook](PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md):
  current pre-execution authorization boundary for future agent-backed
  executor adapters; this does not authorize Codex CLI, provider,
  sub-agent runtime, shell, workspace-write, or production recovery execution.
- [Phase 15 agent executor adapter review-only closeout](PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md):
  current review-only readiness boundary for future agent-backed executor
  adapters; this validates descriptor and packet binding without invoking
  Codex CLI, provider, sub-agent runtime, shell, workspace-write, or recovery
  execution.
- [Phase 15 agent executor adapter sandbox contract closeout](PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md):
  current sandbox-only contract witness for future agent-backed executor
  adapters; this validates explicit injection, audit, packet binding, and
  sandbox artifact containment without invoking Codex CLI, provider,
  sub-agent runtime, shell, workspace-write, or production recovery execution.
- [Phase 16 agent executor adapter dispatch authorization taskbook](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md):
  current pre-implementation boundary for future adapter dispatch
  authorization; this defines packet, audit, receipt, scope, and fail-closed
  requirements without authorizing Codex CLI, provider, sub-agent runtime,
  shell/process execution, workspace-write, external write, or production
  recovery execution.
- [Phase 16 agent executor adapter dispatch authorization review-only closeout](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md):
  current review-only implementation boundary for adapter dispatch
  authorization; this validates dispatch authorization packet binding without
  invoking an adapter, Codex CLI, provider, sub-agent runtime, shell/process
  execution, workspace-write, external write, or production recovery execution.
- [Phase 16 agent executor adapter dispatch sandbox dry-run taskbook](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md):
  implemented planning boundary for the sandbox-only dispatch dry-run
  extension; this records the exact approval and does not authorize Codex CLI,
  provider, sub-agent runtime, shell/process execution, workspace-write,
  external write, or production recovery execution.
- [Phase 16 agent executor adapter dispatch sandbox dry-run closeout](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md):
  current sandbox-only dispatch dry-run implementation boundary; this validates
  Phase 16 dispatch authorization against the explicitly injected Phase 15
  `sandbox_reference_adapter` contract witness and records sanitized audit and
  evidence without authorizing real recovery execution.
- [Phase 17 agent task control dispatch boundary taskbook](PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md):
  current taskbook boundary for future `agent_task_control` dispatch
  authorization; this defines packet, host responsibility, audit/evidence, and
  fail-closed requirements without authorizing Codex CLI, provider,
  sub-agent runtime, shell/process execution, workspace-write, external write,
  or production recovery execution.
- [Phase 17 agent task control dispatch authorization review-only closeout](PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md):
  current review-only implementation boundary for `agent_task_control` +
  `agent_context_only` authorization; this validates Phase 10/11/15/16
  bindings, host-agent refs, context refs, idempotency, timeout, and sink
  identities without invoking an adapter, Codex CLI, provider, sub-agent
  runtime, shell/process execution, workspace-write, external write, or
  production recovery execution.
- [Phase 18 agent task control dispatch sandbox dry-run taskbook](PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md):
  current planning boundary for a future sandbox-only task-control contract
  witness; this defines a separate sandbox task-control adapter boundary and
  future exact approval string without invoking an adapter, Codex CLI,
  provider, sub-agent runtime, shell/process execution, workspace-write,
  external write, or production recovery execution.
- [Phase 18 agent task control dispatch sandbox dry-run closeout](PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md):
  current sandbox-only task-control contract witness; this binds a ready Phase
  17 authorization review to an explicitly injected `sandbox_task_control_adapter`
  and records sanitized audit/evidence without authorizing Codex CLI, provider,
  sub-agent runtime, shell/process execution, workspace-write, external write,
  or production recovery execution.

### Historical Audit Entry Registry

Use the consolidated runner instead of per-check package scripts:

```bash
npm run governance -- list
npm run governance -- list --all
npm run docs:governance
npm run governance -- audit state-sync
npm run governance -- audit state-sync-boundary
npm run governance -- audit controlled-provider-execution-taskbook-boundary
npm run governance -- audit controlled-provider-execution-taskbook-review-boundary
npm run governance -- audit controlled-provider-execution-taskbook-review
npm run governance -- audit strategy-router-execution-boundary
npm run governance -- audit execution-profiles-boundary
npm run governance -- audit policy-config-boundary
npm run governance -- audit capability-taxonomy-boundary
npm run governance -- audit capability-taxonomy-escalation-policy-boundary
npm run governance -- audit routing-engine-boundary
npm run governance -- audit recovery-control-orchestration-boundary
npm run governance -- audit runtime-control-boundary
npm run governance -- audit operator-action-executor-gate-boundary
npm run governance -- audit codex-cli-host-boundary
npm run governance -- audit public-api-execution-boundary
npm run governance -- audit agent-os-local-runtime-boundary
npm run governance -- audit agent-os-mcp-server-manifest-boundary
npm run governance -- audit protocol-mcp-provider-skeleton-boundary
npm run governance -- audit protocol-a2a-remote-provider-skeleton-boundary
npm run governance -- audit agent-os-sdk-boundary
npm run governance -- audit agent-os-cli-boundary
npm run governance -- audit agent-os-app-server-boundary
npm run governance -- audit agent-os-public-surfaces-boundary
npm run governance -- audit codex-provider-execution-boundary
npm run governance -- audit preflight-boundary
npm run governance -- audit approval-permit-boundary
npm run governance -- audit approval-gate-boundary
npm run governance -- audit approval-consumption-dispatch-matrix-boundary
npm run governance -- audit approval-consumption-dispatch-boundary
npm run governance -- audit readonly-productization-boundary
npm run governance -- audit admission-control-boundary
npm run governance -- audit delegation-policy-boundary
npm run governance -- audit execution-eligibility-boundary
npm run governance -- audit execution-observation-boundary
npm run governance -- audit governance-failure-reducer-boundary
npm run governance -- audit task-graph-boundary
npm run governance -- audit scheduler-boundary
npm run governance -- audit execution-planner-boundary
npm run governance -- audit provider-registry-boundary
npm run governance -- audit controlled-provider-execution-dispatch-preflight-boundary
npm run governance -- audit controlled-provider-execution-dispatcher-boundary
npm run governance -- audit provider-execution-runner-boundary
npm run governance -- audit provider-core-execution-primitives-boundary
npm run governance -- audit tool-invocation-planner-boundary
npm run governance -- audit desktop-agent-strategy-boundary
npm run governance -- audit desktop-decision-runner-boundary
npm run governance -- audit final-host-locator-boundary
npm run governance -- audit host-dispatcher-provider-boundary
npm run governance -- audit codex-desktop-bridge-boundary
npm run governance -- audit codex-desktop-live-host-boundary
npm run governance -- audit codex-memory-mcp-client-boundary
npm run governance -- audit codex-memory-host-client-boundary
npm run governance -- audit desktop-host-client-boundary
npm run governance -- audit desktop-live-adapter-dispatch-boundary
npm run governance -- audit host-client-example-boundary
npm run governance -- audit target-host-embedding-boundary
npm run governance -- audit host-executor-boundary
npm run governance -- audit host-executor-taskbook-boundary
npm run governance -- audit host-client-executor-review-boundary
npm run governance -- audit host-executor-receipt-boundary
npm run governance -- audit agent-backed-recovery-executor-boundary
npm run governance -- audit agent-executor-adapter-taskbook-boundary
npm run governance -- audit agent-executor-adapter-review-boundary
npm run governance -- audit agent-executor-adapter-sandbox-boundary
npm run governance -- audit agent-task-control-taskbook-boundary
npm run governance -- audit agent-task-control-review-boundary
npm run governance -- audit agent-task-control-sandbox-boundary
npm run governance -- audit sub-agent-runtime-boundary
npm run governance -- audit execution-boundary-current-surface
npm run governance -- audit workspace-write-release-gate
npm run governance -- audit workspace-write-real-canary-authorization-design
npm run governance -- audit source-release-package-boundary
npm run governance -- acceptance readonly-chain --check
npm run governance -- acceptance controlled-readonly-provider-execution --check
npm run governance -- operator readonly
```

Default `list` output stays focused on current/core checks. Use `--all` only
when deliberately browsing archived one-off audit and acceptance commands.
Acceptance checks refresh their committed evidence by default when they pass;
use `--check` for a no-write local review pass.

The `execution-boundary-current-surface` audit also records
`narrow_readonly_provider_dispatch_without_boundary_inheritance`: read-only provider dispatch does not inherit into host executor authorization, read-only provider dispatch does not inherit into sub-agent runtime authorization, read-only provider dispatch does not inherit into workspace-write authorization, and read-only provider dispatch does not inherit into release authorization.
Codex CLI host does not authorize host executor or sub-agent runtime; sub-agent
runtime does not invoke Codex CLI or provider execution; host executor does not
execute provider or sub-agent runtime.
