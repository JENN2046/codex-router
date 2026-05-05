# Harness Adapter Implementation Readiness

## 1. Status

This is a documentation-only readiness checklist.

- It does not authorize implementation.
- No Harness adapter exists.
- No runtime integration exists.
- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- This document does not create packages, scripts, TypeScript files, package manifests, runtime adapters, automation helpers, CI jobs, releases, or downstream repository changes.

## 2. Purpose

This checklist defines the minimum conditions required before any future Harness adapter implementation can be proposed for `codex-router`.

Its purpose is to keep the adoption path reviewable and reversible. The checklist is intentionally conservative: a future adapter must first prove that the contract, vocabulary, hard gates, validation language, dry-run behavior, and rollback path are understood before any code is proposed.

## 3. Required Pre-Implementation Conditions

| Condition | Required evidence | Status | Notes |
|---|---|---|---|
| HarnessGoal contract reviewed | A reviewed docs-only contract description with fields, unknowns, and mapping to `TaskEnvelope`. | PARTIAL | Proposed in `harness-adapter-contract-proposal.md`, but not reviewed as an implementation-ready contract. |
| autonomy level mapping reviewed | A reviewed A0-A4 mapping with allowed action boundaries and explicit non-equivalence notes. | PARTIAL | Conceptual mapping exists; no runtime mapping type exists. |
| risk level mapping reviewed | A reviewed R0-R5 mapping with low/medium/high/critical non-equivalence called out. | PARTIAL | Conceptual mapping exists; false-precision risk remains. |
| hard gate mapping reviewed | A reviewed table for push, merge, tag, release, deploy, secrets, production config, destructive commands, downstream writes, and runtime side effects. | PARTIAL | Conceptual hard gate mapping exists; no adapter policy exists. |
| checkpoint expectation reviewed | A reviewed checkpoint report expectation mapped to checkpoint, audit, evidence, and staged review. | PARTIAL | Conceptual checkpoint mapping exists; no serializer exists. |
| validation vocabulary reviewed | A reviewed vocabulary for `PASS`, `FAIL`, `NOT_RUN`, `NOT_APPLICABLE`, and `BLOCKED`. | PARTIAL | Vocabulary is used in docs; no adapter normalization contract exists. |
| overclaim detection rules reviewed | A reviewed rule set that blocks claims of integration, adoption, adapter implementation, approval, downstream adoption, or release actions without evidence. | PARTIAL | Existing docs avoid overclaims; no detection rule set exists. |
| dry-run/report-only boundary reviewed | A reviewed boundary proving the first adapter behavior is read-only and report-only. | PARTIAL | Existing docs require dry-run first; no fixture-backed proof exists. |
| no-runtime-side-effect proof defined | A written proof plan showing no file writes, host primitive execution, secret reads, downstream writes, or remote actions happen by default. | MISSING | Required before any implementation proposal. |
| unit test plan drafted | A test plan for mapping, gates, missing mappings, overclaim detection, and no-side-effect behavior. | MISSING | No adapter unit test plan exists. |
| dry-run fixture plan drafted | A fixture plan for representative Harness-like goals and expected DGP dry-run reports. | MISSING | Required before code can be evaluated. |
| rollback/removal path drafted | A documented path for removing the adapter without affecting existing `codex-router` runtime surfaces. | MISSING | Required before any implementation proposal. |

## 4. Minimum Allowed First Implementation Shape

If separately approved later, the first possible implementation must be:

- read-only;
- report-only;
- local-repo-only;
- deterministic;
- auditable;
- dry-run-first;
- no file writes by default;
- no staging;
- no commits;
- no push/merge/tag/release/deploy;
- no secret reading;
- no downstream repository writes;
- no host primitive execution.

Any implementation shape beyond this boundary requires a separate scoped goal and explicit approval before code is written.

## 5. Required Future Test Plan

The following tests would be required before implementation can be accepted:

- A0/R0 read-only mapping;
- A1/R1 docs-only mapping;
- R4 hard gate blocks;
- R5 forbidden action blocks;
- overclaim detection;
- missing mapping report;
- no file write dry-run proof;
- no secret path traversal;
- validation vocabulary normalization.

The test plan should also define fixture inputs, expected report outputs, and proof that the adapter does not call host primitives or write downstream repositories.

## 6. Stop Conditions

The following conditions must block implementation:

- unresolved contract names;
- unclear ownership;
- hard gate ambiguity;
- runtime side-effect ambiguity;
- secret boundary uncertainty;
- downstream repository ambiguity;
- missing dry-run fixtures;
- missing unit test plan;
- pressure to implement before docs review.

If any stop condition is present, the safe next action is documentation review, not code.

## 7. Non-Goals

- no adapter implementation;
- no package creation;
- no scripts;
- no runtime integration;
- no CI changes;
- no automation helper;
- no downstream adoption;
- no release/push/merge/tag/deploy.

## 8. Recommended Next Step

After this checklist is reviewed and merged, create a separate design issue or docs-only implementation plan for a read-only/report-only Harness adoption checker.

Do not create that issue or implementation plan in this task.
