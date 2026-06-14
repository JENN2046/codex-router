# PR-15C Formal Read-only Provider Integration Local Closeout

## 1. Scope

PR-15C closes out the local formal read-only provider integration chain created
by PR-15A and PR-15B.

This closeout is a local review entry point. It does not authorize real Codex
CLI invocation, does not authorize workspace-write, does not authorize local
command execution, does not authorize protected remote execution, and does not
authorize push, release, or tag.

## 2. Review Entry Points

Taskbook gate:

- `docs/governance/PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK.md`
- `docs/evidence/codex-cli-formal-readonly-provider-integration-taskbook-acceptance.json`
- `npm run acceptance:formal-readonly-provider-integration-taskbook`

Formal local integration:

- `docs/governance/PR_15B_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL.md`
- `docs/evidence/codex-cli-formal-readonly-provider-integration-acceptance.json`
- `npm run acceptance:formal-readonly-provider-integration`

Local closeout audit:

- `docs/governance/PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT.md`
- `npm run audit:formal-readonly-provider-integration-local`
- `npm run audit:formal-readonly-provider-integration-local -- --json`

## 3. Required Local Audit Result

Expected audit facts:

- audit status is `passed`
- branch is `main`
- package script targets count is `3`
- package script mismatches count is `0`
- provider id is `codex-cli`
- side effect class is `read_only`
- sandbox is `read-only`
- dispatch status is `completed`
- formal provider dispatch calls are `1`
- fake spawner calls are `1`
- real CLI calls are `0`
- workspace-write execute calls are `0`
- local command execute calls are `0`
- protected remote execute calls are `0`
- reasons are empty

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

## 5. Evidence Hygiene

The PR-15A and PR-15B evidence files are summary-only. The local closeout audit
must not print raw prompt, raw args, raw stdout, raw stderr, raw command, raw
task envelope, raw environment, raw token, raw patch, API key markers, bearer
markers, or exact authorization packet contents.

## 6. Result

Result:

- `PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE`

The project now has a local fake-spawner formal read-only provider integration
closeout audit. Real CLI invocation remains closed.
