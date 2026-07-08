---
title: Workspace-write Real Canary Authorization Packet
status: active
owner: governance
created: 2026-07-08
last_verified: 2026-07-08
verified_by:
  - npm run governance -- audit workspace-write-real-canary-authorization-design
applies_to:
  - workspace-write
  - real-canary
  - authorization-packet
  - pre-execution
---

# Workspace-write Real Canary Authorization Packet

This document defines the current design for a future real workspace-write
canary authorization packet and its pre-execution checks.

It is a design and review surface only. It does not authorize, run, simulate, or
dispatch provider execution, real Codex CLI execution, workspace-write
execution, canary file writes, host executor dispatch, sub-agent runtime,
external writes, push, release, tag, deployment, package publish, or secret
mutation.

The packet can only be considered after the
[Workspace-write Release Gate](WORKSPACE_WRITE_RELEASE_GATE.md) passes for the
exact target. Passing this design audit is not execution permission.

## Packet Mode

- mode: `real_canary_authorization_design_only`
- authorization packet schema version:
  `workspace-write-real-canary-authorization-packet.v1`
- required design audit:
  `npm run governance -- audit workspace-write-real-canary-authorization-design`
- required release gate audit:
  `npm run governance -- audit workspace-write-release-gate`
- required runbook:
  `docs/governance/runbooks/WORKSPACE_WRITE_CANARY_RUNBOOK.md`

## Exact Authorization Packet Fields

A future operator authorization packet must bind all of these fields exactly:

- `schemaVersion`: `workspace-write-real-canary-authorization-packet.v1`
- `authorizationIntent`: `workspace_write_real_canary`
- `authorizationScope`: `single_local_canary_write_only`
- `operatorAuthorizationId`: required and unique for the run
- `providerId`: `codex-cli`
- `targetFile`: `tmp/codex-cli-write-canary.txt`
- `allowedAction`: `one bounded local canary write`
- `sideEffectClass`: `workspace_write`
- `sandbox`: `workspace-write`
- `maxChangedFiles`: `1`
- `maxDiffLines`: `2`
- `rollbackRequired`: `true`
- `canaryFileAbsentBeforeExecution`: `true`
- `branchPolicy`: `non_main_non_protected_branch_only`
- `worktreeCleanRequired`: `true`
- `beforeCommitRequired`: `true`
- `permitV2Required`: `true`
- `fakeCanaryV2Required`: `true`
- `releaseGateRequired`: `true`
- `pushAuthorized`: `false`
- `releaseAuthorized`: `false`
- `tagAuthorized`: `false`
- `deploymentAuthorized`: `false`
- `packagePublishAuthorized`: `false`
- `externalWriteAuthorized`: `false`
- `secretMutationAuthorized`: `false`

Any missing, broadened, stale, replayed, or mismatched field blocks the packet.

## Permit V2 Binding

The packet requires a workspace-write permit v2 with:

- schema version: `provider-workspace-write-execution-permit.v2`
- expiration;
- nonce;
- single-use consumption record;
- operator authorization id;
- target file allowlist containing only `tmp/codex-cli-write-canary.txt`;
- max changed files: `1`;
- max diff lines: `2`;
- policy decision hash binding;
- provider manifest hash binding;
- provider execution plan hash binding;
- principal hash binding;
- `beforeCommit` binding;
- rollback command identity binding;
- protected branch forbidden;
- dirty worktree forbidden.

The permit is necessary but not sufficient. A valid permit is not provider
execution authorization, Codex CLI invocation authorization, or workspace-write
execution authorization by itself.

## Required Pre-execution Checks

Immediately before any future real canary execution, a fresh pre-execution gate
must prove all of these without performing the write:

- workspace-write release gate passed for the exact target;
- authorization packet design audit passed;
- fake canary v2 acceptance passed with permit v2 and replay blocking;
- pre-execution acceptance evidence is fresh, local-only, and sanitized;
- exact target allowlist contains only `tmp/codex-cli-write-canary.txt`;
- current branch is not `main`;
- current branch is not protected;
- worktree is clean;
- local branch is not behind its reviewed base;
- canary target file is absent before execution;
- `beforeCommit` is recorded;
- rollback command identity is recorded;
- patch digest is recorded without raw patch contents;
- patch guard passes;
- sensitive-value scan passes;
- post-run diff inspection plan is recorded;
- no push, release, tag, deployment, package publish, external write, or secret
  mutation is bundled into the same action.

If any check is absent or blocked, only fake/dry-run validation is allowed.

## Evidence Contract

Allowed evidence:

- authorization packet id;
- operator authorization id;
- permit id and consumption status;
- policy, manifest, principal, and execution-plan hashes;
- target path;
- `beforeCommit`;
- patch digest;
- changed file count and diff line count;
- patch guard status;
- sensitive scan status;
- rollback command identity and rollback result;
- post-run diff inspection status;
- sanitized reason codes and summaries.

Forbidden evidence:

- raw patch body;
- raw stdout/stderr transcript;
- raw prompt;
- raw provider payload;
- raw command arguments;
- env values;
- tokens, cookies, credentials, API keys, or auth headers;
- private memory or browser login state.

## Non-actions

This design keeps these counts at `0`:

- provider execute calls during design;
- real Codex CLI calls during design;
- workspace-write execute calls during design;
- host executor calls during design;
- sub-agent runtime calls during design;
- external write calls during design;
- canary file writes during design;
- evidence writes during design.

## Blocking Conditions

Block the packet when any of these are true:

- packet omits the release gate requirement;
- packet omits permit v2;
- packet omits fake canary v2;
- packet target is broad, wildcarded, absolute, parent-relative, or outside the
  fixed target;
- packet allows more than one changed file or two diff lines;
- packet allows `main` or a protected branch;
- packet allows push, release, tag, deployment, package publish, external write,
  or secret mutation;
- packet evidence requires raw patch, raw stdout/stderr, raw prompt, provider
  payload, env, token, cookie, credential, or auth header storage;
- packet claims that design, preflight, permit validation, or release gate review
  is execution authorization.

## Result

Result:

- `WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET_DESIGNED`

The next safe action after this design is a non-executing implementation review
that makes the existing pre-execution acceptance consume this packet shape and
permit v2 directly. It is not the real canary execution itself.
