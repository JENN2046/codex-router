# PR-13A Read-only Real CLI Preflight Taskbook

## 1. Purpose

This taskbook defines the preflight gate for a future real Codex CLI read-only
smoke.

It is not a smoke receipt. It is not an execution authorization, release note,
tag note, push-readiness receipt, workspace-write approval, or production
readiness claim.

## 2. Current Boundary

Still prohibited for this taskbook:

- real Codex CLI invocation
- provider execute outside existing fake or previously approved guarded paths
- workspace-write execute
- workspace-write canary write
- local command enablement
- protected remote enablement
- external side effects
- push, release, tag, publish

This taskbook only prepares the next gate. It does not run:

- `npm run smoke:readonly:real`
- `scripts/run-codex-cli-real-readonly-smoke.ts`
- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 ...`

## 3. Current Local Readiness Facts

Observed local surfaces already exist:

- package script: `smoke:readonly:real`
- script: `scripts/run-codex-cli-real-readonly-smoke.ts`
- test: `tests/codex-cli-real-readonly-smoke-script.test.ts`
- evidence path: `docs/evidence/codex-cli-real-readonly-smoke.json`
- fake-only dispatch acceptance: `npm run acceptance:real-readonly-dispatch`
- fake-only dispatch evidence: `docs/evidence/codex-cli-real-readonly-dispatch-acceptance.json`
- PR-10 closeout: `docs/governance/PR_10_REAL_READONLY_EXECUTE_LOCAL_CLOSEOUT.md`

The existing real smoke script is operator-gated by:

- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1`

The script blocks before invoking the runner when that flag is absent.

## 4. Required Authorization For Future Execution

A future real read-only smoke may only be run after a separate operator task
explicitly authorizes the exact action.

Required future authorization token:

- `APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A`

Required future command shape:

- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`

Allowed future execution scope:

- read-only sandbox only
- approval policy `never`
- no workspace-write
- no file writes
- no remote writes
- no release, tag, publish, or push
- evidence must remain sanitized

The future operator task must also state whether to use the default evidence
path or a one-off evidence path.

## 5. Required Fresh Preflight Before Future Execution

Before any future real read-only smoke, run and review:

- `git status --short`
- `git branch -vv`
- `git log --oneline -10`
- `npm run typecheck`
- `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts`
- `npx tsx --test tests\real-readonly-dispatch-acceptance.test.ts`
- `npx tsx --test tests\host-dispatcher.test.ts`
- `npm run acceptance:real-readonly-dispatch`

Required preflight results:

- worktree clean
- branch `main`
- local branch not behind `origin/main`
- typecheck pass
- real read-only smoke script tests pass
- fake-only real-readonly dispatch acceptance pass
- host dispatcher tests pass
- no workspace-write gate opened
- no real Codex CLI call made during preflight

## 6. Required Future Smoke Evidence Checks

After a future authorized real read-only smoke, the receipt must prove:

- `schemaVersion` is `codex-cli-real-readonly-smoke-gate.v1`
- `mode` is `real-readonly-smoke`
- `checks.operatorFlagPresent` is `true`
- `checks.runnerInvoked` is `true`
- `checks.readOnlySandbox` is `true`
- `checks.approvalPolicyNever` is `true`
- `checks.noWorkspaceWrite` is `true`
- `checks.noFileWrite` is `true`
- `checks.timeoutConfigured` is `true`
- `checks.sanitizedEvidence` is `true`
- `plan.sandbox` is `read-only`
- `plan.approvalPolicy` is `never`
- `plan.usesJson` is `true`
- `plan.skipGitRepoCheck` is `true`
- `plan.ephemeral` is `true`

The receipt must not include:

- prompt
- args
- stdout
- stderr
- raw command
- raw task envelope
- raw env
- raw token
- raw patch
- `OPENAI_API_KEY`
- `sk-`
- `Bearer`

## 7. Stop Conditions

Stop before future real CLI invocation if any of these are true:

- worktree is dirty
- branch is not `main`
- local branch is behind or diverged
- typecheck fails
- smoke script tests fail
- fake-only dispatch acceptance fails
- host dispatcher tests fail
- evidence leak search has an unexplained hit
- requested command includes workspace-write
- requested command includes release, tag, publish, push, or remote write
- authorization token is absent or not exact

Do not auto-fix these conditions as part of a real CLI smoke task unless the
operator explicitly changes the task from smoke execution to local repair.

## 8. Non-authorization

This taskbook does not authorize:

- running `npm run smoke:readonly:real`
- setting `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1`
- invoking the real Codex CLI
- opening workspace-write execute
- writing the canary target file
- pushing local commits
- creating releases or tags

## 9. Result

Result:

- `PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK_RECORDED`

The project now has an explicit local taskbook for when real read-only CLI
smoke may start. The next step remains local-only review or exact operator
authorization; workspace-write remains closed.
