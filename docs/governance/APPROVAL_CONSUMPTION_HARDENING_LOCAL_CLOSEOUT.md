# Approval Consumption Hardening Local Closeout

## 1. Purpose

This document records a local-only closeout for approval permit consumption
hardening across the Agent OS local runtime and its public wrappers.

It is not a push-readiness receipt. It is not an execution authorization,
release note, tag note, workspace-write approval, or real Codex CLI receipt.

## 2. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Branch: `main`
- Local closeout date: 2026-06-14
- Mode: local implementation and validation only

## 3. Local Scope

This local hardening stage covers approval permit issuance and consumption for
read-only governed plans that start in `waiting_approval`.

Included commits:

- `d57dc3c feat(governance): load approval permits for eligibility`
- `1667b6e feat(governance): consume approval permits in local runtime`
- `be5ad45 test(governance): declare approval consumption output`
- `6dd9cd7 test(governance): cover approval consumption surfaces`
- `052be7e test(governance): cover revoked approval consumption`
- `c373f7f test(governance): cover approval consumption context gate`
- `b8ec8d9 test(governance): cover stale approval consumption`
- `bed0f35 test(governance): cover approval audit on public surfaces`

Changed implementation surface in this stage:

- `packages/execution-eligibility/src/index.ts`
- `packages/kernel-store/src/index.ts`
- `packages/protocol-mcp/src/agent-os-local-runtime.ts`
- `packages/protocol-mcp/src/agent-os-server-manifest.ts`

Changed test surface in this stage:

- `tests/execution-eligibility.test.ts`
- `tests/kernel-store.test.ts`
- `tests/agent-os-mcp-local-runtime.test.ts`
- `tests/agent-os-mcp-server-manifest.test.ts`
- `tests/agent-os-sdk.test.ts`
- `tests/agent-os-cli.test.ts`
- `tests/agent-os-app-server.test.ts`

## 4. Covered Behavior

Confirmed behavior:

- approval permits can be loaded from a permit store for eligibility
- approved permits can move a `waiting_approval` provider plan to `planned`
- runtime output declares the consumed provider plan id and consumption reasons
- SDK, CLI, and App Server wrappers surface the same shared runtime behavior
- revoked stored permits are recorded as rejected during consumption
- expired stored permits are recorded as rejected during consumption
- plan-hash-mismatched stored permits are recorded as rejected during consumption
- missing planning context prevents consumption and leaves the waiting plan intact
- rejected permit audit is preserved across SDK, CLI, and App Server wrappers

The consuming approval call still creates a new permit. Historical rejected
permit candidates do not authorize consumption by themselves.

## 5. Boundary Review

Still closed:

- real Codex CLI invocation
- provider execute
- workspace-write execute
- workspace-write canary write
- local command enablement
- protected remote enablement
- external side effects
- push, release, tag, publish

Public wrapper boundaries confirmed:

- SDK wrapper uses the shared local runtime only
- CLI wrapper does not spawn a CLI process in these tests
- App Server wrapper does not start a live server or access the network
- all tested approval consumption paths report no real provider execution

## 6. Validation

Validation run for this local stage:

- `npx tsx --test tests\agent-os-mcp-local-runtime.test.ts`
- `npx tsx --test tests\approval-permit.test.ts tests\execution-eligibility.test.ts`
- `npx tsx --test tests\agent-os-sdk.test.ts tests\agent-os-cli.test.ts tests\agent-os-app-server.test.ts tests\agent-os-mcp-local-runtime.test.ts`
- `npm run typecheck`
- `npm test`
- `git diff --check`

Observed passing results:

- MCP local runtime tests: `19 / 19`
- approval permit and execution eligibility tests: `32 / 32`
- public surface approval tests: `48 / 48`
- full test suite: `890 / 890`
- typecheck: passed
- diff check: passed

## 7. Result

Result:

- `APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT_COMPLETE`

The local approval consumption chain is better covered and remains bounded to
read-only planning and audit behavior. This closeout does not authorize any
remote action or workspace-write execution.

## 8. Next Safe Action

Next safe local action:

- continue with local-only review or acceptance evidence around approval
  consumption, provider dispatch preconditions, or sanitized audit surfaces.

The next action must not be:

- real Codex CLI invocation
- provider execute wiring beyond existing guarded fake paths
- workspace-write execution
- release or tag
