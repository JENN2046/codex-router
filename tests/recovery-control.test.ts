import test from "node:test";
import assert from "node:assert/strict";
import {
  createArbitrationPacket,
  parseArbitrationPacket,
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

test("recovery control preserves full_control approval requirement for first anomaly", () => {
  const state = createState();
  const firstOnly: GovernanceState = {
    ...state,
    anomalies: [state.anomalies[0]!]
  };

  const packet = createArbitrationPacket({
    state: firstOnly,
    trigger: "first_anomaly",
    delegationLevel: "full_control",
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.deepEqual(packet.availableActions, ["resume", "abort"]);
  assert.equal(packet.recoveryRecommendation?.action, "resume");
  assert.equal(
    packet.recoveryRecommendation?.reasonCode,
    "first_anomaly_resume_with_monitoring"
  );
  assert.equal(packet.recoveryRecommendation?.requiresHumanApproval, true);
});

test("recovery control uses provided recommendation", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    recommendation: "freeze execution and wait for human review",
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(packet.recommendation, "freeze execution and wait for human review");
});

test("recovery control recommends rollback when third anomaly has a checkpoint", () => {
  const packet = createArbitrationPacket({
    state: {
      ...createState(),
      latestCheckpointId: "checkpoint:recovery-task:latest"
    },
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(packet.recoveryRecommendation?.action, "rollback");
  assert.equal(
    packet.recoveryRecommendation?.reasonCode,
    "third_anomaly_rollback_to_checkpoint"
  );
  assert.equal(packet.recoveryRecommendation?.requiresHumanApproval, true);
  assert.equal(packet.recoveryRecommendation?.checkpointRef, "checkpoint:recovery-task:latest");
  assert.deepEqual(packet.recoveryRecommendation?.evidenceRefs, packet.rawEvidenceRefs);
  assert.equal(packet.recoveryRecommendation?.evidenceStatus, "referenced");
});

test("recovery control recommends fork when third anomaly has no checkpoint", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(packet.recoveryRecommendation?.action, "fork");
  assert.equal(
    packet.recoveryRecommendation?.reasonCode,
    "third_anomaly_fork_for_investigation"
  );
  assert.equal(packet.recoveryRecommendation?.requiresHumanApproval, true);
  assert.equal(packet.recoveryRecommendation?.evidenceStatus, "referenced");
});

test("recovery control marks recommendation evidence as missing when refs are absent", () => {
  const state: GovernanceState = {
    ...createState(),
    anomalies: createState().anomalies.map((anomaly) => ({
      ...anomaly,
      evidenceRefs: []
    }))
  };

  const packet = createArbitrationPacket({
    state,
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.deepEqual(packet.rawEvidenceRefs, []);
  assert.equal(packet.recoveryRecommendation?.evidenceStatus, "missing");
  assert.deepEqual(packet.recoveryRecommendation?.evidenceRefs, []);
});

test("recovery control falls back to abort when delegation removes reversible actions", () => {
  const packet = createArbitrationPacket({
    state: createState(),
    delegationLevel: "full_control",
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.deepEqual(packet.availableActions, ["resume", "abort"]);
  assert.equal(packet.recoveryRecommendation?.action, "abort");
  assert.equal(
    packet.recoveryRecommendation?.reasonCode,
    "third_anomaly_abort_without_reversible_action"
  );
  assert.equal(packet.recoveryRecommendation?.requiresHumanApproval, true);
});

test("recovery control rejects missing evidence status with refs", () => {
  assert.throws(
    () => parseArbitrationPacket(createPacketInput({
      recoveryRecommendation: {
        action: "fork",
        reasonCode: "third_anomaly_fork_for_investigation",
        requiresHumanApproval: true,
        evidenceStatus: "missing",
        evidenceRefs: ["execution-observation:o1"],
        summary: "contradictory evidence status"
      }
    })),
    /missing_evidence_status_requires_no_refs/
  );
});

test("recovery control rejects referenced evidence status without refs", () => {
  assert.throws(
    () => parseArbitrationPacket(createPacketInput({
      rawEvidenceRefs: [],
      recoveryRecommendation: {
        action: "fork",
        reasonCode: "third_anomaly_fork_for_investigation",
        requiresHumanApproval: true,
        evidenceStatus: "referenced",
        evidenceRefs: [],
        summary: "missing evidence refs"
      }
    })),
    /referenced_evidence_status_requires_refs/
  );
});

test("recovery control rejects rollback recommendation without checkpoint", () => {
  assert.throws(
    () => parseArbitrationPacket(createPacketInput({
      recoveryRecommendation: {
        action: "rollback",
        reasonCode: "third_anomaly_rollback_to_checkpoint",
        requiresHumanApproval: true,
        evidenceStatus: "referenced",
        evidenceRefs: ["execution-observation:o1"],
        summary: "rollback without checkpoint"
      }
    })),
    /recommendation_checkpoint_required/
  );
});

test("recovery control rejects mismatched recommendation action and reason", () => {
  assert.throws(
    () => parseArbitrationPacket(createPacketInput({
      recoveryRecommendation: {
        action: "resume",
        reasonCode: "third_anomaly_fork_for_investigation",
        requiresHumanApproval: true,
        evidenceStatus: "referenced",
        evidenceRefs: ["execution-observation:o1"],
        summary: "wrong action for reason"
      }
    })),
    /recommendation_action_mismatch/
  );
});

test("recovery control rejects recommendation reason that does not match trigger", () => {
  assert.throws(
    () => parseArbitrationPacket(createPacketInput({
      trigger: "first_anomaly",
      recoveryRecommendation: {
        action: "fork",
        reasonCode: "third_anomaly_fork_for_investigation",
        requiresHumanApproval: true,
        evidenceStatus: "referenced",
        evidenceRefs: ["execution-observation:o1"],
        summary: "wrong phase for recommendation"
      }
    })),
    /recommendation_trigger_mismatch/
  );
});

test("recovery control rejects recommendation evidence that differs from packet evidence", () => {
  assert.throws(
    () => parseArbitrationPacket(createPacketInput({
      rawEvidenceRefs: ["execution-observation:o1"],
      recoveryRecommendation: {
        action: "fork",
        reasonCode: "third_anomaly_fork_for_investigation",
        requiresHumanApproval: true,
        evidenceStatus: "referenced",
        evidenceRefs: ["execution-observation:o2"],
        summary: "evidence mismatch"
      }
    })),
    /recommendation_evidence_refs_mismatch/
  );
});

test("recovery control rejects recommended action that is not available", () => {
  assert.throws(
    () => parseArbitrationPacket(createPacketInput({
      availableActions: ["resume", "abort"],
      recoveryRecommendation: {
        action: "fork",
        reasonCode: "third_anomaly_fork_for_investigation",
        requiresHumanApproval: true,
        evidenceStatus: "referenced",
        evidenceRefs: ["execution-observation:o1"],
        summary: "unavailable action"
      }
    })),
    /recommendation_action_unavailable/
  );
});

test("recovery control embeds current state in packet", () => {
  const state = createState();
  const packet = createArbitrationPacket({
    state,
    now: () => "2026-04-27T00:04:00.000Z"
  });

  assert.equal(packet.currentState, state);
});

function createPacketInput(overrides: {
  trigger?: "first_anomaly" | "second_anomaly" | "third_anomaly" | "manual";
  rawEvidenceRefs?: string[];
  availableActions?: Array<"resume" | "rollback" | "abort" | "fork">;
  recoveryRecommendation?: {
    action: "resume" | "rollback" | "abort" | "fork";
    reasonCode:
      | "first_anomaly_resume_with_monitoring"
      | "second_anomaly_require_human_review"
      | "third_anomaly_rollback_to_checkpoint"
      | "third_anomaly_fork_for_investigation"
      | "third_anomaly_abort_without_reversible_action"
      | "manual_review_requested";
    requiresHumanApproval: boolean;
    evidenceStatus: "referenced" | "missing";
    evidenceRefs: string[];
    checkpointRef?: string;
    summary: string;
  };
}) {
  const rawEvidenceRefs = overrides.rawEvidenceRefs ?? ["execution-observation:o1"];

  return {
    packetId: "packet:test",
    taskId: "recovery-task",
    trigger: overrides.trigger ?? "third_anomaly" as const,
    currentState: createState(),
    rawEvidenceRefs,
    conflictingSignals: [],
    availableActions: overrides.availableActions ?? ["resume", "rollback", "abort", "fork"],
    recoveryRecommendation: overrides.recoveryRecommendation ?? {
      action: "fork" as const,
      reasonCode: "third_anomaly_fork_for_investigation" as const,
      requiresHumanApproval: true,
      evidenceStatus: rawEvidenceRefs.length > 0 ? "referenced" as const : "missing" as const,
      evidenceRefs: rawEvidenceRefs,
      summary: "fork for investigation"
    },
    probabilityPredictionAllowed: false as const,
    createdAt: "2026-04-27T00:04:00.000Z"
  };
}
