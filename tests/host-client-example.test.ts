import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskEnvelopeInput } from "../packages/contracts/src/index.js";
import type {
  CodexMemoryClient,
  CodexMemorySearchInput,
  CodexMemorySearchResponse,
  CodexMemoryWriteInput,
  CodexMemoryWriteResponse
} from "../packages/codex-memory-adapter/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import {
  createRecordingTelemetryAlertDeliveryMetricsCollector,
  createRecordingTelemetryAlertDeliveryWindowStore,
  createRecordingTelemetryAlertSink,
  createRecordingTelemetryDeliveryMetricsCollector,
  createRecordingTelemetrySink
} from "../packages/observability/src/index.js";
import {
  createExecutionObservationRef,
  type ExecutionObservationInput,
  resolveExecutionObservationRef
} from "../packages/governance-internal-execution-observation/src/index.js";
import {
  createExampleDesktopHostClient,
  createFailingExampleHostBridge
} from "../packages/host-client-example/src/index.js";
import {
  createGovernanceOperatorActionReceiptId,
  createGovernanceOperatorActionRef,
  createInMemoryGovernanceOperatorActionReceiptStore,
  GovernanceOperatorActionReceiptSchema,
  hashGovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionReceiptInput
} from "../packages/governance-internal-recovery-control/src/index.js";
import type { GovernanceState } from "../packages/governance-internal-state-manager/src/index.js";
import type { StrategyDecisionV2 } from "../packages/governance-internal-strategy-router/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

interface SharedMemoryEntry {
  memoryId: string;
  input: CodexMemoryWriteInput;
  createdAt: string;
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

function createHighRiskStateWithTwoExecutionFailures(taskId: string): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId,
    branchId: "main",
    phase: "execution",
    trustBalance: { centralOrder: 0.5, distributedVitality: 0.5 },
    risk: {
      entanglement: 0.6,
      entropy: 0.7,
      failureCost: 0.8,
      reversibility: 0.3,
      contextPressure: 0.5,
      historicalTrust: 0.4,
      globalCoherence: 0.6,
      finalRiskLevel: "high"
    },
    anomalies: [
      {
        anomalyId: `anomaly:${taskId}:pre1`,
        taskId,
        kind: "execution_failure",
        message: "previous failure one",
        strikeNumber: 1,
        createdAt: "2026-04-28T10:00:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: `anomaly:${taskId}:pre2`,
        taskId,
        kind: "execution_failure",
        message: "previous failure two",
        strikeNumber: 2,
        createdAt: "2026-04-28T11:00:00.000Z",
        evidenceRefs: []
      }
    ],
    approvals: [],
    taskGraphRef: `task-graph:${taskId}`,
    createdAt: "2026-04-28T09:00:00.000Z",
    updatedAt: "2026-04-28T11:00:00.000Z"
  };
}

function createReceiptForEnvelope(
  envelope: GovernanceOperatorActionEnvelope,
  overrides: Partial<GovernanceOperatorActionReceiptInput> = {}
) {
  const actionIssuedAt = typeof overrides.actionIssuedAt === "string"
    ? overrides.actionIssuedAt
    : "2026-04-28T12:00:10.000Z";
  const receiptWithoutId = {
    taskId: envelope.taskId,
    actionRef: createGovernanceOperatorActionRef(envelope, { actionIssuedAt }),
    envelopeHash: hashGovernanceOperatorActionEnvelope(envelope),
    actionIssuedAt,
    decision: "consumed" as const,
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-28T12:00:20.000Z",
    evidenceRefs: [...envelope.evidenceRefs],
    ...overrides
  };

  return GovernanceOperatorActionReceiptSchema.parse({
    receiptId: createGovernanceOperatorActionReceiptId(receiptWithoutId),
    ...receiptWithoutId
  });
}

function anomalyCount(state: GovernanceState | undefined): number {
  assert.ok(state);
  return state.anomalies.length;
}

