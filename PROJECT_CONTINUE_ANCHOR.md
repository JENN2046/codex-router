# Project Continue Anchor

Date: 2026-04-24
Workspace: `A:\codex-router`

## Current Status

This workspace is the `codex-router` SDK and final-host integration preparation
workspace. It is a Git repository on `main`.

Latest validated baseline on `2026-04-27`:

- `npm run typecheck` passed
- `npm run build` passed
- `npm test` passed, `202/202` tests passing

Current CLI host line status:

- `packages/codex-cli-host` has the split façade plus internal implementation
  module.
- governance V2, ledger, and step-back handling are documented and covered by
  tests.
- read-only and release-only workspace-write acceptance wrappers exist.
- export-lock fixtures for the public host surface and governance-v2 surface
  have been added.
- all acceptance and smoke lanes now pass live on `2026-04-27`:
  read-only, workspace-write, and telemetry (both miss→hit cache cycles).
  EPERM is no longer blocking in this environment.

Latest read-only source-gate checkpoint on `2026-04-25`:

- `createFinalHostSourceGateFromPathProbes()` was run against known local
  candidates.
- Result: `blocked_missing_editable_source`.
- Evidence note: `docs/final-host-source-gate-evidence-20260425.md`.
- `A:\VCP\VCPChat*` paths remain reference-only.
- `C:\Users\617\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0` remains a
  packaged runtime, not editable source.
- A follow-up C drive pass confirmed
  `C:\Program Files\WindowsApps\OpenAI.Codex_26.422.3464.0_x64__2p2nqsd0c76g0`,
  `C:\Users\617\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0`, and
  `C:\Users\617\.cache\codex-runtimes\codex-primary-runtime` are packaged
  runtime/cache locations.
- `C:\Users\617\.codex\plugins\cache` contains installed plugin cache entries,
  but does not expose the final-host startup, host runtime, and validation seams.
- No obvious editable Codex Desktop source was found in the narrow local paths
  checked.
- Official documentation recheck on `2026-04-25` found the supported
  programmable route is Codex CLI / SDK / App Server, not Microsoft Store Codex
  app native-source wiring.
- Local CLI recheck found `codex-cli 0.125.0` at
  `C:\Users\617\AppData\Roaming\npm\codex.ps1`.
- New evidence note: `docs/codex-official-entry-recon-20260425.md`.
- `packages/codex-cli-host` now includes a guarded `codex exec --json` process
  runner that validates plans before execution, captures stdout/stderr/exit
  evidence, blocks dangerous bypass flags, rejects forged argv/metadata
  mismatches, and requires explicit allowance for `workspace-write` plans.
- The official CLI route now also includes `runCodexCliReadOnlySmoke()` and
  `createCodexCliReadOnlySmokeEvidence()` for a forced-read-only smoke lane.
- It also includes `writeCodexCliReadOnlySmokeEvidenceFile()` and
  `runAndWriteCodexCliReadOnlySmokeEvidence()` so read-only smoke evidence can
  be persisted as formatted JSON, including failed pre-run validation evidence.
- It also includes `createCodexCliWorkspaceWriteSmokeEvidence()` and
  `writeCodexCliWorkspaceWriteSmokeEvidenceFile()` so workspace-write smoke
  evidence can be persisted as formatted JSON without raw prompt content.
- Live read-only CLI smoke was attempted on `2026-04-25` and persisted at
  `docs/evidence/codex-cli-readonly-smoke-20260425.json`.
- The adapter was updated for Codex CLI `0.125.0` argument placement:
  `codex -a <policy> exec ...`.
- The process runner now ignores child stdin for non-interactive execution while
  preserving stdout/stderr capture, and the read-only smoke wrapper defaults to
  a `180000` ms timeout window.
- Current live smoke result: `passed`, with `56` JSONL events, `0` parse
  errors, and no blocking reasons.
- Workspace-write smoke preflight now exists and is persisted at
  `docs/evidence/codex-cli-workspace-write-smoke-preflight-20260425.json`.
  Current result is intentionally `blocked` until both `allowWriteSandbox: true`
  and confirmation string `ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE` are provided.
- Workspace-write smoke approval packet now exists at
  `docs/evidence/codex-cli-workspace-write-smoke-approval-packet-20260425.json`.
  It records the sanitized command preview, target file, blockers, required
  gates, and rollback path without raw prompt content.
- `runCodexCliWorkspaceWriteSmoke()` now exists as the gated execution helper.
  It returns `blocked` without spawning Codex CLI unless both gates are present;
  this has only been verified with fake spawners, not live write execution.
- `runAndWriteCodexCliWorkspaceWriteSmokeEvidence()` now exists for the single
  artifact path that runs the gated helper and writes the compact evidence file.
