# Validation Log

Date: 2026-06-15
Branch: `main` after merge/push, then `docs/post-push-anchor-cleanup`

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
- `npm run audit:approval-consumption-dispatch-matrix`
  - Result: passed on clean `main` at `24c3508`
- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`
  - Result: passed
  - Evidence: `docs/evidence/codex-cli-real-readonly-smoke.json`
  - Boundary: read-only sandbox, approval policy `never`, no workspace-write
- Targeted real read-only smoke tests
  - Command: `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts tests\real-readonly-smoke-authorization-acceptance.test.ts tests\formal-real-readonly-smoke-execution-authorization-acceptance.test.ts tests\formal-real-readonly-smoke-receipt-local-audit.test.ts tests\readonly-real-smoke-chain-index-audit.test.ts tests\readonly-real-smoke-chain-local-candidate-consistency.test.ts tests\readonly-real-smoke-chain-local-closeout-audit.test.ts`
  - Result: `29 / 29`

## Not Run

- Workspace-write real CLI smoke.

## Main-only Audits To Rerun After Local Fast-forward

- `npm run audit:formal-real-readonly-smoke-execution-local`
- `npm run audit:formal-real-readonly-smoke-receipt-local`
- `npm run audit:readonly-real-smoke-chain-index`
- `npm run audit:readonly-real-smoke-chain-candidate`
- `npm run audit:readonly-real-smoke-chain-local-closeout`

These audits saw the fresh receipt as passed on the evidence branch, but blocked
on their `branchMain` gate until the evidence commit is on clean `main`.
