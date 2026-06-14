# PR-18B Formal Real Read-only Smoke Final Preflight

## 1. Scope

PR-18B records the final local preflight gate before any future formal real
Codex CLI read-only smoke execution.

This PR does not set the future execution operator flag, does not run the real
Codex CLI, does not authorize provider execute, does not authorize
workspace-write, does not authorize local command execution, does not authorize
protected remote execution, and does not authorize push, release, or tag.

## 2. Entry Point

Local acceptance command:

- `npm run acceptance:formal-real-readonly-smoke-final-preflight`

Evidence:

- `docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json`

## 3. Required Prior Evidence

The final preflight depends on:

- `docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json`
- `docs/governance/PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET.md`
- `docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md`

## 4. Required Fresh Validation Chain

Before a later task may run the real read-only smoke, rerun and inspect:

- `git status --short`
- `git branch -vv`
- `git rev-list --left-right --count HEAD...origin/main`
- `npm run typecheck`
- `npx tsx --test tests\formal-real-readonly-smoke-execution-authorization-acceptance.test.ts`
- `npx tsx --test tests\formal-real-readonly-smoke-final-preflight-acceptance.test.ts`
- `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts`
- `npm run acceptance:formal-real-readonly-smoke-execution-auth`
- `npm run acceptance:formal-real-readonly-smoke-final-preflight`
- `npm run audit:formal-real-readonly-smoke-local`
- `npm test`

Required results:

- worktree clean
- branch `main`
- local branch not behind `origin/main`
- all validation commands pass
- provider execute calls remain `0`
- real Codex CLI calls remain `0`
- workspace-write execute calls remain `0`

## 5. Execution Boundary For Later Task

A later real smoke execution task must still preserve:

- provider id: `codex-cli`
- sandbox: `read-only`
- side effect class: `read_only`
- approval policy: `never`
- evidence path choice: `default`
- provider registry selection
- provider execution metadata
- provider execution permit
- formal dispatch boundary

## 6. Result

Result:

- `PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_RECORDED`

The project now has the final local preflight gate before a separately
authorized real read-only smoke execution.
