import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import type { AuditEvent } from "../packages/audit-memory/src/index.js";
import type {
  CodexCliChildProcess,
  CodexCliProcessRunOptions,
  CodexCliProcessStream
} from "../packages/codex-cli-host/src/index.js";
import type { CheckpointRef, TaskEnvelopeInput } from "../packages/contracts/src/index.js";
import {
  assertCodexDesktopLiveHostObject,
  createCodexDesktopLiveHostBundle,
  createCodexDesktopLiveHostBundleFromHostObject,
  createCodexDesktopLiveHostEmbeddingStarter,
  createCodexDesktopLiveHostSmokeEvidence,
  createCodexDesktopLiveHostSmokeTasks,
  createCodexDesktopLiveHostStarter,
  createCodexDesktopLiveHostBundleFromTools,
  getMissingCodexDesktopLiveHostMethods,
  inspectCodexDesktopLiveHostObject,
  runCodexDesktopLiveHostSmoke,
  resolveLiveHostPreflight,
  resolveLiveHostPreflightFromHost
} from "../packages/codex-desktop-live-host/src/index.js";
import type { CodexDesktopRuntime } from "../packages/codex-desktop-bindings/src/index.js";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

class FakeCodexCliStream extends EventEmitter implements CodexCliProcessStream {
  setEncoding(_encoding: BufferEncoding): void {
    return;
  }
}

class FakeCodexCliChild extends EventEmitter implements CodexCliChildProcess {
  readonly stdout = new FakeCodexCliStream();
  readonly stderr = new FakeCodexCliStream();

  constructor() {
    super();
    queueMicrotask(() => {
      this.emit("close", 0, null);
    });
  }

  kill(): boolean {
    return false;
  }
}

function createPassingCodexCliOptions(): CodexCliProcessRunOptions {
  return {
    allowWriteSandbox: true,
    skipExecutionModelProbe: true,
    spawn: () => new FakeCodexCliChild()
  };
}

class InMemoryCheckpointStore {
  private readonly checkpoints: CheckpointRef[] = [];

  async record(checkpoint: CheckpointRef): Promise<void> {
    this.checkpoints.push(checkpoint);
  }

  async findLatestForTask(taskId: string): Promise<CheckpointRef | undefined> {
    return [...this.checkpoints]
      .filter((checkpoint) => checkpoint.taskId === taskId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }
}

class InMemoryAuditStore {
  private readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async loadAll(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}

function createReadTask(taskId: string): TaskEnvelopeInput {
  return {
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "review current config",
      requestedAction: "inspect and summarize the current config state",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  };
}

function createEngineeringTask(taskId: string): TaskEnvelopeInput {
  return {
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "implement feature",
      requestedAction: "make multi-file engineering changes and validate them",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/codex-desktop-live-host/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "engineering", riskHints: [], tags: [] }
  };
}

test("codex desktop live host bundle composes runtime, memory tools, and host client run/resume", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const spawned: unknown[] = [];
  const waited: unknown[] = [];
  const sent: unknown[] = [];
  const shellRequests: unknown[] = [];
  const patches: unknown[] = [];
  const runtime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent(input) {
      spawned.push(input);
      return {
        agentId: `agent-${spawned.length}`,
        nickname: `Agent${spawned.length}`
      };
    },
    sendInput(input) {
      sent.push(input);
      return { id: "message-1" };
    },
    waitAgent(input) {
      waited.push(input);
      return {
        status: "completed",
        message: "done"
      };
    },
    closeAgent() {
      return {
        status: "completed"
      };
    },
    automationUpdate() {
      return {
        status: "ACTIVE"
      };
    },
    shellCommand(input) {
      shellRequests.push(input);
      return {
        exitCode: 0,
        stdout: "ok",
        stderr: ""
      };
    },
    applyPatch(input) {
      patches.push(input);
      return {
        changedFiles: 1,
        summary: "patched"
      };
    }
  };
  const memoryEntries: { title: string; content: string }[] = [];

  const bundle = createCodexDesktopLiveHostBundle({
    policy,
    runtime,
    memory: {
      adapter: {
        anchor: "codex-router@codex-desktop-live-host",
        target: "process",
        tags: ["codex-desktop-live-host"],
        verifyRecall: true
      },
      tools: {
        recordMemoryTool(input) {
          memoryEntries.push({
            title: input.title,
            content: input.content
          });
          return {
            success: true,
            memoryId: `memory-${memoryEntries.length}`,
            filePath: `memory://memory-${memoryEntries.length}`
          };
        },
        searchMemoryTool(input) {
          const result = memoryEntries
            .find((entry) => [entry.title, entry.content].join("\n").toLowerCase().includes(input.query.toLowerCase().split(/\s+/)[0] ?? ""));
          return {
            results: result
              ? [{
                title: result.title,
                memoryId: "memory-1",
                content: result.content
              }]
              : []
          };
        },
        memoryOverviewTool() {
          return {
            adapterStatus: {
              codexMcp: "enabled"
            },
            summary: {
              rejected: 0
            },
            shadowSync: {
              reconcileCount: 0
            },
            recall: {
              available: true,
              status: "enabled"
            }
          };
        }
      }
    },
    directives: {
      shellCommand(invocation) {
        return {
          command: `npm test -- ${invocation.task.taskId}`
        };
      },
      applyPatch(invocation) {
        return `*** Begin Patch\n*** Add File: ${invocation.task.taskId}.txt\n+ready\n*** End Patch\n`;
      }
    },
    availableAgents: 2,
    telemetryStore: createRecordingTelemetrySink(),
    now: () => "2026-04-23T16:45:00.000Z"
  });

