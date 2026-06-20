# Controlled Execution Gate For Next Codex CLI Step

## 1. Purpose

This document designs the next controlled execution gate after the fresh real
Codex CLI read-only smoke passed on current `main`.

It is a design and local audit artifact only. It does not implement, enable, or
run workspace-write execution, general provider execution, real Codex CLI
workspace-write smoke, push, release, tag, deployment, or external service
write.

## 2. Current Evidence Base

The gate starts from these current facts:

- `docs/evidence/codex-cli-real-readonly-smoke.json` reports `status: passed`.
- The real smoke receipt uses `sandbox: read-only`.
- The real smoke receipt uses `approvalPolicy: never`.
- The real smoke receipt reports `noWorkspaceWrite: true`.
- The read-only real smoke chain audits passed on clean `main`.
- The approval consumption dispatch audit matrix passed on clean `main`.

## 3. Gate Shape

The next executable step must not be general execution. It must first be reduced
to a single bounded workspace-write real canary candidate.

Required gate properties:

- provider id: `codex-cli`
- side effect class: `workspace_write`
- sandbox: `workspace-write`
- target file: `tmp/codex-cli-write-canary.txt`
- allowed action: one bounded local canary write
- max changed files: `1`
- max diff lines: `2`
- rollback evidence: required before execution
- canary target file: absent before execution
- branch: `main`
- worktree: clean
- push / release / tag: explicitly separate and not authorized
- protected branch movement: forbidden
- secrets and raw patches: not emitted in evidence

## 4. Required Existing Local Gates

Before any future real canary execution packet can be considered, these local
checks must pass:

- `npm run governance -- audit approval-consumption-dispatch-matrix`
- `npm run governance -- audit readonly-real-smoke-chain-local-closeout`
- `npm run governance -- acceptance workspace-write-real-canary-auth`
- `npm run governance -- acceptance workspace-write-real-canary-pre-execution`
- `npm run governance -- audit workspace-write-real-canary-sensitive-scan`
- `npm run governance -- audit workspace-write-real-canary-final-local`
- `npm run governance -- audit controlled-execution-gate-design`

## 5. Explicit Future Authorization Boundary

The future execution packet, if any, must be separate from this design and must
name all of the following exact fields:

- authorization phrase: `APPROVE_PR_12B_REAL_WORKSPACE_WRITE_CANARY`
- workspace: the current `codex-router` workspace
- branch: `main`
- target file: `tmp/codex-cli-write-canary.txt`
- allowed action: one bounded local canary write
- sandbox: `workspace-write`
- rollback required: `true`
- push authorized: `false`

Any missing, broadened, or mismatched field blocks the gate.

## 6. Non-actions

This design must keep these counts at `0`:

- provider execute calls during design
- real Codex CLI calls during design
- workspace-write execute calls during design
- canary file writes during design

## 7. Result

Result:

- `CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP_RECORDED`

The next safe local step after this design is to review the gate and its audit.
It is not to run workspace-write execution.
