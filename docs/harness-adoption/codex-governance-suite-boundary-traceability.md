# Codex Governance Suite Boundary Traceability

## 1. Status

This is a docs-only traceability document.

It is not:

- a contract implementation
- a schema
- a package
- a checker
- a Harness adapter
- runtime integration
- memory integration
- CI
- a monorepo plan

No implementation is authorized by this document.

Current baseline:

- `Codex Governance Suite` remains a strategic and management umbrella only.
- `Codex_Autonomous_Work_Harness`, `codex-router`, and `codex-memory` remain separate repositories.
- Harness is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- No Harness adapter exists.
- No runtime integration exists.
- No governed memory behavior is active.

## 2. Purpose

This document connects existing `Codex Governance Suite` boundary statements to future contract topics, forbidden overclaims, review questions, non-authorization gates, and planning-only checker relevance.

It helps reviewers answer:

- What boundary is this contract topic protecting?
- What overclaim does this prevent?
- What future checker could inspect this?
- What remains forbidden unless separately approved?

This document does not state that contracts are implemented, a checker exists, runtime mapping exists, or memory behavior exists.

## 3. Scope

In scope:

- docs-only traceability
- boundary statement mapping
- contract topic mapping
- forbidden overclaim mapping
- review questions
- non-authorization gates
- future checker relevance at planning level

Out of scope:

- source code
- schema
- package
- script
- test
- CI
- checker implementation
- Harness adapter
- runtime behavior
- memory calls
- MCP calls
- `codex exec`
- App Server
- monorepo or workspace configuration
- release, deploy, or tag

## 4. Traceability Principles

- Every contract topic must trace back to a boundary.
- Every boundary must name the risk it prevents.
- Every future checker idea must remain report-only unless separately approved.
- Memory-related topics must preserve side-effect classification.
- Documentation language must not imply implementation.
- Repository roles must remain separate.
- Next steps must stay docs-only unless separately approved.

## 5. Boundary-to-Contract Matrix

| Boundary statement | Contract topic | Why it matters | Current status |
|---|---|---|---|
| Suite is strategic / management umbrella only. | `ProjectProfile`, `GovernanceDecision` | Prevents the suite label from becoming execution authority. | Docs-only boundary. |
| Repositories remain separate. | `ProjectProfile`, `SideEffectClass` | Prevents repository-role collapse or hidden coupling. | No repo merge or dependency authority. |
| Harness is not integrated with `codex-router`. | `HarnessGoal`, `GovernanceDecision` | Keeps Harness concepts at mapping-review level. | No integration exists. |
| `codex-router` has not adopted `governance-v0.1.0`. | `ValidationVocabulary`, `GovernanceDecision` | Prevents adoption language from implying runtime behavior. | No adoption exists. |
| No Harness adapter exists. | `HarnessGoal`, `CheckpointEvidence` | Prevents adapter planning from sounding implemented. | Adapter remains future separate approval. |
| No runtime integration exists. | `SideEffectClass`, `ValidationVocabulary` | Keeps runtime actions hard-gated and non-implied. | No runtime behavior exists. |
| No governed memory behavior is active. | `MemoryOverviewPolicy`, `SideEffectClass` | Prevents memory governance claims without explicit contract and approval. | No memory behavior exists. |
| Harness must not directly call `codex-memory`. | `MemoryOverviewPolicy`, `SideEffectClass` | Preserves memory side-effect boundaries and explicit mediation. | Forbidden direction. |
| `codex-router` must not read `.agent_board`. | `ProjectProfile`, `HarnessGoal` | Prevents router from swallowing Harness task rails. | Forbidden direction. |
| `codex-router` must not import `codex-memory` internals. | `MemoryOverviewPolicy`, `ProjectProfile` | Preserves memory runtime boundary. | Forbidden direction. |
| Memory calls require explicit future contract. | `MemoryOverviewPolicy`, `CheckpointEvidence` | Keeps memory access auditable and separately approved. | No memory call authorized. |
| Checker work is planning only. | `ValidationVocabulary`, `CheckpointEvidence` | Prevents review aids from becoming CI or code. | No checker exists. |
| Contracts are topics, not implementations. | All contract topics | Prevents names from becoming API claims. | No contract implementation exists. |
| No monorepo/workspace/package authority exists. | `ProjectProfile`, `SideEffectClass` | Prevents suite planning from changing repository structure. | No package, workspace, or monorepo authority. |
| Push/merge/tag/release/deploy remain human-gated. | `SideEffectClass`, `GovernanceDecision` | Keeps remote and release actions explicit. | Human-gated only. |

## 6. Boundary-to-Overclaim Matrix

