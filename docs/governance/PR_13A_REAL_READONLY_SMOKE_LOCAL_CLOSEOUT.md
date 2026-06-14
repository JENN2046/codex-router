# PR-13A Real Read-only Smoke Local Closeout

## 1. Purpose

This document records the local closeout after the authorized PR-13A real
Codex CLI read-only smoke.

It is not a push-readiness receipt, release note, tag note, workspace-write
approval, production readiness claim, or authorization for broader real
provider execution.

## 2. Scope

Closed locally:

- PR-13A preflight taskbook
- PR-13A authorization packet compatibility check
- one authorized real Codex CLI read-only smoke
- sanitized default evidence review
- post-smoke receipt review

Default evidence path:

- `docs/evidence/codex-cli-real-readonly-smoke.json`

Related governance receipts:

- `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md`
- `docs/governance/PR_13A_READONLY_REAL_CLI_AUTHORIZATION_PACKET_COMPATIBILITY.md`
- `docs/governance/PR_13A_REAL_READONLY_SMOKE_PREFLIGHT_REVIEW.md`
- `docs/governance/PR_13A_REAL_READONLY_SMOKE_RECEIPT.md`

## 3. Observed Smoke Result

The authorized smoke receipt records:

- authorization token: `APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A`
- command shape: `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`
- evidence path choice: `default`
- evidence path: `docs/evidence/codex-cli-real-readonly-smoke.json`
- result: `PR_13A_REAL_READONLY_SMOKE_PASSED`

The committed evidence records:

- schemaVersion: `codex-cli-real-readonly-smoke-gate.v1`
- mode: `real-readonly-smoke`
- status: `passed`
- operator flag present: `true`
- runner invoked: `true`
- sandbox: `read-only`
- approval policy: `never`
- no workspace-write: `true`
- no file write: `true`
- sanitized evidence: `true`
- exit code: `0`
- run status: `completed`
- timed out: `false`
- killed: `false`

## 4. Boundary After Closeout

Still not authorized:

- workspace-write execute
- workspace-write canary write
- local command enablement
- protected remote enablement
- broad real provider execution
- push
- release
- tag
- publish

The completed smoke proves only the guarded read-only real CLI smoke path under
the exact PR-13A authorization. It does not change the default provider
execution boundary.

## 5. Required Evidence Hygiene

The default smoke evidence and the smoke receipt must remain summarized and
sanitized.

They must not include:

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

## 6. Validation

Validation for this local closeout:

- `npx tsx --test tests\pr-13a-real-readonly-smoke-local-closeout.test.ts tests\pr-13a-real-readonly-preflight-taskbook.test.ts tests\real-readonly-smoke-authorization-acceptance.test.ts`
- `npm run typecheck`
- `npm test`
- `git diff --check`

These validation commands are local-only and do not invoke the real Codex CLI.

## 7. Classification

- SCOPED_RC_READY: local-only closeout after one authorized read-only smoke
- PRODUCTION_READY: no
- REAL_EXECUTION_READY: read-only guarded smoke only
- REAL_CODEX_CLI_READY: exact PR-13A read-only smoke path exercised once
- WORKSPACE_WRITE_READY: no
- RELEASE_READY: no
- PUSH_READY: not evaluated by this closeout

## 8. Result

Result:

- `PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT_COMPLETE`

PR-13A has a local closeout for the completed authorized real read-only smoke.
The next safe work remains local-only roadmap hardening. Workspace-write and
broader real provider execution remain closed.
