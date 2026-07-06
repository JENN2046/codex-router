import test from "node:test";
import assert from "node:assert/strict";
import {
  routeStrategyV2,
  requiresHumanStepBack,
  isWriteExecutionAllowed
} from "../packages/governance-internal-strategy-router/src/index.js";
import type { GovernanceState } from "../packages/governance-internal-state-manager/src/index.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createState(overrides: Partial<GovernanceState> = {}): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId: "strategy-task",
    branchId: "main",
    phase: "execution",
    trustBalance: {
      centralOrder: 0.5,
      distributedVitality: 0.5
    },
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
    taskGraphRef: "task-graph:strategy-task",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    ...overrides
  };
}

// ── Low risk tests ──────────────────────────────────────────────────────────

test("strategy router executes low risk work", () => {
  const decision = routeStrategyV2({
    state: createState(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(decision.actionFamily, "execute");
  assert.equal(decision.verificationIntensity, "light");
  assert.equal(decision.checkpointCadence, "stage");
  assert.equal(decision.agentBudget.executor, 1);
  assert.equal(decision.agentBudget.verifier, 0);
});

test("strategy router allows write execution for low risk", () => {
  const decision = routeStrategyV2({
    state: createState(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(isWriteExecutionAllowed(decision), true);
});

test("strategy router does not require human step-back for low risk", () => {
  const decision = routeStrategyV2({
    state: createState(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(requiresHumanStepBack(decision), false);
});

// ── High risk tests ─────────────────────────────────────────────────────────

test("strategy router verifies high risk work", () => {
  const base = createState();
  const state = createState({
    risk: {
      ...base.risk,
      finalRiskLevel: "high"
    }
  });

  const decision = routeStrategyV2({
    state,
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(decision.actionFamily, "verify");
  assert.equal(decision.verificationIntensity, "standard");
  assert.equal(decision.agentBudget.verifier, 1);
});

test("strategy router verifies when entropy is high", () => {
  const base = createState();
  const state = createState({
    risk: {
      ...base.risk,
      entropy: 0.7
    }
  });

  const decision = routeStrategyV2({ state });

  assert.equal(decision.actionFamily, "verify");
});

test("strategy router verifies when context pressure is high", () => {
  const base = createState();
  const state = createState({
    risk: {
      ...base.risk,
      contextPressure: 0.8
    }
  });

  const decision = routeStrategyV2({ state });

  assert.equal(decision.actionFamily, "verify");
});

// ── Critical risk tests ─────────────────────────────────────────────────────

test("strategy router simulates critical risk work", () => {
  const base = createState();
  const state = createState({
    risk: {
      ...base.risk,
      finalRiskLevel: "critical"
    }
  });

  const decision = routeStrategyV2({
    state,
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(decision.actionFamily, "simulate");
  assert.equal(decision.verificationIntensity, "strict");
  assert.equal(decision.agentBudget.executor, 0);
  assert.equal(isWriteExecutionAllowed(decision), false);
});

// ── Three strikes tests ────────────────────────────────────────────────────

test("strategy router steps back after three strikes", () => {
  const state = createState({
    anomalies: [
      {
        anomalyId: "a1",
        taskId: "strategy-task",
        kind: "output_drift",
        message: "first",
        strikeNumber: 1,
        createdAt: "2026-04-27T00:01:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "a2",
        taskId: "strategy-task",
        kind: "output_drift",
        message: "second",
        strikeNumber: 2,
        createdAt: "2026-04-27T00:02:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "a3",
        taskId: "strategy-task",
        kind: "output_drift",
        message: "third",
        strikeNumber: 3,
        createdAt: "2026-04-27T00:03:00.000Z",
        evidenceRefs: []
      }
    ]
  });

  const decision = routeStrategyV2({
    state,
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(decision.actionFamily, "step_back");
  assert.equal(decision.verificationIntensity, "strict");
  assert.equal(decision.checkpointCadence, "risk_boundary");
  assert.equal(requiresHumanStepBack(decision), true);
  assert.equal(isWriteExecutionAllowed(decision), false);
});

test("strategy router step_back blocks execution", () => {
  const state = createState({
    anomalies: [
      {
        anomalyId: "a1",
        taskId: "strategy-task",
        kind: "output_drift",
        message: "first",
        strikeNumber: 3,
        createdAt: "2026-04-27T00:01:00.000Z",
        evidenceRefs: []
      }
    ]
  });

  const decision = routeStrategyV2({ state });

  assert.equal(decision.agentBudget.executor, 0);
});
