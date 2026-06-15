# Validation Log

Date: 2026-06-15
Branch: `docs/governance-evidence-matrix`

## Passed

- `npx tsx --test tests\approval-consumption-dispatch-matrix-audit.test.ts`
  - Result: `4 / 4`
- Targeted suite:
  - `tests\approval-permit.test.ts`
  - `tests\execution-eligibility.test.ts`
  - `tests\agent-os-mcp-local-runtime.test.ts`
  - `tests\host-dispatcher.test.ts`
  - `tests\redaction.test.ts`
  - `tests\jsonl-event-log.test.ts`
  - `tests\artifact-store.test.ts`
  - `tests\tool-invocation-planner.test.ts`
  - `tests\workspace-write-guard.test.ts`
  - `tests\approval-consumption-dispatch-matrix-audit.test.ts`
  - Result: `124 / 124`
- `npm run typecheck`
- `npm test`
  - Result: `1003 / 1003`
- `npm run build`
- `git diff --cached --check`

## Not Run

- Fresh real Codex CLI read-only smoke.
- Workspace-write real CLI smoke.
