---
project: codex-router
doc_type: governance-document-inventory
status: active
last_reviewed: 2026-07-03
phase: docs-0-inventory-baseline
---

# Governance Document Inventory

This inventory is the Phase 0 baseline for the governance documentation plan.
It records the current documentation surface before any control-plane rewrite,
README rewrite, closeout migration, or docs automation.

This document is descriptive only. It does not authorize execution, release,
workspace-write, provider execution, workflow changes, or branch movement.

## Scope

Observed source scope on 2026-07-03, before adding this Phase 0 inventory:

| Surface | Count | Treatment |
|---|---:|---|
| `README.md` | 1 | Project entry and lightweight governance entry links. |
| `docs/` files | 244 | Broad documentation and evidence surface. |
| `docs/governance/` files | 65 | Governance index, current checks, historical closeouts, taskbooks, receipts, gates. |
| `docs/evidence/` files | 70 | Evidence artifacts, indexed by `docs/evidence/manifest-latest.json`. |
| `.agent_board/*` files | 5 | Operator-facing display and handoff surface, not governance authority. |
| `package.json` scripts | 17 | Command surface for validation, governance, smoke, canary, and evidence collection. |

## Classification Model

| Classification | Meaning |
|---|---|
| `entry` | Human entry point or index. |
| `current_fact` | Current operator-facing state or current governance boundary. |
| `machine_authority` | Machine-authoritative structured state. |
| `control` | Policy or matrix that can inform governance decisions. |
| `taskbook` | Scoped plan or review packet. Not current authority by itself. |
| `gate` | Explicit approval, preflight, or compatibility gate. |
| `closeout` | Historical validation record for a completed slice. |
| `receipt` | Historical receipt, review, or audit result. |
| `evidence` | Evidence artifact or evidence index. |
| `planning` | Future-oriented or adoption planning. |
| `display` | Human display/handoff mirror. |
| `unknown` | Needs later review before being treated as authority. |

| Status | Meaning |
|---|---|
| `active` | Current and allowed to be referenced as a current fact. |
| `current_display` | Useful display, but not authority. |
| `historical` | Preserved evidence or closeout. Not current authority. |
| `future` | Future gate or authorization packet. Not active authorization. |
| `compatibility` | Legacy or compatibility design record. |
| `needs_review` | Keep in place until Phase 1 or later clarifies status. |

## Current Entry Surfaces

| Path | Classification | Status | Notes |
|---|---|---|---|
| `README.md` | `entry` | `active` | Links to current docs, commands, validation tiers, governance runner, and legacy v1 fallback note. |
| `docs/README.md` | `entry` | `active` | Separates current operating facts from historical closeouts and evidence. |
| `docs/governance/README.md` | `entry` | `active` | Current governance index; treats `docs/governance/` as archive plus small current map. |
| `docs/current/CURRENT_STATE.md` | `display` | `current_display` | Human-readable state surface. It is not the state-sync authority. |
| `docs/current/state-sync-record.json` | `machine_authority` | `active` | Machine-authoritative state-sync policy v2 content attestation. |
| `.agent_board/CHECKPOINT.md` | `display` | `current_display` | Handoff display and evidence surface. |
| `.agent_board/HANDOFF.md` | `display` | `current_display` | Handoff display and evidence surface. |
| `.agent_board/RUN_STATE.md` | `display` | `current_display` | Handoff display and evidence surface. |
| `.agent_board/TASK_QUEUE.md` | `display` | `current_display` | Current status summary; not an active task authority. |
| `.agent_board/VALIDATION_LOG.md` | `display` | `current_display` | Handoff validation display surface. |

## Directory-Level Inventory

| Path | Classification | Status | Notes |
|---|---|---|---|
| `docs/current/` | `current_fact` / `machine_authority` | `active` | Contains current state display and structured state-sync record. |
| `docs/governance/` | mixed | mixed | Current index plus historical taskbooks, gates, closeouts, and receipts. Do not migrate before link-risk review. |
| `docs/evidence/` | `evidence` | `historical` | Evidence artifacts; use `manifest-latest.json` as the first index. |
| `docs/adr/` | `planning` / ADR | `needs_review` | Existing ADR location. Phase 3 may standardize ADR layout. |
| `docs/harness-adoption/` | `planning` | `historical` | Docs-first adoption planning package; explicitly not implementation approval. |
| `docs/agent-os-transformation/` | `planning` / closeout | `historical` | Transformation baselines and completion reports. |
| `docs/strategy/` | `planning` | `historical` / `needs_review` | Strategy records and private field-note boundary. |
| `docs/patches/` | `evidence` | `historical` | Patch artifacts. Do not move until link risk is resolved. |
| `docs/scratch/` | `evidence` / scratch | `historical` | Scratch comparison artifacts. Not a current authority path. |
| `docs/解读/` | explanatory | `historical` | Static codebase interpretation docs. Keep out of authority path. |

