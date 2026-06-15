# Future Codex CLI Canary Execution Authorization Packet

## 1. Purpose

This document drafts the exact authorization packet shape for a future bounded
Codex CLI workspace-write canary.

It is a local draft/review artifact only. It does not authorize, run, or
simulate provider execute, real Codex CLI workspace-write execution,
workspace-write execute, canary file write, push, release, tag, deployment, or
external service write.

## 2. Required Prior Review

The packet draft depends on:

- `docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md`
- `docs/evidence/workspace-write-real-canary-authorization-acceptance.json`
- `docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json`

Required local review commands before any future execution:

- `npm run audit:controlled-execution-gate-design`
- `npm run audit:future-codex-cli-canary-packet-checklist`
- `npm run audit:workspace-write-real-canary-final-local`
- `npm run audit:future-codex-cli-canary-authorization-packet`

## 3. Exact Future Authorization Packet

The future operator authorization packet must contain these exact fields:

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

Any missing, broadened, mismatched, bundled, or stale field blocks the future
packet.

## 4. Required Fresh Preflight Before Execution

A future execution task must rerun fresh preflight immediately before any real
canary execution:

- clean `main` worktree
- local `main` not behind `origin/main`
- canary target file absent
- controlled execution gate audit passed
- future canary packet checklist audit passed
- workspace-write real canary final local audit passed
- authorization evidence remains local-only and sanitized
- pre-execution evidence remains local-only and sanitized
- rollback evidence ready
- no secrets, raw prompt, raw command, raw environment, raw patch, stdout,
  stderr, token, or canary file content in evidence

## 5. Separate Future Execution Command

This draft does not provide or run a future execution command.

The future execution command, if introduced, must be a separate reviewed packet
and must not reuse this draft as executable permission.

## 6. Non-actions

This authorization packet draft must keep these counts at `0`:

- provider execute calls during draft
- real Codex CLI calls during draft
- workspace-write execute calls during draft
- canary file writes during draft

## 7. Result

Result:

- `FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET_DRAFTED`

The next safe action after this draft is local authorization packet review. It
is not the canary execution itself.
