import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreConflict,
  arbitrateConflict,
  shouldTriggerConjugateAgent,
  createEvidenceRecord,
  parseEvidenceRecord
} from "../packages/governance-internal-validation-arbiter/src/index.js";
import type { GovernanceState } from "../packages/governance-internal-state-manager/src/index.js";
import { parseExecutionObservation } from "../packages/governance-internal-execution-observation/src/index.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createLowRiskState(): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId: "arbiter-task",
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
    taskGraphRef: "task-graph:arbiter-task",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z"
  };
}

function createHighRiskState(): GovernanceState {
  return {
    ...createLowRiskState(),
    risk: {
      ...createLowRiskState().risk,
      finalRiskLevel: "high",
      entropy: 0.7,
      failureCost: 0.8
    }
  };
}

// ── Evidence tests ──────────────────────────────────────────────────────────

test("validation arbiter creates evidence record with generated id", () => {
  const evidence = createEvidenceRecord({
    taskId: "task-1",
    agentRole: "executor",
    content: "test evidence",
    confidence: 0.8,
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(evidence.evidenceId, "task-1:executor:2026-04-27T00:00:00.000Z");
  assert.equal(evidence.confidence, 0.8);
});

test("validation arbiter parses evidence record", () => {
  const evidence = parseEvidenceRecord({
    evidenceId: "ev-1",
    taskId: "task-1",
    agentRole: "verifier",
    content: "verifier found issue",
    confidence: 0.9,
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(evidence.agentRole, "verifier");
  assert.equal(evidence.confidence, 0.9);
});

// ── Conflict score tests ────────────────────────────────────────────────────

test("validation arbiter scores no conflict with empty observations", () => {
  const result = scoreConflict([]);

  assert.equal(result.score, 0);
  assert.equal(result.level, "none");
  assert.deepEqual(result.reasons, []);
});

test("validation arbiter scores high conflict with multiple failures", () => {
  const observations = [
    parseExecutionObservation({
      observationId: "obs-1",
      taskId: "task-1",
      primitiveId: "step-1",
      stage: "execution",
      status: "failed",
      signals: {},
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    parseExecutionObservation({
      observationId: "obs-2",
      taskId: "task-1",
      primitiveId: "step-2",
      stage: "execution",
      status: "blocked",
      signals: { contextConflict: true },
      createdAt: "2026-04-27T00:01:00.000Z"
    })
  ];

  const result = scoreConflict(observations);

  assert.ok(result.score > 0.4);
  assert.ok(result.level === "medium" || result.level === "high");
});

// ── Arbitration tests ──────────────────────────────────────────────────────

test("validation arbiter accepts executor in low risk with no conjugate", () => {
  const state = createLowRiskState();
  const evidence = [
    createEvidenceRecord({
      taskId: "task-1",
      agentRole: "executor",
      content: "executor result",
      confidence: 0.7,
      createdAt: "2026-04-27T00:00:00.000Z"
    })
  ];

  const result = arbitrateConflict({
    taskId: "task-1",
    evidence,
    state
  });

  assert.equal(result.action, "accept_executor");
});

test("validation arbiter prefers conjugate in high risk with high confidence", () => {
  const state = createHighRiskState();
  const evidence = [
    createEvidenceRecord({
      taskId: "task-1",
      agentRole: "executor",
      content: "executor result",
      confidence: 0.6,
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    createEvidenceRecord({
      taskId: "task-1",
      agentRole: "conjugate",
      content: "conjugate found issue",
      confidence: 0.85,
      createdAt: "2026-04-27T00:01:00.000Z"
    })
  ];

  const result = arbitrateConflict({
    taskId: "task-1",
    evidence,
    state
  });

  assert.equal(result.action, "accept_conjugate");
  assert.ok(result.confidence >= 0.8);
});

test("validation arbiter prefers verifier in high risk with high confidence", () => {
  const state = createHighRiskState();
  const evidence = [
    createEvidenceRecord({
      taskId: "task-1",
      agentRole: "executor",
      content: "executor result",
      confidence: 0.5,
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    createEvidenceRecord({
      taskId: "task-1",
      agentRole: "verifier",
      content: "verifier found issue",
      confidence: 0.9,
      createdAt: "2026-04-27T00:01:00.000Z"
    })
  ];

  const result = arbitrateConflict({
    taskId: "task-1",
    evidence,
    state
  });

  assert.equal(result.action, "accept_verifier");
  assert.ok(result.confidence >= 0.85);
});

test("validation arbiter fallback derives action from top evidence agentRole", () => {
  const state = createLowRiskState();
  const evidence = [
    createEvidenceRecord({
      taskId: "task-1",
      agentRole: "executor",
      content: "executor result",
      confidence: 0.5,
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    createEvidenceRecord({
      taskId: "task-1",
      agentRole: "verifier",
      content: "verifier result",
      confidence: 0.6,
      createdAt: "2026-04-27T00:01:00.000Z"
    })
  ];

  const result = arbitrateConflict({
    taskId: "task-1",
    evidence,
    state
  });

  // Fallback: low risk + verifier top but not >0.7 → fallback path
  // Action must match top evidence agentRole, not default accept_executor
  assert.equal(result.action, "accept_verifier");
  assert.equal(result.confidence, 0.6);
  assert.ok(result.winnerEvidenceId?.includes("verifier"));
});

// ── Conjugate trigger tests ────────────────────────────────────────────────

test("validation arbiter does not trigger conjugate for low risk clean state", () => {
  const state = createLowRiskState();
  const observations: any[] = [];

  assert.equal(shouldTriggerConjugateAgent({ state, observations }), false);
});

test("validation arbiter triggers conjugate for high entropy", () => {
  const state = createLowRiskState();
  state.risk.entropy = 0.7;

  assert.equal(shouldTriggerConjugateAgent({ state, observations: [] }), true);
});

test("validation arbiter triggers conjugate for high failure cost", () => {
  const state = createLowRiskState();
  state.risk.failureCost = 0.8;

  assert.equal(shouldTriggerConjugateAgent({ state, observations: [] }), true);
});

test("validation arbiter triggers conjugate for context conflict", () => {
  const state = createLowRiskState();
  const observations = [
    parseExecutionObservation({
      observationId: "obs-1",
      taskId: "task-1",
      primitiveId: "step-1",
      stage: "execution",
      status: "succeeded",
      signals: { contextConflict: true },
      createdAt: "2026-04-27T00:00:00.000Z"
    })
  ];

  assert.equal(shouldTriggerConjugateAgent({ state, observations }), true);
});

test("validation arbiter triggers conjugate for multiple failures", () => {
  const state = createLowRiskState();
  const observations = [
    parseExecutionObservation({
      observationId: "obs-1",
      taskId: "task-1",
      primitiveId: "step-1",
      stage: "execution",
      status: "failed",
      signals: {},
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    parseExecutionObservation({
      observationId: "obs-2",
      taskId: "task-1",
      primitiveId: "step-2",
      stage: "execution",
      status: "failed",
      signals: {},
      createdAt: "2026-04-27T00:01:00.000Z"
    })
  ];

  assert.equal(shouldTriggerConjugateAgent({ state, observations }), true);
});
