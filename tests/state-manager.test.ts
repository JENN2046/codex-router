import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialGovernanceState,
  createDefaultRiskScore,
  recordAnomaly,
  parseGovernanceState
} from "../packages/state-manager/src/index.js";
import {
  parseRoutingDecision,
  parseTaskEnvelope
} from "../packages/contracts/src/index.js";

// ── Test helpers ────────────────────────────────────────────────────────────

function createTask() {
  return parseTaskEnvelope({
    taskId: "state-manager-task",
    source: "desktop-thread",
    intent: {
      summary: "review current config",
      requestedAction: "inspect and summarize routing policy",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["routing-policy.yaml"],
      modules: []
    },
    constraints: {},
    hints: {
      riskHints: [],
      tags: []
    }
  });
}

function createDecision() {
  return parseRoutingDecision({
    decisionId: "state-manager-task:test-policy",
    taskId: "state-manager-task",
    policyVersion: "test-policy",
    classification: {
      taskClass: "read_only",
      riskLevel: "low",
      ambiguityScore: 0.1,
      clarificationRequired: false,
      riskFactors: ["task_class:read_only"]
    },
    execution: {
      selectedModel: "gpt-5.4-mini",
      toolAccess: "read_only",
      executionProfile: "recon-only",
      reasoningEffort: "low"
    },
    approval: {
      required: false,
      reasons: []
    },
    parallelism: {
      allowed: true,
      maxAgents: 2,
      mode: "read_only"
    },
    hostRoute: "codex-cli"
  });
}

