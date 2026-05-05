# Codex Official Public Surfaces Realignment (2026-05-05)

## 1. Status

This is a documentation-only strategy realignment note.

- It does not implement integration.
- It does not modify runtime behavior.
- It does not run real host smoke.
- It does not create adapters, scripts, packages, CI jobs, or release workflows.
- It does not authorize deployment, release, tag, merge, push, downstream repository writes, or checked-in evidence.

## 2. Purpose

This note updates the default integration target for `codex-router` after reviewing OpenAI's public Codex surfaces and the local repository's prior final-host planning.

The previous planning path treated a Codex Desktop internal host object as the preferred final-host target. That remains a useful conceptual contract inside `codex-router`, but it should no longer be treated as the default implementation target unless OpenAI exposes a supported public entrypoint for it.

The default direction is now:

```text
Codex App Server / Codex CLI / Codex MCP public surfaces
-> codex-router governance wrappers
-> evidence-first host validation
```

## 3. Sources Reviewed

Official public sources reviewed for this note:

| Source | Surface | Relevance |
|---|---|---|
| `https://developers.openai.com/codex/cli` | Codex CLI | Public CLI documentation, including non-interactive usage. |
| `https://developers.openai.com/codex/app-server` | Codex App Server | Public App Server integration surface. |
| `https://developers.openai.com/codex/ide` | Codex IDE extension | Public IDE route, but not the same as a Desktop internal host object API. |
| `https://developers.openai.com/codex/open-source` | Open-source Codex components | Publicly documented open-source components and boundaries. |
| `https://openai.com/index/unlocking-the-codex-harness/` | Codex harness architecture note | Public architectural framing for App Server and harness-style integration. |

Repository context reviewed:

- `docs/codex-official-entry-recon-20260425.md`
- `docs/final-host-integration-evidence-plan-20260505.md`
- `docs/final-codex-desktop-host-integration-checklist-20260424.md`
- `docs/codex-cli-real-host-smoke-release-checklist.md`
- `docs/codex-cli-smoke-strategy-20260428.md`

## 4. Finding

The reviewed official sources document public Codex entry surfaces such as:

- Codex CLI
- Codex SDK
- Codex App Server
- Codex MCP-related surfaces
- IDE extension and app-facing workflows

The reviewed official sources do not expose a supported public API for directly wiring an external SDK into a Codex Desktop internal native host object with methods such as:

- `read_thread_terminal`
- `spawn_agent`
- `wait_agent`
- `send_input`
- `close_agent`
- `shell_command`
- `apply_patch`
- `automation_update`
- `record_memory`
- `search_memory`

That absence should be treated as an integration boundary, not as an implementation gap to work around.

## 5. Realignment Decision

`codex-router` should stop treating the Codex Desktop internal host object path as the default implementation target.

Updated default target:

| Route | Default status | Reason |
|---|---|---|
| Codex Desktop internal host object | CONCEPTUAL_ONLY | No reviewed official public entrypoint exposes this as an external integration API. |
| Codex App Server | PRIMARY_PUBLIC_SURFACE | Publicly documented application-server boundary suitable for protocol and governance exploration. |
| Codex CLI | PRIMARY_PUBLIC_SURFACE | Publicly documented and already represented by `packages/codex-cli-host`. |
| Codex MCP surfaces | PRIMARY_PUBLIC_SURFACE | Publicly documented extension and tool boundary for controlled integration. |
| Codex SDK | SECONDARY_PUBLIC_SURFACE | Useful for app-side or harness-style integration, but should be scoped separately. |
| IDE extension | OBSERVABLE_PUBLIC_SURFACE | Public user-facing route, but not a direct replacement for a Desktop native host object contract. |

## 6. Impact On Existing Documents

This note does not delete or rewrite existing final-host documents.

Instead, it changes their interpretation:

| Document | Updated interpretation |
|---|---|
| `docs/final-codex-desktop-host-integration-checklist-20260424.md` | Historical and conceptual Desktop host-object checklist. Not the default implementation target until a supported public entrypoint exists. |
| `docs/final-host-integration-evidence-plan-20260505.md` | Still useful as an evidence framework, but the Desktop internal host-object lane should be treated as blocked / conceptual unless official access appears. |
| `docs/codex-official-entry-recon-20260425.md` | Remains aligned with the public-surface route and should be treated as stronger evidence for CLI / SDK / App Server direction. |
| `docs/codex-cli-real-host-smoke-release-checklist.md` | Remains an actionable real-host validation route for the public CLI surface. |
| `docs/codex-cli-smoke-strategy-20260428.md` | Remains the current CI-vs-real-host smoke separation strategy. |

## 7. Updated Governance Target

Future `codex-router` governance work should prefer public-surface wrappers:

- CLI command planning, approval policy, sandbox policy, and smoke evidence.
- App Server protocol observation, request/response governance, and report-only checks.
- MCP server / client boundary checks, tool allowlists, approval gates, and audit evidence.
- SDK-level task envelope and result vocabulary mapping where a public SDK boundary is available.

The governance target is not to replace Codex Desktop internals. The target is to wrap supported public surfaces with:

- explicit preflight;
- hard gates;
- dry-run/report-only modes;
- deterministic smoke;
- sanitized evidence;
- stop conditions;
- human approval for push, merge, tag, release, deploy, secrets, production config, and downstream writes.

## 8. Non-Goals

This realignment does not authorize:

- reverse engineering Codex Desktop internals;
- editing packaged Codex Desktop application files;
- relying on undocumented native host object methods;
- creating a Desktop internal adapter;
- running live host smoke;
- committing evidence;
- modifying `packages/`;
- creating scripts or CI jobs;
- opening or modifying downstream repositories;
- claiming production certification.

## 9. Stop Conditions

Stop and re-evaluate before implementation if:

- the next step requires undocumented Desktop internals;
- official App Server or CLI documentation conflicts with local assumptions;
- a proposed integration needs secrets, tokens, or `.env` values;
- the route requires external writes, production calls, release actions, or downstream repository edits;
- the implementation starts bypassing Codex approval or sandbox controls;
- evidence would contain raw prompts, full argv, credentials, or private host data;
- the public surface cannot be validated with a dry-run or report-only mode first.

## 10. Recommended Next Step

Create a separate docs-only reconnaissance plan for `Codex App Server` and `Codex CLI` public-surface governance.

The smallest safe next document would be:

```text
docs/codex-public-surface-governance-recon-plan-20260505.md
```

That future plan should identify:

- which public surface to inspect first;
- what can be validated read-only;
- which commands or protocol calls are safe to run locally;
- what evidence shape is required;
- which actions remain hard-gated.

Do not implement an App Server, CLI, MCP, or SDK adapter from this realignment note.
