# Handoff

Original goal: reduce project drag from stale state surfaces, unclear execution
boundaries, documentation drift, and maintainability pressure.

Current status:

- Branch: `fix/codex-cli-policy-bypass-flags`
- Current head at this metadata refresh: `ebd7967`
- Upstream: `origin/fix/codex-cli-policy-bypass-flags`
- Current state source: `docs/current/CURRENT_STATE.md`
- Work in progress: post-commit state metadata refresh after the CI shallow
  checkout audit fix.

Validated before this broader state-sync cleanup:

- `npx tsx --test tests\codex-cli-host.test.ts`: passed, `101 / 101`
- `npm run typecheck`: passed
- `npm test`: passed, `1082 / 1082`
- `npm run build`: passed

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

- `ebd7967` allows selected read-only audit collectors to tolerate missing
  `origin/main` during CI shallow PR checkouts.
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
2. Commit this post-commit state refresh, push the branch, then wait for PR #41
   checks.
3. Commit and push only after explicit authorization.
