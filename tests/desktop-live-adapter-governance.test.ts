import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";
import {
  createPrimitiveFailureEnvelope,
  executeDesktopPlan,
  runDesktopTask,
  type DesktopLiveExecutionResult
} from "../packages/desktop-live-adapter/src/index.js";
import {
  createExecutionObservationRef,
  createRecordingExecutionObservationStore,
  resolveExecutionObservationRef
} from "../packages/execution-observation/src/index.js";
import type {
  GovernanceState,
  AnomalyRecord
} from "../packages/state-manager/src/index.js";
import type { StrategyDecisionV2 } from "../packages/strategy-router/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

// ── Helpers ─────────────────────────────────────────────────────────────────

function createLowRiskGovernanceState(taskId: string): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId,
    branchId: "main",
    phase: "execution",
    trustBalance: { centralOrder: 0.5, distributedVitality: 0.5 },
    risk: {
      entanglement: 0.2,
      entropy: 0.2,
      failureCost: 0.2,
      reversibility: 0.8,
      contextPressure: 0.2,
      historicalTrust: 0.5,
      globalCoherence: 0.9,
      finalRiskLevel: "low"
    },
    anomalies: [],
    approvals: [],
    taskGraphRef: `task-graph:${taskId}`,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z"
  };
}

interface GovernanceUpdateRecord {
  state: GovernanceState;
  strategy: StrategyDecisionV2;
}

async function createReadyRunnerResult() {
  const policy = await loadPolicyFromFile(policyPath);
  return runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "gov-integration-ready",
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
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    availableAgents: 3,
    now: () => "2026-04-28T12:00:00.000Z"
  });
}

function createReadOnlyCodexCliTask(taskId: string) {
  return parseTaskEnvelope({
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "review current config",
      requestedAction: "inspect and summarize routing policy",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router", worktreeClean: true },
    target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });
}

class FakeCodexCliStream extends EventEmitter {
  setEncoding(_encoding: BufferEncoding): void {}
  destroy(): void {}
}

class FakeCodexCliWritableStream {
  written = "";
  ended = false;
  destroyed = false;

  end(chunk?: string): void {
    if (chunk !== undefined) {
      this.written += chunk;
    }
    this.ended = true;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeCodexCliChild extends EventEmitter {
  readonly stdin = new FakeCodexCliWritableStream();
  readonly stdout = new FakeCodexCliStream();
  readonly stderr = new FakeCodexCliStream();

  constructor(private readonly closeCode: number) {
    super();
  }

  kill(_signal?: NodeJS.Signals | number): boolean {
    queueMicrotask(() => {
      this.emit("close", this.closeCode, null);
    });
    return true;
  }

  unref(): void {}
}

function createFakeCodexCliChild(options: {
  stdout: string;
  stderr?: string;
  exitCode: number;
}): FakeCodexCliChild {
  const child = new FakeCodexCliChild(options.exitCode);

  queueMicrotask(() => {
    if (options.stdout) {
      child.stdout.emit("data", options.stdout);
    }
    if (options.stderr) {
      child.stderr.emit("data", options.stderr);
    }
    child.emit("close", options.exitCode, null);
  });

  return child;
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
        anomalyId: "anomaly:gov-integration-ready:a1",
        taskId,
        kind: "execution_failure",
        message: "failure one",
        strikeNumber: 1,
        createdAt: "2026-04-28T10:00:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "anomaly:gov-integration-ready:a2",
        taskId,
        kind: "execution_failure",
        message: "failure two",
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

// ── 21.1.1: missing handler updates governanceState ─────────────────────────

test("governance: missing handler appends anomaly, re-scores risk, re-routes strategy, and calls onGovernanceUpdate", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
      // spawn_agent handler intentionally missing
    },
    governanceState: initialState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  // Execution should fail due to missing handler
  assert.equal(execution.status, "failed");

  // onGovernanceUpdate should have been called at least once
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called for missing handler");

  // First update should contain the anomaly
  const firstUpdate = govUpdates[0]!;
  assert.ok(firstUpdate.state.anomalies.length > 0, "anomalies should be non-empty");
  const anomaly = firstUpdate.state.anomalies[firstUpdate.state.anomalies.length - 1]!;
  assert.equal(anomaly.kind, "execution_failure");
  assert.equal(anomaly.strikeNumber, 1);
  assert.match(anomaly.message, /missing_handler/);
  assert.deepEqual(anomaly.evidenceRefs, []);

  // Risk should be updated (no longer the initial low risk defaults)
  assert.ok(
    firstUpdate.state.risk.entropy !== initialState.risk.entropy ||
    firstUpdate.state.risk.failureCost !== initialState.risk.failureCost,
    "risk should be re-scored from initial state"
  );

  // Strategy should be present
  assert.ok(firstUpdate.strategy.actionFamily.length > 0);
});

test("governance: primitive failure anomaly includes exact observation evidence ref", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const observationStore = createRecordingExecutionObservationStore();

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
      // spawn_agent handler intentionally missing
    },
    observationBus: observationStore,
    governanceState: createLowRiskGovernanceState(ready.task.taskId),
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called");