  const runResult = await bundle.hostClient.run(createEngineeringTask("live-host-read"));
  const resumeResult = await bundle.hostClient.resume(createEngineeringTask("live-host-read"), {
    required: true
  });

  assert.equal(runResult.executionResult.status, "completed");
  assert.equal(resumeResult.decisionResult.resumeSource, "memory");
  assert.equal(spawned.length, 0);
  assert.equal(waited.length, 0);
  assert.ok(shellRequests.length >= 1);
  assert.ok(patches.length >= 1);
});

test("codex desktop live host bundle wires directive resolvers and persistence into engineering execution", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const shellRequests: unknown[] = [];
  const patches: string[] = [];
  const auditStore = new InMemoryAuditStore();
  const checkpointStore = new InMemoryCheckpointStore();
  const telemetryStore = createRecordingTelemetrySink();
  const runtime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent() {
      return { agentId: "agent-1" };
    },
    sendInput() {
      return { id: "message-1" };
    },
    waitAgent() {
      return { status: "completed" };
    },
    closeAgent() {
      return { status: "completed" };
    },
    automationUpdate() {
      return { status: "ACTIVE" };
    },
    shellCommand(input) {
      shellRequests.push(input);
      return {
        exitCode: 0,
        stdout: "validated",
        stderr: ""
      };
    },
    applyPatch(patch) {
      patches.push(patch);
      return {
        changedFiles: 2,
        summary: "patched"
      };
    }
  };

  const bundle = createCodexDesktopLiveHostBundle({
    policy,
    runtime,
    memory: {
      adapter: {
        anchor: "codex-router@codex-desktop-live-host-engineering",
        target: "process"
      },
      operations: {
        record_memory() {
          return {
            success: true,
            memoryId: "memory-1",
            filePath: "memory://memory-1"
          };
        },
        search_memory() {
          return {
            results: []
          };
        }
      }
    },
    directives: {
      shellCommand(invocation) {
        return {
          command: `npm test -- ${invocation.task.taskId}`,
          ...(invocation.task.repoContext.repoRoot !== undefined
            ? { workdir: invocation.task.repoContext.repoRoot }
            : {})
        };
      },
      applyPatch() {
        return "*** Begin Patch\n*** Add File: live-host.txt\n+ready\n*** End Patch\n";
      }
    },
    persistence: {
      checkpointStore,
      auditStore
    },
    telemetryStore,
    now: () => "2026-04-23T16:46:00.000Z"
  });

  const result = await bundle.hostClient.run(createEngineeringTask("live-host-engineering"));
  const auditEvents = await auditStore.loadAll();
  const telemetryEvents = await telemetryStore.loadAll();

  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(shellRequests, [{
    command: "npm test -- live-host-engineering",
    workdir: "A:/codex-router"
  }]);
  assert.equal(patches[0], "*** Begin Patch\n*** Add File: live-host.txt\n+ready\n*** End Patch\n");
  assert.ok(auditEvents.some((event) => event.type === "runner_ready"));
  assert.ok(telemetryEvents.length >= 1);
  assert.ok((await checkpointStore.findLatestForTask("live-host-engineering")) !== undefined);
});

test("codex desktop live host requires memory operations or tool-style memory hooks", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const runtime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent() {
      return { agentId: "agent-1" };
    },
    sendInput() {
      return { id: "message-1" };
    },
    waitAgent() {
      return { status: "completed" };
    },
    closeAgent() {
      return { status: "completed" };
    },
    automationUpdate() {
      return { status: "ACTIVE" };
    },
    shellCommand() {
      return { exitCode: 0 };
    },
    applyPatch() {
      return { changedFiles: 1 };
    }
  };

  assert.throws(() => createCodexDesktopLiveHostBundle({
    policy,
    runtime,
    memory: {
      adapter: {
        anchor: "codex-router@missing-memory"
      }
    }
  }), /codex_desktop_live_host_requires_memory_operations_or_tools/);
});