function createHighRiskDecision() {
  return parseRoutingDecision({
    decisionId: "high-risk-task:test-policy",
    taskId: "high-risk-task",
    policyVersion: "test-policy",
    classification: {
      taskClass: "high_risk",
      riskLevel: "high",
      ambiguityScore: 0.3,
      clarificationRequired: false,
      riskFactors: ["high_risk_keywords", "protected_branch"]
    },
    execution: {
      selectedModel: "gpt-5.1-codex-max",
      toolAccess: "engineering_write",
      executionProfile: "high-risk-change",
      reasoningEffort: "high"
    },
    approval: {
      required: true,
      reasons: ["protected_branch"]
    },
    parallelism: {
      allowed: false,
      maxAgents: 1,
      mode: "disabled"
    },
    hostRoute: "desktop"
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

test("state manager creates an initial governance state with correct schema version", () => {
  const state = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(state.schemaVersion, "governance-state.v1");
});

test("state manager assigns taskId from the task envelope", () => {
  const state = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(state.taskId, "state-manager-task");
});

test("state manager defaults trust balance to 55-开 (0.5 / 0.5)", () => {
  const state = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(state.trustBalance.centralOrder, 0.5);
  assert.equal(state.trustBalance.distributedVitality, 0.5);
});

test("state manager maps low risk from routing decision", () => {
  const state = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(state.risk.finalRiskLevel, "low");
  assert.ok(state.risk.reversibility > state.risk.failureCost);
});

test("state manager maps high risk from routing decision", () => {
  const state = createInitialGovernanceState({
    task: createTask(),
    decision: createHighRiskDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(state.risk.finalRiskLevel, "high");
  assert.equal(state.phase, "preflight");
});

test("state manager starts in planning phase when approval is not required", () => {
  const state = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(state.phase, "planning");
});

test("state manager starts in preflight phase when approval is required", () => {
  const state = createInitialGovernanceState({
    task: createTask(),
    decision: createHighRiskDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(state.phase, "preflight");
});

test("createDefaultRiskScore returns low for low risk decision", () => {
  const decision = createDecision();
  const risk = createDefaultRiskScore(decision);

  assert.equal(risk.finalRiskLevel, "low");
  assert.equal(risk.reversibility, 0.8);
});

test("createDefaultRiskScore returns high for high risk decision", () => {
  const decision = createHighRiskDecision();
  const risk = createDefaultRiskScore(decision);

  assert.equal(risk.finalRiskLevel, "high");
  assert.ok(risk.failureCost > 0.6);
});

test("recordAnomaly appends an anomaly with strike number 1", () => {
  const initial = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  const next = recordAnomaly(initial, {
    anomalyId: "a1",
    taskId: initial.taskId,
    kind: "output_drift",
    message: "first drift detected",
    createdAt: "2026-04-27T00:01:00.000Z",
    evidenceRefs: ["evidence:step-1"]
  });

  assert.equal(next.anomalies.length, 1);
  assert.equal(next.anomalies[0]?.strikeNumber, 1);
  assert.equal(next.anomalies[0]?.kind, "output_drift");
  assert.equal(next.phase, "planning");
});

test("recordAnomaly increments strike number for same-kind anomalies", () => {
  const initial = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  const first = recordAnomaly(initial, {
    anomalyId: "a1",
    taskId: initial.taskId,
    kind: "output_drift",
    message: "first drift",
    createdAt: "2026-04-27T00:01:00.000Z",
    evidenceRefs: []
  });

  const second = recordAnomaly(first, {
    anomalyId: "a2",
    taskId: initial.taskId,
    kind: "output_drift",
    message: "second drift",
    createdAt: "2026-04-27T00:02:00.000Z",
    evidenceRefs: []
  });

  assert.equal(first.anomalies[0]?.strikeNumber, 1);
  assert.equal(second.anomalies[1]?.strikeNumber, 2);
  assert.equal(second.phase, "planning");
});

test("recordAnomaly moves to recovery after third same-kind strike", () => {
  const initial = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  const first = recordAnomaly(initial, {
    anomalyId: "a1",
    taskId: initial.taskId,
    kind: "output_drift",
    message: "first drift",
    createdAt: "2026-04-27T00:01:00.000Z",
    evidenceRefs: []
  });

  const second = recordAnomaly(first, {
    anomalyId: "a2",
    taskId: initial.taskId,
    kind: "output_drift",
    message: "second drift",
    createdAt: "2026-04-27T00:02:00.000Z",
    evidenceRefs: []
  });

  const third = recordAnomaly(second, {
    anomalyId: "a3",
    taskId: initial.taskId,
    kind: "output_drift",
    message: "third drift",
    createdAt: "2026-04-27T00:03:00.000Z",
    evidenceRefs: []
  });

  assert.equal(third.anomalies[2]?.strikeNumber, 3);
  assert.equal(third.phase, "recovery");
});

test("recordAnomaly caps strike number at 3", () => {
  const initial = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  let state = initial;
  for (let i = 0; i < 5; i++) {
    state = recordAnomaly(state, {
      anomalyId: `a${i}`,
      taskId: initial.taskId,
      kind: "output_drift",
      message: `drift ${i}`,
      createdAt: `2026-04-27T00:0${i}:00.000Z`,
      evidenceRefs: []
    });
  }

  const lastStrike = state.anomalies[state.anomalies.length - 1];
  assert.ok(lastStrike);
  assert.equal(lastStrike.strikeNumber, 3);
});

test("recordAnomaly keeps different anomaly kinds with independent strike counts", () => {
  const initial = createInitialGovernanceState({
    task: createTask(),
    decision: createDecision(),
    now: () => "2026-04-27T00:00:00.000Z"
  });

  const afterDrift = recordAnomaly(initial, {
    anomalyId: "a1",
    taskId: initial.taskId,
    kind: "output_drift",
    message: "drift",
    createdAt: "2026-04-27T00:01:00.000Z",
    evidenceRefs: []
  });

  const afterPerm = recordAnomaly(afterDrift, {
    anomalyId: "a2",
    taskId: initial.taskId,
    kind: "permission_blocked",
    message: "blocked",
    createdAt: "2026-04-27T00:02:00.000Z",
    evidenceRefs: []
  });

  assert.equal(afterPerm.anomalies.length, 2);
  assert.equal(afterPerm.anomalies[0]?.strikeNumber, 1);
  assert.equal(afterPerm.anomalies[1]?.strikeNumber, 1);
  assert.equal(afterPerm.phase, "planning");
});

test("parseGovernanceState validates and returns a governance state", () => {
  const state = parseGovernanceState({
    taskId: "task-1",
    branchId: "main",
    phase: "planning",
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
    taskGraphRef: "task-graph:task-1",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(state.schemaVersion, "governance-state.v1");
});

test("parseGovernanceState rejects unbalanced trust", () => {
  assert.throws(() => {
    parseGovernanceState({
      taskId: "task-1",
      branchId: "main",
      phase: "planning",
      trustBalance: {
        centralOrder: 0.9,
        distributedVitality: 0.9
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
      taskGraphRef: "task-graph:task-1",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z"
    });
  });
});