  const observations = await observationStore.findByTaskId(ready.task.taskId);
  const failureObservation = observations.find(
    (observation) => observation.status === "failed" &&
      observation.primitiveId === "spawn_agent:1"
  );
  assert.ok(failureObservation, "failed primitive observation should be emitted");

  const ref = createExecutionObservationRef(failureObservation.observationId);
  const anomaly = govUpdates[0]?.state.anomalies.at(-1);
  assert.ok(anomaly, "governance update should include anomaly");
  assert.ok(anomaly.evidenceRefs.includes(ref));
});

test("governance: primitive failure preserves padded runtime observation evidence ref", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const observationStore = createRecordingExecutionObservationStore();

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
      // spawn_agent handler intentionally missing
    },
    observationBus: observationStore,
    governanceState: createLowRiskGovernanceState(ready.task.taskId),
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z "
  });

  assert.equal(execution.status, "failed");
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called");

  const observations = await observationStore.findByTaskId(ready.task.taskId);
  const failureObservation = observations.find(
    (observation) => observation.status === "failed" &&
      observation.primitiveId === "spawn_agent:1"
  );
  assert.ok(failureObservation, "failed primitive observation should be emitted");

  const ref = createExecutionObservationRef(failureObservation.observationId);
  const anomaly = govUpdates[0]?.state.anomalies.at(-1);
  assert.ok(anomaly, "governance update should include anomaly");
  assert.ok(anomaly.evidenceRefs.includes(ref));
  assert.equal(
    (await resolveExecutionObservationRef(
      observationStore,
      ready.task.taskId,
      ref
    ))?.observationId,
    failureObservation.observationId
  );
});

// ── 21.1.2: handler returns ok:false updates governanceState ────────────────

test("governance: handler returning ok:false appends anomaly, re-scores risk, and calls onGovernanceUpdate", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => createPrimitiveFailureEnvelope("spawn_agent", "agent_capacity_exceeded"),
      wait_agent: () => ({ status: "completed" })
    },
    governanceState: initialState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.equal(execution.governance, undefined);
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called for ok:false handler");

  const firstUpdate = govUpdates[0]!;
  assert.ok(firstUpdate.state.anomalies.length > 0);
  const anomaly = firstUpdate.state.anomalies[firstUpdate.state.anomalies.length - 1]!;
  assert.equal(anomaly.kind, "execution_failure");
  assert.equal(anomaly.strikeNumber, 1);
  assert.match(anomaly.message, /agent_capacity_exceeded/);

  // Risk should differ from initial state
  assert.ok(
    firstUpdate.state.risk.entropy !== initialState.risk.entropy ||
    firstUpdate.state.risk.failureCost !== initialState.risk.failureCost,
    "risk should be re-scored"
  );

  // Strategy actionFamily should be set
  assert.ok(firstUpdate.strategy.actionFamily.length > 0);
});

// ── 21.1.3: handler throw updates governanceState ───────────────────────────