test("resolveLiveHostPreflight fills Codex Desktop defaults", () => {
  const preflight = resolveLiveHostPreflight({
    workspaceClean: false
  });

  assert.equal(preflight.authAvailable, true);
  assert.deepEqual(preflight.availableTools, [
    "read_thread_terminal",
    "spawn_agent",
    "wait_agent",
    "send_input",
    "close_agent",
    "shell_command",
    "apply_patch",
    "automation_update"
  ]);
  assert.equal(preflight.workspaceClean, false);
});

test("inspectCodexDesktopLiveHostObject reports readiness, methods, and memory overview support", () => {
  const inspection = inspectCodexDesktopLiveHostObject({
    read_thread_terminal() {
      return "terminal snapshot";
    },
    spawn_agent() {
      return { agentId: "agent-1" };
    },
    send_input() {
      return { id: "message-1" };
    },
    shell_command() {
      return { exitCode: 0 };
    },
    record_memory() {
      return {
        success: true,
        memoryId: "memory-1",
        filePath: "memory://memory-1"
      };
    },
    search_memory() {
      return {
        results: []
      };
    },
    memory_overview() {
      return {
        adapterStatus: {
          codexMcp: "enabled"
        }
      };
    }
  });

  assert.equal(inspection.ready, false);
  assert.deepEqual(inspection.availableRuntimeMethods, [
    "read_thread_terminal",
    "spawn_agent",
    "send_input",
    "shell_command"
  ]);
  assert.deepEqual(inspection.availableMemoryMethods, [
    "record_memory",
    "search_memory",
    "memory_overview"
  ]);
  assert.deepEqual(inspection.availableTools, [
    "read_thread_terminal",
    "spawn_agent",
    "send_input",
    "shell_command"
  ]);
  assert.deepEqual(inspection.missingMethods, [
    "wait_agent",
    "close_agent",
    "apply_patch",
    "automation_update"
  ]);
  assert.equal(inspection.supportsMemoryOverview, true);
});

test("resolveLiveHostPreflightFromHost derives available tools from the current host object", () => {
  const preflight = resolveLiveHostPreflightFromHost({
    read_thread_terminal() {
      return "terminal snapshot";
    },
    spawn_agent() {
      return { agentId: "agent-1" };
    },
    send_input() {
      return { id: "message-1" };
    },
    shell_command() {
      return { exitCode: 0 };
    }
  }, {
    workspaceClean: false
  });

  assert.equal(preflight.authAvailable, true);
  assert.equal(preflight.workspaceClean, false);
  assert.deepEqual(preflight.availableTools, [
    "read_thread_terminal",
    "spawn_agent",
    "send_input",
    "shell_command"
  ]);
});

test("codex desktop live host bundle can be created directly from tool-style runtime hooks", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const shellCalls: unknown[] = [];
  const patchCalls: string[] = [];
  const telemetryStore = createRecordingTelemetrySink();
  const bundle = createCodexDesktopLiveHostBundleFromTools({
    policy,
    runtimeTools: {
      read_thread_terminal() {
        return "terminal snapshot";
      },
      spawn_agent() {
        return { agentId: "agent-1" };
      },
      send_input() {
        return { id: "message-1" };
      },
      wait_agent() {
        return { status: "completed" };
      },
      close_agent() {
        return { status: "completed" };
      },
      automation_update() {
        return { status: "ACTIVE" };
      },
      shell_command(input) {
        shellCalls.push(input);
        return {
          exitCode: 0,
          stdout: "ok",
          stderr: ""
        };
      },
      apply_patch(input) {
        patchCalls.push(input);
        return {
          changedFiles: 1,
          summary: "patched"
        };
      }
    },
    memory: {
      adapter: {
        anchor: "codex-router@tool-style-live-host",
        target: "process"
      },
      tools: {
        recordMemoryTool() {
          return {
            success: true,
            memoryId: "memory-1",
            filePath: "memory://memory-1"
          };
        },
        searchMemoryTool() {
          return {
            results: []
          };
        }
      }
    },
    directives: {
      shellCommand() {
        return {
          command: "npm test"
        };
      },
      applyPatch() {
        return "*** Begin Patch\n*** Add File: tool-style-live-host.txt\n+ready\n*** End Patch\n";
      }
    },
    telemetryStore,
    now: () => "2026-04-23T16:55:00.000Z"
  });

  const result = await bundle.hostClient.run(createEngineeringTask("tool-style-live-host"));

  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(shellCalls, [{
    command: "npm test"
  }]);
  assert.equal(patchCalls[0], "*** Begin Patch\n*** Add File: tool-style-live-host.txt\n+ready\n*** End Patch\n");
});

