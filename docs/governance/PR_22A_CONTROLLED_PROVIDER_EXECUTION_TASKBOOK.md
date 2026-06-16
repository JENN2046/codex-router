# PR-22A Controlled Provider Execution Minimal Taskbook

## 1. Scope

PR-22A opens the next gated planning artifact after read-only productization
acceptance. It defines the minimum safe slice for controlled provider execution.

This taskbook is local-only. It does not authorize provider execute, does not
authorize invoking the real Codex CLI, does not authorize workspace-write, does
not authorize local command execution, does not authorize protected remote
execution, does not authorize remote write, does not authorize evidence refresh,
and does not authorize push, release, tag, publish, deployment, or external
service write.

## 2. Exact Future Gate

Exact token for a later implementation gate:

- `APPROVE_CONTROLLED_PROVIDER_EXECUTION_MINIMAL_SLICE_PR_22A`

Exact taskbook:

- `docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`

Required prior local closeout:

- `READONLY_PRODUCTIZATION_FINAL_CLOSEOUT_RECORDED`
- `npm run audit:readonly-productization`

Required prior policy artifact:

- `CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED`
- `docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md`

## 3. Minimum Safe Slice

The first controlled provider execution slice may only implement a local gate
for read-only provider execution. The slice must keep the actual execution
surface disabled by default.

Allowed future implementation scope:

- add an explicit controlled execution mode separate from dry-run mode
- keep the default mode as dry-run or disabled
- require provider id `codex-cli`
- require side effect class `read_only`
- require sandbox `read-only`
- require approval policy `never`
- require registry selection
- require provider execution metadata
- require a valid provider execution permit bound to the exact plan
- require injected spawner or injected executor dependency
- require environment preflight showing the injected execution dependency
- require runner invariant checks before any spawn boundary
- require sanitized observation and evidence output
- use fake or stub spawner in local tests

The first slice must not introduce:

- general provider execution
- default provider execution enablement
- workspace-write execution
- local command execution
- protected remote execution
- live MCP, A2A, or App Server transport
- release, tag, publish, deployment, or external service write
- secret or credential changes

## 4. Required Invariants

Any future PR-22A implementation must fail closed unless all invariants are true:

- current worktree is clean before local validation
- branch is `main`
- local `main` is not behind `origin/main`
- read-only productization audit passes
- requested provider id is exactly `codex-cli`
- provider grant side effect class is exactly `read_only`
- provider grant sandbox is exactly `read-only`
- approval policy is exactly `never`
- provider manifest selected by registry matches the planned provider
- provider execution metadata is present and sanitized
- provider execution permit is valid for the exact task, run, provider plan,
  policy decision, and capability scopes
- dry-run mode remains available and unchanged
- execution mode remains disabled unless explicitly selected inside the local
  controlled gate
- injected spawner or executor dependency is present
- no global process, shell, env, or host executor is read implicitly
- evidence omits raw prompt, argv, stdout, stderr, command, task envelope,
  environment values, token values, and patch body

## 5. Required Failure Cases

Future implementation tests must cover these blocking cases:

- missing provider execution permit
- expired, revoked, plan-hash-mismatched, or scope-mismatched permit
- missing provider registry selection
- provider manifest mismatch
- missing provider execution metadata
- missing injected spawner or executor dependency
- requested side effect class is not `read_only`
- requested sandbox is not `read-only`
- requested approval policy is not `never`
- requested provider id is not `codex-cli`
- workspace-write, local command, protected remote, or external write scope is
  present
- execution mode is implied by default rather than explicitly selected
- evidence contains unsanitized execution material or secret-like values

## 6. Required Local Validation For Future Implementation

Before any future PR-22A implementation can be considered complete, rerun:

- `git status --short`
- `git branch -vv`
- `git log --oneline --decorate -n 10`
- `npm run audit:readonly-productization`
- `npm run typecheck`
- targeted provider execution runner tests
- targeted host dispatcher tests
- targeted execution eligibility and approval permit tests
- targeted redaction tests
- `npm test`
- `npm run build`

Required validation result:

- read-only productization audit passes
- targeted tests pass
- typecheck passes
- full tests pass
- build passes
- provider execute calls during taskbook review: `0`
- real Codex CLI calls during taskbook review: `0`
- workspace-write calls during taskbook review: `0`
- external write calls during taskbook review: `0`

## 7. Stop Conditions

Stop before implementation or execution if any of these are true:

- worktree is dirty before validation
- branch is not `main`
- local branch is behind or diverged from `origin/main`
- read-only productization audit fails
- requested scope includes workspace-write, local command, protected remote, or
  external write
- requested scope changes default provider execution posture
- requested scope bundles live protocol transport work
- requested scope bundles release, tag, publish, deployment, or remote write
- requested scope requires secret or credential changes
- rollback or step-back behavior for failure is unspecified
- evidence or logs would expose raw execution material or secret-like values

## 8. Non-authorization

This taskbook does not authorize:

- provider execute
- invoking the real Codex CLI
- running a real provider spawner
- setting any execution operator flag
- workspace-write execute
- local command execute
- protected remote execute
- live MCP, A2A, or App Server transport
- refreshing evidence
- push
- release
- tag
- publish
- deployment
- external service write
- secret or credential changes

The next safe action after this taskbook is a local taskbook review and, if
needed, a separate exact implementation authorization for the minimum safe slice.

## 9. Result

Result:

- `PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_RECORDED`

The project now has a gated taskbook for the first controlled provider
execution planning slice. General provider execution remains closed.
