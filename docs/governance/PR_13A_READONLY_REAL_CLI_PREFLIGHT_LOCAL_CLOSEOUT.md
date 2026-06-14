# PR-13A Read-only Real CLI Preflight Local Closeout

## 1. Purpose

This document records a local-only closeout for the PR-13A read-only real CLI
preflight taskbook.

It is not a smoke receipt. It is not a push-readiness receipt. It is not an
execution authorization, release note, tag note, workspace-write approval, or
production readiness claim.

## 2. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Branch: `main`
- Local closeout date: 2026-06-14
- Mode: local documentation, review, and validation only

## 3. Local Scope

This local closeout covers:

- `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md`

The taskbook defines the exact gate for a future real Codex CLI read-only
smoke. It does not run the smoke.

Included local commit:

- `6f586cf docs(governance): define read-only real cli preflight`

Related prior local safety material:

- `d826750 feat(provider): guard real read-only codex cli execute`
- `7d05b71 test(provider): add real read-only dispatch acceptance`
- `fc13a9c test(dispatch): reject registry capability mismatches`
- `0da4146 docs(governance): close out approval consumption hardening`

## 4. Reviewed Preconditions

Confirmed taskbook requirements:

- future real read-only smoke requires exact operator authorization
- required authorization token is recorded
- required command shape is recorded
- future execution is read-only only
- approval policy remains `never`
- workspace-write remains prohibited
- push, release, tag, publish, and remote writes remain prohibited
- evidence must remain sanitized
- fresh preflight validation commands are listed
- stop conditions are listed

The taskbook explicitly does not authorize:

- running `npm run smoke:readonly:real`
- setting the real smoke environment gate
- invoking the real Codex CLI
- opening workspace-write execute
- writing the canary target file
- pushing local commits
- creating releases or tags

## 5. Boundary Review

Still closed:

- real Codex CLI invocation
- provider execute outside existing fake or previously approved guarded paths
- workspace-write execute
- workspace-write canary write
- local command enablement
- protected remote enablement
- external side effects
- push, release, tag, publish

Observed existing real read-only surfaces:

- package script: `smoke:readonly:real`
- script: `scripts/run-codex-cli-real-readonly-smoke.ts`
- test: `tests/codex-cli-real-readonly-smoke-script.test.ts`
- default evidence path: `docs/evidence/codex-cli-real-readonly-smoke.json`

This closeout did not execute those real smoke surfaces.

## 6. Validation

Validation run for this local closeout:

- `git status --short`
- `git branch -vv`
- `git log --oneline -8`
- `git diff --check`
- `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts tests\real-readonly-dispatch-acceptance.test.ts tests\host-dispatcher.test.ts`
- `npm run acceptance:real-readonly-dispatch`
- `npm run typecheck`
- `npm test`

Observed passing results:

- real read-only smoke script / dispatch / host dispatcher tests: `21 / 21`
- fake-only real-readonly dispatch acceptance: passed
- typecheck: passed
- full test suite: `891 / 891`
- diff check: passed

Sensitive marker review:

- The taskbook intentionally names forbidden marker labels as part of its
  future evidence exclusion list.
- These are policy text references, not leaked values.
- No raw prompt, raw command, raw environment, token value, API key value, or
  process output was added by this closeout.

## 7. Current Classification

- SCOPED_RC_READY: local-only taskbook recorded
- PRODUCTION_READY: no
- REAL_EXECUTION_READY: read-only guarded, separate authorization required
- REAL_CODEX_CLI_READY: preflight-defined, not authorized by this closeout
- WORKSPACE_WRITE_READY: no
- RELEASE_READY: no
- PUSH_READY: not evaluated by this closeout

## 8. Result

Result:

- `PR_13A_READONLY_REAL_CLI_PREFLIGHT_LOCAL_CLOSEOUT_COMPLETE`

The project now has a reviewed local taskbook for future real read-only CLI
smoke authorization. This closeout does not authorize or perform the smoke.

## 9. Next Safe Action

Next safe local action:

- continue with local-only review around PR-13A, or wait for a separate exact
  operator authorization before any real read-only CLI smoke.

The next action must not be:

- real Codex CLI invocation
- workspace-write execution
- release or tag
- push without explicit remote authorization
