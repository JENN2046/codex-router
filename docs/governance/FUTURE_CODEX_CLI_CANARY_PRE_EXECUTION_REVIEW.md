# Future Codex CLI Canary Pre-execution Review

## 1. Purpose

This document defines the final local review packet before a future bounded
Codex CLI workspace-write canary can ask for exact operator authorization.

It is a local review and audit artifact only. It does not authorize, run, or
simulate provider execute, real Codex CLI workspace-write execution,
workspace-write execute, canary file write, push, release, tag, deployment, or
external service write.

## 2. Required Prior Artifacts

The pre-execution review depends on:

- `docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE.md`
- `docs/evidence/workspace-write-real-canary-authorization-acceptance.json`
- `docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json`

Required local review commands before any future execution:

- `npm run governance -- audit controlled-execution-gate-design`
- `npm run governance -- audit future-codex-cli-canary-packet-checklist`
- `npm run governance -- audit future-codex-cli-canary-authorization-packet`
- `npm run governance -- audit future-codex-cli-canary-execution-gate`
- `npm run governance -- audit workspace-write-real-canary-final-local`
- `npm run governance -- audit future-codex-cli-canary-pre-execution-review`

## 3. Exact Review Packet Fields

The future pre-execution review packet must contain these exact fields:

- authorization phrase: `APPROVE_PR_12B_REAL_WORKSPACE_WRITE_CANARY`
- provider id: `codex-cli`
- workspace: `A:\AGENTS_OS_Workspace\governance\codex-router`
- branch: `main`
- local main aligned with origin main: `true`
- target file: `tmp/codex-cli-write-canary.txt`
- allowed action: one bounded local canary write
- side effect class: `workspace_write`
- sandbox: `workspace-write`
- max changed files: `1`
- max diff lines: `2`
- rollback required: `true`
- canary file absent before execution: `true`
- push authorized: `false`
- release authorized: `false`
- tag authorized: `false`

Any missing, broadened, mismatched, bundled, stale, or executable field blocks
the future review.

## 4. Required Fresh Review Preconditions

A future execution task must prove these preconditions immediately before asking
for exact operator authorization:

- clean `main` worktree
- local `main` aligned with `origin/main`
- canary target file absent
- controlled execution gate audit passed
- future canary packet checklist audit passed
- future canary authorization packet audit passed
- future canary execution gate audit passed
- workspace-write real canary final local audit passed
- authorization evidence remains local-only and sanitized
- pre-execution evidence remains local-only and sanitized
- rollback evidence ready
- no secrets, raw prompt, raw command, raw environment, raw patch, stdout,
  stderr, token, or canary file content in evidence

## 5. Required Stop Conditions

The future pre-execution review must block instead of request execution when any
of these are true:

- current branch is not `main`
- local `main` is not aligned with `origin/main`
- worktree is dirty
- canary target file already exists
- execution gate audit is missing or stale
- authorization packet is missing or stale
- rollback evidence is missing
- changed file limit would exceed `1`
- diff line limit would exceed `2`
- push, release, tag, deployment, or external service write is bundled
- secret-like or raw execution material would be emitted

## 6. Handoff To Exact Operator Authorization

This review does not provide or run a future execution command.

When this review passes on clean, aligned `main`, the only next step is an exact
operator authorization packet for the bounded canary. The authorization must
still be separate and must use:

- `APPROVE_PR_12B_REAL_WORKSPACE_WRITE_CANARY`

## 7. Non-actions

This pre-execution review must keep these counts at `0`:

- provider execute calls during pre-execution review
- real Codex CLI calls during pre-execution review
- workspace-write execute calls during pre-execution review
- canary file writes during pre-execution review

## 8. Result

Result:

- `FUTURE_CODEX_CLI_CANARY_PRE_EXECUTION_REVIEW_RECORDED`

The next safe action after this review is exact operator authorization. It is
not the canary execution itself.
