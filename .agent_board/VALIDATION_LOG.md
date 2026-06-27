# Validation Log

Current branch:

- `fix/jsonl-event-log-structured-error`

Current head:

- `d2a3e47`

Validated source commit:

- `d2a3e47`

Latest validated commit:

- `d2a3e47`

Upstream:

- `origin/fix/jsonl-event-log-structured-error`

Upstream divergence:

- `ahead 1 / behind 0`

State record mode:

- `state-only descendant allowed`

Recorded local validation for this branch head:

- `git diff --check`: PASS
- `npm test`: PASS, `1163 / 1163`
- `npm run typecheck`: PASS
- `npm run build`: PASS
- state-sync targeted test: PASS

Validation for local PR #47 P1 remediation:

- `git diff --check`: PASS
- `node --import tsx --test tests/state-sync-audit.test.ts`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm test`: not completed because the `tsx` CLI could not open its IPC pipe
  in this sandbox
- `node --import tsx --test tests/*.test.ts`: 122 files passed, 2 files failed
  for environment-gated behavior outside this remediation:
  `tests/arbitrate.test.ts` invokes `npx tsx`, and
  `tests/codex-memory-mcp-client.test.ts` needs local loopback listen
- `node --import tsx scripts/run-state-sync-audit.ts --json`: BLOCKED only by
  `state_sync_dirtyWorktreeStateOnly` while local remediation is uncommitted

Execution boundary for this validation record:

- current validated source head is `d2a3e47`
- local PR #47 P1 remediation changes are uncommitted
- no dependency changes
- no commit
- no push
- no remote writes
- no real provider execution