test("governance: handler throwing appends anomaly, re-scores risk, and calls onGovernanceUpdate", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => { throw new Error("handler_crash"); },
      wait_agent: () => ({ status: "completed" })
    },
    governanceState: initialState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");

  // Gap fixed: throw path now updates governanceState via applyExecutionFailureToGovernanceState
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called for thrown handler");

  const firstUpdate = govUpdates[0]!;
  assert.ok(firstUpdate.state.anomalies.length > 0);
  const anomaly = firstUpdate.state.anomalies[firstUpdate.state.anomalies.length - 1]!;
  assert.equal(anomaly.kind, "execution_failure");
  assert.equal(anomaly.strikeNumber, 1);
  assert.match(anomaly.message, /handler_crash/);

  // Risk should differ from initial state
  assert.ok(
    firstUpdate.state.risk.entropy !== initialState.risk.entropy ||
    firstUpdate.state.risk.failureCost !== initialState.risk.failureCost,
    "risk should be re-scored"
  );
});

// ── 21.1.4: repeated execution_failure escalates strikeNumber ───────────────

test("governance: repeated execution_failure increments strikeNumber across steps", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  // Pre-populate with one existing execution_failure anomaly (strike 1)
  const preExistingAnomaly: AnomalyRecord = {
    anomalyId: "anomaly:gov-integration-ready:pre",
    taskId: ready.task.taskId,
    kind: "execution_failure",
    message: "previous failure",
    strikeNumber: 1,
    createdAt: "2026-04-28T11:00:00.000Z",
    evidenceRefs: []
  };
  const stateWithHistory: GovernanceState = {
    ...initialState,
    anomalies: [preExistingAnomaly]
  };

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
      // spawn_agent missing → triggers anomaly
    },
    governanceState: stateWithHistory,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.ok(govUpdates.length >= 1);

  const firstUpdate = govUpdates[0]!;
  const newAnomaly = firstUpdate.state.anomalies[firstUpdate.state.anomalies.length - 1]!;
  assert.equal(newAnomaly.kind, "execution_failure");
  // strikeNumber should be 2 because there was 1 pre-existing same-kind anomaly
  assert.equal(newAnomaly.strikeNumber, 2,
    `expected strikeNumber=2 (1 pre-existing + 1 new) but got ${newAnomaly.strikeNumber}`
  );

  // Total anomalies should be 2 (pre-existing 1 + new 1)
  assert.equal(firstUpdate.state.anomalies.length, 2);
});

// ── 21.1.4b: strikeNumber reaches 3 after two pre-existing failures ─────────

test("governance: strikeNumber reaches 3 with two pre-existing execution_failure anomalies", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  const stateWithTwoFailures: GovernanceState = {
    ...initialState,
    anomalies: [
      {
        anomalyId: "anomaly:gov-integration-ready:pre1",
        taskId: ready.task.taskId,
        kind: "execution_failure",
        message: "first failure",
        strikeNumber: 1,
        createdAt: "2026-04-28T10:00:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "anomaly:gov-integration-ready:pre2",
        taskId: ready.task.taskId,
        kind: "execution_failure",
        message: "second failure",
        strikeNumber: 2,
        createdAt: "2026-04-28T11:00:00.000Z",
        evidenceRefs: []
      }
    ]
  };

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
      // spawn_agent missing → third failure
    },
    governanceState: stateWithTwoFailures,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.ok(govUpdates.length >= 1);

  const firstUpdate = govUpdates[0]!;
  const newAnomaly = firstUpdate.state.anomalies[firstUpdate.state.anomalies.length - 1]!;
  assert.equal(newAnomaly.strikeNumber, 3,
    `expected strikeNumber=3 but got ${newAnomaly.strikeNumber}`
  );
});

// ── 21.1.5: onGovernanceUpdate is called ────────────────────────────────────

