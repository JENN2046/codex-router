# Future Codex CLI Canary Execution Gate

## 1. Purpose

This document designs the final local gate that must pass before a future
bounded Codex CLI workspace-write canary can be considered.

It is a local draft/review and audit artifact only. It does not authorize, run,
or simulate provider execute, real Codex CLI workspace-write execution,
workspace-write execute, canary file write, push, release, tag, deployment, or
external service write.

## 2. Required Prior Artifacts

The future execution gate depends on:

- `docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET.md`
- `docs/evidence/workspace-write-real-canary-authorization-acceptance.json`
- `docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json`

Required local review commands before any future execution:

- `npm run governance -- audit controlled-execution-gate-design`
- `npm run governance -- audit future-codex-cli-canary-packet-checklist`
- `npm run governance -- audit future-codex-cli-canary-authorization-packet`
- `npm run governance -- audit workspace-write-real-canary-final-local`
- `npm run governance -- audit future-codex-cli-canary-execution-gate`

## 3. Exact Execution Gate Fields

The future execution gate must contain these exact fields:

- authorization phrase: `APPROVE_PR_12B_REAL_WORKSPACE_WRITE_CANARY`
- provider id: `codex-cli`
- workspace: `A:\AGENTS_OS_Workspace\governance\codex-router`
- branch: `main`
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
the future gate.

## 4. Required Fresh Execution Preconditions

A future execution task must prove these preconditions immediately before any
real canary execution:

- clean `main` worktree
- local `main` aligned with `origin/main`
- canary target file absent
- controlled execution gate audit passed
- future canary packet checklist audit passed
- future canary authorization packet audit passed
- workspace-write real canary final local audit passed
- authorization evidence remains local-only and sanitized
- pre-execution evidence remains local-only and sanitized
- rollback evidence ready
- no secrets, raw prompt, raw command, raw environment, raw patch, stdout,
  stderr, token, or canary file content in evidence

## 5. Required Stop Conditions

The future execution gate must block instead of execute when any of these are
true:

- current branch is not `main`
- local `main` is behind `origin/main`
- worktree is dirty
- canary target file already exists
- authorization packet is missing or stale
- rollback evidence is missing
- changed file limit would exceed `1`
- diff line limit would exceed `2`
- push, release, tag, deployment, or external service write is bundled
- secret-like or raw execution material would be emitted

## 6. Separate Future Execution Step

This gate does not provide or run a future execution command.

The future execution command, if introduced, must be a separate reviewed and
operator-authorized packet after this gate passes on clean `main`.

## 7. Non-actions

This execution gate design must keep these counts at `0`:

- provider execute calls during gate design
- real Codex CLI calls during gate design
- workspace-write execute calls during gate design
- canary file writes during gate design

## 8. Result

Result:

- `FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE_RECORDED`

The next safe action after this gate is local review or clean-main audit. It is
not the canary execution itself.