test("example host client runs a task end-to-end and persists checkpoint state", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createExampleDesktopHostClient({
    policy,
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-run",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.decisionResult.status, "ready");
  assert.equal(result.executionResult.status, "completed");
  assert.equal(state.memoryEntries.length, 3);
  assert.equal(state.checkpoints.length, 3);
  assert.ok(state.auditEvents.some((event) => event.type === "runner_ready"));
  assert.ok(state.telemetryEvents.length >= 1);
});

test("example host client exposes runtime governance operator action", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task: TaskEnvelopeInput = {
    taskId: "example-governance-recovery",
    source: "desktop-thread",
    intent: {
      summary: "implement host client recovery integration",
      requestedAction: "add multi-file TypeScript host recovery integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: {
      branches: [],
      files: ["packages/host-client-example/src/index.ts"],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "engineering",
      riskHints: [],
      tags: []
    }
  };
  const governanceUpdates: Array<{ state: GovernanceState; strategy: StrategyDecisionV2 }> = [];
  const client = createExampleDesktopHostClient({
    policy,
    bridge: createFailingExampleHostBridge("send_input", "example_governance_failure"),
    availableAgents: 3,
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    onGovernanceUpdate: async (state, strategy) => {
      governanceUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  const result = await client.run(task);
  const state = await client.getState();
  const failedObservation = state.observations.find((observation) => observation.status === "failed");
  assert.ok(failedObservation);
  const ref = createExecutionObservationRef(failedObservation.observationId);

  assert.equal(result.executionResult.status, "failed");
  assert.equal(result.executionResult.governance?.operatorAction?.schemaVersion, "recovery-operator-action.v1");
  assert.equal(result.executionResult.governance?.operatorAction?.taskId, task.taskId);
  assert.equal(result.executionResult.governance?.operatorAction?.recommendedAction, "fork");
  assert.equal(result.executionResult.governance?.operatorAction?.requiresHumanApproval, true);
  assert.equal(result.executionResult.governance?.operatorAction?.lockdown, true);
  assert.equal(result.executionResult.governance?.operatorAction?.evidenceStatus, "referenced");
  assert.ok(result.executionResult.governance?.operatorAction?.evidenceRefs.includes(ref));
  assert.equal(result.operatorActionEnvelope?.source, "desktop_live_governance");
  assert.equal(result.operatorActionEnvelope?.taskId, task.taskId);
  assert.equal(result.operatorActionEnvelope?.recommendedAction, "fork");
  assert.equal(result.operatorActionEnvelope?.lockdown, true);
  assert.ok(result.operatorActionEnvelope?.evidenceRefs.includes(ref));
  assert.equal(result.operatorActionSummary.present, true);
  assert.equal(result.operatorActionSummary.source, "desktop_live_governance");
  assert.equal(result.operatorActionSummary.recommendedAction, "fork");
  assert.equal(result.operatorActionSummary.requiresHumanApproval, true);
  assert.equal(result.operatorActionSummary.lockdown, true);
  assert.ok(governanceUpdates.some((update) => update.strategy.actionFamily === "step_back"));
});

test("example host client consumes operator action receipts through an injected store", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const task: TaskEnvelopeInput = {
    taskId: "example-governance-receipt-consume",
    source: "desktop-thread",
    intent: {
      summary: "implement host client recovery integration",
      requestedAction: "add multi-file TypeScript host recovery integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: {
      branches: [],
      files: ["packages/host-client-example/src/index.ts"],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "engineering",
      riskHints: [],
      tags: []
    }
  };
  const client = createExampleDesktopHostClient({
    policy,
    bridge: createFailingExampleHostBridge("send_input", "example_governance_receipt_failure"),
    availableAgents: 3,
    operatorActionReceiptStore: store,
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    now: () => "2026-04-28T12:00:00.000Z"
  });

  const result = await client.run(task);
  assert.ok(result.operatorActionEnvelope);
  const actionIssuedAt = "2026-04-28T12:00:10.000Z";
  const receipt = createReceiptForEnvelope(result.operatorActionEnvelope, {
    actionIssuedAt
  });

  const consumed = await client.consumeOperatorActionReceipt({
    receipt,
    actionIssuedAt,
    now: "2026-04-28T12:00:30.000Z"
  });
  const stored = await store.findByActionRef(receipt.actionRef);

  assert.equal(consumed.status, "passed");
  assert.equal(consumed.durable, true);
  assert.equal(stored[0]?.receiptId, receipt.receiptId);
});

test("example host client creates and consumes current operator action receipts", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const task: TaskEnvelopeInput = {
    taskId: "example-governance-receipt-author",
    source: "desktop-thread",
    intent: {
      summary: "implement host client recovery receipt authoring",
      requestedAction: "add TypeScript host recovery receipt authoring changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: {
      branches: [],
      files: ["packages/host-client-example/src/index.ts"],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "engineering",
      riskHints: [],
      tags: []
    }
  };
  const client = createExampleDesktopHostClient({
    policy,
    bridge: createFailingExampleHostBridge("send_input", "example_governance_receipt_author_failure"),
    availableAgents: 3,
    operatorActionReceiptStore: store,
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    now: () => "2026-04-28T12:00:00.000Z"
  });

  const result = await client.run(task);
  assert.ok(result.operatorActionEnvelope);
  let lifecycle = client.getOperatorActionLifecycle();
  assert.equal(lifecycle.status, "action_available");
  assert.equal(lifecycle.operatorActionPresent, true);
  assert.equal(lifecycle.actionIssuedAt, "2026-04-28T12:00:00.000Z");
  assert.equal(lifecycle.envelope?.taskId, task.taskId);

  const created = client.createOperatorActionReceipt({
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-28T12:00:20.000Z"
  });

  assert.equal(created.status, "created");
  assert.equal(created.receipt?.taskId, task.taskId);
  assert.deepEqual(
    created.receipt?.evidenceRefs,
    result.operatorActionEnvelope.evidenceRefs
  );
  lifecycle = client.getOperatorActionLifecycle();
  assert.equal(lifecycle.status, "receipt_created");
  assert.equal(lifecycle.lastReceiptCreation?.receipt?.receiptId, created.receipt?.receiptId);

  const consumed = await client.consumeOperatorActionReceipt({
    receipt: created.receipt,
    now: "2026-04-28T12:00:30.000Z"
  });

  assert.equal(consumed.status, "passed");
  assert.equal(consumed.durable, true);
  lifecycle = client.getOperatorActionLifecycle();
  assert.equal(lifecycle.status, "receipt_consumed");
  assert.equal(lifecycle.lastReceiptConsumption?.receipt?.receiptId, created.receipt?.receiptId);
});

test("example host client persists updated governance state between run and resume", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task: TaskEnvelopeInput = {
    taskId: "example-governance-persist",
    source: "desktop-thread",
    intent: {
      summary: "implement host client recovery integration",
      requestedAction: "add multi-file TypeScript host recovery integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: {
      branches: [],
      files: ["packages/host-client-example/src/index.ts"],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "engineering",
      riskHints: [],
      tags: []
    }
  };
  let tick = 0;
  const client = createExampleDesktopHostClient({
    policy,
    bridge: createFailingExampleHostBridge("send_input", "example_governance_persist_failure"),
    availableAgents: 3,
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    now: () => `2026-04-28T12:10:0${tick++}.000Z`
  });

  const first = await client.run(task);
  const second = await client.resume(task);

  assert.equal(anomalyCount(first.executionResult.governance?.state), 3);
  assert.equal(anomalyCount(second.executionResult.governance?.state), 4);
});

