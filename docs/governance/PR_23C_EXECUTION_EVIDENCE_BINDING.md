---
title: PR-23C Execution Evidence Binding
status: active
owner: governance/runtime
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - node --import tsx --test tests/provider-execution-runner.test.ts
  - npm run governance -- acceptance controlled-readonly-provider-execution -- --output /tmp/codex-router-controlled-readonly-provider-execution-acceptance-pr23c.json
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - provider-execution
  - evidence
  - read-only
---

# PR-23C Execution Evidence Binding

PR_23C_EXECUTION_EVIDENCE_BINDING_RECORDED

## Summary

PR-23C tightens the controlled read-only provider execution evidence chain.
It does not broaden the PR-23B execution boundary.

The controlled read-only runner now emits a typed
`provider-execution-controlled-readonly-evidence.v2` summary that binds:

- task and run ids;
- task hash, policy hash, and principal hash;
- provider execution plan hash;
- executor plan hash;
- provider registry selection and manifest hash;
- environment preflight artifact ref and artifact hash;
- permit id, permit plan hash, permit policy hash, permit principal hash, and
  permit consumption key;
- final runner report artifact id;
- evidence policy flags proving raw execution material is not stored.

## Runtime Boundary

The runner still requires:

- explicit `controlled-read-only` mode;
- provider id `codex-cli`;
- side effect class `read_only`;
- sandbox mode `read-only`;
- approval policy `never`;
- a valid provider execution permit;
- explicit metadata containing the codex-cli real-execution guard;
- injected execution dependency evidence.

PR-23C adds a fail-closed preflight evidence requirement: controlled read-only
metadata must include a sanitized environment preflight artifact ref and
SHA-256 artifact hash before provider execution can be invoked.

## Evidence Policy

The v2 evidence summary records refs, hashes, ids, booleans, statuses, and
reason codes only. It does not store:

- raw prompt or task envelope;
- argv or command lines;
- stdout or stderr;
- env values;
- tokens, secrets, cookies, or credentials;
- patch bodies.

Provider output remains summarized through sanitized artifact refs and safe
metadata only.

## Non-authorization

This PR does not authorize:

- default provider execution;
- real Codex CLI execution by default;
- hidden global process spawning;
- workspace-write real canary;
- general workspace-write;
- external write;
- protected remote action;
- push, release, publish, deploy, or tag.

## Follow-up

PR-23D should continue with workspace-write permit v2 schema and validators.
Permit lifecycle hardening remains a separate runtime-governance slice and
must not be inferred from this evidence-binding PR.
