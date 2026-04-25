# VCPChat V1 Embedding Decision

## Status

This document freezes the `codex-router`-side interpretation of the approved
VCPChat V1 embedding decision.

Primary host-side source:

- `A:\VCP\VCPChat\docs\vcpchat_v1_scope_freeze_20260423.md`

Router-side positioning mirror:

- `A:\codex-router\docs\vcpchat-v1-embedding-positioning-mirror-20260423.md`

## Decision

The first real `codex-router` desktop embedding is approved to proceed through
`VCPChat` as a native VCP host path.

From the `codex-router` perspective, this means:

- `VCPChat` is the first real desktop host target
- `VCPToolBox` remains the donor runtime core
- `codex-router` is evaluated as a governance shell layered around the existing
  native VCP runtime

## Router-Side Scope Interpretation

Approved first-pass goals:

- establish one real host path
- keep the donor memory path stable
- validate checkpoint and resume behavior
- make governance behavior explicit and inspectable

Not approved as first-pass goals:

- proving generic host portability first
- replacing the current Codex Desktop runtime
- broad runtime-method completion before a stable host baseline exists
- turning the first embedding into a full VCPChat rewrite

## Memory Decision

For the first VCPChat embedding pass, the approved donor memory path is:

- `VCPChat -> VCPToolBox /mcp/codex-memory`

This should be interpreted as:

- reuse of the full VCP Agent memory core
- with only the core transport entrypoints required in the first host pass

This is an embedding decision for the VCPChat line and must not be confused
with the current standalone Codex Desktop runtime path at `A:\codex-memory`.

## Success Criteria

The router-side embedding decision should be considered met when:

1. `VCPChat` hosts at least one stable `codex-router` execution path.
2. The donor memory transport works in host reality.
3. The host path exposes explicit governance behavior.
4. Native VCP runtime semantics remain intact.
5. Scope remains controlled.

## One-Line Decision

`codex-router` should treat `VCPChat V1` as the first native VCP desktop host
embedding, not as a generic-host compatibility demo.