test("example host client rejects stale governance state before bridge execution", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task: TaskEnvelopeInput = {
    taskId: "example-governance-current-task",
    source: "desktop-thread",
    intent: {
      summary: "implement host client recovery integration",
      requestedAction: "add multi-file TypeScript host recovery integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: {
      branches: [],
      files: ["packages/host-client-example/src/index.ts"],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "engineering",
      riskHints: [],
      tags: []
    }
  };
  const client = createExampleDesktopHostClient({
    policy,
    bridge: createFailingExampleHostBridge("send_input", "should_not_run"),
    governanceState: createHighRiskStateWithTwoExecutionFailures("stale-example-task"),
    now: () => "2026-04-28T12:05:00.000Z"
  });

  await assert.rejects(
    () => client.run(task),
    /governance_state_task_mismatch/
  );
  assert.deepEqual((await client.getState()).observations, []);
});

test("example host client resumes from memory and surfaces resume source", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createExampleDesktopHostClient({
    policy,
    now: () => "2026-04-23T12:40:00.000Z"
  });

  await client.run({
    taskId: "example-resume",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const resumed = await client.resume({
    taskId: "example-resume",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  }, {
    required: true
  });

  const state = await client.getState();

  assert.equal(resumed.decisionResult.resumeSource, "memory");
  assert.equal(resumed.executionResult.status, "completed");
  assert.ok(state.auditEvents.some((event) => event.type === "task_resumed"));
});

test("example host client resumes from shared memory across client instances", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const now = () => "2026-04-23T12:40:00.000Z";
  const memoryClient = createSharedMemoryClient(now);

  const firstClient = createExampleDesktopHostClient({
    policy,
    memoryClient,
    now
  });

  await firstClient.run({
    taskId: "example-resume-cross-client-memory",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const secondClient = createExampleDesktopHostClient({
    policy,
    memoryClient,
    now: () => "2026-04-23T12:40:30.000Z"
  });

  const resumed = await secondClient.resume({
    taskId: "example-resume-cross-client-memory",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  }, {
    required: true
  });

  assert.equal(resumed.decisionResult.resumeSource, "memory");
  assert.equal(resumed.executionResult.status, "completed");
});

test("example host client records extra execution checkpoints for engineering guidance", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createExampleDesktopHostClient({
    policy,
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-engineering",
    source: "desktop-thread",
    intent: {
      summary: "implement package",
      requestedAction: "add multi-file TypeScript changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/contracts/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "engineering", riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.executionResult.status, "completed");
  assert.equal(result.decisionResult.preflight.memory.guidance?.checkpointFrequency, "stage");
  assert.equal(state.checkpoints.length, 3);
});

test("example host client can surface typed primitive failures through a failing bridge", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createExampleDesktopHostClient({
    policy,
    bridge: createFailingExampleHostBridge("send_input", "example_agent_failure"),
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-failure",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  assert.equal(result.executionResult.status, "failed");
  assert.equal(result.executionResult.steps[1]?.output?.ok, false);
  assert.equal(result.executionResult.steps[1]?.error, "example_agent_failure");

  const state = await client.getState();
  const failureObservation = state.observations.find((observation) =>
    observation.taskId === "example-failure" &&
    observation.primitiveId === "send_input:1" &&
    observation.status === "failed"
  );
  assert.ok(failureObservation, "failed primitive observation should be visible in example state");
  assert.equal(failureObservation.signals.errorClass, "example_agent_failure");

  const ref = createExecutionObservationRef(failureObservation.observationId);
  assert.equal(
    (await resolveExecutionObservationRef(
      client.observationStore!,
      "example-failure",
      ref
    ))?.observationId,
    failureObservation.observationId
  );
});

test("example host client supports observation bus injection without queryable state", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const emittedObservations: ExecutionObservationInput[] = [];
  const client = createExampleDesktopHostClient({
    policy,
    observationBus: {
      async emit(observation) {
        emittedObservations.push(observation);
      }
    },
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-external-observation-bus",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.executionResult.status, "completed");
  assert.ok(emittedObservations.length > 0, "external observation bus should receive observations");
  assert.deepEqual(state.observations, []);
});

test("example host client blocks release execution when telemetry is disabled", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createExampleDesktopHostClient({
    policy,
    disableTelemetry: true,
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-release-gate",
    source: "desktop-thread",
    intent: {
      summary: "prepare release merge",
      requestedAction: "merge to prod/stable and push production migration with secret changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router", branch: "main" },
    target: { branches: ["prod/stable"], files: ["routing-policy.yaml"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.decisionResult.preflight.memory.guidance?.telemetryMandatory, true);
  assert.equal(result.executionResult.status, "not_ready");
  assert.ok(result.executionResult.blockingReasons.includes("telemetry_sink_required"));
  assert.ok(state.auditEvents.some((event) => event.type === "execution_blocked"));
  assert.equal(state.telemetryEvents.length, 0);
});

test("example host client can fan out telemetry into a custom sink while preserving local state", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const customSink = createRecordingTelemetrySink();
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: customSink,
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-fanout-telemetry",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();
  const customEvents = await customSink.loadAll();

  assert.equal(result.executionResult.status, "completed");
  assert.ok(state.telemetryEvents.length >= 1);
  assert.equal(state.telemetryEvents.length, customEvents.length);
  assert.equal(state.telemetryEvents[0]?.message, customEvents[0]?.message);
});

test("example host client exposes telemetry delivery metrics when a collector is provided", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const metricsCollector = createRecordingTelemetryDeliveryMetricsCollector();
  const client = createExampleDesktopHostClient({
    policy,
    telemetryMetricsCollector: metricsCollector,
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-telemetry-metrics",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.executionResult.status, "completed");
  assert.equal(state.telemetryMetrics?.totals.events, 2);
  assert.ok((state.telemetryMetrics?.totals.attempts ?? 0) >= 2);
  assert.ok((state.telemetryMetrics?.totals.successes ?? 0) >= 2);
  assert.equal(state.telemetryAlerts, undefined);
  assert.equal(state.telemetryAlertEvents.length, 0);
});

test("example host client can surface telemetry delivery alerts from thresholds", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "failing-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("external_sink_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      },
      warn: {
        perSink: {
          failureRate: 0.5
        }
      }
    },
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-telemetry-alerts",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.executionResult.status, "completed");
  assert.ok((state.telemetryMetrics?.totals.failures ?? 0) >= 1);
  assert.equal(state.telemetryAlerts?.length, 2);
  assert.equal(state.telemetryAlerts?.[0]?.level, "error");
  assert.equal(state.telemetryAlertEvents.length, 2);
  assert.equal(state.telemetryAlertEvents[0]?.context?.source, "example-host-client");
});

test("example host client can resolve telemetry alert thresholds from a preset", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "engineering-failing-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("engineering_external_sink_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertPreset: "engineering",
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-telemetry-alert-preset",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.executionResult.status, "completed");
  assert.ok((state.telemetryMetrics?.totals.failures ?? 0) >= 1);
  assert.ok((state.telemetryAlerts?.length ?? 0) >= 1);
  assert.equal(state.telemetryAlerts?.some((alert) => alert.level === "error"), true);
});

test("example host client can fan out telemetry alerts into a custom sink while preserving local alert state", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const customAlertSink = createRecordingTelemetryAlertSink();
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "alert-triggering-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_triggering_external_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertSink: customAlertSink,
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      }
    },
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-alert-fanout",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();
  const customAlerts = await customAlertSink.loadAll();

  assert.equal(result.executionResult.status, "completed");
  assert.ok((state.telemetryAlerts?.length ?? 0) >= 1);
  assert.equal(state.telemetryAlerts?.length, customAlerts.length);
  assert.equal(state.telemetryAlerts?.[0]?.metric, customAlerts[0]?.metric);
});

test("example host client can continue when an external alert sink fails in best_effort mode", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const alertFailures: string[] = [];
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "alert-triggering-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_triggering_external_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertSink: {
      label: "failing-alert-backend",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_backend_failed");
        }
      }
    },
    telemetryAlertFanoutOptions: {
      failurePolicy: "best_effort",
      onSinkError({ sinkLabel, error }) {
        alertFailures.push(`${sinkLabel}:${error instanceof Error ? error.message : String(error)}`);
      }
    },
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      }
    },
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-alert-best-effort",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.executionResult.status, "completed");
  assert.ok((state.telemetryAlerts?.length ?? 0) >= 1);
  assert.deepEqual(alertFailures, ["failing-alert-backend:alert_backend_failed"]);
});

