# Handoff

Original goal: reduce project drag from stale state surfaces, unclear execution
boundaries, documentation drift, and maintainability pressure.

Current status:

- Branch: `fix/codex-cli-policy-bypass-flags`
- Current head at this metadata refresh: `a24fad2`
- Upstream: `origin/fix/codex-cli-policy-bypass-flags`
- Current state source: `docs/current/CURRENT_STATE.md`
- Work in progress: post-commit state metadata refresh after merge-base
  allowlist collection fix.

Validated for current PR merge checkout state-sync review fix:

- `npx tsx --test tests\state-sync-audit.test.ts`: passed, `16 / 16`
- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `104 / 104`
- `npm run typecheck`: passed
- `npm test`: passed, `1101 / 1101`
- `npm run build`: passed
- `npm run audit:state-sync`: passed before state refresh

Validation for this slice:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - passed, `5 / 5`
- `npm run audit:state-sync`
  - passed
- `npx tsx --test tests\codex-cli-host.test.ts`
  - passed, `101 / 101`
- `npm run typecheck`
  - passed
- `npm test`
  - passed, `1082 / 1082`
- `npm run build`
  - passed

Local optimizations committed:

- The review fix makes `turn.failed` JSONL events blocking even with exit code
  `0`.
- The review fix tightens state-sync commit fields to the real head or the
  stale-after-commit parent head.
- The review fix tightens `Upstream divergence` to the actual ahead/behind
  result and blocks unknown divergence.
- The review fix treats web search events as unexpected tool use during Codex
  CLI probes and read-only smoke validation.
- The review fix accepts stale state hashes from PR merge checkout
  second-parent ancestry while still blocking unrelated stale hashes.
- The review fix reads declared parents from `HEAD^2`, covering shallow PR
  merge checkouts where `HEAD^2^` cannot be resolved locally.
- The regression test now derives the recorded state head dynamically instead
  of baking in a previous state refresh hash.
- The audit now accepts clean synthetic single-commit review checkouts only when
  the state document explicitly allows them and recorded state fields are
  self-consistent.
- The audit now excludes the merge checkout base parent from acceptable state
  commits whenever PR-side merge ancestry evidence is available.
- The state-sync collector now filters the merge checkout base parent out of
  `allowedStateCommits` before review, including shallow checkout parent data.
- The review fix makes selected read-only audit freshness checks fail closed when
  `origin/main` divergence is unknown.
- `packages/state-sync-audit/src/index.ts` now owns pure review and formatting
  logic.
- `scripts/run-state-sync-audit.ts` now owns Git/file collection and CLI
  execution.
- `tests/state-sync-audit.test.ts` imports the reusable audit module.

Hard boundaries:

- Do not treat the recorded bounded workspace-write canary as general
  workspace-write permission.
- Do not run general provider execution.
- Do not push to `main`, release, tag, deploy, or write to external services
  without a separate explicit instruction.
- Do not modify secrets or env files.

Next safe action:

1. Inspect diff and report validation honestly.
2. Commit this post-commit state refresh.
3. Push PR #41, then wait for checks.
