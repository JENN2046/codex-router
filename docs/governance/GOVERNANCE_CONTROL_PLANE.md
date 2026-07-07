---
title: Governance Control Plane
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-05
verified_by:
  - git diff --check
  - npm run docs:governance
  - node --import tsx scripts/sync-state-sync-display.ts --check
  - npm run typecheck
  - npm run build
  - pull_request-context state-sync audit
supersedes: []
superseded_by: null
applies_to:
  - governance
  - runtime-governance
  - release-review
---

# Governance Control Plane

This is the current governance fact entry point for `codex-router`.

Historical PR taskbooks, closeouts, packets, and receipts remain useful
evidence, but they are not current authority by themselves. Current governance
authority is expressed by:

- this control plane;
- [Release Gate Matrix](RELEASE_GATE_MATRIX.md);
- [Evidence Policy](EVIDENCE_POLICY.md);
- [Glossary](GLOSSARY.md);
- [Threat Model](THREAT_MODEL.md);
- [Change Control](CHANGE_CONTROL.md);
- [Workspace-write Release Gate](WORKSPACE_WRITE_RELEASE_GATE.md);
- [Governance Docs Automation Spec](DOCS_AUTOMATION_SPEC.md);
- [Phase 6 Controlled Execution Runtime Hardening Baseline](PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE.md);
- [Phase 6 Controlled Execution Runtime Hardening Closeout](PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md);
- [PR-23B Controlled Read-only Provider Execution Minimal Slice](PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md);
- [PR-23C Execution Evidence Binding](PR_23C_EXECUTION_EVIDENCE_BINDING.md);
- [PR-23D Workspace-write Permit V2](PR_23D_WORKSPACE_WRITE_PERMIT_V2.md);
- [PR-23E Workspace-write Fake Canary V2](PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2.md);
- [Phase 7 Runtime Operator Actionability Closeout](PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md);
- [Phase 8 Operator Action Lifecycle Closeout](PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md);
- [Phase 9 Operator Action Host Lifecycle Closeout](PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md);
- [Phase 10 Operator Action Executor Gate Closeout](PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md);
- [Phase 11 Operator Action Host Executor Boundary Taskbook](PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md);
- [Phase 11 Operator Action Host Executor Boundary Closeout](PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md);
- [Phase 12 Operator Action Host Client Review Surface Closeout](PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md);
- [Phase 13 Operator Action Host Executor Dispatch Taskbook](PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md);
- [Phase 13 Operator Action Host Executor Dispatch Closeout](PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md);
- [Phase 13 Agent-Backed Recovery Executor Boundary](PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md);
- [Phase 14 Agent Executor Receipt Contract](PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md);
- [Phase 15 Agent Executor Adapter Authorization Taskbook](PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md);
- [Phase 15 Agent Executor Adapter Review-Only Closeout](PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md);
- [Phase 15 Agent Executor Adapter Sandbox Contract Closeout](PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md);
- [Phase 16 Agent Executor Adapter Dispatch Authorization Taskbook](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md);
- [Phase 16 Agent Executor Adapter Dispatch Authorization Review-Only Closeout](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md);
- [Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Taskbook](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md);
- [Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Closeout](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md);
- [Phase 17 Agent Task Control Dispatch Boundary Taskbook](PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md);
- executable checks exposed through `npm run governance -- list`;
- the structured state-sync claim at `docs/current/state-sync-record.json`.

## Authority Model

