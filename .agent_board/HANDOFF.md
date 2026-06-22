# Handoff

Current scope: PR-22A minimal controlled read-only provider execution is
implemented on a fresh branch from clean `main`.

Current status:

- Branch: `feature/pr-22a-controlled-provider-execution`
- State baseline: `b531807`
- Upstream: `origin/feature/pr-22a-controlled-provider-execution`
- Current state source: `docs/current/CURRENT_STATE.md`
- PR-22A taskbook source:
  `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`
- Work in progress: commit the P1 validation payload state refresh and rerun
  clean-worktree `npm run validate:pr`.

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
- post-review failure-surface handling now sanitizes provider failure classes,
  provider reasons, and thrown execution messages before they reach runner
  results, events, reports, or evidence
- P1 validation payload follow-up now sanitizes validation reasons and thrown
  validation messages before controlled read-only result, event, and report
  emission
- pre-review validation passed: `npm run validate:pr`, `npm run typecheck`,
  targeted runner/provider/host tests, `npm run governance -- acceptance
  controlled-readonly-provider-execution`, targeted state-sync tests, full
  `npm test`, and `npm run build`
- post-review regression validation passed targeted provider-runner tests
  `19 / 19`, typecheck, full tests `1125 / 1125`, and build
- final clean-worktree `npm run validate:pr` passed before the P1 validation
  payload follow-up; typecheck, full tests `1125 / 1125`, build, and
  state-sync passed
- P1 validation payload follow-up targeted provider-runner tests passed
  `21 / 21`, and `npm run typecheck` passed

Hard boundaries:

- Do not treat bounded canary scope as `general_workspace_write`.
- Do not run another real Codex CLI task.
- Do not run workspace-write execution.
- Do not refresh evidence unless the current task explicitly requires it.
- Do not push to `main`, release, tag, deploy, or write to external services
  without a separate explicit instruction.
- Do not modify secrets or env files.

Next safe action:

1. commit the P1 validation payload state refresh
2. rerun clean-worktree `npm run validate:pr`
3. push the branch only after explicit external-write confirmation
