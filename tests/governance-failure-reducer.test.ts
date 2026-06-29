import test from "node:test";
import assert from "node:assert/strict";
import {
  applyExecutionFailureToGovernanceState,
  type ApplyExecutionFailureInput
} from "../packages/governance-failure-reducer/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import type { GovernanceState, AnomalyRecord } from "../packages/state-manager/src/index.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createLowRiskState(taskId: string): GovernanceState {
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
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z"
  };
}

function createTask() {
  return parseTaskEnvelope({
    taskId: "reducer-task",
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
  });
}

const frozenNow = () => "2026-04-28T12:00:00.000Z";

// ── Basic output shape ──────────────────────────────────────────────────────

test("reducer returns all expected output fields", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();
  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:0",
    errorClass: "missing_handler:spawn_agent",
    stepIndex: 0,
    now: frozenNow
  });

  // All expected keys present
  assert.ok("state" in result);
  assert.ok("risk" in result);
  assert.ok("strategyDecision" in result);
  assert.ok("anomaly" in result);
  assert.ok("arbitrationPacket" in result);

  // State shape
  assert.equal(result.state.schemaVersion, "governance-state.v1");
  assert.equal(result.state.taskId, "reducer-task");

  // Risk shape
  assert.equal(typeof result.risk.entropy, "number");
  assert.ok(["low", "medium", "high", "critical"].includes(result.risk.finalRiskLevel));

  // Strategy shape
  assert.ok(["execute", "verify", "simulate", "step_back", "fork", "abort"].includes(
    result.strategyDecision.actionFamily
  ));

  // Arbitration shape
  assert.equal(result.arbitrationPacket.taskId, "reducer-task");
});

// ── Anomaly creation ────────────────────────────────────────────────────────

test("reducer appends execution_failure anomaly with strike 1 on clean state", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:1",
    errorClass: "agent_capacity_exceeded",
    stepIndex: 1,
    now: frozenNow
  });

  assert.equal(result.state.anomalies.length, 1);
  assert.equal(result.anomaly.kind, "execution_failure");
  assert.equal(result.anomaly.strikeNumber, 1);
  assert.equal(result.anomaly.message, "agent_capacity_exceeded");
});

test("reducer preserves supplied evidence refs on anomaly and arbitration packet", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();
  const evidenceRefs = [
    "execution-observation:reducer-task:spawn_agent:1:failed:2026-04-28T12:00:00.000Z"
  ];

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:1",
    errorClass: "agent_capacity_exceeded",
    evidenceRefs,
    stepIndex: 1,
    now: frozenNow
  });

  assert.deepEqual(result.anomaly.evidenceRefs, evidenceRefs);
  assert.deepEqual(result.state.anomalies.at(-1)?.evidenceRefs, evidenceRefs);
  assert.deepEqual(result.arbitrationPacket.rawEvidenceRefs, evidenceRefs);
});

test("reducer preserves execution observation refs verbatim", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();
  const paddedObservationRef =
    "execution-observation:reducer-task:spawn_agent:1:failed:2026-04-28T12:00:00.000Z ";

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:1",
    errorClass: "agent_capacity_exceeded",
    evidenceRefs: [
      "",
      "   ",
      paddedObservationRef,
      paddedObservationRef
    ],
    stepIndex: 1,
    now: frozenNow
  });

  assert.deepEqual(result.anomaly.evidenceRefs, [paddedObservationRef]);
  assert.deepEqual(result.arbitrationPacket.rawEvidenceRefs, [paddedObservationRef]);
});

test("reducer normalizes evidence refs by trimming, de-duping, and dropping empty values", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();
  const refOne = "execution-observation:one";
  const refTwo = "execution-observation:two";

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:1",
    errorClass: "agent_capacity_exceeded",
    evidenceRefs: [
      "",
      "   ",
      ` ${refOne} `,
      refOne,
      refTwo,
      ` ${refTwo} `
    ],
    stepIndex: 1,
    now: frozenNow
  });

  assert.deepEqual(result.anomaly.evidenceRefs, [refOne, refTwo]);
  assert.deepEqual(result.arbitrationPacket.rawEvidenceRefs, [refOne, refTwo]);
});

