---
title: Governance Control Plane
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-16
verified_by:
  - git diff --check
  - npm run docs:governance
  - npm run governance -- audit execution-boundary-current-surface
  - npm run governance -- audit offline-execution-capsule-boundary
  - npm run governance -- audit state-sync
  - npm run validate:pr
supersedes: []
superseded_by: null
applies_to:
  - governance
  - app-server-governance
  - offline-contracts
  - release-review
---

# Governance Control Plane

This is the current human-readable capability and authority entry point for
`codex-router`. It must be read with the machine-authoritative state record at
`docs/current/state-sync-record.json` and the operator display at
`docs/current/CURRENT_STATE.md`.

The active product line is App Server execution governance plus deterministic
offline contract evidence. Phase-numbered runtime work, DGP, provider execution,
Desktop host, VCPToolBox, and Agent OS documents are historical implementation
or research evidence. They do not form parallel current roadmaps and do not
authorize execution.

## Authority Model

| Surface | Current authority |
| --- | --- |
| `docs/current/state-sync-record.json` | Machine authority for repository identity, allowed contexts, and filtered source-tree digest. |
| `scripts/run-state-sync-audit.ts` and tests | Runtime observation gate for exact repository, context, tree, and clean-state facts; never execution authorization. |
| `docs/current/CURRENT_STATE.md` | Operator interpretation and next governed step; display only. |
| This document | Human-readable capability posture and authority map. |
| `CODEX_EXECUTION_GOVERNANCE_ARCHITECTURE.md` | Current product and responsibility boundary. |
| `CODEX_GOVERNANCE_BASELINE.md` | Frozen public contract and execution-boundary baseline. |
| `RELEASE_GATE_MATRIX.md` | PR, main, and release validation policy. |
| `EVIDENCE_POLICY.md` | Evidence retention and redaction boundary. |
| `THREAT_MODEL.md` | Current threat and control map. |
| `CHANGE_CONTROL.md` | Requirements for changing a governance boundary. |
| `WORKSPACE_WRITE_RELEASE_GATE.md` | Defensive promotion stop; not a workspace-write roadmap or permit. |
| ADR 006-011 | Accepted App Server and offline-contract decisions listed in the current governance surface. |
| App Server file-change runbook | Current deterministic harness procedure and live-execution stop. |
| `PR_*`, `PHASE_*`, `FUTURE_*`, dated roadmaps, closeouts, packets, receipts | Historical evidence only unless a current authority explicitly promotes a bounded fact. |

No document, test, passing audit, fake canary, offline receipt, or content
digest can replace Jenn's separately required authorization for a live or
external side effect.

## Capability Status

| Capability | Status | Real execution allowed | Current rule |
| --- | --- | ---: | --- |
| Protocol and public package contracts | active / pre-production | N/A | Keep the five named export subpaths stable, tested, and reviewable. |
| Capability classification and authorization | active / fail-closed | No by itself | Unknown, invalid, or failed authorization evaluation declines or enters reconciliation; it never leaves a pending request without a stable outcome. |
| File-change preview, journal, retain, reconciliation, rollback | guarded / receipt-bound | Narrow rollback only | Exact repository, HEAD, path, hash, permit, and drift checks apply; uncertainty fails closed. |
| App Server normalized adapter and offline harness | pre-production / offline evidence | No live file apply | Strict correlation and decline behavior are tested; approval-before-application timing is not proven. |
| App Server exact-version review | `blocked / no_go` | No | The reviewed artifact does not establish live proposal-before-apply or effective runtime configuration. |
| No-environment proposal contract | `verified_offline / no_go` | No | Strict text-only, empty-tool, exact-schema fixtures are non-live and non-promotable. |
| Runtime tool-inventory attestation | test-only fake issuer | No | Runtime-owned issuance, freshness, durable replay, and live inventory proof remain absent. |
| Offline execution capsule | `test_only_simulated` | No | Only synthetic non-sensitive tasks, the shipped in-memory CAS, a registered fake transform, prestore boundaries, and independent verifier are supported. |
| Caller-injected capsule store or transform | caller-trusted test fixture | No | Filesystem, network, logging, ambient-global, and other side effects are not mechanically excluded. |
| Real App Server file-change smoke | blocked | No | Requires a separate exact-version security review and explicit authorization after proposal-before-apply is proven. |
| Real Codex CLI or provider execution | blocked | No | Historical provider/host artifacts do not grant current authority. |
| Real worker, remote CAS, live receipt, retain/apply promotion | not implemented / frozen | No | Requires a new schema/versioned boundary, independent review, and explicit authorization. |
| Real workspace-write or external write | blocked | No | Offline fixtures, local temporary repositories, fake canaries, and permits do not promote this class. |
| Release, deploy, publish, tag, production mutation | blocked by default | No | Requires a separately authorized release path and passing release gates. |
| Secret, credential, token, cookie, env, provider-auth mutation | blocked by default | No | Never expose values; any named mutation requires explicit authorization. |

