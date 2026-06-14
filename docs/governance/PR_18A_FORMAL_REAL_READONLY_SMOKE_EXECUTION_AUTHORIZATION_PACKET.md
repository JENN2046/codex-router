# PR-18A Formal Real Read-only Smoke Execution Authorization Packet

## 1. Scope

PR-18A records the exact authorization packet for a future formal real Codex
CLI read-only smoke execution.

This PR records the packet and acceptance evidence only. It does not execute the
real Codex CLI, does not authorize this PR to run provider execute, does not
authorize workspace-write, does not authorize local command execution, does not
authorize protected remote execution, and does not authorize push, release, or
tag.

## 2. Exact Future Execution Packet

Exact token:

- `APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A`

Exact packet:

- `docs/governance/PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET.md`

Exact future command shape:

- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`

Required local acceptance command:

- `npm run acceptance:formal-real-readonly-smoke-execution-auth`

Required acceptance evidence:

- `docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json`

Required future evidence path choice:

- `default`

## 3. Required Prior Evidence

The future execution packet depends on the PR-17 local chain:

- `docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json`
- `docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md`
- `npm run audit:formal-real-readonly-smoke-local`

## 4. Required Execution Boundary

The future real read-only smoke may only proceed under these boundaries:

- provider id: `codex-cli`
- sandbox: `read-only`
- side effect class: `read_only`
- approval policy: `never`
- evidence path choice: `default`
- operator flag is required for the future execution
- provider registry selection is required
- provider execution metadata is required
- provider execution permit is required
- formal dispatch boundary is required
- fresh local preflight is required

## 5. Current Non-execution Boundary

PR-18A itself must keep these calls at `0`:

- provider execute calls
- real Codex CLI calls
- workspace-write execute calls

Immediate execution remains blocked in PR-18A. A later task must separately
authorize and run the command after fresh preflight.

## 6. Result

Result:

- `PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET_RECORDED`

The project now has an auditable execution authorization packet for the next
formal real read-only smoke step. Real CLI invocation remains unrun here.
