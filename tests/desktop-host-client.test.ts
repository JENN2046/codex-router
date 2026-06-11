import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import type {
  AuditEvent,
  MemoryOverviewProvider
} from "../packages/audit-memory/src/index.js";
import { CodexMemoryAdapter } from "../packages/codex-memory-adapter/src/index.js";
import type {
  CheckpointRef,
  TaskEnvelopeInput
} from "../packages/contracts/src/index.js";
import {
  createPrimitiveSuccessEnvelope,
  type DesktopHostBindings
} from "../packages/desktop-live-adapter/src/index.js";
import { createDesktopHostClient } from "../packages/desktop-host-client/src/index.js";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import type {
  CodexMemoryClient,
  CodexMemorySearchInput,
  CodexMemorySearchResponse,
  CodexMemoryWriteInput,
  CodexMemoryWriteResponse
} from "../packages/codex-memory-adapter/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

interface SharedMemoryEntry {
  memoryId: string;
  input: CodexMemoryWriteInput;
  createdAt: string;
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

  async loadAll(): Promise<CheckpointRef[]> {
    return [...this.checkpoints];
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

class StaticMemoryOverviewProvider implements MemoryOverviewProvider {
  async memoryOverview(): Promise<Record<string, unknown>> {
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

function createSharedMemoryClient(
  now: () => string
): CodexMemoryClient {
  const entries: SharedMemoryEntry[] = [];

  return {
    async recordMemory(input: CodexMemoryWriteInput): Promise<CodexMemoryWriteResponse> {
      const memoryId = `shared-memory-${entries.length + 1}`;
      entries.push({
        memoryId,
        input,
        createdAt: now()
      });

      return {
        success: true,
        memoryId,
        filePath: `memory://${memoryId}`
      };
    },
    async searchMemory(input: CodexMemorySearchInput): Promise<CodexMemorySearchResponse> {
      const queryTokens = input.query
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      const results = entries
        .map((entry) => {
          const haystack = [
            entry.input.title,
            entry.input.content,
            entry.input.evidence,
            entry.input.tags ?? ""
          ].join("\n").toLowerCase();
          const score = queryTokens.reduce((total, token) => (
            haystack.includes(token) ? total + 1 : total
          ), 0);

          return {
            entry,
            score
          };
        })
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || right.entry.createdAt.localeCompare(left.entry.createdAt))
        .slice(0, input.limit ?? 5)
        .map(({ entry, score }) => ({
          target: entry.input.target,
          title: entry.input.title,
          memoryId: entry.memoryId,
          score,
          sourceFile: `memory://${entry.memoryId}`,
          matchedTags: (entry.input.tags ?? "").split(",").filter(Boolean),
          snippet: entry.input.content.split("\n")[0] ?? "",
          ...(input.includeContent ? { content: entry.input.content } : {}),
          createdAt: entry.createdAt,
          updatedAt: entry.createdAt
        }));

      return { results };
    }
  };
}

function createHostBindings(
  calls: string[] = []
): DesktopHostBindings {
  return {
    read_thread_terminal(invocation) {
      calls.push(invocation.primitive);
      return createPrimitiveSuccessEnvelope("read_thread_terminal", {
        terminalOutput: `terminal for ${invocation.taskId}`,
        summary: "captured terminal context"
      });
    },
    spawn_agent(invocation) {
      calls.push(invocation.primitive);
      return createPrimitiveSuccessEnvelope("spawn_agent", {
        agentId: `agent-${invocation.stepIndex + 1}`,
        nickname: `Worker${invocation.stepIndex + 1}`,
        summary: "spawned helper"
      });
    },
    wait_agent(invocation) {
      calls.push(invocation.primitive);
      return createPrimitiveSuccessEnvelope("wait_agent", {
        agentId: `agent-${invocation.stepIndex}`,
        agentStatus: "completed",
        agentMessage: "helper finished"
      });
    },
    send_input(invocation) {
      calls.push(invocation.primitive);
      return createPrimitiveSuccessEnvelope("send_input", {
        queued: true,
        interrupted: false,
        summary: `continued ${invocation.taskId}`
      });
    },
    close_agent(invocation) {
      calls.push(invocation.primitive);
      return createPrimitiveSuccessEnvelope("close_agent", {
        closed: true,
        previousStatus: "completed",
        summary: "closed helper"
      });
    },
    automation_update(invocation) {
      calls.push(invocation.primitive);
      return createPrimitiveSuccessEnvelope("automation_update", {
        automationId: `automation-${invocation.taskId}`,
        automationStatus: "ACTIVE",
        summary: "scheduled follow-up"
      });
    },
    shell_command(invocation) {
      calls.push(invocation.primitive);
      return createPrimitiveSuccessEnvelope("shell_command", {
        exitCode: 0,
        stdout: `shell ok for ${invocation.taskId}`,
        stderr: ""
      });
    },
    apply_patch(invocation) {
      calls.push(invocation.primitive);
      return createPrimitiveSuccessEnvelope("apply_patch", {
        changedFiles: 1,
        summary: `patch ok for ${invocation.taskId}`
      });
    }
  };
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
      summary: "implement desktop host client",
      requestedAction: "add multi-file TypeScript integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/desktop-host-client/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "engineering", riskHints: [], tags: [] }
  };
}

function createReleaseTask(taskId: string): TaskEnvelopeInput {
  return {
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "prepare release merge",
      requestedAction: "merge to prod/stable and push production secret changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router", branch: "main" },
    target: { branches: ["prod/stable"], files: ["routing-policy.yaml"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  };
}

test("desktop host client runs through real host bindings and persists artifacts", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const checkpointStore = new InMemoryCheckpointStore();
  const auditStore = new InMemoryAuditStore();
  const telemetryStore = createRecordingTelemetrySink();
  const calls: string[] = [];
  const client = createDesktopHostClient({
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "read_thread_terminal",
        "spawn_agent",
        "wait_agent",
        "send_input",
        "shell_command",
        "apply_patch",
        "automation_update",
        "close_agent"
      ]
    },
    bridgeBindings: createHostBindings(calls),
    persistence: {
      checkpointStore,
      auditStore,
      telemetryStore
    },
    availableAgents: 2,
    now: () => "2026-04-23T16:15:00.000Z"
  });

  const result = await client.run(createEngineeringTask("desktop-host-run"));
  const checkpoints = await checkpointStore.loadAll();
  const auditEvents = await auditStore.loadAll();
  const telemetryEvents = await telemetryStore.loadAll();

  assert.equal(result.decisionResult.status, "ready");
  assert.equal(result.executionResult.status, "completed");
  assert.ok(calls.includes("read_thread_terminal"));
  assert.ok(calls.includes("shell_command"));
  assert.ok(calls.includes("apply_patch"));
  assert.ok(checkpoints.length >= 2);
  assert.ok(auditEvents.some((event) => event.type === "runner_ready"));
  assert.ok(telemetryEvents.length >= 1);
});