test("governance: onGovernanceUpdate receives correct state and strategy decision", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
      // spawn_agent missing
    },
    governanceState: initialState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate must be called at least once");

  for (const [i, update] of govUpdates.entries()) {
    // State must contain taskId
    assert.equal(update.state.taskId, ready.task.taskId, `update[${i}]: taskId mismatch`);
    // State must have schema version
    assert.equal(update.state.schemaVersion, "governance-state.v1");
    // Strategy must have actionFamily
    assert.ok(["execute", "verify", "simulate", "step_back", "fork", "abort"].includes(update.strategy.actionFamily),
      `update[${i}]: invalid actionFamily "${update.strategy.actionFamily}"`);
    // Strategy must reference the task
    assert.equal(update.strategy.taskId, ready.task.taskId, `update[${i}]: strategy taskId mismatch`);
  }
});

// ── 21.1.6: step_back triggered at high risk ────────────────────────────────

test("governance: step_back is triggered and blocks execution when risk crosses threshold", async () => {
  const ready = await createReadyRunnerResult();
  ready.preflight.memory.guidance = {
    memoryRequired: false,
    resumeExpected: false,
    telemetryMandatory: false,
    checkpointFrequency: "standard"
  };
  const govUpdates: GovernanceUpdateRecord[] = [];
  const observationStore = createRecordingExecutionObservationStore();
  const persistedAuditEvents: Array<{ type: string }> = [];
  const persistedCheckpoints: Array<{ stage: string; summary: string }> = [];

  // Start with high-risk state and two pre-existing execution_failure anomalies
  // so the next failure produces strikeNumber=3 and triggers step_back
  const highRiskState = createHighRiskStateWithTwoExecutionFailures(ready.task.taskId);

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      // Two primitives will be missing — this gives us the third failure
    },
    observationBus: observationStore,
    governanceState: highRiskState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    auditStore: {
      async record(event) {
        persistedAuditEvents.push(event);
      }
    },
    checkpointStore: {
      async record(checkpoint) {
        persistedCheckpoints.push(checkpoint);
      }
    },
    stopOnFailure: false,
    now: () => "2026-04-28T12:00:00.000Z"
  });

  // With strike 3, the adapter should stop and return host-consumable recovery data.
  const stepBackUpdates = govUpdates.filter(
    u => u.strategy.actionFamily === "step_back" || u.strategy.actionFamily === "abort"
  );

  assert.equal(execution.status, "failed");
  assert.ok(execution.blockingReasons.includes("governance_step_back_triggered"));
  assert.ok(execution.blockingReasons.includes("arbitration_required"));
  assert.ok(stepBackUpdates.length > 0, "strategy should be re-routed to recovery");
  assert.ok(execution.governance, "execution result should expose governance recovery data");
  assert.equal(execution.governance?.recoveryRequired, true);
  assert.equal(execution.governance?.lockdown, true);
  assert.equal(execution.governance?.state.taskId, ready.task.taskId);
  assert.equal(execution.governance?.state.anomalies.at(-1)?.strikeNumber, 3);
  assert.equal(execution.governance?.strategyDecision.actionFamily, "step_back");
  assert.equal(execution.governance?.arbitrationPacket.trigger, "third_anomaly");
  assert.equal(execution.governance?.arbitrationPacket.probabilityPredictionAllowed, false);
  assert.equal(execution.governance?.recoveryRecommendation?.action, "fork");
  assert.equal(
    execution.governance?.recoveryRecommendation?.reasonCode,
    "third_anomaly_fork_for_investigation"
  );
  assert.equal(execution.governance?.recoveryRecommendation?.requiresHumanApproval, true);
  assert.equal(execution.governance?.operatorAction?.schemaVersion, "recovery-operator-action.v1");
  assert.equal(execution.governance?.operatorAction?.taskId, ready.task.taskId);
  assert.equal(execution.governance?.operatorAction?.status, "requires_arbitration");
  assert.equal(execution.governance?.operatorAction?.recommendedAction, "fork");
  assert.equal(
    execution.governance?.operatorAction?.reasonCode,
    "third_anomaly_fork_for_investigation"
  );
  assert.equal(execution.governance?.operatorAction?.requiresHumanApproval, true);
  assert.equal(execution.governance?.operatorAction?.lockdown, true);
  assert.ok(execution.governance?.operatorAction?.blockingReasons.includes("governance_step_back_triggered"));
  assert.ok(execution.governance?.operatorAction?.blockingReasons.includes("arbitration_required"));
  const observations = await observationStore.findByTaskId(ready.task.taskId);
  const failureObservation = observations.find(
    (observation) => observation.status === "failed"
  );
  assert.ok(failureObservation, "failed primitive observation should be emitted");
  const ref = createExecutionObservationRef(failureObservation.observationId);
  assert.ok(execution.governance?.state.anomalies.at(-1)?.evidenceRefs.includes(ref));
  assert.ok(execution.governance?.arbitrationPacket.rawEvidenceRefs.includes(ref));
  assert.ok(execution.governance?.recoveryRecommendation?.evidenceRefs.includes(ref));
  assert.ok(execution.governance?.operatorAction?.evidenceRefs.includes(ref));
  assert.equal(execution.governance?.recoveryRecommendation?.evidenceStatus, "referenced");
  assert.equal(execution.governance?.operatorAction?.evidenceStatus, "referenced");
  const resolvedObservation = await resolveExecutionObservationRef(
    observationStore,
    ready.task.taskId,
    ref
  );
  assert.equal(resolvedObservation?.observationId, failureObservation.observationId);
  assert.deepEqual(
    execution.governance?.availableRecoveryActions,
    execution.governance?.arbitrationPacket.availableActions
  );
  assert.ok(execution.governance?.availableRecoveryActions.includes("rollback"));
  assert.ok(execution.governance?.availableRecoveryActions.includes("abort"));
  assert.ok(
    persistedAuditEvents.some((event) => event.type === "primitive_failed"),
    "governance early return should persist primitive_failed audit"
  );
  assert.ok(
    persistedCheckpoints.some((checkpoint) =>
      checkpoint.stage === "execution-completed" &&
      checkpoint.summary === "desktop live adapter completed with failures"
    ),
    "governance early return should persist a final execution checkpoint"
  );
});

