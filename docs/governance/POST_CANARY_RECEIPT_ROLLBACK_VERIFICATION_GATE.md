# Post-canary Receipt And Rollback Verification Gate

## 1. Purpose

This document records the first post-canary receipt and rollback verification
gate after one bounded real Codex CLI workspace-write canary passed on current
`main`.

It is a local review and audit artifact only. It does not authorize, run, or
simulate provider execute, real Codex CLI execution, workspace-write execution,
canary file write, push, release, tag, deployment, or external service write.

## 2. Required Evidence

The gate depends on:

- `docs/evidence/codex-cli-workspace-write-real-canary-latest.json`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_PRE_EXECUTION_REVIEW.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE.md`
- `PROJECT_CONTINUE_ANCHOR.md`
- `.agent_board/RUN_STATE.md`
- `.agent_board/HANDOFF.md`

Required local audit command:

- `npm run governance -- audit post-canary-receipt-rollback-gate`

## 3. Required Receipt Fields

The receipt must preserve these exact facts:

- evidence path: `docs/evidence/codex-cli-workspace-write-real-canary-latest.json`
- evidence status: `passed`
- target file: `tmp/codex-cli-write-canary.txt`
- sandbox: `workspace-write`
- approval policy: `on-request`
- execution status: `completed`
- exit code: `0`
- parse error count: `0`
- blocking reasons: `[]`
- rollback verification: canary file absent
- push authorized: `false`
- release authorized: `false`
- tag authorized: `false`
- deployment authorized: `false`
- general provider execution authorized: `false`
- general workspace-write authorized: `false`

Any missing, broadened, stale, or executable field blocks the receipt gate.

## 4. Rollback Verification

Rollback verification for this canary is intentionally narrow:

- the only expected canary target is `tmp/codex-cli-write-canary.txt`
- the post-canary target file must be absent
- the evidence must remain committed under `docs/evidence/`
- the receipt must not include raw prompt, raw command, raw environment, raw
  patch, stdout, stderr, token, or secret-like values

The rollback check proves cleanup of the temporary canary target only. It does
not prove general rollback for arbitrary workspace-write execution.

## 5. Stop Conditions

The gate must block when any of these are true:

- current branch is not `main`
- local `main` is not aligned with `origin/main`
- worktree is dirty
- canary target file exists
- evidence file is missing
- evidence status is not `passed`
- evidence target file is not `tmp/codex-cli-write-canary.txt`
- evidence sandbox is not `workspace-write`
- evidence approval policy is not `on-request`
- evidence execution status is not `completed`
- evidence exit code is not `0`
- evidence parse error count is not `0`
- evidence blocking reasons are not `[]`
- receipt text authorizes push, release, tag, deployment, general provider
  execution, or general workspace-write
- receipt or evidence emits raw execution material or secret-like markers

## 6. Non-actions

This gate must keep these counts at `0`:

- provider execute calls during receipt review
- real Codex CLI calls during receipt review
- workspace-write execute calls during receipt review
- canary file writes during receipt review
- additional canary runs during receipt review

## 7. Result

Result:

- `POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE_RECORDED`

The next safe action after this gate is to review and merge the receipt. It is
not to run another workspace-write canary.
