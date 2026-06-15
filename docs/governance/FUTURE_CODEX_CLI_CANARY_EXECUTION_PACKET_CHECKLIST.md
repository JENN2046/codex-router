# Future Codex CLI Canary Execution Packet Checklist

## 1. Purpose

This checklist defines the exact local review requirements for a future Codex
CLI workspace-write canary execution packet.

It is a checklist and local audit artifact only. It does not authorize, run, or
simulate provider execute, real Codex CLI workspace-write execution,
workspace-write execute, canary file write, push, release, tag, deployment, or
external service write.

## 2. Required Prior Evidence

The future packet may only be reviewed after these current artifacts exist and
remain valid:

- `docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md`
- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `docs/evidence/workspace-write-real-canary-authorization-acceptance.json`
- `docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json`

Required local audit commands:

- `npm run audit:controlled-execution-gate-design`
- `npm run audit:readonly-real-smoke-chain-local-closeout`
- `npm run audit:workspace-write-real-canary-final-local`
- `npm run audit:future-codex-cli-canary-packet-checklist`

## 3. Exact Future Packet Fields

A future execution packet must name all of these fields exactly:

- authorization phrase: `APPROVE_PR_12B_REAL_WORKSPACE_WRITE_CANARY`
- provider id: `codex-cli`
- workspace: current `codex-router` workspace
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

Any missing, broadened, mismatched, or bundled field blocks the packet.

## 4. Required Pre-execution Invariants

The future packet must prove before execution:

- clean `main` worktree
- local branch is not behind `origin/main`
- controlled execution gate audit passed
- read-only real smoke chain local closeout passed
- workspace-write real canary final local audit passed
- PR-12B authorization evidence remains local-only and sanitized
- PR-12B pre-execution evidence remains local-only and sanitized
- canary target file does not already exist
- rollback evidence is ready
- evidence does not include raw prompt, raw command, raw environment, raw patch,
  stdout, stderr, tokens, or secret-like values

## 5. Non-actions

This checklist must keep these counts at `0`:

- provider execute calls during checklist
- real Codex CLI calls during checklist
- workspace-write execute calls during checklist
- canary file writes during checklist

## 6. Result

Result:

- `FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST_RECORDED`

The next safe action after this checklist is local packet review or another
pre-execution audit. It is not the canary execution itself.
