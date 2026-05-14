# Codex Governance Suite Contracts Plan

## 1. Status

This document is a Phase 2 docs-only contract planning note for the proposed `Codex Governance Suite`.

It is not:

- an implementation plan for source code
- a package or monorepo plan
- a JSON Schema or TypeScript contract
- a Harness adapter
- a checker implementation
- a runtime integration
- a memory integration
- an authorization to call `codex-memory`

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

The purpose of this document is to name the contract topics that would need staged review before any future implementation is proposed.

This plan keeps contract work at the vocabulary, responsibility, invariant, and validation-expectation level. It intentionally avoids code, schema files, packages, tests, scripts, CI changes, runtime execution, memory calls, or repository coupling.

## 3. Scope

In scope:

- docs-only contract topic planning
- repository-role boundaries
- dependency direction boundaries
- non-authorization statements
- planning-level invariants and review questions
- read-only, report-only, local-repo-only future gate language

Out of scope:

- source code changes
- contract package creation
- JSON Schema creation
- TypeScript type creation
- checker implementation
- Harness adapter implementation
- runtime execution
- memory MCP calls
- CI workflow changes
- package dependency changes
- monorepo or workspace configuration

## 4. Contract Planning Principles

Future contract work must preserve these principles:

- Contracts are reviewed as docs before implementation.
- Contract names do not imply implemented APIs.
- Cross-repository boundaries must be explicit.
- Any future first implementation must be read-only, report-only, and local-repo-only.
- Memory behavior must be mediated through an explicit future adapter or MCP contract.
- `codex-router` must not import `codex-memory` internals.
- `codex-router` must not read Harness task rails or `.agent_board`.
- Harness must not directly touch `codex-memory` runtime or storage.

## 5. Proposed Contract Topics

The following topics are candidates for future contract planning. They are not implemented contracts.

| Topic | Planning role | Non-authorization |
|---|---|---|
| `HarnessGoal` | Describes how a Harness-level objective might be represented before policy mapping. | Does not create a runtime type or parser. |
| `GovernanceDecision` | Describes how a governance decision might be summarized for routing, approval, or stop conditions. | Does not create a decision engine. |
| `MemoryOverviewPolicy` | Describes when memory context may be summarized, ignored, or blocked in a future governed flow. | Does not call or integrate `codex-memory`. |
| `SideEffectClass` | Describes how local, remote, runtime, memory, secret, or production side effects may be classified. | Does not implement enforcement. |
| `CheckpointEvidence` | Describes what evidence a docs-only or future dry-run gate should record. | Does not create storage or checkpoint serialization code. |
| `ValidationVocabulary` | Describes shared words for validation status and gaps. | Does not implement validators or CI. |
| `ProjectProfile` | Describes how repository-level scope and boundaries could be documented. | Does not create profile files, schemas, or loader behavior. |

## 6. `HarnessGoal`

Planning role:

- name the Harness-level objective in human-reviewable language
- separate user intent from implementation authority
- preserve repository and risk boundaries before any policy mapping

Potential future invariants:

- a goal must not silently authorize remote writes
- a goal must not authorize runtime, memory, or production side effects unless explicitly scoped
- a goal should preserve non-goals and hard stop gates

Review questions before implementation:

- What fields are truly needed for dry-run planning?
- Which fields are human-authored versus inferred?
- How are non-goals preserved without becoming executable policy?

Current status: docs-only topic. No `HarnessGoal` implementation contract exists.

## 7. `GovernanceDecision`

Planning role:

- describe the output of a governance review or routing decision
- distinguish proceed, stop, narrow, ask, or escalate outcomes
- keep decision evidence reviewable

Potential future invariants:

- every stop decision should name a hard gate or risk reason
- every proceed decision should state scope and validation expectations
- a decision must not imply execution by itself

Review questions before implementation:

- Which decision labels map cleanly to existing `codex-router` concepts?
- What evidence should be mandatory for high-risk decisions?
- How should unknown or stale context be represented?

Current status: docs-only topic. No decision engine or runtime router change is authorized.

## 8. `MemoryOverviewPolicy`

Planning role:

- describe when memory context may be relevant to a governed workflow
- define when memory context must be ignored, blocked, or treated as advisory
- preserve the boundary between governance planning and memory runtime behavior

Potential future invariants:

- memory must not outrank repository reality or explicit user instruction
- memory access must be explicit and separately authorized
- memory summaries must not include secrets or raw private runtime data
- any future memory call must pass through an approved adapter or MCP contract

Review questions before implementation:

- What memory categories are safe to summarize?
- What conditions require memory access to be blocked?
- What evidence proves a memory result was advisory rather than authoritative?

