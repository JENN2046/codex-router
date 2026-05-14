# Codex Governance Suite Contract Vocabulary Checklist

## 1. Status

This document is a docs-only vocabulary checklist for the proposed `Codex Governance Suite` contract topics.

It is not:

- an implemented contract
- a schema
- a package
- a checker
- a Harness adapter
- a runtime integration
- a memory integration
- a CI rule
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

The purpose of this checklist is to make Phase 2 contract vocabulary reviewable before any implementation proposal exists.

It helps reviewers distinguish:

- acceptable docs-only wording
- forbidden overclaim wording
- review questions that still need human judgment
- non-authorization gates that must remain visible

## 3. Scope

In scope:

- vocabulary guidance for contract planning documents
- overclaim prevention examples
- non-authorization gates
- review prompts for future docs-only planning

Out of scope:

- code
- schema files
- package files
- scripts
- tests
- CI workflows
- checker implementation
- Harness adapter implementation
- runtime execution
- memory calls
- repository migration or monorepo work

## 4. Checklist Rules

Use this checklist when reviewing future docs that mention Codex Governance Suite contract topics.

Every future contract-planning document should:

- say whether it is docs-only
- say that it does not authorize implementation
- keep repository roles separate
- name memory boundaries explicitly when memory is mentioned
- avoid saying that a contract topic is implemented
- avoid implying that a checker, adapter, schema, package, CI rule, runtime behavior, or memory behavior exists
- keep next steps in docs-only planning unless separate implementation approval exists

## 5. `HarnessGoal`

Allowed wording:

- `HarnessGoal` is a contract topic.
- `HarnessGoal` may describe a future way to summarize a Harness-level objective.
- `HarnessGoal` planning should separate user intent from implementation authority.

Forbidden wording:

- `HarnessGoal` is implemented.
- `HarnessGoal` exists as a runtime type.
- `HarnessGoal` is parsed by `codex-router`.
- `HarnessGoal` authorizes execution.

Review questions:

- Does the wording preserve non-goals and hard stop gates?
- Does the wording avoid turning intent into execution permission?
- Does the wording keep human authorization visible for remote, runtime, memory, and production side effects?

Non-authorization gate:

- No `HarnessGoal` type, parser, schema, package, or runtime behavior is authorized.

## 6. `GovernanceDecision`

Allowed wording:

- `GovernanceDecision` is a contract topic.
- `GovernanceDecision` may describe future proceed, stop, narrow, ask, or escalate outcomes.
- `GovernanceDecision` planning should keep evidence and uncertainty reviewable.

Forbidden wording:

- `GovernanceDecision` is implemented.
- `GovernanceDecision` exists as a decision engine.
- `GovernanceDecision` routes execution.
- `GovernanceDecision` updates runtime governance state.

Review questions:

- Does the wording distinguish review output from execution?
- Does the wording require a risk reason for stop or escalation outcomes?
- Does the wording avoid implying a live router change?

Non-authorization gate:

- No decision engine, router change, reducer, or runtime governance update is authorized.

## 7. `MemoryOverviewPolicy`

Allowed wording:

- `MemoryOverviewPolicy` is a contract topic.
- `MemoryOverviewPolicy` may describe when memory context is relevant, blocked, or advisory.
- `MemoryOverviewPolicy` planning should preserve repository reality and user instruction as higher authority than memory.

Forbidden wording:

- `MemoryOverviewPolicy` is implemented.
- `MemoryOverviewPolicy` calls `codex-memory`.
- `MemoryOverviewPolicy` queries MCP.
- `MemoryOverviewPolicy` activates governed memory behavior.

Review questions:

- Does the wording avoid memory calls?
- Does the wording block secrets, credentials, and raw private runtime data?
- Does the wording keep memory advisory unless explicitly scoped otherwise?

Non-authorization gate:

- No `codex-memory` call, MCP query, storage change, memory schema change, or memory runtime behavior is authorized.

## 8. `SideEffectClass`

Allowed wording:

- `SideEffectClass` is a contract topic.
- `SideEffectClass` may describe side-effect categories for future review.
- `SideEffectClass` planning may distinguish read-only inspection, local docs edits, source edits, remote writes, runtime execution, memory side effects, secret access, production actions, and destructive operations.

