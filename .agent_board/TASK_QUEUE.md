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
- Run fresh real read-only Codex CLI smoke under exact operator authorization.
- Fast-forward fresh smoke evidence into `main`.
- Rerun main-only real read-only smoke audits on clean `main`.
- Push `main` to `origin/main` at `c95ab3b`.
- Design controlled execution gate for the next real Codex CLI step.
- Validate `npm run audit:controlled-execution-gate-design`.
- Fast-forward controlled execution gate design into `main`.
- Push `main` to `origin/main` at `6e55131`.
- Add future Codex CLI canary execution packet checklist.
- Fast-forward future packet checklist into `main`.
- Validate `npm run audit:future-codex-cli-canary-packet-checklist`.
- Push `main` to `origin/main` at `2f16fa2`.
- Refresh post-push anchors for `4db8174`.
- Draft/review the future canary execution authorization packet.
- Commit the packet draft/review branch.
- Fast-forward merge authorization packet draft/review into local `main`.
- Validate `npm run audit:future-codex-cli-canary-authorization-packet` on clean
  local `main`.
- Refresh post-merge anchors for clean-main authorization packet audit.
- Push local `main` to `origin/main` at `c73fa1b`.
- Refresh post-push anchors for `c73fa1b`.
- Fast-forward merge post-push authorization packet anchors into local `main`.
- Validate `npm run audit:future-codex-cli-canary-authorization-packet` on clean
  local `main` after the post-push anchor merge.
- Push local `main` to `origin/main` at `19b3a5e`.
- Design the final local execution gate for a future real workspace-write
  canary without executing it.
- Fast-forward merge future canary execution gate into local `main`.
- Validate `npm run audit:future-codex-cli-canary-execution-gate` on clean
  local `main`.
- Refresh post-merge anchors for clean-main execution gate audit.
- Push local `main` to `origin/main` at `c679c58`.
- Refresh post-push anchors for `c679c58`.
- Fast-forward merge post-push execution gate anchors into local `main`.
- Validate `npm run audit:future-codex-cli-canary-execution-gate` on clean
  local `main` after the post-push anchor merge.
- Push local `main` to `origin/main` at `fe181cb`.
- Refresh post-push anchors for `fe181cb`.
- Design the final pre-execution review before exact operator authorization.
- Fast-forward merge pre-execution review into local `main`.
- Run `npm run audit:future-codex-cli-canary-pre-execution-review` on clean
  local `main`; blocked only by `mainAlignedWithOrigin`.
- Refresh post-merge anchors for clean-main pre-execution review audit.
- Push local `main` to `origin/main` at `3a71acc`.
- Rerun `npm run audit:future-codex-cli-canary-pre-execution-review` on aligned
  clean `main`.
- Align `audit:workspace-write-real-canary-final-local` with clean aligned
  `main` gate shape.
- Validate the final-local audit fix with targeted tests, typecheck, and full
  `npm test` (`1027 / 1027`).
- Push local `main` to `origin/main` at `590dbd4`.
- Run one bounded real Codex CLI workspace-write canary under exact operator
  authorization.
- Record real canary evidence at
  `docs/evidence/codex-cli-workspace-write-real-canary-latest.json`.
- Remove `tmp\codex-cli-write-canary.txt` after the canary run.
- Push real canary evidence to `origin/main` at `5e24281`.
- Refresh post-real-canary anchors.
- Push post-real-canary anchors to `origin/main` at `5642b43`.
- Push post-canary receipt rollback gate to `origin/main` at `5566777`.
- Validate `npm run audit:post-canary-receipt-rollback-gate` on clean aligned
  `main`.
- Refresh post-rollback-gate anchors.
- Fast-forward merge post-rollback-gate anchors into local `main`.
- Push local `main` to `origin/main` at `67bee3f`.
- Design capability taxonomy and escalation policy for future write-capable
  steps.
- Add local non-executing taxonomy audit script and regression tests.
- Validate taxonomy targeted tests, typecheck, full tests, and build without
  running workspace-write or general provider execution.
- Commit the taxonomy/policy branch.
- Run `npm run audit:capability-taxonomy-escalation-policy` on the clean branch.

## In Progress

- None.

## Blocked

- General workspace-write or general provider execution: requires a separate
  exact operator authorization and a new controlled execution gate.

## Remaining

- Merge and push only after explicit user authorization for that remote action.
