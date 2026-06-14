# PR-16A Formal Read-only Dispatch Boundary

## 1. Scope

PR-16A narrows the formal read-only provider dispatch entry point.

The compatibility helper may still support older read-only call sites, but the
formal integration path must use a stricter wrapper that requires:

- provider registry selection input
- provider execution metadata
- read-only runner result
- read-only provider permit issuance
- real-mode provider guard
- injected fake spawner in local acceptance

This does not authorize real Codex CLI invocation, workspace-write, local
command execution, protected remote execution, push, release, or tag.

## 2. Entry Point

Local acceptance command:

- `npm run acceptance:formal-readonly-dispatch-boundary`

Evidence:

- `docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json`

## 3. Required Proof

The acceptance must prove:

- formal wrapper blocks missing provider registry before spawn
- formal wrapper blocks missing provider metadata before spawn
- registry selection succeeds on the valid path
- read-only provider permit is issued
- formal dispatch completes through one fake spawner call
- manifest guard mismatch blocks before spawn
- write-access mutation blocks before spawn
- real Codex CLI calls are `0`
- workspace-write execute calls are `0`
- local command execute calls are `0`
- protected remote execute calls are `0`
- evidence is sanitized

## 4. Result

Result:

- `PR_16A_FORMAL_READONLY_DISPATCH_BOUNDARY_RECORDED`

The formal read-only provider dispatch path now has a narrower local entry
point while real CLI invocation remains closed.
