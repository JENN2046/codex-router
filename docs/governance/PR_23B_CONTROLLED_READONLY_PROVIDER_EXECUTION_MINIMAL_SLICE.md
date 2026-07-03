---
title: PR-23B Controlled Read-only Provider Execution Minimal Slice
status: active
owner: governance/runtime
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run governance -- acceptance controlled-readonly-provider-execution -- --output /tmp/codex-router-controlled-readonly-provider-execution-acceptance.json
  - node --import tsx --test tests/provider-execution-runner.test.ts tests/governance-check.test.ts
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - runtime-governance
  - provider-execution
  - read-only
---

# PR-23B Controlled Read-only Provider Execution Minimal Slice

PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE_RECORDED

## Summary

PR-23B promotes the existing controlled read-only provider execution acceptance
from archived discovery into the current governance runner surface.

The runtime path already exists as
`runProviderExecutionPlanControlledReadOnly`. This PR does not broaden that
runtime path. It makes the minimal slice operator-visible through:

```bash
npm run governance -- acceptance controlled-readonly-provider-execution
```

## What Is Productized

The current minimal slice is the explicit controlled read-only runner path:

- mode must be `controlled-read-only`;
- provider id must be `codex-cli`;
- provider plan side effect must be `read_only`;
- provider plan sandbox must be `read-only`;
- approval policy must be `never`;
- provider execution permit must be valid for the executor plan;
- execution metadata must contain the codex-cli real-execution guard;
- provider registry selection must match `codex-cli`, the provider kind, and
  the manifest hash;
- environment preflight must be ready;
- injected spawner evidence must be present;
- no workspace-write, raw prompt, raw task envelope, or real CLI fallback may
  pass the guard.

The acceptance uses an injected fake spawner. It proves the runner can invoke
the provider boundary only through the explicit controlled read-only gate while
keeping real Codex CLI calls at zero.

## Current Acceptance Evidence

The current acceptance command reports:

- runner status ok: `true`;
- provider execute invoked through the controlled fake-spawner path: `true`;
- fake spawner calls: `1`;
- workspace-write execute calls: `0`;
- external write calls: `0`;
- evidence sanitized: `true`.

Use `--output /tmp/...` during local validation when no repository evidence
refresh is intended.

## Non-authorization

This PR does not authorize:

- default provider execution;
- real Codex CLI execution by default;
- hidden global process spawning;
- workspace-write real canary;
- general workspace-write;
- external write;
- protected remote action;
- push, release, publish, deploy, or tag;
- secret, credential, token, env, user config, or system config mutation.

Real host smoke remains separate and explicit:

```bash
npm run smoke:telemetry
npm run smoke:workspace-write:telemetry
```

Those commands are not part of this PR and require a separate target-specific
authorization before use.

## Follow-up

PR-23C should bind execution evidence more strongly around preflight,
provider-registry selection, permit identity, plan hash, policy hash,
principal hash, and final report artifacts without storing raw execution
material.
