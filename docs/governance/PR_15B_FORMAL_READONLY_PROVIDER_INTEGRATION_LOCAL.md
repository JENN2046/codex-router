# PR-15B Formal Read-only Provider Integration Local

## 1. Scope

PR-15B records a local formal read-only provider integration path. The path
uses the existing runner, registry selection, read-only provider permit, provider
real-mode guard, and an injected fake spawner.

This is not a real Codex CLI invocation. It does not authorize workspace-write,
local command execution, protected remote execution, push, release, or tag.

## 2. Entry Point

Local acceptance command:

- `npm run governance -- acceptance formal-readonly-provider-integration`

Evidence:

- `docs/evidence/codex-cli-formal-readonly-provider-integration-acceptance.json`

## 3. Chain Proved

The local acceptance must prove:

- PR-15A taskbook gate accepted
- PR-14 readiness evidence still passes
- PR-14 authorization evidence still passes
- runner result is ready
- provider registry selection succeeds
- read-only provider permit is issued
- provider dispatch completes through fake spawner
- missing real-mode guard blocks before spawn
- registry manifest mismatch blocks before spawn
- write-access mutation blocks before spawn
- real Codex CLI invocation count is `0`
- workspace-write execute count is `0`
- local command execute count is `0`
- protected remote execute count is `0`
- evidence is sanitized

## 4. Boundaries Preserved

Still closed:

- real Codex CLI invocation
- workspace-write execute
- local command execute
- protected remote execute
- external side effects
- push
- release
- tag

## 5. Result

Result:

- `PR_15B_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_RECORDED`

The formal read-only provider integration now has a local fake-spawner
acceptance path. Real CLI invocation remains closed.
