# PR-12B Workspace-write Real Canary Candidate Review Receipt

## 1. Purpose

This receipt records the current local PR-12B candidate review method.

It is intentionally not a point-in-time push receipt. It does not rely on a fixed ahead count as proof of current readiness.

Current state must be rechecked with:

- `npm run audit:workspace-write-real-canary-final-local`
- `npm run audit:workspace-write-real-canary-candidate`
- `npm run audit:workspace-write-real-canary-candidate -- --json`

## 2. Scope

This receipt applies to the local PR-12B workspace-write real canary pre-execution candidate.

The candidate remains limited to:

- authorization preflight
- pre-execution gate
- local-only acceptance evidence
- local-only consistency audit
- governance closeout and boundary audit documents

## 3. Required Dynamic Review

The final local audit command is the authoritative local review entry point.

It must pass before treating the local candidate as internally consistent:

- `npm run audit:workspace-write-real-canary-final-local`

The final local audit runs the fixed PR-12B validation set:

- `npm run typecheck`
- `npx tsx --test tests\workspace-write-guard.test.ts`
- `npx tsx --test tests\workspace-write-real-canary-authorization-acceptance.test.ts`
- `npx tsx --test tests\workspace-write-real-canary-pre-execution-acceptance.test.ts`
- `npx tsx --test tests\workspace-write-real-canary-local-candidate-consistency.test.ts`
- `npx tsx --test tests\workspace-write-real-canary-sensitive-scan.test.ts`
- `npm run acceptance:workspace-write-real-canary-auth`
- `npm run acceptance:workspace-write-real-canary-pre-execution`
- `npm run audit:workspace-write-real-canary-candidate -- --json`
- `npm run audit:workspace-write-real-canary-sensitive-scan -- --json`

The fixed validation set is covered by tests that bind the command ids,
command arguments, and required `package.json` script names and exact command
targets. A script rename, retarget, or command-set drift should therefore fail
the local final audit or candidate audit before the candidate is treated as
ready.

The candidate consistency audit checks:

- worktree is clean
- branch is `main`
- local branch is ahead-only
- required PR-12B files are present in `origin/main..HEAD`
- no unexpected files are present in `origin/main..HEAD`
- acceptance and audit scripts are present in `package.json` with exact local
  TypeScript command targets
- evidence JSON is parseable
- evidence mode is local-only
- execution counters are zero
- evidence is sanitized
- sensitive marker scan passes
- governance docs remain non-authorizing
- final audit JSON contract is valid and sanitized
- fixed canary target file is absent

The file-scope check uses the unique path list from
`git diff --name-only origin/main..HEAD`. The reported `changedFileCount` is
therefore a unique changed-file count for the current local candidate range,
not a commit count and not an append-only history counter. Later hardening
commits that touch already-allowed audit scripts, tests, or governance receipts
can increase the ahead count while leaving `changedFileCount` unchanged.

The allowed scope is intentionally limited to the PR-12B pre-execution control
chain: workspace-write guard helpers, PR-12B acceptance scripts/tests/evidence,
candidate/final audit scripts and tests, governance receipts, and `package.json`.
Any new path outside that set must fail the candidate audit before the candidate
is treated as ready.

## 4. Expected Safe Output

Expected safe final local audit properties:

- `status`: `passed`
- commands: `10`
- failed commands: `0`
- `checks.noForbiddenCommands` is `true`
- canary file absent: `true`
- provider execute calls: `0`
- real Codex CLI calls: `0`
- workspace-write execute calls: `0`

Expected safe text audit properties:

- `status`: `passed`
- `unexpected changed files`: `0`
- final audit forbidden commands: `false`
- provider execute calls: `0`
- real Codex CLI calls: `0`
- workspace-write execute calls: `0`
- canary file writes: `0`

The exact ahead count and changed file count are current-state values and must be read from the command output when the review is performed.

Expected safe JSON audit properties:

- `status` is `passed`
- `checks.worktreeClean` is `true`
- `checks.changedFilesWithinPr12bScope` is `true`
- `checks.packageScriptsPresent` is `true`
- `checks.auditFieldValuesRecorded` is `true`
- `checks.evidenceNoExecution` is `true`
- `checks.evidenceSanitized` is `true`
- `checks.finalAuditJsonContractValid` is `true`
- `checks.canaryFileAbsent` is `true`
- `summary.unexpectedChangedFileCount` is `0`
- `summary.packageScriptTargetCount` is `6`
- `summary.packageScriptTargetMismatchCount` is `0`
- `summary.finalAuditNoForbiddenCommands` is `true`
- `summary.providerExecuteCalls` is `0`
- `summary.realCodexCliCalls` is `0`
- `summary.workspaceWriteExecuteCalls` is `0`
- `summary.canaryFileWrites` is `0`
- `reasons` is empty

The JSON output is for local automation and review tooling. It must remain sanitized and must not be treated as permission to execute workspace-write.

The candidate audit validates the final local audit JSON contract without
running the final local audit recursively. It checks a synthetic zero-execution
final audit result through the real formatter and requires command entries to
contain only command id, status, and exit code.

## 5. Latest Local Refresh

Latest local refresh date:

- 2026-06-14

The refresh uses dynamic command output as evidence. It does not treat a fixed
commit hash, ahead count, or changed-file count as a permanent readiness
condition.

Refresh commands:

- `npm run audit:workspace-write-real-canary-candidate -- --json`
- `npm run audit:workspace-write-real-canary-final-local -- --json`
- `npm run audit:workspace-write-real-canary-sensitive-scan -- --json`
- canary target absence check

Latest verified boundary:

- candidate audit status: `passed`
- final local audit status: `passed`
- final local audit commands: `10`
- final local audit failed commands: `0`
- candidate audit finalAuditNoForbiddenCommands: `true`
- candidate audit packageScriptTargetCount: `6`
- candidate audit packageScriptTargetMismatchCount: `0`
- candidate audit auditFieldValuesRecorded: `true`
- unexpected changed files: `0`
- provider execute calls: `0`
- real Codex CLI calls: `0`
- workspace-write execute calls: `0`
- canary file writes: `0`
- final audit JSON contract valid: `true`
- fixed canary target file absent: `true`

The refresh remains local-only and pre-execution-only. It is not a push
readiness decision and is not permission to cross into the real canary write.

## 6. Non-authorization

This receipt does not authorize:

- real Codex CLI invocation
- provider execute
- workspace-write execute
- canary file write
- remote push
- release
- tag

## 7. Result

Result:

- `PR_12B_LOCAL_CANDIDATE_REVIEW_METHOD_RECORDED`

The candidate review remains local-only and pre-execution-only.
