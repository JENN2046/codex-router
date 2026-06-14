# PR-12B Workspace-write Real Canary Candidate Review Receipt

## 1. Purpose

This receipt records the current local PR-12B candidate review method.

It is intentionally not a point-in-time push receipt. It does not rely on a fixed ahead count as proof of current readiness.

Current state must be rechecked with:

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

The dynamic audit command is the authoritative local consistency check.

It must pass before treating the local candidate as internally consistent.

The command checks:

- worktree is clean
- branch is `main`
- local branch is ahead-only
- required PR-12B files are present in `origin/main..HEAD`
- no unexpected files are present in `origin/main..HEAD`
- acceptance scripts are present in `package.json`
- evidence JSON is parseable
- evidence mode is local-only
- execution counters are zero
- evidence is sanitized
- governance docs remain non-authorizing
- fixed canary target file is absent

## 4. Expected Safe Output

Expected safe text audit properties:

- `status`: `passed`
- `unexpected changed files`: `0`
- provider execute calls: `0`
- real Codex CLI calls: `0`
- workspace-write execute calls: `0`
- canary file writes: `0`

The exact ahead count and changed file count are current-state values and must be read from the command output when the review is performed.

Expected safe JSON audit properties:

- `status` is `passed`
- `checks.worktreeClean` is `true`
- `checks.changedFilesWithinPr12bScope` is `true`
- `checks.evidenceNoExecution` is `true`
- `checks.evidenceSanitized` is `true`
- `checks.canaryFileAbsent` is `true`
- `summary.unexpectedChangedFileCount` is `0`
- `summary.providerExecuteCalls` is `0`
- `summary.realCodexCliCalls` is `0`
- `summary.workspaceWriteExecuteCalls` is `0`
- `summary.canaryFileWrites` is `0`
- `reasons` is empty

The JSON output is for local automation and review tooling. It must remain sanitized and must not be treated as permission to execute workspace-write.

## 5. Non-authorization

This receipt does not authorize:

- real Codex CLI invocation
- provider execute
- workspace-write execute
- canary file write
- remote push
- release
- tag

## 6. Result

Result:

- `PR_12B_LOCAL_CANDIDATE_REVIEW_METHOD_RECORDED`

The candidate review remains local-only and pre-execution-only.
