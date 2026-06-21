# Task Queue

Active:

- Resolve PR-22A taskbook review migration on
  `feature/pr-22a-controlled-provider-execution`.
- Run targeted taskbook review validation.
- Implement the minimal controlled read-only provider execution slice.

Queued validation:

- `npm run governance -- audit controlled-provider-execution-taskbook-review`
- targeted provider execution runner tests
- targeted host dispatcher tests
- targeted execution eligibility and approval permit tests
- targeted redaction tests
- `npm run typecheck`
- `npm test`
- `npm run build`

Boundaries:

- no real Codex CLI execution
- no workspace-write execution
- no external writes
- no secret changes
