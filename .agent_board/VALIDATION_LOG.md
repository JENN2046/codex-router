# Validation Log

Current branch:

- `fix/p1-controlled-output-safety`

Baseline:

- `56d3ada`

Review hardening validation:

- `npx tsx --test --test-name-pattern "evidence never writes raw|redacts sensitive process errors" tests/codex-cli-host.test.ts`:
  passed, `2 / 2`.
- `npx tsx --test --test-name-pattern "default process spawner|evidence never writes raw|redacts sensitive process errors|converts synchronous spawner failure" tests/codex-cli-host.test.ts`:
  passed, `4 / 4`.
- `npx tsx --test --test-name-pattern "fake mode|handoff|read-only provider dispatch|runner results through provider|registry selection" tests/codex-cli-provider.test.ts tests/host-dispatcher.test.ts`:
  passed, `8 / 8`.
- `npx tsx --test tests/canary-evidence.test.ts tests/state-sync-audit.test.ts`:
  passed, `21 / 21`.
- `npx tsx --test tests/codex-cli-provider.test.ts tests/host-dispatcher.test.ts tests/desktop-decision-runner.test.ts tests/provider-execution-runner.test.ts`:
  passed, `89 / 89`.
- `npx tsx --test tests/read-only-control-chain-acceptance.test.ts tests/approval-consumption-dispatch-matrix-audit.test.ts`:
  passed, `6 / 6`.
- `npm run typecheck`: passed.
- `npm test`: passed, `1146 / 1146`.

Final PR gate:

- `npm run validate:pr`: passed; this includes `npm run typecheck`,
  `npm test` with `1146 / 1146`, `npm run build`, and
  `npm run governance -- audit state-sync`.

Permit replay hardening validation:

- `npm run typecheck`: passed.
- `npm test -- tests/provider-core.test.ts tests/codex-cli-provider.test.ts`:
  failed because the npm script ran the full `tests/*.test.ts` suite plus the
  extra arguments and one newly added assertion expected a provider `error`
  where the host contract returns a failed execution summary. The assertion was
  corrected before final validation.
- `npx tsx --test tests/provider-core.test.ts tests/codex-cli-provider.test.ts tests/provider-execution-runner.test.ts`:
  passed, `79 / 79`.
- `npm run validate:pr`: passed after the PR closeout review; this includes
  `npm run typecheck`, `npm test` with `1146 / 1146`,
  `npm run build`, and `npm run governance -- audit state-sync`.

PR closeout validation before local commits:

- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npx tsx --test tests/provider-core.test.ts tests/codex-cli-provider.test.ts tests/provider-execution-runner.test.ts`:
  passed, `79 / 79`.
- `npm test`: passed, `1146 / 1146`.
- `npm run build`: passed.
- `npm run governance -- audit state-sync`: passed before local commits.
- `npm run validate:pr`: passed; includes typecheck, `npm test` with
  `1146 / 1146`, build, and state-sync.

Coverage added:

- controlled result no longer returns full executor metadata
- controlled report/event/result use the same safe executor plan summary
- provider artifact summary channels are bounded and sanitized
- validation and provider failure payloads are sanitized before persistence
- `workspace-write + approvalPolicy never` is rejected before spawn
- executor metadata tampering is rejected by provider permit plan hash binding
- Task content replacement is rejected by provider plan Task hash binding
- Principal replacement is rejected by provider plan Principal binding
- read-only provider permits reject pending approval status, consumed state,
  expired timestamps, and plan hash mismatches
- read-only provider permits reject nonce mismatches and are consumed through a
  trusted in-memory registry before fake/real provider execution
- replayed handoffs, concurrent duplicate execution attempts, caller-side
  `permitId`/`consumedAt` tampering, and retry after spawn failure do not allow
  a second provider spawn
- process restart or multi-process replay remains an explicit non-persistent
  boundary unless a durable `ProviderExecutionPermitConsumptionStore` is
  injected
- smoke/operator evidence builders write sanitized error and telemetry payloads
- fake provider mode rejects configured process spawners and returns in-memory
  execution summaries
- default Codex CLI process spawning stays `shell: false`
- CI contains a real state-sync audit job before evidence collection
- state-sync audit blocks machine absolute paths in state surfaces
