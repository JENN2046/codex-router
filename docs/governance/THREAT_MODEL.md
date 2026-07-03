---
title: Governance Threat Model
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - workspace-write
  - evidence
  - release-review
---

# Governance Threat Model

This threat model names the current governance risks and required controls.

## Threat Matrix

| Threat | Control | Default posture |
| --- | --- | --- |
| Workspace overwrite | Target allowlist, patch guard, clean worktree, rollback evidence. | Blocked unless exact canary/runbook conditions hold. |
| Prompt leakage | Evidence policy forbids raw prompt storage when private or sensitive. | Blocked. |
| Secret leakage | Redaction, forbidden raw material list, no env/token/cookie storage. | Blocked. |
| Permit replay | Permit binding, expiry, revocation, consumption record, policy/task scope. | Block stale or mismatched permits. |
| Policy drift | Policy hash or explicit policy identity binding where permits depend on policy. | Block on mismatch. |
| Manifest drift | Manifest or capability contract binding for tool/provider surfaces. | Block on mismatch when contract is required. |
| Model or route drift | Route checks, demo route guards, host-dispatch boundaries. | Block real host paths unless explicitly authorized. |
| External side effect | External write class, explicit authorization, release gate. | Blocked by default. |
| Protected remote action | Separate authorization for push, tag, deploy, publish, release. | Blocked by default. |
| Dirty worktree risk | Worktree cleanliness checks before closeout or write-sensitive runs. | Block. |
| Protected branch risk | PR path for normal work; release-specific authorization for branch movement. | Block direct mutation by default. |
| Workspace-write permit replay | Permit v2 nonce, expiration, consumption record, and hash bindings. | Block until permit v2 exists and is consumed once. |
| Workspace-write rollback failure | `beforeCommit`, rollback command identity, and rollback verification. | Block real canary promotion. |
| Workspace-write evidence leak | Patch digest and sanitized summaries instead of raw patch/stdout/stderr. | Block unsafe evidence. |
| Evidence drift | Structured state-sync claim and display drift checks. | Audit blocks authority drift; display drift is informational unless gated. |
| Opaque runtime failure | Unknown thrown values normalized before governance records them. | Use stable fallback error class. |

## Capability Boundaries

- Read-only dry-run is allowed by default.
- Controlled read-only real execution is guarded and must follow its runbook.
- Workspace-write real canary is blocked by default and requires an exact
  authorization packet.
- General provider execution, general workspace-write, external write, release,
  package publish, deployment, tag, and secret mutation remain blocked unless a
  current authority document and explicit authorization name the action.

## Evidence Controls

Allowed evidence:

- refs, digests, statuses, reason codes, counts, bounded paths, and sanitized
  summaries.

Forbidden evidence:

- raw prompts, provider raw responses, stdout/stderr transcripts, env values,
  tokens, cookies, credentials, private memory, browser login state, database
  dumps, and secret-like payloads.

## Review Stops

Stop a PR or run when:

- a permit or route can broaden real execution;
- a workspace-write target is not exact;
- rollback cannot be verified;
- evidence requires forbidden raw material;
- a protected remote action is bundled with local execution;
- state-sync authority fails;
- a threat listed here has no test, runbook, or explicit manual gate.

## Workspace-write Specific Stops

Stop any real workspace-write path when:

- permit v2 is absent or lacks expiration, nonce, consumption record, or hash
  bindings;
- policy, manifest, principal, or provider execution plan hash does not match;
- target allowlist, max changed files, or max diff lines are missing;
- current branch is protected;
- worktree is dirty before execution review;
- `beforeCommit` or rollback command is missing;
- patch guard or secret-like patch blocker fails;
- evidence would require raw patch, raw stdout/stderr, raw prompt, provider
  payload, env, token, cookie, or credential storage;
- the same action bundles push, release, tag, deployment, package publish,
  external write, or secret mutation.
