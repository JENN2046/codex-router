# Final Codex Desktop Host Integration Checklist (2026-04-24)

This checklist is for wiring `codex-router` into the final host: Codex Desktop
itself.

It supersedes the VCPChat-first task sheets for this phase. VCPChat remains the
first real Electron validation host, but the final host path should now use the
first-class `codex-desktop-live-host` starter directly.

## 1. Current Decision

- Final host:
  - Codex Desktop
- Recommended entrypoint:
  - `createCodexDesktopLiveHostEmbeddingStarter()`
- Package:
  - `packages/codex-desktop-live-host`
- Host shape:
  - one current host object exposing runtime tools and memory tools
- Goal:
  - reach `starter.getStatus().nextAction === "create_bundle"`

## 2. Required Runtime Methods

Wire these to the real Codex Desktop primitives:

- [ ] `read_thread_terminal`
- [ ] `spawn_agent`
- [ ] `wait_agent`
- [ ] `send_input`
- [ ] `close_agent`
- [ ] `shell_command`
- [ ] `apply_patch`
- [ ] `automation_update`

Pass bar:

- every method is a real current-host call
- no placeholder, mock, or no-op implementation remains
- method names and payload shapes match `CodexDesktopToolRuntimeOperations`

## 3. Required Memory Methods

Wire these to the real Codex memory surface:

- [ ] `record_memory`
- [ ] `search_memory`

Recommended when available:

- [ ] `memory_overview`

Pass bar:

- checkpoint writes can be recorded
- checkpoint recall can search prior writes
- `memory_overview` is wired if the final host can provide memory health during
  preflight

## 4. Starter Wiring

Create the host starter inside the final host integration layer:

```ts
import { createCodexDesktopLiveHostEmbeddingStarter } from "codex-router/...";

const starter = createCodexDesktopLiveHostEmbeddingStarter({
  policy,
  anchor: "codex-router@codex-desktop",
  memoryAdapter: {
    target: "process",
    tags: ["codex-desktop"]
  },
  directives,
  telemetryStore
});
```

Then assign the live host methods:

```ts
starter.host.read_thread_terminal = () => read_thread_terminal();
starter.host.spawn_agent = (input) => spawn_agent(input);
starter.host.wait_agent = (input) => wait_agent(input);
starter.host.send_input = (input) => send_input(input);
starter.host.close_agent = (input) => close_agent(input);
starter.host.shell_command = (input) => shell_command(input);
starter.host.apply_patch = (patch) => apply_patch(patch);
starter.host.automation_update = (input) => automation_update(input);
starter.host.record_memory = (input) => record_memory(input);
starter.host.search_memory = (input) => search_memory(input);
starter.host.memory_overview = (input) => memory_overview(input);
```

Pass bar:

- `starter.inspect().ready === true`
- `starter.getStatus().pendingRequiredMethods.length === 0`
- `starter.getStatus().nextAction === "create_bundle"`
- `starter.assertReady()` passes

## 5. Directive Layer

Keep task-to-host translation explicit:

- [ ] `shellCommand`
- [ ] `applyPatch`
- [ ] `automationUpdate`

Pass bar:

- raw host methods only execute concrete host requests
- directive builders own task-specific translation
- engineering tasks can produce explicit shell and patch payloads

## 6. Bundle Creation

Only create the bundle after readiness passes:

```ts
starter.assertReady();
const bundle = starter.createBundle();
```

Pass bar:

- bundle creation succeeds
- `bundle.hostClient.run(task)` is available
- `bundle.hostClient.resume(task, options)` is available
- `bundle.memoryClient` is available
- `bundle.session` tracks task-local agents

## 7. Read-Only Smoke

Use the standard smoke harness after the starter is ready:

```ts
const smoke = await runCodexDesktopLiveHostSmoke(starter, {
  taskOptions: {
    taskIdPrefix: "codex-desktop-smoke",
    repoRoot: "A:/codex-desktop",
    branch: "main"
  }
});

const evidence = createCodexDesktopLiveHostSmokeEvidence(smoke, {
  host: "Codex Desktop",
  repoRoot: "A:/codex-desktop",
  notes: ["final host acceptance smoke"]
});
```

The read-only check should run first.

Expected behavior:

- task class resolves to read-only or small safe profile
- preflight passes
- no approval gate blocks unexpectedly
- execution reaches the real host path
- `read_thread_terminal` is exercised

Pass bar:

- `smoke.checks.readOnly.passed === true`
- `smoke.checks.readOnly.decisionStatus === "ready"`
- `smoke.checks.readOnly.executionStatus === "completed"`
- no missing-method errors

## 8. Engineering Smoke

The engineering check should run after read-only and before release-posture.

Expected runtime surface:

- `spawn_agent`
- `wait_agent`
- `shell_command`
- `apply_patch`
- `record_memory`
- `search_memory`

Pass bar:

- `smoke.checks.engineering.passed === true`
- `smoke.checks.engineering.decisionStatus === "ready"`
- `smoke.checks.engineering.executionStatus === "completed"`
- checkpoint write succeeds
- resume can recover from memory or checkpoint fallback
- shell and patch directives are explicit and reviewable

## 9. Release-Posture Smoke

The release-posture check should verify governance blocking before any live
release action.

Expected behavior:

- approval requirement is explicit
- memory policy pack resolves to strict release posture
- telemetry mandatory behavior is visible
- no external write happens without explicit approval

Pass bar:

- `smoke.checks.releasePosture.passed === true`
- `smoke.checks.releasePosture.decisionStatus === "blocked_approval"`
- `smoke.checks.releasePosture.executionStatus === "not_ready"`
- protected action is blocked or approval-gated as expected
- blocking reasons are structured and host-readable
- no production or external action is triggered by the smoke

## 10. Evidence To Capture

Record these in the final host repo:

- starter creation location
- `starter.inspect()` result
- `starter.getStatus()` result
- `createCodexDesktopLiveHostSmokeEvidence(smoke)` result
- read-only smoke result
- engineering smoke result
- release-posture smoke result
- memory overview result if available
- telemetry event sink used for the smoke
- remaining optional methods not wired

## 11. Stop Conditions

Pause and re-evaluate if any of these happen:

- `starter.inspect().ready !== true`
- `starter.getStatus().pendingRequiredMethods.length > 0`
- bundle creation throws
- read-only smoke works but engineering smoke fails
- memory methods are mocks or no-ops
- `memory_overview` is expected but unavailable in release posture
- approval gates are bypassed for protected actions
- shell or patch directives are inferred implicitly instead of being explicit
- final host starts using the VCPChat-specific starter path

## 12. Done Means

The final host integration is ready for its first controlled use when:

- the final host uses `createCodexDesktopLiveHostEmbeddingStarter()`
- all required runtime methods are wired
- all required memory methods are wired
- `starter.getStatus().nextAction === "create_bundle"`
- `starter.assertReady()` passes
- bundle creation succeeds
- `runCodexDesktopLiveHostSmoke(starter).status === "passed"`
- evidence is recorded

## 13. Current Router Baseline

Validated in `A:\codex-router`:

- `npm run typecheck`
- `npm run build`
- `npm test`

Current `2026-04-25` result:

- `155/155` tests passing
