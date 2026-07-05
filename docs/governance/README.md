# Governance Docs

This directory is evidence-heavy by design. Use the current control-plane
documents first; treat PR-specific taskbooks, packets, closeouts, and receipts
as historical evidence unless a current authority document links them.

## Current Surface

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
- [PR-22A controlled provider execution taskbook](PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md):
  local-only planning line for the next controlled provider execution slice;
  this is not execution authorization.
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

## Runner Entry Points

Use the consolidated runner instead of per-check package scripts:

```bash
npm run governance -- list
npm run governance -- list --all
npm run docs:governance
npm run governance -- audit state-sync
npm run governance -- audit controlled-provider-execution-taskbook-review
npm run governance -- acceptance readonly-chain --check
npm run governance -- acceptance controlled-readonly-provider-execution --check
npm run governance -- operator readonly
```

Default `list` output stays focused on current/core checks. Use `--all` only
when deliberately browsing archived one-off audit and acceptance commands.
Acceptance checks refresh their committed evidence by default when they pass;
use `--check` for a no-write local review pass.

## Historical Evidence

- `PR_*_TASKBOOK.md`: scoped task plan or authorization taskbook.
- `PR_*_AUTHORIZATION_PACKET.md`: explicit future-execution gate.
- `PR_*_LOCAL_CLOSEOUT.md`: local closeout evidence for a completed slice.
- `PR_*_RECEIPT*.md`: receipt or review pass for a controlled run.
- `FUTURE_*`: draft gates for future controlled execution; not authorization
  by themselves.

When a boundary changes, update this index and the current state surface. When a
single historical slice changes, update the specific PR document only.

## Templates

- [closeout template](templates/CLOSEOUT_TEMPLATE.md)
- [runbook template](templates/RUNBOOK_TEMPLATE.md)
- [ADR template](templates/ADR_TEMPLATE.md)

## Decisions

- [ADR 001: Protocol V1 stable contract surface](decisions/ADR_001_PROTOCOL_V1.md)
- [ADR 002: Provider grant and permit model](decisions/ADR_002_PROVIDER_GRANT_AND_PERMIT_MODEL.md)
- [ADR 003: Codex CLI real execution gates](decisions/ADR_003_CODEX_CLI_REAL_EXECUTION_GATES.md)
- [ADR 004: Evidence and redaction policy](decisions/ADR_004_EVIDENCE_AND_REDACTION_POLICY.md)
- [ADR 005: Workspace-write permit v2](decisions/ADR_005_WORKSPACE_WRITE_PERMIT_V2.md)