test("codex desktop live host bundle can be created from a current host object", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const shellCalls: unknown[] = [];
  const patchCalls: string[] = [];
  const memoryCalls = {
    record_memory: [] as unknown[],
    search_memory: [] as unknown[],
    memory_overview: [] as unknown[]
  };
  const telemetryStore = createRecordingTelemetrySink();
  const bundle = createCodexDesktopLiveHostBundleFromHostObject({
    policy,
    host: {
      read_thread_terminal() {
        return "terminal snapshot";
      },
      spawn_agent() {
        return { agentId: "agent-1" };
      },
      send_input() {
        return { id: "message-1" };
      },
      wait_agent() {
        return { status: "completed" };
      },
      close_agent() {
        return { status: "completed" };
      },
      automation_update() {
        return { status: "ACTIVE" };
      },
      shell_command(input) {
        shellCalls.push(input);
        return {
          exitCode: 0,
          stdout: "ok",
          stderr: ""
        };
      },
      apply_patch(input) {
        patchCalls.push(input);
        return {
          changedFiles: 1,
          summary: "patched"
        };
      },
      record_memory(input) {
        memoryCalls.record_memory.push(input);
        return {
          success: true,
          memoryId: "memory-1",
          filePath: "memory://memory-1"
        };
      },
      search_memory(input) {
        memoryCalls.search_memory.push(input);
        return {
          results: []
        };
      },
      memory_overview(input = {}) {
        memoryCalls.memory_overview.push(input);
        return {
          adapterStatus: {
            codexMcp: "enabled"
          }
        };
      }
    },
    memory: {
      adapter: {
        anchor: "codex-router@host-object-live-host",
        target: "process"
      }
    },
    directives: {
      shellCommand() {
        return {
          command: "npm test -- current-host-object"
        };
      },
      applyPatch() {
        return "*** Begin Patch\n*** Add File: current-host-object.txt\n+ready\n*** End Patch\n";
      }
    },
    telemetryStore,
    now: () => "2026-04-23T17:05:00.000Z"
  });

  const result = await bundle.hostClient.run(createEngineeringTask("current-host-object"));
  const overview = await bundle.memoryClient.memoryOverview();

  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(shellCalls, [{
    command: "npm test -- current-host-object"
  }]);
  assert.equal(patchCalls[0], "*** Begin Patch\n*** Add File: current-host-object.txt\n+ready\n*** End Patch\n");
  assert.ok(memoryCalls.record_memory.length >= 1);
  assert.ok(memoryCalls.search_memory.length >= 1);
  assert.ok(memoryCalls.memory_overview.length >= 1);
  assert.deepEqual(overview, {
    adapterStatus: {
      codexMcp: "enabled"
    }
  });
});

test("codex desktop live host starter reduces current host wiring to host plus anchor", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const shellCalls: unknown[] = [];
  const telemetryStore = createRecordingTelemetrySink();
  const bundle = createCodexDesktopLiveHostStarter({
    policy,
    anchor: "codex-router@starter-host",
    host: {
      read_thread_terminal() {
        return "terminal snapshot";
      },
      spawn_agent() {
        return { agentId: "agent-1" };
      },
      send_input() {
        return { id: "message-1" };
      },
      wait_agent() {
        return { status: "completed" };
      },
      close_agent() {
        return { status: "completed" };
      },
      automation_update() {
        return { status: "ACTIVE" };
      },
      shell_command(input) {
        shellCalls.push(input);
        return {
          exitCode: 0,
          stdout: "ok",
          stderr: ""
        };
      },
      apply_patch() {
        return {
          changedFiles: 1,
          summary: "patched"
        };
      },
      record_memory() {
        return {
          success: true,
          memoryId: "memory-1",
          filePath: "memory://memory-1"
        };
      },
      search_memory() {
        return {
          results: []
        };
      }
    },
    directives: {
      shellCommand() {
        return {
          command: "npm test -- starter-host"
        };
      },
      applyPatch() {
        return "*** Begin Patch\n*** Add File: starter-host.txt\n+ready\n*** End Patch\n";
      }
    },
    telemetryStore,
    now: () => "2026-04-23T17:15:00.000Z"
  });

  const result = await bundle.hostClient.run(createEngineeringTask("starter-host"));

  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(shellCalls, [{
    command: "npm test -- starter-host"
  }]);
});

test("codex desktop live host embedding starter exposes readiness before bundle creation", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    policy,
    anchor: "codex-router@desktop-embedding-starter"
  });

  assert.equal(starter.inspect().ready, false);
  assert.deepEqual(starter.getStatus(), {
    ready: false,
    wiredRuntimeMethods: [],
    wiredMemoryMethods: [],
    pendingRequiredMethods: [
      "read_thread_terminal",
      "spawn_agent",
      "wait_agent",
      "send_input",
      "close_agent",
      "shell_command",
      "apply_patch",
      "automation_update",
      "record_memory",
      "search_memory"
    ],
    pendingOptionalMethods: [
      "memory_overview"
    ],
    nextAction: "wire_required_methods"
  });
  assert.throws(
    () => starter.createBundle(),
    /codex_desktop_live_host_missing_methods:read_thread_terminal,spawn_agent,wait_agent,send_input,close_agent,shell_command,apply_patch,automation_update,record_memory,search_memory/
  );
});