Current status: docs-only topic. No `codex-memory` call, MCP query, storage change, or memory behavior is authorized.

## 9. `SideEffectClass`

Planning role:

- classify potential actions by side-effect type before execution
- distinguish local docs edits from remote writes, runtime calls, memory calls, secrets, production, and destructive actions
- provide shared vocabulary for hard stop gates

Potential future classes:

- read-only inspection
- local docs write
- local source write
- dependency change
- remote write
- runtime execution
- memory side effect
- secret or credential access
- production or release action
- destructive operation

Review questions before implementation:

- Which classes are already represented in `codex-router` policy surfaces?
- Which classes require explicit human approval?
- How should mixed-scope actions be classified?

Current status: docs-only topic. No enforcement code or policy package is authorized.

## 10. `CheckpointEvidence`

Planning role:

- describe what should be recorded at a review, dry-run, or closeout point
- separate observed command output from inference
- make validation gaps visible

Potential future evidence categories:

- repository state
- branch and worktree state
- changed files
- validation commands run
- validation not run
- hard gates encountered
- non-authorization statements
- next safe action

Review questions before implementation:

- Which evidence belongs in local docs versus PR text?
- What evidence is unsafe to store because it may contain secrets?
- How should stale handoff or memory-derived context be marked?

Current status: docs-only topic. No checkpoint serializer, storage path, or evidence collector is authorized.

## 11. `ValidationVocabulary`

Planning role:

- define shared words for validation status and uncertainty
- prevent overclaiming when validation is partial or unavailable
- align future docs, PRs, and dry-run reports

Potential future terms:

- `COMPLETED_VALIDATED`
- `COMPLETED_UNVALIDATED`
- `READY_FOR_REVIEW`
- `BLOCKED_BY_HARD_GATE`
- `BLOCKED_BY_SCOPE_DRIFT`
- `BLOCKED_BY_OVERCLAIM`
- `BLOCKED_BY_UNEXPECTED_DIFF`

Review questions before implementation:

- Which terms should remain human-reporting labels only?
- Which terms map to existing project scripts or checks?
- How should skipped validation be stated?

Current status: docs-only topic. No validator, test, or CI workflow is authorized.

## 12. `ProjectProfile`

Planning role:

- describe repository-level governance boundaries in a portable way
- capture allowed docs-only areas, forbidden runtime areas, and validation expectations
- keep project-specific rules separate from suite-level vocabulary

Potential future profile topics:

- repository identity
- documentation scope
- runtime boundaries
- memory boundaries
- remote-write gates
- validation commands
- non-goals

Review questions before implementation:

- Should a profile stay in docs before any machine-readable format exists?
- What is the minimum useful profile for a local dry-run checker?
- How can profiles avoid becoming hidden execution authority?

Current status: docs-only topic. No profile schema, file format, loader, or package is authorized.

## 13. Dependency Direction

Allowed planning direction:

```text
Harness concepts
-> codex-router policy and execution-governance contract planning
-> explicit future adapter or MCP contract planning
-> codex-memory runtime boundary
```

Forbidden directions:

- `codex-memory` depending on Harness
- Harness directly calling or mutating `codex-memory`
- `codex-router` importing `codex-memory` internals
- `codex-router` reading `.agent_board`
- any repository swallowing another repository
- treating this plan as monorepo authorization

## 14. Future First Implementation Gate

If a future implementation is separately approved, the first implementation gate must be:

- read-only
- report-only
- local-repo-only
- dry-run-first
- removable without runtime impact

That future gate is not approved by this document.

## 15. Next Safe Step

The next safe step is staged review of this contract plan.

After review, the next docs-only task may be one of:

- write a contract vocabulary checklist
- write a dry-run checker review checklist without implementation
- write a boundary-to-topic traceability table

Any code, schema, package, checker, adapter, CI, runtime, or memory work requires a separate explicit scope approval.

## 16. Overclaim Warnings

Do not say:

- `Codex Governance Suite` contracts are implemented
- `HarnessGoal` exists as a runtime type
- `GovernanceDecision` exists as a decision engine
- `MemoryOverviewPolicy` calls `codex-memory`
- `SideEffectClass` is enforced by code
- `CheckpointEvidence` is serialized by a runtime
- `ValidationVocabulary` is wired into CI
- `ProjectProfile` exists as a schema or loader
- Harness is integrated with `codex-router`
- `codex-router` has adopted `governance-v0.1.0`
- a Harness adapter exists
- a runtime integration exists
- governed memory behavior is active

Acceptable wording:

- contract topic
- docs-only planning
- future review question
- proposed vocabulary
- non-authorization boundary
- separately approved future implementation
