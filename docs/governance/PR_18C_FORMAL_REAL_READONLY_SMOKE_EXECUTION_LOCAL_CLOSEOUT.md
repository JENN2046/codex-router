# PR-18C Formal Real Read-only Smoke Execution Local Closeout

## 1. Scope

PR-18C closes out the local formal real read-only smoke execution authorization
chain recorded by PR-18A and PR-18B.

This closeout is local audit only. It does not authorize invoking the real Codex
CLI, does not authorize provider execute, does not authorize workspace-write,
does not authorize local command execution, does not authorize protected remote
execution, does not authorize push, release, or tag, and does not set the future
execution operator flag.

## 2. Entry Point

Local audit command:

- `npm run audit:formal-real-readonly-smoke-execution-local`
- `npm run audit:formal-real-readonly-smoke-execution-local -- --json`

## 3. Required Evidence

The closeout audit verifies:

- `docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json`
- `docs/governance/PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET.md`
- `docs/governance/PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT.md`
- `docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md`

## 4. Boundary Confirmed

The audit must keep these facts true:

- provider id: `codex-cli`
- sandbox: `read-only`
- side effect class: `read_only`
- approval policy: `never`
- evidence path choice: `default`
- provider registry selection is still required
- provider execution metadata is still required
- provider execution permit is still required
- formal dispatch boundary is still required
- current execution remains closed
- provider execute calls remain `0`
- real Codex CLI calls remain `0`
- workspace-write execute calls remain `0`

## 5. Result

Result:

- `PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT_COMPLETE`

The project now has a local closeout receipt for the formal real read-only smoke
execution preflight chain. A later task must still provide a separate exact
execution authorization before any real read-only smoke can run.
