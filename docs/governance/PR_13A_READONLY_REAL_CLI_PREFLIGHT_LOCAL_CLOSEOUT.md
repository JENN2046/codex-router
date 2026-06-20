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

This local closeout originally covered:

- `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md`

The taskbook defines the exact gate for a future real Codex CLI read-only
smoke. It does not run the smoke.

Original local commit:

- `6f586cf docs(governance): define read-only real cli preflight`

Subsequent PR-13A local guard commits:

- `0bd8f51 test(governance): lock real readonly preflight taskbook`
- `0270ce6 test(governance): lock real readonly smoke evidence`
- `2ce9887 docs(governance): review real readonly preflight guards`
- `8065019 feat(governance): gate real readonly smoke authorization`

Additional local guard artifacts:

- `tests/pr-13a-real-readonly-preflight-taskbook.test.ts`
- `tests/real-readonly-smoke-authorization-acceptance.test.ts`
- `scripts/run-real-readonly-smoke-authorization-acceptance.ts`
- `docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json`
- `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_GUARD_TEST_REVIEW.md`
- `docs/governance/PR_13A_READONLY_REAL_CLI_AUTHORIZATION_PACKET_COMPATIBILITY.md`

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

Confirmed guard-test requirements:

- taskbook keeps the exact future authorization token
- taskbook keeps the exact future command shape
- taskbook remains non-authorizing
- taskbook keeps the fresh local preflight checklist
- committed real read-only smoke evidence remains read-only and sanitized
- future authorization packet must match PR-13A exactly
- broadened command, workspace-write sandbox, non-`never` approval policy,
  push, release, and tag are rejected locally before smoke execution

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
- governance runner: `npm run governance -- acceptance real-readonly-smoke-auth`
- script: `scripts/run-codex-cli-real-readonly-smoke.ts`
- script: `scripts/run-real-readonly-smoke-authorization-acceptance.ts`
- test: `tests/codex-cli-real-readonly-smoke-script.test.ts`
- test: `tests/pr-13a-real-readonly-preflight-taskbook.test.ts`
- test: `tests/real-readonly-smoke-authorization-acceptance.test.ts`
- default evidence path: `docs/evidence/codex-cli-real-readonly-smoke.json`
- authorization acceptance evidence path:
  `docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json`

This closeout did not execute the real smoke surface.

## 6. Validation

Validation run for this local closeout:

- `git status --short`
- `git branch -vv`
- `git log --oneline -8`
- `git diff --check`
- `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts tests\real-readonly-dispatch-acceptance.test.ts tests\host-dispatcher.test.ts`
- `npx tsx --test tests\real-readonly-smoke-authorization-acceptance.test.ts tests\pr-13a-real-readonly-preflight-taskbook.test.ts tests\codex-cli-real-readonly-smoke-script.test.ts tests\real-readonly-dispatch-acceptance.test.ts tests\host-dispatcher.test.ts`
- `npm run governance -- acceptance real-readonly-dispatch`
- `npm run governance -- acceptance real-readonly-smoke-auth`
- `npm run typecheck`
- `npm test`

Observed passing results:

- real read-only smoke script / dispatch / host dispatcher tests: `21 / 21`
- PR-13A authorization, taskbook, smoke script, dispatch, and host dispatcher
  tests: `30 / 30`
- fake-only real-readonly dispatch acceptance: passed
- real-readonly smoke authorization acceptance: passed
- typecheck: passed
- full test suite: `900 / 900`
- diff check: passed

Sensitive marker review:

- The taskbook intentionally names forbidden marker labels as part of its
  future evidence exclusion list.
- These are policy text references, not leaked values.
- `docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json`
  omits the raw authorization token, raw command, raw prompt, raw args, raw
  stdout, raw stderr, raw task envelope, raw env, raw token, raw patch, API key
  markers, and bearer markers.
- No raw prompt, raw command, raw environment, token value, API key value, or
  process output was added by this closeout.

## 7. Current Classification

- SCOPED_RC_READY: local-only taskbook, guard tests, and authorization
  compatibility evidence recorded
- PRODUCTION_READY: no
- REAL_EXECUTION_READY: read-only guarded, separate authorization required
- REAL_CODEX_CLI_READY: preflight-defined and authorization-gated, not
  authorized by this closeout
- WORKSPACE_WRITE_READY: no
- RELEASE_READY: no
- PUSH_READY: not evaluated by this closeout

## 8. Result

Result:

- `PR_13A_READONLY_REAL_CLI_PREFLIGHT_LOCAL_CLOSEOUT_COMPLETE`

The project now has a reviewed local taskbook, guard tests, sanitized
authorization acceptance evidence, and a local fail-closed compatibility check
for future real read-only CLI smoke authorization.

This closeout does not authorize or perform the smoke.

## 9. Next Safe Action

Next safe local action:

- continue with local-only review around PR-13A, or wait for a separate exact
  operator authorization before any real read-only CLI smoke.

The next action must not be:

- real Codex CLI invocation
- workspace-write execution
- release or tag
- push without explicit remote authorization
