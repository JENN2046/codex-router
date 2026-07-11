---
title: Workspace-write Release Gate
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - workspace-write
  - release-review
  - permit
  - rollback
---

# Workspace-write Release Gate

This gate defines what must be true before any real workspace-write path can be
treated as guarded. It does not authorize real workspace-write by itself.

Current posture:

| Capability | Status |
| --- | --- |
| Workspace-write permit v2 | Schema, validators, rollback binding, and single-use consumption helper implemented; not execution authorization. |
| Workspace-write fake canary | Guarded with permit v2, patch guard, rollback evidence, and replay blocking; no real host write. |
| Workspace-write real canary | Experimental and blocked by default. |
| Controlled generic local workspace-write | Guarded behind permit v2, exact operation target allowlist, local runner, sanitized evidence, and rollback verification; not default authorization. |
| General / unbounded workspace-write | Blocked. |
| External write, protected remote action, release, publish, deploy, tag | Blocked unless separately authorized. |

## Promotion Requirement

Workspace-write real canary may move from blocked-by-default to guarded only
when all of these controls exist and pass:

- workspace-write permit v2 integrated into the fake canary path;
- permit expiration;
- permit nonce;
- permit consumption store;
- policy hash binding;
- manifest hash binding;
- principal hash binding;
- provider execution plan hash binding;
- operator authorization id;
- fixed target allowlist;
- max changed files;
- max diff lines;
- clean worktree;
- protected branch forbidden;
- `beforeCommit` recorded;
- rollback command recorded;
- post-run diff inspection;
- secret-like patch blocker;
- evidence summary without raw patch, raw stdout/stderr, env, token, cookie, or
  provider payload.

If any control is missing, the real canary remains blocked and only fake/dry-run
validation is allowed.

Controlled generic local workspace-write may be treated as guarded only when the
caller supplies an approved workspace-write permit v2, exact operation target
allowlist, provider execution plan hash binding, operator authorization id,
clean non-protected repository state, a local runner, patch guard, sanitized
evidence, and rollback verification. This applies to explicit create, update,
and delete file operations for declared repository-relative targets. It is not
default workspace-write authorization, not Codex CLI execution authorization,
not provider `execute` authorization, and not external-write authorization.

Current local acceptance:

```bash
npm run governance -- acceptance controlled-generic-workspace-write -- --check
```

The acceptance uses a temporary local git repository to preflight, execute, roll
back, and replay-block explicit create/update/delete operations. It does not
write the current repository, call provider `execute`, spawn Codex CLI, or
perform external writes.

## Required Review Questions

| Question | Required answer |
| --- | --- |
| Is the target path exact and allowlisted? | Yes. |
| Is the worktree clean before execution review? | Yes. |
| Is this branch protected or `main`? | No for real workspace-write execution. |
| Is the permit fresh, bounded, non-replayed, and consumed once? | Yes. |
| Are policy, manifest, principal, and execution-plan hashes bound? | Yes. |
| Is rollback executable and tied to `beforeCommit`? | Yes. |
| Can evidence be stored without raw patch or transcripts? | Yes. |
| Is any external write, push, release, tag, deploy, publish, or secret mutation bundled? | No. |

## Blocking Conditions

Block when any of these are true:

- dirty worktree;
- protected branch;
- target outside allowlist;
- missing `beforeCommit`;
- missing rollback command;
- missing operator authorization id;
- expired, stale, broadened, revoked, or replayed permit;
- policy hash mismatch;
- manifest hash mismatch;
- principal hash mismatch;
- provider execution plan hash mismatch;
- secret-like patch content;
- raw patch, raw stdout/stderr, env, token, cookie, credential, or provider
  payload needed as evidence;
- external write attempt;
- remote push attempt;
- release, tag, deployment, or package publish bundled with the write.

## Validation Boundary

Allowed routine validation:

```bash
npm run validate:daily
npm run canary:write
```

`npm run canary:write` validates deterministic workspace-write governance
flow. It is not general authorization for real host execution.

Real workspace-write execution requires the exact
[workspace-write real canary authorization packet](WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET.md),
[workspace-write canary runbook](runbooks/WORKSPACE_WRITE_CANARY_RUNBOOK.md),
and a fresh explicit authorization packet.

## Evidence Contract

Allowed evidence:

- authorization id;
- permit id and consumption status;
- policy/manifest/principal/execution-plan hashes;
- `beforeCommit`;
- target path;
- patch digest;
- changed file count and diff line count;
- guard status;
- rollback command identity and rollback result;
- post-run diff inspection status;
- sanitized reason codes and summaries.

Forbidden evidence:

- raw patch body;
- raw stdout/stderr transcript;
- raw prompt;
- provider raw response;
- env values;
- tokens, cookies, credentials, API keys, auth headers;
- private memory or browser login state.

## Change Control

Changing this gate requires updates to:

- [ADR 005](decisions/ADR_005_WORKSPACE_WRITE_PERMIT_V2.md);
- [Threat Model](THREAT_MODEL.md);
- [Evidence Policy](EVIDENCE_POLICY.md);
- [Release Gate Matrix](RELEASE_GATE_MATRIX.md);
- workspace-write tests when behavior changes.