test("governance: recovery remains compatible without consumable observation evidence", async () => {
  const ready = await createReadyRunnerResult();
  const highRiskState = createHighRiskStateWithTwoExecutionFailures(ready.task.taskId);

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
      // spawn_agent handler intentionally missing
    },
    governanceState: highRiskState,
    stopOnFailure: false,
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.ok(execution.governance, "recovery governance should still be exposed");
  assert.equal(execution.governance?.strategyDecision.actionFamily, "step_back");
  assert.deepEqual(
    execution.governance?.state.anomalies.at(-1)?.evidenceRefs,
    []
  );
  assert.deepEqual(execution.governance?.arbitrationPacket.rawEvidenceRefs, []);
  assert.equal(execution.governance?.recoveryRecommendation?.evidenceStatus, "missing");
  assert.deepEqual(execution.governance?.recoveryRecommendation?.evidenceRefs, []);
  assert.equal(execution.governance?.recoveryRecommendation?.requiresHumanApproval, true);
  assert.equal(execution.governance?.operatorAction?.evidenceStatus, "missing");
  assert.deepEqual(execution.governance?.operatorAction?.evidenceRefs, []);
  assert.equal(execution.governance?.operatorAction?.requiresHumanApproval, true);
});

test("governance: thrown handler step_back persists audit and final checkpoint before returning", async () => {
  const ready = await createReadyRunnerResult();
  ready.preflight.memory.guidance = {
    memoryRequired: false,
    resumeExpected: false,
    telemetryMandatory: false,
    checkpointFrequency: "standard"
  };
  const persistedAuditEvents: Array<{ type: string; details: Record<string, unknown> }> = [];
  const persistedCheckpoints: Array<{ stage: string; summary: string }> = [];

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => {
        throw new Error("thrown_step_back_failure");
      },
      spawn_agent: () => ({ agentId: "agent-1" }),
      wait_agent: () => ({ status: "completed" })
    },
    governanceState: createHighRiskStateWithTwoExecutionFailures(ready.task.taskId),
    auditStore: {
      async record(event) {
        persistedAuditEvents.push(event);
      }
    },
    checkpointStore: {
      async record(checkpoint) {
        persistedCheckpoints.push(checkpoint);
      }
    },
    stopOnFailure: false,
    now: () => "2026-04-28T12:30:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.equal(execution.steps.length, 1);
  assert.equal(execution.steps[0]?.primitive, "read_thread_terminal");
  assert.equal(execution.steps[0]?.error, "thrown_step_back_failure");
  assert.equal(execution.governance?.strategyDecision.actionFamily, "step_back");
  assert.ok(execution.blockingReasons.includes("governance_step_back_triggered"));
  assert.ok(
    persistedAuditEvents.some((event) =>
      event.type === "primitive_failed" &&
      event.details.primitive === "read_thread_terminal" &&
      event.details.error === "thrown_step_back_failure"
    ),
    "thrown-handler governance early return should persist primitive_failed audit"
  );
  assert.ok(
    persistedCheckpoints.some((checkpoint) =>
      checkpoint.stage === "execution-completed" &&
      checkpoint.summary === "desktop live adapter completed with failures"
    ),
    "thrown-handler governance early return should persist a final execution checkpoint"
  );
});