test("example host client exposes telemetry alert delivery metrics when a collector is provided", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const metricsCollector = createRecordingTelemetryAlertDeliveryMetricsCollector();
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "alert-triggering-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_triggering_external_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertSink: {
      label: "failing-alert-backend",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_backend_failed");
        }
      }
    },
    telemetryAlertFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      }
    },
    telemetryAlertDeliveryMetricsCollector: metricsCollector,
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-alert-delivery-metrics",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.executionResult.status, "completed");
  assert.equal(state.telemetryAlertDeliveryMetrics?.totals.events, 1);
  assert.ok((state.telemetryAlertDeliveryMetrics?.totals.failures ?? 0) >= 1);
  assert.equal(state.telemetryAlertDeliveryAlerts, undefined);
  assert.equal(state.telemetryAlertDeliveryAlertEvents.length, 0);
});

test("example host client can resolve telemetry alert delivery thresholds from a preset", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "alert-triggering-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_triggering_external_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertSink: {
      label: "delivery-failing-alert-backend",
      sink: {
        async record(): Promise<void> {
          throw new Error("delivery_alert_backend_failed");
        }
      }
    },
    telemetryAlertFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      }
    },
    telemetryAlertDeliveryAlertPreset: "engineering",
    now: () => "2026-04-23T12:40:00.000Z"
  });

  const result = await client.run({
    taskId: "example-alert-delivery-preset",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();

  assert.equal(result.executionResult.status, "completed");
  assert.ok((state.telemetryAlertDeliveryMetrics?.totals.failures ?? 0) >= 1);
  assert.ok((state.telemetryAlertDeliveryAlerts?.length ?? 0) >= 1);
  assert.equal(
    state.telemetryAlertDeliveryAlertEvents[0]?.context?.source,
    "example-host-client-alert-delivery"
  );
});