test("codex desktop live host embedding starter creates a bundle after the current host is wired", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const shellCalls: unknown[] = [];
  const patchCalls: string[] = [];
  const telemetryStore = createRecordingTelemetrySink();
  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    policy,
    anchor: "codex-router@desktop-embedding-starter-wired",
    directives: {
      shellCommand() {
        return {
          command: "npm test -- desktop-embedding-starter"
        };
      },
      applyPatch() {
        return "*** Begin Patch\n*** Add File: desktop-embedding-starter.txt\n+ready\n*** End Patch\n";
      }
    },
    telemetryStore,
    now: () => "2026-04-24T10:00:00.000Z"
  });

  starter.host.read_thread_terminal = () => "terminal snapshot";
  starter.host.spawn_agent = () => ({ agentId: "agent-1" });
  starter.host.wait_agent = () => ({ status: "completed" });
  starter.host.send_input = () => ({ id: "message-1" });
  starter.host.close_agent = () => ({ status: "completed" });
  starter.host.automation_update = () => ({ status: "ACTIVE" });
  starter.host.shell_command = (input) => {
    shellCalls.push(input);
    return {
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    };
  };
  starter.host.apply_patch = (patch) => {
    patchCalls.push(patch);
    return {
      changedFiles: 1,
      summary: "patched"
    };
  };
  starter.host.record_memory = () => ({
    success: true,
    memoryId: "memory-1",
    filePath: "memory://memory-1"
  });
  starter.host.search_memory = () => ({
    results: []
  });
  starter.host.memory_overview = () => ({
    adapterStatus: {
      codexMcp: "enabled"
    }
  });

  assert.equal(starter.inspect().ready, true);
  assert.deepEqual(starter.getStatus(), {
    ready: true,
    wiredRuntimeMethods: [
      "read_thread_terminal",
      "spawn_agent",
      "wait_agent",
      "send_input",
      "close_agent",
      "shell_command",
      "apply_patch",
      "automation_update"
    ],
    wiredMemoryMethods: [
      "record_memory",
      "search_memory",
      "memory_overview"
    ],
    pendingRequiredMethods: [],
    pendingOptionalMethods: [],
    nextAction: "create_bundle"
  });
  assert.doesNotThrow(() => starter.assertReady());

  const bundle = starter.createBundle();
  const result = await bundle.hostClient.run(createEngineeringTask("desktop-embedding-starter"));

  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(shellCalls, [{
    command: "npm test -- desktop-embedding-starter"
  }]);
  assert.equal(
    patchCalls[0],
    "*** Begin Patch\n*** Add File: desktop-embedding-starter.txt\n+ready\n*** End Patch\n"
  );
});

test("codex desktop live host smoke tasks provide standard final-host task envelopes", () => {
  const tasks = createCodexDesktopLiveHostSmokeTasks({
    taskIdPrefix: "final-host",
    repoRoot: "A:/codex-desktop",
    branch: "main",
    protectedBranch: true
  });

  assert.equal(tasks.readOnly.taskId, "final-host-readonly");
  assert.equal(tasks.readOnly.hints?.taskClassHint, "read_only");
  assert.equal(tasks.readOnly.repoContext?.repoRoot, "A:/codex-desktop");
  assert.deepEqual(tasks.readOnly.hints?.tags, ["final-host-smoke", "read-only"]);

  assert.equal(tasks.engineering.taskId, "final-host-engineering");
  assert.equal(tasks.engineering.hints?.taskClassHint, "engineering");
  assert.equal(tasks.engineering.constraints?.explicitOwnership, true);
  assert.deepEqual(tasks.engineering.target?.modules, ["codex-desktop-live-host"]);

  assert.equal(tasks.releasePosture.taskId, "final-host-release-posture");
  assert.equal(tasks.releasePosture.hints?.taskClassHint, "release_external_action");
  assert.deepEqual(tasks.releasePosture.target?.branches, ["main"]);
  assert.equal(tasks.releasePosture.repoContext?.protectedBranch, true);
  assert.deepEqual(tasks.releasePosture.hints?.tags, ["final-host-smoke", "release-posture"]);
});

