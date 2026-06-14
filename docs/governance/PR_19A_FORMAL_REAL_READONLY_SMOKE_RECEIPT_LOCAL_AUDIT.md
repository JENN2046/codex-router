# PR-19A Formal Real Read-only Smoke Receipt Local Audit

## 1. Scope

PR-19A adds a local audit for the default real read-only smoke receipt.

This audit reads the committed default receipt and formal preflight evidence. It
does not authorize invoking the real Codex CLI, does not authorize provider
execute, does not authorize workspace-write, does not authorize push, release,
or tag, and does not set the future execution operator flag.

## 2. Entry Point

Local audit command:

- `npm run audit:formal-real-readonly-smoke-receipt-local`
- `npm run audit:formal-real-readonly-smoke-receipt-local -- --json`

## 3. Required Inputs

The audit verifies:

- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json`
- `docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md`
- `docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md`
- `scripts/run-codex-cli-real-readonly-smoke.ts`

## 4. Required Receipt Facts

The default receipt must remain:

- schema version `codex-cli-real-readonly-smoke-gate.v1`
- mode `real-readonly-smoke`
- status `passed`
- sandbox `read-only`
- approval policy `never`
- exit code `0`
- run status `completed`
- not timed out
- not killed
- sanitized and summarized

## 5. Boundary Confirmed

This audit must keep these counts at `0`:

- provider execute calls during audit
- real Codex CLI calls during audit
- workspace-write execute calls during audit

It also confirms the PR-18 final preflight remains closed for current execution.

## 6. Result

Result:

- `PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT_RECORDED`

The default real read-only smoke receipt is now locally auditable through the
formal chain without re-running the real CLI.
