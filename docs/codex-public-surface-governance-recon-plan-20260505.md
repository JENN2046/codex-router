# Codex Public Surface Governance Recon Plan (2026-05-05)

## 1. Status

This is a documentation-only reconnaissance plan.

- It does not implement an App Server, CLI, MCP, SDK, or Desktop adapter.
- It does not modify runtime behavior.
- It does not run real host smoke.
- It does not create scripts, packages, tests, CI jobs, release workflows, or evidence artifacts.
- It does not authorize deployment, release, tag, merge, push, downstream repository writes, checked-in evidence, or secret access.

## 2. Purpose

This plan defines the next read-only reconnaissance path after `codex-router` realigned away from Codex Desktop internal host-object integration as the default target.

The goal is to inspect official public Codex surfaces and decide which governance wrapper should be proposed first, without implementing anything in this task.

Default public-surface order:

1. Codex CLI
2. Codex App Server
3. Codex MCP surfaces
4. Codex SDK

This order favors the surface already represented in `codex-router` first, then moves outward to protocol surfaces and SDK-level automation.

## 3. Sources Reviewed

Official public sources reviewed for this plan:

| Source | Surface | Recon relevance |
|---|---|---|
| `https://developers.openai.com/codex/noninteractive` | Codex CLI non-interactive mode | Documents `codex exec --json`, JSONL event output, and schema-shaped output for automated workflows. |
| `https://developers.openai.com/codex/app-server` | Codex App Server | Documents JSON-RPC-style app-server transport, initialization, thread/turn messages, and schema generation. |
| `https://developers.openai.com/codex/mcp` | Codex MCP configuration | Documents local Codex MCP server configuration, env forwarding, allowlists, denylists, and timeouts. |
| `https://developers.openai.com/api/docs/guides/tools-connectors-mcp` | API MCP and connectors | Documents remote MCP servers, approval policy, authentication, and remote MCP risk considerations. |
| `https://developers.openai.com/codex/sdk` | Codex SDK | Documents programmatic control of local Codex agents. |
| `https://developers.openai.com/codex/open-source` | Codex open source | Identifies open-source Codex CLI, SDK, App Server, and Skills surfaces. |

Repository context reviewed:

- `docs/codex-official-public-surfaces-realignment-20260505.md`
- `docs/codex-official-entry-recon-20260425.md`
- `docs/codex-cli-real-host-smoke-release-checklist.md`
- `docs/codex-cli-smoke-strategy-20260428.md`
- `packages/codex-cli-host`

## 4. Recon Principles

Reconnaissance must stay:

- read-only by default;
- local-repo-only unless a separate scope names another target;
- report-only;
- deterministic where possible;
- explicit about unknowns;
- free of secrets, tokens, `.env` values, production endpoints, raw prompts, and full argv;
- separate from live host smoke unless explicitly approved.

Reconnaissance may inspect docs, package surfaces, command help output, and existing tests. It must not mutate public surfaces or create new runtime behavior.

## 5. Surface Recon Matrix

| Surface | Current repo anchor | First read-only question | Safe local checks | Hard gates |
|---|---|---|---|---|
| Codex CLI | `packages/codex-cli-host`, `docs/codex-cli-*` | Does current CLI governance still match official `codex exec --json` behavior and approval boundaries? | inspect package exports, tests, `codex --help`, `codex exec --help`, existing smoke docs | real smoke, workspace-write smoke, evidence commit, push/merge/tag/release/deploy |
| Codex App Server | no package anchor yet; docs-only route | Which JSON-RPC methods and transports are safe to observe without starting a live integration? | inspect official docs, local `codex app-server --help`, generated schema command availability only | starting long-running server, websocket exposure, auth tokens, adapter implementation |
| Codex MCP | config/docs route; no dedicated package anchor | Which MCP config fields map to governance allowlists, denylists, timeouts, and secret boundaries? | inspect official docs, local `codex mcp --help`, existing config docs if present | adding/removing MCP servers, forwarding env vars, OAuth, remote MCP calls |
| Codex SDK | no package anchor yet | Is SDK better treated as automation layer or downstream integration target? | inspect official docs and package metadata only | dependency install, package creation, runtime execution |

## 6. Recommended Recon Sequence

### Step 1: CLI Surface Reconciliation

Read-only goal:

