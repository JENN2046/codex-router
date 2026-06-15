# Task Queue

## Done

- Refresh stale roadmap/continue-anchor baselines through current `24c3508`.
- Add local approval consumption dispatch audit matrix documentation.
- Add `audit:approval-consumption-dispatch-matrix` script entry.
- Add matrix audit implementation and regression tests.
- Validate targeted governance evidence suite, typecheck, full tests, build, and
  staged diff whitespace.
- Commit local checkpoint `b8d0b01`.
- Fast-forward merge evidence matrix into `main`.
- Push `main` to `origin/main` at `24c3508`.
- Validate `npm run audit:approval-consumption-dispatch-matrix` on clean
  `main`.

## In Progress

- Refresh post-push anchors so future agents start from `24c3508`.

## Blocked

- Fresh real Codex CLI read-only smoke: requires explicit operator token and
  should not be inferred from general continuation.

## Remaining

- Run fresh real read-only Codex CLI smoke after exact operator authorization.
- After a fresh read-only smoke, design the controlled execution gate for the
  next real Codex CLI step.
