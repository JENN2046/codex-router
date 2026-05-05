# Codex App Server Protocol Recon (2026-05-05)

## 1. Status

This is a read-only protocol reconnaissance report.

- It does not implement an App Server adapter.
- It does not start `codex app-server`.
- It does not expose a WebSocket listener.
- It does not generate or commit protocol schemas.
- It does not create scripts, packages, tests, CI jobs, runtime adapters, or evidence artifacts.
- It does not authorize push, merge, tag, release, deploy, external writes, downstream repository writes, or secret access.

## 2. Purpose

This report performs the App Server step from `docs/codex-public-surface-governance-recon-plan-20260505.md`.

The goal is to inspect the official Codex App Server public protocol surface and determine how it could map to `codex-router` governance concepts before any implementation is proposed.

## 3. Sources Inspected

Official sources:

- `https://developers.openai.com/codex/app-server`
- `https://developers.openai.com/codex/open-source`

Local read-only sources:

- `docs/codex-official-public-surfaces-realignment-20260505.md`
- `docs/codex-public-surface-governance-recon-plan-20260505.md`
- `docs/codex-cli-public-surface-reconciliation-20260505.md`
- `package.json`
- `codex app-server --help`
- `codex app-server generate-ts --help`
- `codex app-server generate-json-schema --help`
- package directory scan for existing App Server anchors

No App Server process was started.

## 4. Official Protocol Surface Observed

Official documentation positions `codex app-server` as the interface used for rich clients and deep product integrations. It is not the preferred route for CI-style automation; official documentation points automation jobs toward Codex SDK instead.

Observed public protocol concepts:

| Official concept | Observed behavior | Governance relevance |
|---|---|---|
| JSON-RPC-style messages | App Server uses bidirectional JSON-RPC 2.0-style messages, with the `jsonrpc` header omitted on the wire. | Natural mapping to request/response/notification governance. |
| `stdio` transport | Default transport; newline-delimited JSON. | Safest first protocol observation target. |
| WebSocket transport | Experimental and unsupported; one JSON-RPC message per text frame. | Requires explicit hard gate before starting or exposing a listener. |
| `off` transport | Disables local transport exposure. | Useful conceptual safe mode. |
| initialization handshake | Client sends `initialize`, then `initialized`; requests before initialization are rejected. | Maps to preflight and session readiness. |
| thread / turn / item primitives | Thread is conversation, turn is a user request and agent work, item is input/output/tool/file unit. | Maps to `TaskEnvelope`, checkpoint, observation, and audit surfaces. |
| notifications | Server streams notifications such as thread, turn, and item updates. | Maps to execution observation and checkpoint/audit event streams. |
| schema generation | CLI can generate TypeScript bindings or JSON Schema bundles for the current Codex version. | Useful future contract source, but schema generation writes files. |

## 5. Local CLI Help Surface Observed

Local `codex app-server --help` exposes:

- `codex app-server`
- `codex app-server proxy`
- `codex app-server generate-ts`
- `codex app-server generate-json-schema`

Local transport options include:

- `stdio://`
- `unix://`
- `unix://PATH`
- `ws://IP:PORT`
- `off`

Local WebSocket auth options include:

- `--ws-auth capability-token`
- `--ws-auth signed-bearer-token`
- `--ws-token-file`
- `--ws-token-sha256`
- `--ws-shared-secret-file`
- `--ws-issuer`
- `--ws-audience`
- `--ws-max-clock-skew-seconds`

Schema generation help confirms:

- `generate-ts --out <DIR>` writes TypeScript files.
- `generate-json-schema --out <DIR>` writes a schema bundle.
- both commands can include experimental methods and fields with `--experimental`.

This report did not run any schema generation command.

## 6. Repository Anchor Assessment

Current repository has no dedicated App Server package anchor.

Related existing anchors:

| Area | Existing anchor | Fit for App Server |
|---|---|---|
| CLI public surface | `packages/codex-cli-host` | Useful precedent for planning, parsing, smoke, and evidence discipline. |
| MCP memory client | `packages/codex-memory-mcp-client` | Useful precedent for transport-native client boundaries, but not App Server-specific. |
| DGP contracts | `packages/contracts`, `packages/routing-engine`, `packages/approval-gate`, `packages/runtime-control` | Candidate governance mapping targets. |
| Observability | `packages/execution-observation`, `packages/checkpoint-ledger-v2`, `packages/audit-memory`, `packages/observability` | Candidate event/evidence targets. |

