---
title: Runbook: Workspace-write Canary
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run governance -- audit capability-taxonomy-escalation-policy
  - npm run validate:daily
applies_to:
  - workspace-write
  - canary
  - rollback
---

# Runbook: Workspace-write Canary

## Purpose

Describe the current workspace-write canary boundary without authorizing a real
workspace-write run by default.

Workspace-write real canary remains experimental and blocked unless a fresh,
exact authorization packet names the canary target, rollback plan, and evidence
requirements.

## Preconditions

All of these must be true before a real workspace-write canary can run:

- explicit authorization for the exact canary run;
- exact target allowlist;
- clean worktree before execution review;
- known `beforeCommit`;
- rollback plan;
- patch guard;
- sensitive-value scan;
- no bundled push, release, tag, deployment, package publish, external write, or
  secret mutation;
- post-run evidence plan that does not store raw sensitive material.

If any item is absent, run only fake/dry-run validation.

## Required Environment

- Local checkout with installed Node dependencies.
- No production deployment, package publish, release, tag, or external write
  environment is required.
- Secrets and provider credentials are not required for fake canary validation.
- Real host execution requires a separate explicit authorization packet.

## Required Commands

Default non-executing checks:

```bash
npm run governance -- audit capability-taxonomy-escalation-policy
npm run validate:daily
npm run canary:write
```

`npm run canary:write` is the deterministic medium-risk canary script. It does
not by itself authorize a real Codex CLI workspace-write execution.

## Procedure

1. Classify the requested action as fake canary, real bounded canary, or broader
   workspace-write.
2. If the request is broader than a bounded canary, stop.
3. Verify the exact authorization packet before real execution.
4. Verify clean worktree and record `beforeCommit`.
5. Verify target allowlist and rollback plan.
6. Run patch guard and sensitive-value scan.
7. Execute only the authorized canary step.
8. Verify rollback and absence of the canary artifact when rollback is required.
9. Record sanitized evidence refs, hashes, statuses, and summaries.

## Expected Result

- Fake canary validates governance flow without real host execution.
- Real canary, when explicitly authorized, writes only the named target and
  leaves rollback evidence.
- General workspace-write remains blocked.

## Blocking Conditions

Stop when any of these are true:

- authorization is missing, stale, or broader than the canary;
- target allowlist is missing or broad;
- worktree is dirty before execution review;
- `beforeCommit` is unknown;
- rollback plan is missing;
- patch guard or sensitive scan is missing or failed;
- push, release, tag, deployment, package publish, external write, or secret
  mutation is bundled into the same action;
- evidence requires raw prompt, raw provider payload, raw stdout/stderr, env,
  token, cookie, or credential storage.

## Evidence Produced

Allowed evidence:

- `beforeCommit`;
- target path;
- patch digest;
- guard status;
- rollback status;
- canary status;
- sanitized reason codes and summaries.

Do not store raw patches, raw execution transcripts, secrets, tokens, cookies,
credentials, provider payloads, or env values.

## Rollback

Rollback must restore the workspace to the recorded `beforeCommit` content state
for the canary target. If rollback cannot be verified, the canary is failed and
general workspace-write remains blocked.

## Incident Handling

- If the run writes outside the target allowlist, stop and treat it as a failed
  canary.
- If rollback fails, do not continue to another write.
- If unsafe evidence is produced, remove it from the commit surface and keep
  only a sanitized incident summary.

## Post-run Documentation

Record:

- whether the run was fake or real;
- authorization packet reference for real runs;
- target path and patch digest;
- rollback result;
- evidence refs or sanitized artifact paths;
- remaining risk and follow-up work.

