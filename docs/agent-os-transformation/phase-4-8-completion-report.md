# Agent OS Kernel Phase 4-8 Completion Report

Date: 2026-06-10
Merged PR: https://github.com/JENN2046/codex-router/pull/33
Merge commit: `2a77817`
Feature branch: `feature/phase-4-provider-execution-runner`

## Summary

Phase 4-8 moved Agent OS from a provider-planning control plane into a local,
reviewable execution foundation. The merged work adds dry-run provider execution,
fake protocol integration surfaces, durable local stores with process-safe file
locks, scheduler leases, and governed public entry wrappers for MCP-local,
CLI, SDK, and app-server style callers.

This phase still does not enable real provider execution, real MCP networking,
real A2A networking, live App Server transport, or real approval issuance. The
system remains local, deterministic, and dry-run first by default.

## Phase 4: Provider Execution Runner

Delivered:

- `packages/provider-execution-runner/src/index.ts`
- `tests/provider-execution-runner.test.ts`

The provider execution runner now consumes a stored `ProviderExecutionPlan` and
performs dry-run validation without invoking real provider execution. It records
kernel events and artifact evidence for successful dry-runs, validation
failures, provider planning failures, and blocked preflight states.

Important gates added during review:

- Blocks non-planned provider plans.
- Blocks real execution modes before provider hooks.
- Requires the parent run to be `running`.
- Re-checks task, run, policy, sandbox, side-effect, capability, provider, and
  `inputHash` invariants before accepting provider output.
- Blocks disabled providers before invoking provider hooks.
- Keeps Codex CLI real execution disabled by default.

Boundary:

- Dry-run only.
- `executeInvoked` remains false.
- Provider output is treated as untrusted until runner invariants pass.

## Phase 5: Fake Protocol Integration Surfaces

Delivered:

- `packages/protocol-mcp/src/index.ts`
- `packages/protocol-a2a/src/index.ts`
- `tests/protocol-mcp.test.ts`
- `tests/protocol-a2a.test.ts`

MCP and A2A gained local fake/skeleton integration surfaces for deterministic
planning and contract tests.

MCP coverage includes:

- MCP server refs using opaque command/endpoint references.
- Tool descriptor to tool manifest mapping.
- Fake MCP tool provider descriptor exposure.
- Invocation disabled by default.
- Allowlist and blocklist enforcement.

A2A coverage includes:

- Agent manifest to AgentCard skeleton mapping.
- Task/run/artifact skeleton mapping.
- Fake transport for local queue/cancel behavior.
- Cancel authorization checks.
- Remote provider disabled by default.

Boundary:

- No live MCP server is started.
- No live A2A network transport is used.
- Fake providers are integration scaffolds, not production adapters.

## Phase 6: Durable Stores And Scheduler Leases

Delivered:

- `packages/kernel-store/src/index.ts`
- `packages/execution-planner/src/index.ts`
- `packages/provider-registry/src/index.ts`
- `packages/scheduler/src/index.ts`
- Store and scheduler regression tests.

Phase 6 added file-backed local stores and scheduler lease persistence. The
stores use atomic write patterns and file locks for local process safety.

Added durable surfaces:

- File-backed kernel store for runs, steps, events, and artifacts.
- File-backed provider execution plan store.
- File-backed provider manifest store.
- File-backed scheduler state with queue and lease persistence.

Important gates added during review:

- Lock cleanup compares stable snapshots before unlinking.
- Live lock owners are protected by recorded `pid` checks.
- Provider manifest store writes are serialized.
- Scheduler rejects invalid dependency, run, and step transition states.
- Scheduler lock cleanup follows the same live-owner protection model as other
  file stores.

Boundary:

- These are local file stores, not distributed database stores.
- Locking is process-safe for local filesystem use, not a cross-host consensus
  mechanism.
- No worker daemon is started by this phase.

## Phase 8: Governed Public Entry Wrappers

Delivered:

- `packages/protocol-mcp/src/agent-os-local-runtime.ts`
- `packages/protocol-mcp/src/agent-os-server-manifest.ts`
- `packages/agent-os-cli/src/index.ts`
- `packages/agent-os-sdk/src/index.ts`
- `packages/agent-os-app-server/src/index.ts`
- Public surface tests for MCP-local, CLI, SDK, and app-server wrappers.

Phase 8 exposes a governed public entry layer over the local Agent OS runtime.
All public surfaces share the same underlying local runtime behavior and audit
metadata.

Implemented public tool behavior:

- `agentos.create_task`
- `agentos.get_run`
- `agentos.list_runs`
- `agentos.cancel_run`
- `agentos.list_artifacts`
- `agentos.get_artifact`
- `agentos.search_events`

`agentos.approve_run` is declared and gated, but still returns a stable blocked
result because real approval issuance is not implemented yet.

Important gates added during review:

- Client-supplied gate fields are ignored at app-server boundaries.
- Invalid requests and invalid cursors are converted to audited bad requests.
- Cursor pagination works across run, artifact, event, CLI, SDK, MCP-local, and
  app-server surfaces.
- Not-found and terminal-state failures are stable blocked/not-found responses.
- CLI sanitizer redacts secret-like inline flag values.
- MCP manifest output schemas align with runtime outputs.

Boundary:

- The app-server package is an HTTP-like local router/wrapper, not a live server.
- The MCP runtime is local and does not open a live MCP connection.
- CLI and SDK wrappers call the local runtime and do not spawn Codex CLI.
- Real provider execution remains disabled.

## Validation Baseline

Before merge, local validation passed on the feature branch:

- `npm run typecheck`
- `npm test`
- `npm run build`
- Targeted tests for provider runner, protocol, scheduler, store, public
  surface, and Codex CLI provider review fixes.

PR #33 CI passed on head `45f6130` before merge:

- TypeCheck on Node 20 and Node 22.
- Build on Node 20 and Node 22.
- Test on Node 20 and Node 22.
- Canary checks.
- Smoke Contract checks.
- Evidence Collection.

After merge, local `main` was fast-forwarded to `origin/main` at merge commit
`2a77817`.

## Phase 4-8 Merge-Time Remaining Boundaries

At the Phase 4-8 merge point, the following were explicit deferrals, not
hidden production features:

- Real approval permit issuance from `agentos.approve_run`.
- Approval permit storage and retrieval from public runtime state.
- Permit consumption across public entry flows without manually supplying
  permits.
- Real provider execution.
- Real Codex CLI execution.
- Live MCP server runtime.
- Live A2A network transport.
- Live App Server process or WebSocket transport.
- Distributed storage or cross-host locking.
- Signed approval permits or tamper-evident audit ledgers.

## Follow-On Step

The next implementation phase should start with real approval issuance:

1. Add a local approval permit store.
2. Make `agentos.approve_run` issue a real permit when gates pass.
3. Record an approval event and return manifest-aligned permit output.
4. Wire SDK, CLI, app-server, and MCP-local tests through the shared runtime.
5. Keep permit signing optional or deterministic until the storage and runtime
   contract is stable.