No source code change is recommended from this reconnaissance alone.

## 7. Protocol-To-Governance Mapping

| App Server surface | Candidate `codex-router` mapping | Fit | Notes |
|---|---|---|---|
| transport selection | preflight / runtime-control | PARTIAL | `stdio` is the safest first target; WebSocket requires separate hard-gated design. |
| `initialize` / `initialized` | preflight readiness | DIRECT | Requests before initialization are rejected, matching readiness-gate semantics. |
| `thread/start` | `TaskEnvelope` creation or session creation | PARTIAL | Thread lifecycle is broader than a single `TaskEnvelope`. |
| `thread/resume` / `thread/fork` | checkpoint / resume / branch semantics | PARTIAL | Strong conceptual match, but no adapter exists. |
| `turn/start` | task execution request | PARTIAL | Maps to a governed task start, but needs policy vocabulary mapping. |
| `turn/steer` / `turn/interrupt` | runtime-control / recovery-control | PARTIAL | Useful for intervention and cancellation governance. |
| thread / turn / item notifications | execution-observation / audit / checkpoint | DIRECT_CONCEPTUAL | Observation model is a good fit; implementation missing. |
| `command/exec` methods | hard-gated host execution | CONFLICT_RISK | Direct command execution must not bypass approval, sandbox, or policy controls. |
| plugin / marketplace / skills methods | extension governance | CONFLICT_RISK | Installation, config write, and marketplace mutation are side-effectful. |
| schema generation | contract proposal input | PARTIAL | Useful but writes files; generation itself is a hard gate in this repo. |

Fit values are conceptual only. They do not claim an App Server adapter exists.

## 8. High-Risk Protocol Areas

The following App Server areas require hard-gated design before implementation:

- WebSocket listeners, especially non-loopback listeners.
- WebSocket authentication and token files.
- raw bearer tokens, shared secrets, and token hashes.
- `command/exec` and related command streaming methods.
- thread shell command methods that run outside normal sandbox expectations.
- plugin install/uninstall and marketplace mutation methods.
- skills config write methods.
- experimental API opt-in.
- schema generation and committed generated artifacts.

These surfaces may be useful, but they are not safe defaults.

## 9. Recommended First Safe Boundary

If an App Server direction is proposed later, the first implementation shape should be:

- documentation-first;
- `stdio` only;
- report-only;
- no long-running server by default;
- no WebSocket listener;
- no authentication token handling;
- no command execution;
- no plugin, marketplace, or skills mutation;
- no schema generation unless explicitly approved;
- no downstream repository writes.

The first contract should probably be an observation and validation contract, not an executor.

## 10. Findings Table

| Field | Value |
|---|---|
| `surface` | `app-server` |
| `source` | Official Codex App Server docs, local `codex app-server --help`, schema subcommand help, repository package scan |
| `performed` | Read-only protocol and command-help inspection |
| `finding` | App Server is a rich public protocol surface with thread/turn/item lifecycle and JSON-RPC-style messages; it is suitable for governance reconnaissance but too broad for direct runtime implementation without a contract stage. |
| `governanceMapping` | transport/preflight -> initialize -> thread/turn request -> observation notifications -> checkpoint/audit -> hard-gated command/plugin/config methods |
| `unknowns` | No live server was started; no schema was generated; no protocol messages were exchanged; no authentication behavior was tested. |
| `blockedBy` | Starting transports, WebSocket exposure, schema generation, command execution, token handling, and adapter implementation require separate explicit approval. |
| `nextAction` | Create a docs-only App Server governance contract proposal before implementation, or continue broad reconnaissance with MCP boundary recon. |

## 11. Recommendation

Do not implement an App Server adapter yet.

The next safest App Server-specific step is a documentation-only contract proposal:

```text
docs/codex-app-server-governance-contract-proposal-20260505.md
```

That proposal should define:

- allowed transport scope;
- request / response / notification record shape;
- initialization preflight contract;
- thread / turn / item mapping vocabulary;
- hard-gated method categories;
- schema generation policy;
- evidence shape;
- stop conditions.

Do not start `codex app-server`, expose WebSocket listeners, handle auth tokens, generate committed schemas, run command execution methods, mutate plugins/skills/marketplaces, or create runtime adapters from this reconnaissance report.
