# Validation Log

Current branch:

- `feat/pr-23a-s1-trusted-runtime`

Recorded code head:

- `3396b2b`

V2 pre-commit validation completed:

- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npx --no-install tsx --test tests/state-sync-audit.test.ts tests/governance-check.test.ts`:
  passed, `26 / 26`.
- `npx --no-install tsx --test tests/codex-cli-provider.test.ts tests/codex-cli-host.test.ts tests/provider-execution-runner.test.ts`:
  passed, `169 / 169`.
- `npm test`: passed, `1152 / 1152`.
- `npm run build`: passed.
- `npm run governance -- audit state-sync`: passed.
- `npm run validate:pr`: passed.

Commit follow-up validation completed:

- Commit 1 `npm run typecheck`: passed.
- Commit 1 provider/host/runner targeted tests: passed, `169 / 169`.
- Commit 2 state-sync/governance targeted tests: passed, `26 / 26`.
- Commit 2 state-sync audit first run: blocked because state surfaces still
  recorded the previous local head; this state refresh is the corrective
  documentation scope.
- State-sync audit after the state surface refresh: passed.

Coverage added:

- host execution plans carry trusted runtime bindings
- controlled prompts use stdin rather than argv
- host run validation rejects forged runtime command, argv shape, workdir, and
  prompt channel mismatches
- provider plans omit raw command, raw argv, and prompt text from metadata
- provider validation rejects injected raw runtime fields
- provider execution and evidence summaries expose runtime hash summaries only
- workspace-write approval and preflight artifacts use sanitized runtime
  previews and safe path references
- state-sync audit blocks Windows drive paths, UNC paths, extended Windows
  paths, selected POSIX paths, and secret markers without echoing the blocked
  value
- governance runner uses Node plus the local tsx CLI on Windows instead of the
  `.cmd` shim path

Final validation still pending:

- V2 post-commit validation after Commit 3
- final status, ahead/behind, and commit inspection
