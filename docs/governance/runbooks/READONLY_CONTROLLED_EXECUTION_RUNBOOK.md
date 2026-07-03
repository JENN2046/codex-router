---
title: Runbook: Read-only Controlled Execution
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run governance -- list
  - npm run validate:daily
applies_to:
  - controlled-readonly-real
  - runtime-governance
  - host-dispatch
---

# Runbook: Read-only Controlled Execution

## Purpose

Run a controlled read-only execution path without promoting general provider
execution, workspace-write execution, or external writes.

This runbook is for guarded read-only capability only. It is not authorization
for general provider execution.

## Preconditions

- The task is classified as read-only.
- The host bridge, policy, store, and runtime dependencies are injected
  explicitly.
- A permit or equivalent preflight approval exists for the exact read-only
  scope when a real host is used.
- The execution path must not require workspace writes, provider mutation,
  release action, secret mutation, or external service writes.
- Evidence collection must be able to store refs, hashes, statuses, reason
  codes, and sanitized summaries instead of raw payloads.

## Required Environment

- Local repository checkout.
- Clean worktree for closeout or release-sensitive runs.
- Installed Node dependencies.
- Real Codex CLI or provider binaries are optional and must not be invoked
  unless the specific run is explicitly authorized.
- No secret values should be printed, copied, or committed.

## Required Commands

Use deterministic local checks first:

```bash
npm run governance -- list
npm run validate:daily
npm run smoke:contract
```

Use task-specific tests or audits when changing runtime code.

## Procedure

1. Confirm the task is read-only and name the requested capability.
2. Confirm the route cannot write workspace files, external services, releases,
   packages, tags, deployments, secrets, or credentials.
3. Confirm host dependencies are injected explicitly.
4. Run deterministic local checks.
5. If a real read-only host run is requested, verify the exact permit/preflight
   packet and stop if it is absent, stale, or broader than the task.
6. Execute only the authorized read-only path.
7. Capture evidence as observation refs, check URLs, digests, statuses,
   normalized error classes, and sanitized summaries.
8. Run the relevant post-check or closeout audit.

## Expected Result

- The result is read-only.
- Governance state records named failures or a pass result.
- Operator-facing recovery or evidence surfaces contain consumable refs.
- No raw provider payload, raw prompt, secret, token, cookie, env value, or
  unredacted stdout/stderr is stored.

## Blocking Conditions

Stop when any of these are true:

- task scope is not read-only;
- host dependency is implicit or global when explicit injection is required;
- permit/preflight approval is missing, stale, or broader than the task;
- evidence would require forbidden raw material;
- route can mutate workspace, provider, external service, release, package,
  tag, deployment, secret, or credential state;
- failure cannot be named with a stable error class.

## Evidence Produced

Allowed evidence:

- check name and status;
- observation refs;
- checkpoint refs;
- sanitized error class and reason code;
- commit SHA or source digest;
- bounded non-secret paths;
- summarized counts.

Forbidden evidence is defined by [Evidence Policy](../EVIDENCE_POLICY.md).

## Rollback

Read-only execution should not require rollback. If any write happens, stop,
record a sanitized incident summary, restore the workspace from Git if safe, and
do not claim the run was read-only.

## Incident Handling

- If the route reaches a real provider or CLI unexpectedly, stop the run and
  record `unexpected_host_dispatch`.
- If evidence contains unsafe material, remove it from the commit surface and
  keep only a sanitized summary.
- If governance state is not updated after a failure, treat the run as blocked.

## Post-run Documentation

For PR work, record:

- command status;
- evidence refs or sanitized artifact paths;
- whether real host execution was run or explicitly not run;
- remaining risk.