## Governance File Inventory

| Path | Classification | Status |
|---|---|---|
| `docs/governance/README.md` | `entry` | `active` |
| `docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md` | `control` | `active` |
| `docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md` | `control` | `active` |
| `docs/governance/READONLY_PRODUCTIZATION_ACCEPTANCE.md` | `control` | `active` |
| `docs/governance/SOURCE_RELEASE_PACKAGE_BOUNDARY.md` | `control` | `active` |
| `docs/governance/STATE_SYNC_STRUCTURED_RECORD_PLAN.md` | `planning` | `compatibility` |
| `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md` | `taskbook` | `active` |
| `docs/governance/APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/CLI_LINE_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_6_READONLY_CONTROL_CHAIN_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_7_PROVIDER_REGISTRY_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_8_POLICY_REGISTRY_SELECTION_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_10_REAL_READONLY_EXECUTE_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_11_WORKSPACE_WRITE_GOVERNANCE_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_12A_WORKSPACE_WRITE_FAKE_CANARY_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_TASKBOOK_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_13B_REAL_READONLY_DISPATCH_CONTROL_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_14C_FORMAL_READONLY_CLI_INTEGRATION_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT.md` | `closeout` | `historical` |
| `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET.md` | `gate` | `future` |
| `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE.md` | `gate` | `future` |
| `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md` | `gate` | `future` |
| `docs/governance/FUTURE_CODEX_CLI_CANARY_PRE_EXECUTION_REVIEW.md` | `gate` | `future` |
| `docs/governance/POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE.md` | `gate` | `historical` |
| `docs/governance/PR_12A_CANARY_APPROVAL_PACKET_COMPATIBILITY.md` | `gate` | `historical` |
| `docs/governance/PR_12A_WORKSPACE_WRITE_FAKE_CANARY_PUSH_READINESS.md` | `gate` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET_COMPATIBILITY.md` | `gate` | `historical` |
| `docs/governance/PR_13A_READONLY_REAL_CLI_AUTHORIZATION_PACKET_COMPATIBILITY.md` | `gate` | `historical` |
| `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_GUARD_TEST_REVIEW.md` | `gate` | `historical` |
| `docs/governance/PR_13A_REAL_READONLY_SMOKE_PREFLIGHT_REVIEW.md` | `gate` | `historical` |
| `docs/governance/PR_14A_FORMAL_READONLY_CLI_INTEGRATION_PREFLIGHT.md` | `gate` | `historical` |
| `docs/governance/PR_14B_FORMAL_READONLY_CLI_INTEGRATION_AUTHORIZATION_PACKET.md` | `gate` | `historical` |
| `docs/governance/PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET.md` | `gate` | `historical` |
| `docs/governance/PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT.md` | `gate` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_TASKBOOK.md` | `taskbook` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_TASKBOOK_REVIEW.md` | `taskbook` | `historical` |
| `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md` | `taskbook` | `historical` |
| `docs/governance/PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK.md` | `taskbook` | `historical` |
| `docs/governance/PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK.md` | `taskbook` | `historical` |
| `docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md` | `planning` | `needs_review` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md` | `receipt` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT.md` | `receipt` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_RC_RECEIPT.md` | `receipt` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_AUDIT_INDEX.md` | `receipt` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_RC_REVIEW_PASS.md` | `receipt` | `historical` |
| `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_BOUNDARY_AUDIT.md` | `receipt` | `historical` |
| `docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX.md` | `receipt` | `historical` |
| `docs/governance/PR_13A_REAL_READONLY_SMOKE_RECEIPT.md` | `receipt` | `historical` |
| `docs/governance/PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT.md` | `receipt` | `historical` |
| `docs/governance/PR_19B_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_REVIEW.md` | `receipt` | `historical` |
| `docs/governance/PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX.md` | `receipt` | `historical` |
| `docs/governance/PR_15B_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL.md` | `unknown` | `needs_review` |
| `docs/governance/PR_16A_FORMAL_READONLY_DISPATCH_BOUNDARY.md` | `unknown` | `needs_review` |
| `docs/governance/PR_17B_FORMAL_REAL_READONLY_SMOKE_PRE_EXECUTION.md` | `unknown` | `needs_review` |
| `docs/governance/PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX.md` | `unknown` | `needs_review` |
| `docs/governance/PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE.md` | `unknown` | `needs_review` |