- Compare official `codex exec --json` behavior with `packages/codex-cli-host`.
- Confirm JSONL event categories are still represented in local parsing assumptions.
- Confirm approval/sandbox boundaries remain explicit.
- Confirm real smoke remains outside normal CI and operator-gated.

Allowed read-only checks:

```powershell
git status --short --branch
Get-Content .\docs\codex-cli-smoke-strategy-20260428.md
Get-Content .\docs\codex-cli-real-host-smoke-release-checklist.md
Get-ChildItem .\packages\codex-cli-host -Recurse
codex --help
codex exec --help
```

Do not run:

```powershell
npm run smoke:telemetry
npm run smoke:workspace-write:telemetry
codex exec --json ...
```

Those commands cross into live host smoke or live execution and require a separate approval.

### Step 2: App Server Protocol Recon

Read-only goal:

- Identify stable App Server protocol entrypoints and schema generation commands.
- Map JSON-RPC request, response, notification, initialization, and event streams to `codex-router` governance concepts.
- Identify which protocol observations can be represented as dry-run/report-only checks.

Allowed read-only checks:

```powershell
codex app-server --help
codex app-server generate-ts --help
codex app-server generate-json-schema --help
```

Do not start a live App Server process in this recon plan.

Do not run:

```powershell
codex app-server
codex app-server --listen ws://127.0.0.1:4500
```

Starting transports, exposing WebSocket listeners, or handling auth tokens requires a separate scoped task.

### Step 3: MCP Boundary Recon

Read-only goal:

- Map local Codex MCP configuration concepts to governance controls.
- Identify allowlist/denylist, timeout, required-server, environment-forwarding, OAuth, and remote-server boundaries.
- Separate local STDIO MCP inspection from remote MCP execution.

Allowed read-only checks:

```powershell
codex mcp --help
```

Optional config inspection is allowed only when values are not printed if they may contain secrets.

Do not run:

```powershell
codex mcp add ...
codex mcp remove ...
codex mcp login ...
codex mcp-server ...
```

Do not forward environment variables, inspect secret values, or contact remote MCP servers.

### Step 4: SDK Positioning Recon

Read-only goal:

- Decide whether SDK governance should be a future package, a docs-only mapping, or out of scope for this repository.
- Compare SDK thread/run/resume concepts to `TaskEnvelope`, `RoutingDecision`, checkpoints, approval gates, and evidence vocabulary.

Allowed read-only checks:

```powershell
Get-Content .\package.json
```

Do not install SDK dependencies or create packages from this recon plan.

## 7. Evidence Shape

Each recon report should use this evidence table:

| Field | Meaning | Required |
|---|---|---|
| `surface` | `cli`, `app-server`, `mcp`, or `sdk` | Yes |
| `source` | Official URL, local doc, package, or command help inspected | Yes |
| `performed` | Exact read-only inspection performed | Yes |
| `finding` | Factual observation only | Yes |
| `governanceMapping` | Candidate mapping to DGP/routing/approval/checkpoint/audit/runtime-control | Yes |
| `unknowns` | Explicit unknowns or unverified claims | Yes |
| `blockedBy` | Hard gate or missing evidence, if any | Yes |
| `nextAction` | Smallest safe next action | Yes |

Do not record secrets, raw prompts, full argv, tokens, credentials, `.env` values, production endpoints, or private host data.

## 8. Hard Gates

Stop for explicit approval before:

- running `codex exec`;
- running real CLI smoke;
- running workspace-write smoke;
- starting `codex app-server`;
- exposing a WebSocket listener;
- generating or committing protocol schemas;
- adding, removing, logging into, or contacting MCP servers;
- forwarding environment variables to MCP;
- installing SDK packages;
- creating runtime adapters;
- creating scripts, tests, packages, or CI jobs;
- committing evidence artifacts;
- touching downstream repositories;
- pushing, merging, tagging, releasing, or deploying.

## 9. Non-Goals

This recon plan does not:

- adopt Codex App Server;
- adopt Codex MCP;
- add an SDK dependency;
- change `packages/codex-cli-host`;
- replace existing smoke strategy;
- validate production behavior;
- claim Desktop internal host object access;
- claim any public-surface wrapper has been implemented.

## 10. Recommended Next Step

After this plan is reviewed and merged, perform Step 1 only:

```text
CLI Surface Reconciliation
```

Expected output should be a read-only report, not code:

```text
docs/codex-cli-public-surface-reconciliation-20260505.md
```

Do not run live CLI smoke or `codex exec` as part of that first reconciliation unless separately approved.