// ── Strike escalation ───────────────────────────────────────────────────────

test("reducer increments strikeNumber when same-kind anomalies exist", () => {
  const preExisting: AnomalyRecord = {
    anomalyId: "anomaly:reducer-task:pre",
    taskId: "reducer-task",
    kind: "execution_failure",
    message: "previous failure",
    strikeNumber: 1,
    createdAt: "2026-04-28T11:00:00.000Z",
    evidenceRefs: []
  };

  const state: GovernanceState = {
    ...createLowRiskState("reducer-task"),
    anomalies: [preExisting]
  };
  const task = createTask();

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:1",
    errorClass: "handler_crash",
    stepIndex: 1,
    now: frozenNow
  });

  assert.equal(result.state.anomalies.length, 2);
  assert.equal(result.anomaly.strikeNumber, 2);
});

test("reducer caps strikeNumber at 3", () => {
  const preExisting: AnomalyRecord[] = [
    {
      anomalyId: "anomaly:reducer-task:a1",
      taskId: "reducer-task",
      kind: "execution_failure",
      message: "failure one",
      strikeNumber: 1,
      createdAt: "2026-04-28T10:00:00.000Z",
      evidenceRefs: []
    },
    {
      anomalyId: "anomaly:reducer-task:a2",
      taskId: "reducer-task",
      kind: "execution_failure",
      message: "failure two",
      strikeNumber: 2,
      createdAt: "2026-04-28T11:00:00.000Z",
      evidenceRefs: []
    },
    {
      anomalyId: "anomaly:reducer-task:a3",
      taskId: "reducer-task",
      kind: "execution_failure",
      message: "failure three",
      strikeNumber: 3,
      createdAt: "2026-04-28T11:30:00.000Z",
      evidenceRefs: []
    }
  ];

  const state: GovernanceState = {
    ...createLowRiskState("reducer-task"),
    anomalies: preExisting
  };
  const task = createTask();

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:3",
    errorClass: "yet_another_failure",
    stepIndex: 3,
    now: frozenNow
  });

  assert.equal(result.state.anomalies.length, 4);
  assert.equal(result.anomaly.strikeNumber, 3,
    "strikeNumber should be capped at 3"
  );
});

// ── Risk re-scoring ─────────────────────────────────────────────────────────

test("reducer re-scores risk differently from initial state after failure", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:0",
    errorClass: "missing_handler:spawn_agent",
    stepIndex: 0,
    now: frozenNow
  });

  // Risk should differ from initial low-risk defaults
  const changed =
    result.risk.entropy !== state.risk.entropy ||
    result.risk.failureCost !== state.risk.failureCost ||
    result.risk.entanglement !== state.risk.entanglement;
  assert.ok(changed, "risk should be re-scored after failure");

  // State should carry the new risk
  assert.equal(result.state.risk.entropy, result.risk.entropy);
  assert.equal(result.state.risk.finalRiskLevel, result.risk.finalRiskLevel);
});

// ── Strategy re-routing ─────────────────────────────────────────────────────

test("reducer re-routes strategy based on updated state", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:0",
    errorClass: "missing_handler:spawn_agent",
    stepIndex: 0,
    now: frozenNow
  });

  assert.equal(result.strategyDecision.taskId, "reducer-task");
  assert.ok(result.strategyDecision.actionFamily.length > 0);
  // On first failure from low risk, strategy should still allow execute or verify
  assert.ok(
    ["execute", "verify", "simulate"].includes(result.strategyDecision.actionFamily),
    `expected execute/verify/simulate on first failure, got ${result.strategyDecision.actionFamily}`
  );
});

