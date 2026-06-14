# PR-14B Formal Read-only CLI Integration Authorization Packet

## 1. Purpose

PR-14B records the exact local authorization packet shape for a later formal
real read-only Codex CLI provider integration task.

This document is not an authorization to execute the provider, invoke a real
Codex CLI process, open workspace-write, push, release, or tag.

## 2. Exact Future Packet

A future PR-14 formal integration implementation task is compatible only when
the operator packet exactly preserves these facts:

- authorization token: `APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_14B`
- command: `npm run acceptance:formal-readonly-integration`
- provider: `codex-cli`
- sandbox: `read-only`
- side effect class: `read_only`
- approval policy: `never`
- readiness evidence path: `docs/evidence/codex-cli-formal-readonly-integration-readiness.json`
- injected spawner remains required
- approved provider execution permit remains required
- provider registry selection remains required
- real execution allowance may be declared only for the later formal integration task

## 3. Explicit Non-authorization

This packet does not authorize:

- `provider.execute()`
- real Codex CLI invocation
- `smoke:readonly:real`
- workspace-write execute
- local command execute
- protected remote execute
- external side effects
- push
- release
- tag

Provider execution and real CLI invocation must remain separate future gates.

## 4. Local Acceptance

Local acceptance command:

- `npm run acceptance:formal-readonly-integration-auth`

Expected evidence:

- `docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json`

The evidence must be summary-only. It must not include the raw token, raw
command, raw prompt, raw args, raw stdout, raw stderr, raw task envelope, raw
environment, raw token, raw patch, API key markers, or bearer markers.

## 5. Result

Result:

- `PR_14B_FORMAL_READONLY_CLI_INTEGRATION_AUTHORIZATION_PACKET_RECORDED`

PR-14B makes the future formal read-only integration authorization packet
auditable. It still does not authorize or execute real provider execution.
