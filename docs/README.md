# Documentation Map

This repository separates current operating facts from historical evidence.
Start with the surfaces below. Dated, phase-numbered, provider-runtime,
Desktop, DGP, and Agent OS documents remain available for audit, but they do
not define the active roadmap unless a current authority document links them.

## Current Entry Points

- [current state](current/CURRENT_STATE.md): machine authority, capability
  posture, active freeze, validation baseline, and next governed step.
- [governance current surface](governance/README.md): compact index of the
  active control plane, ADRs, runbooks, and audit entry points.
- [governance control plane](governance/GOVERNANCE_CONTROL_PLANE.md): authority
  model and default runtime posture.
- [release gate matrix](governance/RELEASE_GATE_MATRIX.md): PR, main, and
  release gate policy.
- [evidence policy](governance/EVIDENCE_POLICY.md): allowed evidence and
  forbidden raw material.
- [threat model](governance/THREAT_MODEL.md): current governance threats and
  controls.
- [change control](governance/CHANGE_CONTROL.md): required documentation and
  validation for governance boundary changes.
- [validation tiers](validation-tiers.md): deterministic local and CI
  validation entry points plus explicit live-smoke stops.

## Current Decisions And Runbook

- [ADR 006: App Server governance adapter](governance/decisions/ADR_006_CODEX_APP_SERVER_GOVERNANCE_ADAPTER.md)
- [ADR 007: proposal before apply](governance/decisions/ADR_007_APP_SERVER_PROPOSAL_BEFORE_APPLY.md)
- [ADR 008: exact-version security review](governance/decisions/ADR_008_APP_SERVER_EXACT_VERSION_SECURITY_REVIEW.md)
- [ADR 009: no-environment proposal contract](governance/decisions/ADR_009_APP_SERVER_NO_ENVIRONMENT_PROPOSAL_CONTRACT.md)
- [ADR 010: runtime tool-inventory attestation](governance/decisions/ADR_010_RUNTIME_TOOL_INVENTORY_ATTESTATION.md)
- [ADR 011: offline execution capsule contract](governance/decisions/ADR_011_OFFLINE_EXECUTION_CAPSULE.md)
- [App Server file-change governance runbook](governance/runbooks/CODEX_APP_SERVER_FILE_CHANGE_GOVERNANCE.md)

These decisions preserve the same boundary: offline evidence may strengthen a
contract, but it does not authorize a live App Server file change, real Codex
CLI or provider execution, a real worker, a remote CAS, or a source-workspace
write.

## Navigation Rules

- Put machine state facts in `docs/current/state-sync-record.json`.
- Put the operator-facing interpretation in `docs/current/CURRENT_STATE.md`.
- Put current capability facts in
  `docs/governance/GOVERNANCE_CONTROL_PLANE.md`.
- Put active governance links in `docs/governance/README.md`.
- Keep PR taskbooks, closeouts, packets, receipts, dated roadmaps, and phase
  documents as historical evidence unless explicitly promoted by current
  change control.
- Do not infer execution authorization from an archived plan, acceptance
  fixture, fake canary, or old phase closeout.

## Historical Areas

- `docs/governance/PHASE_*` and `docs/governance/PR_*`: completed or proposed
  phase-local evidence; not the active roadmap.
- `docs/phase-*`, DGP notes, TaskGraph migration notes, and recovery-contract
  notes: historical DGP implementation and closeout evidence.
- `docs/codex-cli-*`, controlled-provider taskbooks, and provider execution
  evidence: historical or separately gated provider/host work; not current live
  authorization.
- `docs/codex-desktop-*`, `docs/desktop-*`, and host-client notes: historical
  Desktop integration evidence.
- `docs/agent-os-transformation/` and Agent OS SDK/CLI/app-server documents:
  historical transformation route, not a current expansion plan.
- `docs/harness-adoption/`, `docs/strategy/`, and `docs/patches/`: research,
  field feedback, and external integration notes.
- `docs/evidence/`: sanitized evidence artifacts; evidence does not become
  authority merely because it is retained.

GitHub Issue #2 is governed by
[`phase-21-closeout-audit-20260611.md`](phase-21-closeout-audit-20260611.md):
its Phase 21.1-21.6 acceptance items are complete, so it is historical rather
than a source for new Phase 22 work.
