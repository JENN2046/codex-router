# ADR 0001: Future Rust Sidecar Boundary

Status: Proposed

Date: 2026-06-04

## Context

`codex-router` is currently hardening the Agent OS kernel, provider interfaces,
MCP/A2A protocol skeletons, and execution planning contracts. The project needs
a future enforcement layer that can make local side effects harder to bypass,
but Phase 3 is still centered on stabilizing governance contracts rather than
shipping a native daemon.

This ADR defines the intended boundary for a future Rust sidecar. It does not
introduce a Rust crate, a build-system change, or a live sidecar runtime.

## Decision

Rust will be treated as a future enforcement layer, not as a replacement for the
TypeScript governance and integration layer.

The project will not perform a full Rust rewrite now. TypeScript remains the
primary implementation language for the policy SDK surface, protocol adapters,
provider integration, and host-friendly APIs. A Rust sidecar may be introduced
later only at the local enforcement boundary where process, filesystem,
network, secret, logging, signing, quota, or daemon isolation properties need
stronger runtime guarantees than TypeScript can provide alone.

## Why Not Rewrite Everything In Rust Now

A full Rust rewrite would move attention away from the unstable parts of the
system that still need contract clarity. The current risk is not primarily
performance. The current risk is whether the governance kernel names the right
objects, gates the right side effects, and exposes stable provider and protocol
contracts.

Rewriting all layers in Rust now would also make the repository less friendly
for UI, SDK, desktop, and protocol-adapter work. Many consumers of
`codex-router` need a TypeScript-first API shape, fast contract iteration, and
easy integration with existing Node, desktop, MCP, and A2A tooling.

## TypeScript Responsibilities

TypeScript continues to own:

- contracts
- policy
- MCP/A2A adapters
- provider integration
- UI/SDK friendly APIs

These areas benefit from fast iteration, structural typing, JSON/Zod contract
validation, and direct compatibility with the current package ecosystem.

## Future Rust Sidecar Responsibilities

A future Rust sidecar may own local enforcement responsibilities, including:

- process sandbox
- filesystem boundary
- network egress policy
- secret broker
- append-only event log hardening
- artifact hashing/signing
- resource quota
- local daemon

The sidecar should make enforcement harder to bypass. It should not become the
place where high-level product policy, provider selection, MCP/A2A mapping, or
UI-facing SDK semantics are hidden.

## TypeScript To Rust Communication Candidates

Candidate transports include:

- JSON-RPC over stdio
- Unix domain socket
- local HTTP
- gRPC

The preferred transport is not decided in Phase 3. The decision should be made
when the first real sidecar use case is ready and can be evaluated against
operator ergonomics, Windows support, observability, debuggability, streaming
needs, startup cost, and security posture.

## Why Phase 3 Does Not Implement Rust

Phase 3 does not implement the Rust sidecar because:

- contracts are still evolving
- capability model needs to stabilize first
- provider interface needs to stabilize first
- the current bottleneck is not performance, but the enforcement boundary

Implementing Rust before those contracts settle would likely hard-code the wrong
boundary and create migration cost without improving the immediate governance
surface.

## Future Trigger Conditions

The project should revisit a Rust sidecar when one or more of these conditions
becomes active:

- executing real shell commands
- executing network egress
- requiring secret access
- requiring multiple workers
- requiring non-bypassable local enforcement

At that point, the sidecar should be introduced behind explicit contracts and
feature gates, with dry-run behavior and auditability preserved.

## Consequences

TypeScript remains the system of record for governance contracts and provider
orchestration. Rust remains a future hardening boundary for local side effects.

This keeps Phase 3 focused on the kernel/provider/protocol architecture while
leaving a clear path toward stronger native enforcement once the contracts and
capability model are ready.
