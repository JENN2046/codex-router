# Project Continue Anchor

Date: 2026-06-15
Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router`

## Current Status

This workspace is the `codex-router` SDK and Agent OS governance runtime
preparation workspace. It is a Git repository. Normal implementation work should
use a focused branch, not direct edits on `main`.

Current evidence baseline:

- `origin/main` includes the evidence matrix at `24c3508`.
- Local `main` includes a post-push anchor cleanup commit and may be ahead of
  `origin/main` until the user explicitly authorizes another push.
- Local validation on 2026-06-15:
  - `npm run typecheck` passed.
  - `npm test` passed: `1003 / 1003`.
  - `npm run build` passed.
  - `npm run audit:approval-consumption-dispatch-matrix` passed on clean
    `main`.

## Current Mainline Facts

Agent OS now includes:

- local governance kernel and eligibility composition
- local runtime with run, step, event, and artifact flow
- provider planning and dry-run provider execution
- durable local stores and scheduler leases
- governed public wrappers for MCP-local, CLI, SDK, and App Server callers
- local approval permit issuance through `agentos.approve_run`
- local approval permit consumption for read-only governed plans
- read-only formal Codex CLI integration readiness evidence
- approval consumption / provider dispatch / sanitized audit matrix evidence

Approval consumption is no longer merely deferred. It is implemented and locally
closed out for the bounded read-only planning path.

Primary current references:

- `docs/agent-os-transformation/current-roadmap-20260610.md`
- `docs/governance/APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT.md`
- `docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md`
- `docs/governance/PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX.md`
- `docs/phase-21-closeout-audit-20260611.md`

## Important Boundaries

Still closed unless a future task gives exact explicit authorization:

- real provider execution as a general runtime mode
- real Codex CLI execution as a general runtime mode
- workspace-write execution
- live MCP server connection
- live A2A network connection
- live App Server process
- push, release, tag, publish, or external service writes
- secret, credential, or `.env` changes

The read-only formal integration matrix and approval consumption dispatch audit
matrix are local-only. They do not authorize provider execute, workspace-write,
real CLI invocation, push, release, or tag.

## Current Safe Next Step

When the user says "continue project" or a similar continuation request in this
folder, continue from the current mainline facts, not the older April CLI-host
anchor.

The next safe local action is a fresh read-only real Codex CLI smoke preflight
for the current `main`, but only after exact explicit operator authorization.

Required authorization token:

- `APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A`

## Remote Or Side-effectful Actions

Do not perform remote actions without explicit approval.

The Phase 21 closeout audit says GitHub issue #2 can be closed or commented on,
but that is a remote action. Ask for explicit maintainer approval before using
GitHub, pushing, opening a PR, closing an issue, or adding an issue comment.

## Useful Files

- `packages/protocol-mcp/src/agent-os-local-runtime.ts`
- `packages/execution-eligibility/src/index.ts`
- `packages/provider-execution-runner/src/index.ts`
- `packages/host-dispatcher/src/index.ts`
- `packages/redaction/src/index.ts`
- `packages/kernel-store/src/jsonl-event-log.ts`
- `packages/artifact-store/src/index.ts`
- `packages/tool-invocation-planner/src/index.ts`
- `packages/desktop-live-adapter/src/result-envelope.ts`
- `packages/workspace-write-guard/src/index.ts`
- `tests/agent-os-mcp-local-runtime.test.ts`
- `tests/execution-eligibility.test.ts`
- `tests/host-dispatcher.test.ts`
- `tests/redaction.test.ts`
- `tests/jsonl-event-log.test.ts`
- `tests/artifact-store.test.ts`
- `tests/tool-invocation-planner.test.ts`
- `tests/workspace-write-guard.test.ts`

## Validation Commands

Use existing scripts only:

```powershell
npm run audit:approval-consumption-dispatch-matrix
npm run typecheck
npm test
npm run build
```

For docs-only anchor updates, inspect the diff and confirm the worktree state.

## One-Line Resume Prompt

Continue from `origin/main` evidence baseline `24c3508`, plus any local
post-push anchor cleanup on `main`: approval issuance, read-only approval
consumption, read-only formal integration evidence, and approval consumption
dispatch audit matrix evidence are merged to `origin/main`; next gated action is
a fresh real read-only Codex CLI smoke for current local `main` after exact
operator authorization, without opening workspace-write, provider execution, or
unrelated remote actions.
