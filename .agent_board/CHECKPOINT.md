# Checkpoint

## Current Stage

State-surface cleanup is in progress on branch
`fix/codex-cli-policy-bypass-flags` at base head `1687e61`.

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
  current branch and `1687e61` baseline.
- Added a Codex CLI production argv allowlist validator that rejects forged
  unknown flags and positional argv before spawn.
- Added Codex CLI host regression coverage for allowlist enforcement.
- Added official JSONL fixture coverage for known Codex event families and
  read-only write evidence in official item shapes.
- Added `turn.failed` and web search item recognition to strict JSONL known
  event handling.

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

## Remaining Risk

- `CURRENT_STATE.md` intentionally records `Stale after commit: true`; after a
  new commit, the state surface must be refreshed to the new commit before it
  should be treated as current.
- The state-sync audit is a local read-only audit. It does not authorize
  execution, provider work, workspace-write, or remote actions.
