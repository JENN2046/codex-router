# Harness Adapter Contract Proposal

## 1. Status

This is a documentation-only adapter contract proposal.

- No adapter is implemented.
- No runtime integration exists.
- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- This document does not authorize implementation.
- This document does not create packages, scripts, TypeScript files, automation helpers, CI jobs, release workflows, or downstream repository changes.

## 2. Purpose

This document defines the proposed future contract boundary for translating Harness governance concepts into `codex-router` DGP / runtime governance inputs.

The proposal is meant to make the next design review concrete without creating runtime behavior. It names conceptual inputs, conceptual outputs, allowed future responsibilities, forbidden future responsibilities, and validation requirements that must exist before any implementation work begins.

## 3. Boundary Principle

- Harness remains an external governance baseline.
- `codex-router` remains the runtime / policy SDK alignment target.
- The adapter must be explicit, dry-run-first, testable, reversible, and auditable.
- The adapter must not perform execution by itself.
- The adapter must not bypass approval gates or hard gates.
- The adapter must preserve `codex-router` authority order, repository rules, DGP principles, and validation discipline.
- The adapter boundary must remain separate from `desktop-live-adapter`, host bridges, primitive handlers, and Codex CLI execution surfaces until a reviewed implementation plan exists.

## 4. Proposed Input Contracts

These are conceptual contract names only. They are not TypeScript types, schemas, package exports, runtime adapters, or implementation commitments.

| Contract | Purpose | Required conceptual fields | Maps to | Status |
|---|---|---|---|---|
| `HarnessGoal` | Captures the user-facing Harness task intent before translation. | goal summary, requested action, scope, out-of-scope items, success criteria, target repository, target files or modules, unknowns. | `TaskEnvelope.intent`, `TaskEnvelope.target`, `TaskEnvelope.constraints`. | PROPOSED |
| `HarnessAutonomyLevel` | Captures the requested autonomy posture such as A0 through A4. | level, allowed action family, write allowance, human approval expectation, escalation rule. | `TaskClass`, `ToolAccessLevel`, `ExecutionProfileName`, strategy action family. | NEEDS_REVIEW |
| `HarnessRiskLevel` | Captures the Harness risk posture such as R0 through R5. | level, risk rationale, reversibility, side-effect potential, protected boundary indicators. | `RiskLevel`, `DgpRiskLevel`, entropy-risk inputs, approval reasons. | NEEDS_REVIEW |
| `HarnessHardGate` | Captures operations that must stop for human approval. | gate kind, trigger condition, target object, required approver, rollback or recovery note. | `approval-gate`, protected keywords, protected branches, `protected_remote`, hard stop rules. | NEEDS_REVIEW |
| `HarnessValidationExpectation` | Captures what validation is required before a task can be called complete. | required checks, performed checks, skipped checks, evidence references, validation result vocabulary. | validation tables, `runtime-control`, `validation-arbiter`, project validation discipline. | NEEDS_REVIEW |
| `HarnessCheckpointExpectation` | Captures checkpoint and report expectations for dry-run or staged execution. | checkpoint stage, status fields, evidence capture, audit expectation, non-overclaiming language. | `CheckpointRef`, `checkpoint-ledger-v2`, `audit-memory`, evidence docs. | NEEDS_REVIEW |
| `HarnessAdoptionContext` | Captures the adoption boundary for a specific repository and task. | repository root, branch, worktree state, adoption status, integration status, disallowed scope, unknowns. | repo reality check, dry-run report, staged review checkpoint. | PROPOSED |

Unknowns:

- exact Harness source schema is not inspected by these documents;
- whether Harness levels A0-A4 and R0-R5 have stable upstream definitions is unknown from this repository alone;
- required serialization format is unknown;
- whether a future adapter should live in this repository, Harness, or a separate boundary package is unknown;
- runtime ownership between Harness, `codex-router`, and host execution remains unresolved.

## 5. Proposed Output Contracts

