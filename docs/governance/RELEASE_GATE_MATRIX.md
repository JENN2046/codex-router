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
| PR state-sync | GitHub `pull_request` State Sync Audit or explicit simulation | Verifies structured state-sync claim for PR context. | PR merge and state authority. |
| Main state-sync | `node --import tsx scripts/run-state-sync-audit.ts --json` on local `main` | Post-merge/main closeout. | Main state authority when it fails. |
| Workspace-write release gate | [Workspace-write Release Gate](WORKSPACE_WRITE_RELEASE_GATE.md) | Any PR that can broaden real workspace-write or canary execution. | Real workspace-write readiness. |
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

## Failure Policy

| Failure | Effect |
| --- | --- |
| `git diff --check` fails | Fix whitespace/conflict markers before review. |
| Typecheck fails | Do not mark PR ready. |
| Tests fail | Do not merge until regression is fixed or explicitly scoped out. |
| Build fails | Do not release or merge broad code changes. |
| Governance docs check fails | Fix current docs structure, links, or package-script references before review. |
| PR state-sync fails | Do not merge; structured claim or event context is invalid. |
| Main state-sync fails | Treat current state authority as invalid until fixed. |
| Release tier fails | Do not release, tag, deploy, publish, or promote. |
| Workspace-write release gate fails | Do not run real workspace-write; use fake/dry-run validation only. |
| Evidence collection fails | Do not claim release evidence completeness. |
| Source/release boundary audit fails | Do not package or publish artifacts. |
| Real host smoke cannot run | State that it was not run; do not imply provider safety. |
