# Agent OS Current Roadmap

Date: 2026-07-09
Current base: `content digest only`
Status: local governance foundation, approval issuance, approval consumption,
read-only formal integration evidence, and approval consumption dispatch audit
matrix evidence are merged and locally validated. The real read-only Codex
CLI smoke path has historical evidence. The future Codex CLI canary
execution authorization packet draft/review, post-merge anchors, and post-push
anchors are pushed to `origin/main`. The final execution gate design for a
future real workspace-write canary, its post-merge anchors, and its post-push
anchors are pushed to
`origin/main`; the clean-main gate audit passed without running workspace-write.
The final pre-execution review, clean-main final-local audit alignment fix, and
bounded real workspace-write canary evidence are pushed to `origin/main`. The
real canary passed for target `tmp/codex-cli-write-canary.txt`, its evidence is
recorded at `docs/evidence/codex-cli-workspace-write-real-canary-latest.json`,
and the temporary canary file has been removed. The post-canary receipt plus
rollback verification gate is pushed to `origin/main`, and its clean-main audit
passed without running another workspace-write canary. The Codex CLI taskbook,
configuration, user-posture, and source and release package boundary fixes are
present on current mainline. The read-only productization acceptance package,
controlled provider execution taskbook boundary, taskbook review boundary, and
provider execution runner boundary are current. The controlled provider
execution dispatch preflight matrix and controlled provider execution
dispatcher boundary are current. The dispatcher is the gated pre-runner handoff
layer before the provider execution runner boundary.

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
- Verify approval consumption, provider dispatch preconditions, and sanitized
  audit surfaces through local audit matrix evidence.
- Verify the real Codex CLI read-only path against current local `main`.
- Verify one bounded real Codex CLI workspace-write canary against current
  `main`.
- Verify the post-canary receipt and rollback cleanup state without running
  another workspace-write canary.
- Verify the read-only productization acceptance package as a local-only,
  summarized audit layer over the existing evidence chain.

Still blocked or disabled:

- Real provider execution as a general runtime mode.
- Real Codex CLI execution as a general runtime mode.
- Workspace-write execution beyond the single recorded bounded canary.
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
- `docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md`
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
- `READONLY_PRODUCTIZATION_ACCEPTANCE_RECORDED`
- `APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX_RECORDED`

Primary evidence:

- `docs/governance/PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX.md`
- `docs/governance/READONLY_PRODUCTIZATION_ACCEPTANCE.md`
- `docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md`
- `docs/evidence/codex-cli-formal-readonly-integration-readiness.json`
- `docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json`
- `docs/evidence/codex-cli-real-readonly-smoke.json`

These matrices are local-only. They do not authorize provider execute,
workspace-write, real CLI invocation, push, release, or tag.
The productization acceptance entry point is
`npm run governance -- audit readonly-productization`; it is also local-only and does not
authorize evidence refresh or any real execution path. It does not authorize
real Codex CLI, provider execution, workspace-write, or evidence refresh.

## Current Reviewable Slice

Current local closeout slice:

- Keep the read-only productization acceptance package green on clean aligned
  `main`.
- Keep the PR-22A controlled provider execution taskbook and review boundary
  green:
  `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- Review the controlled provider execution dispatch preflight matrix before any
  pre-runner dispatcher implementation:
  `docs/governance/CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX.md`
- Preserve the current boundary: source and release package boundary fixes are
  local governance hardening, not authorization to publish or release.
- Preserve the current boundary: the recorded canary proves one bounded local
  workspace-write execution only. It does not imply general workspace-write,
  general provider execution, push, release, tag, or external service write.
- Current design artifact:
  `docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md`
- Current packet checklist artifact:
  `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md`
- Current authorization packet draft artifact:
  `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET.md`
- Current execution gate artifact:
  `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE.md`
- Current pre-execution review artifact:
  `docs/governance/FUTURE_CODEX_CLI_CANARY_PRE_EXECUTION_REVIEW.md`
- Current real canary evidence:
  `docs/evidence/codex-cli-workspace-write-real-canary-latest.json`
- Current post-canary receipt gate:
  `docs/governance/POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE.md`
- Current local audit:
  `npm run governance -- audit post-canary-receipt-rollback-gate`
- Current read-only productization audit:
  `npm run governance -- audit readonly-productization`
- Current controlled provider execution taskbook:
  `PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_RECORDED`
- Current controlled provider execution dispatch preflight matrix:
  `CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX_RECORDED`
- Current controlled provider execution dispatcher boundary:
  `controlled_readonly_pre_runner_dispatcher`

## Following Phases

After local review/evidence hardening:

1. Controlled provider execution.
   - Keep PR-22A taskbook and review boundary green.
   - Keep the controlled provider execution dispatch preflight matrix and
     controlled provider execution dispatcher boundary green before any deeper
     Codex CLI execution opt-in or worker-loop integration.
   - Keep explicit execution mode separate from dry-run mode.
   - Require valid permits, plan hash binding, registry selection, preflight
     artifact binding, and runner invariant checks.
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

Current portable validation baseline: `content digest only`.

The roadmap no longer records local absolute paths, Windows-only shell probes,
old branch names, push ranges, or single-machine commit anchors as current
validation authority. Machine authority lives in
`docs/current/state-sync-record.json`; operator display lives in
`docs/current/CURRENT_STATE.md`. PR branches should use GitHub CI's
`pull_request` State Sync Audit or an explicit local pull-request context
simulation for state-sync. Bare local state-sync is a main-context check unless
the event context is simulated.

Portable validation for roadmap, validation-policy, and governance-boundary
changes should prefer repository-relative commands:

- `git diff --check`
- `npm run docs:governance`
- `node --import tsx scripts/sync-state-sync-display.ts --check`
- `npm run governance -- list`
- `npm run governance -- audit execution-boundary-current-surface`
- `npm run governance -- audit controlled-provider-execution-dispatch-preflight-boundary`
- `npm run governance -- audit controlled-provider-execution-dispatcher-boundary`

For the controlled provider execution dispatch preflight matrix, targeted local
validation is:

- `npx tsx --test tests/controlled-provider-execution-dispatch-preflight-boundary-audit.test.ts`
- `npm run governance -- audit controlled-provider-execution-dispatch-preflight-boundary`

For the controlled provider execution dispatcher boundary, targeted local
validation is:

- `npx tsx --test tests/controlled-provider-dispatcher.test.ts tests/controlled-provider-execution-dispatcher-boundary-audit.test.ts`
- `npm run governance -- audit controlled-provider-execution-dispatcher-boundary`

For runtime changes, run targeted tests plus:

- `npm run typecheck`
- `npm test`
- `npm run build`
