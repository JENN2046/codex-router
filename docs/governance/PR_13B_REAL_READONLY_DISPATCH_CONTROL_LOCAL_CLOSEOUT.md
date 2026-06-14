# PR-13B Real Read-only Dispatch Control Local Closeout

## 1. Scope

PR-13B tightens the local control chain between the completed PR-13A real
read-only smoke and any future formal real read-only CLI integration.

This closeout is local governance evidence only. It is not a push receipt,
release note, tag note, workspace-write approval, or authorization to invoke a
real Codex CLI process.

## 2. Control Change

Real-mode `CodexCliExecutorProvider.execute()` now requires the real execution
guard to prove:

- `realExecutionAllowed === true`
- provider registry selection matched the active provider manifest hash
- environment preflight status is `ready`
- `environmentPreflight.checks.injectedSpawner === true`
- `environmentPreflight.checks.realCliAllowed === true`
- `environmentPreflight.checks.noWorkspaceWrite === true`
- prompt and task envelope are not sent through guard metadata
- no real CLI fallback is allowed

If `injectedSpawner` is false, the provider rejects before spawn with:

- `codex_cli_provider_real_execute_preflight_requires_injected_spawner`

## 3. Evidence

Updated local acceptance:

- `scripts/run-real-readonly-dispatch-acceptance.ts`
- `tests/real-readonly-dispatch-acceptance.test.ts`
- `docs/evidence/codex-cli-real-readonly-dispatch-acceptance.json`

Provider guard coverage:

- `tests/codex-cli-provider.test.ts`

Closeout coverage:

- `tests/pr-13b-real-readonly-dispatch-control-closeout.test.ts`

## 4. Boundaries Preserved

Still closed:

- workspace-write execute
- local command execute
- protected remote execute
- provider execution without permit
- real Codex CLI invocation without a separate exact operator authorization
- push
- release
- tag

The acceptance path remains fake-only. The fake spawner is injected explicitly
and the evidence records `noRealCodexCli: true`.

## 5. Sanitization

The dispatch control evidence remains summary-only. It must not contain:

- raw prompt
- raw args
- raw stdout
- raw stderr
- raw command
- raw task envelope
- raw environment
- raw token
- raw patch
- API key markers
- bearer markers

## 6. Result

Result:

- `PR_13B_REAL_READONLY_DISPATCH_CONTROL_LOCAL_CLOSEOUT_COMPLETE`

PR-13B leaves the project ready for a later formal real read-only CLI
integration stage, but it does not authorize that stage or execute a real CLI
process.
