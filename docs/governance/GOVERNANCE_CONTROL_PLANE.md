---
title: Governance Control Plane
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - git diff --check
  - npm run validate:daily
  - node --import tsx scripts/sync-state-sync-display.ts --check
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
- [PR-23B Controlled Read-only Provider Execution Minimal Slice](PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md);
- [PR-23C Execution Evidence Binding](PR_23C_EXECUTION_EVIDENCE_BINDING.md);
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
| `PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md` | Controlled read-only provider execution acceptance | Current human authority for the PR-23B minimal slice; not real Codex CLI authorization. |
| `PR_23C_EXECUTION_EVIDENCE_BINDING.md` | Controlled read-only execution evidence binding | Current human authority for PR-23C refs/hash evidence; not new execution authorization. |
| `PR_*`, `FUTURE_*`, closeouts, packets | Historical evidence | Evidence only unless linked by a current authority document. |

## Capability Status

| Capability | Status | Real execution allowed | Current rule |
| --- | --- | ---: | --- |
| Protocol V1 contracts | active | N/A | Stable package surface; keep changes tested and reviewable. |
| Read-only dry run | active | No | Safe default for local inspection, demos, and deterministic tests. |
| Runtime governance observation | active | No by itself | May record sanitized observations, refs, anomalies, and operator actions. |
| Controlled read-only real execution | guarded / productized | Yes, narrow | Requires [read-only controlled execution runbook](runbooks/READONLY_CONTROLLED_EXECUTION_RUNBOOK.md), [PR-23B minimal slice](PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md), [PR-23C evidence binding](PR_23C_EXECUTION_EVIDENCE_BINDING.md), explicit controlled mode, injected execution dependency, permit/preflight metadata, stable evidence refs/hashes, and no hidden provider path. |
| Workspace-write fake canary | guarded | No | May validate control flow without real host writes. |
| Workspace-write real canary | experimental / blocked by default | No by default | Requires [workspace-write release gate](WORKSPACE_WRITE_RELEASE_GATE.md), [workspace-write canary runbook](runbooks/WORKSPACE_WRITE_CANARY_RUNBOOK.md), a fresh explicit authorization packet for the named canary, permit v2 controls, and rollback evidence. |
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
| Controlled read-only execution evidence binding | `PR_23C_EXECUTION_EVIDENCE_BINDING.md` |
| Controlled read-only provider execution acceptance | `npm run governance -- acceptance controlled-readonly-provider-execution` |
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
