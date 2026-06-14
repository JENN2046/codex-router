# PR-17B Formal Real Read-only Smoke Pre-execution

## 1. Scope

PR-17B records a local pre-execution receipt for the formal real Codex CLI
read-only smoke path.

This is not the real smoke execution. It does not authorize invoking the real
Codex CLI, does not authorize provider execute, does not authorize
workspace-write, does not authorize local command execution, does not authorize
protected remote execution, and does not authorize push, release, or tag.

## 2. Entry Point

Local acceptance command:

- `npm run acceptance:formal-real-readonly-smoke-pre-execution`

Evidence:

- `docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json`

## 3. Required Proof

The local pre-execution acceptance must prove:

- PR-17A taskbook gate is accepted
- PR-17A taskbook evidence is present
- real read-only smoke script default evidence path is
  `docs/evidence/codex-cli-real-readonly-smoke.json`
- real read-only smoke script blocks without the operator flag
- blocked smoke path does not invoke the runner
- blocked smoke evidence remains sanitized
- exact future command remains required
- default future evidence path choice remains required
- formal dispatch boundary remains required
- provider execute remains separate
- real Codex CLI calls are `0`
- workspace-write execute calls are `0`

## 4. Future Execution Boundary

A future PR may run the real read-only smoke only after separate execution
authorization. That separate authorization must preserve:

- provider id: `codex-cli`
- sandbox: `read-only`
- side effect class: `read_only`
- approval policy: `never`
- evidence path choice: `default`
- provider registry selection
- provider execution metadata
- provider execution permit
- formal dispatch boundary

## 5. Non-authorization

This receipt does not authorize:

- setting `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1`
- running `npm run smoke:readonly:real`
- invoking the real Codex CLI
- provider execute
- workspace-write execute
- local command execute
- protected remote execute
- pushing local commits
- creating releases or tags

## 6. Result

Result:

- `PR_17B_FORMAL_REAL_READONLY_SMOKE_PRE_EXECUTION_RECORDED`

The project now has a local pre-execution receipt for the formal real read-only
smoke path while real CLI invocation remains a separate gate.
