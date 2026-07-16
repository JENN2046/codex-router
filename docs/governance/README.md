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
| Real App Server file apply | Not authorized |
| Real Codex CLI or provider execution | Not authorized |
| Real worker, remote CAS, retain/apply integration | Not implemented or authorized |
| Real source-workspace write, release, deploy, publish | Not authorized |

The current closeout freezes ADR 012, a real worker, remote CAS, and further App
Server execution probes. Any such work requires a separately reviewed boundary
change after governance integrity closeout.

## Runner Entry Points

Use the consolidated runner for discovery and read-only audits:

```bash
npm run governance -- list
npm run governance -- list --all
npm run docs:governance
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
