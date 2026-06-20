# Documentation Map

This repository keeps current operating facts separate from historical evidence.
Start with the current docs below; use dated and PR-specific files only when you
need the audit trail behind a decision.

## Current Entry Points

- [current state](current/CURRENT_STATE.md): branch, validation baseline,
  execution boundary, and next safe action.
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

- Put current operational facts in `docs/current/CURRENT_STATE.md`.
- Put validation command policy in `docs/validation-tiers.md`.
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
