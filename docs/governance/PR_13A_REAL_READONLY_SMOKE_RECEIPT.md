# PR-13A Real Read-only Smoke Receipt

## 1. Purpose

This document records the authorized PR-13A real Codex CLI read-only smoke.

It is not a workspace-write approval, release note, tag note, push-readiness
receipt, production readiness claim, or authorization for broader provider
execution.

## 2. Authorization

Operator supplied the required PR-13A authorization token:

- `APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A`

Operator supplied the required command shape:

- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`

Operator selected evidence path:

- `default`

The command was executed in PowerShell with an equivalent scoped environment
variable assignment for `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1`.

## 3. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Branch: `main`
- Pre-smoke HEAD: `ab9065d docs(governance): review real readonly smoke preflight`
- Pre-smoke worktree: clean
- Pre-smoke tracking: `origin/main: ahead 71`, no behind marker
- Mode: authorized real read-only smoke only

## 4. Fresh Preflight

Fresh preflight before the real smoke:

- `npm run typecheck`: pass
- `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts tests\real-readonly-dispatch-acceptance.test.ts tests\host-dispatcher.test.ts tests\real-readonly-smoke-authorization-acceptance.test.ts tests\pr-13a-real-readonly-preflight-taskbook.test.ts`:
  pass, `30 / 30`
- `npm run governance -- acceptance real-readonly-dispatch`: pass
- `npm run governance -- acceptance real-readonly-smoke-auth`: pass

These preflight commands did not invoke the real Codex CLI.

## 5. Executed Command

Authorized smoke command:

- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`

Observed result:

- status: `passed`
- evidence: `docs/evidence/codex-cli-real-readonly-smoke.json`

## 6. Evidence Summary

Evidence file:

- `docs/evidence/codex-cli-real-readonly-smoke.json`

Observed evidence fields:

- schemaVersion: `codex-cli-real-readonly-smoke-gate.v1`
- mode: `real-readonly-smoke`
- status: `passed`
- operatorFlagPresent: `true`
- runnerInvoked: `true`
- readOnlySandbox: `true`
- approvalPolicyNever: `true`
- noWorkspaceWrite: `true`
- noFileWrite: `true`
- timeoutConfigured: `true`
- sanitizedEvidence: `true`
- plan sandbox: `read-only`
- plan approval policy: `never`
- exitCode: `0`
- run status: `completed`
- parseErrorCount: `0`
- warningCount: `0`
- timedOut: `false`
- killed: `false`

The only tracked JSON evidence diff from the previous committed smoke evidence
was `generatedAt`.

## 7. Redaction Review

Sensitive marker search over the real smoke evidence returned no hits for:

- `prompt`
- `args`
- `stdout`
- `stderr`
- `raw command`
- `raw task envelope`
- `raw env`
- `raw token`
- `raw patch`
- `OPENAI_API_KEY`
- `sk-`
- `Bearer`
- `workspace-write`

## 8. Non-actions

Not performed:

- workspace-write execute
- workspace-write canary write
- provider execute broadening
- local command enablement
- protected remote enablement
- push
- release
- tag
- publish

## 9. Result

Result:

- `PR_13A_REAL_READONLY_SMOKE_PASSED`

The project has now completed one authorized real Codex CLI read-only smoke.
This does not authorize workspace-write, broader real provider execution, push,
release, or tag.
