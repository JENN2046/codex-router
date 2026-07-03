---
title: Governance Glossary
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - docs review
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - governance
  - runtime-governance
  - release-review
---

# Governance Glossary

This glossary standardizes the terms used by current governance docs.

| Term | Meaning |
| --- | --- |
| Authority | A surface allowed to decide or block current behavior. |
| Claim | A structured statement that an audit can verify or reject. |
| Structured state-sync record | `docs/current/state-sync-record.json`; the machine-readable state-sync claim. |
| Policy v2 content attestation | State-sync mode that binds current source content by filtered tree digest instead of a post-merge v1 reanchor. |
| Generated display | Human-readable mirror derived from authority, such as `CURRENT_STATE.md` or `.agent_board/*`. |
| Evidence | Sanitized facts that support a governance decision. |
| Evidence ref | A resolvable pointer to evidence, preferred over raw payload storage. |
| Closeout | Historical record that a scoped slice completed with named validation. |
| Runbook | Current operational procedure for repeating a safe workflow. |
| ADR | Architecture decision record explaining why a design boundary exists. |
| Gate | A command, check, policy, or review condition that can block a transition. |
| Failure policy | The explicit consequence when a gate fails. |
| Dry-run | Non-executing path that inspects, plans, or simulates without side effects. |
| Fake canary | Controlled non-real path used to validate governance flow. |
| Real canary | Narrow real execution used only with explicit authorization and rollback. |
| Host dispatch | Boundary where a task may be sent to a host executor or CLI. |
| Provider execution | Real provider-backed execution; blocked unless explicitly gated. |
| Workspace write | Any write to repository or local workspace files. |
| External write | Any write outside the local repository, including comments, issues, services, deployments, or publishing. |
| Grant | Permission shape or capability offered by policy/host. |
| Permit | Specific approval artifact allowing a bounded action. |
| Approval | Human or policy decision to allow a specific action. |
| Operator action | Host/UI-consumable recommendation derived from governance state. |
| Anomaly | Named governance failure or suspicious runtime observation. |
| Strike | Counted anomaly occurrence used by recovery policy. |
| Lockdown | Fail-closed runtime posture after severe or repeated anomaly. |
| Checkpoint | Recoverable execution state reference. |
| PR branch validation | Validation run before merge; state-sync must use pull-request context. |
| Main closeout | Post-merge local `main` confirmation, including local state-sync audit. |
| Release action | Tag, package publish, deployment, or production promotion. |

