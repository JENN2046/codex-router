# PR-17C Formal Real Read-only Smoke Local Closeout

## 1. Scope

PR-17C closes out the local formal real read-only smoke pre-execution chain.

This closeout does not authorize invoking the real Codex CLI, does not
authorize provider execute, does not authorize workspace-write, does not
authorize local command execution, does not authorize protected remote
execution, and does not authorize push, release, or tag.

## 2. Review Entry Points

Formal real read-only smoke taskbook:

- `docs/governance/PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK.md`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json`
- `npm run acceptance:formal-real-readonly-smoke-taskbook`

Formal real read-only smoke pre-execution:

- `docs/governance/PR_17B_FORMAL_REAL_READONLY_SMOKE_PRE_EXECUTION.md`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json`
- `npm run acceptance:formal-real-readonly-smoke-pre-execution`

Local closeout audit:

- `docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md`
- `npm run audit:formal-real-readonly-smoke-local`
- `npm run audit:formal-real-readonly-smoke-local -- --json`

## 3. Required Local Audit Result

Expected audit facts:

- audit status is `passed`
- branch is `main`
- package script targets count is `3`
- package script mismatches count is `0`
- provider id is `codex-cli`
- side effect class is `read_only`
- sandbox is `read-only`
- approval policy is `never`
- evidence path choice is `default`
- real smoke default evidence path is
  `docs/evidence/codex-cli-real-readonly-smoke.json`
- PR-17A taskbook evidence is passed
- PR-17B pre-execution evidence is passed
- blocked smoke runner calls are `0`
- provider execute calls are `0`
- real CLI calls are `0`
- workspace-write execute calls are `0`
- reasons are empty

## 4. Boundaries Preserved

Still closed:

- real Codex CLI invocation
- provider execute
- workspace-write execute
- local command execute
- protected remote execute
- external side effects
- push
- release
- tag

## 5. Evidence Hygiene

The PR-17A and PR-17B evidence files are summary-only. The local closeout audit
must not print raw prompt, raw args, raw stdout, raw stderr, raw command, raw
task envelope, raw environment, raw token, raw patch, API key markers, bearer
markers, the future execution token, or the future execution operator flag.

## 6. Result

Result:

- `PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT_COMPLETE`

The project now has a local closeout audit for the formal real read-only smoke
pre-execution chain. Real CLI invocation remains a separate future gate.
