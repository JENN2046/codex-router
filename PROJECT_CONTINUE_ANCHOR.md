# Project Continue Anchor

Date: 2026-06-15
Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router`

## Current Status

This workspace is the `codex-router` SDK and Agent OS governance runtime
preparation workspace. It is a Git repository. Normal implementation work should
use a focused branch, not direct edits on `main`.

Current evidence baseline:

- `main` is aligned with `origin/main` at `fe181cb`.
- Latest mainline commit: `docs: refresh execution gate push anchors`.
- Current local working branch: `docs/future-canary-pre-execution-review`.
- Local validation on 2026-06-15:
  - `npm run typecheck` passed.
  - `npm test` passed: `1003 / 1003`.
  - `npm run build` passed.
  - `npm run audit:approval-consumption-dispatch-matrix` passed on clean
    `main`.
  - `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`
    passed and refreshed `docs/evidence/codex-cli-real-readonly-smoke.json`.
  - read-only real smoke chain audits passed on clean `main`.
  - `npx tsx --test tests\future-codex-cli-canary-authorization-packet-audit.test.ts`
    passed on the packet draft branch.
  - `npm run typecheck` passed on the packet draft branch.
  - `npm run audit:future-codex-cli-canary-authorization-packet` passed on
    clean local `main` after the fast-forward merge.
  - `git push origin main` succeeded after one retry, pushing `4db8174..c73fa1b`.
  - `git push origin main` later pushed `c73fa1b..19b3a5e`.
  - `npx tsx --test tests\future-codex-cli-canary-execution-gate-audit.test.ts`
    passed on the execution gate design branch.
  - `npm run typecheck` passed on the execution gate design branch.
  - `npm run audit:future-codex-cli-canary-execution-gate` passed on clean
    local `main` after the fast-forward merge.
  - `git push origin main` pushed `19b3a5e..c679c58`.
  - `git push origin main` pushed `c679c58..fe181cb`.
  - `npx tsx --test tests\future-codex-cli-canary-pre-execution-review-audit.test.ts`
    passed on the pre-execution review branch.
  - `npm run typecheck` passed on the pre-execution review branch.

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
- fresh real Codex CLI read-only smoke evidence for current local `main`

Approval consumption is no longer merely deferred. It is implemented and locally
closed out for the bounded read-only planning path.

Primary current references:

- `docs/agent-os-transformation/current-roadmap-20260610.md`
- `docs/governance/APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT.md`
- `docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md`
- `docs/governance/PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX.md`
- `docs/evidence/codex-cli-real-readonly-smoke.json`
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

The fresh read-only real Codex CLI smoke for current local `main` has passed
under exact operator authorization. The controlled execution gate design, future
canary execution packet checklist, future canary execution authorization packet
draft/review, and post-merge anchor cleanup are merged and pushed to
`origin/main`. The future canary execution gate design and post-merge execution
gate anchors are also merged and pushed to `origin/main`. The gate remains
draft/review only and does not enable workspace-write or general provider
execution.

Current design artifact:

- `docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE.md`
- `docs/governance/FUTURE_CODEX_CLI_CANARY_PRE_EXECUTION_REVIEW.md`

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
npm run audit:controlled-execution-gate-design
npm run audit:future-codex-cli-canary-packet-checklist
npm run audit:future-codex-cli-canary-authorization-packet
npm run audit:future-codex-cli-canary-execution-gate
npm run audit:future-codex-cli-canary-pre-execution-review
npm run smoke:readonly:real
npm run typecheck
npm test
npm run build
```

For docs-only anchor updates, inspect the diff and confirm the worktree state.

## One-Line Resume Prompt

Continue from `main` / `origin/main` at `fe181cb`: approval issuance,
read-only approval consumption, read-only formal integration evidence, approval
consumption dispatch audit matrix evidence, fresh real read-only Codex CLI smoke
evidence, controlled execution gate design, future canary execution packet
checklist, future canary authorization packet draft/review, and post-merge
anchors are pushed. Future canary execution gate design and execution-gate
post-merge anchors are pushed. Current local branch
`docs/future-canary-pre-execution-review` designs the final pre-execution review
before exact operator authorization. Do not open workspace-write, general
provider execution, or unrelated remote actions.
