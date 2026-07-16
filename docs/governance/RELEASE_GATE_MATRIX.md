---
title: Release Gate Matrix
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run governance -- list
  - npm run validate:daily
  - pull_request-context state-sync audit
supersedes: []
superseded_by: null
applies_to:
  - validation
  - pull-request
  - release-review
---

# Release Gate Matrix

This matrix defines the current PR and release validation gates.

`validate:pr` still exists as a package shortcut, but it includes the local
state-sync audit. On a non-`main` PR branch, state-sync must run through GitHub
CI's `pull_request` context or through an explicit local pull-request context
simulation.

## Gate Summary

| Gate | Command or context | Use | Blocks |
| --- | --- | --- | --- |
| Daily typecheck | `npm run validate:daily` | Routine local implementation loop. | Claiming local code is type-clean. |
| TypeScript check | `npm run typecheck` | Explicit type validation. | PR readiness when it fails. |
| Test suite | `npm test` | Unit/integration regression coverage. | PR readiness when it fails. |
| Build | `npm run build` | Production TypeScript build. | PR readiness and release readiness. |
| Governance docs check | `npm run docs:governance` | Lightweight current documentation structure check. | PR readiness when governance docs drift structurally. |
| Merge integrity | GitHub `pull_request_target` plus PR `issue_comment` evaluation, executed from the trusted base/default-branch SHA and published as the exact-head `Merge Integrity` commit status | Detects active PR-body merge locks, re-evaluates comment creation/edit/deletion, and validates an allowed approver's exact repository, PR, head, time, and merge scope without executing PR code in the privileged event context. | Merge whenever a lock is active without a valid structured authorization, or while the trusted evaluation/status API is unavailable. |
| Execution boundary current surface | `npm run governance -- audit execution-boundary-current-surface` | Verifies strategy router, execution profiles, policy config, capability taxonomy, capability taxonomy escalation policy, routing engine, recovery control orchestration, runtime control, operator action executor gate, Codex CLI host, public API facade, Agent OS local runtime, Agent OS MCP server manifest, Protocol MCP provider skeleton, Protocol A2A remote provider skeleton, Agent OS SDK, Agent OS CLI, Agent OS app-server wrapper, Agent OS public surfaces, Codex provider, preflight, approval permit, approval gate, approval consumption dispatch matrix, approval consumption dispatch, admission control, delegation policy, execution eligibility, execution observation, governance failure reducer, task graph, scheduler, execution planner, provider registry, controlled provider execution taskbook, controlled provider execution taskbook review, controlled provider execution dispatch preflight, controlled provider execution dispatcher, provider execution runner, provider-core primitives, tool invocation planner, desktop agent strategy, desktop decision runner, final host locator, host-dispatcher provider, Codex desktop bridge, Codex desktop live host, Codex memory MCP client, Codex memory host client, desktop host client, desktop live adapter dispatch, host-client example, target host embedding, host executor, host executor taskbook, host-client executor review, host executor receipt, agent-backed recovery executor, agent executor adapter taskbook, agent executor adapter review, agent executor adapter sandbox, task-control taskbook, task-control review, sub-agent runtime, and task-control sandbox boundaries stay registered, non-broadened, and non-executing. The authority lattice mode is `narrow_readonly_provider_dispatch_without_boundary_inheritance`: read-only provider dispatch does not inherit into host executor authorization, read-only provider dispatch does not inherit into sub-agent runtime authorization, read-only provider dispatch does not inherit into workspace-write authorization, and read-only provider dispatch does not inherit into release authorization. Codex CLI host does not authorize host executor or sub-agent runtime; sub-agent runtime does not invoke Codex CLI or provider execution; host executor does not execute provider or sub-agent runtime. | PR readiness when execution boundaries drift or broaden. |
| PR state-sync | GitHub `pull_request` State Sync Audit or explicit simulation | Verifies structured state-sync claim for PR context. | PR merge and state authority. |
| Main state-sync | `node --import tsx scripts/run-state-sync-audit.ts --json` on local `main` | Post-merge/main closeout. | Main state authority when it fails. |
| Phase 6 closeout | [Phase 6 Controlled Execution Runtime Hardening Closeout](PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md) | Runtime-governance capability status review. | Claims that Phase 6 broadened default execution. |
| Phase 7 closeout | [Phase 7 Runtime Operator Actionability Closeout](PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md) | Runtime operator-action capability status review. | Claims that operator-action surfaces authorize execution. |
| Phase 8 closeout | [Phase 8 Operator Action Lifecycle Closeout](PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md) | Operator action receipt lifecycle and store status review. | Claims that receipts authorize recovery execution. |
| Workspace-write release gate | [Workspace-write Release Gate](WORKSPACE_WRITE_RELEASE_GATE.md) | Any PR that can broaden controlled generic local workspace-write, real workspace-write, or canary execution. | Controlled local workspace-write readiness and real workspace-write readiness. |
| Release tier | `npm run validate:release` | Deterministic release-sensitive local validation. | Release/tag/deploy/package publish. |
| Current governance list | `npm run governance -- list` | Shows current operating checks. | Documentation claims about available current checks. |
| Archived governance list | `npm run governance -- list --all` | Historical inspection only. | Nothing by itself. |

