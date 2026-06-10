# Agent OS Kernel Phase 0-1 Pre-Development Baseline

Date: 2026-06-09
Recorded at: 2026-06-09 21:41:06 +08:00
Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
Branch: `codex/agent-os-kernel-phase-0-1`
Commit: `a664871463b183b96708a8b8c93adc160feb6988`

## Scope

This record marks the local pre-development validation baseline for the current
`codex/agent-os-kernel-phase-0-1` branch before additional work continues.

## Runtime Versions

| Tool | Version |
|---|---|
| Node.js | `v24.14.0` |
| npm | `11.9.0` |

## Required Command Results

| Command | Status | Output summary |
|---|---|---|
| `npm run typecheck` | passed | Ran `tsc -p tsconfig.json --noEmit`; completed with exit code `0`. |
| `npm test` | passed | Ran `tsx --test tests/*.test.ts`; TAP summary reported `594` tests, `594` pass, `0` fail, `0` cancelled, `0` skipped, `0` todo. |
| `npm run build` | passed | Ran `tsc -p tsconfig.json`; completed with exit code `0`. |

No failing required command was observed during this baseline pass.

## Not Run

`npm ci`, canary checks, evidence collection, live Codex CLI smoke, CI,
deployment, release, and remote-write validation were not run for this
baseline.

