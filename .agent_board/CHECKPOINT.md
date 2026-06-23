# Checkpoint

Checkpoint branch:

- `fix/p1-controlled-output-safety`

Baseline:

- `c29e494`

Current state source:

- `docs/current/CURRENT_STATE.md`

Current checkpoint:

- GPT Pro review P1/P2 hardening, the PR merge-checkout state-sync fix, and
  PR #45 automated review follow-ups are implemented in local commits through
  `c29e494`
- final `npm run validate:pr` passed before the local commit split
- follow-up permit replay hardening is implemented with targeted tests

Completed locally:

- safe controlled runner result/report/event payloads
- Task, Principal, provider plan, manifest, and executor plan binding checks
- read-only provider permit hardening
- trusted in-memory provider permit consumption before fake/real execution
- replay rejection for repeated handoff/permit use, concurrent duplicate
  execution, caller-side permit-id tampering, and retry after spawn failure
- workspace-write approval `never` rejection
- smoke/operator evidence error and telemetry sanitization
- fake provider mode in-memory execution boundary
- default process spawn fail-closed shell policy
- CI state-sync job and state-sync local path checks
- detached PR merge checkout state-sync compatibility
- legacy provider execution plan-store records remain loadable and appendable
- read-only blocked permits return audit reasons when old/custom executor
  plans omit `policyDecisionHash`
- branch-specific state-sync CI audit is limited to `pull_request` events and
  does not run on post-merge `push` events to `main`
- state-sync state surface sanitizer blocks common absolute workspace paths
  including macOS Desktop and devcontainer/Codespaces forms

Validation checkpoint:

- targeted affected tests passed
- `npm run typecheck` passed
- `npm test` passed, `1146 / 1146`
- `npm run validate:pr` passed
- replay targeted tests passed, `79 / 79`
- replay final `npm run validate:pr` passed with `1146 / 1146` full tests
- state-sync detached PR merge checkout test passed, `18 / 18`
- `npm run typecheck` passed after the exact optional test fix
- PR #45 review follow-up targeted tests passed, `41 / 41`
- PR #45 review follow-up `npm run typecheck` passed
- PR #45 review follow-up affected tests passed, `66 / 66`
- `git diff --check` passed before the state documentation commit
- state-sync CI event-scope targeted test passed, `4 / 4`
- state-sync CI event-scope `npm run typecheck` passed
- `git diff --check` passed before the event-scope state documentation commit
- state-sync common absolute path sanitizer targeted test passed, `18 / 18`
- state-sync common absolute path sanitizer `npm run typecheck` passed
- `git diff --check` passed before the absolute path sanitizer state
  documentation commit

Known boundary:

- provider permit consumption is not persistent by default; process restart or
  multi-process replay requires an injected durable consumption store before it
  can be treated as covered

Pending checkpoint:

- final state documentation commit
- post-commit `git status --short`
- post-commit `npm run governance -- audit state-sync`
- post-commit `npm run validate:pr`
- post-commit `git diff --check`
