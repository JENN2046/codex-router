# PR-12B Workspace-write Real Canary Taskbook

## 1. Status

This document is a planning artifact only.

It does not authorize real workspace-write execution.

Current boundary:

- Push: not authorized by this document
- Release / tag: prohibited
- Real Codex CLI call: prohibited until an explicit PR-12B execution authorization is issued
- Workspace-write execute: prohibited until an explicit PR-12B execution authorization is issued
- Provider execute wiring changes: prohibited in this taskbook

## 2. Prerequisites

Before any PR-12B implementation or execution work, all of the following must be true and freshly verified:

- `main` worktree is clean.
- Local `main` equals `origin/main`.
- PR-12A is remote-confirmed.
- `npm run typecheck` passes.
- `npm run governance -- acceptance workspace-write-fake-canary` passes.
- `npx tsx --test tests\workspace-write-guard.test.ts` passes.
- `npx tsx --test tests\workspace-write-fake-canary-acceptance.test.ts` passes.
- `npm test` passes.
- `tmp\codex-cli-write-canary.txt` does not exist before the canary.

## 3. Explicit Authorization Required

PR-12B real canary requires a separate human authorization containing all of:

- Exact phrase: `APPROVE_PR_12B_REAL_WORKSPACE_WRITE_CANARY`
- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Branch: `main`
- Allowed target file: `tmp/codex-cli-write-canary.txt`
- Allowed action: one bounded local canary write
- Allowed sandbox: `workspace-write`
- Required rollback: yes
- Push: no, unless separately authorized after review

Without that exact authorization, PR-12B remains blocked.

## 4. Allowed Future Scope

If explicitly authorized later, PR-12B may only prove:

- A single bounded local file canary can be written.
- The target file is exactly `tmp/codex-cli-write-canary.txt`.
- The generated diff touches only that file.
- The diff size is within the PR-12A readiness cap.
- Rollback can restore or remove the target file.
- Evidence remains sanitized.

## 5. Forbidden Future Scope

PR-12B must not:

- Modify provider execute default behavior.
- Open general workspace-write execution.
- Enable local command execution.
- Enable protected remote execution.
- Enable external side effects.
- Write outside `tmp/codex-cli-write-canary.txt`.
- Read or write secret files.
- Log unsanitized task text, full argv, process output, environment values, tokens, or patch body.
- Push, release, tag, publish, merge, rebase, or force push.

## 6. Required Gates

Any future canary runner must fail closed unless all gates are true:

- Fixed target gate: target file equals `tmp/codex-cli-write-canary.txt`.
- Operator gate: explicit PR-12B authorization is present.
- Worktree gate: worktree is clean before execution.
- Branch gate: branch is `main` and not protected for the canary operation.
- Permit gate: workspace-write permit is approved.
- Readiness gate: `evaluateWorkspaceWriteCanaryReadiness()` returns ready.
- Patch gate: patch guard passes after the write.
- Rollback gate: rollback evidence is ready before closeout.

## 7. Required Evidence

Future evidence must record only sanitized fields:

- schema version
- generated timestamp
- target file
- before commit
- after diff hash
- changed file count
- diff line count
- rollback status
- execution counters
- blocking reasons
- validation status

Evidence must not include:

- unsanitized task text
- full argv
- process output
- command line
- task envelope
- environment values
- token values
- patch body
- canary file content

## 8. Stop Conditions

Stop immediately and report blocked if:

- Worktree is not clean.
- Local `main` is behind or diverged from `origin/main`.
- Target file exists before canary and was not explicitly expected.
- Any file other than `tmp/codex-cli-write-canary.txt` changes.
- Patch guard fails.
- Rollback evidence is missing or blocked.
- Any sensitive marker appears in evidence.
- Real Codex CLI invocation would be required without explicit authorization.
- The user instruction is ambiguous about workspace-write permission.

## 9. Validation Plan

Future PR-12B validation should include:

- `npm run typecheck`
- `npm run governance -- acceptance workspace-write-fake-canary`
- targeted workspace-write guard tests
- targeted fake canary acceptance tests
- a PR-12B-specific canary test, if implemented
- `npm test`
- evidence leak scan
- post-canary `git status --short`
- explicit rollback verification

## 10. Current Recommendation

Do not start PR-12B execution from this document.

The next safe action is a human review of this taskbook, followed by a separate exact authorization only if the operator intends to cross from fake-only readiness into one bounded local workspace-write canary.