| Surface | Role | Authority |
| --- | --- | --- |
| `docs/current/state-sync-record.json` | Machine-readable state-sync claim | Authority for state-sync audit. |
| `docs/current/CURRENT_STATE.md` | Generated/operator display | Display only. |
| `.agent_board/*` | Handoff display | Display only. |
| This document | Current governance capability status | Current human authority. |
| `RELEASE_GATE_MATRIX.md` | PR/release gate policy | Current human authority. |
| `EVIDENCE_POLICY.md` | Evidence storage boundary | Current human authority. |
| `THREAT_MODEL.md` | Current risk and control map | Current human authority. |
| `CHANGE_CONTROL.md` | Required docs/tests for governance changes | Current human authority. |
| `WORKSPACE_WRITE_RELEASE_GATE.md` | Workspace-write promotion and block rules | Current human authority for workspace-write readiness. |
| `DOCS_AUTOMATION_SPEC.md` | Lightweight docs governance check contract | Current human authority for docs check scope. |
| `PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE.md` | Runtime-hardening stage baseline | Current human authority for Phase 6 sequencing; not execution authorization. |
| `PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md` | Runtime-hardening stage closeout | Current human authority for Phase 6 completed capability status; not new execution authorization. |
| `PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md` | Controlled read-only provider execution acceptance | Current human authority for the PR-23B minimal slice; not real Codex CLI authorization. |
| `PR_23C_EXECUTION_EVIDENCE_BINDING.md` | Controlled read-only execution evidence binding | Current human authority for PR-23C refs/hash evidence; not new execution authorization. |
| `PHASE_6_READONLY_PROVIDER_PERMIT_LIFECYCLE_HARDENING.md` | Read-only provider permit lifecycle hardening | Current human authority for expiration, nonce, replay, and store-failure acceptance coverage; not workspace-write authorization. |
| `PR_23D_WORKSPACE_WRITE_PERMIT_V2.md` | Workspace-write permit v2 schema and validators | Current human authority for permit v2 shape, validation, and consumption; not workspace-write execution authorization. |
| `PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2.md` | Workspace-write fake canary v2 | Current human authority for permit v2 fake-canary validation; not real workspace-write authorization. |
| `PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md` | Runtime operator actionability closeout | Current human authority for preflight governance, operator action envelopes, summaries, host-client surfaces, and evidence resolution; not execution authorization. |
| `PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md` | Operator action lifecycle closeout | Current human authority for operator action receipt shape, validation, expiry, replay blocking, lifecycle stores, and lockdown receipt policy; not execution authorization. |
| `PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md` | Operator action host lifecycle closeout | Current human authority for host/client receipt consumption, receipt authoring, and lifecycle state surfaces; not execution authorization. |
| `PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md` | Operator action executor gate closeout | Current human authority for the plan-only operator action executor gate, durable receipt proof binding, lifecycle binding, action allowlists, checkpoint propagation, and sanitized evidence summaries; not execution authorization. |
| `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md` | Operator action host executor boundary taskbook | Current human authority for the next non-executing authorization packet and injected host executor descriptor boundary; not execution authorization. |
| `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md` | Operator action host executor boundary closeout | Current human authority for the implemented non-executing host executor descriptor, authorization packet, lifecycle binding, and review result boundary; not execution authorization. |
| `PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md` | Operator action host client review surface closeout | Current human authority for exposing the Phase 11 non-executing review result through `DesktopHostClient` current lifecycle state; not execution authorization. |
| `PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md` | Operator action host executor dispatch taskbook | Current authorization stop for any future side-effecting recovery action dispatch implementation; not execution authorization. |
| `PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md` | Operator action host executor dispatch closeout | Current human authority for the implemented dry-run and explicit injected-executor dispatch boundary; real recovery dispatch remains blocked by default. |
| `PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md` | Agent-backed recovery executor boundary | Current human authority for host-provided / agent-backed recovery executor semantics and sandbox-only contract proof; not production recovery execution authorization. |
| `PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md` | Agent executor receipt contract | Current human authority for non-executing executor receipt status normalization; not real recovery execution authorization. |
| `PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md` | Agent executor adapter authorization taskbook | Current human authority for future adapter pre-execution review requirements; not Codex CLI, provider, sub-agent runtime, shell, workspace-write, or production recovery execution authorization. |
| `PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md` | Agent executor adapter review-only closeout | Current human authority for implemented review-only adapter descriptor and packet readiness; not Codex CLI, provider, sub-agent runtime, shell, workspace-write, or production recovery execution authorization. |
| `PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md` | Agent executor adapter sandbox contract closeout | Current human authority for implemented sandbox-only adapter contract witness; not Codex CLI, provider, sub-agent runtime, shell, workspace-write, or production recovery execution authorization. |
| `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md` | Agent executor adapter dispatch authorization taskbook | Current human authority for future adapter dispatch authorization requirements; design-only and not Codex CLI, provider, sub-agent runtime, shell/process, workspace-write, external-write, or production recovery authorization. |
| `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md` | Agent executor adapter dispatch authorization review-only closeout | Current human authority for implemented review-only dispatch authorization packet binding; not adapter invocation, Codex CLI, provider, sub-agent runtime, shell/process, workspace-write, external-write, or production recovery authorization. |
| `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md` | Agent executor adapter dispatch sandbox dry-run taskbook | Implemented planning authority for the sandbox-only dispatch dry-run stop; not Codex CLI, provider, sub-agent runtime, shell/process, workspace-write, external-write, or production recovery authorization. |
| `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md` | Agent executor adapter dispatch sandbox dry-run closeout | Current human authority for the implemented sandbox-only dispatch dry-run boundary; not real recovery execution authorization. |
| `PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md` | Agent task control dispatch boundary taskbook | Current human authority for future `agent_task_control` / `agent_context_only` dispatch authorization requirements; planning-only and not Codex CLI, provider, sub-agent runtime, shell/process, workspace-write, external-write, or production recovery authorization. |
| `PR_*`, `FUTURE_*`, closeouts, packets | Historical evidence | Evidence only unless linked by a current authority document. |