- A compact blocked workspace-write evidence artifact now exists at
  `docs/evidence/codex-cli-workspace-write-smoke-evidence-20260425.json`.
- A first live workspace-write success artifact now exists at
  `docs/evidence/codex-cli-workspace-write-smoke-live-fixed-20260425.json`.
  The live smoke helpers now auto-resolve the installed Windows `codex.exe`
  entry when no explicit `codexCommand` is provided, which fixes the earlier
  bare `spawn codex` ENOENT path in the Node host process. The bounded target
  file `docs/evidence/codex-cli-workspace-write-smoke.txt` was created with the
  smoke record.

## Project Goal

Wire `codex-router` into the final Codex Desktop host while preserving safety,
reversibility, approval boundaries, memory integration, and smoke evidence.

The current priority is final Codex Desktop host integration, not broad dual-host
execution. Codex CLI has a future-host seam started, but it should not distract
from final-host landing unless explicitly re-scoped.

## What Is Done

- `packages/codex-desktop-live-host` has the final-host embedding starter.
- Live-host smoke tasks and smoke evidence exist.
- `packages/codex-cli-host` has a safe planning/parsing seam and guarded
  process runner for future Codex CLI host work, plus a read-only smoke wrapper
  compact smoke evidence writer, a workspace-write smoke preflight evidence
  path, a workspace-write approval packet path, and a gated workspace-write
  smoke runner. Live write-capable execution remains behind explicit allowance
  and project approval rules.
- `packages/final-host-locator` exists and now supports:
  - manual candidate classification;
  - shallow read-only path probing;
  - source gate creation;
  - compact source gate evidence.
- VCPChat has been identified as a reference/validation host only.
- The installed Codex app package has been identified as packaged runtime only,
  not editable source.

## Important Boundary

Do not edit VCPChat or treat it as the final Codex Desktop host unless the user
explicitly re-scopes that work.

Do not close or restart the currently running host unless necessary. If a restart
or close becomes necessary, tell the user first.

Do not proceed with final-host wiring until an editable final Codex Desktop
source path, plugin path, or extension surface is identified.

## Next Step

When the user says "continue project" or a similar continuation request in this
folder, continue here:

1. For the blocked native Desktop route, ask for or locate the editable final
   Codex Desktop host source path.
2. Run a read-only source gate using
   `createFinalHostSourceGateFromPathProbes()`.
3. If the gate is `ready_for_mapping`, inspect the final host startup,
   IPC/plugin, runtime, validation, and evidence persistence seams.
4. Map the host runtime into
   `createCodexDesktopLiveHostEmbeddingStarter()`.
5. Add final-host read-only smoke first.
6. Capture source-gate evidence and live-host smoke evidence.
7. Only after read-only smoke passes, consider write-capable task execution.

If continuing the official supported route instead of native Desktop source
mapping, start from the passing read-only CLI smoke in
`docs/evidence/codex-cli-readonly-smoke-20260425.json` and the blocked
workspace-write preflight in
`docs/evidence/codex-cli-workspace-write-smoke-preflight-20260425.json`, plus
the approval packet in
`docs/evidence/codex-cli-workspace-write-smoke-approval-packet-20260425.json`.
The next safe step is to ask for explicit operator approval before any bounded
workspace-write live smoke, or keep the route read-only while native Desktop
source discovery continues.

## Useful Files

- `packages/final-host-locator/src/index.ts`
- `packages/codex-desktop-live-host/src/index.ts`
- `packages/codex-cli-host/src/index.ts`
- `docs/final-host-source-gate-evidence-20260425.md`
- `docs/codex-official-entry-recon-20260425.md`
- `docs/evidence/codex-cli-readonly-smoke-20260425.json`
- `docs/evidence/codex-cli-workspace-write-smoke-preflight-20260425.json`
- `docs/evidence/codex-cli-workspace-write-smoke-approval-packet-20260425.json`
- `docs/final-host-locator.md`
- `docs/final-host-readonly-preflight-20260424.md`
- `docs/final-codex-desktop-host-integration-checklist-20260424.md`
- `docs/codex-desktop-live-host.md`
- `docs/codex-cli-host.md`
- `docs/evidence/codex-cli-readonly-smoke-20260425.json`

## Validation Commands

Use the existing scripts only:

```powershell
npm run typecheck
npm run build
npm test
```

## One-Line Resume Prompt

Continue from the blocked Desktop native-source gate or the accepted CLI route:
for Desktop, identify an editable final-host source path before mapping; for CLI,
all acceptance lanes (read-only, workspace-write, telemetry) now pass live — next
step is to refresh the acceptance closeout and host doc to remove stale EPERM
language, then decide whether to extend the CLI host surface or resume Desktop
source discovery.
