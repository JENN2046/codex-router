# Agent OS Current Roadmap

Date: 2026-06-15
Current base: `main` at `97304d2`
Status: local governance foundation, approval issuance, approval consumption,
and read-only formal integration evidence are merged and locally validated.

## Current Position

Agent OS now has a local governance kernel, provider planning, dry-run provider
execution, local durable stores, scheduler leases, approval permit issuance,
approval permit consumption, and public wrappers for MCP-local, CLI, SDK, and
app-server style callers.

The current mainline is still not an authorization to open real execution
surfaces. The active safe direction is local-only review or acceptance evidence
around approval consumption, provider dispatch preconditions, and sanitized
audit surfaces.

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
- Real local approval issuance through `agentos.approve_run`.
- Local approval permit consumption for read-only governed plans that start in
  `waiting_approval`.
- Read-only formal Codex CLI integration readiness evidence without re-running
  the real CLI.

## Current Product Boundary

Safe and implemented:

- Create local Agent OS tasks and runs.
- Store and list runs, artifacts, events, provider plans, provider manifests,
  scheduler leases, and approval permits locally.
- Plan provider execution.
- Dry-run provider execution and record evidence.
- Issue local approval permits when gates pass.
- Consume valid stored approval permits for read-only governed plans.
- Surface approval issuance and consumption through MCP-local, SDK, CLI, and
  App Server wrappers.
- Expose governed local public surfaces.
- Enforce capability, approval-tool, local-mutation, provider, scheduler,
  lock-safety, permit validation, and audit redaction gates.
- Verify the read-only formal integration chain through local audit matrix
  evidence.

Still blocked or disabled:

- Real provider execution as a general runtime mode.
- Real Codex CLI execution as a general runtime mode.
- Workspace-write execution without a separate exact operator authorization.
- Live MCP server connection.
- Live A2A network connection.
- Live App Server process.
- Signed permits.
- Distributed storage.
- Push, release, tag, publish, or external service writes without explicit
  remote authorization.

## Completed Approval Issuance And Consumption

Approval issuance is implemented and covered:

- In-memory approval permit store.
- Local runtime `agentos.approve_run` permit issuance.
- Provider-plan scope boundary checks.
- `kernel.approval.permit.issued` event evidence.
- MCP-local, SDK, CLI, and App Server entry regression tests.

Approval consumption is also implemented and covered:

- Stored permits can be loaded for execution eligibility.
- Valid permits can move a read-only `waiting_approval` provider plan to
  `planned`.
- Runtime output reports `consumedProviderPlanId` and
  `approvalConsumptionReasons`.
- Revoked, expired, and plan-hash-mismatched permits are rejected and audited.
- Missing planning context prevents consumption and leaves the waiting plan
  intact.
- Rejected permit audit is preserved across public wrappers.

Primary evidence:

- `docs/governance/APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT.md`
- `tests/approval-permit.test.ts`
- `tests/execution-eligibility.test.ts`
- `tests/agent-os-mcp-local-runtime.test.ts`
- `tests/agent-os-sdk.test.ts`
- `tests/agent-os-cli.test.ts`
- `tests/agent-os-app-server.test.ts`

## Current Read-only Integration Evidence

The newest mainline commits close out the local read-only formal integration
chain:

- `PR_14C_FORMAL_READONLY_CLI_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE`
- `PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE`
- `PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT_COMPLETE`
- `PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT_COMPLETE`
- `PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE`
- `PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX_RECORDED`

Primary evidence:

- `docs/governance/PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX.md`
- `docs/evidence/codex-cli-formal-readonly-integration-readiness.json`
- `docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json`
- `docs/evidence/codex-cli-real-readonly-smoke.json`

This matrix is local-only. It does not authorize provider execute,
workspace-write, real CLI invocation, push, release, or tag.

## Current Reviewable Slice

Next safe local slice:

- Review or add local-only acceptance evidence around approval consumption.
- Review provider dispatch preconditions, especially reject-before-spawn paths.
- Review sanitized audit surfaces for events, artifacts, telemetry, tool input
  previews, result envelopes, and workspace-write guard evidence.

Suggested first local docs/test task:

- Add or refresh a small local audit matrix that ties approval consumption,
  provider dispatch preconditions, and redaction surfaces to existing tests and
  evidence.

## Following Phases

After local review/evidence hardening:

1. Controlled provider execution.
   - Add explicit execution mode separate from dry-run mode.
   - Require valid permits and runner invariant checks.
   - Keep provider execution disabled by default.

2. Codex CLI execution opt-in.
   - Add explicit configuration for real Codex CLI execution.
   - Preserve dry-run default.
   - Add timeout, cancellation, telemetry, redaction, and evidence paths.

3. Worker loop.
   - Connect scheduler lease acquisition to provider runner dry-runs first.
   - Add renew/release behavior and crash recovery tests.
   - Only then consider real execution dispatch.

4. Live protocol adapters.
   - MCP live server adapter after local runtime contract stabilizes.
   - A2A real transport after fake transport and auth rules are complete.
   - App Server transport after a docs-first contract gate.

5. Hardening.
   - Signed permits.
   - Tamper-evident audit ledger.
   - Store migrations.
   - Operator audit view.
   - Rust sidecar spike only for concrete non-bypassable enforcement needs.

## Validation Baseline

Latest local validation on 2026-06-15 before the docs anchor refresh at
`97304d2`:

- `npm run typecheck` passed.
- `npm test` passed: `999 / 999`.
- `npm run build` passed.

For docs-only roadmap updates, inspect the diff and keep the worktree clean.
For runtime changes, run targeted tests plus:

- `npm run typecheck`
- `npm test`
- `npm run build`
