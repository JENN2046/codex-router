# PR-17A Formal Real Read-only Smoke Taskbook

## 1. Scope

PR-17A records the formal gate for a future real Codex CLI read-only smoke
after the PR-16 formal dispatch boundary closeout.

This taskbook is local-only. It does not authorize invoking the real Codex CLI,
does not authorize provider execute, does not authorize workspace-write, does
not authorize local command execution, does not authorize protected remote
execution, and does not authorize push, release, or tag.

## 2. Exact Future Gate

Exact token:

- `APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_PR_17A`

Exact taskbook:

- `docs/governance/PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK.md`

Exact future command shape:

- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`

Required local acceptance command:

- `npm run governance -- acceptance formal-real-readonly-smoke-taskbook`

Required acceptance evidence:

- `docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json`

Required future smoke evidence path choice:

- `default`

## 3. Required Prior Evidence

The next stage may only be considered after these local artifacts remain valid:

- `docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json`
- `docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json`
- `docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md`
- `npm run governance -- acceptance real-readonly-smoke-auth`
- `npm run governance -- acceptance formal-readonly-dispatch-boundary`
- `npm run governance -- audit formal-readonly-dispatch-boundary-local`

## 4. Required Formal Boundary

The future real read-only smoke must remain inside these boundaries:

- provider id: `codex-cli`
- sandbox: `read-only`
- side effect class: `read_only`
- approval policy: `never`
- provider registry selection is required
- provider execution metadata is required
- provider execution permit is required
- formal dispatch entry point is required
- local tests must continue to use injected fake spawner only
- evidence must remain summarized and sanitized

## 5. Required Fresh Preflight Before Future Execution

Before any separate authorization to run the future real read-only smoke, rerun:

- `git status --short`
- `git branch -vv`
- `git log --oneline -10`
- `npm run typecheck`
- `npx tsx --test tests\formal-real-readonly-smoke-taskbook-acceptance.test.ts`
- `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts`
- `npx tsx --test tests\real-readonly-smoke-authorization-acceptance.test.ts`
- `npx tsx --test tests\formal-readonly-dispatch-boundary-acceptance.test.ts`
- `npx tsx --test tests\host-dispatcher.test.ts`
- `npm run governance -- acceptance formal-real-readonly-smoke-taskbook`
- `npm run governance -- acceptance real-readonly-smoke-auth`
- `npm run governance -- acceptance formal-readonly-dispatch-boundary`
- `npm run governance -- audit formal-readonly-dispatch-boundary-local`

Required preflight results:

- worktree clean
- branch `main`
- local branch not behind `origin/main`
- typecheck pass
- targeted tests pass
- acceptance commands pass
- dispatch boundary audit passes
- no provider execute call made by PR-17A
- no real Codex CLI call made by PR-17A
- no workspace-write execute call made by PR-17A

## 6. Stop Conditions

Stop before future real CLI invocation if any of these are true:

- worktree is dirty
- branch is not `main`
- local branch is behind or diverged
- typecheck fails
- targeted tests fail
- acceptance or audit command fails
- requested command is not exact
- evidence path choice is not `default`
- requested scope includes workspace-write
- requested scope includes local command or protected remote execution
- requested scope includes release, tag, publish, push, or remote write
- authorization token is absent or not exact
- provider registry, provider metadata, or provider permit is missing

## 7. Non-authorization

This taskbook does not authorize:

- running `npm run smoke:readonly:real`
- setting `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1`
- invoking the real Codex CLI
- provider execute
- workspace-write execute
- local command execute
- protected remote execute
- pushing local commits
- creating releases or tags

The future real smoke requires a separate execution authorization after this
taskbook and its local evidence pass.

## 8. Result

Result:

- `PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK_RECORDED`

The project now has a formal taskbook for moving from fake-only formal dispatch
toward a separately authorized real read-only smoke. Workspace-write remains
closed.
