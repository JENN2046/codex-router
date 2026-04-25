# First Target Embedding Repo Task Sheet: VCPChat

## Current Status Update (2026-04-24)

This sheet originally froze the first concrete embedding target before the
native host path existed. The repo has since moved forward: `VCPChat` now has a
real `codex-router` native host path with service files, IPC dispatch, preload
exposure, and renderer-side `inspect` / `run` / `resume` access.

Current checked reality on `2026-04-24`:

- target repo branch observed: `codex-photo-studio-pr1-pr2-shell`
- target repo worktree: dirty, with substantial `PhotoStudio` changes and a
  deleted `.vcp_ready`
- native host files already exist:
  - `A:\VCP\VCPChat\modules\services\codexRouterHost.js`
  - `A:\VCP\VCPChat\modules\services\codexRouterDirectives.js`
- IPC / preload / renderer path already exists:
  - `A:\VCP\VCPChat\modules\ipc\desktopRemoteHandlers.js`
  - `A:\VCP\VCPChat\preloads\chat.js`
  - `A:\VCP\VCPChat\preloads\desktop.js`
  - `A:\VCP\VCPChat\renderer.js`
- latest local syntax spot-checks passed for:
  - `node --check A:\VCP\VCPChat\modules\services\codexRouterHost.js`
  - `node --check A:\VCP\VCPChat\modules\services\codexRouterDirectives.js`
  - `node --check A:\VCP\VCPChat\modules\ipc\desktopRemoteHandlers.js`

This means the next useful action is no longer creating the starter files. The
next gate is to protect PR scope, separate unrelated `PhotoStudio` churn from
the native host line, and rerun the documented post-merge / regression checks
from the current branch state.

This freezes the first concrete embedding target for `codex-router`.

Positioning mirror:

- `A:\codex-router\docs\vcpchat-v1-embedding-positioning-mirror-20260423.md`
- `A:\codex-router\docs\vcpchat-v1-embedding-decision-20260423.md`
- `A:\VCP\VCPChat\docs\vcpchat_v1_positioning_scope_non_goals_success_criteria_20260423.md`
- `A:\VCP\VCPChat\docs\vcpchat_v1_scope_freeze_20260423.md`

Chosen repo:

- Repo name: `vcp-chat-desktop`
- Repo path: `A:\VCP\VCPChat`
- Primary branch: `main`
- Integration branch: `feature/vcpchat-ai-image-split`
- Date: `2026-04-23`

Why `VCPChat` is the first target:

- it is already a real Electron desktop host, so it matches the `Desktop-first`
  bundle shape better than the toolbox repos
- it is a JavaScript app, which keeps the first wiring pass aligned with the
  current `codex-router` examples and starter surfaces
- it already has clear host-facing seams under `modules/ipc` and
  `modules/services`
- on `2026-04-23` its worktree was clean, which made it suitable for the first
  isolated embedding pass

Original repo reality checked on `2026-04-23`:

- current branch: `feature/vcpchat-ai-image-split`
- worktree: clean
- local branch inventory includes `main`

Updated repo reality checked on `2026-04-24`:

- current branch: `codex-photo-studio-pr1-pr2-shell`
- worktree: dirty
- observed unrelated or mixed-scope churn includes `Desktopmodules/photoStudio`,
  `modules/services/photoStudio`, `README.md`, `AGENTS.md`, and `.vcp_ready`
- treat all uncommitted changes as user-owned until explicitly sorted

## 1. Current Decision

- Chosen entrypoint:
  - `createCodexDesktopTargetHostEmbeddingStarter()`
- Original local wiring file:
  - `A:\VCP\VCPChat\modules\services\codexRouterHost.js`
- Original directive module:
  - `A:\VCP\VCPChat\modules\services\codexRouterDirectives.js`
- Anchor to use:
  - `vcpchat-desktop@codex-router`

Current status:

- entrypoint remains correct
- local wiring file already exists
- directive module already exists
- main-process anchor currently used by the IPC layer:
  - `vcpchat-main-process@codex-router`

## 2. Required Host Methods

Mark each one only after it is connected to the real host, not a mock.

- [x] `read_thread_terminal`
- [x] `spawn_agent`
- [x] `wait_agent`
- [x] `send_input`
- [x] `close_agent`
- [x] `shell_command`
- [x] `apply_patch`
- [x] `automation_update`
- [x] `record_memory`
- [x] `search_memory`
- [x] `memory_overview`

Basis:

- `createVcpChatRecommendedBindings()` wires local runtime bindings plus
  VCPToolBox memory bindings
- `desktopRemoteHandlers` calls `starter.inspect()`, `starter.getStatus()`,
  `starter.assertReady()`, `bundle.hostClient.run()`, and
  `bundle.hostClient.resume()`
- prior live acceptance recorded renderer-side success for `inspect`, `run`,
  and `resume`

## 3. Directive Layer

First-pass directive posture for `VCPChat`:

- [x] `shellCommand`
- [x] `applyPatch`
- [x] `automationUpdate`

