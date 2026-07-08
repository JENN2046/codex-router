# Controlled Provider Execution Dispatch Preflight Matrix

Marker: `CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX_RECORDED`

This matrix is a dispatch preflight boundary for controlled provider execution.
It is not provider execute authorization. It is not real Codex CLI authorization.
It is not workspace-write authorization. It is not host executor
authorization. It is not sub-agent runtime authorization. It is not
shell/process authorization. It is not external-write authorization. It is not
push, release, tag, publish, deployment, or secret-change authorization.

## Scope

The matrix may describe only the preconditions that must be satisfied before a
caller may hand a controlled read-only request to the provider execution runner.
It does not call `provider.execute`, does not invoke Codex CLI, does not spawn a
host process, does not write evidence, and does not refresh acceptance files.

## Required Dispatch Preconditions

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
- runner real-execution guard is present
- governance strategy is not `step_back`
- governance strategy is not `simulate`
- governance phase is not `recovery`
- sanitized observation and evidence refs are planned before dispatch

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
| provider mismatch | provider id differs from `codex-cli` | stop before runner |
| side-effect mismatch | side effect class differs from `read_only` | stop before runner |
| sandbox mismatch | sandbox differs from `read-only` | stop before runner |
| approval mismatch | approval policy differs from `never` | stop before runner |
| permit invalid | permit missing, stale, mismatched, revoked, expired, or replayed | stop before runner |
| preflight invalid | preflight artifact ref or hash missing/mismatched | stop before runner |
| governance stop | strategy is `step_back` or `simulate`, or phase is `recovery` | stop before runner |
| broad scope | workspace-write, shell/process, protected remote, external write, release, deployment, or secret change appears | stop before runner |

## Current Boundary

The provider execution runner boundary remains the only direct gate before
`provider.execute`. This matrix is a pre-runner dispatch preflight boundary. It
may prove that a request is eligible to reach the runner boundary; it does not
prove that provider execution has occurred and does not authorize general
provider execution.

The next safe action after this matrix is targeted implementation or review of a
pre-runner dispatcher that consumes this matrix and still leaves final execution
authority with the provider execution runner boundary.
