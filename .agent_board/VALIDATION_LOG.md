# Validation Log

## PR2 Governance Surface Split Validation

Branch:

- `chore/governance-validation-surface-slimming`

Commit:

- `8480a6f`

Results:

- `git diff --check`
  - Result: passed.
- Legacy package-script alias reference search
  - Result: passed by no matches.
- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `104 / 104`.
- `npm run validate:daily -- --test tests\governance-check.test.ts`
  - Result: passed; included `npm run typecheck` and
    `tests\governance-check.test.ts` with `6 / 6`.
- `npm test`
  - Result: passed, `1109 / 1109`.
- `npm run build`
  - Result: passed.
- `npm run governance -- list`
  - Result: passed.

## Document Governance Surface Slimming

Branch:

- `chore/governance-validation-surface-slimming`

Commit:

- `8480a6f`

Results:

- `wc -l README.md docs/README.md docs/governance/README.md docs/current/CURRENT_STATE.md .agent_board/RUN_STATE.md .agent_board/HANDOFF.md .agent_board/CHECKPOINT.md .agent_board/TASK_QUEUE.md .agent_board/VALIDATION_LOG.md`
  - Result: current mapped surfaces total `1126` lines after slimming and
    validation-log recording.
- Absolute Windows docs-root link search across current docs surfaces
  - Result: passed by no matches.
- `git diff --check`
  - Result: passed.
- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `16 / 16`.
- `npm run governance -- audit state-sync`
  - Result: passed.

## Legacy Alias Cleanup Follow-Up

Branch:

- `chore/governance-validation-surface-slimming`

Commit:

- `8480a6f`

Results:

- `npm run governance -- list`
  - Result: passed after removing old per-check package script aliases and
    migrating remaining command references.
- `npm run validate:daily -- --test tests\governance-check.test.ts`
  - Result: passed; included `npm run typecheck` and
    `tests\governance-check.test.ts` with `5 / 5`.
- `npm run validate:pr`
  - Result: passed; included `npm run typecheck`, `npm test`
    (`1108 / 1108`), `npm run build`, and direct
    `tsx scripts/run-state-sync-audit.ts` dispatch.
- `rg -n 'npm run (audit|acceptance|operator:acceptance)' . -g '!node_modules' -g '!dist'`
  - Result: passed by no matches.
- `rg -n '"(audit|acceptance|operator:acceptance)[^"]*"\s*:' package.json scripts tests packages -g '!node_modules'`
  - Result: passed by no matches.
- `rg -n 'audit:state-sync|acceptance:real-readonly-smoke-auth|operator:acceptance|audit:\*|acceptance:\*|operator:acceptance\*' . -g '!node_modules' -g '!dist'`
  - Result: passed by no matches.

## Validation Tier And Governance Runner Slice

Branch:

- `chore/governance-validation-surface-slimming`

Commit:

- `8480a6f`

Results:

- `npm run governance -- list`
  - Result: passed
- `npm run validate:daily -- --test tests\governance-check.test.ts`
  - Result: passed; included `npm run typecheck` and
    `tests\governance-check.test.ts` with `5 / 5`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1108 / 1108`
- `git diff --check`
  - Result: passed
- `npm run validate:pr`
  - Result: passed; included `npm run typecheck`, `npm test`
    (`1108 / 1108`), `npm run build`, and `npm run governance -- audit state-sync`
- `npm run governance -- audit state-sync`
  - Result: passed

## Current State-Sync And Governance Runner Slice

Branch:

- `chore/governance-validation-surface-slimming`

Commit:

- `8480a6f`

Results before this state refresh:

- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1101 / 1101`
- `npm run build`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: blocked because `CURRENT_STATE.md` still recorded stale branch and
    upstream facts

Results after implementation:

- `npm run governance -- audit state-sync`
  - Result: passed
- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `16 / 16`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: first run failed, `1098 / 1103`, because
    `tests/state-sync-audit.test.ts` still hardcoded the merged PR branch and
    upstream
- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `16 / 16`, after fixture refresh
- `npm run governance -- audit state-sync`
  - Result: passed after fixture refresh
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1103 / 1103`
- `npm run build`
  - Result: passed

## Baseline Before State-Sync Slice

Branch:

- `fix/codex-cli-policy-bypass-flags`

Commit:

- initial branch baseline before the state-sync slice

Commands:

- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `98 / 98`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1074 / 1074`
- `npm run build`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed after state refresh
- `npm run governance -- audit state-sync`
  - Result: passed after state refresh

## State-Sync Slice

Planned commands:

- `npx tsx --test tests\state-sync-audit.test.ts`
- `npm run governance -- audit state-sync`
- `npm run typecheck`
- `npm test`
- `npm run build`

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `5 / 5`
- `npm run governance -- audit state-sync`
  - Result: passed
- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `101 / 101`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1082 / 1082`
- `npm run build`
  - Result: passed

## Audit-Core Extraction

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `5 / 5`
- `npm run governance -- audit state-sync`
  - Result: passed
- `npm run typecheck`
  - Result: passed
- `npm run build`
  - Result: passed
- `npm test`
  - Result: passed, `1082 / 1082`
- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `101 / 101`

## CI Shallow Checkout Audit Fix

Results:

- `npx tsx --test tests\readonly-formal-integration-readiness-matrix-audit.test.ts tests\readonly-productization-acceptance.test.ts tests\source-release-package-boundary-audit.test.ts`
  - Result: passed, `16 / 16`
- `npx tsx --test tests\readonly-real-smoke-chain-index-audit.test.ts tests\readonly-real-smoke-chain-local-candidate-consistency.test.ts tests\readonly-real-smoke-chain-local-closeout-audit.test.ts tests\formal-real-readonly-smoke-rc-local-closeout-audit.test.ts`
  - Result: passed, `16 / 16`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1082 / 1082`
- `npm run build`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed

## PR Review Fixes

Results:

- `npx tsx --test tests\codex-cli-host.test.ts tests\state-sync-audit.test.ts tests\readonly-formal-integration-readiness-matrix-audit.test.ts tests\readonly-productization-acceptance.test.ts tests\source-release-package-boundary-audit.test.ts tests\formal-real-readonly-smoke-rc-local-closeout-audit.test.ts tests\readonly-real-smoke-chain-index-audit.test.ts`
  - Result: passed, `137 / 137`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1089 / 1089`
- `npm run build`
  - Result: passed

## Upstream Divergence Review Fix

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `8 / 8`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1091 / 1091`
- `npm run build`
  - Result: passed

## Web Search Probe Review Fix

Results:

- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `104 / 104`
- `npm run typecheck`
  - Result: passed
- `npm test`
  - Result: passed, `1094 / 1094`
- `npm run build`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed before state refresh

## PR Merge Checkout State-Sync Review Fix

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `11 / 11`
- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `104 / 104`
- `npm run typecheck`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed before state refresh
- `npm test`
  - Result: passed, `1096 / 1096`
- `npm run build`
  - Result: passed

## Shallow PR Merge Checkout State-Sync Review Fix

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `12 / 12`
- `npm run typecheck`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed before state refresh
- `npm test`
  - Result: passed, `1097 / 1097`
- `npm run build`
  - Result: passed

## Shallow Merge State-Sync Test Stability Fix

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `12 / 12`
- `npm run typecheck`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed before state refresh
- `npm test`
  - Result: passed, `1097 / 1097`
- `npm run build`
  - Result: passed

## Synthetic Review Checkout State-Sync Fix

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `14 / 14`
- `npm run typecheck`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed before state refresh
- `npm test`
  - Result: passed, `1099 / 1099`
- `npm run build`
  - Result: passed

## Merge Base State-Sync Exclusion Fix

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `15 / 15`
- `npm run typecheck`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed before state refresh
- `npm test`
  - Result: passed, `1100 / 1100`
- `npm run build`
  - Result: passed

## Merge Base Allowlist Collection Fix

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `16 / 16`
- `npm run typecheck`
  - Result: passed
- `npm run governance -- audit state-sync`
  - Result: passed before state refresh
- `npm test`
  - Result: passed, `1101 / 1101`
- `npm run build`
  - Result: passed
