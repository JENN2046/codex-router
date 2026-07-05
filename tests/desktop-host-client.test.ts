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
  createPrimitiveFailureEnvelope,
  createPrimitiveSuccessEnvelope,
  type DesktopHostBindings
} from "../packages/desktop-live-adapter/src/index.js";
import { createDesktopHostClient } from "../packages/desktop-host-client/src/index.js";
import {
  createExecutionObservationRef,
  createRecordingExecutionObservationStore
} from "../packages/execution-observation/src/index.js";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import {
  createGovernanceOperatorActionReceiptId,
  createGovernanceOperatorActionRef,
  createInMemoryGovernanceOperatorActionReceiptStore,
  GovernanceOperatorActionReceiptSchema,
  hashGovernanceOperatorActionEnvelope,
  hashGovernanceOperatorActionExecutionPlan,
  hashGovernanceOperatorActionHostExecutorDescriptor,
  planGovernanceOperatorActionExecution,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionHostExecutorAuthorizationPacketInput,
  type GovernanceOperatorActionHostExecutorDispatchAuditEvent,
  type GovernanceOperatorActionHostExecutorDispatchInvocation,
  type GovernanceOperatorActionHostExecutorDescriptorInput,
  type GovernanceOperatorActionReceiptInput,
  type GovernanceOperatorActionReceiptStore
} from "../packages/recovery-control/src/index.js";
import type { GovernanceState } from "../packages/state-manager/src/index.js";
import type { StrategyDecisionV2 } from "../packages/strategy-router/src/index.js";
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

