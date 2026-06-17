# Task Queue

## Done

- Fix Codex CLI policy bypass argv matching so `--ignore-rules=true` and
  `--ignore-rules=false` are blocked.
- Block Codex CLI feature flag override argv through `--enable` and
  `--disable` variants.
- Validate and push branch `fix/codex-cli-policy-bypass-flags`.
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
- Fix PR review feedback for `turn.failed`, state-sync hash freshness, and
  unknown `origin/main` freshness.
- Validate PR review fixes with targeted tests, typecheck, full tests, and
  build.
- Refresh `CURRENT_STATE.md` and `.agent_board` after the first PR review fix.
- Validate the state refresh with `npm run audit:state-sync`.
- Fix PR review feedback requiring `Upstream divergence` to match actual
  ahead/behind state.
- Validate upstream divergence fix with targeted state-sync tests, typecheck,
  full tests, and build.
- Refresh `CURRENT_STATE.md` and `.agent_board` after the upstream divergence
  review fix.
- Validate the state refresh with `npm run audit:state-sync`.
- Fix PR review feedback requiring web search events to count as unexpected
  tool use during probes and read-only smoke validation.
- Validate web search probe fix with Codex CLI host targeted tests, typecheck,
  full tests, build, and state-sync audit.
- Fix PR review feedback requiring state hashes to remain valid when
  `audit:state-sync` runs on a PR merge checkout.
- Validate PR merge checkout state-sync fix with targeted state-sync tests,
  typecheck, state-sync audit, full tests, and build.
- Refresh `CURRENT_STATE.md` and `.agent_board` after the PR merge checkout
  state-sync review fix.
- Fix PR review feedback requiring state hashes to remain valid in shallow PR
  merge checkouts where `HEAD^2^` cannot be resolved.
- Validate shallow PR merge checkout state-sync fix with targeted state-sync
  tests, typecheck, state-sync audit, full tests, and build.
- Refresh `CURRENT_STATE.md` and `.agent_board` after the shallow PR merge
  checkout state-sync review fix.
- Fix CI failure caused by a state-sync regression test baking in a previous
  state refresh hash.
- Validate state-sync test stability fix with targeted state-sync tests,
  typecheck, state-sync audit, full tests, and build.
- Refresh `CURRENT_STATE.md` and `.agent_board` after the test stability fix.
- Fix repeated synthetic single-commit review checkout state hash failures
  without accepting arbitrary stale state.
- Validate synthetic review checkout state-sync fix with targeted state-sync
  tests, typecheck, state-sync audit, full tests, and build.
- Refresh `CURRENT_STATE.md` and `.agent_board` after the synthetic review
  checkout fix.
- Fix PR review feedback so merge checkout base parents are not accepted as
  state commits when PR-side merge ancestry evidence exists.
- Validate merge base exclusion with targeted state-sync tests, typecheck,
  state-sync audit, full tests, and build.
- Refresh `CURRENT_STATE.md` and `.agent_board` after the merge base exclusion
  fix.

## In Progress

- None.

## Blocked

- General workspace-write or general provider execution remains blocked until a
  separate exact operator authorization and a new controlled execution gate are
  provided.
- Protected remote writes, release, tag, deployment, and secret changes remain
  blocked unless explicitly authorized in a future task.

## Remaining

- Commit the state refresh.
- Push PR #41 and wait for checks.
