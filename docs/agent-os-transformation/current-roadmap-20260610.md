# Agent OS Current Roadmap

Date: 2026-06-16
Current base: `main` and `origin/main` at `29abcd0`
Status: local governance foundation, approval issuance, approval consumption,
read-only formal integration evidence, and approval consumption dispatch audit
matrix evidence are merged and locally validated. A fresh real read-only Codex
CLI smoke has passed on current local `main`. The future Codex CLI canary
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
present on current `main`. The read-only productization acceptance package is
now the current local closeout layer.

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
`npm run audit:readonly-productization`; it is also local-only and does not
authorize evidence refresh or any real execution path.

## Current Reviewable Slice

Current local closeout slice:

- Keep the read-only productization acceptance package green on clean aligned
  `main`.
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
  `npm run audit:post-canary-receipt-rollback-gate`
- Current read-only productization audit:
  `npm run audit:readonly-productization`

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

Latest local validation on 2026-06-15 through `main` / `origin/main` at
`5566777`:

- `npm run audit:approval-consumption-dispatch-matrix` passed on clean `main`.
- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real` passed.
- read-only real smoke chain audits passed on clean `main`.
- `npm run audit:controlled-execution-gate-design` passed on clean `main`.
- `npm run audit:future-codex-cli-canary-packet-checklist` passed on clean
  `main`.
- `npx tsx --test tests\future-codex-cli-canary-authorization-packet-audit.test.ts`
  passed on `docs/future-canary-authorization-packet`.
- `npm run audit:future-codex-cli-canary-authorization-packet` passed on clean
  local `main` at `57ae4a7`.
- `git push origin main` succeeded after one retry, pushing `4db8174..c73fa1b`.
- `git push origin main` pushed `c73fa1b..19b3a5e`.
- `npx tsx --test tests\future-codex-cli-canary-execution-gate-audit.test.ts`
  passed on `docs/future-canary-execution-gate`.
- `npm run audit:future-codex-cli-canary-execution-gate` passed on clean local
  `main` at `6d05762`.
- `git push origin main` pushed `19b3a5e..c679c58`.
- `git push origin main` pushed `c679c58..fe181cb`.
- `npx tsx --test tests\future-codex-cli-canary-pre-execution-review-audit.test.ts`
  passed on `docs/future-canary-pre-execution-review`.
- `npm run audit:future-codex-cli-canary-pre-execution-review` blocked on clean
  local `main` only because local `main` is not aligned with `origin/main`.
- `git push origin main` pushed `fe181cb..3a71acc`.
- `npm run audit:future-codex-cli-canary-pre-execution-review` passed on
  aligned clean `main`.
- `npm run audit:workspace-write-real-canary-final-local` passed after the
  clean-main gate alignment fix.
- `npm test` passed: `1027 / 1027`.
- `git push origin main` pushed `3a71acc..590dbd4`.
- Bounded real Codex CLI workspace-write canary passed:
  - target file: `tmp/codex-cli-write-canary.txt`
  - evidence:
    `docs/evidence/codex-cli-workspace-write-real-canary-latest.json`
  - execution status: `completed`
  - exit code: `0`
  - blocking reasons: `[]`
- Post-canary `Test-Path tmp\codex-cli-write-canary.txt` returned `False`.
- `git push origin main` pushed `590dbd4..5e24281`.
- `git push origin main` pushed `5e24281..5642b43`.
- `npx tsx --test tests\post-canary-receipt-rollback-verification-gate-audit.test.ts`
  passed: `5 / 5`.
- `npm run typecheck` passed after adding the post-canary receipt rollback gate
  audit.
- `npm test` passed: `1032 / 1032`.
- `npm run build` passed.
- `git push origin main` pushed `5642b43..5566777`.
- `npm run audit:post-canary-receipt-rollback-gate` passed on clean aligned
  `main`:
  - provider execute calls during review: `0`
  - real Codex CLI calls during review: `0`
  - workspace-write execute calls during review: `0`
  - canary file writes during review: `0`
  - additional canary runs during review: `0`
- `npm run typecheck` passed.
- `npm test` passed: `1032 / 1032`.
- `npm run build` passed.

For docs-only roadmap updates, inspect the diff and keep the worktree clean.
For runtime changes, run targeted tests plus:

- `npm run typecheck`
- `npm test`
- `npm run build`
