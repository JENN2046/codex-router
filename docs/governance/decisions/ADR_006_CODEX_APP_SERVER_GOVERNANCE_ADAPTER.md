---
title: ADR 006: Codex App Server Governance Adapter
status: active
owner: governance
created: 2026-07-11
last_verified: 2026-07-11
verified_by:
  - node --import tsx --test tests/codex-app-server-adapter.test.ts
  - npm run test:package-consumer
supersedes: []
superseded_by: null
applies_to:
  - codex-app-server
  - codex-sdk
  - authorization
  - public-api
---

# ADR 006: Codex App Server Governance Adapter

## Context

The repository previously emphasized Desktop and Agent OS facades and contained
multiple execution-related internal paths. The product needs one auditable
governance chain without rebuilding Codex authentication, history, streaming,
or file application.

The official [App Server guide](https://developers.openai.com/codex/app-server)
defines the integration surface, while the
[approvals and security guide](https://developers.openai.com/codex/agent-approvals-security)
shows that approval and sandbox policy affect whether a request is intercepted.
Therefore merely receiving App Server events is not proof that the router is an
authorization enforcement point.

## Decision

Codex App Server remains the runtime. `CodexAppServerAdapter` is a governance
adapter over an injected, versioned normalized transport and never applies the
proposed Codex change itself.

The adapter may enforce an approval only with a session attestation binding the
schema profile, Codex version, effective `on-request` approval policy,
`workspace-write` sandbox, proven file-change interception, evidence source,
test/live scope, and an in-module preview-enforcer trust record. Any unproven or
incompatible session is `observe_only` and cannot auto-approve or claim a
governed retain result. No live enforcer ships in `0.1.0`, so current live
profiles are necessarily observe-only; only the internal disposable test
harness can exercise fake automatic acceptance.

File-change proposals are correlated across thread, turn, item, request, and
event sequence; the complete proposal is canonicalized and hash-bound before
approval. Missing, duplicate, replayed, late, out-of-order, disconnected, or
schema-drifted events fail closed. Replay, disconnect, or schema/profile drift
quarantines the complete session and requires a new attestation. Command and
permission requests remain exact-proposal, human-only operations. Delete and
rename are declined before apply because beta retain/rollback supports only
create/update. `CodexSdkAdapter` is read-only for this beta.

The public package is contracted to the five named subpaths. Agent OS, Desktop,
MCP/A2A, store, telemetry, and generic provider execution remain internal.

## Alternatives Considered

- Build a parallel Codex runtime.
  - Benefit: total local control.
  - Risk: duplicates auth, history, streaming, and file-application semantics.
  - Status: rejected.
- Treat every App Server connection as an enforcement point.
  - Benefit: simpler integration.
  - Risk: policy configuration may bypass file-change interception.
  - Status: rejected in favor of attestation plus observe-only fallback.
- Auto-approve command and permission requests after policy checks.
  - Benefit: broader automation.
  - Risk: expands the beta beyond structured file changes.
  - Status: deferred; human-only.
- Preserve old public facades through deprecation.
  - Benefit: smoother compatibility.
  - Risk: prolongs an unstable `0.1.0/private` contract and parallel narratives.
  - Status: rejected; direct contraction is intentional.

## Consequences

- Raw App Server protocol changes require a versioned codec/fixture update and
  cannot silently pass the adapter schema.
- Fake profiles prove deterministic adapter logic, not live interception.
- Unresolved durable journal state on restart forces reconciliation; the beta
  does not reconstruct or infer the interrupted App Server turn.
- A live integration remains blocked until an exact schema-generation and smoke
  command receives separate operator authorization.
- App Server retains responsibility for applying accepted changes; the router
  verifies post-state and emits receipts.
- Consumers must use one of the five named package subpaths.
- Legacy implementations may remain internally for migration but cannot become
  new authorization dependencies or public exports.

## Verification

- `node --import tsx --test tests/authorization-kernel.test.ts`
- `node --import tsx --test tests/codex-app-server-adapter.test.ts`
- `node --import tsx --test tests/file-change-preview.test.ts`
- `node --import tsx --test tests/retain-control.test.ts`
- `npm run test:package-consumer`

Real Codex CLI, real App Server, provider execution, and real source-workspace
write are explicitly not part of this verification.

## Change Control

Changing the attestation requirements, auto-approval operation set, public
subpaths, or ownership of actual file application requires a new ADR or an
explicit superseding update to this ADR plus negative-path tests.
