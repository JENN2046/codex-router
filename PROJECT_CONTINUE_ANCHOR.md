# Project Continue Anchor

Date: 2026-06-15
Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router`

## Current Status

This workspace is the `codex-router` SDK and Agent OS governance runtime
preparation workspace. It is a Git repository. Normal implementation work should
use a focused branch, not direct edits on `main`.

Current synchronized baseline:

- `main` is aligned with `origin/main` at `97304d2`.
- Latest commit: `docs: refresh roadmap and continue anchor`.
- Local validation on 2026-06-15:
  - `npm run typecheck` passed.
  - `npm test` passed: `999 / 999`.
  - `npm run build` passed.

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

Approval consumption is no longer merely deferred. It is implemented and locally
closed out for the bounded read-only planning path.

Primary current references:

- `docs/agent-os-transformation/current-roadmap-20260610.md`
- `docs/governance/APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT.md`
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

The read-only formal integration matrix is local-only. It does not authorize
provider execute, workspace-write, real CLI invocation, push, release, or tag.

## Current Safe Next Step

When the user says "continue project" or a similar continuation request in this
folder, continue from the current mainline facts, not the older April CLI-host
anchor.

The next safe local action is:

1. Review or add local-only acceptance evidence around approval consumption.
2. Review provider dispatch preconditions, especially reject-before-spawn paths.
3. Review sanitized audit surfaces for events, artifacts, telemetry, tool input
   previews, result envelopes, and workspace-write guard evidence.

Good first local slice:

- Add or refresh a small audit matrix tying approval consumption, provider
  dispatch preconditions, and redaction surfaces to existing tests and evidence.

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
npm run typecheck
npm test
npm run build
```

For docs-only anchor updates, inspect the diff and confirm the worktree state.

## One-Line Resume Prompt

Continue from `main` at `97304d2`: approval issuance and read-only approval
consumption are implemented; read-only formal integration evidence is recorded;
next safe local work is acceptance/review evidence for approval consumption,
provider dispatch preconditions, and sanitized audit surfaces, without opening
real execution, workspace-write, or remote actions.