test("desktop host client resumes from memory recall when the memory adapter supports it", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const now = () => "2026-04-23T16:16:00.000Z";
  const memoryClient = createSharedMemoryClient(now);
  const memoryAdapter = new CodexMemoryAdapter(memoryClient, {
    anchor: "codex-router@desktop-host-client",
    target: "process",
    tags: ["desktop-host-client"],
    verifyRecall: true
  });

  const firstClient = createDesktopHostClient({
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "read_thread_terminal",
        "spawn_agent",
        "wait_agent",
        "send_input",
        "shell_command",
        "apply_patch",
        "automation_update",
        "close_agent"
      ]
    },
    bridgeBindings: createHostBindings(),
    persistence: {
      memoryAdapter,
      memoryOverviewProvider: new StaticMemoryOverviewProvider(),
      telemetryStore: createRecordingTelemetrySink()
    },
    availableAgents: 2,
    now
  });

  await firstClient.run(createEngineeringTask("desktop-host-resume-memory"));

  const secondClient = createDesktopHostClient({
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "read_thread_terminal",
        "spawn_agent",
        "wait_agent",
        "send_input",
        "shell_command",
        "apply_patch",
        "automation_update",
        "close_agent"
      ]
    },
    bridgeBindings: createHostBindings(),
    persistence: {
      memoryAdapter,
      memoryOverviewProvider: new StaticMemoryOverviewProvider(),
      telemetryStore: createRecordingTelemetrySink()
    },
    availableAgents: 2,
    now: () => "2026-04-23T16:16:30.000Z"
  });

  const resumed = await secondClient.resume(
    createEngineeringTask("desktop-host-resume-memory"),
    { required: true }
  );

  assert.equal(resumed.decisionResult.resumeSource, "memory");
  assert.equal(resumed.executionResult.status, "completed");
});

test("desktop host client resumes from checkpoint lookup when no memory recall is configured", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const checkpointStore = new InMemoryCheckpointStore();

  const firstClient = createDesktopHostClient({
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "read_thread_terminal",
        "spawn_agent",
        "wait_agent",
        "send_input",
        "shell_command",
        "apply_patch",
        "automation_update",
        "close_agent"
      ]
    },
    bridgeBindings: createHostBindings(),
    persistence: {
      checkpointStore,
      telemetryStore: createRecordingTelemetrySink()
    },
    availableAgents: 2,
    now: () => "2026-04-23T16:17:00.000Z"
  });

  await firstClient.run(createEngineeringTask("desktop-host-resume-checkpoint"));

  const secondClient = createDesktopHostClient({
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "read_thread_terminal",
        "spawn_agent",
        "wait_agent",
        "send_input",
        "shell_command",
        "apply_patch",
        "automation_update",
        "close_agent"
      ]
    },
    bridgeBindings: createHostBindings(),
    persistence: {
      checkpointStore,
      telemetryStore: createRecordingTelemetrySink()
    },
    availableAgents: 2,
    now: () => "2026-04-23T16:17:30.000Z"
  });

  const resumed = await secondClient.resume(
    createEngineeringTask("desktop-host-resume-checkpoint"),
    { required: true }
  );

  assert.equal(resumed.decisionResult.resumeSource, "checkpoint");
  assert.equal(resumed.executionResult.status, "completed");
});

test("desktop host client preserves telemetry gate behavior for release posture", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createDesktopHostClient({
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "read_thread_terminal",
        "spawn_agent",
        "wait_agent",
        "send_input",
        "shell_command",
        "apply_patch",
        "automation_update",
        "close_agent"
      ]
    },
    bridgeBindings: createHostBindings(),
    availableAgents: 2,
    now: () => "2026-04-23T16:18:00.000Z"
  });

  const result = await client.run(createReleaseTask("desktop-host-release-gate"));

  assert.equal(result.decisionResult.preflight.memory.guidance?.telemetryMandatory, true);
  assert.equal(result.executionResult.status, "not_ready");
  assert.ok(result.executionResult.blockingReasons.includes("telemetry_sink_required"));
});

test("desktop host client requires a real bridge or bridge bindings", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  assert.throws(() => createDesktopHostClient({
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    }
  }), /desktop_host_client_requires_bridge_or_bindings/);
});
