# PR-6 Read-only Control Chain Local Closeout

## 1. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Audit date: 2026-06-14
- Mode: local audit and local evidence only

## 2. Branch / HEAD / Ahead / Worktree

- Branch: `main`
- HEAD before closeout document commit: `e141878 test(acceptance): add read-only control chain evidence`
- Ahead before closeout document commit: `12`
- Worktree before closeout document commit: clean
- Remote base: `origin/main`

## 3. Local Commit Range Summary

Audited local range: `origin/main..HEAD`

- `e141878 test(acceptance): add read-only control chain evidence`
- `f8529ed feat(dispatch): wire read-only runner results to provider dispatch`
- `09607aa feat(provider): issue permits for read-only dispatch`
- `287a89a fix(provider): require execution permits for codex cli runs`
- `556fd77 feat(provider): enable read-only codex cli execution path`
- `318f221 fix(desktop): require structured shell commands in governed mode`
- `dc80219 feat(routing): attach provider grants to decisions`
- `6392c57 fix(observability): sanitize telemetry alert context`
- `dab4fa1 fix(desktop): omit raw patch payloads`
- `889db42 fix(observability): sanitize telemetry context`
- `42fd8fe fix(audit): sanitize file audit details`
- `d76f35a fix(intent): distrust unproven low-risk hints`

Coverage mapping:

- PR-2 redaction core and output surfaces: `42fd8fe`, `889db42`, `6392c57`, `dab4fa1`
- PR-3 `RoutingDecision.providerGrant`: `dc80219`
- PR-4 desktop governed shell: `318f221`
- PR-6A Codex CLI provider read-only execute: `556fd77`
- PR-6B `ProviderExecutionPermit` required: `287a89a`
- PR-6C read-only permit issuance and dispatch: `09607aa`
- PR-6D runner result to provider dispatch: `f8529ed`
- PR-6E read-only control-chain acceptance evidence: `e141878`

## 4. Changed Files Summary

`git diff --stat origin/main..HEAD` reports 28 changed files, 3926 insertions, and 165 deletions.

Primary changed areas:

- Redaction and sanitized evidence: `packages/redaction`, `packages/audit-memory`, `packages/observability`, related tests.
- Routing and grants: `packages/routing-engine`, `packages/contracts`, `packages/kernel-contracts`, related tests.
- Desktop governed shell and live adapter envelopes: `packages/codex-desktop-bindings`, `packages/desktop-live-adapter`, related tests.
- Provider planning, permits, and dispatch: `packages/provider-core`, `packages/providers/codex-cli`, `packages/host-dispatcher`, related tests.
- Read-only acceptance evidence: `scripts/run-readonly-control-chain-acceptance.ts`, `docs/evidence/read-only-control-chain-acceptance.json`, `tests/read-only-control-chain-acceptance.test.ts`, `package.json`.

## 5. Capability Summary

Current local chain supports a constrained read-only provider path:

`TaskEnvelope -> classify -> route -> preflight -> approval -> providerGrant -> providerPlan -> executionPermit -> read-only fake dispatch -> sanitized result`

The chain is proven by `npm run acceptance:readonly-chain`.

Implemented capability boundaries:

- Default Codex CLI provider execution remains disabled.
- Enabled provider execution requires read-only plan invariants and an approved permit.
- Provider dispatch rejects invalid runner state before spawn.
- Read-only dry run does not spawn.
- Non-dry-run acceptance uses an injected fake spawner only.
- Dispatch result and evidence are summary-only and omit raw prompt, args, stdout, stderr, command line, task envelope, tokens, and patch payloads.

## 6. Safety Boundary Summary

Maintained boundaries:

- No real Codex CLI invocation in this closeout audit.
- No `model:check` command was run.
- No push, release, or tag was performed.
- No workspace-write provider execution was opened.
- No local command provider execution was opened.
- No protected remote provider execution was opened.
- No BHA or VCP integration was added.
- No new provider was added.
- No core execution logic was modified during this closeout.

Workspace-write remains blocked by tests that verify provider execute and dispatcher rejection before spawn.

## 7. Validation Matrix

| Check | Result |
| --- | --- |
| `git status --short` | pass, clean before closeout document |
| `git branch -vv` | pass, `main` ahead 12 before closeout document |
| `git log --oneline -15` | pass, local range reviewed |
| `git diff --stat origin/main..HEAD` | pass, 28 files reviewed at summary level |
| `git diff --name-only origin/main..HEAD` | pass, changed file list reviewed |
| `npm run typecheck` | pass |
| `npx tsx --test tests\read-only-control-chain-acceptance.test.ts` | pass, 2 tests |
| `npx tsx --test tests\host-dispatcher.test.ts` | pass, 12 tests |
| `npx tsx --test tests\desktop-decision-runner.test.ts` | pass, 11 tests |
| `npx tsx --test tests\codex-cli-provider.test.ts` | pass, 21 tests |
| `npx tsx --test tests\provider-core.test.ts` | pass, 12 tests |
| `npx tsx --test tests\codex-desktop-bindings.test.ts` | pass, 9 tests |
| `npx tsx --test tests\desktop-live-adapter.test.ts` | pass, 20 tests |
| `npm run acceptance:readonly-chain` | pass |
| `npm test` | pass, 775 tests |
| Evidence leak search | pass, no matches |

Evidence leak search command:

```powershell
Select-String -Path docs\evidence\read-only-control-chain-acceptance.json -Pattern "prompt","args","stdout","stderr","raw command","token","OPENAI_API_KEY","sk-"
```

Result: no matches.

## 8. Evidence Files

- `docs/evidence/read-only-control-chain-acceptance.json`
- `docs/governance/PR_6_READONLY_CONTROL_CHAIN_LOCAL_CLOSEOUT.md`

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

## 10. Current Classification

- SCOPED_RC_READY: YES, local-only
- PRODUCTION_READY: NO
- AGENT_OS_COMPONENT_READY: PARTIAL
- REAL_EXECUTION_READY: READ_ONLY_FAKE_ONLY
- SECURITY_BOUNDARY_READY: NO
- RELEASE_READY: NO
- PUSH_READY: REVIEW_REQUIRED

## 11. Recommended Next Step

Human review / commander review of ahead 12 local commits before any push.
Do not open workspace-write until read-only chain is externally reviewed.
