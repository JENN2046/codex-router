# Run State

Status: shallow PR merge checkout state-sync review fix committed; state
metadata refresh is in progress.

Current truth source:

- `docs/current/CURRENT_STATE.md`

Workspace:

- `A:\AGENTS_OS_Workspace\governance\codex-router`

Branch:

- `fix/codex-cli-policy-bypass-flags`

Current head at latest local status refresh:

- `a65a7fb`

Upstream:

- `origin/fix/codex-cli-policy-bypass-flags`

Worktree at last board refresh:

- dirty only with the post-merge-checkout-review-fix state metadata refresh

Current scope:

- local docs and audit surfaces only
- no real Codex CLI execution
- no provider execute
- no workspace-write execution
- no release, tag, deployment, or protected remote action

Validation baseline for `a65a7fb`:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `104 / 104`
- `npx tsx --test tests\state-sync-audit.test.ts`: passed, `14 / 14`
- `npm run typecheck`: passed
- `npm test`: passed, `1099 / 1099`
- `npm run build`: passed
- `npm run audit:state-sync`: passed before state refresh

Latest local optimization:

- `turn.failed` JSONL events fail closed even if Codex CLI exits with code `0`
- state-sync audit checks recorded commit hashes against the real head or the
  stale-after-commit parent head
- state-sync audit checks recorded upstream divergence against the actual
  ahead/behind result and blocks unknown divergence
- Codex CLI probe and read-only smoke checks treat web search events as
  unexpected tool use
- state-sync audit accepts PR merge checkout second-parent ancestry for stale
  state hashes while still blocking unrelated stale hashes
- state-sync audit reads declared parents from `HEAD^2` so shallow PR merge
  checkouts can validate the PR head parent without downloading it
- state-sync audit regression tests derive the recorded state head dynamically
  instead of baking in a previous refresh hash
- state-sync audit allows clean synthetic single-commit review checkouts only
  when `CURRENT_STATE.md` explicitly marks them as allowed and the recorded
  state fields are self-consistent
- read-only audit freshness collectors fail closed when `origin/main`
  divergence is unknown
- pure state-sync audit rules extracted to
  `packages/state-sync-audit/src/index.ts`
- `scripts/run-state-sync-audit.ts` remains the CLI and repo collection shell
- `tests/state-sync-audit.test.ts` imports the reusable module

Completed validation for this slice:

- `npx tsx --test tests\codex-cli-host.test.ts`
- `npx tsx --test tests\state-sync-audit.test.ts`
- `npm run audit:state-sync`
- `npm run typecheck`
- `npm test`
- `npm run build`
