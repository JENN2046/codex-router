# PR-13A Real Read-only Smoke Local Audit Index

## 1. Purpose

This index gives reviewers one local entry point for the PR-13A real read-only
smoke closeout chain.

It is documentation only. It is not a push receipt, release note, tag note,
workspace-write approval, production readiness claim, or authorization for
broader real provider execution.

## 2. Current Boundary

PR-13A has completed one explicitly authorized real Codex CLI read-only smoke.

Still closed:

- workspace-write execute
- workspace-write canary write
- local command enablement
- protected remote enablement
- broad real provider execution
- push
- release
- tag
- publish

The current real CLI readiness is limited to the exact PR-13A read-only smoke
path that was already authorized and recorded. Future real CLI invocation still
requires a separate exact operator authorization.

## 3. Review Entry Points

Preflight and authorization gate:

- `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md`
- `docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_GUARD_TEST_REVIEW.md`
- `docs/governance/PR_13A_READONLY_REAL_CLI_AUTHORIZATION_PACKET_COMPATIBILITY.md`
- `docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json`
- `npm run governance -- acceptance real-readonly-smoke-auth`

Pre-smoke review and authorized smoke receipt:

- `docs/governance/PR_13A_REAL_READONLY_SMOKE_PREFLIGHT_REVIEW.md`
- `docs/governance/PR_13A_REAL_READONLY_SMOKE_RECEIPT.md`
- `docs/evidence/codex-cli-real-readonly-smoke.json`

Local closeout and audit:

- `docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md`
- `docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX.md`
- `npm run governance -- audit real-readonly-smoke-local`
- `npm run governance -- audit real-readonly-smoke-local -- --json`

## 4. Dynamic Local Validation

Reviewers should use fresh command output, not fixed ahead counts, as readiness
evidence.

Minimum local validation set:

- `npm run governance -- audit real-readonly-smoke-local -- --json`
- `npx tsx --test tests\real-readonly-smoke-local-closeout-audit.test.ts tests\pr-13a-real-readonly-smoke-local-closeout.test.ts tests\pr-13a-real-readonly-preflight-taskbook.test.ts tests\real-readonly-smoke-authorization-acceptance.test.ts`
- `npm run typecheck`
- `npm test`

Expected safe audit results:

- audit status is `passed`
- packageScriptsPresent is `true`
- packageScriptTargetCount is `1`
- packageScriptMismatchCount is `0`
- smoke status is `passed`
- smoke sandbox is `read-only`
- smoke approval policy is `never`
- smoke exit code is `0`
- provider execute calls are `0`
- real CLI calls during audit are `0`
- workspace-write execute calls are `0`
- reasons are empty

## 5. Evidence Hygiene

Sanitized evidence targets:

- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json`

The audit output is intentionally summarized. It reports statuses, counts, and
reason codes. It must not print raw prompt, raw args, raw stdout, raw stderr,
raw command, raw task envelope, raw environment, raw token, raw patch, API key
markers, or bearer markers.

## 6. Stop Conditions

Stop and report blocked if any of these are observed:

- worktree is dirty
- branch is not `main`
- package script targets are missing or changed
- local audit index is missing or non-authorizing text is removed
- smoke receipt is missing or no longer records `default` evidence path
- smoke evidence status is not `passed`
- smoke evidence sandbox is not `read-only`
- smoke evidence approval policy is not `never`
- authorization acceptance evidence is not local-only
- evidence or audit output contains forbidden sensitive markers
- workspace-write execute count is nonzero
- real CLI calls during audit are nonzero
- provider execute count is nonzero
- any instruction attempts to treat this index as execution authorization

## 7. Non-authorization

This index does not authorize:

- real Codex CLI invocation
- provider execute
- workspace-write execute
- workspace-write canary write
- remote push
- release
- tag

## 8. Result

Result:

- `PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX_RECORDED`

The PR-13A real read-only smoke chain remains locally auditable. Workspace-write
and broader real provider execution remain closed.