// ── 21.1.7: governance is not called when no governanceState provided ───────

test("governance: handler failures without governanceState do not call onGovernanceUpdate", async () => {
  const ready = await createReadyRunnerResult();
  let govCalled = false;

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
      // spawn_agent missing
    },
    // No governanceState provided
    onGovernanceUpdate: async () => {
      govCalled = true;
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.equal(govCalled, false,
    "onGovernanceUpdate should not be called when no governanceState is supplied"
  );
});

// ── 21.1.8: successful execution does not trigger governance updates ────────

test("governance: successful execution with governanceState does not call onGovernanceUpdate", async () => {
  const ready = await createReadyRunnerResult();
  let govCalled = false;
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => ({ agentId: "agent-1" }),
      wait_agent: () => ({ status: "completed" })
    },
    governanceState: initialState,
    onGovernanceUpdate: async () => {
      govCalled = true;
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "completed");
  assert.equal(govCalled, false,
    "onGovernanceUpdate should not be called on successful execution"
  );
  assert.equal(execution.steps.length, 3);
});

// ── 21.1.9: thrown non-Error values produce non-undefined errorClass ────────

test("governance: thrown string produces non-empty errorClass in anomaly", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => { throw "string_error_value"; },
      wait_agent: () => ({ status: "completed" })
    },
    governanceState: initialState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called for thrown string");

  const firstUpdate = govUpdates[0]!;
  const anomaly = firstUpdate.state.anomalies[firstUpdate.state.anomalies.length - 1]!;
  assert.equal(anomaly.kind, "execution_failure");
  assert.ok(anomaly.message.length > 0, "anomaly message must be non-empty");
  assert.equal(anomaly.message, "string_error_value",
    "thrown string should be used as errorClass"
  );
});

test("governance: thrown object with no message falls back to unknown_execution_error", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const initialState = createLowRiskGovernanceState(ready.task.taskId);

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => { throw { code: 42 }; },
      wait_agent: () => ({ status: "completed" })
    },
    governanceState: initialState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called for thrown object");

  const firstUpdate = govUpdates[0]!;
  const anomaly = firstUpdate.state.anomalies[firstUpdate.state.anomalies.length - 1]!;
  assert.equal(anomaly.kind, "execution_failure");
  assert.equal(anomaly.message, "unknown_execution_error",
    "thrown object without message should fall back to unknown_execution_error"
  );

  // Strategy should still be usable
  assert.ok(firstUpdate.strategy.actionFamily.length > 0);
});

