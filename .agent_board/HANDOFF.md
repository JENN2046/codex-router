# Handoff

Current scope: PR-22A minimal controlled read-only provider execution is
implemented on a fresh branch from clean `main`.

Current status:

- Branch: `feature/pr-22a-controlled-provider-execution`
- State baseline: `d15631a`
- Upstream: none
- Current state source: `docs/current/CURRENT_STATE.md`
- PR-22A taskbook source:
  `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- Work in progress: commit the refreshed current-state validation record and
  rerun clean-worktree audits if preparing a PR.

What changed in this line:

- clean `main` was updated with `git pull --ff-only origin main`
- `npm run governance -- audit readonly-productization` passed on `main`
- a fresh implementation branch was created from that baseline
- PR-22A taskbook review audit files were migrated onto the branch
- the prior CLI line closeout marker document was restored for the PR-22A
  review audit precondition
- `runProviderExecutionPlanControlledReadOnly` was added with explicit mode,
  `codex-cli` provider, read-only sandbox, approval policy `never`, metadata,
  and permit gates before provider execute
- `createCodexCliExecPlanFromRoutingDecision` now maps no-approval decisions to
  CLI approval policy `never`
- local acceptance uses a fake injected spawner and records real Codex CLI
  calls `0`, workspace-write execute calls `0`, and external write calls `0`
- validation passed: `npm run validate:pr`, `npm run typecheck`, targeted
  runner/provider/host tests, `npm run governance -- acceptance
  controlled-readonly-provider-execution`, targeted state-sync tests, full
  `npm test`, and `npm run build`

Hard boundaries:

- Do not treat bounded canary scope as `general_workspace_write`.
- Do not run another real Codex CLI task.
- Do not run workspace-write execution.
- Do not refresh evidence unless the current task explicitly requires it.
- Do not push to `main`, release, tag, deploy, or write to external services
  without a separate explicit instruction.
- Do not modify secrets or env files.

Next safe action:

1. commit the refreshed PR-22A current-state validation record
2. rerun clean-worktree `npm run governance -- audit state-sync`
3. rerun clean-worktree
   `npm run governance -- audit controlled-provider-execution-taskbook-review`
