# Task Queue

Current task:

- PR-23A-S1 trusted runtime binding R1-G1FIX4 state-sync documentation repair
  on `feat/pr-23a-s1-trusted-runtime`

Done:

- completed R1-G1FIX local code remediation
- completed R1-G1FIX local state documentation commit
- confirmed R1-G1FIX final validation failure is documentation-only
- confirmed remote feature branch and PR #46 have not changed
- ran the exact state-sync-required targeted command with process-scoped
  offline protection; result `109 / 109`
- repaired the current state validation baseline to include the exact required
  targeted command literal
- paraphrased non-state commit-like tokens in agent board files
- restored exactly one legal current-state anchor token in agent board files

Todo:

- verify the modified file set is exactly the six authorized state files
- run pre-commit `git diff --check`
- run pre-commit `npm run governance -- audit state-sync`
- scan the six changed files for machine-path material and unexpected
  commit-like tokens without printing sensitive values
- create exactly one local commit:
  `docs(state): align state-sync anchor to HEAD-only invariant`
- run final post-commit validation:
  - `git diff --check`
  - `npm run typecheck`
  - `npx --no-install tsx --test tests/codex-cli-host.test.ts`
  - `npx tsx --test tests\codex-cli-host.test.ts`
  - safe contract smoke with a process-scoped temporary evidence path
  - `npm test`
  - `npm run build`
  - `npm run governance -- audit state-sync`
  - `npm run validate:pr`
- inspect final local status, ahead/behind count, commit chain, remote refs,
  and PR #46 metadata
- send R1-G1FIX4 closeout receipt to the web GPT commander
- wait up to 7 minutes for the next exact task book or authorization token

Blocked until separately authorized:

- push
- PR edit, comment, review, or ready-for-review action
- workflow rerun, cancel, dispatch, or any other CI action
- merge, rebase, branch deletion
- amend, reset, stash
- release, deploy, npm publish, tag
- real Codex CLI execution
- real provider execution
- workspace-write telemetry smoke
- env, secret, user config, or system config edits