## Capability Status

| Capability | Status | Real execution allowed | Current rule |
| --- | --- | ---: | --- |
| Protocol V1 contracts | active | N/A | Stable package surface; keep changes tested and reviewable. |
| Read-only dry run | active | No | Safe default for local inspection, demos, and deterministic tests. |
| Runtime governance observation | active | No by itself | May record sanitized observations, refs, anomalies, and operator actions. |
| Runtime operator actionability | active | No by itself | Preflight blocks, runtime failures, desktop live results, and host clients expose stable operator action envelopes/summaries and sanitized evidence-resolution summaries. |
| Runtime operator action lifecycle receipts | active | No by itself | Operator decisions can be validated and durably consumed against task-scoped action refs, optional envelope hashes, timestamps, expiry, replay state, store replay barriers, and lockdown receipt policy. |
| Runtime operator action host lifecycle | active | No by itself | Host clients can author, consume, and query current operator action lifecycle state without executing recovery actions. |
| Runtime operator action executor gate | active / plan-only | No | Phase 10 can produce a checkpoint-preserving plan only after durable receipt proof, lifecycle binding, and action allowlist checks pass. |
| Runtime operator action host executor boundary | active / non-executing | No | Phase 11 binds planned gates, lifecycle state, authorization packets, and injected host executor descriptors for review readiness only; recovery action dispatch remains closed. |
| Runtime operator action host-client executor review surface | active / non-executing | No | Phase 12 exposes Phase 11 review through `DesktopHostClient.reviewCurrentOperatorActionHostExecutorAuthorization()` using current lifecycle state only; bridge, dispatcher, provider, Codex CLI, and workspace-write paths remain untouched. |
| Runtime operator action host executor dispatch | active / guarded | No by default | Phase 13 adds dry-run and explicit injected-executor dispatch control. Repository validation uses fake injected executors only; real `resume`, `rollback`, `abort`, or `fork` dispatch remains a separate authorization stop. |
| Agent-backed recovery executor boundary | active / sandbox proof only | No production execution | Phase 13 follow-up defines host-provided / agent-backed executor semantics and a sandbox-only reference executor contract proof. It does not add business recovery logic, Codex CLI, provider, shell, external write, or arbitrary workspace-write execution. |
| Agent executor receipt contract | active / non-executing | No | Phase 14 normalizes injected executor receipt statuses as `accepted`, `running`, `completed`, `failed`, `refused`, or `aborted` with sanitized reason codes and refs. It does not add an executor adapter, Codex CLI invocation, provider call, shell/process execution, external write, or workspace-write execution. |
| Agent executor adapter authorization | active / sandbox contract witness | No | Phase 15 records future adapter packet requirements and implements review-only readiness plus a sandbox-only reference adapter contract run. The contract run is limited to `sandbox_reference_adapter`, explicit injection, sanitized audit, and sandbox-contained test artifacts; Codex CLI, provider, sub-agent runtime, shell/process execution, external write, workspace-write, and production recovery execution remain blocked. |
| Agent executor adapter dispatch authorization | active / review-only + sandbox dry-run | No real execution | Phase 16 defines dispatch authorization packets, implements review-only packet/readiness binding for `review_only` + `none`, and implements a sandbox-only dry-run for `sandbox_contract` + `sandbox_only`. It does not authorize Codex CLI, provider, sub-agent runtime, shell/process execution, workspace-write, external write, or production recovery execution. |
| Agent executor adapter dispatch sandbox dry-run | active / sandbox contract witness | No real execution | Phase 16 can call only an explicitly injected Phase 15 `sandbox_reference_adapter` contract witness after the sandbox dry-run packet, readiness hash, audit sink, evidence sink, and sandbox contract packet all bind. It records sanitized audit/evidence and remains non-production proof only. |
| Agent task control dispatch boundary | planned / taskbook-only | No | Phase 17 defines future `agent_task_control` + `agent_context_only` packet, host responsibility, audit/evidence, and fail-closed requirements. It does not invoke Codex CLI, provider, sub-agent runtime, shell/process execution, workspace-write, external write, or production recovery execution. |
| Controlled read-only real execution | guarded / productized | Yes, narrow | Requires [read-only controlled execution runbook](runbooks/READONLY_CONTROLLED_EXECUTION_RUNBOOK.md), [PR-23B minimal slice](PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md), [PR-23C evidence binding](PR_23C_EXECUTION_EVIDENCE_BINDING.md), explicit controlled mode, injected execution dependency, permit/preflight metadata, stable evidence refs/hashes, and no hidden provider path. |
| Workspace-write fake canary | guarded | No | Validates permit v2, patch guard, rollback evidence, and replay blocking without real host writes. |
| Workspace-write real canary | experimental / blocked by default | No by default | Requires [workspace-write release gate](WORKSPACE_WRITE_RELEASE_GATE.md), [workspace-write canary runbook](runbooks/WORKSPACE_WRITE_CANARY_RUNBOOK.md), a fresh explicit authorization packet for the named canary, permit v2 controls, fake-canary v2 validation, and rollback evidence. |
| General workspace write | blocked | No | A bounded canary does not promote this class. |
| General provider execution | blocked | No | Requires a separate gate and explicit authorization. |
| External write | blocked | No | Includes comments, issues, remote service writes, database writes, publishing, and deployment. |
| Release, package publish, tag, deployment | blocked by default | No | Requires release-specific authorization and successful release gates. |
| Secret, credential, token, env mutation | blocked by default | No | Requires explicit named-secret authorization; never expose secret values. |

