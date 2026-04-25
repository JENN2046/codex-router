# Codex CLI Host Acceptance Closeout - 2026-04-25

## Scope

This closeout covers the `codex-cli-host` path for running governed Codex CLI
tasks through `runCodexCliExecPlan()` and the formal operator acceptance runner.

Workspace: `A:/codex-router`

Repository state: not a Git repository. Validation is based on executable tests,
build checks, and persisted evidence artifacts.

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
- `npx tsx --test tests/codex-cli-host.test.ts` passed, `56/56`.
- `npm test` passed, `198/198`.
- `npm run build` passed.

Live acceptance:

- `npm run operator:acceptance` passed in read-only mode.
- gated `npm run operator:acceptance` passed in workspace-write mode.
- `npm run operator:acceptance:telemetry` passed in read-only mode.
- gated `npm run operator:acceptance:telemetry` passed in workspace-write mode.

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
- The project is not a Git repository, so branch/worktree governance cannot be
  verified through Git commands in this workspace.

## Result

The Codex CLI host governance line is accepted for local operator use. The path
from operator task envelope to guarded Codex CLI execution is implemented,
tested, built, and live-validated for read-only and gated workspace-write modes.