test("codex desktop live host smoke tasks can target a future Codex CLI host", () => {
  const tasks = createCodexDesktopLiveHostSmokeTasks({
    taskIdPrefix: "codex-cli-host",
    repoRoot: "A:/codex-cli",
    branch: "main",
    source: "cli",
    hostLabel: "Codex CLI host",
    moduleName: "codex-cli-live-host",
    engineeringTargetFile: "packages/codex-cli-live-host/src/index.ts",
    tags: ["codex-cli-host-smoke"]
  });

  assert.equal(tasks.readOnly.source, "cli");
  assert.equal(tasks.readOnly.intent.summary, "inspect Codex CLI host readiness");
  assert.deepEqual(tasks.readOnly.target?.modules, ["codex-cli-live-host"]);
  assert.deepEqual(tasks.readOnly.hints?.tags, ["codex-cli-host-smoke", "read-only"]);

  assert.equal(tasks.engineering.source, "cli");
  assert.equal(tasks.engineering.intent.summary, "validate Codex CLI host engineering path");
  assert.deepEqual(tasks.engineering.target?.files, ["packages/codex-cli-live-host/src/index.ts"]);
  assert.deepEqual(tasks.engineering.target?.modules, ["codex-cli-live-host"]);
  assert.deepEqual(tasks.engineering.hints?.tags, ["codex-cli-host-smoke", "engineering"]);

  assert.equal(tasks.releasePosture.source, "cli");
  assert.equal(tasks.releasePosture.intent.summary, "verify Codex CLI host release posture");
  assert.deepEqual(tasks.releasePosture.target?.modules, ["codex-cli-live-host"]);
  assert.deepEqual(tasks.releasePosture.hints?.tags, ["codex-cli-host-smoke", "release-posture"]);
});

test("codex desktop live host smoke returns readiness failure before creating a bundle", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    policy,
    anchor: "codex-router@desktop-smoke-not-ready"
  });

  const result = await runCodexDesktopLiveHostSmoke(starter);

  assert.equal(result.ready, false);
  assert.equal(result.status, "failed");
  assert.equal(result.starterStatus.nextAction, "wire_required_methods");
  assert.equal(result.checks.readOnly.passed, false);
  assert.equal(result.checks.readOnly.error, "host_not_ready");
  assert.ok(result.checks.readOnly.blockingReasons.includes("read_thread_terminal"));
  assert.equal(result.checks.engineering.error, "host_not_ready");
  assert.equal(result.checks.releasePosture.error, "host_not_ready");
});

test("codex desktop live host smoke passes read-only, engineering, and release-posture checks", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const shellCalls: unknown[] = [];
  const patchCalls: string[] = [];
  const memoryWrites: unknown[] = [];
  const telemetryStore = createRecordingTelemetrySink();
  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    policy,
    anchor: "codex-router@desktop-smoke-passing",
    directives: {
      shellCommand(invocation) {
        return {
          command: `npm test -- ${invocation.task.taskId}`
        };
      },
      applyPatch(invocation) {
        return `*** Begin Patch\n*** Add File: ${invocation.task.taskId}.txt\n+ready\n*** End Patch\n`;
      }
    },
    telemetryStore,
    codexCliOptions: createPassingCodexCliOptions(),
    now: () => "2026-04-24T11:00:00.000Z"
  });

  starter.host.read_thread_terminal = () => "terminal snapshot";
  starter.host.spawn_agent = () => ({ agentId: "agent-1" });
  starter.host.wait_agent = () => ({ status: "completed" });
  starter.host.send_input = () => ({ id: "message-1" });
  starter.host.close_agent = () => ({ status: "completed" });
  starter.host.automation_update = () => ({ status: "ACTIVE" });
  starter.host.shell_command = (input) => {
    shellCalls.push(input);
    return {
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    };
  };
  starter.host.apply_patch = (patch) => {
    patchCalls.push(patch);
    return {
      changedFiles: 1,
      summary: "patched"
    };
  };
  starter.host.record_memory = (input) => {
    memoryWrites.push(input);
    return {
      success: true,
      memoryId: `memory-${memoryWrites.length}`,
      filePath: `memory://memory-${memoryWrites.length}`
    };
  };
  starter.host.search_memory = () => ({
    results: []
  });
  starter.host.memory_overview = () => ({
    adapterStatus: {
      codexMcp: "enabled"
    },
    summary: {
      rejected: 0
    },
    shadowSync: {
      reconcileCount: 0
    },
    recall: {
      available: true,
      status: "enabled"
    }
  });

  const result = await runCodexDesktopLiveHostSmoke(starter, {
    taskOptions: {
      taskIdPrefix: "desktop-smoke"
    }
  });

  assert.equal(result.ready, true);
  assert.equal(result.status, "passed");
  assert.equal(result.checks.readOnly.passed, true);
  assert.equal(result.checks.readOnly.decisionStatus, "ready");
  assert.equal(result.checks.readOnly.executionStatus, "completed");
  assert.equal(result.checks.engineering.passed, true);
  assert.equal(result.checks.engineering.decisionStatus, "ready");
  assert.equal(result.checks.engineering.executionStatus, "completed");
  assert.equal(result.checks.releasePosture.passed, true);
  assert.equal(result.checks.releasePosture.decisionStatus, "blocked_approval");
  assert.equal(result.checks.releasePosture.executionStatus, "not_ready");
  assert.ok(result.checks.releasePosture.blockingReasons.some((reason) => reason.startsWith("tool_access:")));
  assert.deepEqual(shellCalls, [{
    command: "npm test -- desktop-smoke-engineering"
  }]);
  assert.equal(patchCalls[0], "*** Begin Patch\n*** Add File: desktop-smoke-engineering.txt\n+ready\n*** End Patch\n");
  assert.ok(memoryWrites.length >= 2);
});

