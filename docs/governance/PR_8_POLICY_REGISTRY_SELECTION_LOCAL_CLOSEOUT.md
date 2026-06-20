# PR-8 Policy Registry Selection Local Closeout

## 1. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Audit date: 2026-06-14
- Mode: local audit and local evidence only

## 2. Branch / HEAD / Ahead / Worktree

- Branch: `main`
- HEAD before closeout document commit: `ac719cc test(acceptance): add policy registry selection evidence`
- Ahead before closeout document commit: `2`
- Worktree before closeout document commit: clean
- Remote base: `origin/main`

## 3. Local Commit Range Summary

Audited local range: `origin/main..HEAD`

- `ac719cc test(acceptance): add policy registry selection evidence`
- `da00954 feat(provider): wire registry selection into read-only routing`

Coverage mapping:

- PR-8A Policy / RoutingDecision to ProviderRegistry selection wiring: `da00954`
- PR-8B Policy registry selection acceptance evidence: `ac719cc`

## 4. Changed Files Summary

`git diff --stat origin/main..HEAD` reports 13 changed files, 1092 insertions, and 11 deletions.

Changed files:

- `docs/evidence/policy-registry-selection-acceptance.json`
- `package.json`
- `packages/contracts/src/index.ts`
- `packages/desktop-decision-runner/src/index.ts`
- `packages/host-dispatcher/src/index.ts`
- `packages/provider-registry/src/index.ts`
- `packages/routing-engine/src/index.ts`
- `scripts/run-policy-registry-selection-acceptance.ts`
- `tests/desktop-decision-runner.test.ts`
- `tests/host-dispatcher.test.ts`
- `tests/policy-registry-selection-acceptance.test.ts`
- `tests/provider-registry.test.ts`
- `tests/routing-engine.test.ts`

## 5. Capability Summary

The local PR-8 range wires Provider Registry selection into the read-only routing and dispatch control chain.

Implemented capabilities:

- `RoutingDecision.providerGrant` carries a `manifestHash` for `codex-cli`.
- `selectProviderForRoutingDecision()` maps a routing decision grant into Provider Registry selection.
- Provider selection summaries expose only safe metadata.
- `runDesktopDecision()` optionally accepts a `ProviderRegistry`.
- When a registry is supplied, runner results record `providerSelection`.
- Runner selection failures block as `blocked_preflight`.
- `dispatchReadOnlyRunnerResultToProvider()` optionally validates registry selection before provider planning.
- Dispatcher registry failures block before provider plan, permit, and provider run path.
- Policy registry selection acceptance evidence is reproducible with `npm run governance -- acceptance policy-registry-selection`.

## 6. Selection Fail-closed Summary

Verified fail-closed behavior:

- Missing provider is rejected.
- Disabled provider is rejected.
- Manifest hash mismatch is rejected.
- Missing provider grant is rejected.
- Workspace-write remains rejected before provider run path.
- Dispatcher registry mismatch blocks before provider plan and spawn counters move.

## 7. Evidence Files

- `docs/evidence/policy-registry-selection-acceptance.json`

Evidence summary:

- `routingGrantPresent: true`
- `routingGrantManifestHashRecorded: true`
- `runnerSelectionOk: true`
- `runnerMissingProviderBlocked: true`
- `runnerDisabledProviderBlocked: true`
- `runnerManifestMismatchBlocked: true`
- `dispatcherMissingProviderBlocked: true`
- `dispatcherDisabledProviderBlocked: true`
- `dispatcherManifestMismatchBlocked: true`
- `dispatcherBlockedBeforePlan: true`
- `workspaceWriteRemainsBlocked: true`
- `noRunPath: true`
- `leakCheckPassed: true`
- `providerPlanCalls: 0`
- `providerSpawnCalls: 0`

## 8. Validation Matrix

| Check | Result |
| --- | --- |
| `git status --short` | pass, clean before closeout document |
| `git branch -vv` | pass, `main` ahead 2 before closeout document |
| `git log --oneline -10` | pass, PR-8A..PR-8B local range reviewed |
| `git diff --stat origin/main..HEAD` | pass, 13 files reviewed |
| `git diff --name-only origin/main..HEAD` | pass, changed file list reviewed |
| `npm run typecheck` | pass |
| `npm run governance -- acceptance policy-registry-selection` | pass |
| `npx tsx --test tests\policy-registry-selection-acceptance.test.ts` | pass, 2 tests |
| `npx tsx --test tests\provider-registry.test.ts` | pass, 43 tests |
| `npx tsx --test tests\desktop-decision-runner.test.ts` | pass, 15 tests |
| `npx tsx --test tests\host-dispatcher.test.ts` | pass, 16 tests |
| `npx tsx --test tests\routing-engine.test.ts` | pass, 4 tests |
| `npx tsx --test tests\provider-core.test.ts` | pass, 12 tests |
| `npx tsx --test tests\codex-cli-provider.test.ts` | pass, 21 tests |
| `npm test` | pass, 812 tests |
| Evidence leak search | pass, no matches |

Evidence leak search command:

```powershell
Select-String -Path docs\evidence\policy-registry-selection-acceptance.json -Pattern "execute","invoke","function","secret","token","OPENAI_API_KEY","sk-","Bearer","raw env","raw command","prompt","args","stdout","stderr"
```

Result: no matches.

## 9. Explicit Non-actions

- push: no
- release: no
- tag: no
- real Codex CLI call: no
- workspace-write execute: no
- local_command execute: no
- protected_remote execute: no
- provider execute new path: no
- BHA integration: no
- VCP integration: no

## 10. Current Classification

- SCOPED_RC_READY: YES, local-only
- PRODUCTION_READY: NO
- AGENT_OS_COMPONENT_READY: PARTIAL
- REAL_EXECUTION_READY: READ_ONLY_FAKE_ONLY
- PROVIDER_REGISTRY_SELECTION_READY: LOCAL_RC
- SECURITY_BOUNDARY_READY: NO
- RELEASE_READY: NO
- PUSH_READY: REVIEW_REQUIRED

## 11. Recommended Next Step

Run PR-8 push-readiness review for the local range.
Do not push until Commander grants explicit push authorization.
Do not start real Codex CLI smoke until PR-8 is remote-confirmed.
Do not open workspace-write.
