# PR-14A Formal Read-only CLI Integration Preflight

## 1. Purpose

PR-14A records the local preflight criteria for a later formal real read-only
Codex CLI provider integration.

This is not an authorization to invoke a real Codex CLI process. It is not a
push receipt, release note, tag note, workspace-write approval, production
readiness claim, or provider execution approval.

## 2. Required Prior Evidence

The formal read-only integration path may only be considered after these local
facts are present:

- PR-13A real read-only smoke evidence is passed and sanitized.
- PR-13A real smoke authorization evidence remains local-only.
- PR-13B dispatch control evidence remains fake-only.
- PR-13B dispatch control evidence records `injectedSpawnerGuarded: true`.
- `CodexCliExecutorProvider.execute()` remains disabled by default.
- Real-mode provider execution requires an approved permit.
- Real-mode provider execution requires registry selection.
- Real-mode provider execution requires `environmentPreflight.checks.injectedSpawner === true`.
- workspace-write remains closed.

## 3. Local Acceptance

Local acceptance command:

- `npm run acceptance:formal-readonly-integration`

Expected evidence:

- `docs/evidence/codex-cli-formal-readonly-integration-readiness.json`

The evidence must remain summary-only and must not include raw prompt, raw args,
raw stdout, raw stderr, raw command, raw task envelope, raw environment, raw
token, raw patch, API key markers, or bearer markers.

## 4. Still Closed

Still closed:

- broad real provider execution
- workspace-write execute
- local command execute
- protected remote execute
- release
- tag
- push

Formal integration remains disabled until a later exact authorization and a
separate implementation taskbook. PR-14A only proves that the preflight
criteria are locally inspectable.

## 5. Result

Result:

- `PR_14A_FORMAL_READONLY_CLI_INTEGRATION_PREFLIGHT_RECORDED`
