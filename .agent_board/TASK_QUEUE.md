# Task Queue

Current task:

- PR-23A-S1 trusted runtime binding R1-G1FIX5 local state update on
  `feat/pr-23a-s1-trusted-runtime`

Done:

- completed local code remediation for smoke evidence projection
- completed local code remediation for platform-drift test isolation
- verified pre-code-commit diff check, typecheck, targeted host test, contract
  smoke, full tests, and build
- created the authorized local code remediation commit
- verified post-code-commit typecheck, targeted host test, and contract smoke
- prepared the six authorized state surfaces for the state commit

Todo:

- verify the modified file set is exactly the six authorized state files
- run pre-commit `git diff --check`
- run pre-commit process-scoped offline
  `npx tsx --test tests\codex-cli-host.test.ts`
- run pre-commit `npm test`
- run pre-commit `npm run build`
- run pre-commit `npm run governance -- audit state-sync`
- run pre-commit `npm run validate:pr`
- create exactly one local commit:
  `docs(state): record new-head CI remediation validation`
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
- send R1-G1FIX5 closeout receipt to the web GPT commander
- wait up to 7 minutes for the next exact task book or authorization token

Blocked until separately authorized:

- push
- PR edit, comment, review, or ready-for-review action
- workflow rerun, cancel, dispatch, watch, or any other CI action
- fetch, pull, merge, rebase, branch deletion
- amend, reset, clean, stash
- release, deploy, npm publish, tag
- additional CI logs or artifacts
- real Codex CLI execution
- real provider execution
- workspace-write telemetry smoke
- env, secret, user config, or system config edits
