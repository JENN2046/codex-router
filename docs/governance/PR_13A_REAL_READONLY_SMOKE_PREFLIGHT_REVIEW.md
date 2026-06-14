# PR-13A Real Read-only Smoke Preflight Review

## 1. Purpose

This document records the fresh local preflight before a possible future real
Codex CLI read-only smoke.

It is not a real smoke receipt. It is not an execution authorization,
push-readiness receipt, release note, tag note, workspace-write approval, or
production readiness claim.

## 2. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Branch: `main`
- Reviewed HEAD: `53b078a docs(governance): close out real readonly smoke authorization gate`
- Local status at review: worktree clean
- Tracking status at review: `origin/main: ahead 70`
- Mode: local preflight review only

## 3. Preflight Commands

State inspection:

- `git branch --show-current`: `main`
- `git status --short`: clean
- `git branch -vv`: `main` ahead of `origin/main` by `70`, no behind marker
- `git log --oneline --decorate -n 10`: reviewed

Validation:

- `npm run typecheck`: pass
- `npx tsx --test tests\codex-cli-real-readonly-smoke-script.test.ts tests\real-readonly-dispatch-acceptance.test.ts tests\host-dispatcher.test.ts tests\real-readonly-smoke-authorization-acceptance.test.ts tests\pr-13a-real-readonly-preflight-taskbook.test.ts`:
  pass, `30 / 30`
- `npm run acceptance:real-readonly-dispatch`: pass
- `npm run acceptance:real-readonly-smoke-auth`: pass
- `npm test`: pass, `900 / 900`

Evidence leak search:

- Targets:
  - `docs/evidence/codex-cli-real-readonly-dispatch-acceptance.json`
  - `docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json`
- Sensitive marker result: no hits for raw authorization token, raw command,
  raw prompt, raw args, raw stdout, raw stderr, raw task envelope, raw env, raw
  token, raw patch, API key markers, or bearer markers.

## 4. Boundary Review

Confirmed before any future real smoke:

- taskbook records exact future authorization token
- taskbook records exact future command shape
- authorization compatibility gate accepts only the exact PR-13A packet
- missing authorization is blocked
- broadened command is blocked
- workspace-write authorization is blocked
- push, release, and tag authorization are blocked
- real-readonly dispatch acceptance remains fake-only
- provider execute is not invoked by this preflight
- real Codex CLI is not invoked by this preflight
- workspace-write execute is not invoked by this preflight

Still closed:

- real Codex CLI invocation
- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1`
- `npm run smoke:readonly:real`
- workspace-write execute
- workspace-write canary write
- local command enablement
- protected remote enablement
- push, release, tag, publish

## 5. Authorization Status

The future real read-only smoke still requires a separate exact operator
authorization.

Required future token:

- `APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A`

Required future command shape:

- `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`

The future operator task must also state whether to use the default evidence
path or a one-off evidence path.

## 6. Result

Result:

- `PR_13A_REAL_READONLY_SMOKE_PREFLIGHT_REVIEW_PASS`

This preflight supports requesting a separate operator authorization for the
real read-only smoke. It does not itself authorize or run the smoke.
