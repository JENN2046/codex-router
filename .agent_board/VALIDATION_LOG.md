# Validation Log

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
- `npm run audit:state-sync`
  - Result: passed after state refresh
- `npm run audit:state-sync`
  - Result: passed after state refresh

## State-Sync Slice

Planned commands:

- `npx tsx --test tests\state-sync-audit.test.ts`
- `npm run audit:state-sync`
- `npm run typecheck`
- `npm test`
- `npm run build`

Results:

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

## Audit-Core Extraction

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `5 / 5`
- `npm run audit:state-sync`
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
- `npm run audit:state-sync`
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
- `npm run audit:state-sync`
  - Result: passed before state refresh

## PR Merge Checkout State-Sync Review Fix

Results:

- `npx tsx --test tests\state-sync-audit.test.ts`
  - Result: passed, `11 / 11`
- `npx tsx --test tests\codex-cli-host.test.ts`
  - Result: passed, `104 / 104`
- `npm run typecheck`
  - Result: passed
- `npm run audit:state-sync`
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
- `npm run audit:state-sync`
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
- `npm run audit:state-sync`
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
- `npm run audit:state-sync`
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
- `npm run audit:state-sync`
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
- `npm run audit:state-sync`
  - Result: passed before state refresh
- `npm test`
  - Result: passed, `1101 / 1101`
- `npm run build`
  - Result: passed
