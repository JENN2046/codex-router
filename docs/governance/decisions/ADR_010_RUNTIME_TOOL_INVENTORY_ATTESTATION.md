---
title: ADR 010: Runtime Tool Inventory Attestation
status: accepted
date: 2026-07-15
validation:
  - npm run test:app-server:runtime-tool-inventory
  - npm run audit:app-server:runtime-tool-inventory
  - npm run typecheck
  - npm test
  - npm run build
---

# ADR 010: runtime tool inventory attestation remains test-only

## Context

ADR 009 proved a strict no-environment proposal contract offline, but it did
not prove the effective tool inventory of a live App Server. Existing
`AppServerSessionAttestation` values are supplied by adapter callers and cannot
become the trust root for live capability claims. Empty `environments`, an
empty caller-declared dynamic-tool list, `outputSchema`, or prompt instructions
cannot prove that inherited MCP, web, extension, provider, collaboration,
hook, grant, or cached-approval surfaces are absent.

## Decision

Introduce the internal, versioned
`RuntimeToolInventoryAttestation` contract with these boundaries:

1. An attestation is accepted only from an object registered in a module-private
   trusted-attestor registry. An arbitrary client object is rejected before its
   `attest()` method can execute. The repository currently registers only a
   clearly named `test_only` fake attestor. No production or live issuer exists.
2. The issuer binds a runtime instance and process identity: Codex version,
   protocol version, runtime instance ID, PID, process-start nonce, executable
   SHA-256, source commit, and generated-schema bundle SHA-256.
3. A challenge value plus exact canonical hashes bind the `thread/start` and
   `turn/start` request bytes. The test-only fixture uses a static challenge,
   and attestation IDs are consumed only by a trusted in-process replay store;
   neither mechanism proves live freshness or durable cross-process replay
   protection.
4. One strict v1 full effective-configuration schema is canonicalized and
   hash-bound. Its security projection is derived from that same parsed value
   and requires `approvalPolicy: never`, `read-only`, no environments, no
   dynamic tools, and no network access.
5. Resolved permissions must contain no writable roots, network, external, or
   credential access. The exhaustive tool inventory, grants, and cached
   approvals must all be empty. Permission, tool-call, MCP, and provider hooks
   must all be absent. The approval store must be empty and bound to an exact
   generation and canonical hash.
6. Missing fields, extra fields, schema drift, extra capabilities, executable
   accessor/proxy input, identity drift, request/config drift, approval-store
   drift, attestor failure, or replay fail closed.

The implementation and fixture are internal. They are not exported from the
published `codex-router/codex-adapter` facade.

## Trust disposition

A valid fake fixture produces `verified_offline / no_go`. It proves only that
the contract and evaluator agree on a deterministic hypothetical runtime
snapshot. Every assessment, including the positive fixture, fixes these fields
to false:

- `runtimeOwnedIssuerMechanicallyBound`;
- `effectiveToolInventoryMechanicallyBound`;
- `exactRuntimeRequestMechanicallyBound`;
- `challengeFreshnessMechanicallyBound`;
- `durableReplayProtectionMechanicallyBound`;
- `liveExecutionAuthorized`;
- `liveSmokeEligible`;
- `realWorkspaceWriteAuthorized`.

The audit also records that it did not execute Codex, start App Server, connect
a client, call a provider, or attempt workspace-write.

## Required future runtime interface

Reconsidering a live read-only probe requires a new App Server/runtime-owned
interface that produces the attestation after effective configuration,
permission resolution, tool registration, hooks, grants, cached approvals, and
approval-store state are finalized. The issuer must prove that its inventory is
exhaustive and bind the same process that will receive the exact hashed
requests. It must also issue an unpredictable per-session challenge and use a
durable runtime/host replay-consumption boundary. A client-side echo,
configuration file, environment variable,
self-reported boolean, or wrapper-generated fixture is insufficient.

Adding such an issuer requires a separate independent security-review PR. Even
after that review, starting App Server or connecting a loopback client requires
new explicit authorization. Workspace-write remains a separate, later gate.

If the protocol never supplies a trustworthy runtime-owned issuer, this stage
remains a durable `NO-GO`; the offline fixture must not be promoted.

## Consequences

- The repository now has a deterministic contract for the facts a future
  runtime-owned issuer would have to bind.
- Fake fixtures can test schema, identity, capability, in-process replay, and
  drift handling without creating a live trust claim.
- Existing caller-supplied session attestations cannot satisfy this contract.
- No production issuer, live probe, or workspace-write path is added.
- Absence of a trustworthy upstream issuer remains an explicit terminal
  `NO-GO`, not a reason to weaken the contract.

## Verification

```bash
npm run test:app-server:runtime-tool-inventory
npm run audit:app-server:runtime-tool-inventory
npm run typecheck
npm test
npm run build
```

These commands are offline. They read repository fixtures and use in-process
fake objects only. They do not start Codex or App Server, create a socket,
access an external service, call a provider, or exercise real workspace-write.

## Change control

Adding a live-scoped issuer, allowing any non-empty inventory/state, exporting
this module publicly, or changing any live authorization field requires a new
independent security review and explicit operator authorization. A passing
offline audit is never an execution permit.
