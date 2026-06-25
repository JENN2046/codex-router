# Validation Log

Current branch:

- `feat/pr-23a-s1-trusted-runtime`

Current state source:

- `docs/current/CURRENT_STATE.md`

R1-G1FIX5 preflight completed:

- local head matched the expected pre-remediation feature state before the
  local code remediation commit
- local base matched the expected mainline base
- PR #46 was open and draft, with the expected pre-remediation head and base
- failed remote CI existed before this local remediation
- worktree was clean before remediation
- `git diff --check`: passed

R1-G1FIX5 pre-code-commit validation completed:

- authorized code file set check: passed
- `git diff --check`: passed
- `npm run typecheck`: passed
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`:
  passed, `109 / 109`
- safe contract smoke with process-scoped temporary evidence path: passed
- safe smoke spawn call count: `4`
- persisted smoke evidence omitted active workspace path material, raw runtime
  keys, prompt transport markers, and raw nested runtime evidence
- `npm test`: passed, `1153 / 1153`
- `npm run build`: passed

R1-G1FIX5 post-code-commit validation completed:

- `npm run typecheck`: passed
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`:
  passed, `109 / 109`
- safe contract smoke with process-scoped temporary evidence path: passed
- persisted smoke evidence inspection passed before writing the artifact

Coverage added by the local code remediation:

- smoke artifact persistence stores safe nested evidence summaries only
- persisted smoke telemetry stores only level and message facts
- persisted artifact inspection rejects active workspace path material, exact
  raw runtime keys, and prompt transport markers
- platform-drift test creates the plan under the actual platform, then mutates
  the observed platform only for run validation
- platform drift before spawn rejects with descriptor mismatch and zero spawner
  calls

R1-G1FIX5 state-commit validation still pending:

- dirty set check for the six authorized state files
- `git diff --check`
- process-scoped offline `npx tsx --test tests\codex-cli-host.test.ts`
- `npm test`
- `npm run build`
- `npm run governance -- audit state-sync`
- `npm run validate:pr`

R1-G1FIX5 final validation still pending:

- worktree clean check and local ahead/behind check
- `git diff --check`
- `npm run typecheck`
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`
- process-scoped offline `npx tsx --test tests\codex-cli-host.test.ts`
- safe contract smoke with process-scoped temporary evidence path
- `npm test`
- `npm run build`
- `npm run governance -- audit state-sync`
- `npm run validate:pr`
- final remote read-only ref and PR inspection
