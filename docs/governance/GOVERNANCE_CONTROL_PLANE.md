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
| `PR_*`, `FUTURE_*`, closeouts, packets | Historical evidence | Evidence only unless linked by a current authority document. |

## Capability Status

| Capability | Status | Real execution allowed | Current rule |
| --- | --- | ---: | --- |
| Protocol V1 contracts | active | N/A | Stable package surface; keep changes tested and reviewable. |
| Read-only dry run | active | No | Safe default for local inspection, demos, and deterministic tests. |
| Runtime governance observation | active | No by itself | May record sanitized observations, refs, anomalies, and operator actions. |
| Controlled read-only real execution | guarded | Yes, narrow | Requires explicit host injection, permit/preflight metadata, stable evidence, and no hidden provider path. |
| Workspace-write fake canary | guarded | No | May validate control flow without real host writes. |
| Workspace-write real canary | experimental / blocked by default | No by default | Requires a fresh explicit authorization packet for the named canary and rollback evidence. |
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
| Term definitions | `GLOSSARY.md` |
| Available current checks | `npm run governance -- list` |
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