test("governance: thrown handler with stopOnFailure false still updates governance and can trigger step_back", async () => {
  const ready = await createReadyRunnerResult();
  const govUpdates: GovernanceUpdateRecord[] = [];
  const highRiskState: GovernanceState = {
    ...createLowRiskGovernanceState(ready.task.taskId),
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
        anomalyId: "anomaly:gov-integration-ready:throw-pre1",
        taskId: ready.task.taskId,
        kind: "execution_failure",
        message: "first failure",
        strikeNumber: 1,
        createdAt: "2026-04-28T10:00:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "anomaly:gov-integration-ready:throw-pre2",
        taskId: ready.task.taskId,
        kind: "execution_failure",
        message: "second failure",
        strikeNumber: 2,
        createdAt: "2026-04-28T11:00:00.000Z",
        evidenceRefs: []
      }
    ],
    updatedAt: "2026-04-28T11:00:00.000Z"
  };

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => {
        throw new Error("continued_throw_failure");
      },
      spawn_agent: () => ({ agentId: "agent-1" }),
      wait_agent: () => ({ status: "completed" })
    },
    governanceState: highRiskState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    stopOnFailure: false,
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.ok(execution.blockingReasons.includes("governance_step_back_triggered"));
  assert.ok(execution.blockingReasons.includes("arbitration_required"));
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called for thrown handler in continuing mode");

  const firstUpdate = govUpdates[0]!;
  const anomaly = firstUpdate.state.anomalies[firstUpdate.state.anomalies.length - 1]!;
  assert.equal(anomaly.kind, "execution_failure");
  assert.equal(anomaly.message, "continued_throw_failure");
  assert.equal(anomaly.strikeNumber, 3);
  assert.equal(firstUpdate.strategy.actionFamily, "step_back");
  assert.equal(execution.governance?.recoveryRequired, true);
  assert.equal(execution.governance?.state.anomalies.at(-1)?.message, "continued_throw_failure");
});

test("governance: codex-cli host dispatch failure appends anomaly and calls onGovernanceUpdate", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createReadOnlyCodexCliTask("gov-codex-cli-host-dispatch-failure");
  const govUpdates: GovernanceUpdateRecord[] = [];
  const observationStore = createRecordingExecutionObservationStore();

  const result = await runDesktopTask({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        throw new Error("spawn sentinel");
      }
    },
    observationBus: observationStore,
    governanceState: createLowRiskGovernanceState(task.taskId),
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T13:00:00.000Z"
  });

  assert.equal(result.decisionResult.status, "ready");
  assert.equal(result.decisionResult.decision.hostRoute, "codex-cli");
  assert.equal(result.executionResult.status, "failed");
  assert.ok(result.executionResult.blockingReasons.includes("spawn sentinel"));
  assert.ok(govUpdates.length >= 1, "onGovernanceUpdate should be called for host dispatch failure");

  const firstUpdate = govUpdates[0]!;
  const anomaly = firstUpdate.state.anomalies.at(-1)!;
  assert.equal(anomaly.kind, "execution_failure");
  assert.equal(anomaly.strikeNumber, 1);
  assert.equal(anomaly.message, "host_dispatch_failed:spawn sentinel");
  assert.equal(firstUpdate.strategy.taskId, task.taskId);
  assert.equal(result.executionResult.governance, undefined);

  const observations = await observationStore.findByTaskId(task.taskId);
  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.primitiveId, "host_dispatch:codex-cli");
  assert.equal(observations[0]?.stage, "host_dispatch");
  assert.equal(observations[0]?.status, "failed");
  assert.equal(
    observations[0]?.signals.errorClass,
    "host_dispatch_failed:spawn sentinel"
  );
  const ref = createExecutionObservationRef(observations[0]!.observationId);
  assert.ok(anomaly.evidenceRefs.includes(ref));
});

for (const [caseName, thrownValue] of [
  ["object", {}],
  ["undefined", undefined]
] as const) {
  test(`governance: codex-cli host dispatch normalizes opaque ${caseName} errors`, async () => {
    const policy = await loadPolicyFromFile(policyPath);
    const task = createReadOnlyCodexCliTask(
      `gov-codex-cli-host-dispatch-opaque-${caseName}`
    );
    const govUpdates: GovernanceUpdateRecord[] = [];
    const observationStore = createRecordingExecutionObservationStore();

    const result = await runDesktopTask({
      task,
      policy,
      preflight: {
        authAvailable: true,
        availableTools: []
      },
      codexCliOptions: {
        skipExecutionModelProbe: true,
        spawn: () => {
          throw thrownValue;
        }
      },
      observationBus: observationStore,
      governanceState: createLowRiskGovernanceState(task.taskId),
      onGovernanceUpdate: async (state, strategy) => {
        govUpdates.push({ state, strategy });
      },
      now: () => "2026-04-28T13:02:00.000Z"
    });

    assert.equal(result.executionResult.status, "failed");
    assert.ok(result.executionResult.blockingReasons.includes("unknown_execution_error"));
    assert.ok(!result.executionResult.blockingReasons.includes("[object Object]"));
    assert.ok(!result.executionResult.blockingReasons.includes("undefined"));

    const anomaly = govUpdates[0]?.state.anomalies.at(-1);
    assert.equal(anomaly?.kind, "execution_failure");
    assert.equal(anomaly?.message, "host_dispatch_failed:unknown_execution_error");

    const observations = await observationStore.findByTaskId(task.taskId);
    assert.equal(
      observations[0]?.signals.errorClass,
      "host_dispatch_failed:unknown_execution_error"
    );
  });
}