test("desktop host client passes governance inputs and returns operator recovery action", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const observationStore = createRecordingExecutionObservationStore();
  const governanceUpdates: Array<{ state: GovernanceState; strategy: StrategyDecisionV2 }> = [];
  const task = createEngineeringTask("desktop-host-governance-recovery");
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
    bridgeBindings: {
      ...createHostBindings(),
      read_thread_terminal() {
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_governance_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
    observationBus: observationStore,
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    onGovernanceUpdate: async (state, strategy) => {
      governanceUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  const result = await client.run(task);
  const observations = await observationStore.findByTaskId(task.taskId);
  const failedObservation = observations.find((observation) => observation.status === "failed");
  assert.ok(failedObservation);
  const ref = createExecutionObservationRef(failedObservation.observationId);

  assert.equal(result.executionResult.status, "failed");
  assert.equal(result.executionResult.governance?.operatorAction?.schemaVersion, "recovery-operator-action.v1");
  assert.equal(result.executionResult.governance?.operatorAction?.taskId, task.taskId);
  assert.equal(result.executionResult.governance?.operatorAction?.recommendedAction, "fork");
  assert.equal(result.executionResult.governance?.operatorAction?.requiresHumanApproval, true);
  assert.equal(result.executionResult.governance?.operatorAction?.lockdown, true);
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

test("desktop host client durably consumes operator action receipts", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const task = createEngineeringTask("desktop-host-receipt-consume");
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
    bridgeBindings: {
      ...createHostBindings(),
      read_thread_terminal() {
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_receipt_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
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
    now: "2026-04-28T12:00:30.000Z",
    maxActionAgeMs: 60_000
  });
  const storedByAction = await store.findByActionRef(receipt.actionRef);

  assert.equal(consumed.status, "passed");
  assert.equal(consumed.durable, true);
  assert.deepEqual(consumed.reasons, []);
  assert.equal(consumed.receipt?.receiptId, receipt.receiptId);
  assert.equal(storedByAction[0]?.receiptId, receipt.receiptId);
});

test("desktop host client creates and consumes current operator action receipts", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const task = createEngineeringTask("desktop-host-receipt-author");
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
    bridgeBindings: {
      ...createHostBindings(),
      read_thread_terminal() {
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_receipt_author_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
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
  assert.deepEqual(created.reasons, []);
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
    now: "2026-04-28T12:00:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "passed");
  assert.equal(consumed.durable, true);
  assert.equal(consumed.receipt?.receiptId, created.receipt?.receiptId);
  lifecycle = client.getOperatorActionLifecycle();
  assert.equal(lifecycle.status, "receipt_consumed");
  assert.equal(lifecycle.lastReceiptConsumption?.receipt?.receiptId, created.receipt?.receiptId);

  const gate = planGovernanceOperatorActionExecution({
    envelope: result.operatorActionEnvelope,
    receiptConsumption: consumed,
    lifecycleState: lifecycle,
    allowedActions: [result.operatorActionEnvelope.recommendedAction],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "planned");
  assert.deepEqual(gate.reasons, []);
  assert.equal(gate.plan?.receiptId, created.receipt?.receiptId);

  const clonedGate = planGovernanceOperatorActionExecution({
    envelope: result.operatorActionEnvelope,
    receiptConsumption: JSON.parse(JSON.stringify(consumed)),
    lifecycleState: lifecycle,
    allowedActions: [result.operatorActionEnvelope.recommendedAction],
    executionMode: "plan_only"
  });

  assert.equal(clonedGate.status, "blocked");
  assert.ok(clonedGate.reasons.includes(
    "operator_action_executor_receipt_consumption_store_proof_missing"
  ));
});

test("desktop host client exposes non-executing host executor review for current operator action", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const calls: string[] = [];
  const task = createEngineeringTask("desktop-host-executor-review");
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
    bridgeBindings: {
      ...createHostBindings(calls),
      read_thread_terminal(invocation) {
        calls.push(invocation.primitive);
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_executor_review_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
    operatorActionReceiptStore: store,
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    now: () => "2026-04-28T12:00:00.000Z"
  });

  const result = await client.run(task);
  assert.ok(result.operatorActionEnvelope);
  const created = client.createOperatorActionReceipt({
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-28T12:00:20.000Z"
  });
  const consumed = await client.consumeOperatorActionReceipt({
    receipt: created.receipt,
    now: "2026-04-28T12:00:30.000Z",
    maxActionAgeMs: 60_000
  });
  const lifecycle = client.getOperatorActionLifecycle();
  const gate = planGovernanceOperatorActionExecution({
    envelope: result.operatorActionEnvelope,
    receiptConsumption: consumed,
    lifecycleState: lifecycle,
    allowedActions: [result.operatorActionEnvelope.recommendedAction],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "planned");
  assert.ok(gate.taskId);
  assert.ok(gate.actionRef);
  assert.ok(gate.receiptId);
  assert.ok(gate.envelopeHash);
  assert.ok(gate.recommendedAction);
  assert.ok(gate.plan);

  const descriptor = {
    descriptorId: "desktop-host-client-review-v1",
    supportedActions: [result.operatorActionEnvelope.recommendedAction],
    evidenceRefs: ["artifact:desktop-host-client-review"]
  } satisfies GovernanceOperatorActionHostExecutorDescriptorInput;
  const packet = {
    taskId: gate.taskId,
    actionRef: gate.actionRef,
    receiptId: gate.receiptId,
    envelopeHash: gate.envelopeHash,
    recommendedAction: gate.recommendedAction,
    executionPlanHash: hashGovernanceOperatorActionExecutionPlan(gate.plan),
    hostExecutorDescriptorId: descriptor.descriptorId,
    hostExecutorDescriptorHash:
      hashGovernanceOperatorActionHostExecutorDescriptor(descriptor),
    authorizationIdentityHash: "b".repeat(64),
    evidenceRefs: ["artifact:desktop-host-client-review"]
  } satisfies GovernanceOperatorActionHostExecutorAuthorizationPacketInput;
  const callCountBeforeReview = calls.length;

  const authorization = client.reviewCurrentOperatorActionHostExecutorAuthorization({
    executionGate: gate,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });

  assert.equal(authorization.status, "ready_for_host_executor_review");
  assert.deepEqual(authorization.reasons, []);
  assert.equal(authorization.executionMode, "plan_only");
  assert.equal(authorization.taskId, task.taskId);
  assert.equal(authorization.hostExecutorDescriptorId, descriptor.descriptorId);
  assert.equal(authorization.executionPlanHash, packet.executionPlanHash);
  assert.equal(calls.length, callCountBeforeReview);

  let executorCalls = 0;
  const dryRun = await client.dispatchCurrentOperatorActionHostExecutor({
    executionGate: gate,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "dry_run",
    executor: {
      dispatch() {
        executorCalls += 1;
        return { status: "completed" };
      }
    }
  });

  assert.equal(dryRun.status, "dry_run_ready");
  assert.equal(executorCalls, 0);
  assert.equal(calls.length, callCountBeforeReview);

  const dispatchInvocations: GovernanceOperatorActionHostExecutorDispatchInvocation[] = [];
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];
  const dispatched = await client.dispatchCurrentOperatorActionHostExecutor({
    executionGate: gate,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "execute_injected",
    executor: {
      dispatch(invocation) {
        dispatchInvocations.push(invocation);
        return {
          status: "accepted",
          resultRef: "artifact:desktop-host-client-dispatch-result",
          evidenceRefs: ["artifact:desktop-host-client-dispatch-result"]
        };
      }
    },
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.executorStatus, "accepted");
  assert.equal(dispatched.executorResultRef, "artifact:desktop-host-client-dispatch-result");
  assert.equal(dispatchInvocations.length, 1);
  assert.equal(dispatchInvocations[0]?.recommendedAction, result.operatorActionEnvelope.recommendedAction);
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "dispatched"]);
  assert.equal(auditEvents[1]?.executorStatus, "accepted");
  assert.equal(calls.length, callCountBeforeReview);

  const idleClient = createDesktopHostClient({
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    bridgeBindings: createHostBindings()
  });
  const blocked = idleClient.reviewCurrentOperatorActionHostExecutorAuthorization({
    executionGate: gate,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });

  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.reasons.includes("operator_action_host_executor_lifecycle_action_missing"));
});

test("desktop host client blocks replayed operator action receipts", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const task = createEngineeringTask("desktop-host-receipt-replay");
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
    bridgeBindings: {
      ...createHostBindings(),
      read_thread_terminal() {
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_receipt_replay_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
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

  await client.consumeOperatorActionReceipt({
    receipt,
    actionIssuedAt,
    now: "2026-04-28T12:00:30.000Z"
  });
  const replay = await client.consumeOperatorActionReceipt({
    receipt,
    actionIssuedAt,
    now: "2026-04-28T12:00:40.000Z"
  });

  assert.equal(replay.status, "blocked");
  assert.equal(replay.durable, false);
  assert.ok(replay.reasons.includes("operator_action_receipt_replay"));
});

test("desktop host client blocks task-mismatched operator action receipts", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const task = createEngineeringTask("desktop-host-receipt-task");
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
    bridgeBindings: {
      ...createHostBindings(),
      read_thread_terminal() {
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_receipt_task_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
    operatorActionReceiptStore: store,
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    now: () => "2026-04-28T12:00:00.000Z"
  });

  const result = await client.run(task);
  assert.ok(result.operatorActionEnvelope);
  const actionIssuedAt = "2026-04-28T12:00:10.000Z";
  const receipt = createReceiptForEnvelope(result.operatorActionEnvelope, {
    actionIssuedAt,
    taskId: "other-task"
  });

  const consumed = await client.consumeOperatorActionReceipt({
    receipt,
    actionIssuedAt,
    now: "2026-04-28T12:00:30.000Z"
  });

  assert.equal(consumed.status, "blocked");
  assert.equal(consumed.durable, false);
  assert.ok(consumed.reasons.includes("operator_action_receipt_task_mismatch"));
});

test("desktop host client fails closed when receipt stores fail", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const failingStore: GovernanceOperatorActionReceiptStore = {
    async consume() {
      throw new Error("receipt_store_unavailable");
    },
    async getReceipt() {
      return undefined;
    },
    async findByTaskId() {
      return [];
    },
    async findByActionRef() {
      return [];
    },
    async loadAll() {
      return [];
    }
  };
  const task = createEngineeringTask("desktop-host-receipt-store-fail");
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
    bridgeBindings: {
      ...createHostBindings(),
      read_thread_terminal() {
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_receipt_store_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
    operatorActionReceiptStore: failingStore,
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

  assert.equal(consumed.status, "blocked");
  assert.equal(consumed.durable, false);
  assert.ok(consumed.reasons.includes("operator_action_receipt_store_failed"));
});

test("desktop host client reports valid receipts as not consumed without a store", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createEngineeringTask("desktop-host-receipt-no-store");
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
    bridgeBindings: {
      ...createHostBindings(),
      read_thread_terminal() {
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_receipt_no_store_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
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

  assert.equal(consumed.status, "not_consumed");
  assert.equal(consumed.durable, false);
  assert.deepEqual(consumed.reasons, ["operator_action_receipt_store_missing"]);
  assert.equal(consumed.validation.status, "passed");
});

test("desktop host client persists updated governance state between run and resume", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createEngineeringTask("desktop-host-governance-persist");
  let tick = 0;
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
    bridgeBindings: {
      ...createHostBindings(),
      read_thread_terminal() {
        return createPrimitiveFailureEnvelope(
          "read_thread_terminal",
          "desktop_host_governance_persist_failure"
        );
      }
    },
    availableAgents: 2,
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    now: () => `2026-04-28T12:10:0${tick++}.000Z`
  });

  const first = await client.run(task);
  const second = await client.resume(task);

  assert.equal(anomalyCount(first.executionResult.governance?.state), 3);
  assert.equal(anomalyCount(second.executionResult.governance?.state), 4);
});

test("desktop host client rejects stale governance state before bridge execution", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const calls: string[] = [];
  const task = createEngineeringTask("desktop-host-governance-current-task");
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
    governanceState: createHighRiskStateWithTwoExecutionFailures("stale-desktop-host-task"),
    now: () => "2026-04-28T12:05:00.000Z"
  });

  await assert.rejects(
    () => client.run(task),
    /governance_state_task_mismatch/
  );
  assert.deepEqual(calls, []);
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
