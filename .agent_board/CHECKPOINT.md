# Checkpoint

Current state source:

- `docs/current/CURRENT_STATE.md`

Branch:

- `feat/pr-23a-s1-trusted-runtime`

Recorded code head:

- `2244797`

Completed in this checkpoint:

- created the R1-G1FIX code commit:
  `2244797 fix(codex-runtime): align CI fixtures with stdin binding`
- made the contract smoke fake spawner stdin-aware
- removed raw command, cwd, argv, prompt, and stdin contents from smoke spawn
  evidence
- added smoke checks for stdin prompt transport, argv prompt-marker absence,
  safe spawn evidence, configured runtime matching, and requested workdir
  matching
- changed the Windows helper-layout test to create and execute its plan under
  the same simulated win32 platform
- kept platform drift fail-closed with descriptor mismatch and zero spawner
  calls
- kept PR #46 draft and remote feature at the old published head
- recorded that failed run `28130303432` is locally remediated, remote
  validation pending

Validation completed:

- pre-commit `git diff --check`: passed
- pre-commit `npm run typecheck`: passed
- pre-commit `npx --no-install tsx --test tests/codex-cli-host.test.ts`:
  passed, `109 / 109`
- pre-commit safe contract smoke: passed, spawn call count `4`
- pre-commit `npm test`: passed, `1153 / 1153`
- pre-commit `npm run build`: passed
- post-code-commit `npm run typecheck`: passed
- post-code-commit `npx --no-install tsx --test tests/codex-cli-host.test.ts`:
  passed, `109 / 109`
- post-code-commit safe contract smoke: passed, spawn call count `4`

Remaining validation:

- create the documentation-only R1-G1FIX state commit
- run final diff check, typecheck, targeted test, safe contract smoke, full
  tests, build, state-sync audit, and validate:pr
- perform final local and remote read-only integrity checks
- send commander receipt

Boundary:

- exactly two local commits are authorized for R1-G1FIX
- Commit 1 has been created; Commit 2 is this state documentation refresh
- no push, PR edit/comment/review/ready, workflow action, merge, release,
  deploy, npm publish, secret edit, real Codex CLI, real provider execution, or
  workspace-write smoke has been performed
