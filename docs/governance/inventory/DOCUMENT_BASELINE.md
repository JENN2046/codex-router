---
project: codex-router
doc_type: governance-document-baseline
status: active
last_reviewed: 2026-07-03
phase: docs-0-inventory-baseline
---

# Governance Document Baseline

Phase 0 establishes the current documentation baseline for the governance
documentation plan package. It is a factual checkpoint before control-plane
documents, closeout templates, ADR cleanup, workspace-write hardening docs, or
docs automation.

## Baseline Conclusion

The current governance documentation baseline is established. The repository can
start Phase 1 control-plane documentation, but existing historical documents
should remain in place until they are explicitly superseded, indexed, or
migrated with link-risk coverage.

Current operating fact:

- `docs/current/state-sync-record.json` is the machine-authoritative state-sync
  claim.
- `README.md`, `docs/README.md`, and `docs/governance/README.md` are lightweight
  entry surfaces.
- `docs/current/CURRENT_STATE.md` and `.agent_board/*` are display/evidence
  surfaces, not authority.
- `docs/governance/` is mixed: current index plus historical taskbooks,
  closeouts, gates, receipts, and compatibility records.
- `docs/evidence/` is evidence archive indexed by `manifest-latest.json`.

## Phase 0 Task Status

| Task | Status | Evidence |
|---|---|---|
| DOC-000 Establish document inventory | Done | `DOCUMENT_INVENTORY.md` records current surfaces and counts. |
| DOC-001 Classify existing docs | Done | Inventory assigns classifications for current entry docs and all `docs/governance/*.md` files. |
| DOC-002 Mark document status | Done | Inventory marks active, current_display, historical, future, compatibility, and needs_review states. |
| DOC-003 Check README entry | Done | Inventory records current README entry links and delayed Phase 1 README update. |
| DOC-004 Check package scripts | Done | Inventory includes package script to documentation mapping. |
| DOC-005 Build link risk register | Done | `DOCUMENT_LINK_RISK_REGISTER.md` records migration risks and no-move rules. |
| DOC-006 Output baseline conclusion | Done | This baseline records Phase 1 entry criteria and safe next scope. |

## Current Authority And Display Boundary

| Surface | Authority status | Baseline decision |
|---|---|---|
| `docs/current/state-sync-record.json` | Machine authority for state-sync | Keep as authority. |
| `docs/current/CURRENT_STATE.md` | Display and compatibility evidence | Keep generated/display-oriented; do not expand into authority. |
| `.agent_board/*` | Display and handoff evidence | Keep lightweight; do not use as machine authority. |
| `docs/governance/README.md` | Human index | Keep as current entry. |
| `docs/governance/PR_*_LOCAL_CLOSEOUT.md` | Historical evidence | Keep in place; do not treat as current fact. |
| `docs/evidence/*` | Evidence archive | Keep in place; do not rename before evidence policy. |

## Safe Phase 1 Scope

Phase 1 may add these new documents:

- `docs/governance/GOVERNANCE_CONTROL_PLANE.md`
- `docs/governance/RELEASE_GATE_MATRIX.md`
- `docs/governance/EVIDENCE_POLICY.md`
- `docs/governance/GLOSSARY.md`

Phase 1 may update:

- `docs/governance/README.md` to link those new documents;
- `README.md` only after the new control-plane docs exist;
- this inventory if a classification changes.

Phase 1 should not:

- move or rename historical closeouts;
- move or rename evidence artifacts;
- alter audit scripts;
- change GitHub workflow behavior;
- change runtime governance behavior;
- add docs automation before the target documents stabilize.

## Open Baseline Gaps

| Gap | Impact | Recommended phase |
|---|---|---|
| No single control-plane document yet | Operators still need README plus governance index plus current state. | Phase 1 |
| Release gate information is spread across README, scripts, and historical docs | PR/release readiness still requires multiple surfaces. | Phase 1 |
| Evidence policy exists only as scattered practice and audit behavior | Future evidence migrations could expose raw material or create drift. | Phase 1 |
| Several governance files remain `needs_review` | They must not be treated as current authority until classified. | Phase 1/2 |
| Closeout template and runbook template are not standardized | Historical records remain inconsistent. | Phase 2 |
| Docs automation is not present | Consistency is still review-based. | Phase 5 |

## Validation Baseline

Phase 0 is docs-only. Recommended validation for this PR:

```bash
git diff --check
npm run validate:daily
npm run governance -- list
node --import tsx scripts/sync-state-sync-display.ts --check
```

For a non-`main` PR branch, validate state-sync through GitHub CI's
`pull_request` State Sync Audit job, or with an explicit local pull-request
context simulation. Do not use the bare local state-sync command as the PR
branch check, because policy v2 only accepts bare `local` audits on `main`.

```bash
tmpdir=$(mktemp -d)
event="$tmpdir/event.json"
printf '{"pull_request":{"head":{"sha":"%s"}}}\n' "$(git rev-parse HEAD)" > "$event"
GITHUB_ACTIONS=true \
GITHUB_EVENT_NAME=pull_request \
GITHUB_EVENT_PATH="$event" \
GITHUB_BASE_REF=main \
GITHUB_HEAD_REF="$(git branch --show-current)" \
GITHUB_SHA="$(git rev-parse origin/main)" \
GITHUB_REPOSITORY=JENN2046/codex-router \
node --import tsx scripts/run-state-sync-audit.ts --json
```

The bare local state-sync command is still valid after the PR lands on local
`main`:

```bash
node --import tsx scripts/run-state-sync-audit.ts --json
```

Full PR validation can still use typecheck, tests, and build from:

```bash
npm run validate:pr
```

## Final Phase 0 Statement

The current governance document baseline is established. Phase 1 can start by
creating current control-plane documents. Historical documents remain preserved
in place and are not current authority unless a current index or audit script
explicitly names them.
