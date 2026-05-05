# Harness Adoption Documentation

## 1. Status

This directory contains documentation-only Harness adoption planning and readiness material.

- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- No Harness adapter exists.
- No runtime integration exists.
- No implementation is authorized by these documents.

## 2. Purpose

This directory records the staged path for evaluating whether `Codex_Autonomous_Work_Harness` governance concepts can align with `codex-router` DGP/runtime governance concepts. It is a documentation and governance boundary index before any implementation planning or execution work.

## 3. Document Map

| Document | Role | Status | Implementation authority |
|---|---|---|---|
| `governance-v0.1.0-adoption-dry-run.md` | Dry-run baseline record of conceptual alignment evidence and limits. | Present | None |
| `harness-to-dgp-mapping.md` | Conceptual mapping between Harness autonomy/risk/hard gates and existing `codex-router` surfaces. | Present | Documentation only |
| `harness-adapter-contract-proposal.md` | Proposed future contract boundary and responsibilities for a potential adapter. | Present | Documentation only |
| `harness-adapter-implementation-readiness.md` | Readiness gate before any adapter implementation is proposed. | Present | Does not authorize code |

## 4. Current Governance Seal

The current governance package is complete at documentation level:

- dry-run record exists
- mapping spec exists
- adapter contract proposal exists
- readiness checklist exists

Implementation remains blocked until readiness gaps are resolved. Any future first implementation, if separately approved, must be:

- read-only
- report-only
- local-repo-only

## 5. Known Missing Work

- no `HarnessGoal` implementation contract
- no runtime mapping types
- no hard gate adapter
- no checkpoint serializer
- no validation vocabulary normalizer
- no overclaim detection rules
- no dry-run fixture plan
- no unit test plan
- no rollback/removal path
- no implementation approval

## 6. Rules for Future Work

- Future work under this adoption direction must start docs-only unless a separate explicit scope approval is given.
- Any code proposal requires a separate scoped goal.
- Any adapter must be dry-run-first.
- No `push/merge/tag/release/deploy` without explicit human approval.
- No downstream repo adoption without a separate target profile and staged review.
- This index task does not create source changes, package files, tests, scripts, or CI changes.

## 7. Recommended Next Step

Create a separate docs-only implementation plan for a read-only/report-only Harness adoption checker:

- Suggested future file: `docs/harness-adoption/harness-adoption-checker-implementation-plan.md`

Do not create that file in this task.
