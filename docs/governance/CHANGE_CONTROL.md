---
title: Governance Change Control
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - governance
  - schema
  - provider
  - evidence
  - release-review
---

# Governance Change Control

Use this document to decide which governance surfaces must change with a PR.

## Change Matrix

| Change | Required updates |
| --- | --- |
| Protocol or schema field change | Protocol docs, affected package tests, ADR if contract semantics change. |
| Permit logic change | ADR 002, Threat Model, release gate notes, permit tests. |
| Provider or host dispatch change | Control Plane, ADR 003, runbook, runtime tests. |
| Evidence output change | Evidence Policy, ADR 004, templates, evidence tests. |
| Real execution gate change | Control Plane, relevant runbook, Threat Model, closeout if executed. |
| Workspace-write gate change | Workspace-write runbook, Threat Model, capability taxonomy tests. |
| State-sync claim or policy change | State-sync plan/design record, state-sync tests, current state digest/display. |
| Release/package boundary change | Release Gate Matrix, Source/Release Package Boundary, release validation. |
| New current governance check | `scripts/run-governance-check.ts`, README/governance index, tests if behavior changes. |
| Historical evidence migration | Inventory/link risk register, affected links, no authority promotion unless explicitly justified. |

## PR Requirements

Every governance PR should state:

- changed authority surfaces;
- changed display/evidence surfaces;
- validation commands;
- whether real host/provider execution was run;
- whether secrets/env/provider config were touched;
- remaining risk.

## Escalation Rules

- If a change can execute real providers, write workspace files, write external
  services, publish, deploy, tag, or mutate secrets, require explicit
  authorization and the relevant runbook.
- If a change broadens a permit, route, or capability class, update Threat Model
  and add regression coverage.
- If a document becomes current authority, link it from Control Plane or the
  governance index.
- If a historical closeout changes, keep it historical unless a current
  authority document explicitly adopts it.

## Validation Rules

- Docs-only current authority changes: `git diff --check`,
  `npm run validate:daily`, display check, and state-sync in the correct event
  context.
- Runtime governance changes: targeted tests plus broader tests justified by
  blast radius.
- Release-sensitive changes: release gate commands in
  [Release Gate Matrix](RELEASE_GATE_MATRIX.md).

