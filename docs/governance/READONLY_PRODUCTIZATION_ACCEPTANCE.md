# Read-only Productization Acceptance

## 1. Purpose

This document records the productized local acceptance package for the read-only
Codex CLI governance chain.

The package is a local audit layer over existing evidence. It is intended to be
repeatable, summarized, and reviewable without refreshing evidence or opening a
new execution surface.

It does not authorize invoking the real Codex CLI, does not authorize provider execute,
does not authorize workspace-write, does not authorize remote write,
does not refresh evidence, and does not set an execution operator flag.

## 2. Entry Point

Local acceptance commands:

- `npm run audit:readonly-productization`
- `npm run audit:readonly-productization -- --json`

Required upstream audit:

- `npm run audit:readonly-formal-integration-matrix`

## 3. Required Evidence

The acceptance package reads these existing files:

- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `docs/evidence/codex-cli-formal-readonly-integration-readiness.json`
- `docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json`
- `docs/evidence/codex-cli-formal-readonly-provider-integration-taskbook-acceptance.json`
- `docs/evidence/codex-cli-formal-readonly-provider-integration-acceptance.json`
- `docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json`
- `docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json`

The files must keep their expected schema versions, expected passed status
where a status exists, read-only sandbox facts, and zero execution counters.

## 4. Required Chain Markers

The productization audit requires the current formal read-only matrix and real
read-only smoke chain to remain closed:

- `PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX_RECORDED`
- `PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE`

The upstream matrix proves:

- formal read-only CLI integration is closed
- formal read-only provider integration is closed
- formal read-only dispatch boundary is closed
- formal real read-only smoke RC is closed
- read-only real smoke chain local closeout is closed

## 5. Pass Criteria

The acceptance package passes only when:

- worktree is clean
- branch is `main`
- local branch is not behind `origin/main`
- required package scripts are present
- all required evidence files are present
- required evidence schema and status facts match
- upstream readiness matrix passes
- productization and roadmap docs record the current boundary
- governance docs do not broaden authorization
- read-only boundary is preserved
- evidence and output remain summarized and sanitized

## 6. Stop Conditions

The audit blocks when any of these are true:

- current branch is not `main`
- local branch is behind `origin/main`
- worktree is dirty
- required package script is missing or changed
- required evidence file is missing
- required evidence schema or status facts do not match
- upstream readiness matrix does not pass
- productization or roadmap docs are missing the boundary markers
- docs authorize real CLI execution, provider execute, workspace-write, remote
  write, evidence refresh, push, release, tag, or deployment
- evidence or output exposes unsummarized execution material or secret-like
  values

## 7. Non-actions

This audit must keep these counts at `0`:

- provider execute calls during audit
- real Codex CLI calls during audit
- workspace-write calls during audit
- evidence writes during audit

## 8. Failure Handling

Failure means the existing read-only productization chain is not currently
reviewable as a clean local acceptance package.

The next safe action is to inspect the blocked reason, restore the narrow
read-only boundary, and rerun the local audit. A failure is not permission to
refresh evidence, run a real CLI path, execute provider work, write files through
a workspace-write path, or perform a remote write.

## 9. Result

Result:

- `READONLY_PRODUCTIZATION_ACCEPTANCE_RECORDED`

The read-only productization package is a local acceptance layer only. It closes
the current evidence chain for review; it does not convert recorded real
read-only evidence into a default execution capability.

## 10. Final Closeout Record

Final local closeout was checked on 2026-06-16 after `main` and `origin/main`
were aligned at `f985c6c`.

Command:

- `npm run audit:readonly-productization`

Observed local result:

```text
status: passed
branch: main
ahead: 0
behind: 0
head: f985c6c
package scripts: 6/6
evidence files: 10/10
evidence schema/status: 10/10
governance docs: 2/2
readiness matrix: passed
missing items: 0
provider execute calls during audit: 0
real CLI calls during audit: 0
workspace-write calls during audit: 0
evidence writes during audit: 0
```

This final closeout record does not authorize invoking the real Codex CLI,
does not authorize provider execute, does not authorize workspace-write, does
not authorize remote write, does not refresh evidence, and does not set an
execution operator flag.

Result:

- `READONLY_PRODUCTIZATION_FINAL_CLOSEOUT_RECORDED`
