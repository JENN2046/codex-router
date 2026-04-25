# First Target Embedding Repo Task Sheet

Use this sheet for the first real repo that will embed `codex-router`.

This is not the generic checklist. It is the execution sheet for one concrete
target.

For a starter prefill that assumes a not-yet-wired Codex Desktop-shaped host,
use:

- `first-target-embedding-repo-task-sheet-prefill`

The current chosen first target repo is:

- `first-target-embedding-repo-task-sheet-vcpchat`

## 1. Target Identity

- Repo name:
- Repo path:
- Primary branch:
- Integration branch:
- Owner:
- Date:

## 2. Current Decision

- Chosen entrypoint:
  - default: `createCodexDesktopTargetHostEmbeddingStarter()`
- Local wiring file to create:
- Anchor to use:
  - recommended shape: `<host-name>@codex-router`

## 3. Required Host Methods

Mark each one only after it is connected to the real host, not a mock.

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
- [ ] `memory_overview` if supported by the host

## 4. Directive Layer

Decide whether the target repo needs custom directive builders for:

- [ ] `shellCommand`
- [ ] `applyPatch`
- [ ] `automationUpdate`

Record the local directive file or module:

- Directive module:

## 5. Wiring Steps

Complete these in order.

- [ ] Create the local starter file with `createCodexDesktopTargetHostEmbeddingStarter()`
- [ ] Fill `starter.host` with real host implementations
- [ ] Run `starter.inspect()`
- [ ] Run `starter.assertReady()`
- [ ] Create the bundle with `starter.createBundle()`
- [ ] Run one read-only sanity check
- [ ] Run one engineering sanity check
- [ ] Record the result in project memory / docs

## 6. Read-Only Sanity Check

- Task id:
- Expected surface:
  - at minimum `read_thread_terminal`
- Actual result:
- Blockers:

Pass rule:

- the task reaches a real execution result without unexpected preflight or
  approval blocking

## 7. Engineering Sanity Check

- Task id:
- Expected surface:
  - `spawn_agent`
  - `wait_agent`
  - `shell_command`
  - `apply_patch`
  - `record_memory`
  - `search_memory`
- Actual result:
- Blockers:

Pass rule:

- `executionResult.status === "completed"`
- memory checkpoint write succeeds
- no placeholder or missing-method errors appear

## 8. Evidence To Capture

When this task is executed, capture:

- local wiring file path
- directive file path
- `starter.inspect()` result
- read-only sanity result
- engineering sanity result
- any remaining optional methods not wired yet

## 9. Stop Conditions

Stop and re-evaluate if any of these happen:

- `starter.inspect().ready !== true`
- placeholder methods remain
- bundle creation throws
- read-only works but engineering fails
- memory methods are still mocks or no-ops
- the repo starts trying to support two integration entrypoints at once

## 10. Done Means

This task sheet is complete only when all of these are true:

- one concrete repo is named
- one local wiring file exists
- all required runtime methods are wired
- all required memory methods are wired
- `starter.assertReady()` passes
- bundle creation succeeds
- read-only sanity passes
- engineering sanity passes
- evidence is recorded
