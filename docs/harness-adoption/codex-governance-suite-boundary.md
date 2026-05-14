# Codex Governance Suite Boundary

## 1. Status

`Codex Governance Suite` is a strategic and management umbrella only at this stage.

It is not:

- an implemented platform
- a runtime integration
- a monorepo
- a package boundary
- a deployment target
- an authorization to mutate any repository

This document is documentation-only. It records boundaries for future planning and does not authorize implementation.

Current explicit status:

- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- No Harness adapter exists.
- No runtime integration exists.
- No implementation is authorized by this document.

## 2. Purpose

The purpose of this document is to prevent the `Codex Governance Suite` concept from being mistaken for an implementation plan, package structure, runtime system, or repository merger.

It defines the current conceptual relationship between:

- `Codex_Autonomous_Work_Harness`
- `codex-router`
- `codex-memory`

The goal is to keep future governance planning aligned, explicit, and reversible before any code, adapter, checker, schema, CI, runtime, or memory side effect is proposed.

## 3. Repository Roles

The repositories remain separate.

| Repository | Role | Current boundary |
|---|---|---|
| `Codex_Autonomous_Work_Harness` | Governance control tower. | Defines operating principles, task rails, safety gates, and sustained-work governance concepts. |
| `codex-router` | Policy and execution governance SDK. | Hosts reusable routing, approval gating, execution governance, recovery, auditability, and DGP policy surfaces. |
| `codex-memory` | Memory MCP runtime. | Provides memory storage and retrieval through explicit memory runtime or MCP contracts. |

No repository is currently subordinate to another repository as an implementation dependency.

## 4. Allowed Architecture

The allowed architecture direction is:

```text
Harness concepts
-> codex-router policy mapping
-> codex-memory through explicit adapter or MCP contract
```

Allowed planning may describe:

- how Harness governance concepts map to `codex-router` policy language
- how `codex-router` could define explicit contracts for memory-related governance signals
- how a future adapter or MCP contract might mediate calls into `codex-memory`
- how dry-run, read-only, report-only checks could validate boundary assumptions before implementation

Allowed planning must remain documentation-only unless a separate explicit implementation scope is approved.

## 5. Forbidden Architecture

The following directions are forbidden by this boundary document:

- `codex-memory` depending on `Codex_Autonomous_Work_Harness`
- `Codex_Autonomous_Work_Harness` directly touching the `codex-memory` database
- `Codex_Autonomous_Work_Harness` directly calling the `codex-memory` runtime
- `codex-router` reading `.agent_board`
- `codex-router` importing `codex-memory` internals
- implicit memory calls from governance policy code
- automatic push, merge, tag, release, or deploy actions
- treating the suite concept as a monorepo plan
- treating the suite concept as package creation authority

Any future cross-repository interaction must be mediated through explicit contracts and reviewed separately.

## 6. Dependency Direction

Conceptual dependency direction is one-way:

```text
Harness governance concepts
-> codex-router governance policy and execution-control contracts
-> explicit memory adapter or MCP contract
-> codex-memory runtime
```

This direction does not create package dependencies today.

It does not authorize:

- dependency changes
- workspace or monorepo configuration
- package publication
- runtime imports
- schema creation
- source code changes

## 7. Contract Layer: docs-only for now

The contract layer is docs-only for now.

Future contract planning may define names, responsibilities, invariants, and validation expectations for:

- memory-related governance events
- read-only memory capability discovery
- dry-run governance checks
- adapter boundaries
- MCP call boundaries
- failure and audit vocabulary

These planning notes must not be treated as implemented APIs, schemas, packages, or runtime behavior.

## 8. Checker Strategy: planning only, no implementation

A future checker may be planned as a read-only, report-only boundary verifier.

At this stage, checker work is limited to documentation such as:

- proposed scope
- target files or contracts to inspect
- forbidden coupling patterns to report
- report-only output shape
- validation expectations
- rollback or removal notes

This document does not authorize checker implementation, checker tests, checker fixtures, package files, scripts, CI workflow changes, or runtime execution.

## 9. Memory Side-effect Boundary

No memory side effect is authorized.

This document does not authorize:

- calling `codex-memory`
- writing memory records
- reading memory records
- querying memory through MCP
- modifying memory schemas
- touching memory databases
- importing memory runtime internals
- using memory calls as validation evidence

Any future memory interaction must be explicitly scoped, dry-run-first where possible, mediated through a contract, and approved separately.

## 10. Current Non-Authorization

The `Codex Governance Suite` concept does not authorize:

- source code changes
- adapter implementation
- checker implementation
- schema creation
- package creation
- package dependency changes
- CI workflow changes
- runtime execution
- `codex exec`
- App Server startup
- memory calls
- repository mutation outside the explicitly edited documentation files
- push, merge, tag, release, or deploy actions

The concept is a management umbrella, not an execution permission.

## 11. Next Safe Step

The next safe step is staged documentation review.

Review should confirm:

- the repository roles are accurate
- the dependency direction is one-way and explicit
- no runtime integration is implied
- no monorepo direction is implied
- no memory side effect is implied
- no checker, adapter, schema, package, CI, or runtime work is authorized

Any implementation proposal must be a separate scoped task after review.

Any future first implementation, if separately approved, must be:

- read-only
- report-only
- local-repo-only

## 12. Overclaim Warnings

Avoid claims that imply the suite already exists as software.

Do not say:

- `Codex Governance Suite` is implemented
- the three repositories are integrated
- the repositories form a monorepo
- Harness drives `codex-memory` directly
- `codex-router` can read Harness task rails directly
- `Codex Governance Suite` has active governed memory behavior
- a checker exists
- a runtime integration exists
- governance memory behavior is active

Acceptable wording:

- strategic umbrella
- management boundary
- documentation-only concept
- proposed dependency direction
- future contract planning
- staged review required before implementation