test("reducer routes step_back on high risk with third strike", () => {
  const highRiskState: GovernanceState = {
    ...createLowRiskState("reducer-task"),
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
        anomalyId: "anomaly:reducer-task:a1",
        taskId: "reducer-task",
        kind: "execution_failure",
        message: "failure one",
        strikeNumber: 1,
        createdAt: "2026-04-28T10:00:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "anomaly:reducer-task:a2",
        taskId: "reducer-task",
        kind: "execution_failure",
        message: "failure two",
        strikeNumber: 2,
        createdAt: "2026-04-28T11:00:00.000Z",
        evidenceRefs: []
      }
    ]
  };
  const task = createTask();

  const result = applyExecutionFailureToGovernanceState({
    state: highRiskState,
    task,
    primitiveId: "spawn_agent:2",
    errorClass: "agent_capacity_exceeded",
    stepIndex: 2,
    now: frozenNow
  });

  // Third strike in high risk → step_back or abort
  assert.ok(
    result.strategyDecision.actionFamily === "step_back" ||
    result.strategyDecision.actionFamily === "abort",
    `expected step_back/abort on third strike, got ${result.strategyDecision.actionFamily}`
  );
});

// ── Arbitration packet ──────────────────────────────────────────────────────

test("reducer creates arbitration packet with third_anomaly trigger on third strike", () => {
  const state: GovernanceState = {
    ...createLowRiskState("reducer-task"),
    anomalies: [
      {
        anomalyId: "anomaly:reducer-task:a1",
        taskId: "reducer-task",
        kind: "execution_failure",
        message: "f1",
        strikeNumber: 1,
        createdAt: "2026-04-28T10:00:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "anomaly:reducer-task:a2",
        taskId: "reducer-task",
        kind: "execution_failure",
        message: "f2",
        strikeNumber: 2,
        createdAt: "2026-04-28T11:00:00.000Z",
        evidenceRefs: []
      }
    ]
  };
  const task = createTask();

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:2",
    errorClass: "handler_crash",
    stepIndex: 2,
    now: frozenNow
  });

  assert.equal(result.arbitrationPacket.trigger, "third_anomaly");
  assert.ok(result.arbitrationPacket.availableActions.length >= 2);
});

test("reducer creates arbitration packet with first_anomaly trigger on first failure", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();

  const result = applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:0",
    errorClass: "missing_handler:spawn_agent",
    stepIndex: 0,
    now: frozenNow
  });

  assert.equal(result.arbitrationPacket.trigger, "first_anomaly");
  assert.ok(result.arbitrationPacket.availableActions.includes("resume"));
});

// ── Immutability ────────────────────────────────────────────────────────────

test("reducer does not mutate input state", () => {
  const state = createLowRiskState("reducer-task");
  const originalAnomalyCount = state.anomalies.length;
  const originalRisk = { ...state.risk };
  const task = createTask();

  applyExecutionFailureToGovernanceState({
    state,
    task,
    primitiveId: "spawn_agent:0",
    errorClass: "something_failed",
    stepIndex: 0,
    now: frozenNow
  });

  // Input state must be unchanged
  assert.equal(state.anomalies.length, originalAnomalyCount);
  assert.deepEqual(state.risk, originalRisk);
});

// ── Different error classes ─────────────────────────────────────────────────

test("reducer preserves errorClass in anomaly message", () => {
  const state = createLowRiskState("reducer-task");
  const task = createTask();

  const errors = [
    "missing_handler:spawn_agent",
    "agent_capacity_exceeded",
    "handler_crash",
    "timeout_exceeded"
  ];

  for (const errorClass of errors) {
    const result = applyExecutionFailureToGovernanceState({
      state,
      task,
      primitiveId: "spawn_agent:0",
      errorClass,
      stepIndex: 0,
      now: frozenNow
    });
    assert.equal(result.anomaly.message, errorClass);
  }
});