test("example host client suppresses repeated alert delivery within the configured window", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const customAlertSink = createRecordingTelemetryAlertSink();
  const windowStore = createRecordingTelemetryAlertDeliveryWindowStore();
  let nowValue = "2026-04-23T12:40:00.000Z";
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "alert-triggering-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_triggering_external_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertSink: customAlertSink,
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      }
    },
    telemetryAlertDeliveryWindowPolicy: {
      cooldownWindowMs: 60_000
    },
    telemetryAlertDeliveryWindowStore: windowStore,
    now: () => nowValue
  });

  await client.run({
    taskId: "example-alert-window",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  nowValue = "2026-04-23T12:40:30.000Z";
  await client.run({
    taskId: "example-alert-window",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  nowValue = "2026-04-23T12:41:31.000Z";
  await client.run({
    taskId: "example-alert-window",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const state = await client.getState();
  const customAlerts = await customAlertSink.loadAll();

  assert.equal(customAlerts.length, 2);
  assert.equal(state.telemetryAlerts?.length, 2);
  assert.equal(state.telemetryAlertDeliverySuppressions.length, 1);
  assert.equal(state.telemetryAlertDeliverySuppressions[0]?.reason, "cooldown");
});

test("example host client resolves alert delivery window policy from routing preset", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  let nowValue = "2026-04-23T12:45:00.000Z";
  const customAlertSink = createRecordingTelemetryAlertSink();
  const client = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "alert-triggering-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_triggering_external_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertSink: customAlertSink,
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      }
    },
    now: () => nowValue
  });

  await client.run({
    taskId: "example-alert-window-preset",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "small_edit", riskHints: [], tags: [] }
  });

  nowValue = "2026-04-23T12:45:29.000Z";
  await client.run({
    taskId: "example-alert-window-preset",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "small_edit", riskHints: [], tags: [] }
  });

  const state = await client.getState();
  const alertSinkEvents = await customAlertSink.loadAll();

  assert.equal(state.telemetryAlerts?.length, 1);
  assert.equal(state.telemetryAlertDeliverySuppressions.length, 1);
  assert.ok(
    state.telemetryAlertDeliverySuppressions[0]?.reason === "dedupe"
    || state.telemetryAlertDeliverySuppressions[0]?.reason === "cooldown"
  );
  assert.equal(alertSinkEvents.length, 1);
});

