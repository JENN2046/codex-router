# Codex CLI Real Host Smoke Release Checklist

> Scope: release-time local smoke for the real Codex CLI host
> Status: operator-gated; not a normal CI requirement

## Purpose

Use this checklist when a release, PR, or host-sensitive change needs evidence
from a real installed Codex CLI binary. This is separate from CI
`smoke:contract`, which validates SDK contracts with a mock
`CodexCliProcessSpawner`.

Real host smoke validates the local operator boundary:

- Codex CLI binary is installed and reachable.
- The operator account is logged in.
- The selected model can run through the CLI.
- JSONL output is emitted and parsed by `codex-cli-host`.
- Telemetry cache miss / hit events are captured.
- Workspace-write smoke performs only the bounded local write after explicit
  operator gates.

## When To Run

Run read-only real host smoke before release when any of these changed:

- `packages/codex-cli-host`
- Codex CLI execution planning, model probing, telemetry, or evidence writing
- CI smoke strategy or evidence collection
- Host integration paths that depend on real Codex CLI behavior

Run workspace-write real host smoke only when the change affects:

- workspace-write sandbox planning
- write-sandbox gates or confirmations
- evidence paths for bounded file writes
- host behavior that claims real local edit capability

Do not run workspace-write smoke just to satisfy routine docs-only changes.

## Preflight

Confirm repository state:

```powershell
git branch --show-current
git status --short
git log --oneline --decorate -n 5
```

Confirm project validation is already green:

```powershell
npm run typecheck
npm test
npm run build
npm run smoke:contract
```

Confirm the real CLI is available:

```powershell
codex --version
```

Stop before running real host smoke if:

- the worktree has unrelated edits
- `.env`, `config.env`, credentials, or tokens are modified
- the target branch is wrong
- the Codex CLI is not installed or not logged in
- the operator cannot explain the intended evidence paths

## Read-Only Smoke

Command:

```powershell
npm run smoke:telemetry
```

Optional scoped environment:

```powershell
$env:CODEX_CLI_SMOKE_TELEMETRY_MODEL="gpt-5.4-mini"
$env:CODEX_CLI_SMOKE_TELEMETRY_CWD=(Get-Location).Path
$env:CODEX_CLI_SMOKE_TELEMETRY_EVIDENCE_PATH="docs/evidence/codex-cli-readonly-smoke-telemetry-latest.json"
npm run smoke:telemetry
```

Expected evidence:

```text
docs/evidence/codex-cli-readonly-smoke-telemetry-latest.json
```

Pass criteria:

- first run status is `passed`
- second run status is `passed`
- telemetry includes `codex cli model probe cache miss`
- telemetry includes `codex cli model probe cache hit`
- no raw task prompt or full argv is present in evidence
- no file edits other than intended evidence refreshes

## Workspace-Write Smoke

This smoke is gated because it asks the real Codex CLI to perform a bounded
local edit. Run it only after read-only smoke passes.

Required gates:

```powershell
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_ALLOW_WRITE="true"
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CONFIRMATION="ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE"
```

Command:

```powershell
npm run smoke:workspace-write:telemetry
```

Optional scoped environment:

```powershell
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_MODEL="gpt-5.4-mini"
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CWD=(Get-Location).Path
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_EVIDENCE_PATH="docs/evidence/codex-cli-workspace-write-smoke-telemetry-latest.json"
npm run smoke:workspace-write:telemetry
```

Expected evidence:

```text
docs/evidence/codex-cli-workspace-write-smoke-telemetry-latest.json
docs/evidence/codex-cli-workspace-write-smoke.txt
```

Pass criteria:

- first run status is `passed`
- second run status is `passed`
- workspace-write preflight is ready only after both explicit gates
- telemetry includes cache miss and cache hit events
- the only content edit is the bounded smoke evidence file
- no env files, secrets, branch movement, release actions, or external writes
  are requested or performed

## Evidence Refresh

After real host smoke:

```powershell
npm run evidence:collect
git status --short
git diff --stat
git diff --check
```

Review the refreshed files before committing:

```powershell
git diff -- docs/evidence/codex-cli-readonly-smoke-telemetry-latest.json
git diff -- docs/evidence/codex-cli-workspace-write-smoke-telemetry-latest.json
git diff -- docs/evidence/codex-cli-workspace-write-smoke.txt
git diff -- docs/evidence/manifest-latest.json
```

If workspace-write smoke ran, the bounded target file diff is mandatory review
material, not incidental evidence.

Only commit evidence when it is intentional release evidence. Otherwise archive
it outside the repository or leave it as CI/local artifact.

## Failure Triage

If read-only smoke fails:

- confirm `codex --version`
- confirm logged-in CLI state
- confirm selected model availability
- inspect blocking reasons in the evidence JSON
- do not proceed to workspace-write smoke

If workspace-write smoke fails:

- confirm both workspace-write env gates are set exactly
- inspect preflight blockers
- confirm no unexpected files changed
- revert only the bounded smoke evidence file if needed
- do not retry with broader sandbox or approval settings

## Stop Conditions

Stop and report instead of continuing if:

- evidence contains raw prompt text, full argv, secrets, or credentials
- any file outside the expected evidence paths changes
- Codex CLI attempts external writes or release actions
- the command requires broader sandbox permissions than planned
- the same smoke fails twice with the same blocker
- governance emits step-back, abort, or arbitration-required signals

## Release Sign-Off

Use this summary in PR or release notes:

```text
Real Codex CLI host smoke:
- Read-only smoke: passed / not run
- Workspace-write smoke: passed / not run
- Evidence paths:
- Model:
- CLI version:
- Operator:
- Notable blockers:
- Not validated:
```

Never claim real host smoke passed unless the real Codex CLI binary was invoked
and the evidence was inspected.