## Recommended Local PR Branch Sequence

For normal non-`main` PR branches:

```bash
git diff --check
npm run validate:daily
npm test
npm run build
npm run docs:governance
npm run governance -- audit execution-boundary-current-surface
node --import tsx scripts/sync-state-sync-display.ts --check
```

Then use one of these for state-sync:

- GitHub CI `pull_request` State Sync Audit; or
- explicit local pull-request context simulation that sets
  `GITHUB_EVENT_NAME=pull_request`, `GITHUB_BASE_REF`, `GITHUB_HEAD_REF`,
  `GITHUB_SHA`, and `GITHUB_EVENT_PATH`.

Do not treat a bare local state-sync audit on a non-`main` branch as the PR
state-sync gate.

## Main Closeout

After a PR is squash-merged:

```bash
git switch main
git pull --ff-only origin main
node --import tsx scripts/run-state-sync-audit.ts --json
```

Policy v2 content attestation is the normal path. It should not require a
post-merge v1 reanchor when the structured record's filtered source-tree digest
matches the merged `main` tree.

## Release-Sensitive Gate

Before release, tag, deployment, package publish, or release branch movement:

```bash
npm run validate:release
npm run governance -- audit source-release-package-boundary
```

Real Codex CLI smoke, provider execution, external canaries, and production
deployment checks are not part of routine release validation. They require
explicit target-specific authorization.

Workspace-write real canary is also not part of routine release validation. It
remains blocked unless the [Workspace-write Release Gate](WORKSPACE_WRITE_RELEASE_GATE.md)
passes for the exact target and authorization packet.

Phase 6 closeout records the controlled read-only and fake workspace-write
readiness status. It does not authorize real workspace-write, external writes,
protected remote actions, release, publish, deploy, tag, or default real Codex
CLI execution.

Phase 7 closeout records runtime operator actionability surfaces. It does not
authorize executing the recommended recovery action, real workspace-write,
external writes, protected remote actions, release, publish, deploy, tag, or
default real Codex CLI execution.

Phase 8 closeout records operator action lifecycle receipt validation and
receipt-store primitives. It does not authorize executing, resuming, aborting,
rolling back, or otherwise consuming the recommended action without a separate
execution gate.

## Failure Policy

| Failure | Effect |
| --- | --- |
| `git diff --check` fails | Fix whitespace/conflict markers before review. |
| Typecheck fails | Do not mark PR ready. |
| Tests fail | Do not merge until regression is fixed or explicitly scoped out. |
| Build fails | Do not release or merge broad code changes. |
| Governance docs check fails | Fix current docs structure, links, or package-script references before review. |
| Merge integrity fails | Keep the PR unmerged; passing tests, build, or state-sync cannot replace explicit merge authorization. |
| PR state-sync fails | Do not merge; structured claim or event context is invalid. |
| Main state-sync fails | Treat current state authority as invalid until fixed. |
| Phase 6 closeout contradicts a gate | Treat the stricter gate as authoritative until the contradiction is reviewed. |
| Phase 7 closeout contradicts a gate | Treat the stricter gate as authoritative until the contradiction is reviewed. |
| Phase 8 closeout contradicts a gate | Treat the stricter gate as authoritative until the contradiction is reviewed. |
| Release tier fails | Do not release, tag, deploy, publish, or promote. |
| Workspace-write release gate fails | Do not run real workspace-write; use fake/dry-run validation only. |
| Evidence collection fails | Do not claim release evidence completeness. |
| Source/release boundary audit fails | Do not package or publish artifacts. |
| Real host smoke cannot run | State that it was not run; do not imply provider safety. |
