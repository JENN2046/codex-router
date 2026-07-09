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
exact
[workspace-write real canary authorization packet](../WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET.md)
names the canary target, rollback plan, and evidence requirements.

This runbook is not a permit. It describes the procedure that may be used only
after the [Workspace-write Release Gate](../WORKSPACE_WRITE_RELEASE_GATE.md)
passes for the exact canary.

## Preconditions

All of these must be true before a real workspace-write canary can run:

- explicit authorization for the exact canary run;
- operator authorization id;
- workspace-write permit v2 with expiration, nonce, and consumption record;
- policy hash binding;
- manifest hash binding;
- principal hash binding;
- provider execution plan hash binding;
- exact target allowlist;
- max changed files and max diff lines;
- clean worktree before execution review;
- known `beforeCommit`;
- rollback command and rollback plan;
- patch guard;
- sensitive-value scan;
- protected branch check;
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

Local real workspace-write canary entrypoint:

```bash
npm run canary:workspace-write:real
```

Without `--execute`, the command records only a pre-execution result. A real
local canary write requires all of these at the same time:

- current branch is non-protected and not `main`, `master`, `production`, or
  `release`;
- worktree is clean before the canary;
- fixed target `tmp/codex-cli-write-canary.txt` is absent;
- exact authorization is supplied through
  `WORKSPACE_WRITE_REAL_CANARY_EXECUTE_AUTHORIZATION`;
- the command is invoked with `--execute`;
- permit v2, authorization packet, patch guard, rollback evidence, and
  pre-execution gate all pass.

The local real canary writes only the fixed target, verifies the post-write
patch summary, removes the target, verifies the target is absent and clean in
git status, and records sanitized evidence. It does not invoke Codex CLI,
provider execution, push, release, tag, deployment, package publish, external
write, or secret mutation.

## Procedure

1. Classify the requested action as fake canary, real bounded canary, or broader
   workspace-write.
2. If the request is broader than a bounded canary, stop.
3. Verify the exact workspace-write real canary authorization packet before
   real execution.
4. Verify permit v2 bindings: expiration, nonce, consumption record, policy
   hash, manifest hash, principal hash, provider execution plan hash, target
   allowlist, and operator authorization id.
5. Verify clean worktree, protected-branch block, and record `beforeCommit`.
6. Verify max changed files, max diff lines, target allowlist, and rollback
   command.
7. Run patch guard and sensitive-value scan before storing any evidence.
8. Execute only the authorized canary step.
9. Inspect the post-run diff and verify it stays inside the bounded target and
   size limits.
10. Verify rollback and absence of the canary artifact when rollback is
    required.
11. Consume or record the permit consumption result.
12. Record sanitized evidence refs, hashes, statuses, and summaries.

## Expected Result

- Fake canary validates governance flow without real host execution.
- Real canary, when explicitly authorized, writes only the named target and
  leaves rollback evidence. The local implementation writes
  `tmp/codex-cli-write-canary.txt` with fixed canary content, verifies the
  resulting one-file/one-line patch summary, then removes the file and verifies
  rollback before evidence is written.
- General workspace-write remains blocked.

## Blocking Conditions

Stop when any of these are true:

- authorization is missing, stale, or broader than the canary;
- permit is missing, expired, revoked, replayed, already consumed, or missing a
  required hash binding;
- operator authorization id is missing;
- target allowlist is missing or broad;
- changed file or diff line limits are missing;
- worktree is dirty before execution review;
- current branch is protected;
- `beforeCommit` is unknown;
- rollback plan is missing;
- patch guard or sensitive scan is missing or failed;
- push, release, tag, deployment, package publish, external write, or secret
  mutation is bundled into the same action;
- evidence requires raw prompt, raw provider payload, raw stdout/stderr, env,
  token, cookie, or credential storage.
- the local real canary target remains present after rollback or is still shown
  by `git status --short -- tmp/codex-cli-write-canary.txt`.

## Evidence Produced

Allowed evidence:

- `beforeCommit`;
- operator authorization id;
- permit id and consumption status;
- policy, manifest, principal, and execution-plan hashes;
- target path;
- patch digest;
- changed file count and diff line count;
- guard status;
- post-run diff inspection status;
- rollback status;
- canary status;
- sanitized reason codes and summaries.
- local real canary counters: `workspaceWriteExecuteCalls`,
  `canaryFileWrites`, `providerExecuteCalls`, `realCodexCliCalls`, and
  `remoteWrites`.

Do not store raw patches, raw execution transcripts, secrets, tokens, cookies,
credentials, provider payloads, or env values.

## Rollback

Rollback must restore the workspace to the recorded `beforeCommit` content state
for the canary target. If rollback cannot be verified, the canary is failed and
general workspace-write remains blocked.

Rollback evidence must identify the rollback command or mechanism without
storing raw patch contents.

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
- permit id and consumption status;
- target path and patch digest;
- changed file count and diff line count;
- rollback result;
- evidence refs or sanitized artifact paths;
- remaining risk and follow-up work.