test("example host client persists alert delivery window state to disk for resume across sessions", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const root = await mkdtemp(join(tmpdir(), "codex-router-alert-window-session-"));
  const windowPath = join(root, "window-session.json");

  const firstRunClient = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "alert-triggering-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_triggering_external_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      }
    },
    telemetryAlertDeliveryWindowStorePath: windowPath,
    now: () => "2026-04-23T12:46:00.000Z"
  });

  await firstRunClient.run({
    taskId: "example-alert-window-session",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "small_edit", riskHints: [], tags: [] }
  });

  const secondRunClient = createExampleDesktopHostClient({
    policy,
    telemetrySink: {
      label: "alert-triggering-external",
      sink: {
        async record(): Promise<void> {
          throw new Error("alert_triggering_external_failed");
        }
      }
    },
    telemetryFanoutOptions: {
      failurePolicy: "best_effort"
    },
    telemetryAlertThresholds: {
      error: {
        totals: {
          failures: 0
        }
      }
    },
    telemetryAlertDeliveryWindowStorePath: windowPath,
    now: () => "2026-04-23T12:46:29.000Z"
  });

  await secondRunClient.run({
    taskId: "example-alert-window-session",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "small_edit", riskHints: [], tags: [] }
  });

  const state = await secondRunClient.getState();

  assert.equal(state.telemetryAlertDeliverySuppressions.length, 1);
  assert.ok(
    state.telemetryAlertDeliverySuppressions[0]?.reason === "dedupe"
    || state.telemetryAlertDeliverySuppressions[0]?.reason === "cooldown"
  );
});

