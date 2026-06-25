# Task Queue

Current task:

- PR-23A-S1 trusted runtime binding R1-G1FIX local CI remediation on
  `feat/pr-23a-s1-trusted-runtime`

Done:

- verified branch, starting local head, local `origin/main`, remote feature
  head, PR #46 metadata, and failed run `28130303432`
- confirmed the worktree was clean before R1-G1FIX edits
- confirmed the allowed file set for R1-G1FIX
- updated the contract smoke fake spawner so prompts are classified from stdin,
  not argv
- updated smoke spawn evidence to retain safe contract facts only
- added smoke checks for stdin prompt transport, argv prompt-marker absence,
  safe spawn evidence, configured runtime matching, requested workdir matching,
  and generated evidence path sanitization
- fixed the Windows helper-layout test so simulated win32 is established
  before plan creation and stays active through execution
- added platform-drift coverage that fails closed before spawn
- completed pre-code-commit validation
- created authorized local Commit 1:
  `2244797 fix(codex-runtime): align CI fixtures with stdin binding`
- completed post-code-commit validation

Todo:

- create authorized local Commit 2 for this R1-G1FIX state documentation
  refresh
- run final post-state-commit validation:
  - `git diff --check`
  - `npm run typecheck`
  - `npx --no-install tsx --test tests/codex-cli-host.test.ts`
  - safe contract smoke with a process-scoped temporary evidence path
  - `npm test`
  - `npm run build`
  - `npm run governance -- audit state-sync`
  - `npm run validate:pr`
- inspect final local status, ahead/behind count, commit chain, remote refs,
  and PR #46 metadata
- send R1-G1FIX closeout receipt to the web GPT commander
- wait up to 7 minutes for the next exact task book or authorization token

Blocked until separately authorized:

- push
- PR edit, comment, review, or ready-for-review action
- workflow rerun, cancel, dispatch, or any other CI action
- merge, rebase, branch deletion
- release, deploy, npm publish, tag
- real Codex CLI execution
- real provider execution
- workspace-write telemetry smoke
- env, secret, user config, or system config edits