| Boundary | Forbidden overclaim | Safer wording |
|---|---|---|
| Suite is strategic only. | `Codex Governance Suite` is implemented. | `Codex Governance Suite` is a strategic umbrella. |
| Repositories remain separate. | The three repos are integrated. | The repositories remain separate and may be discussed through docs-only planning. |
| Harness is not integrated. | Harness drives `codex-router`. | Harness concepts may inform future contract topics. |
| `governance-v0.1.0` is not adopted. | `codex-router` adopted `governance-v0.1.0`. | Adoption remains unimplemented and separately gated. |
| `HarnessGoal` is a topic. | `HarnessGoal` exists as runtime type. | `HarnessGoal` is a contract topic and future review question. |
| `GovernanceDecision` is a topic. | `GovernanceDecision` exists as decision engine. | `GovernanceDecision` is proposed vocabulary for review output. |
| Memory boundary is explicit. | `MemoryOverviewPolicy` calls `codex-memory`. | `MemoryOverviewPolicy` is docs-only memory-boundary planning. |
| Side effects are not enforced. | `SideEffectClass` is enforced by code. | `SideEffectClass` is proposed vocabulary for side-effect review. |
| Evidence is not serialized. | `CheckpointEvidence` is serialized by runtime. | `CheckpointEvidence` is a proposed evidence category. |
| Validation labels are not CI. | `ValidationVocabulary` is wired into CI. | `ValidationVocabulary` is docs-only reporting vocabulary. |
| Profiles are not schemas. | `ProjectProfile` exists as schema or loader. | `ProjectProfile` is a future review question. |
| Checker work is planning only. | Checker exists. | Checker strategy remains docs-only planning. |
| Adapter work is not approved. | Harness adapter exists. | Harness adapter remains a separately approved future possibility. |
| Runtime is not integrated. | Runtime integration exists. | Runtime integration is not present and not authorized. |
| Memory behavior is inactive. | Governed memory behavior is active. | Governed memory behavior is not active. |
| Memory reads are gated. | `search_memory` is read-only by default. | Any memory tool use requires explicit future contract and approval. |
| Memory writes are gated. | `record_memory` can be auto-triggered. | Memory writes remain forbidden without separate approval. |
| Repository structure is stable. | Suite is a monorepo. | Suite is a strategic umbrella, not a repository layout. |

## 7. Boundary-to-Checker Relevance

| Future checker idea | Boundary it would inspect | Allowed future behavior | Forbidden behavior |
|---|---|---|---|
| Harness workspace read-only checker | Harness task rails must not become router runtime inputs. | Future checker may report whether docs mention `.agent_board` boundaries. It is not implemented and must be read-only/report-only/local-repo-only first. | No checker is authorized here. No CI checker, mutation, runtime call, or Harness adapter is authorized. |
| `codex-router` Harness adoption checker | Harness concepts must remain docs-only until explicit implementation approval. | Future checker may report overclaim phrases in `codex-router` docs. It is not implemented and must be read-only/report-only/local-repo-only first. | No checker is authorized here. No schema, package, CI rule, or runtime adoption is authorized. |
| `codex-memory` health / side-effect checker | Memory calls and governed memory behavior are not authorized. | Future checker may report memory-boundary wording in docs. It is not implemented and must be read-only/report-only/local-repo-only first. | No memory call, MCP query, storage access, or memory runtime behavior is authorized. |
| Suite-level alignment checker | Suite remains a strategic umbrella, not monorepo or integration. | Future checker may report whether docs preserve repository-role separation. It is not implemented and must be read-only/report-only/local-repo-only first. | No suite-level automation, CI enforcement, monorepo config, or cross-repo mutation is authorized. |

## 8. Contract Topic Coverage

### HarnessGoal

Traceable boundaries:

- user intent must not become execution authority
- hard gates must remain visible
- repository scope must remain explicit

Still missing:

- no implementation contract
- no parser
- no schema
- no fixture

### GovernanceDecision

Traceable boundaries:

- review output is not execution
- stop/proceed must name risk and evidence
- no decision engine exists

Still missing:

- no implementation
- no reducer
- no runtime state update

### MemoryOverviewPolicy

Traceable boundaries:

- memory is advisory, not authoritative
- memory calls are not authorized
- memory side effects must be classified

Still missing:

- no memory call
- no MCP query
- no governed memory behavior

### SideEffectClass

Traceable boundaries:

- read-only is not zero-side-effect
- audit-write and memory-write must be separated
- remote/runtime/production actions are hard-gated

Still missing:

- no enforcement
- no schema
- no command blocker

### CheckpointEvidence

Traceable boundaries:

- evidence must separate observation from inference
- validation not run must be explicit
- secret/private runtime data must not be stored

Still missing:

- no serializer
- no collector
- no storage path

### ValidationVocabulary

Traceable boundaries:

- labels are not validations by themselves
- CI is not wired
- partial validation must not be overclaimed

Still missing:

- no validator
- no test
- no CI rule

### ProjectProfile

Traceable boundaries:

- project-specific rules must not become hidden execution authority
- suite-level vocabulary must not swallow repo-specific governance
- monorepo/workspace behavior is not authorized

Still missing:

- no schema
- no loader
- no package
- no workspace config

## 9. Missing Traceability

Still missing before any implementation:

- no machine-readable contract
- no JSON Schema
- no TypeScript types
- no fixture set
- no checker implementation
- no side-effect classifier
- no memory policy implementation
- no router dry-run mapping
- no suite-level manifest
- no rollback/removal plan for future implementation
- no implementation approval

## 10. Non-Authorization Gates

This document does not authorize:

- source code
- packages
- schemas
- scripts
- tests
- CI
- checker
- Harness adapter
- runtime integration
- `codex-memory` call
- `record_memory`
- `search_memory`
- `codex exec`
- App Server
- MCP calls
- monorepo config
- workspace config
- release
- deploy
- tag
- merge

## 11. Review Checklist

Before accepting future docs, reviewers should ask:

- Does every new contract topic trace to a boundary?
- Does every boundary name the risk it prevents?
- Does the text avoid implementation claims?
- Does the text avoid memory side-effect confusion?
- Does the text avoid monorepo implication?
- Does the text keep merge/tag/release/deploy human-gated?
- Does the text keep checker/adapter/schema/package as future separate approvals?

## 12. Next Safe Step

The next safe step after this document should remain docs-only.

Suggested next safe tasks:

- SideEffectClass taxonomy planning
- checker strategy planning

Do not recommend implementation yet.

## 13. Overclaim Warnings

Do not say:

- traceability is enforced
- checker exists
- contracts are implemented
- side-effect class is enforced
- memory policy is active
- runtime is integrated
- repos are merged
- Suite governs memory behavior

Acceptable wording:

- traceability aid
- planning matrix
- docs-only review tool
- non-authorization gate
- future separately approved implementation
