import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";
import {
  createPrimitiveFailureEnvelope,
  executeDesktopPlan,
  type DesktopLiveExecutionResult
} from "../packages/desktop-live-adapter/src/index.js";
import {
  createRecordingExecutionObservationStore
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

  // Risk should be updated (no longer the initial low risk defaults)
  assert.ok(
    firstUpdate.state.risk.entropy !== initialState.risk.entropy ||
    firstUpdate.state.risk.failureCost !== initialState.risk.failureCost,
    "risk should be re-scored from initial state"
  );

  // Strategy should be present
  assert.ok(firstUpdate.strategy.actionFamily.length > 0);
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
  const govUpdates: GovernanceUpdateRecord[] = [];

  // Start with high-risk state and two pre-existing execution_failure anomalies
  // so the next failure produces strikeNumber=3 and triggers step_back
  const highRiskState: GovernanceState = {
    schemaVersion: "governance-state.v1",
    taskId: ready.task.taskId,
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
        taskId: ready.task.taskId,
        kind: "execution_failure",
        message: "failure one",
        strikeNumber: 1,
        createdAt: "2026-04-28T10:00:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "anomaly:gov-integration-ready:a2",
        taskId: ready.task.taskId,
        kind: "execution_failure",
        message: "failure two",
        strikeNumber: 2,
        createdAt: "2026-04-28T11:00:00.000Z",
        evidenceRefs: []
      }
    ],
    approvals: [],
    taskGraphRef: `task-graph:${ready.task.taskId}`,
    createdAt: "2026-04-28T09:00:00.000Z",
    updatedAt: "2026-04-28T11:00:00.000Z"
  };

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      // Two primitives will be missing — this gives us the third failure
    },
    governanceState: highRiskState,
    onGovernanceUpdate: async (state, strategy) => {
      govUpdates.push({ state, strategy });
    },
    stopOnFailure: false,
    now: () => "2026-04-28T12:00:00.000Z"
  });

  // With strike 3 in a high risk state, step_back or abort should block execution
  const stepBackUpdates = govUpdates.filter(
    u => u.strategy.actionFamily === "step_back" || u.strategy.actionFamily === "abort"
  );

  // Either the execution was blocked by arbitration_required,
  // or the strategy was re-routed to step_back/abort
  const wasBlocked = execution.blockingReasons.some(
    r => r === "governance_step_back_triggered" || r === "arbitration_required"
  );
  const wasRerouted = stepBackUpdates.length > 0;

  assert.ok(
    wasBlocked || wasRerouted,
    `expected step_back trigger: blocked=${wasBlocked}, rerouted=${wasRerouted}, ` +
    `blockingReasons=[${execution.blockingReasons.join(",")}]`
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