Forbidden wording:

- `SideEffectClass` is implemented.
- `SideEffectClass` is enforced by code.
- `SideEffectClass` blocks commands.
- `SideEffectClass` changes approval behavior.

Review questions:

- Does the wording classify actions without claiming enforcement?
- Does the wording preserve hard stop gates?
- Does the wording avoid creating hidden execution authority?

Non-authorization gate:

- No enforcement code, policy package, command interceptor, or approval-gate implementation is authorized.

## 9. `CheckpointEvidence`

Allowed wording:

- `CheckpointEvidence` is a contract topic.
- `CheckpointEvidence` may describe evidence categories for future review or dry-run reports.
- `CheckpointEvidence` planning should separate observed facts from inference.

Forbidden wording:

- `CheckpointEvidence` is implemented.
- `CheckpointEvidence` is serialized by a runtime.
- `CheckpointEvidence` writes files.
- `CheckpointEvidence` collects logs automatically.

Review questions:

- Does the wording avoid storing secrets or private runtime logs?
- Does the wording distinguish validation run from validation not run?
- Does the wording avoid claiming a collector or serializer exists?

Non-authorization gate:

- No serializer, storage path, evidence collector, log reader, or runtime writer is authorized.

## 10. `ValidationVocabulary`

Allowed wording:

- `ValidationVocabulary` is a contract topic.
- `ValidationVocabulary` may define human-reporting labels for validation outcomes.
- `ValidationVocabulary` planning should prevent overclaiming when validation is partial or unavailable.

Forbidden wording:

- `ValidationVocabulary` is implemented.
- `ValidationVocabulary` is wired into CI.
- `ValidationVocabulary` validates builds or tests.
- `ValidationVocabulary` changes release readiness.

Review questions:

- Does the wording state when validation was not run?
- Does the wording avoid claiming CI coverage?
- Does the wording keep labels separate from executable checks?

Non-authorization gate:

- No validator, test, CI workflow, build rule, or release gate is authorized.

## 11. `ProjectProfile`

Allowed wording:

- `ProjectProfile` is a contract topic.
- `ProjectProfile` may describe future repository-level boundaries.
- `ProjectProfile` planning should keep project-specific rules separate from suite-level vocabulary.

Forbidden wording:

- `ProjectProfile` is implemented.
- `ProjectProfile` exists as a schema.
- `ProjectProfile` is loaded by `codex-router`.
- `ProjectProfile` configures a monorepo.

Review questions:

- Does the wording keep the profile docs-only?
- Does the wording avoid creating machine-readable authority?
- Does the wording preserve the separation of Harness, `codex-router`, and `codex-memory`?

Non-authorization gate:

- No profile schema, loader, package, config file, or monorepo/workspace behavior is authorized.

## 12. Cross-topic Review Checklist

Before accepting future contract-planning docs, confirm:

- all contract names are described as topics or proposed vocabulary
- no contract is described as implemented
- no code path is implied
- no package or schema is created or promised
- no checker or adapter is said to exist
- no CI, runtime, memory, or production behavior is said to exist
- no repository is described as swallowing another repository
- next steps remain docs-only unless separate implementation approval exists

## 13. Next Safe Step

The next safe step is staged review of this checklist.

After review, a future docs-only task may create a boundary-to-topic traceability table that maps:

- boundary statements
- contract topics
- forbidden overclaims
- review questions
- non-authorization gates

Any code, package, schema, script, test, CI, checker, adapter, runtime, memory, monorepo, release, or deployment work requires separate explicit approval.

## 14. Overclaim Warnings

Do not say:

- the checklist enforces governance
- the checklist validates contracts
- contract topics are implemented
- a schema exists
- a package exists
- a checker exists
- a Harness adapter exists
- a runtime integration exists
- governed memory behavior is active
- Harness is integrated with `codex-router`
- `codex-router` has adopted `governance-v0.1.0`
- repositories are merged into a suite monorepo

Acceptable wording:

- docs-only checklist
- vocabulary review aid
- overclaim prevention aid
- non-authorization gate
- future docs-only traceability task
