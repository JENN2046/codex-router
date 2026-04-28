# Codex CLI Host Acceptance Closeout - 2026-04-25

## Scope

This closeout covers the `codex-cli-host` path for running governed Codex CLI
tasks through `runCodexCliExecPlan()` and the formal operator acceptance runner.

Workspace: `A:/codex-router`

Repository state at the time: not a Git repository. Validation is based on
executable tests, build checks, and persisted evidence artifacts.

## 2026-04-27 Follow-Up

The closeout remains the right historical record for the 2026-04-25 acceptance
work, but the CLI host line has since been extended further:

- `packages/codex-cli-host/src/index.ts` is now a façade over `index-impl.ts`.
- governance V2 lives in `packages/codex-cli-host/src/governance-v2.ts`.
- export-lock fixtures now cover the public host surface and the
  governance-v2 surface.
- release-only workspace-write acceptance wrappers were added and documented.
- `npm run build` passed on `2026-04-27`.
- `npm test` passed on `2026-04-27`, `202/202`.
- all acceptance and smoke lanes now pass live: read-only, workspace-write,
  and telemetry (miss→hit cache cycle). The previous `spawn EPERM` blocker
  is resolved — the default spawner falls back to `shell: true` when the
  native `.exe` spawn hits EPERM on Windows.

## Accepted Capabilities

- Model availability checks use the logged-in Codex CLI path by default.
- Modeled executions run a strict model probe before main execution.
- Successful model probes are cached in-process for a short TTL.
- Probe cache telemetry records `miss` and `hit`.
- Read-only smoke and gated workspace-write smoke both forward telemetry.
- `runCodexCliExecPlan()` is connected to `runCodexCliOperatorAcceptance()`.
- Operator acceptance has fixed evidence paths for read-only and workspace-write.
- Operator telemetry acceptance runs twice and requires `miss -> hit`.
- Workspace-write operator acceptance remains explicitly gated.

## Commands

Read-only operator acceptance:

```powershell
npm run operator:acceptance
```

Workspace-write operator acceptance:

```powershell
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_MODE="workspace-write"
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_ALLOW_WRITE="true"
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_CONFIRMATION="ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE"
npm run operator:acceptance
```

Read-only operator telemetry acceptance:

```powershell
npm run operator:acceptance:telemetry
```

Workspace-write operator telemetry acceptance:

```powershell
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_MODE="workspace-write"
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_ALLOW_WRITE="true"
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CONFIRMATION="ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE"
npm run operator:acceptance:telemetry
```

## Validation

Code validation:

- `npm run typecheck` passed.
- `npx tsx --test tests/codex-cli-host.test.ts` passed, `60/60`.
- `npm test` passed, `202/202`.
- `npm run build` passed.

Live acceptance (revalidated `2026-04-27`):

- `npm run operator:acceptance` passed in read-only mode.
- gated `npm run operator:acceptance` passed in workspace-write mode.
- `npm run operator:acceptance:telemetry` passed in read-only mode.
- gated `npm run operator:acceptance:telemetry` passed in workspace-write mode.
- `npm run smoke:telemetry` passed (miss→hit).
- gated `npm run smoke:workspace-write:telemetry` passed (miss→hit).

## Evidence

- `docs/evidence/codex-cli-operator-acceptance-readonly-latest.json`
- `docs/evidence/codex-cli-operator-acceptance-workspace-write-latest.json`
- `docs/evidence/codex-cli-operator-acceptance-telemetry-readonly-latest.json`
- `docs/evidence/codex-cli-operator-acceptance-telemetry-workspace-write-latest.json`

Latest telemetry results:

- read-only telemetry: first run `passed`, second run `passed`, telemetry `miss -> hit`.
- workspace-write telemetry: first run `passed`, second run `passed`, telemetry `miss -> hit`.

## Boundaries

- Workspace-write acceptance is bounded to the configured local evidence target
  and still requires explicit gate variables.
- This closeout does not claim production deployment readiness.
- This closeout does not validate live external service writes.
- Probe cache is in-process only and is cleared across host restarts.
- The project is a Git repository; branch/worktree governance is available.

## Result

The Codex CLI host governance line is accepted for local operator use. The path
from operator task envelope to guarded Codex CLI execution is implemented,
tested, built, and live-validated for read-only and gated workspace-write modes.
