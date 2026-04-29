# Codex CLI Smoke Strategy

> Date: 2026-04-28
> Scope: Phase 21.6 host smoke strategy

## Summary

`codex-router` separates smoke validation into three tiers so normal PR CI stays
deterministic while real host behavior remains explicitly validated.

| Tier | Command | Environment | Blocks PR CI | Proves |
|---|---|---|---|---|
| Contract smoke | `npm run smoke:contract` | GitHub Actions / local | Yes | SDK smoke contracts, gate behavior, telemetry, sanitized evidence |
| Local read-only host smoke | `npm run smoke:telemetry` | Developer machine with Codex CLI | No | Real Codex CLI read-only JSONL execution and telemetry |
| Local workspace-write host smoke | `npm run smoke:workspace-write:telemetry` | Developer machine with Codex CLI and explicit gates | No | Real bounded workspace-write execution after operator confirmation |

Contract smoke is not a fake pass for the real host. It is a deterministic
contract check that runs through the same `codex-cli-host` public smoke APIs with
a mock `CodexCliProcessSpawner`.

## CI Contract Smoke

CI runs:

```bash
npm run smoke:contract
```

The contract smoke covers:

- read-only smoke plan shape and execution result handling
- workspace-write preflight blocking before spawn when gates are missing
- workspace-write success path after explicit allowance and confirmation
- model probe telemetry cache miss / cache hit events
- sanitized evidence that omits raw task prompts and full argv

The generated evidence is:

```text
docs/evidence/codex-cli-contract-smoke-latest.json
```

The CI job uploads that file as `smoke-contract-evidence-*`, and the evidence
collection job downloads it alongside canary evidence before running:

```bash
npm run evidence:collect
```

## Local Real Host Smoke

Real Codex CLI smoke remains local because GitHub Actions does not provide a
logged-in Codex CLI binary.

Use `docs/codex-cli-real-host-smoke-release-checklist.md` when real host smoke
is needed for release evidence.

Read-only smoke:

```bash
npm run smoke:telemetry
```

Workspace-write smoke:

```bash
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_ALLOW_WRITE="true"
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CONFIRMATION="ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE"
npm run smoke:workspace-write:telemetry
```

Workspace-write smoke remains gated because it asks the real CLI to perform a
bounded local file edit. The target is constrained to the smoke evidence path,
and the command must not be treated as a default PR requirement.

## Boundary Rules

Contract smoke proves the SDK-side contract. It does not prove:

- real Codex CLI binary availability
- logged-in account state
- live model availability
- real file mutation by the CLI
- external service behavior
- production host behavior

Local real-host smoke proves the host boundary for the current operator machine
only. It should be cited in release notes as local evidence, not CI evidence.

## Failure Interpretation

If `smoke:contract` fails in CI, treat it as a contract regression in
`codex-cli-host`, smoke evidence generation, telemetry forwarding, or gate
semantics.

If local `smoke:*` fails while `smoke:contract` passes, first inspect host
preconditions:

- Codex CLI binary installed and reachable
- account logged in
- selected model available
- working directory is correct
- workspace-write gates are explicitly set when needed

Do not weaken CI by making real host smoke optional inside a required job. Keep
the contract smoke required and the real host smoke explicit.

## Phase 21.6 Result

Phase 21.6 adds a deterministic CI smoke layer without changing the real host
smoke contract. Ordinary PRs now validate the mock-spawner contract path, while
operators keep separate commands for real Codex CLI smoke before release or
host-sensitive changes.
