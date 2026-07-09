# PR-13A Read-only Real CLI Preflight Guard Test Review

## 1. Purpose

This document records the local-only review of the PR-13A guard tests that lock
the future real Codex CLI read-only smoke boundary.

It is not a real smoke receipt. It is not an execution authorization,
push-readiness receipt, release note, tag note, workspace-write approval, or
production readiness claim.

## 2. Scope

Reviewed local commits:

- `0bd8f51 test(governance): lock real readonly preflight taskbook`
- `0270ce6 test(governance): lock real readonly smoke evidence`

Reviewed file:

- `tests/pr-13a-real-readonly-preflight-taskbook.test.ts`

Covered governance artifacts:

- `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md`
- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `package.json`

## 3. Boundary Confirmed

The guard tests confirm that the PR-13A taskbook still records:

- exact future authorization token:
  `APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A`
- exact future command shape:
  `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`
- `smoke:readonly:real` script still points to
  `node --import tsx scripts/run-codex-cli-real-readonly-smoke.ts`
- taskbook remains non-authorizing
- future smoke remains read-only only
- approval policy remains `never`
- workspace-write, file writes, remote writes, release, tag, and push remain
  outside this local review

The guard tests also confirm that the committed real read-only smoke evidence
retains:

- schema `codex-cli-real-readonly-smoke-gate.v1`
- mode `real-readonly-smoke`
- read-only sandbox
- approval policy `never`
- no workspace-write
- no file-write
- timeout configured
- sanitized evidence flag
- summary counters only for run output

## 4. Redaction Review

The committed evidence contract rejects these raw or sensitive markers:

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

The taskbook may name these strings as policy labels, but the evidence file must
not contain them.

## 5. Validation

Validation observed after the guard tests:

- `npx tsx --test tests\pr-13a-real-readonly-preflight-taskbook.test.ts`:
  pass, `4 / 4`
- `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts tests\real-readonly-dispatch-acceptance.test.ts tests\host-dispatcher.test.ts tests\pr-13a-real-readonly-preflight-taskbook.test.ts`:
  pass, `25 / 25`
- `npm run typecheck`: pass
- `npm test`: pass, `895 / 895`
- `git diff --check`: pass

This review did not run:

- `npm run smoke:readonly:real`
- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 ...`
- real Codex CLI
- workspace-write execute
- release, tag, or push

## 6. Current Classification

- SCOPED_RC_READY: local guard tests recorded
- PRODUCTION_READY: no
- REAL_EXECUTION_READY: read-only guarded, separate authorization required
- REAL_CODEX_CLI_READY: preflight and evidence contracts locked locally
- WORKSPACE_WRITE_READY: no
- RELEASE_READY: no
- PUSH_READY: not evaluated by this review

## 7. Result

Result:

- `PR_13A_READONLY_REAL_CLI_PREFLIGHT_GUARD_TEST_REVIEW_COMPLETE`

PR-13A now has local tests that fail if the future real read-only CLI smoke
authorization boundary, command shape, evidence schema, read-only checks, or
evidence redaction contract drift.

This review does not authorize or perform the real smoke. A future real CLI
smoke still requires a separate exact operator authorization.
