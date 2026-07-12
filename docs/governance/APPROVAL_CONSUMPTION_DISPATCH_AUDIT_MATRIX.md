# Approval Consumption Dispatch Audit Matrix

## 1. Scope

This matrix records a local-only review gate for the next safe Agent OS slice:
approval consumption, provider dispatch preconditions, and sanitized audit
surfaces.

It does not authorize real provider execution, real Codex CLI invocation,
workspace-write execution, local command execution, push, release, tag, or any
external service write.

## 2. Entry Point

Local matrix audit:

- `npm run governance -- audit approval-consumption-dispatch-matrix`
- `npm run governance -- audit approval-consumption-dispatch-matrix -- --json`

## 3. Matrix Rows

The matrix verifies these local evidence rows:

- Approval consumption hardening closeout:
  `APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT_COMPLETE`
- Approval issuance and fail-closed consumption tests:
  `tests/approval-permit.test.ts`,
  `tests/execution-eligibility.test.ts`,
  `tests/agent-os-mcp-local-runtime.test.ts`,
  `tests/agent-os-sdk.test.ts`,
  `tests/agent-os-cli.test.ts`,
  `tests/agent-os-app-server.test.ts`
- Provider dispatch precondition tests:
  `tests/host-dispatcher.test.ts`
- Sanitized audit surface tests:
  `tests/redaction.test.ts`,
  `tests/jsonl-event-log.test.ts`,
  `tests/artifact-store.test.ts`,
  `tests/tool-invocation-planner.test.ts`,
  `tests/workspace-write-guard.test.ts`

## 4. Required Matrix Facts

The matrix must prove:

- worktree is clean
- branch is `main`
- local branch is not behind `origin/main`
- package script for this matrix is present
- approval consumption closeout is recorded
- public wrapper approval attempts stay waiting when a capability grant is
  missing, even if a valid approval permit exists
- approval permits can satisfy approval only after capability grants already
  satisfy the requested scope; permits never expand capability
- provider dispatch rejects workspace-write before spawn
- invalid runner results are blocked before provider dispatch
- audit/event/artifact/tool/result/workspace-write surfaces are redacted
- read-only evidence remains separated from workspace-write and real execution

## 5. Non-actions

The matrix audit must keep these counts at `0`:

- provider execute calls during matrix
- real Codex CLI calls during matrix
- workspace-write execute calls during matrix

## 6. Result

Result:

- `APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX_RECORDED`

This matrix is a local review artifact. It prepares the project for a later
fresh read-only Codex CLI smoke preflight, but it does not run the real CLI.