test("governance: codex-cli host dispatch third failure triggers recovery result", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createReadOnlyCodexCliTask("gov-codex-cli-host-dispatch-step-back");
  const govUpdates: GovernanceUpdateRecord[] = [];
  const observationStore = createRecordingExecutionObservationStore();

  const result = await runDesktopTask({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        throw new Error("spawn sentinel");
      }
    },
    observationBus: observationStore,
    governanceState: createHighRiskStateWithTwoExecutionFailures(task.taskId),
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    now: () => "2026-04-28T13:05:00.000Z"
  });

  assert.equal(result.decisionResult.decision.hostRoute, "codex-cli");
  assert.equal(result.executionResult.status, "failed");
  assert.ok(result.executionResult.blockingReasons.includes("governance_step_back_triggered"));
  assert.ok(result.executionResult.blockingReasons.includes("arbitration_required"));
  assert.ok(result.executionResult.governance, "host dispatch should expose recovery governance");
  assert.equal(result.executionResult.governance?.recoveryRequired, true);
  assert.equal(result.executionResult.governance?.lockdown, true);
  assert.equal(result.executionResult.governance?.strategyDecision.actionFamily, "step_back");
  assert.equal(result.executionResult.governance?.arbitrationPacket.trigger, "third_anomaly");
  assert.equal(result.executionResult.governance?.operatorAction?.recommendedAction, "fork");
  assert.equal(result.executionResult.governance?.operatorAction?.lockdown, true);
  assert.equal(
    result.executionResult.governance?.state.anomalies.at(-1)?.message,
    "host_dispatch_failed:spawn sentinel"
  );
  const observations = await observationStore.findByTaskId(task.taskId);
  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.primitiveId, "host_dispatch:codex-cli");
  const ref = createExecutionObservationRef(observations[0]!.observationId);
  assert.ok(result.executionResult.governance?.state.anomalies.at(-1)?.evidenceRefs.includes(ref));
  assert.ok(result.executionResult.governance?.arbitrationPacket.rawEvidenceRefs.includes(ref));
  assert.ok(result.executionResult.governance?.operatorAction?.evidenceRefs.includes(ref));
  const resolvedObservation = await resolveExecutionObservationRef(
    observationStore,
    task.taskId,
    ref
  );
  assert.equal(resolvedObservation?.observationId, observations[0]?.observationId);
  assert.equal(govUpdates[0]?.strategy.actionFamily, "step_back");
});

test("governance: successful codex-cli host dispatch does not trigger governance updates", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createReadOnlyCodexCliTask("gov-codex-cli-host-dispatch-success");
  let govCalled = false;

  const result = await runDesktopTask({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => createFakeCodexCliChild({
        stdout: "{\"type\":\"agent_message\",\"message\":\"ok\"}\n",
        exitCode: 0
      })
    },
    governanceState: createLowRiskGovernanceState(task.taskId),
    onGovernanceUpdate: async () => {
      govCalled = true;
    },
    now: () => "2026-04-28T13:10:00.000Z"
  });

  assert.equal(result.decisionResult.decision.hostRoute, "codex-cli");
  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(result.executionResult.blockingReasons, []);
  assert.equal(result.executionResult.governance, undefined);
  assert.equal(govCalled, false);
});
