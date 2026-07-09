# Controlled Provider Execution Dispatch Preflight Matrix

Marker: `CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX_RECORDED`

This matrix is a dispatch preflight boundary for controlled provider execution.
It is not general provider execute authorization. It is not real Codex CLI authorization.
It is not general workspace-write authorization. It is not host
executor authorization. It is not sub-agent runtime authorization. It is not
shell/process authorization. It is not external-write authorization. It is not
push, release, tag, publish, deployment, or secret-change authorization.

## Scope

The matrix may describe only the preconditions that must be satisfied before a
caller may hand a controlled read-only request or a controlled workspace-write
request to the provider execution runner boundary. The dispatcher may record a
sanitized workspace-write preflight artifact while preparing dispatch input. It
does not call `provider.execute` for workspace-write, does not invoke Codex CLI,
does not spawn a host process, does not write raw evidence, and does not refresh
acceptance files.

## Required Dispatch Preconditions

For controlled read-only dispatch:

- provider id is exactly `codex-cli`
- side effect class is exactly `read_only`
- sandbox is exactly `read-only`
- approval policy is exactly `never`
- execution mode is explicitly `controlled_readonly`
- dry-run remains the default when controlled execution is not explicitly
  selected
- provider registry selection is present
- provider manifest matches the selected provider
- provider execution plan hash is bound to the selected plan
- provider execution permit is valid for the exact task, run, provider plan,
  provider id, side effect class, sandbox, and approval policy
- environment preflight artifact ref is present
- environment preflight artifact hash is present
- environment preflight artifact is present in the artifact store
- environment preflight artifact payload verification passes in the artifact
  store
- environment preflight artifact stored payload hash matches the expected
  sanitized dispatch preflight artifact payload
- environment preflight artifact metadata binds the expected artifact ref,
  artifact hash, provider execution plan hash, task id, and run id
- environment preflight artifact metadata binds the expected executor plan hash,
  provider manifest hash, and policy decision hash for the current dispatch
  authorization context
- runner real-execution guard is present
- governance strategy is not `step_back`
- governance strategy is not `simulate`
- governance phase is not `recovery`
- sanitized observation and evidence refs are planned before dispatch

For controlled workspace-write dispatch:

- provider id is exactly `codex-cli`
- side effect class is exactly `workspace_write`
- sandbox is exactly `workspace-write`
- workspace-write permit v2 is approved and bound to the exact executor plan
- operation manifest is declared and hashed
- execution authorization id matches the permit and runner input
- dispatcher preparation records a sanitized controlled workspace-write
  preflight artifact
- environment preflight artifact ref and hash are present
- environment preflight artifact is present in the artifact store
- artifact metadata binds the provider plan hash, executor plan hash, operation
  manifest hash, provider manifest hash, policy decision hash, task id, and run
  id
- provider execute is forbidden
- real Codex CLI is forbidden
- external write is forbidden
- rollback is required
- governance strategy is not `step_back`
- governance strategy is not `simulate`
- governance phase is not `recovery`

## Stop Matrix

The dispatch preflight must stop before runner dispatch when any of these
conditions are true:

- provider id is not `codex-cli`
- side effect class is not `read_only`
- sandbox is not `read-only`
- approval policy is not `never`
- execution mode is omitted, inferred, or default-enabled
- provider registry selection is missing
- provider manifest does not match the selected provider
- provider execution plan hash is missing or mismatched
- provider execution permit is missing, expired, revoked, nonce-replayed,
  scope-mismatched, or plan-hash-mismatched
- environment preflight artifact ref is missing
- environment preflight artifact hash is missing or mismatched
- environment preflight artifact is missing from the artifact store
- environment preflight artifact payload verification fails in the artifact
  store
- environment preflight artifact stored payload hash differs from the expected
  sanitized dispatch preflight artifact payload
- environment preflight artifact metadata is missing, stale, or bound to a
  different artifact ref, artifact hash, provider execution plan hash, task id,
  or run id
- environment preflight artifact metadata is bound to a different executor plan
  hash, provider manifest hash, or policy decision hash
- runner real-execution guard is missing
- governance strategy is `step_back` or `simulate`
- governance phase is `recovery`
- requested scope includes workspace-write, local command, shell/process,
  protected remote, external write, release, tag, publish, deployment, or secret
  change
- evidence would include raw prompt, argv, stdout, stderr, command, task
  envelope, raw environment, token, or secret-like value

## Matrix Rows

| Row | Preconditions | Result |
| --- | --- | --- |
| dry-run default | controlled mode not explicitly selected | stay in dry-run or disabled path; no provider execute |
| controlled read-only candidate | exact provider, permit, plan, registry, preflight, guard, and governance checks pass | may hand off to the provider execution runner boundary |
| controlled workspace-write prepare | exact provider, workspace-write permit v2, executor plan, operation manifest, registry, environment checks, authorization id, and governance inputs are present | record sanitized preflight artifact and return prepared dispatch input |
| controlled workspace-write candidate | exact provider, workspace-write permit v2, plan, registry, operation manifest, preflight artifact binding, authorization id, and governance checks pass | may hand off to the provider execution runner boundary without provider execute or real Codex CLI |
| provider mismatch | provider id differs from `codex-cli` | stop before runner |
| side-effect mismatch | side effect class differs from `read_only` | stop before runner |
| sandbox mismatch | sandbox differs from `read-only` | stop before runner |
| approval mismatch | approval policy differs from `never` | stop before runner |
| permit invalid | permit missing, stale, mismatched, revoked, expired, or replayed | stop before runner |
| preflight invalid | preflight artifact ref/hash missing or mismatched, artifact-store verification fails, stored artifact payload hash differs from the expected payload, or stored artifact metadata is not bound to the exact plan/executor/policy/manifest/task/run | stop before runner |
| governance stop | strategy is `step_back` or `simulate`, or phase is `recovery` | stop before runner |
| broad scope | unprepared workspace-write, shell/process, protected remote, external write, release, deployment, or secret change appears | stop before runner |

## Current Boundary

The provider execution runner boundary remains the only direct gate before
`provider.execute`. This matrix is a pre-runner dispatch preflight boundary. It
may prove that a request is eligible to reach the runner boundary; it does not
prove that provider execution has occurred and does not authorize general
provider execution.

The next safe action after this matrix is targeted implementation or review of a
pre-runner dispatcher that consumes this matrix and still leaves final execution
authority with the provider execution runner boundary.
