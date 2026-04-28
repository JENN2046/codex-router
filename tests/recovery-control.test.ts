import test from "node:test";
import assert from "node:assert/strict";
import {
  createArbitrationPacket,
  shouldLockdown
} from "../packages/recovery-control/src/index.js";
import type { GovernanceState } from "../packages/state-manager/src/index.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createState(): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId: "recovery-task",
    branchId: "main",
    phase: "recovery",
    trustBalance: {
      centralOrder: 0.5,
      distributedVitality: 0.5
    },
    risk: {
      entanglement: 0.5,
      entropy: 0.8,
      failureCost: 0.8,
      reversibility: 0.2,
      contextPressure: 0.7,
      historicalTrust: 0.4,
      globalCoherence: 0.5,
      finalRiskLevel: "critical"
    },
    anomalies: [
      {
        anomalyId: "a1",
        taskId: "recovery-task",
        kind: "output_drift",
        message: "first",
        strikeNumber: 1,
        createdAt: "2026-04-27T00:01:00.000Z",
        evidenceRefs: ["evidence:first"]
      },
      {
        anomalyId: "a2",
        taskId: "recovery-task",
        kind: "output_drift",
        message: "second",
        strikeNumber: 2,
        createdAt: "2026-04-27T00:02:00.000Z",
        evidenceRefs: ["evidence:second"]
      },
      {
        anomalyId: "a3",
        taskId: "recovery-task",
        kind: "output_drift",
        message: "third",
        strikeNumber: 3,
        createdAt: "2026-04-27T00:03:00.000Z",
        evidenceRefs: ["evidence:third"]
      }
    ],
    approvals: [],
    taskGraphRef: "task-graph:recovery-task",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:03:00.000Z"
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

test("recovery control creates arbitration packet with correct trigger", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(packet.trigger, "third_anomaly");
  assert.equal(packet.taskId, "recovery-task");
});

test("recovery control disallows probability prediction", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(packet.probabilityPredictionAllowed, false);
});

test("recovery control includes all four available actions", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.deepEqual(packet.availableActions, ["resume", "rollback", "abort", "fork"]);
});

test("recovery control collects evidence refs from all anomalies", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.ok(packet.rawEvidenceRefs.includes("evidence:first"));
  assert.ok(packet.rawEvidenceRefs.includes("evidence:second"));
  assert.ok(packet.rawEvidenceRefs.includes("evidence:third"));
});

test("recovery control locks down on third anomaly", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(shouldLockdown(packet), true);
});

test("recovery control does not lockdown on first anomaly", () => {
  const state = createState();
  const firstOnly: GovernanceState = {
    ...state,
    anomalies: [state.anomalies[0]!]
  };

  const packet = createArbitrationPacket({
    state: firstOnly,
    trigger: "first_anomaly",
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(shouldLockdown(packet), false);
  assert.equal(packet.trigger, "first_anomaly");
});

test("recovery control uses provided recommendation", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    recommendation: "freeze execution and wait for human review",
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(packet.recommendation, "freeze execution and wait for human review");
});

test("recovery control embeds current state in packet", () => {
  const state = createState();
  const packet = createArbitrationPacket({
    state,
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(packet.currentState, state);
});
