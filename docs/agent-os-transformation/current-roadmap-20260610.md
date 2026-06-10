# Agent OS Current Roadmap

Date: 2026-06-10
Current base: `main` at merge commit `2a77817`
Status: Phase 1-3 foundation and Phase 4/5/6/8 local execution foundation are
merged.

## Current Position

Agent OS now has a local governance kernel, provider planning, dry-run provider
execution, local durable stores, scheduler leases, and public wrappers for
MCP-local, CLI, SDK, and app-server style callers.

The project is ready to move from "declared approval gates" toward "real local
approval issuance." It is not yet ready for real provider execution or live
network/runtime surfaces.

## Completed Foundation

Already merged:

- Phase 1: governance entry layer and eligibility composition.
- Phase 2: local runtime MVP, run/step/event/artifact flow, and local audit
  artifacts.
- Phase 3: provider and protocol abstraction, Codex CLI provider facade, MCP
  manifest, MCP bridge skeleton, A2A skeleton, Rust sidecar ADR.
- Phase 4: provider execution dry-run runner.
- Phase 5: fake MCP/A2A protocol integration surfaces.
- Phase 6: durable local stores and scheduler leases.
- Phase 8: governed public entry wrappers for MCP-local, CLI, SDK, and
  app-server surfaces.

## Current Product Boundary

Safe and implemented:

- Create local Agent OS tasks and runs.
- Store and list runs, artifacts, events, provider plans, provider manifests,
  and scheduler leases locally.
- Plan provider execution.
- Dry-run provider execution and record evidence.
- Expose governed local public surfaces.
- Enforce capability, approval-tool, local-mutation, provider, scheduler, and
  lock-safety gates.

Still blocked or disabled:

- `agentos.approve_run` real permit issuance.
- Real provider execution.
- Real Codex CLI execution.
- Live MCP server connection.
- Live A2A network connection.
- Live App Server process.
- Signed permits.
- Distributed storage.

## Current Phase: Real Approval Issuance

Goal:

Turn `agentos.approve_run` from a stable blocked declaration into a local,
audited approval permit issuer.

Current branch:

`docs/agent-os-phase-4-8-roadmap`

Status in this branch:

- The Phase 4-8 completion report and current roadmap docs baseline have been
  added.
- The first local approval-issuance slice is implemented:
  - in-memory approval permit store
  - local runtime `agentos.approve_run` permit issuance
  - provider-plan scope boundary check
  - `kernel.approval.permit.issued` event evidence
  - MCP-local, SDK, CLI, and App Server entry regression tests

Non-goals for this phase:

- Real provider execution.
- Real Codex CLI execution.
- Live MCP/A2A/App Server networking.
- Cryptographic production signing.
- Cross-host permit storage.

Implementation checklist:

1. Done: add an approval permit store.
   - Provide an in-memory store for tests.
   - Keep the store API small: save, get, list by run, revoke.
   - File-backed approval permit storage remains deferred until the lock and
     migration contract is needed.

2. Done: extend `AgentOsMcpLocalRuntimeOptions`.
   - Accept an optional approval permit store.
   - Accept an approver principal or use the runtime principal as approver for
     local deterministic tests.
   - Keep mutation gates unchanged: `approval.issue`, approved mutating tool,
     and local mutation allowance are still required.

3. Done: implement `handleApproveRun`.
   - Parse input using the existing schema.
   - Require the run to exist.
   - Require an approval permit store.
   - Require a stored provider execution plan for the run.
   - Require requested approval scopes to be covered by the provider plan.
   - Bind the permit to task, run, principal, policy decision hash, plan hash,
     requested capability scopes, issue time, expiry, approver, and reason.
   - Return `permitId`, `runId`, and `expiresAt` on success.
   - Return stable blocked output for missing run, missing context, invalid
     scope, or unsafe request cases.

4. Done: record audit evidence.
   - Append a kernel event such as `kernel.approval.permit.issued`.
   - Include public surface, tool name, permit id, run id, approver id, and
     requested scopes.
   - Do not log secrets or raw credentials.

5. Done: wire public surfaces through shared runtime tests.
   - MCP-local runtime success and failure tests are covered.
   - SDK `approveRun()` success test is covered.
   - CLI `approve-run` parser/runtime test is covered.
   - App-server `POST /agent-os/runs/:runId/approve` route and wrapper test
     are covered.
   - Manifest output schema remains aligned with the success and blocked
     result shapes.

6. Deferred: keep permit consumption as a follow-up.
   - Issuance creates a permit.
   - A later phase should feed stored permits into execution eligibility,
     provider planning, and provider runner paths automatically.

## Following Phases

After real approval issuance:

1. Approval consumption.
   - Load permits from the store when evaluating execution eligibility.
   - Re-plan or unblock runs using accepted permits.
   - Add revocation behavior and tests.

2. Controlled provider execution.
   - Add explicit execution mode separate from dry-run mode.
   - Require valid permits and runner invariant checks.
   - Keep provider execution disabled by default.

3. Codex CLI execution opt-in.
   - Add explicit configuration for real Codex CLI execution.
   - Preserve dry-run default.
   - Add timeout, cancellation, telemetry, redaction, and evidence paths.

4. Worker loop.
   - Connect scheduler lease acquisition to provider runner dry-runs first.
   - Add renew/release behavior and crash recovery tests.
   - Only then consider real execution dispatch.

5. Live protocol adapters.
   - MCP live server adapter after local runtime contract stabilizes.
   - A2A real transport after fake transport and auth rules are complete.
   - App Server transport after a docs-first contract gate.

6. Hardening.
   - Signed permits.
   - Tamper-evident audit ledger.
   - Store migrations.
   - Operator audit view.
   - Rust sidecar spike only for concrete non-bypassable enforcement needs.

## Current Reviewable Slice

This branch's first reviewable implementation slice:

- Add approval permit store interfaces and in-memory implementation.
- Implement `agentos.approve_run` success path in the local runtime.
- Add MCP-local, SDK, CLI, and App Server approval regression tests.

Validation target:

- `npx tsx --test tests/approval-permit.test.ts tests/agent-os-mcp-local-runtime.test.ts`
- `npx tsx --test tests/agent-os-mcp-server-manifest.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`
