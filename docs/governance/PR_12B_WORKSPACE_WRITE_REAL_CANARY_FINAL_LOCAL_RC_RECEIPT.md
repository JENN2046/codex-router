# PR-12B Workspace-write Real Canary Final Local RC Receipt

## 1. Purpose

This receipt records the local release-candidate review surface for the PR-12B
workspace-write real canary pre-execution control chain.

It is local-only. It is not a push-readiness receipt, execution authorization,
release note, tag note, or real canary receipt.

## 2. Audit Index

Primary local review index:

- `docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_AUDIT_INDEX.md`

The index remains the entry point for taskbook, authorization, pre-execution,
candidate, final audit, sensitive scan, file-scope, and stop-condition review.

## 3. Machine-readable Review Commands

Fresh local review must use these commands:

- `npm run governance -- audit workspace-write-real-canary-sensitive-scan -- --json`
- `npm run governance -- audit workspace-write-real-canary-candidate -- --json`
- `npm run governance -- audit workspace-write-real-canary-final-local -- --json`

These commands are local-only. They do not invoke real Codex CLI, provider
execute, workspace-write execute, or canary file writes.

## 4. Required Passing Properties

The local RC surface is internally consistent only when fresh command output
shows:

- sensitive scan status is `passed`
- sensitive scan target count is `14`
- sensitive scan marker hit count is `0`
- candidate audit status is `passed`
- candidate audit unexpected changed file count is `0`
- candidate audit provider execute calls are `0`
- candidate audit real Codex CLI calls are `0`
- candidate audit workspace-write execute calls are `0`
- candidate audit canary file writes are `0`
- final local audit status is `passed`
- final local audit command count is `10`
- final local audit failed command count is `0`
- final local audit noForbiddenCommands is `true`
- final local audit sensitiveScanJsonContractValid is `true`
- final local audit sensitive scan target count is `14`
- final local audit sensitive scan marker hit count is `0`
- final local audit provider execute calls are `0`
- final local audit real Codex CLI calls are `0`
- final local audit workspace-write execute calls are `0`
- fixed canary target file is absent
- reasons are empty

## 5. Dynamic State Rule

This receipt does not make a fixed ahead count, changed-file count, or commit
hash a permanent readiness condition. Reviewers must rerun the machine-readable
commands against the current local repository state.

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

- `PR_12B_FINAL_LOCAL_RC_RECEIPT_RECORDED`

The PR-12B candidate remains local-only and pre-execution-only.