test("codex desktop live host smoke captures run errors as structured failures", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const telemetryStore = createRecordingTelemetrySink();
  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    policy,
    anchor: "codex-router@desktop-smoke-error",
    directives: {
      shellCommand() {
        return {
          command: "npm test -- should-not-run"
        };
      },
      applyPatch() {
        return "*** Begin Patch\n*** Add File: should-not-run.txt\n+ready\n*** End Patch\n";
      }
    },
    telemetryStore
  });

  starter.host.read_thread_terminal = () => "terminal snapshot";
  starter.host.spawn_agent = () => ({ agentId: "agent-1" });
  starter.host.wait_agent = () => ({ status: "completed" });
  starter.host.send_input = () => ({ id: "message-1" });
  starter.host.close_agent = () => ({ status: "completed" });
  starter.host.automation_update = () => ({ status: "ACTIVE" });
  starter.host.shell_command = () => ({ exitCode: 0 });
  starter.host.apply_patch = () => ({ changedFiles: 1 });
  starter.host.record_memory = () => ({
    success: true,
    memoryId: "memory-1",
    filePath: "memory://memory-1"
  });
  starter.host.search_memory = () => ({
    results: []
  });
  starter.host.memory_overview = () => ({
    adapterStatus: {
      codexMcp: "enabled"
    },
    summary: {
      rejected: 0
    },
    shadowSync: {
      reconcileCount: 0
    },
    recall: {
      available: true,
      status: "enabled"
    }
  });

  const validTasks = createCodexDesktopLiveHostSmokeTasks({
    taskIdPrefix: "desktop-smoke-error"
  });
  const result = await runCodexDesktopLiveHostSmoke(starter, {
    tasks: {
      ...validTasks,
      readOnly: {
        taskId: "",
        intent: {
          summary: "",
          requestedAction: ""
        }
      } as unknown as TaskEnvelopeInput
    }
  });

  assert.equal(result.ready, true);
  assert.equal(result.status, "failed");
  assert.equal(result.checks.readOnly.passed, false);
  assert.match(result.checks.readOnly.error ?? "", /String must contain at least 1 character/);
  assert.equal(result.checks.engineering.passed, true);
  assert.equal(result.checks.releasePosture.passed, true);
});

test("codex desktop live host smoke evidence summarizes passing checks for final host capture", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    policy,
    anchor: "codex-router@desktop-smoke-evidence",
    directives: {
      shellCommand(invocation) {
        return {
          command: `npm test -- ${invocation.task.taskId}`
        };
      },
      applyPatch(invocation) {
        return `*** Begin Patch\n*** Add File: ${invocation.task.taskId}.txt\n+ready\n*** End Patch\n`;
      }
    },
    telemetryStore: createRecordingTelemetrySink(),
    codexCliOptions: createPassingCodexCliOptions(),
    now: () => "2026-04-24T12:00:00.000Z"
  });

  starter.host.read_thread_terminal = () => "terminal snapshot";
  starter.host.spawn_agent = () => ({ agentId: "agent-1" });
  starter.host.wait_agent = () => ({ status: "completed" });
  starter.host.send_input = () => ({ id: "message-1" });
  starter.host.close_agent = () => ({ status: "completed" });
  starter.host.automation_update = () => ({ status: "ACTIVE" });
  starter.host.shell_command = () => ({
    exitCode: 0,
    stdout: "ok",
    stderr: ""
  });
  starter.host.apply_patch = () => ({
    changedFiles: 1,
    summary: "patched"
  });
  starter.host.record_memory = () => ({
    success: true,
    memoryId: "memory-1",
    filePath: "memory://memory-1"
  });
  starter.host.search_memory = () => ({
    results: []
  });
  starter.host.memory_overview = () => ({
    adapterStatus: {
      codexMcp: "enabled"
    },
    summary: {
      rejected: 0
    },
    shadowSync: {
      reconcileCount: 0
    },
    recall: {
      available: true,
      status: "enabled"
    }
  });

  const smoke = await runCodexDesktopLiveHostSmoke(starter, {
    taskOptions: {
      taskIdPrefix: "desktop-smoke-evidence"
    }
  });
  const evidence = createCodexDesktopLiveHostSmokeEvidence(smoke, {
    generatedAt: "2026-04-24T12:01:00.000Z",
    host: "Codex Desktop",
    repoRoot: "A:/codex-desktop",
    notes: ["captured in final host acceptance"]
  });

  assert.equal(evidence.schemaVersion, "codex-desktop-live-host-smoke-evidence.v1");
  assert.equal(evidence.generatedAt, "2026-04-24T12:01:00.000Z");
  assert.equal(evidence.host, "Codex Desktop");
  assert.equal(evidence.repoRoot, "A:/codex-desktop");
  assert.equal(evidence.status, "passed");
  assert.deepEqual(evidence.summary.passedChecks, [
    "readOnly",
    "engineering",
    "releasePosture"
  ]);
  assert.deepEqual(evidence.summary.failedChecks, []);
  assert.ok(evidence.summary.blockingReasons.some((reason) => reason.startsWith("tool_access:")));
  assert.deepEqual(evidence.summary.errors, []);
  assert.equal("result" in evidence.checks.engineering, false);
  assert.deepEqual(evidence.notes, ["captured in final host acceptance"]);
});