## Evidence Inventory

`docs/evidence/` contains 70 files. This Phase 0 inventory intentionally keeps
them grouped by evidence family instead of expanding every artifact into the
operator-facing surface.

| Evidence family | Representative paths | Status |
|---|---|---|
| Manifest | `docs/evidence/manifest-latest.json` | `active` as evidence index |
| Read-only control chain | `read-only-control-chain-acceptance.json` | `historical` |
| Provider and policy registry | `provider-registry-selection-acceptance.json`, `policy-registry-selection-acceptance.json` | `historical` |
| Codex CLI model and readonly smoke | `codex-cli-model-check-latest.json`, `codex-cli-readonly-smoke-telemetry-latest.json` | `historical` |
| Controlled provider execution | `codex-cli-controlled-readonly-provider-execution-acceptance.json` | `historical` |
| Workspace-write canary and smoke | `codex-cli-workspace-write-real-canary-latest.json`, `workspace-write-real-canary-pre-execution-acceptance.json` | `historical` |
| Runtime / VCPChat field evidence | `vcpchat-*.json` | `historical` |

Phase 1 should define an evidence policy before any evidence migration or
renaming. Phase 0 does not move evidence files.

## Package Scripts To Documentation Map

| Script | Command | Current doc surface | Phase 0 status |
|---|---|---|---|
| `build` | `tsc -p tsconfig.json` | README validation section | documented |
| `typecheck` | `tsc -p tsconfig.json --noEmit` | README validation section | documented |
| `test` | `node --import tsx --test tests/*.test.ts` | README validation section | documented |
| `governance` | `node --import tsx scripts/run-governance-check.ts` | README and `docs/governance/README.md` | documented |
| `validate:daily` | `node --import tsx scripts/run-governance-check.ts tier daily` | README validation tiers | documented |
| `validate:pr` | `node --import tsx scripts/run-governance-check.ts tier pr` | README validation tiers | documented |
| `validate:release` | `node --import tsx scripts/run-governance-check.ts tier release` | README validation tiers | documented |
| `demo:runtime-governance` | `node --import tsx scripts/run-runtime-governance-demo.ts` | README and `docs/end-to-end-host-client-example.md` | documented |
| `model:check` | `node --import tsx scripts/check-codex-cli-models.ts` | model-check evidence docs | needs Phase 1 mapping |
| `preflight:codex-cli-env` | `node --import tsx scripts/run-codex-cli-environment-preflight.ts` | Codex CLI preflight docs | needs Phase 1 mapping |
| `smoke:contract` | `node --import tsx scripts/run-codex-cli-contract-smoke.ts` | README release validation and host smoke docs | documented |
| `smoke:readonly:real` | `node --import tsx scripts/run-codex-cli-real-readonly-smoke.ts` | `docs/codex-cli-real-host-smoke-release-checklist.md` | documented |
| `smoke:telemetry` | `node --import tsx scripts/run-codex-cli-readonly-smoke-telemetry.ts` | `docs/codex-cli-real-host-smoke-release-checklist.md` | documented |
| `smoke:workspace-write:telemetry` | `node --import tsx scripts/run-codex-cli-workspace-write-smoke-telemetry.ts` | `docs/codex-cli-real-host-smoke-release-checklist.md` | documented |
| `canary` | `node --import tsx scripts/run-canary-test.ts` | README release validation | documented |
| `canary:write` | `node --import tsx scripts/run-canary-test.ts --risk medium` | README release validation | documented |
| `canary:external` | `node --import tsx scripts/run-canary-test.ts --risk high` | README release validation | documented |
| `evidence:collect` | `node --import tsx scripts/collect-evidence.ts` | README release validation and evidence manifest | documented |

## README Entry Check

Current README already links to the lightweight entry surfaces:

- `docs/README.md`
- `docs/current/CURRENT_STATE.md`
- `docs/validation-tiers.md`
- `docs/governance/README.md`
- current host and example docs

Phase 0 conclusion: do not rewrite README before Phase 1 creates the control
plane documents. The next README update should only add links after these files
exist:

- `docs/governance/GOVERNANCE_CONTROL_PLANE.md`
- `docs/governance/RELEASE_GATE_MATRIX.md`
- `docs/governance/EVIDENCE_POLICY.md`
- `docs/governance/GLOSSARY.md`