These outputs are conceptual only. They do not exist as implemented exports.

| Output contract | Purpose | Consumed by codex-router surface | Status | Notes |
|---|---|---|---|---|
| `DgpTaskEnvelopeInput` | A normalized task input candidate for DGP routing. | `parseTaskEnvelope()`, intent gate, routing engine. | PROPOSED | Must preserve source scope and out-of-scope constraints. |
| `DgpRiskInput` | A normalized risk input candidate for DGP scoring and routing. | routing decision risk classification, `entropy-risk`, governance state. | NEEDS_REVIEW | Must avoid false precision when mapping R0-R5 to low/medium/high/critical. |
| `DgpApprovalConstraint` | A normalized approval and hard gate constraint candidate. | `approval-gate`, `preflight`, protected rules in policy config. | NEEDS_REVIEW | Must preserve human approval for protected boundaries. |
| `DgpCheckpointExpectation` | A normalized checkpoint/audit expectation candidate. | `CheckpointRef`, `checkpoint-ledger-v2`, `audit-memory`, evidence docs. | NEEDS_REVIEW | Must not imply runtime checkpoint serialization exists. |
| `DgpValidationVocabulary` | A normalized validation result vocabulary candidate. | staged review reports, validation tables, runtime-control, validation arbiter. | NEEDS_REVIEW | Must distinguish `PASS`, `FAIL`, `NOT_RUN`, `NOT_APPLICABLE`, and `BLOCKED`. |
| `DgpAdoptionDryRunReport` | A report-only output for adoption analysis. | docs-only dry-run records and future review artifacts. | PROPOSED | Should be the first implementation target if code is ever approved. |

## 6. Adapter Responsibilities

The future adapter may:

- translate Harness autonomy/risk vocabulary into `codex-router` policy inputs;
- preserve hard gate boundaries;
- generate dry-run reports;
- normalize validation vocabulary;
- attach checkpoint/audit expectations;
- report missing mappings;
- identify conflicts between Harness terms and `codex-router` DGP concepts;
- recommend stop, continue, or escalate without performing the action.

The future adapter must not:

- execute tasks;
- stage files;
- commit;
- push;
- merge;
- tag;
- release;
- deploy;
- read secrets;
- write downstream repositories;
- claim adoption without validation;
- mutate runtime state without an explicit reviewed contract;
- bypass `approval-gate`, preflight, project hard stop gates, or human approval boundaries.

## 7. Dry-Run First Requirement

Any future implementation must start with read-only / report-only behavior.

Required first behavior:

- consume a Harness-like goal description;
- produce a mapping report;
- identify missing or conflicting mappings;
- recommend stop, continue, or escalate;
- perform no file changes by default;
- avoid host primitive execution;
- avoid downstream repository access;
- avoid secret inspection;
- avoid remote writes.

The first implementation, if separately approved, should prove that the adapter can explain a task without changing the repository. Runtime execution must remain out of scope until that report-only behavior is reviewed and validated.

## 8. Validation Requirements Before Implementation

Before code exists, the following validation work is required:

- contract review;
- vocabulary review;
- hard gate review;
- overclaim detection review;
- docs-only staged review;
- unit test plan;
- dry-run fixture plan;
- no-runtime-side-effect proof;
- ownership decision for where the adapter would live;
- explicit rollback/removal path for any future implementation.

No implementation should begin until these reviews are complete and a separate scoped goal explicitly approves code changes.

## 9. Implementation Non-Authorization

This document does not approve creating:

- `packages/harness-adapter`;
- scripts;
- runtime adapter code;
- automation helpers;
- CI jobs;
- release workflows;
- TypeScript contract files;
- package manifests;
- downstream repository changes.

Those require a separate scoped goal and explicit approval.

## 10. Recommended Next Step

Create a docs-only implementation readiness checklist:

```text
docs/harness-adoption/harness-adapter-implementation-readiness.md
```

Do not create that file in this task.
