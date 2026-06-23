# Handoff

Current scope: GPT Pro review P1 and P2 hardening on a focused branch.

Workspace:

- `codex-router`

Branch:

- `fix/p1-controlled-output-safety`

Baseline:

- `1d2077c`

Upstream:

- `origin/main`

Work in progress:

- final state documentation commit and post-commit validation

Implemented:

- controlled runner outputs use a shared safe executor/provider summary
- validation, failure, and artifact summary payloads are sanitized before
  report/event/result persistence
- executor plan, provider plan, Task, Principal, manifest, and permit bindings
  are checked before provider execution
- provider permits are consumed through a trusted in-memory registry after
  handoff validation and before fake/real provider execution
- repeated handoff/permit use, concurrent duplicate calls, caller-side
  permit-id tampering, and retry after spawn failure are blocked before a
  second provider spawn
- host validation rejects forged `workspace-write + never` plans before spawn
- provider read-only permits require plan hash, run, policy, manifest, Task,
  Principal, nonce, expiration, and consumed-state checks where available
- smoke/operator evidence builders no longer write raw `error` or telemetry
  payloads
- provider fake mode rejects configured process spawners and uses in-memory
  execution summaries
- default Codex CLI spawning no longer has a Windows `shell: true` fallback
- CI runs a real state-sync audit before evidence collection
- state-sync audit blocks machine absolute paths in current state surfaces
- state-sync audit accepts explicitly allowed clean detached PR merge checkouts

Validation already run:

- targeted evidence/shell/provider/dispatcher/state-sync/read-only-chain tests
  passed
- `npm run typecheck` passed
- `npm test` passed, `1146 / 1146`
- `npm run validate:pr` passed
- permit replay targeted tests passed:
  `npx tsx --test tests/provider-core.test.ts tests/codex-cli-provider.test.ts tests/provider-execution-runner.test.ts`
  with `79 / 79`
- final replay `npm run validate:pr` passed with `1146 / 1146` full tests,
  build, and state-sync
- state-sync detached PR merge checkout test passed, `18 / 18`

Known boundary:

- default permit consumption is single-process and in-memory; process restart
  and multi-process replay need a durable injected
  `ProviderExecutionPermitConsumptionStore`

Do not do without explicit instruction:

- real Codex CLI execution
- workspace-write execution
- push, merge, tag, release, deploy
- external service write
- secret or credential changes

Next safe action:

1. commit the final state documentation update
2. rerun `git status --short`
3. rerun `npm run governance -- audit state-sync`
4. rerun `npm run validate:pr`
5. rerun `git diff --check`
