# Checkpoint

## Current Stage

State-surface cleanup is in progress on branch
`fix/codex-cli-policy-bypass-flags` after local commit `b2f0c1d`.

The current operational state should now be read from:

- `docs/current/CURRENT_STATE.md`

## Completed In This Slice

- Created a compact current-state document with branch, head, upstream,
  validation baseline, execution boundary, blocked capabilities, and next safe
  action.
- Added a local read-only state-sync audit script.
- Added regression tests for stale current-state and stale `.agent_board`
  detection.
- Wired `npm run audit:state-sync`.
- Replaced stale `.agent_board` references to old mainline state with the
  current branch and `e574f95` baseline.
- Added a Codex CLI production argv allowlist validator that rejects forged
  unknown flags and positional argv before spawn.
- Added Codex CLI host regression coverage for allowlist enforcement.
- Added official JSONL fixture coverage for known Codex event families and
  read-only write evidence in official item shapes.
- Added `turn.failed` and web search item recognition to strict JSONL known
  event handling.
- Extracted pure state-sync audit review and formatting logic into
  `packages/state-sync-audit/src/index.ts`.
- Kept `scripts/run-state-sync-audit.ts` focused on Git/file collection and CLI
  output.
- Updated state-sync tests to import the reusable audit module.
- Fixed CI shallow checkout failures by allowing selected read-only audit
  collectors to fail closed when `origin/main` divergence is unknown.
- Fixed PR review feedback by making `turn.failed` JSONL events blocking even
  with exit code `0`.
- Tightened state-sync audit to require recorded commit hashes to match the
  real head, or the parent head when `Stale after commit: true`.

## Validation

Run for this slice:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `5 / 5`
- `npm run audit:state-sync`
  - Result: passed
- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `101 / 101`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1082 / 1082`
- `npm run build`
  - Result: passed
- `npm run audit:state-sync`
  - Result: passed after state refresh
- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `101 / 101`
- `npx tsx --test tests\readonly-formal-integration-readiness-matrix-audit.test.ts tests\readonly-productization-acceptance.test.ts tests\source-release-package-boundary-audit.test.ts`
  - Result: passed, `16 / 16`
- `npx tsx --test tests\readonly-real-smoke-chain-index-audit.test.ts tests\readonly-real-smoke-chain-local-candidate-consistency.test.ts tests\readonly-real-smoke-chain-local-closeout-audit.test.ts tests\formal-real-readonly-smoke-rc-local-closeout-audit.test.ts`
  - Result: passed, `16 / 16`
- `npx tsx --test tests\codex-cli-host.test.ts tests\state-sync-audit.test.ts tests\readonly-formal-integration-readiness-matrix-audit.test.ts tests\readonly-productization-acceptance.test.ts tests\source-release-package-boundary-audit.test.ts tests\formal-real-readonly-smoke-rc-local-closeout-audit.test.ts tests\readonly-real-smoke-chain-index-audit.test.ts`
  - Result: passed, `137 / 137`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1089 / 1089`
- `npm run build`
  - Result: passed

## Remaining Risk

- `CURRENT_STATE.md` intentionally records `Stale after commit: true`; after a
  new commit, the state surface must be refreshed to the new commit before it
  should be treated as current.
- The state-sync audit is a local read-only audit. It does not authorize
  execution, provider work, workspace-write, or remote actions.
- The PR review fix is committed locally at `b2f0c1d`.
