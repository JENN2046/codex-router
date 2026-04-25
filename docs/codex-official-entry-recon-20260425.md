# Codex Official Entry Recon (2026-04-25)

## Scope

This note records the official-entry reconnaissance after the final Codex
Desktop app source gate remained blocked.

The goal is to find a supported, editable, or programmable OpenAI Codex entry
instead of modifying the Microsoft Store packaged Codex app.

## Official Findings

OpenAI's current Codex docs identify multiple supported surfaces:

- Codex app
- Codex CLI
- Codex IDE extension
- Codex web
- plugins
- Codex SDK
- Codex App Server
- Codex MCP Server

Official docs also identify the open-source components:

- Codex CLI
- Codex SDK
- Codex App Server
- Skills
- Universal cloud environment

The same Open Source page states that the IDE extension and Codex web are not
open source.

References:

- `https://developers.openai.com/codex/app`
- `https://developers.openai.com/codex/app/windows`
- `https://developers.openai.com/codex/plugins`
- `https://developers.openai.com/codex/plugins/build`
- `https://developers.openai.com/codex/sdk`
- `https://developers.openai.com/codex/open-source`
- `https://help.openai.com/en/articles/11369540-codex-in-chatgpt`

## Local Findings

The local machine has Codex CLI installed:

- command: `codex`
- version: `codex-cli 0.125.0`
- npm shim: `C:/Users/617/AppData/Roaming/npm/codex.ps1`
- package: `C:/Users/617/AppData/Roaming/npm/node_modules/@openai/codex`
- package version: `0.125.0`
- package repository: `https://github.com/openai/codex.git`
- package directory: `codex-cli`
- license: `Apache-2.0`

`codex --help` exposes these relevant local surfaces:

- `codex exec`
- `codex review`
- `codex mcp`
- `codex plugin`
- `codex mcp-server`
- `codex app-server`
- `codex exec-server`
- `codex cloud`

The CLI emitted stale temp-dir cleanup warnings during `--version` and `--help`.
Those warnings are already handled by `packages/codex-cli-host` as diagnostics,
not automatic command failure.

## Decision

The final Codex Desktop app native-source route remains blocked because the
Windows app is a packaged runtime and no editable Desktop app source or native
extension surface was found locally.

The official programmable route is now:

1. Keep `codex-router` final Desktop app native wiring blocked.
2. Promote the Codex CLI / SDK / App Server route as the next supported
   integration track.
3. Continue from `packages/codex-cli-host`, which builds safe
   `codex exec --json` plans, parses JSONL output, and now has a guarded
   process runner plus a read-only smoke wrapper.
4. Keep app-server clients or write-capable CLI execution behind explicit smoke
   commands and project approval gates.

## Implementation Progress

`packages/codex-cli-host` now has the narrow runner described below:

- accepts a `CodexCliExecPlan`
- rejects dangerous flags through the existing planner and a pre-run validator
- rejects forged argv mismatches between command args and plan metadata
- blocks write sandbox execution unless `allowWriteSandbox: true` is provided
- captures stdout, stderr, exit code, process errors, and timeout evidence
- ignores child stdin for non-interactive execution while preserving stdout and
  stderr capture
- returns `inspectCodexCliCommandOutput()` evidence
- supports an injectable spawner for tests so policy can be verified without
  live CLI execution
- provides `runCodexCliReadOnlySmoke()` and
  `createCodexCliReadOnlySmokeEvidence()` for the first safe live smoke lane
- provides `writeCodexCliReadOnlySmokeEvidenceFile()` and
  `runAndWriteCodexCliReadOnlySmokeEvidence()` for formatted JSON evidence
  persistence
- provides `createCodexCliWorkspaceWriteSmokePreflight()` and compact preflight
  evidence helpers for the next gated smoke stage without spawning Codex CLI
- provides a workspace-write approval packet helper that records sanitized
  command preview, target files, required gates, blockers, and rollback
  strategy without raw prompt content
- provides `createCodexCliWorkspaceWriteSmokeEvidence()` plus disk writers for
  compact blocked or passed workspace-write evidence
- provides `runCodexCliWorkspaceWriteSmoke()`, a gated runner that returns
  `blocked` without spawning Codex CLI until both required gates are present
- adapts current Codex CLI `0.125.0` approval flag placement by emitting
  `-a <policy>` before `exec`
- uses a `180000` ms default timeout window for the read-only smoke wrapper

Validated on `2026-04-25`:

- `npm run typecheck`
- `npm run build`
- `npm test` (`165/165`)

## Next Safe Implementation Step

The explicit live read-only smoke now has passing evidence at
`docs/evidence/codex-cli-readonly-smoke-20260425.json`:

- native Codex CLI started outside the command sandbox
- `codex -a never exec ...` was used for non-interactive read-only smoke
- result: `passed`
- blocking reasons: none
- event count: `56`
- parse error count: `0`

The workspace-write smoke preflight has a blocked artifact at
`docs/evidence/codex-cli-workspace-write-smoke-preflight-20260425.json` and an
approval packet at
`docs/evidence/codex-cli-workspace-write-smoke-approval-packet-20260425.json`:

- result: `blocked`
- target file: `docs/evidence/codex-cli-workspace-write-smoke.txt`
- required confirmation: `ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE`
- blocking reasons: `codex_cli_write_sandbox_requires_explicit_allowance` and
  `codex_cli_workspace_write_smoke_requires_confirmation`

A compact blocked workspace-write evidence artifact was also written at
`docs/evidence/codex-cli-workspace-write-smoke-evidence-20260425.json` using
the gated helper. It records the same blocked posture without exposing the raw
prompt or full argv.

A first live workspace-write success artifact was then written at
`docs/evidence/codex-cli-workspace-write-smoke-live-fixed-20260425.json`.
That run used the direct Windows `codex.exe` entry from the installed package
after a bare `spawn codex` attempt returned `ENOENT` in the Node host process.
The live smoke helpers now auto-resolve that installed executable on Windows
when no explicit `codexCommand` is provided. The smoke also created the bounded
target file
`docs/evidence/codex-cli-workspace-write-smoke.txt`.

The next safe implementation step is to get explicit operator approval before
any bounded workspace-write live smoke. Until then, the official CLI route is
validated read-only and preflighted for write, but write-capable execution is
not enabled.

This is a supported OpenAI Codex entry path without modifying the packaged
Codex Desktop app.
