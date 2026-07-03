# Documentation Map

This repository keeps current operating facts separate from historical evidence.
Start with the current docs below; use dated and PR-specific files only when you
need the audit trail behind a decision.

## Current Entry Points

- [current state](current/CURRENT_STATE.md): branch, validation baseline,
  execution boundary, and next safe action.
- [governance control plane](governance/GOVERNANCE_CONTROL_PLANE.md): current
  capability status and authority model.
- [release gate matrix](governance/RELEASE_GATE_MATRIX.md): PR, main, and
  release gate policy.
- [evidence policy](governance/EVIDENCE_POLICY.md): what evidence may be
  stored and what must stay out of docs and PRs.
- [validation tiers](validation-tiers.md): daily, PR, release, and explicit
  local smoke boundaries.
- [governance docs](governance/README.md): compact map for audit, acceptance,
  and controlled-execution evidence.
- [Codex CLI host](codex-cli-host.md): guarded `codex exec --json` planning,
  JSONL inspection, and smoke boundaries.
- [Desktop live host](codex-desktop-live-host.md): composed Desktop runtime,
  memory, and host-client wiring.
- [Agent OS roadmap](agent-os-transformation/current-roadmap-20260610.md):
  current transformation context and next execution-foundation work.

## Navigation Rules

- Put machine state facts in `docs/current/state-sync-record.json`.
- Put operator state display in `docs/current/CURRENT_STATE.md`.
- Put current governance capability facts in
  `docs/governance/GOVERNANCE_CONTROL_PLANE.md`.
- Put validation command policy in `docs/governance/RELEASE_GATE_MATRIX.md` and
  `docs/validation-tiers.md`.
- Put governance evidence pointers in `docs/governance/README.md`.
- Keep historical closeouts and packets in place; do not make them current
  entry points unless the boundary is still active.
- Avoid adding a new top-level governance document when an existing current
  surface can be updated.

## Historical Areas

- `docs/governance/PR_*`: PR-local taskbooks, packets, closeouts, and receipts.
- `docs/evidence/`: sanitized local evidence artifacts.
- `docs/patches/`: external patch artifacts and host integration notes.
- `docs/harness-adoption/`: adoption planning and dry-run records.
- `docs/strategy/`: strategy notes and field feedback.
