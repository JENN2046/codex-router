# PR-15A Formal Read-only Provider Integration Taskbook

## 1. Scope

PR-15A is the next local gate before implementing formal read-only Codex CLI
provider integration.

This taskbook records the exact local scope that may be implemented next. It is
not an authorization to invoke the real Codex CLI, does not authorize
workspace-write, does not authorize local command execution, does not authorize
protected remote execution, and does not authorize push, release, or tag.

## 2. Exact Local Gate

Exact token:

- `APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_15A`

Exact taskbook:

- `docs/governance/PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK.md`

Required local acceptance command:

- `npm run acceptance:formal-readonly-provider-integration-taskbook`

Required evidence:

- `docs/evidence/codex-cli-formal-readonly-provider-integration-taskbook-acceptance.json`

## 3. Required Implementation Boundary

The next implementation stage must remain local-only and read-only:

- provider id: `codex-cli`
- sandbox: `read-only`
- side effect class: `read_only`
- approval policy: `never`
- registry selection is required
- provider execution permit is required
- injected spawner is required
- tests must use fake spawner only
- evidence must remain summarized and sanitized

## 4. Required Prior Evidence

PR-15A depends on the PR-14 local preflight chain:

- `docs/evidence/codex-cli-formal-readonly-integration-readiness.json`
- `docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json`
- `npm run audit:formal-readonly-integration-local`

## 5. Explicit Non-authorizations

Still closed:

- real Codex CLI invocation
- workspace-write execute
- local command execute
- protected remote execute
- external side effects
- push
- release
- tag

The implementation may add local code, tests, sanitized evidence, and local
commits only while these boundaries remain closed.

## 6. Result

Result:

- `PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK_RECORDED`

This taskbook makes the formal read-only provider integration scope auditable
without opening real CLI invocation.
