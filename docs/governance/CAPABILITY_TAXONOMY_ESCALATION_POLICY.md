# Capability Taxonomy And Escalation Policy

## 1. Purpose

This document records the local design boundary for future write-capable steps
after one bounded real Codex CLI workspace-write canary passed and its rollback
receipt was recorded.

It is a local review and audit artifact only. It does not authorize, run, or
simulate provider execute, real Codex CLI execution, workspace-write execution,
canary file write, push, release, tag, deployment, or external service write.

## 2. Evidence Baseline

The taxonomy depends on these already-recorded facts:

- evidence path: `docs/evidence/codex-cli-workspace-write-real-canary-latest.json`
- evidence status: `passed`
- target file: `tmp/codex-cli-write-canary.txt`
- sandbox: `workspace-write`
- approval policy: `on-request`
- execution status: `completed`
- exit code: `0`
- rollback verification: canary file absent
- general provider execution authorized: `false`
- general workspace-write authorized: `false`

Required local audit command:

- `npm run audit:capability-taxonomy-escalation-policy`

## 3. Capability Taxonomy

Capability classes are ordered from least to most side-effectful:

| Class | Meaning | Default posture |
| --- | --- | --- |
| `read_only` | Inspect files, Git state, docs, scripts, local evidence, or sanitized outputs without modifying workspace or external state. | Allowed as local audit and review. |
| `bounded_workspace_write_canary` | A single fixed-target workspace-write canary with exact operator authorization and rollback. | Closed unless the exact canary packet is re-authorized for that specific run. |
| `bounded_workspace_write_receipt` | Evidence recording, rollback verification, and audit of a completed bounded canary. | Allowed locally when it stays non-executing. |
| `scoped_workspace_write` | A named, reviewable local write scope beyond the fixed canary target. | Requires a new controlled gate before any execution. |
| `general_workspace_write` | Open-ended workspace-write over arbitrary repository files or broad task classes. | Closed. |
| `general_provider_execution` | Provider-backed execution that is not constrained to read-only or an exact bounded packet. | Closed. |
| `external_write` | Creating, updating, deleting, publishing, or commenting in any remote service or live external system. | Requires separate explicit remote authorization. |
| `release_or_deploy` | Tags, releases, deployments, production promotion, or release branch movement. | Requires separate release authorization and preflight. |
| `secret_or_credential_change` | Creating, modifying, exposing, rotating, or storing sensitive credentials or env values. | Closed unless explicitly authorized for the named secret action. |

## 4. Escalation Policy

`read_only` may proceed as local inspection, audit, or documentation review when
it does not expose sensitive values.

`bounded_workspace_write_canary` requires all of these before execution:

- exact operator authorization for the named canary
- clean `main`
- local `main` aligned with `origin/main`
- fixed target file: `tmp/codex-cli-write-canary.txt`
- sandbox: `workspace-write`
- approval policy: `on-request`
- rollback required: `true`
- push authorized: `false`
- release authorized: `false`
- tag authorized: `false`
- deployment authorized: `false`
- external service write authorized: `false`

`bounded_workspace_write_receipt` may record evidence and rollback state only
after execution has already happened under the exact bounded canary packet. It
must not initiate another canary.

`scoped_workspace_write` requires a new controlled gate that names:

- requested capability class: `scoped_workspace_write`
- exact repository scope
- exact files or file families
- allowed local commands
- rollback plan
- validation plan
- sensitive value scan
- operator authorization phrase
- stop conditions

`general_workspace_write` and `general_provider_execution` remain closed. A
successful bounded canary does not promote either class.

`external_write`, `release_or_deploy`, and `secret_or_credential_change` require
separate explicit authorization for the named target and action. They must not
be bundled into a workspace-write gate.

## 5. Stop Conditions

Future write-capable planning must stop when any of these are true:

- requested target is broader than the named class and scope
- requested target is not fixed or scoped
- current branch or alignment is unsafe for execution review
- worktree is dirty before execution review
- canary target file exists
- rollback plan is missing
- validation plan is missing
- sensitive value scan is missing
- push, release, tag, deployment, or external write is bundled with local write
- secret or credential change is bundled with local write
- general provider execution is implied by canary success
- general workspace-write is implied by canary success
- unsanitized execution transcript, provider input, shell invocation, patch
  body, logs, token, or secret-like value is requested for publication

## 6. Non-actions

This taxonomy review must keep these counts at `0`:

- provider execute calls during taxonomy review
- real Codex CLI calls during taxonomy review
- workspace-write execute calls during taxonomy review
- canary file writes during taxonomy review
- general provider execution calls during taxonomy review
- external write calls during taxonomy review

## 7. Result

Result:

- `CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED`

The next safe action after this taxonomy is to review and merge the policy. It
is not to run workspace-write execution or general provider execution.
