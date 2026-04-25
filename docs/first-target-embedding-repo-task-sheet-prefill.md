# First Target Embedding Repo Task Sheet Prefill

This is a prefilled working draft for the first real embedding repo.

It assumes:

- the target host is Codex Desktop-shaped
- the repo has not wired `codex-router` yet
- the recommended entrypoint will be used
- `memory_overview` is optional and may remain deferred on the first pass

Replace all `TBD` fields once the real repo is chosen.

## 1. Target Identity

- Repo name: `TBD-first-embedding-repo`
- Repo path: `TBD`
- Primary branch: `TBD`
- Integration branch: `TBD`
- Owner: `TBD`
- Date: `2026-04-23`

## 2. Current Decision

- Chosen entrypoint:
  - `createCodexDesktopTargetHostEmbeddingStarter()`
- Local wiring file to create:
  - `TBD/src/codexRouterHost.ts`
- Anchor to use:
  - `tbd-host@codex-router`

## 3. Required Host Methods

Current assumed state before integration starts:

- [ ] `read_thread_terminal`
- [ ] `spawn_agent`
- [ ] `wait_agent`
- [ ] `send_input`
- [ ] `close_agent`
- [ ] `shell_command`
- [ ] `apply_patch`
- [ ] `automation_update`
- [ ] `record_memory`
- [ ] `search_memory`
- [ ] `memory_overview` if the host already supports it

## 4. Directive Layer

Default expected directive layer for the first pass:

- [x] `shellCommand`
- [x] `applyPatch`
- [ ] `automationUpdate`

Planned directive module:

- `TBD/src/codexRouterDirectives.ts`

Rationale:

- the first pass should at least own shell and patch routing explicitly
- `automationUpdate` can stay deferred if the first sanity checks do not need it

## 5. Wiring Steps

Execution order for the first pass:

- [ ] Create `TBD/src/codexRouterHost.ts` with `createCodexDesktopTargetHostEmbeddingStarter()`
- [ ] Wire all required runtime methods to the real host
- [ ] Wire `record_memory` and `search_memory`
- [ ] Run `starter.inspect()`
- [ ] Review `starter.getStatus()`
- [ ] Run `starter.assertReady()`
- [ ] Create the bundle with `starter.createBundle()`
- [ ] Run one read-only sanity check
- [ ] Run one engineering sanity check
- [ ] Record results in project memory / local docs

## 6. Read-Only Sanity Check

- Task id:
  - `embedding-readonly-smoke-01`
- Expected surface:
  - `read_thread_terminal`
- Actual result:
  - `TBD`
- Blockers:
  - `TBD`

Pass rule:

- the task reaches a real execution result without unexpected preflight or
  approval blocking

## 7. Engineering Sanity Check

- Task id:
  - `embedding-engineering-smoke-01`
- Expected surface:
  - `spawn_agent`
  - `wait_agent`
  - `shell_command`
  - `apply_patch`
  - `record_memory`
  - `search_memory`
- Actual result:
  - `TBD`
- Blockers:
  - `TBD`

Pass rule:

- `executionResult.status === "completed"`
- memory checkpoint write succeeds
- no placeholder or missing-method errors appear

## 8. Evidence To Capture

Capture all of these on the first real pass:

- local wiring file path
- directive module path
- `starter.inspect()` snapshot
- `starter.getStatus()` snapshot
- read-only sanity result
- engineering sanity result
- remaining optional methods not wired

## 9. Stop Conditions

Stop and re-evaluate if any of these happen:

- `starter.inspect().ready !== true` after required wiring is supposedly done
- `starter.getStatus().pendingRequiredMethods.length > 0`
- bundle creation throws
- read-only works but engineering fails
- memory methods are still mocks or no-ops
- the repo starts keeping both starter and direct live-host entrypoints

## 10. Done Means

This prefilled sheet becomes complete only when:

- the real repo identity fields are filled
- the local wiring file exists
- all required runtime methods are wired
- all required memory methods are wired
- `starter.getStatus().ready === true`
- `starter.getStatus().nextAction === "create_bundle"`
- bundle creation succeeds
- read-only sanity passes
- engineering sanity passes
- evidence is recorded

## 11. First-Pass Recommendation

For the first real repo, the recommended posture is:

- wire only the required methods first
- treat `memory_overview` as optional unless the host already exposes it
- keep directive routing thin and explicit
- do not attempt a second integration path in parallel
- use `starter.getStatus()` as the source of truth for progress instead of a
  hand-maintained checklist alone
