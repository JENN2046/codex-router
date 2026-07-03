---
project: codex-router
doc_type: governance-link-risk-register
status: active
last_reviewed: 2026-07-03
phase: docs-0-inventory-baseline
---

# Governance Document Link Risk Register

This register records link and reference risks found during Phase 0. It exists
to prevent a governance cleanup from breaking historical evidence, audit
scripts, README entry points, or state-sync display surfaces.

No files are moved or renamed by Phase 0.

## Risk Summary

| ID | Risk | Severity | Current decision |
|---|---|---|---|
| LNK-001 | Moving `docs/governance/PR_*` closeout or receipt files can break audit scripts and historical PR links. | High | Do not move closeouts in Phase 0 or Phase 1. Mark status first. |
| LNK-002 | Rewriting README before control-plane docs exist would create empty or unstable entry links. | Medium | Keep README unchanged until Phase 1 creates target docs. |
| LNK-003 | Renaming `docs/evidence/*` can break `manifest-latest.json`, release notes, and closeout references. | High | Do not rename evidence files before an evidence policy and manifest migration plan exist. |
| LNK-004 | Changing `docs/current/CURRENT_STATE.md` can break legacy compatibility audits that still read current display markers. | Medium | Treat current display edits as compatibility-sensitive. Keep required markers unless audit code changes in the same PR. |
| LNK-005 | Changing `.agent_board/*` generated blocks can cause display drift or stale operator notes. | Low | Continue using `scripts/sync-state-sync-display.ts --check` for display-only PRs. |
| LNK-006 | Removing legacy governance runner registrations can break archived one-off checks. | Medium | Keep archived checks registered; keep default list focused. |
| LNK-007 | Moving `docs/patches/` or `docs/scratch/` artifacts can break field-evidence references. | Medium | Leave artifacts in place until Phase 1/2 decides whether they remain evidence or archive. |
| LNK-008 | Non-ASCII documentation path `docs/解读/` may be mishandled by external tools or link checkers. | Low | Do not move in Phase 0. Include in future docs automation path tests if needed. |

## Known Current Links

| Source | Target | Risk |
|---|---|---|
| `README.md` | `docs/README.md` | Low; target exists. |
| `README.md` | `docs/current/CURRENT_STATE.md` | Low; target exists. |
| `README.md` | `docs/validation-tiers.md` | Low; target exists. |
| `README.md` | `docs/governance/README.md` | Low; target exists. |
| `README.md` | `docs/governance/STATE_SYNC_STRUCTURED_RECORD_PLAN.md#legacy-v1-main-reanchor-fallback` | Medium; legacy compatibility section must remain while README points at it. |
| `docs/governance/README.md` | `../current/CURRENT_STATE.md` | Low; target exists. |
| `docs/governance/README.md` | `../validation-tiers.md` | Low; target exists. |
| `docs/governance/README.md` | current governance docs in `docs/governance/` | Low; targets exist. |
| `docs/current/CURRENT_STATE.md` | `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md` | Medium; controlled-provider boundary audit expects this taskbook and marker. |

## Migration Rules Before Phase 1

1. Do not move closeouts, taskbooks, receipts, gates, evidence, patches, or
   scratch artifacts.
2. Do not rewrite README to point at future control-plane docs until those docs
   exist.
3. Do not remove legacy v1 state-sync fallback prose while README still links to
   it.
4. Do not remove current-state boundary markers that are read by audit scripts.
5. Do not turn historical closeouts into current authority by changing labels
   only.

## Phase 1 Link Work

When Phase 1 creates the control-plane documents, update this register with:

- new README links;
- links from `docs/governance/README.md` to the control plane, release matrix,
  evidence policy, and glossary;
- any deliberate supersession links from historical closeouts to current
  control documents.

