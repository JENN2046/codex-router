# Phase 21 Closeout Audit

> Date: 2026-06-11
> Scope: GitHub issue #2, "Phase 21: DGP runtime hardening and field validation"
> Status: closeout-ready, pending maintainer decision to close the issue

## Summary

Issue #2 tracks Phase 21 runtime hardening after the Phase 15-20 merge.
Repository evidence shows the six requested work areas are implemented,
documented, and covered by tests or deterministic smoke strategy artifacts.

This audit does not close the GitHub issue by itself. It records the local
evidence needed for a maintainer to close issue #2 or add a final issue comment.

## Issue Acceptance Mapping

| Issue area | Closeout status | Evidence |
|---|---|---|
| 21.1 Desktop live adapter governance integration tests | Covered | `tests/desktop-live-adapter-governance.test.ts` covers missing handlers, `ok:false`, thrown handlers, strike escalation, `onGovernanceUpdate`, step-back, no-governance callback suppression, successful execution, and non-`Error` thrown values. |
| 21.2 Governance failure reducer | Covered | `packages/governance-failure-reducer/src/index.ts` provides `applyExecutionFailureToGovernanceState()`. `tests/governance-failure-reducer.test.ts` covers anomaly creation, strike progression, risk/strategy rerouting, and arbitration packet creation. `packages/desktop-live-adapter/src/index.ts` calls the reducer from missing-handler, handler-failure, and thrown-error paths. |
| 21.3 TaskGraph branch ownership v2 | Covered | `packages/task-graph/src/index.ts` includes `branchId`, `originBranchId`, and `mergedFromBranchIds`; `mergeBranch()` resolves source-owned and target-owned graph items. `tests/task-graph.test.ts` covers v2 schema behavior, legacy v1 rejection, source-only copies, `keep_source`, `keep_target`, and provenance. `docs/task-graph-v2-migration-20260428.md` documents migration and ownership semantics. |
| 21.4 Recovery result contract | Covered | `packages/desktop-live-adapter/src/index.ts` exposes optional `DesktopLiveExecutionResult.governance` with state, strategy decision, arbitration packet, recovery actions, recovery requirement, and lockdown. `tests/desktop-live-adapter-governance.test.ts` asserts step-back output includes host-consumable governance data. `docs/desktop-live-recovery-result-contract-20260428.md` documents the contract. |
| 21.5 VCPToolBox field validation addendum | Covered | `docs/dgp-field-validation-vcptoolbox-ai-image-agent.md` captures generic DGP field lessons without copying VCPToolBox business code. |
| 21.6 Host smoke strategy | Covered | `docs/codex-cli-smoke-strategy-20260428.md` separates CI contract smoke, local read-only real host smoke, and local workspace-write real host smoke. `package.json` exposes `smoke:contract`, `smoke:telemetry`, and `smoke:workspace-write:telemetry`. `.github/workflows/ci.yml` runs deterministic canary, contract smoke, and evidence collection jobs. |

## Definition Of Done Check

| Definition of done item | Result |
|---|---|
| Handler failure governance updates have regression coverage | Satisfied by `tests/desktop-live-adapter-governance.test.ts`. |
| Failure handling logic is centralized enough to avoid branch drift | Satisfied by `applyExecutionFailureToGovernanceState()` and live-adapter reducer calls. |
| TaskGraph branch ownership has a clear design or implementation path | Satisfied by strict v2 implementation and migration doc. |
| Recovery / arbitration results are consumable by host layers | Satisfied by optional `DesktopLiveExecutionResult.governance` contract and step-back tests. |
| VCPToolBox field lessons are documented as architecture feedback | Satisfied by the field validation addendum. |
| CI and local smoke responsibilities are clearly separated | Satisfied by smoke strategy doc, package scripts, and CI contract smoke/evidence jobs. |

## Current Validation Baseline

Recent mainline validation after PR #35 and PR #36:

- `npm run typecheck` passed.
- `npm test` passed: 705 tests / 705 pass.
- `npm run build` passed.
- `npm run canary` passed.
- `npm run evidence:collect` passed.
- CI for PR #36 passed: TypeCheck, Build, Test, Canary, Smoke Contract, and Evidence Collection.

## Remaining Notes

- Issue #2 is still open on GitHub even though the repository roadmap marks
  Phase 21.1-21.6 complete.
- Real Codex CLI host smoke remains intentionally local and optional before
  release or host-sensitive changes; it is not a required PR CI gate.
- No Phase 22 feature expansion is implied by this audit.

## Recommended Next Action

Close issue #2, or add a final issue comment linking this audit and then close
the issue. That remote action should be done only with explicit maintainer
approval.
