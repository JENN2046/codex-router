# Codex Desktop Live Host

`packages/codex-desktop-live-host` is the first end-to-end live wiring surface
for the current repo.

It composes:

- `desktop-host-client`
- `codex-desktop-bindings`
- `codex-memory-host-client`

into one production-shaped bundle for a real Codex Desktop embedding.

## Main Entry

Use:

- `createCodexDesktopLiveHostEmbeddingStarter()`
- `createCodexDesktopLiveHostStarter()`
- `createCodexDesktopLiveHostBundle()`
- `createCodexDesktopLiveHostBundleFromHostObject()`
- `createCodexDesktopLiveHostBundleFromTools()`
- `createCodexDesktopLiveHostSmokeTasks()`
- `runCodexDesktopLiveHostSmoke()`
- `createCodexDesktopLiveHostSmokeEvidence()`

The returned bundle includes:

- `hostClient`
- `bridge`
- `session`
- `memoryClient`
- `memoryAdapter`
- `memoryOperations`

## What This Package Removes

Without this layer, a host has to manually:

- normalize codex-memory tools into host operations
- build a `CodexMemoryAdapter`
- build a Codex Desktop bridge with agent session tracking
- fill default Desktop preflight state
- thread those pieces through `desktop-host-client`

This package does that composition once.

It also fails fast on incomplete current-host objects. If required methods such
as `spawn_agent`, `apply_patch`, `record_memory`, or `search_memory` are
missing, the starter/object entrypoints throw
`codex_desktop_live_host_missing_methods:...` before any execution begins.

It also exposes a structured host inspection surface, so an embedding repo can
check readiness before building the bundle instead of relying only on an
exception string.

For the final Codex Desktop host, prefer
`createCodexDesktopLiveHostEmbeddingStarter()` while wiring the native host
object. It keeps the host object mutable, exposes readiness inspection, and only
creates the live bundle once all required runtime and memory methods are wired.

The returned starter includes:

- `host`
- `inspect()`
- `getStatus()`
- `assertReady()`
- `createBundle()`

`getStatus()` returns:

- `ready`
- `wiredRuntimeMethods`
- `wiredMemoryMethods`
- `pendingRequiredMethods`
- `pendingOptionalMethods`
- `nextAction`

## Final Host Starter Example

```ts
import { createCodexDesktopLiveHostEmbeddingStarter } from "../packages/codex-desktop-live-host/src/index.js";

const starter = createCodexDesktopLiveHostEmbeddingStarter({
  policy,
  anchor: "codex-router@codex-desktop",
  memoryAdapter: {
    target: "process",
    tags: ["codex-desktop"]
  },
  directives: {
    shellCommand(invocation) {
      return {
        command: `npm test -- ${invocation.task.taskId}`,
        workdir: invocation.task.repoContext.repoRoot
      };
    },
    applyPatch(invocation) {
      return buildPatchForTask(invocation.task.taskId);
    }
  },
  telemetryStore
});

starter.host.read_thread_terminal = () => read_thread_terminal();
starter.host.spawn_agent = (input) => spawn_agent(input);
starter.host.send_input = (input) => send_input(input);
starter.host.wait_agent = (input) => wait_agent(input);
starter.host.close_agent = (input) => close_agent(input);
starter.host.automation_update = (input) => automation_update(input);
starter.host.shell_command = (input) => shell_command(input);
starter.host.apply_patch = (patch) => apply_patch(patch);
starter.host.record_memory = (input) => record_memory(input);
starter.host.search_memory = (input) => search_memory(input);
starter.host.memory_overview = (input) => memory_overview(input);

const status = starter.getStatus();
starter.assertReady();

const bundle = starter.createBundle();
const result = await bundle.hostClient.run(task);
```

## Smoke Harness

After the final host object is wired, run the standard smoke harness before
using the bundle for live work:

```ts
import {
  createCodexDesktopLiveHostEmbeddingStarter,
  createCodexDesktopLiveHostSmokeEvidence,
  runCodexDesktopLiveHostSmoke
} from "../packages/codex-desktop-live-host/src/index.js";

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

// Wire starter.host.* to the current Codex Desktop runtime and memory tools.

const smoke = await runCodexDesktopLiveHostSmoke(starter, {
  taskOptions: {
    taskIdPrefix: "codex-desktop-smoke",
    repoRoot: "A:/codex-desktop",
    branch: "main"
  }
});

const evidence = createCodexDesktopLiveHostSmokeEvidence(smoke, {
  host: "Codex Desktop",
  repoRoot: "A:/codex-desktop"
});
```

The default smoke tasks are Codex Desktop shaped, but the task generator is
host-label and source aware. That keeps the smoke contract reusable for a later
Codex CLI host adapter that exposes the same runtime and memory primitives:

```ts
const cliSmokeTasks = createCodexDesktopLiveHostSmokeTasks({
  taskIdPrefix: "codex-cli-host-smoke",
  repoRoot: "A:/codex-cli",
  source: "cli",
  hostLabel: "Codex CLI host",
  moduleName: "codex-cli-live-host",
  engineeringTargetFile: "packages/codex-cli-live-host/src/index.ts",
  tags: ["codex-cli-host-smoke"]
});

const cliSmoke = await runCodexDesktopLiveHostSmoke(starter, {
  tasks: cliSmokeTasks
});
```

The harness returns structured evidence instead of throwing for normal smoke
failures:

- `ready`
- `status`
- `inspection`
- `starterStatus`
- `checks.readOnly`
- `checks.engineering`
- `checks.releasePosture`

Use `createCodexDesktopLiveHostSmokeEvidence(smoke)` when the final host needs
a compact acceptance artifact. The evidence object keeps:

- readiness inspection
- starter status
- pass/fail status for each smoke check
- deduped blocking reasons and errors
- optional host/repo metadata and notes

Expected passing behavior:

- read-only: `decisionResult.status === "ready"` and
  `executionResult.status === "completed"`
- engineering: `decisionResult.status === "ready"` and
  `executionResult.status === "completed"`
- release-posture: `decisionResult.status === "blocked_approval"` and
  `executionResult.status === "not_ready"`

## Fastest Starter Example

```ts
import { createCodexDesktopLiveHostStarter } from "../packages/codex-desktop-live-host/src/index.js";

const codexDesktopHost = {
  read_thread_terminal() {
    return read_thread_terminal();
  },
  spawn_agent(input) {
    return spawn_agent(input);
  },
  send_input(input) {
    return send_input(input);
  },
  wait_agent(input) {
    return wait_agent(input);
  },
  close_agent(input) {
    return close_agent(input);
  },
  automation_update(input) {
    return automation_update(input);
  },
  shell_command(input) {
    return shell_command(input);
  },
  apply_patch(patch) {
    return apply_patch(patch);
  },
  record_memory(input) {
    return record_memory(input);
  },
  search_memory(input) {
    return search_memory(input);
  },
  memory_overview(input) {
    return memory_overview(input);
  }
};

const bundle = createCodexDesktopLiveHostStarter({
  policy,
  anchor: "codex-router@desktop-live-host",
  host: codexDesktopHost,
  memoryAdapter: {
    target: "process",
    tags: ["desktop-live-host"]
  },
  directives: {
    shellCommand(invocation) {
      return {
        command: `npm test -- ${invocation.task.taskId}`,
        workdir: invocation.task.repoContext.repoRoot
      };
    },
    applyPatch(invocation) {
      return buildPatchForTask(invocation.task.taskId);
    }
  },
  telemetryStore
});

const result = await bundle.hostClient.run(task);
const resumed = await bundle.hostClient.resume(task, {
  required: true
});
```

## Current Host Object Example

If you want the same host-object path but need full control over the nested
memory adapter config object, use `createCodexDesktopLiveHostBundleFromHostObject()`.

## Direct Tool Hooks Example

If your host does not already group the current tools into one object, but you
still have direct access to the individual runtime hooks, use
`createCodexDesktopLiveHostBundleFromTools()`.

## Defaults

If the host does not override preflight, this package defaults to:

- `authAvailable: true`
- all current Codex Desktop primitive names in `availableTools`

It will also automatically pass `memoryOverviewProvider` into the host client
when the chosen memory operations expose `memory_overview`.

If your host already exposes one current Codex Desktop host object with both
runtime tools and memory tools, prefer `createCodexDesktopLiveHostStarter()`
for the shortest path, or `createCodexDesktopLiveHostBundleFromHostObject()`
when you want explicit control over the nested memory adapter shape.

If your host exposes the current tools individually rather than as one object,
prefer `createCodexDesktopLiveHostBundleFromTools()`.

## Runtime Validation

For JavaScript or partially typed embeddings, this package also exports:

- `inspectCodexDesktopLiveHostObject()`
- `getMissingCodexDesktopLiveHostMethods()`
- `assertCodexDesktopLiveHostObject()`
- `resolveLiveHostPreflightFromHost()`

Use them when you want an explicit preflight check before building the live host
bundle, or rely on the built-in fail-fast guard in the starter/object entrypoints.

`inspectCodexDesktopLiveHostObject()` returns:

- `ready`
- `availableRuntimeMethods`
- `availableMemoryMethods`
- `availableTools`
- `missingMethods`
- `supportsMemoryOverview`

`resolveLiveHostPreflightFromHost()` is the matching helper when a host wants
its `availableTools` list to be derived from the current host object instead of
hardcoding the default Codex Desktop tool set.

## When To Use It

- use `host-client-example` for a deterministic demo
- use `desktop-host-client` when you want a generic starter with manual wiring
- use `codex-desktop-live-host` when you already know the target host is Codex
  Desktop-shaped and you want one composed live integration surface
