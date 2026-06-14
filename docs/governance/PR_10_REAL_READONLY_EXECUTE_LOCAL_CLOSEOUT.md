# PR-10 Real Read-only Execute Local Closeout

## 1. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Audit date: 2026-06-14
- Mode: local audit and local evidence only

## 2. Branch / HEAD / Ahead / Worktree

- Branch: `main`
- HEAD before closeout document commit: `7d05b71 test(provider): add real read-only dispatch acceptance`
- Ahead before closeout document commit: `2`
- Worktree before closeout document commit: clean
- Remote base: `origin/main`

## 3. Local Commit Range Summary

Audited local range: `origin/main..HEAD`

- `7d05b71 test(provider): add real read-only dispatch acceptance`
- `d826750 feat(provider): guard real read-only codex cli execute`

Coverage mapping:

- PR-10A real read-only execute guard: `d826750`
- PR-10B read-only real dispatch acceptance, fake-only evidence: `7d05b71`

## 4. Changed Files Summary

`git diff --stat origin/main..HEAD` reports 7 changed files, 1013 insertions, and 4 deletions.

Changed files:

- `docs/evidence/codex-cli-real-readonly-dispatch-acceptance.json`
- `package.json`
- `packages/host-dispatcher/src/index.ts`
- `packages/providers/codex-cli/src/index.ts`
- `scripts/run-real-readonly-dispatch-acceptance.ts`
- `tests/codex-cli-provider.test.ts`
- `tests/real-readonly-dispatch-acceptance.test.ts`

## 5. Capability Summary

The local PR-10 range adds guarded real-mode read-only provider execution without invoking a real Codex CLI process.

Implemented capabilities:

- `CodexCliExecutorProvider` now distinguishes default fake mode from explicit `executionMode: "real"`.
- Default provider execution remains disabled unless `executionEnabled: true`.
- Real mode requires explicit `realExecutionAllowed: true`.
- Real mode requires a positive timeout.
- Real mode still requires a valid read-only execution plan and approved provider execution permit before spawn.
- Real mode requires sanitized guard metadata carrying provider registry selection and environment preflight status.
- Registry provider id, manifest hash, kind, enabled state, and preflight readiness mismatches reject before spawn.
- Host dispatcher can pass sanitized provider execution metadata through to provider execution context.
- Real read-only dispatch acceptance proves the chain with fake spawner only.

## 6. Real Read-only Guard Summary

Verified guard behavior:

- Missing real execution allowance is rejected before spawn.
- Missing real execution guard metadata is rejected before spawn.
- Registry manifest mismatch is rejected before spawn.
- Preflight blocked / not ready state is rejected before spawn.
- Workspace-write modified runner result is rejected before provider spawn.
- Successful acceptance uses one injected fake spawner call.

The acceptance chain remains:

`runner result -> registry selection -> provider plan -> provider execution permit -> real-mode guard -> fake spawner -> sanitized result`

## 7. Evidence Files

- `docs/evidence/codex-cli-real-readonly-dispatch-acceptance.json`
- `docs/governance/PR_10_REAL_READONLY_EXECUTE_LOCAL_CLOSEOUT.md`

Evidence summary:

- `runnerReady: true`
- `registrySelectionOk: true`
- `realModeGuardProvided: true`
- `permitIssued: true`
- `dispatchOk: true`
- `fakeSpawnerUsed: true`
- `guardMissingBlocked: true`
- `registryMismatchBlocked: true`
- `workspaceWriteBlocked: true`
- `noRealCodexCli: true`
- `leakCheckPassed: true`
- `successSpawnCalls: 1`
- `guardMissingSpawnCalls: 0`
- `registryMismatchSpawnCalls: 0`
- `workspaceWriteSpawnCalls: 0`

## 8. Validation Matrix

| Check | Result |
| --- | --- |
| `git status --short` | pass, clean before closeout document |
| `git branch -vv` | pass, `main` ahead 2 before closeout document |
| `git log --oneline -12` | pass, PR-10A..PR-10B local range reviewed |
| `git diff --stat origin/main..HEAD` | pass, 7 files reviewed |
| `git diff --name-only origin/main..HEAD` | pass, changed file list reviewed |
| `npm run typecheck` | pass |
| `npm run acceptance:real-readonly-dispatch` | pass |
| `npx tsx --test tests\real-readonly-dispatch-acceptance.test.ts` | pass, 2 tests |
| `npx tsx --test tests\codex-cli-provider.test.ts` | pass, 25 tests |
| `npx tsx --test tests\host-dispatcher.test.ts` | pass, 16 tests |
| `npm test` | pass, 823 tests |
| Evidence leak search | pass, no matches |

Evidence leak search:

- Target: `docs\evidence\codex-cli-real-readonly-dispatch-acceptance.json`
- Marker set: raw execution fields and common secret marker strings.
- Result: no matches.

## 9. Explicit Non-actions

- push: no
- release: no
- tag: no
- real Codex CLI call: no
- workspace-write execute: no
- local_command execute: no
- protected_remote execute: no
- BHA integration: no
- VCP integration: no
- provider registry production dispatch: no

## 10. Current Classification

- SCOPED_RC_READY: YES, local-only
- PRODUCTION_READY: NO
- AGENT_OS_COMPONENT_READY: PARTIAL
- REAL_EXECUTION_READY: READ_ONLY_GUARDED_FAKE_ONLY
- REAL_CODEX_CLI_READY: NO
- WORKSPACE_WRITE_READY: NO
- SECURITY_BOUNDARY_READY: NO
- RELEASE_READY: NO
- PUSH_READY: REVIEW_REQUIRED

## 11. Recommended Next Step

Run PR-10 push-readiness review for the local range.
Do not push until Commander grants explicit push authorization.
Do not run real Codex CLI execute without a separate explicit operator task.
Do not open workspace-write.