## Accepted Decision Chain

The current chain is deliberately narrow:

1. ADR 006 keeps App Server as the runtime but does not trust unproven apply
   timing.
2. ADR 007 requires an exact proposal before an apply could be considered.
3. ADR 008 records that the exact-version live path remains `NO-GO`.
4. ADR 009 and ADR 010 add offline-only proposal and inventory evidence without
   promoting live authority.
5. ADR 011 adds a test-only execution capsule whose receipt cannot enter
   preview, permit, retain, apply, or workspace-promotion flows.

ADRs 001-005 remain foundation decisions. They do not independently authorize
provider execution, a host runtime, or workspace-write.

## Default Runtime Posture

The default posture is local, deterministic, inspectable, and non-live:

1. Prefer schemas, pure policy, in-memory fixtures, and offline harnesses.
2. Bind identity, scope, hashes, expiry, replay state, and evidence before any
   guarded transition.
3. Reject sensitive paths and credential-like content before copying, storing,
   previewing, retaining, or applying data.
4. Normalize failures into stable blocked or reconciliation outcomes.
5. Preserve evidence as sanitized refs, hashes, statuses, reason codes, and
   summaries rather than raw prompts, responses, patches, or credentials.
6. Treat every unlisted capability as blocked.

The current freeze excludes ADR 012, a real worker, remote CAS, new App Server
execution probes, and further capability expansion until
`R2_GOVERNANCE_INTEGRITY_CLOSEOUT` is completed and reviewed.

## Current Operating Entry Points

| Need | Entry point |
| --- | --- |
| Current repository state | `docs/current/CURRENT_STATE.md` |
| Current documentation map | `docs/README.md` |
| Current governance map and ADR links | `docs/governance/README.md` |
| Product architecture | `CODEX_EXECUTION_GOVERNANCE_ARCHITECTURE.md` |
| App Server file-change procedure | `runbooks/CODEX_APP_SERVER_FILE_CHANGE_GOVERNANCE.md` |
| Validation and release policy | `RELEASE_GATE_MATRIX.md` and `docs/validation-tiers.md` |
| Evidence safety | `EVIDENCE_POLICY.md` |
| Threats and controls | `THREAT_MODEL.md` |
| Boundary change requirements | `CHANGE_CONTROL.md` |
| Governance command discovery | `npm run governance -- list` |
| Historical command discovery | `npm run governance -- list --all` |
| Documentation integrity | `npm run docs:governance` |
| Current execution boundary | `npm run governance -- audit execution-boundary-current-surface` |
| Offline capsule boundary | `npm run governance -- audit offline-execution-capsule-boundary` |
| State sync | `npm run governance -- audit state-sync` |

`list --all` is an archive-navigation mechanism. It does not make an old DGP,
provider, Desktop, recovery, or Agent OS route current.

## Required Evidence

Current governance claims require the exact reviewed source plus at least one
appropriate deterministic signal:

- a passing local command named in `verified_by`;
- a passing GitHub check on the same PR head;
- a matching structured state-sync digest for that exact head;
- a sanitized evidence artifact or accepted ADR linked by this current surface.

Raw prompts, provider responses, stdout/stderr transcripts, patches, env values,
tokens, cookies, credentials, and private state are not acceptable governance
documentation.

## Failure Policy

- If authorization evaluation fails, decline; if decline delivery is uncertain,
  enter reconciliation.
- If state-sync fails or the exact reviewed head differs, do not merge.
- If a budget, content, identity, expiry, replay, or evidence binding fails,
  stop before the next side effect and return a stable blocked result.
- If live timing, effective runtime configuration, isolation, or store/worker
  side effects are unproven, retain `NO-GO`.
- If a capability is absent from this current surface, treat it as blocked until
  current change control explicitly adds it.