test("codex desktop live host smoke evidence captures not-ready blockers", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    policy,
    anchor: "codex-router@desktop-smoke-evidence-not-ready"
  });

  const smoke = await runCodexDesktopLiveHostSmoke(starter);
  const evidence = createCodexDesktopLiveHostSmokeEvidence(smoke, {
    generatedAt: "2026-04-24T12:02:00.000Z"
  });

  assert.equal(evidence.ready, false);
  assert.equal(evidence.status, "failed");
  assert.deepEqual(evidence.summary.passedChecks, []);
  assert.deepEqual(evidence.summary.failedChecks, [
    "readOnly",
    "engineering",
    "releasePosture"
  ]);
  assert.ok(evidence.summary.blockingReasons.includes("read_thread_terminal"));
  assert.deepEqual(evidence.summary.errors, ["host_not_ready"]);
});

test("codex desktop live host reports missing methods on partial current host objects", () => {
  const missing = getMissingCodexDesktopLiveHostMethods({
    read_thread_terminal() {
      return "terminal snapshot";
    },
    spawn_agent() {
      return { agentId: "agent-1" };
    },
    send_input() {
      return { id: "message-1" };
    }
  });

  assert.deepEqual(missing, [
    "wait_agent",
    "close_agent",
    "shell_command",
    "apply_patch",
    "automation_update",
    "record_memory",
    "search_memory"
  ]);

  assert.throws(
    () => assertCodexDesktopLiveHostObject({
      read_thread_terminal() {
        return "terminal snapshot";
      }
    }),
    /codex_desktop_live_host_missing_methods:spawn_agent,wait_agent,send_input,close_agent,shell_command,apply_patch,automation_update,record_memory,search_memory/
  );
});

test("codex desktop live host starter fails fast when the current host object is incomplete", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const incompleteHost = {
    read_thread_terminal() {
      return "terminal snapshot";
    },
    spawn_agent() {
      return { agentId: "agent-1" };
    },
    wait_agent() {
      return { status: "completed" };
    },
    send_input() {
      return { id: "message-1" };
    },
    close_agent() {
      return { status: "completed" };
    },
    automation_update() {
      return { status: "ACTIVE" };
    },
    shell_command() {
      return { exitCode: 0 };
    },
    record_memory() {
      return {
        success: true,
        memoryId: "memory-1",
        filePath: "memory://memory-1"
      };
    },
    search_memory() {
      return {
        results: []
      };
    }
  } as unknown as Parameters<typeof createCodexDesktopLiveHostStarter>[0]["host"];

  assert.throws(
    () => createCodexDesktopLiveHostStarter({
      policy,
      anchor: "codex-router@incomplete-starter",
      host: incompleteHost,
      directives: {
        shellCommand() {
          return {
            command: "npm test -- incomplete-starter"
          };
        }
      }
    }),
    /codex_desktop_live_host_missing_methods:apply_patch/
  );
});

test("codex desktop live host keeps final-host helpers in the public surface", async () => {
  const moduleExports = await import("../packages/codex-desktop-live-host/src/index.js");

  assert.equal("createCodexDesktopLiveHostEmbeddingStarter" in moduleExports, true);
  assert.equal("getCodexDesktopLiveHostEmbeddingStatus" in moduleExports, true);
  assert.equal("createCodexDesktopLiveHostSmokeTasks" in moduleExports, true);
  assert.equal("runCodexDesktopLiveHostSmoke" in moduleExports, true);
  assert.equal("createCodexDesktopLiveHostSmokeEvidence" in moduleExports, true);
  assert.equal("inspectCodexDesktopLiveHostObject" in moduleExports, true);
  assert.equal("assertCodexDesktopLiveHostObject" in moduleExports, true);
  assert.equal("createCodexDesktopLiveHostStarter" in moduleExports, true);
});
