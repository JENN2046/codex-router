# V1 Final Host Readiness Addendum (2026-04-24)

This addendum records the post-freeze progress after the `2026-04-23` V1
integration-ready notes.

The `2026-04-23` documents remain the historical RC and integration-ready
decision. This note updates the current implementation posture for the final
Codex Desktop host path.

## What Changed After The V1 Freeze

`packages/codex-desktop-live-host` now exposes a first-class final-host
readiness starter:

- `createCodexDesktopLiveHostEmbeddingStarter()`

The starter gives the final host a controlled wiring path before bundle
creation:

- `host`
- `inspect()`
- `getStatus()`
- `assertReady()`
- `createBundle()`

The package also now exposes a standard final-host smoke surface:

- `createCodexDesktopLiveHostSmokeTasks()`
- `runCodexDesktopLiveHostSmoke()`
- `createCodexDesktopLiveHostSmokeEvidence()`

This moves the final Codex Desktop host path out of the copyable
`host-client-example` starter lane and into the production-shaped
`codex-desktop-live-host` package.

The smoke task generator is now also source-aware. The default remains Codex
Desktop, but the same harness can generate `source: "cli"` envelopes and
Codex CLI labels for a later CLI host adapter without changing the live runner
contract.

`packages/codex-cli-host` now also provides the first narrow CLI adapter seam.
At the time of this addendum it built safe `codex exec --json` command plans and
parsed JSONL output. The `2026-04-25` follow-up adds the guarded runner and
read-only smoke wrapper described in `docs/codex-cli-host.md`.

The final-host smoke path also now includes a compact evidence builder so the
host repo can record one stable acceptance object instead of hand-assembling
smoke summaries from raw run results.

## Current Recommended Final Host Path

For Codex Desktop itself, use:

- `createCodexDesktopLiveHostEmbeddingStarter()`

Do not use the VCPChat-specific task sheet or the copyable `target-host-*`
example path as the final host integration entrypoint.

Those older materials remain useful for:

- external trial hosts
- copyable scaffold examples
- historical VCPChat validation context

## Stable Final Host Contract

The final host should wire one current host object with runtime and memory
methods.

Required runtime methods:

- `read_thread_terminal`
- `spawn_agent`
- `wait_agent`
- `send_input`
- `close_agent`
- `shell_command`
- `apply_patch`
- `automation_update`

Required memory methods:

- `record_memory`
- `search_memory`

Recommended memory method:

- `memory_overview`

## Readiness Rule

Before any live execution, the final host should satisfy:

- `starter.inspect().ready === true`
- `starter.getStatus().pendingRequiredMethods.length === 0`
- `starter.getStatus().nextAction === "create_bundle"`
- `starter.assertReady()` passes

Only then should the host call:

```ts
const bundle = starter.createBundle();
```

For final host acceptance, prefer the structured smoke harness:

```ts
const smoke = await runCodexDesktopLiveHostSmoke(starter);
```

Passing release posture means the release-shaped smoke is blocked by approval:

- `smoke.checks.releasePosture.decisionStatus === "blocked_approval"`
- `smoke.checks.releasePosture.executionStatus === "not_ready"`

## Validation Baseline

Validated in `A:\codex-router` on `2026-04-24`:

- `npm run typecheck`
- `npm run build`
- `npm test`

Current `2026-04-24` result:

- `145/145` tests passing

Follow-up validation on `2026-04-25` after the guarded CLI runner and read-only
smoke wrapper:

- `155/155` tests passing

## New Evidence Added

- final-host embedding starter implementation in
  `packages/codex-desktop-live-host`
- tests for incomplete-host readiness inspection
- tests for bundle creation after the current host object is wired
- tests for standard final-host smoke task generation
- tests for Codex CLI-shaped smoke task generation
- tests for Codex CLI exec plan generation and JSONL diagnostics
- follow-up tests for the guarded Codex CLI runner, read-only smoke evidence,
  and formatted smoke evidence persistence
- tests for the structured final-host smoke harness
- tests for compact final-host smoke evidence capture
- final host execution checklist:
  - `docs/final-codex-desktop-host-integration-checklist-20260424.md`
- documentation update:
  - `docs/codex-desktop-live-host.md`

## Remaining Risk

The SDK now exposes a final-host-ready integration surface, but the actual
Codex Desktop repository still needs to wire its real native host object and run
the final host smoke gates.

This addendum does not claim:

- production certification inside Codex Desktop
- real external deployment validation
- stdio MCP transport support
- centralized router service readiness

## Next Gate

The next gate is in the final host repo:

- wire the current Codex Desktop host object
- run `runCodexDesktopLiveHostSmoke(starter)`
- record the evidence listed in
  `docs/final-codex-desktop-host-integration-checklist-20260424.md`
