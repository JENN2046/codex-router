# VCPChat V1 Embedding Positioning Mirror

## Status

This document mirrors the current VCPChat V1 product-positioning decision from
the `codex-router` side.

It exists so the first embedding target can be understood from inside
`A:\codex-router\docs` without relying on thread history alone.

It is intentionally not the primary product-definition source of truth. The
host-product wording should remain anchored in the VCPChat-side document:

- `A:\VCP\VCPChat\docs\vcpchat_v1_positioning_scope_non_goals_success_criteria_20260423.md`
- `A:\VCP\VCPChat\docs\vcpchat_v1_scope_freeze_20260423.md`

## Embedding Interpretation

For the first real embedding pass, `VCPChat V1` should be treated as:

- a native VCP agent desktop host
- the first concrete desktop embedding target for `codex-router`
- a host that preserves native VCP semantics instead of flattening them into a
  generic Codex-compatible host abstraction first

Under this interpretation:

- `VCPToolBox` remains the donor cognition, memory, and tool runtime core
- `VCPChat` remains the desktop interaction shell, renderer, observer surface,
  and host carrier
- `codex-router` supplies the explicit governance shell on top

## Why This Matters To codex-router

This positioning changes how the first embedding should be evaluated.

The V1 task is not:

- proving that `codex-router` can wrap any desktop host generically
- replacing the current Codex Desktop runtime
- building a new memory backend

The V1 task is:

- proving that `codex-router` can govern a real native VCP desktop host
- adding explicit routing, approval, preflight, checkpoint, resume, telemetry,
  and audit behavior around the existing VCP runtime
- doing that without breaking native VCP memory and tool semantics

## Memory Interpretation

For the VCPChat embedding line, the V1 donor memory path remains:

- `VCPChat -> VCPToolBox /mcp/codex-memory`

This should be described as:

- reuse of the full VCP Agent memory core
- with the core transport entrypoints wired first

The first embedded host surface is limited to:

- `record_memory`
- `search_memory`
- `memory_overview`

This donor-path statement must not be confused with the current standalone
Codex Desktop runtime path at `A:\codex-memory`.

## Scope Interpretation

From the `codex-router` perspective, the first VCPChat pass should stay narrow.

Required first-pass outcomes:

- a real host path exists
- the donor memory path works in host reality
- at least one meaningful run/checkpoint/resume path is validated
- governance behavior becomes explicit instead of remaining only implicit

Deferred beyond the first stable host pass:

- full generic Codex-host compatibility
- complete runtime-method coverage on day one
- total router-ization of all historical VCPChat feature surfaces

## Router-Side Success Criteria

The first embedding should be considered successful from the `codex-router`
side when:

- `VCPChat` can host at least one stable `codex-router` execution path
- the donor memory transport is stable in the embedded host flow
- the host wiring preserves native VCP semantics
- the governance shell is real, observable, and recoverable
- scope remains controlled and does not turn into an unrelated VCPChat rewrite

## Decision Summary

From the `codex-router` side, the correct one-line interpretation is:

`VCPChat V1` is the first native VCP desktop host embedding for
`codex-router`, not a generic Codex-host compatibility demo.
