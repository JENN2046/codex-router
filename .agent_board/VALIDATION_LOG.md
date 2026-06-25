# Validation Log

Current branch:

- `feat/pr-23a-s1-trusted-runtime`

Current state source:

- `docs/current/CURRENT_STATE.md`

R1-G1FIX preflight completed:

- starting local head matched the expected old remote feature state
- local `origin/main` matched the expected base state
- PR #46 was `OPEN` and draft, with the expected old head and base
- the initial failed CI run and the two failed Node jobs were identified
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
- safe smoke evidence omitted raw workspace path, raw command, raw cwd, raw
  argv, prompt text, and stdin contents from spawn call evidence
- `npm test`: passed, `1153 / 1153`
- `npm run build`: passed

R1-G1FIX post-code-commit validation completed:

- `npm run typecheck`: passed
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`:
  passed, `109 / 109`
- safe contract smoke with process-scoped temporary evidence path: passed
- safe smoke spawn call count: `4`

R1-G1FIX final validation after the state commit:

- `git diff --check`: passed
- `npm run typecheck`: passed
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`:
  passed, `109 / 109`
- safe contract smoke with process-scoped temporary evidence path: passed
- safe smoke spawn call count: `4`
- `npm test`: failed only in state-sync audit coverage, `1146 / 1153`
- `npm run governance -- audit state-sync`: failed with documentation-only
  state-sync alignment reasons
- `npm run build` and `npm run validate:pr` were not run after that failure

R1-G1FIX4 pre-repair validation completed:

- local `tsx` executable availability check: passed
- `npx tsx --test tests\codex-cli-host.test.ts` with process-scoped
  `npm_config_offline=true`: passed, `109 / 109`

Coverage added by the local code remediation:

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
- platform drift before spawn rejects with descriptor mismatch and zero spawner
  calls

R1-G1FIX4 final validation still pending:

- documentation-only repair commit
- `git diff --check`
- `npm run typecheck`
- `npx --no-install tsx --test tests/codex-cli-host.test.ts`
- `npx tsx --test tests\codex-cli-host.test.ts`
- safe contract smoke with process-scoped temporary evidence path
- `npm test`
- `npm run build`
- `npm run governance -- audit state-sync`
- `npm run validate:pr`
- final status, ahead/behind, commit chain, remote refs, and PR inspection
