# Task Queue

## Done

- Fix Codex CLI policy bypass argv matching so `--ignore-rules=true` and
  `--ignore-rules=false` are blocked.
- Block Codex CLI feature flag override argv through `--enable` and
  `--disable` variants.
- Validate and push branch `fix/codex-cli-policy-bypass-flags` at `1687e61`.
- Add `docs/current/CURRENT_STATE.md` as the compact current-state surface.
- Add `scripts/run-state-sync-audit.ts`.
- Add `tests/state-sync-audit.test.ts`.
- Add package script `audit:state-sync`.
- Refresh `.agent_board` to point at `docs/current/CURRENT_STATE.md` and current
  branch state.
- Validate state-sync targeted tests, state-sync audit, typecheck, full tests,
  and build.
- Add Codex CLI production argv allowlist validator.
- Add regression coverage for unknown forged flags and unknown positional argv.
- Validate Codex CLI host targeted tests, state-sync audit, typecheck, full
  tests, and build after the allowlist change.
- Align strict JSONL known-event handling with official Codex event families for
  `turn.failed` and web search item shapes.
- Add official JSONL fixture coverage for `thread.started`, `turn.started`,
  `turn.failed`, `item.*`, MCP tool calls, web search calls, plan updates, file
  changes, and command execution.
- Validate Codex CLI host targeted tests, state-sync audit, typecheck, full
  tests, and build after the JSONL fixture change.
- Extract pure state-sync audit rules into
  `packages/state-sync-audit/src/index.ts`.
- Keep `scripts/run-state-sync-audit.ts` as the repository collection and CLI
  shell.
- Validate state-sync targeted tests, state-sync audit, typecheck, full tests,
  Codex CLI host targeted tests, and build after the audit-core extraction.
- Fix CI shallow checkout failures for read-only audit collectors that inspect
  `origin/main`.
- Validate the failed CI test files, nested smoke-chain audit files, typecheck,
  full tests, build, and state-sync audit after the CI fix.

## In Progress

- None.

## Blocked

- General workspace-write or general provider execution remains blocked until a
  separate exact operator authorization and a new controlled execution gate are
  provided.
- Protected remote writes, release, tag, deployment, and secret changes remain
  blocked unless explicitly authorized in a future task.

## Remaining

- Inspect diff.
- Refresh `CURRENT_STATE.md` to a new commit after any local commit.
- Next implementation slice: push the CI fix and state refresh to PR #41, then
  wait for checks.
- Commit and push only if explicitly requested after validation, or if a later
  instruction clearly authorizes that remote action.