Rationale:

- shell and patch routing are the minimum surfaces needed to prove real
  engineering execution
- `automationUpdate` was wired in the native host path after the initial
  first-pass recommendation

## 4. Wiring Steps

Original first-pass steps, updated with current status.

- [x] Create `modules/services/codexRouterHost.js` with
  `createCodexDesktopTargetHostEmbeddingStarter()`
- [x] Create `modules/services/codexRouterDirectives.js`
- [x] Fill `starter.host` with real `VCPChat` host implementations
- [x] Run `starter.inspect()`
- [x] Review `starter.getStatus()`
- [x] Run `starter.assertReady()`
- [x] Create the bundle with `starter.createBundle()`
- [x] Run one read-only sanity check
- [x] Run one engineering sanity check
- [x] Record the result in project memory / docs

Current next steps:

- [ ] Decide whether the current `PhotoStudio` changes belong in the same PR as
  the native host path
- [ ] Restore or explicitly re-decide the `.vcp_ready` handling before PR closeout
- [ ] Re-run the post-merge regression plan from the current branch state
- [ ] Record any new validation caveats in the VCPChat closeout docs

## 5. Read-Only Sanity Check

- Task id:
  - `vcpchat-embedding-readonly-smoke-01`
- Expected surface:
  - `read_thread_terminal`
- Actual result:
  - prior live acceptance recorded `inspect` success with `ready = true` and no
    pending required methods
- Blockers:
  - current branch/worktree drift needs a fresh regression pass before another
    release or merge decision

Pass rule:

- the task reaches a real execution result without unexpected preflight or
  approval blocking

## 6. Engineering Sanity Check

- Task id:
  - `vcpchat-embedding-engineering-smoke-01`
- Expected surface:
  - `spawn_agent`
  - `wait_agent`
  - `shell_command`
  - `apply_patch`
  - `record_memory`
  - `search_memory`
- Actual result:
  - prior live acceptance recorded `run` and `resume` success with
    `decisionResult` and `executionResult`
- Blockers:
  - current branch/worktree drift needs a fresh regression pass before another
    release or merge decision

Pass rule:

- `executionResult.status === "completed"`
- memory checkpoint write succeeds
- no placeholder or missing-method errors appear

## 7. Evidence To Capture

Already captured in the target repo:

- `A:\VCP\VCPChat\docs\vcpchat_v1_native_host_live_acceptance_20260423.md`
- `A:\VCP\VCPChat\docs\vcpchat_v1_native_host_pr_closeout_20260423.md`
- `A:\VCP\VCPChat\docs\vcpchat_v1_native_host_pr_package_20260424.md`
- `A:\VCP\VCPChat\docs\vcpchat_v1_native_host_validation_addendum_20260424.md`
- `A:\VCP\VCPChat\docs\vcpchat_v1_native_host_post_merge_regression_20260423.md`

Capture again when the current branch is ready for a new gate:

- `modules/services/codexRouterHost.js`
- `modules/services/codexRouterDirectives.js`
- `starter.inspect()` result
- `starter.getStatus()` result
- read-only sanity result
- engineering sanity result
- any remaining optional methods not wired yet

## 8. Stop Conditions

Stop and re-evaluate if any of these happen:

- current PR scope mixes native host changes with unrelated `PhotoStudio`
  changes without an explicit decision
- `.vcp_ready` is deleted or restored without an explicit decision
- `starter.inspect().ready !== true`
- `starter.getStatus().pendingRequiredMethods.length > 0`
- placeholder methods remain
- bundle creation throws
- read-only works but engineering fails
- memory methods are still mocks or no-ops
- the repo starts trying to support two integration entrypoints at once

## 9. Done Means

The original first-pass embedding task is complete when all of these are true:

- `modules/services/codexRouterHost.js` exists
- all required runtime methods are wired
- all required memory methods are wired
- `starter.getStatus().ready === true`
- `starter.getStatus().nextAction === "create_bundle"`
- `starter.assertReady()` passes
- bundle creation succeeds
- read-only sanity passes
- engineering sanity passes
- evidence is recorded

The current branch is ready for another merge or release gate only when all of
these are true:

- PR scope has been sorted against the dirty `VCPChat` worktree
- native host path still passes `inspect`, `run`, and `resume`
- syntax checks pass for the touched host-path files
- any known shell or memory degradation is recorded as a caveat
- `.vcp_ready` handling is explicit

## 10. Recommended Next Move

For the current `VCPChat` state:

- do not start a second embedding path
- treat the existing native host path as the source of truth
- split or explicitly include the current `PhotoStudio` changes before PR
  closeout
- rerun the post-merge regression plan after the branch scope is clean

Historical first-pass recommendation:

- start on `feature/vcpchat-ai-image-split`, not `main`
- keep the first patch limited to one host file and one directive file
- do not wire optional observability or automation surfaces until the first
  engineering sanity check passes
- treat `memory_overview` as optional on pass one unless `VCPChat` already has a
  real implementation path for it