test("example host client falls back to persisted checkpoint index across client instances", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const root = await mkdtemp(join(tmpdir(), "codex-router-checkpoint-session-"));
  const checkpointPath = join(root, "checkpoints.json");

  const firstRunClient = createExampleDesktopHostClient({
    policy,
    checkpointStorePath: checkpointPath,
    now: () => "2026-04-23T12:47:00.000Z"
  });

  await firstRunClient.run({
    taskId: "example-checkpoint-cross-client",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const secondRunClient = createExampleDesktopHostClient({
    policy,
    checkpointStorePath: checkpointPath,
    now: () => "2026-04-23T12:47:30.000Z"
  });

  const resumed = await secondRunClient.resume({
    taskId: "example-checkpoint-cross-client",
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  }, {
    required: true
  });

  const state = await secondRunClient.getState();

  assert.equal(resumed.decisionResult.resumeSource, "checkpoint");
  assert.equal(resumed.executionResult.status, "completed");
  assert.ok(state.checkpoints.length >= 2);
});

test("host-client-example keeps internal stores and wrapper collectors out of the public surface", async () => {
  const moduleExports = await import("../packages/host-client-example/src/index.js");

  assert.equal("InMemoryCodexMemoryClient" in moduleExports, false);
  assert.equal("InMemoryCheckpointStore" in moduleExports, false);
  assert.equal("InMemoryAuditStore" in moduleExports, false);
  assert.equal("createExampleTelemetryMetricsCollector" in moduleExports, false);
  assert.equal("createExampleTelemetryAlertDeliveryMetricsCollector" in moduleExports, false);
  assert.equal("createExampleTelemetryAlertDeliveryWindowStore" in moduleExports, false);
  assert.equal("createCodexDesktopTargetHostEmbeddingStarter" in moduleExports, true);
  assert.equal("getCodexDesktopTargetHostEmbeddingStatus" in moduleExports, true);
  assert.equal("createCodexDesktopTargetHostObjectContract" in moduleExports, true);
  assert.equal("inspectCodexDesktopTargetHostObjectContract" in moduleExports, true);
  assert.equal("assertCodexDesktopTargetHostObjectContract" in moduleExports, true);
  assert.equal("createCodexDesktopTargetHostDirectives" in moduleExports, true);
  assert.equal("createCodexDesktopTargetHostLayerSkeleton" in moduleExports, true);
});