## Default Runtime Posture

The default execution posture is local, inspectable, and non-executing:

1. Prefer dry-run or in-memory paths before host execution.
2. Inject bridges, stores, policy files, and host clients explicitly.
3. Normalize failures into stable error classes before governance records them.
4. Preserve evidence as refs, hashes, statuses, reason codes, and summaries.
5. Fail closed when a required gate, permit, evidence binding, or state-sync
   claim cannot be verified.

## Current Operating Entry Points

Use these first:

| Need | Entry point |
| --- | --- |
| Current repository state | `docs/current/CURRENT_STATE.md` |
| Current governance capability status | This document |
| PR/release validation policy | `RELEASE_GATE_MATRIX.md` |
| Evidence safety boundary | `EVIDENCE_POLICY.md` |
| Threat and control map | `THREAT_MODEL.md` |
| Change impact rules | `CHANGE_CONTROL.md` |
| Workspace-write promotion/block rules | `WORKSPACE_WRITE_RELEASE_GATE.md` |
| Documentation structure check scope | `DOCS_AUTOMATION_SPEC.md` |
| Term definitions | `GLOSSARY.md` |
| Read-only controlled execution procedure | `runbooks/READONLY_CONTROLLED_EXECUTION_RUNBOOK.md` |
| Workspace-write canary procedure | `runbooks/WORKSPACE_WRITE_CANARY_RUNBOOK.md` |
| Phase 6 runtime hardening baseline | `PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE.md` |
| Phase 6 runtime hardening closeout | `PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md` |
| Controlled read-only execution evidence binding | `PR_23C_EXECUTION_EVIDENCE_BINDING.md` |
| Read-only provider permit lifecycle hardening | `PHASE_6_READONLY_PROVIDER_PERMIT_LIFECYCLE_HARDENING.md` |
| Workspace-write permit v2 schema and validators | `PR_23D_WORKSPACE_WRITE_PERMIT_V2.md` |
| Workspace-write fake canary v2 | `PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2.md` |
| Runtime operator actionability closeout | `PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md` |
| Runtime operator action lifecycle closeout | `PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md` |
| Runtime operator action host lifecycle closeout | `PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md` |
| Runtime operator action executor gate closeout | `PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md` |
| Runtime operator action host executor boundary taskbook | `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md` |
| Runtime operator action host executor boundary closeout | `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md` |
| Runtime operator action host client review surface closeout | `PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md` |
| Runtime operator action host executor dispatch taskbook | `PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md` |
| Runtime operator action host executor dispatch closeout | `PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md` |
| Agent executor receipt contract | `PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md` |
| Agent executor adapter authorization taskbook | `PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md` |
| Agent executor adapter review-only closeout | `PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md` |
| Agent executor adapter sandbox contract closeout | `PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md` |
| Agent executor adapter dispatch authorization taskbook | `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md` |
| Agent executor adapter dispatch authorization review-only closeout | `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md` |
| Agent executor adapter dispatch sandbox dry-run taskbook | `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md` |
| Agent executor adapter dispatch sandbox dry-run closeout | `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md` |
| Agent task control dispatch boundary taskbook | `PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md` |
| Controlled read-only provider execution acceptance | `npm run governance -- acceptance controlled-readonly-provider-execution --check` for no-write review; omit `--check` to refresh evidence intentionally. |
| Available current checks | `npm run governance -- list` |
| Governance docs structure check | `npm run docs:governance` |
| Archived checks | `npm run governance -- list --all` |

## Required Evidence

Current governance claims should be backed by at least one of:

- a passing local command named in `verified_by`;
- a passing GitHub check;
- a structured state-sync audit result;
- a sanitized evidence artifact or manifest;
- a closeout or receipt linked by a current authority document.

Raw prompts, provider raw responses, stdout/stderr transcripts, env values,
tokens, cookies, and credentials are not acceptable evidence surfaces. See
[Evidence Policy](EVIDENCE_POLICY.md).

## Failure Policy

- If state-sync fails, do not merge, release, or treat display surfaces as
  current.
- If a validation gate fails, follow [Release Gate Matrix](RELEASE_GATE_MATRIX.md)
  for the blocked scope.
- If evidence is missing or unsafe, fail closed and store only sanitized
  summaries or refs.
- If a capability status is not listed here, treat it as blocked until a current
  authority document names it.
