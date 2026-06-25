# Validation Log

Current branch:

- `feat/pr-23a-s1-trusted-runtime`

Recorded code head:

- `2244797`

R1-G1FIX preflight completed:

- local `HEAD` matched expected start:
  `398bf0c41beb222cc188328adc71c0f50a8b5ee5`
- local `origin/main` matched expected:
  `2eb320e1118499b5dcf373bc4ccca04ff9224356`
- remote feature head matched expected:
  `398bf0c41beb222cc188328adc71c0f50a8b5ee5`
- PR #46 was `OPEN` and draft, with the expected head and base
- failed run `28130303432` was completed with failure
- failed job IDs observed: `83304696661`, `83304696663`
- worktree was clean before remediation
- `git diff --check`: passed
- Node version observed: `v24.14.0`
- npm version observed: `11.9.0`

R1-G1FIX pre-code-commit validation completed:

- authorized code file set check: passed
- `git diff --check`: passed
- `npm run typecheck`: passed
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`:
  passed, `109 / 109`
- safe contract smoke with process-scoped temporary evidence path: passed
- safe smoke spawn call count: `4`
- safe smoke evidence SHA-256:
  `38fada7ac3fba21eed02b0dc45125b54d5cb083841224cc04605d003298e453b`
- safe smoke evidence omitted raw workspace path, raw command, raw cwd, raw
  argv, prompt text, and stdin contents from spawn call evidence
- `npm test`: passed, `1153 / 1153`
- `npm run build`: passed

Commit 1 completed:

- `2244797 fix(codex-runtime): align CI fixtures with stdin binding`

R1-G1FIX post-code-commit validation completed:

- `npm run typecheck`: passed
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`:
  passed, `109 / 109`
- safe contract smoke with process-scoped temporary evidence path: passed
- safe smoke spawn call count: `4`
- safe smoke evidence SHA-256:
  `d2b86f32f320c52cfb77a8a39daa44bf12798e71c911bd3589c20f866cbbba46`

Coverage added:

- contract smoke mock classifies model probes from stdin instead of argv
- contract smoke fake child does not emit stdout or close before stdin receipt
- duplicate fake stdin termination fails closed with stable error output
- smoke spawn evidence stores safe contract facts only
- smoke validation checks configured runtime command matching
- smoke validation checks requested workspace matching without retaining raw cwd
- smoke validation checks argv prompt markers are absent
- smoke validation checks generated evidence omits the active workspace path
- Windows helper-layout test creates and executes the plan under one simulated
  platform
- platform drift before spawn rejects with
  `codex_cli_runtime_binding_descriptor_mismatch`

Final validation still pending:

- documentation-only state Commit 2
- `git diff --check`
- `npm run typecheck`
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`
- safe contract smoke with process-scoped temporary evidence path
- `npm test`
- `npm run build`
- `npm run governance -- audit state-sync`
- `npm run validate:pr`
- final status, ahead/behind, commit chain, remote refs, and PR inspection
