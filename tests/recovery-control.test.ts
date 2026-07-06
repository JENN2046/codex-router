import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  authorizeGovernanceOperatorActionHostExecutorReview,
  createArbitrationPacket,
  createFileGovernanceOperatorActionReceiptStore,
  createGovernanceOperatorActionEnvelope,
  createGovernanceOperatorActionReceipt,
  createGovernanceOperatorActionReceiptId,
  createGovernanceOperatorActionRef,
  createInMemoryGovernanceOperatorActionReceiptStore,
  dispatchGovernanceOperatorActionHostExecutor,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
  GovernanceOperatorEvidenceResolutionEntrySchema,
  GovernanceOperatorActionEnvelopeSchema,
  GovernanceOperatorActionExecutionGateResultSchema,
  GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema,
  GovernanceOperatorActionReceiptSchema,
  hashGovernanceOperatorActionEnvelope,
  hashGovernanceOperatorActionAgentExecutorAdapterDescriptor,
  hashGovernanceOperatorActionExecutionPlan,
  hashGovernanceOperatorActionHostExecutorDescriptor,
  planGovernanceOperatorActionExecution,
  resolveGovernanceOperatorActionEvidence,
  reviewGovernanceOperatorActionAgentExecutorAdapterReadiness,
  GovernanceOperatorActionSummarySchema,
  RecoveryOperatorActionSchema,
  parseArbitrationPacket,
  shouldLockdown,
  summarizeGovernanceOperatorActionEnvelope,
  validateAndConsumeGovernanceOperatorActionReceipt,
  validateGovernanceOperatorActionReceipt,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionExecutionGateResult,
  type GovernanceOperatorActionAgentExecutorAdapterDescriptorInput,
  type GovernanceOperatorActionHostExecutorDispatchAuditEvent,
  type GovernanceOperatorActionHostExecutorDispatchInvocation,
  type GovernanceOperatorActionHostExecutorAuthorizationResult,
  type GovernanceOperatorActionHostExecutorDescriptorInput,
  type GovernanceOperatorActionReceiptInput,
  type GovernanceOperatorActionReceiptStore
} from "../packages/governance-internal-recovery-control/src/index.js";
import type { GovernanceState } from "../packages/governance-internal-state-manager/src/index.js";
import { InMemoryArtifactStore } from "../packages/artifact-store/src/index.js";
import {
  createExecutionObservationRef,
  createRecordingExecutionObservationStore
} from "../packages/governance-internal-execution-observation/src/index.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const execFileAsync = promisify(execFile);

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

test("recovery control accepts a valid operator action envelope", () => {
  const action = RecoveryOperatorActionSchema.parse(createOperatorActionInput());

  assert.equal(action.schemaVersion, "recovery-operator-action.v1");
  assert.equal(action.trigger, "third_anomaly");
  assert.equal(action.recommendedAction, "fork");
  assert.equal(action.reasonCode, "third_anomaly_fork_for_investigation");
  assert.equal(action.requiresHumanApproval, true);
});

test("recovery control creates host-consumable operator action envelopes", () => {
  const action = RecoveryOperatorActionSchema.parse(createOperatorActionInput({
    evidenceRefs: [
      "execution-observation:o1",
      "artifact:provider-runner-third-failure-report"
    ]
  }));
  const envelope = createGovernanceOperatorActionEnvelope({
    source: "desktop_live_governance",
    operatorAction: action
  });

  assert.deepEqual(envelope, {
    schemaVersion: "governance-operator-action-envelope.v1",
    source: "desktop_live_governance",
    taskId: "recovery-task",
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "fork",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [
      "governance_step_back_triggered",
      "arbitration_required"
    ],
    evidenceRefs: [
      "execution-observation:o1",
      "artifact:provider-runner-third-failure-report"
    ],
    artifactRefs: ["artifact:provider-runner-third-failure-report"]
  });
  assert.deepEqual(summarizeGovernanceOperatorActionEnvelope(envelope), {
    schemaVersion: "governance-operator-action-summary.v1",
    present: true,
    source: "desktop_live_governance",
    taskId: "recovery-task",
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "fork",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [
      "governance_step_back_triggered",
      "arbitration_required"
    ],
    evidenceRefs: [
      "execution-observation:o1",
      "artifact:provider-runner-third-failure-report"
    ],
    artifactRefs: ["artifact:provider-runner-third-failure-report"]
  });
});

test("recovery control preserves rollback checkpoint targets in operator action envelopes", () => {
  const checkpointRef = "checkpoint:recovery-task:latest";
  const action = RecoveryOperatorActionSchema.parse(createOperatorActionInput({
    recommendedAction: "rollback",
    reasonCode: "third_anomaly_rollback_to_checkpoint",
    checkpointRef
  }));
  const envelope = createGovernanceOperatorActionEnvelope({
    source: "desktop_live_governance",
    operatorAction: action
  });

  assert.equal(envelope?.checkpointRef, checkpointRef);
  assert.equal(summarizeGovernanceOperatorActionEnvelope(envelope).checkpointRef, checkpointRef);
});

test("recovery control validates operator action receipts against the action ref", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const actionRef = createGovernanceOperatorActionRef(envelope, { actionIssuedAt });
  const envelopeHash = hashGovernanceOperatorActionEnvelope(envelope);
  const receiptWithoutId = {
    taskId: "recovery-task",
    actionRef,
    envelopeHash,
    actionIssuedAt,
    decision: "consumed" as const,
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-27T00:05:00.000Z",
    evidenceRefs: ["execution-observation:o1"]
  };
  const receipt = GovernanceOperatorActionReceiptSchema.parse({
    receiptId: createGovernanceOperatorActionReceiptId(receiptWithoutId),
    ...receiptWithoutId
  });

  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "passed");
  assert.deepEqual(validation.reasons, []);
  assert.equal(validation.taskId, "recovery-task");
  assert.equal(validation.actionRef, actionRef);
  assert.equal(validation.envelopeHash, envelopeHash);
});

test("recovery control creates bound operator action receipts", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const createdAt = "2026-04-27T00:05:00.000Z";

  const receipt = createGovernanceOperatorActionReceipt({
    envelope,
    actionIssuedAt,
    createdAt,
    decision: "consumed",
    operatorIdHash: "a".repeat(64)
  });
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(receipt.taskId, envelope.taskId);
  assert.equal(receipt.actionRef, createGovernanceOperatorActionRef(envelope, {
    actionIssuedAt
  }));
  assert.equal(receipt.envelopeHash, hashGovernanceOperatorActionEnvelope(envelope));
  assert.deepEqual(receipt.evidenceRefs, envelope.evidenceRefs);
  assert.equal(validation.status, "passed");
  assert.deepEqual(validation.reasons, []);
});

test("recovery control normalizes default receipt evidence refs before hashing", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const envelopeHash = hashGovernanceOperatorActionEnvelope(envelope);
  const receiptWithoutEvidenceRefs = {
    taskId: envelope.taskId,
    actionRef: createGovernanceOperatorActionRef(envelope, { actionIssuedAt }),
    envelopeHash,
    actionIssuedAt,
    decision: "consumed" as const,
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-27T00:05:00.000Z"
  };
  const receipt = GovernanceOperatorActionReceiptSchema.parse({
    receiptId: createGovernanceOperatorActionReceiptId(receiptWithoutEvidenceRefs),
    ...receiptWithoutEvidenceRefs
  });

  assert.deepEqual(receipt.evidenceRefs, []);

  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "passed");
  assert.deepEqual(validation.reasons, []);
});

test("recovery control blocks operator action receipts for the wrong task", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      actionIssuedAt,
      taskId: "other-task"
    }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_task_mismatch"));
});

test("recovery control blocks fresh receipts for stale operator actions", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:00:00.000Z";
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      actionIssuedAt,
      createdAt: "2026-04-27T00:05:00.000Z"
    }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_action_expired"));
});

test("recovery control fails closed for invalid operator action max age", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:00:00.000Z";

  for (const maxActionAgeMs of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1
  ]) {
    const validation = validateGovernanceOperatorActionReceipt({
      envelope,
      receipt: createTestOperatorActionReceipt(envelope, {
        actionIssuedAt,
        createdAt: "2026-04-27T00:05:00.000Z"
      }),
      actionIssuedAt,
      now: "2026-04-27T00:05:30.000Z",
      maxActionAgeMs
    });

    assert.equal(validation.status, "blocked");
    assert.ok(validation.reasons.includes(
      "operator_action_receipt_max_action_age_invalid"
    ));
  }
});

test("recovery control blocks receipts dated before the operator action", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      actionIssuedAt,
      createdAt: "2026-04-27T00:04:44.999Z"
    }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes(
    "operator_action_receipt_created_at_before_action_issued_at"
  ));
});

test("recovery control blocks replayed operator action receipts", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const actionRef = createGovernanceOperatorActionRef(envelope, { actionIssuedAt });
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, { actionIssuedAt }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000,
    consumedActionRefs: [actionRef]
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_replay"));
});

test("recovery control blocks replayed operator action receipt ids", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000,
    consumedReceiptIds: [receipt.receiptId]
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_replay"));
});

test("recovery control requires trusted operator action issued-at for receipt validation", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, { actionIssuedAt }),
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes(
    "operator_action_receipt_action_issued_at_required"
  ));
});

test("recovery control requires lockdown operator actions to be resolved explicitly", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      actionIssuedAt,
      decision: "acknowledged"
    }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes(
    "operator_action_receipt_lockdown_requires_resolution"
  ));
});

test("recovery control fails closed for malformed operator action receipts", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: {
      taskId: "recovery-task",
      actionRef: createGovernanceOperatorActionRef(envelope, { actionIssuedAt }),
      decision: "consumed",
      operatorIdHash: "not-a-hash",
      createdAt: "2026-04-27T00:05:00.000Z"
    },
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.deepEqual(validation.reasons, ["operator_action_receipt_invalid"]);
});

test("recovery control blocks operator action receipts with mismatched action refs", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      actionIssuedAt,
      actionRef: "governance-operator-action:".concat("b".repeat(64))
    }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_action_ref_mismatch"));
});

test("recovery control consumes operator action receipts once in memory", async () => {
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });

  const first = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(first.status, "passed");
  assert.deepEqual(first.reasons, []);
  assert.equal((await store.getReceipt(receipt.receiptId))?.receiptId, receipt.receiptId);

  const replay = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:31.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(replay.status, "blocked");
  assert.deepEqual(replay.reasons, ["operator_action_receipt_replay"]);
  assert.equal(replay.validation.status, "blocked");
});

test("recovery control persists operator action receipts in a file store", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-"));
  const store = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });

  const consumed = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "passed");

  const reloadedStore = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });
  assert.equal((await reloadedStore.getReceipt(receipt.receiptId))?.receiptId, receipt.receiptId);
  assert.deepEqual(
    (await reloadedStore.findByTaskId("recovery-task")).map((item) => item.receiptId),
    [receipt.receiptId]
  );

  const replay = await validateAndConsumeGovernanceOperatorActionReceipt({
    store: reloadedStore,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:31.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(replay.status, "blocked");
  assert.deepEqual(replay.reasons, ["operator_action_receipt_replay"]);
});

test("recovery control file receipt store keeps sanitized task paths task-scoped", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-scope-"));
  const store = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });
  const receiptA = createStandaloneOperatorActionReceipt({
    taskId: "task:1",
    actionRef: "governance-operator-action:task-a",
    createdAt: "2026-04-27T00:05:00.000Z"
  });
  const receiptB = createStandaloneOperatorActionReceipt({
    taskId: "task_1",
    actionRef: "governance-operator-action:task-b",
    createdAt: "2026-04-27T00:05:01.000Z"
  });

  await store.consume(receiptA);
  await store.consume(receiptB);

  assert.deepEqual(
    (await store.findByTaskId("task:1")).map((receipt) => receipt.receiptId),
    [receiptA.receiptId]
  );
  assert.deepEqual(
    (await store.findByTaskId("task_1")).map((receipt) => receipt.receiptId),
    [receiptB.receiptId]
  );
});

test("recovery control file receipt store maps long task ids to bounded file names", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-long-task-"));
  const store = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });
  const longTaskId = "task-".padEnd(360, "a");
  const receipt = createStandaloneOperatorActionReceipt({
    taskId: longTaskId,
    actionRef: "governance-operator-action:long-task",
    createdAt: "2026-04-27T00:05:00.000Z"
  });

  const result = await store.consume(receipt);

  assert.equal(result.status, "stored");
  assert.deepEqual(
    (await store.findByTaskId(longTaskId)).map((item) => item.receiptId),
    [receipt.receiptId]
  );
  assert.equal((await store.loadAll())[0]?.taskId, longTaskId);
  const fileNames = (await readdir(dir))
    .filter((fileName) => fileName.endsWith(".jsonl"));
  assert.equal(fileNames.length, 1);
  assert.match(fileNames[0]!, /^task-[a-f0-9]{64}\.jsonl$/);
});

test("recovery control file receipt store serializes concurrent consume attempts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-race-"));
  const store = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });

  const results = await Promise.all([
    store.consume(receipt),
    store.consume(receipt)
  ]);

  assert.deepEqual(
    results.map((result) => result.status).sort(),
    ["replay", "stored"]
  );
  assert.deepEqual(
    (await store.loadAll()).map((item) => item.receiptId),
    [receipt.receiptId]
  );
});

test("recovery control file receipt store serializes concurrent consume attempts across instances", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-cross-instance-"));
  const stores = Array.from({ length: 8 }, () =>
    createFileGovernanceOperatorActionReceiptStore({ basePath: dir })
  );
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });

  const results = await Promise.all(
    stores.map((store) => store.consume(receipt))
  );

  assert.equal(
    results.filter((result) => result.status === "stored").length,
    1
  );
  assert.equal(
    results.filter((result) => result.status === "replay").length,
    stores.length - 1
  );
  assert.deepEqual(
    (await stores[0]!.loadAll()).map((item) => item.receiptId),
    [receipt.receiptId]
  );
});

test("recovery control file receipt store serializes concurrent consume attempts across processes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-cross-process-"));
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });
  const childScript = `
    import { createFileGovernanceOperatorActionReceiptStore } from "./packages/governance-internal-recovery-control/src/index.js";

    const basePath = process.env.RECEIPT_STORE_BASE_PATH;
    const receiptJson = process.env.RECEIPT_JSON;
    if (basePath === undefined || receiptJson === undefined) {
      throw new Error("missing_receipt_store_test_input");
    }

    const store = createFileGovernanceOperatorActionReceiptStore({ basePath });
    const result = await store.consume(JSON.parse(receiptJson));
    console.log(JSON.stringify({ status: result.status }));
  `;

  const results = await Promise.all(
    Array.from({ length: 4 }, async () => {
      const { stdout } = await execFileAsync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", childScript],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            RECEIPT_JSON: JSON.stringify(receipt),
            RECEIPT_STORE_BASE_PATH: dir
          }
        }
      );
      return JSON.parse(stdout.trim()) as { status: "stored" | "replay" };
    })
  );
  const store = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });

  assert.equal(
    results.filter((result) => result.status === "stored").length,
    1
  );
  assert.equal(
    results.filter((result) => result.status === "replay").length,
    results.length - 1
  );
  assert.deepEqual(
    (await store.loadAll()).map((item) => item.receiptId),
    [receipt.receiptId]
  );
});

test("recovery control file receipt store reclaims stale consume locks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-stale-lock-"));
  const lockPath = join(dir, ".consume.lock");
  await mkdir(lockPath);
  const staleTimestamp = new Date(Date.now() - 60_000);
  await utimes(lockPath, staleTimestamp, staleTimestamp);
  const store = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });

  const result = await store.consume(receipt);

  assert.equal(result.status, "stored");
  assert.deepEqual(
    (await store.loadAll()).map((item) => item.receiptId),
    [receipt.receiptId]
  );
  assert.equal((await readdir(dir)).includes(".consume.lock"), false);
});

test("recovery control does not store invalid operator action receipts", async () => {
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";

  const consumed = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      actionIssuedAt,
      taskId: "other-task"
    }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "blocked");
  assert.ok(consumed.reasons.includes("operator_action_receipt_task_mismatch"));
  assert.deepEqual(await store.loadAll(), []);
});

test("recovery control fails closed when receipt store records are malformed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-bad-"));
  await writeFile(join(dir, "recovery-task.jsonl"), "{\"not\":\"a receipt\"}\n", "utf8");
  const store = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";

  const consumed = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, { actionIssuedAt }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "blocked");
  assert.deepEqual(consumed.reasons, ["operator_action_receipt_store_failed"]);
});

test("recovery control fails closed when receipt store records have stale ids", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-operator-receipts-stale-"));
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const storedReceipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });
  await writeFile(
    join(dir, "recovery-task.jsonl"),
    `${JSON.stringify({ ...storedReceipt, receiptId: "stale-receipt-id" })}\n`,
    "utf8"
  );
  const store = createFileGovernanceOperatorActionReceiptStore({ basePath: dir });

  const consumed = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, { actionIssuedAt }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "blocked");
  assert.deepEqual(consumed.reasons, ["operator_action_receipt_store_failed"]);
});

test("recovery control fails closed when injected receipt stores return malformed consume results", async () => {
  const store: GovernanceOperatorActionReceiptStore = {
    async consume() {
      return {} as never;
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
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";

  const consumed = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, { actionIssuedAt }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "blocked");
  assert.deepEqual(consumed.reasons, ["operator_action_receipt_store_failed"]);
});

test("recovery control fails closed when injected receipt stores consume a different receipt", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const requestedReceipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });
  const otherReceipt = createTestOperatorActionReceipt(envelope, {
    actionIssuedAt,
    createdAt: "2026-04-27T00:05:01.000Z"
  });
  const store: GovernanceOperatorActionReceiptStore = {
    async consume() {
      return {
        status: "stored",
        receipt: otherReceipt,
        existingReceiptIds: [],
        existingActionRefs: []
      };
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

  const consumed = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: requestedReceipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "blocked");
  assert.deepEqual(consumed.reasons, ["operator_action_receipt_store_failed"]);
});

test("recovery control fails closed when injected receipt stores alter persisted receipt content", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const requestedReceipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });
  const alteredReceipt = {
    ...requestedReceipt,
    taskId: "other-task",
    decision: "deferred" as const,
    envelopeHash: "b".repeat(64)
  };
  const store: GovernanceOperatorActionReceiptStore = {
    async consume() {
      return {
        status: "stored",
        receipt: alteredReceipt,
        existingReceiptIds: [],
        existingActionRefs: []
      };
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

  const consumed = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: requestedReceipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "blocked");
  assert.deepEqual(consumed.reasons, ["operator_action_receipt_store_failed"]);
});

test("recovery control fails closed when stored receipt results include replay evidence", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const requestedReceipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });
  const store: GovernanceOperatorActionReceiptStore = {
    async consume() {
      return {
        status: "stored",
        receipt: requestedReceipt,
        existingReceiptIds: [requestedReceipt.receiptId],
        existingActionRefs: [requestedReceipt.actionRef]
      };
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

  const consumed = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: requestedReceipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });

  assert.equal(consumed.status, "blocked");
  assert.deepEqual(consumed.reasons, ["operator_action_receipt_store_failed"]);
});

test("recovery control plans operator actions only after durable receipt consumption", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "planned");
  assert.deepEqual(gate.reasons, []);
  assert.equal(gate.taskId, "recovery-task");
  assert.equal(gate.recommendedAction, "fork");
  assert.equal(gate.plan?.executionMode, "plan_only");
  assert.equal(gate.plan?.recommendedAction, "fork");
  assert.match(gate.plan?.operatorInstruction ?? "", /Plan-only gate accepted fork/);
});

test("recovery control blocks forged durable receipt consumption without store proof", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });
  assert.equal(validation.status, "passed");

  const forgedConsumption = {
    schemaVersion: "governance-operator-action-receipt-consumption.v1",
    status: "passed" as const,
    durable: true,
    reasons: [],
    validation,
    taskId: validation.taskId,
    actionRef: validation.actionRef,
    envelopeHash: validation.envelopeHash,
    receipt
  };

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: forgedConsumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, forgedConsumption, {
      actionIssuedAt
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes(
    "operator_action_executor_receipt_consumption_store_proof_missing"
  ));
  assert.equal(gate.plan, undefined);
});

test("recovery control preserves rollback checkpoint targets in execution plans", async () => {
  const checkpointRef = "checkpoint:recovery-task:latest";
  const action = RecoveryOperatorActionSchema.parse(createOperatorActionInput({
    recommendedAction: "rollback",
    reasonCode: "third_anomaly_rollback_to_checkpoint",
    checkpointRef
  }));
  const envelope = createGovernanceOperatorActionEnvelope({
    source: "execution_governance",
    operatorAction: action
  });
  assert.ok(envelope);
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt
    }),
    allowedActions: ["rollback"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "planned");
  assert.equal(gate.recommendedAction, "rollback");
  assert.equal(gate.checkpointRef, checkpointRef);
  assert.equal(gate.plan?.recommendedAction, "rollback");
  assert.equal(gate.plan?.checkpointRef, checkpointRef);
});

test("recovery control rejects planned gate results whose top-level fields drift from the plan", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "planned");
  const parsed = GovernanceOperatorActionExecutionGateResultSchema.safeParse({
    ...gate,
    taskId: "other-task",
    actionRef: "other-action-ref",
    receiptId: "other-receipt",
    envelopeHash: "0".repeat(64),
    recommendedAction: "resume",
    executionMode: undefined
  });

  assert.equal(parsed.success, false);
  assert.deepEqual(
    parsed.error.issues.map((issue) => issue.message).sort(),
    [
      "operator_action_execution_gate_action_ref_plan_mismatch",
      "operator_action_execution_gate_envelope_hash_plan_mismatch",
      "operator_action_execution_gate_execution_mode_plan_mismatch",
      "operator_action_execution_gate_receipt_plan_mismatch",
      "operator_action_execution_gate_recommended_action_plan_mismatch",
      "operator_action_execution_gate_task_plan_mismatch"
    ].sort()
  );
});

test("recovery control preserves rollback checkpoint targets in blocked gate results", () => {
  const checkpointRef = "checkpoint:recovery-task:latest";
  const action = RecoveryOperatorActionSchema.parse(createOperatorActionInput({
    recommendedAction: "rollback",
    reasonCode: "third_anomaly_rollback_to_checkpoint",
    checkpointRef
  }));
  const envelope = createGovernanceOperatorActionEnvelope({
    source: "execution_governance",
    operatorAction: action
  });
  assert.ok(envelope);

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    lifecycleState: {
      schemaVersion: "desktop-operator-action-lifecycle.v1",
      status: "action_available",
      operatorActionPresent: true,
      envelope
    },
    allowedActions: ["rollback"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.equal(gate.recommendedAction, "rollback");
  assert.equal(gate.checkpointRef, checkpointRef);
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_consumption_required"));
});

test("recovery control blocks operator action planning without consumed receipts", () => {
  const envelope = createTestOperatorActionEnvelope();

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    lifecycleState: {
      schemaVersion: "desktop-operator-action-lifecycle.v1",
      status: "action_available",
      operatorActionPresent: true,
      envelope
    },
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_consumption_required"));
  assert.ok(gate.reasons.includes("operator_action_executor_lifecycle_not_consumed"));
});

test("recovery control blocks operator action planning for non-durable receipts", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, { actionIssuedAt }),
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });
  const consumption = {
    schemaVersion: "desktop-operator-action-receipt-consumption.v1",
    status: "not_consumed" as const,
    durable: false,
    reasons: ["operator_action_receipt_store_missing"],
    validation,
    taskId: validation.taskId,
    actionRef: validation.actionRef,
    envelopeHash: validation.envelopeHash,
    receipt: validation.receipt
  };

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt,
      status: "receipt_not_consumed"
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_not_durable"));
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_not_consumed"));
});

test("recovery control blocks operator action planning for task/action/hash drift", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const driftedConsumption = {
    ...consumption,
    taskId: "other-task",
    actionRef: "governance-operator-action:other-action",
    envelopeHash: "b".repeat(64)
  };

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: driftedConsumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, driftedConsumption, {
      actionIssuedAt
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_consumption_task_mismatch"));
  assert.ok(gate.reasons.includes("operator_action_executor_consumption_action_ref_mismatch"));
  assert.ok(gate.reasons.includes("operator_action_executor_consumption_envelope_hash_mismatch"));
});

test("recovery control blocks operator action planning for unbound durable receipts", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receiptWithoutId = {
    taskId: envelope.taskId,
    actionRef: "governance-operator-action:unbound-receipt",
    actionIssuedAt,
    decision: "consumed" as const,
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-27T00:05:00.000Z",
    evidenceRefs: [...envelope.evidenceRefs]
  };
  const receipt = GovernanceOperatorActionReceiptSchema.parse({
    receiptId: createGovernanceOperatorActionReceiptId(receiptWithoutId),
    ...receiptWithoutId
  });
  const consumption = {
    schemaVersion: "desktop-operator-action-receipt-consumption.v1",
    status: "passed" as const,
    durable: true,
    reasons: [],
    validation: {
      schemaVersion: "governance-operator-action-receipt-validation.v1" as const,
      status: "passed" as const,
      reasons: [],
      taskId: envelope.taskId,
      receipt
    },
    taskId: envelope.taskId,
    receipt
  };

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_action_ref_mismatch"));
  assert.ok(gate.reasons.includes("operator_action_executor_consumption_action_ref_mismatch"));
  assert.ok(gate.reasons.includes("operator_action_executor_validation_action_ref_mismatch"));
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_envelope_hash_mismatch"));
  assert.ok(gate.reasons.includes("operator_action_executor_consumption_envelope_hash_mismatch"));
  assert.ok(gate.reasons.includes("operator_action_executor_validation_envelope_hash_mismatch"));
});

test("recovery control blocks operator action planning for replayed receipts", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const receipt = createTestOperatorActionReceipt(envelope, { actionIssuedAt });
  await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });
  const replay = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-04-27T00:05:31.000Z",
    maxActionAgeMs: 60_000
  });

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: replay,
    lifecycleState: createTestOperatorActionLifecycle(envelope, replay, {
      actionIssuedAt,
      status: "receipt_blocked"
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_replay"));
});

test("recovery control blocks operator action planning for expired receipts", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const expired = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, { actionIssuedAt }),
    actionIssuedAt,
    now: "2026-04-27T00:10:00.000Z",
    maxActionAgeMs: 1
  });

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: expired,
    lifecycleState: createTestOperatorActionLifecycle(envelope, expired, {
      actionIssuedAt,
      status: "receipt_blocked"
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_expired"));
});

test("recovery control blocks operator action planning when lockdown is unresolved", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const receipt = createTestOperatorActionReceipt(envelope, {
    actionIssuedAt,
    decision: "acknowledged"
  });
  const consumption = {
    schemaVersion: "governance-operator-action-receipt-consumption.v1",
    status: "passed" as const,
    reasons: [],
    validation: {
      schemaVersion: "governance-operator-action-receipt-validation.v1" as const,
      status: "passed" as const,
      reasons: [],
      taskId: envelope.taskId,
      actionRef: receipt.actionRef,
      envelopeHash: hashGovernanceOperatorActionEnvelope(envelope),
      receipt
    },
    taskId: envelope.taskId,
    actionRef: receipt.actionRef,
    envelopeHash: hashGovernanceOperatorActionEnvelope(envelope),
    receipt
  };

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_receipt_decision_not_consumed"));
  assert.ok(gate.reasons.includes("operator_action_executor_lockdown_resolution_required"));
});

test("recovery control blocks operator action planning outside the action allowlist", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt
    }),
    allowedActions: ["resume"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_action_not_allowed"));
});

test("recovery control blocks operator action planning outside plan-only mode", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt
    }),
    allowedActions: ["fork"],
    executionMode: "execute"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_mode_not_plan_only"));
  assert.equal(gate.plan, undefined);
});

test("recovery control blocks operator action planning when lifecycle has not consumed the receipt", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt,
      status: "receipt_created"
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_lifecycle_not_consumed"));
});

test("recovery control blocks operator action planning when lifecycle receipt drifts", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const driftedLifecycleConsumption = {
    ...consumption,
    durable: false
  };

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(
      envelope,
      driftedLifecycleConsumption,
      { actionIssuedAt }
    ),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.reasons.includes("operator_action_executor_lifecycle_receipt_mismatch"));
});

test("recovery control blocks operator action planning when lifecycle issuance time drifts", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });

  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState: createTestOperatorActionLifecycle(envelope, consumption, {
      actionIssuedAt: "2026-04-27T00:06:00.000Z"
    }),
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });

  assert.equal(gate.status, "blocked");
  assert.ok(
    gate.reasons.includes("operator_action_executor_lifecycle_action_issued_at_mismatch")
  );
});

test("recovery control authorizes non-executing host executor review after planned gate binding", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);

  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });

  assert.equal(authorization.status, "ready_for_host_executor_review");
  assert.deepEqual(authorization.reasons, []);
  assert.equal(authorization.executionMode, "plan_only");
  assert.equal(authorization.taskId, gate.taskId);
  assert.equal(authorization.actionRef, gate.actionRef);
  assert.equal(authorization.receiptId, gate.receiptId);
  assert.equal(authorization.executionPlanHash, packet.executionPlanHash);
  assert.equal(authorization.hostExecutorDescriptorId, descriptor.descriptorId);
  assert.equal(authorization.hostExecutorDescriptorHash, packet.hostExecutorDescriptorHash);
  assert.match(authorization.operatorInstruction ?? "", /Non-executing host executor review/);
});

test("recovery control blocks host executor review when authorization packet bindings drift", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor, {
    taskId: "other-task",
    executionPlanHash: "0".repeat(64),
    hostExecutorDescriptorHash: "1".repeat(64)
  });

  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });

  assert.equal(authorization.status, "blocked");
  assert.ok(authorization.reasons.includes(
    "operator_action_host_executor_packet_task_mismatch"
  ));
  assert.ok(authorization.reasons.includes(
    "operator_action_host_executor_packet_plan_hash_mismatch"
  ));
  assert.ok(authorization.reasons.includes(
    "operator_action_host_executor_packet_descriptor_hash_mismatch"
  ));
});

test("recovery control blocks host executor review for unsupported descriptor actions", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["resume"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);

  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });

  assert.equal(authorization.status, "blocked");
  assert.ok(authorization.reasons.includes(
    "operator_action_host_executor_action_not_supported"
  ));
});

test("recovery control blocks host executor review for forged lifecycle consumption", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const forgedLifecycleState = createTestOperatorActionLifecycle(
    envelope,
    JSON.parse(JSON.stringify(consumption)) as unknown,
    { actionIssuedAt }
  );
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);

  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState: forgedLifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });

  assert.equal(authorization.status, "blocked");
  assert.ok(authorization.reasons.includes(
    "operator_action_host_executor_receipt_consumption_store_proof_missing"
  ));
});

test("recovery control blocks host executor review with unsafe authorization evidence refs", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor, {
    evidenceRefs: ["raw\nstdout"]
  });

  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });

  assert.equal(authorization.status, "blocked");
  assert.ok(authorization.reasons.includes(
    "operator_action_host_executor_authorization_packet_invalid"
  ));
});

test("recovery control accepts review-only agent executor adapter readiness", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const hostDescriptor = createTestHostExecutorDescriptor(["fork"]);
  const hostPacket = createTestHostExecutorAuthorizationPacket(gate, hostDescriptor);
  const hostAuthorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor
  });
  const adapterDescriptor = createTestAgentExecutorAdapterDescriptor(hostDescriptor, ["fork"]);
  const adapterPacket = createTestAgentExecutorAdapterReviewPacket(
    gate,
    hostAuthorization,
    adapterDescriptor
  );

  const readiness = reviewGovernanceOperatorActionAgentExecutorAdapterReadiness({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor,
    hostExecutorAuthorization: hostAuthorization,
    adapterDescriptor,
    adapterReviewPacket: adapterPacket
  });

  assert.equal(readiness.status, "ready_for_agent_executor_adapter_review");
  assert.deepEqual(readiness.reasons, []);
  assert.equal(
    readiness.approvalString,
    GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL
  );
  assert.equal(readiness.executionBoundary, "review_only");
  assert.equal(readiness.invocationSupported, false);
  assert.equal(readiness.adapterId, adapterDescriptor.adapterId);
  assert.equal(readiness.adapterKind, "sub_agent_adapter");
  assert.equal(readiness.hostExecutorDescriptorId, hostDescriptor.descriptorId);
  assert.equal(
    readiness.adapterDescriptorHash,
    hashGovernanceOperatorActionAgentExecutorAdapterDescriptor(adapterDescriptor)
  );
  assert.ok(readiness.evidenceRefs.includes("evidence:phase15-adapter-descriptor"));
  assert.ok(readiness.evidenceRefs.includes("evidence:phase15-adapter-review"));
  assert.match(readiness.operatorInstruction ?? "", /no Codex CLI/);
  assert.match(readiness.operatorInstruction ?? "", /was invoked/);
});

test("recovery control blocks review-only agent executor adapter with wrong approval string", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const hostDescriptor = createTestHostExecutorDescriptor(["fork"]);
  const hostPacket = createTestHostExecutorAuthorizationPacket(gate, hostDescriptor);
  const hostAuthorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor
  });
  const adapterDescriptor = createTestAgentExecutorAdapterDescriptor(hostDescriptor, ["fork"]);
  const adapterPacket = createTestAgentExecutorAdapterReviewPacket(
    gate,
    hostAuthorization,
    adapterDescriptor,
    {
      approvalString: "APPROVE_PHASE_15_REAL_AGENT_EXECUTOR_INVOCATION"
    }
  );

  const readiness = reviewGovernanceOperatorActionAgentExecutorAdapterReadiness({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor,
    hostExecutorAuthorization: hostAuthorization,
    adapterDescriptor,
    adapterReviewPacket: adapterPacket
  });

  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.reasons.includes(
    "operator_action_agent_executor_adapter_review_packet_invalid"
  ));
});

test("recovery control blocks agent executor adapter descriptors that claim invocation support", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const hostDescriptor = createTestHostExecutorDescriptor(["fork"]);
  const hostPacket = createTestHostExecutorAuthorizationPacket(gate, hostDescriptor);
  const hostAuthorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor
  });
  const validAdapterDescriptor = createTestAgentExecutorAdapterDescriptor(
    hostDescriptor,
    ["fork"]
  );
  const adapterDescriptor = {
    ...validAdapterDescriptor,
    invocationSupported: true
  };
  const adapterPacket = createTestAgentExecutorAdapterReviewPacket(
    gate,
    hostAuthorization,
    validAdapterDescriptor
  );

  const readiness = reviewGovernanceOperatorActionAgentExecutorAdapterReadiness({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor,
    hostExecutorAuthorization: hostAuthorization,
    adapterDescriptor,
    adapterReviewPacket: adapterPacket
  });

  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.reasons.includes(
    "operator_action_agent_executor_adapter_descriptor_invalid"
  ));
});

test("recovery control blocks agent executor adapter descriptor hash drift", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const hostDescriptor = createTestHostExecutorDescriptor(["fork"]);
  const hostPacket = createTestHostExecutorAuthorizationPacket(gate, hostDescriptor);
  const hostAuthorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor
  });
  const adapterDescriptor = createTestAgentExecutorAdapterDescriptor(hostDescriptor, ["fork"]);
  const adapterPacket = createTestAgentExecutorAdapterReviewPacket(
    gate,
    hostAuthorization,
    adapterDescriptor,
    {
      adapterDescriptorHash: "0".repeat(64)
    }
  );

  const readiness = reviewGovernanceOperatorActionAgentExecutorAdapterReadiness({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor,
    hostExecutorAuthorization: hostAuthorization,
    adapterDescriptor,
    adapterReviewPacket: adapterPacket
  });

  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.reasons.includes(
    "operator_action_agent_executor_adapter_packet_descriptor_hash_mismatch"
  ));
});

test("recovery control blocks agent executor adapter descriptors without action support", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const hostDescriptor = createTestHostExecutorDescriptor(["fork"]);
  const hostPacket = createTestHostExecutorAuthorizationPacket(gate, hostDescriptor);
  const hostAuthorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor
  });
  const adapterDescriptor = createTestAgentExecutorAdapterDescriptor(hostDescriptor, [
    "resume"
  ]);
  const adapterPacket = createTestAgentExecutorAdapterReviewPacket(
    gate,
    hostAuthorization,
    adapterDescriptor
  );

  const readiness = reviewGovernanceOperatorActionAgentExecutorAdapterReadiness({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: hostPacket,
    hostExecutorDescriptor: hostDescriptor,
    hostExecutorAuthorization: hostAuthorization,
    adapterDescriptor,
    adapterReviewPacket: adapterPacket
  });

  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.reasons.includes(
    "operator_action_agent_executor_adapter_action_not_supported"
  ));
});

test("recovery control prepares host executor dispatch in dry-run without calling an executor", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });
  let executorCalls = 0;

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    executionGate: gate,
    lifecycleState,
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

  assert.equal(dispatch.status, "dry_run_ready");
  assert.deepEqual(dispatch.reasons, []);
  assert.equal(dispatch.dispatchMode, "dry_run");
  assert.equal(dispatch.taskId, gate.taskId);
  assert.equal(dispatch.actionRef, gate.actionRef);
  assert.equal(dispatch.executionPlanHash, packet.executionPlanHash);
  assert.equal(executorCalls, 0);
});

test("recovery control dispatches only through the injected host executor with audit records", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });
  const invocations: GovernanceOperatorActionHostExecutorDispatchInvocation[] = [];
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "execute_injected",
    executor: {
      dispatch(invocation) {
        invocations.push(invocation);
        return {
          status: "completed",
          resultRef: "artifact:phase13-dispatch-result",
          evidenceRefs: ["artifact:phase13-dispatch-result"]
        };
      }
    },
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(dispatch.status, "dispatched");
  assert.deepEqual(dispatch.reasons, []);
  assert.equal(dispatch.dispatchMode, "execute_injected");
  assert.equal(dispatch.executorResultRef, "artifact:phase13-dispatch-result");
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0]?.recommendedAction, "fork");
  assert.equal(invocations[0]?.hostExecutorDescriptorId, descriptor.descriptorId);
  assert.deepEqual(
    auditEvents.map((event) => event.status),
    ["attempting", "dispatched"]
  );
  assert.equal(auditEvents[1]?.resultRef, "artifact:phase13-dispatch-result");
});

test("recovery control preserves injected host executor receipt status", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "execute_injected",
    executor: {
      dispatch() {
        return {
          status: "refused",
          reasonCode: "phase14_agent_executor_refused",
          resultRef: "artifact:phase14-agent-refused",
          evidenceRefs: ["artifact:phase14-agent-refused"]
        };
      }
    },
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(dispatch.status, "dispatched");
  assert.equal(dispatch.executorStatus, "refused");
  assert.equal(dispatch.executorReasonCode, "phase14_agent_executor_refused");
  assert.equal(dispatch.executorResultRef, "artifact:phase14-agent-refused");
  assert.match(dispatch.operatorInstruction ?? "", /returned refused/);
  assert.deepEqual(
    auditEvents.map((event) => event.status),
    ["attempting", "dispatched"]
  );
  assert.equal(auditEvents[1]?.executorStatus, "refused");
  assert.equal(auditEvents[1]?.executorReasonCode, "phase14_agent_executor_refused");
});

test("recovery control accepts non-terminal injected host executor receipt status", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "execute_injected",
    executor: {
      dispatch() {
        return {
          status: "running",
          resultRef: "artifact:phase14-agent-running",
          evidenceRefs: ["artifact:phase14-agent-running"]
        };
      }
    },
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(dispatch.status, "dispatched");
  assert.equal(dispatch.executorStatus, "running");
  assert.equal(dispatch.executorReasonCode, undefined);
  assert.equal(auditEvents[1]?.executorStatus, "running");
});

test("recovery control rejects terminal injected host executor receipts without reason codes", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "execute_injected",
    executor: {
      dispatch() {
        return {
          status: "failed",
          resultRef: "artifact:phase14-agent-failed-without-reason",
          evidenceRefs: ["artifact:phase14-agent-failed-without-reason"]
        };
      }
    },
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(dispatch.status, "failed");
  assert.ok(dispatch.reasons.includes("operator_action_host_executor_dispatch_executor_failed"));
  assert.equal(dispatch.errorClass, "zoderror");
  assert.equal(dispatch.executorStatus, undefined);
  assert.equal(
    JSON.stringify(dispatch).includes("phase14-agent-failed-without-reason"),
    false
  );
  assert.deepEqual(
    auditEvents.map((event) => event.status),
    ["attempting", "failed"]
  );
});

test("recovery control rejects unsafe injected host executor receipt reason codes", () => {
  const parsed = GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema.safeParse({
    status: "refused",
    reasonCode: "token-secret",
    resultRef: "artifact:phase14-agent-refused",
    evidenceRefs: ["artifact:phase14-agent-refused"]
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(parsed.error.issues.some((issue) =>
      issue.message === "operator_action_host_executor_dispatch_executor_reason_code_unsafe"
    ));
  }
});

test("recovery control blocks injected host executor dispatch without an audit sink", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });
  let executorCalls = 0;

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "execute_injected",
    executor: {
      dispatch() {
        executorCalls += 1;
        return { status: "completed" };
      }
    }
  });

  assert.equal(dispatch.status, "blocked");
  assert.ok(dispatch.reasons.includes(
    "operator_action_host_executor_dispatch_audit_sink_required"
  ));
  assert.equal(executorCalls, 0);
});

test("recovery control blocks host executor dispatch when review bindings drift", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });
  let executorCalls = 0;

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: createTestHostExecutorAuthorizationPacket(gate, descriptor, {
      executionPlanHash: "0".repeat(64)
    }),
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "execute_injected",
    executor: {
      dispatch() {
        executorCalls += 1;
        return { status: "completed" };
      }
    },
    auditSink: {
      record() {}
    }
  });

  assert.equal(dispatch.status, "blocked");
  assert.ok(dispatch.reasons.includes("operator_action_host_executor_dispatch_review_not_ready"));
  assert.ok(dispatch.reasons.includes("operator_action_host_executor_packet_plan_hash_mismatch"));
  assert.equal(executorCalls, 0);
});

test("recovery control sanitizes injected host executor exceptions", async () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionIssuedAt = "2026-04-27T00:04:45.000Z";
  const consumption = await createTestOperatorActionConsumption(envelope, {
    actionIssuedAt
  });
  const lifecycleState = createTestOperatorActionLifecycle(envelope, consumption, {
    actionIssuedAt
  });
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: ["fork"],
    executionMode: "plan_only"
  });
  const descriptor = createTestHostExecutorDescriptor(["fork"]);
  const packet = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor
  });
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    executionGate: gate,
    lifecycleState,
    authorizationPacket: packet,
    hostExecutorDescriptor: descriptor,
    authorization,
    dispatchMode: "execute_injected",
    executor: {
      dispatch() {
        throw new Error("raw token should not be returned");
      }
    },
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(dispatch.status, "failed");
  assert.ok(dispatch.reasons.includes("operator_action_host_executor_dispatch_executor_failed"));
  assert.equal(dispatch.errorClass, "error");
  assert.equal(JSON.stringify(dispatch).includes("raw token"), false);
  assert.deepEqual(
    auditEvents.map((event) => event.status),
    ["attempting", "failed"]
  );
});

test("recovery control resolves operator action evidence refs without raw payloads", async () => {
  const observationStore = createRecordingExecutionObservationStore();
  const artifactStore = new InMemoryArtifactStore({
    now: () => "2026-04-27T00:05:00.000Z"
  });
  const observationRef = createExecutionObservationRef("observation-1");

  await observationStore.emit({
    observationId: "observation-1",
    taskId: "recovery-task",
    primitiveId: "provider-plan",
    stage: "execution",
    status: "failed",
    signals: {
      errorClass: "controlled_readonly_provider_failed",
      permissionBlocked: true
    },
    evidenceRef: "artifact:report-1",
    createdAt: "2026-04-27T00:04:00.000Z"
  });
  const artifact = await artifactStore.putArtifact({
    artifactId: "report-1",
    taskId: "recovery-task",
    runId: "run-1",
    type: "report",
    payload: {
      status: "failed",
      detail: "redacted"
    },
    metadata: {
      reportKind: "controlled-readonly-failure"
    },
    provenance: {
      source: "provider-execution-runner"
    }
  });

  const action = RecoveryOperatorActionSchema.parse(createOperatorActionInput({
    evidenceRefs: [observationRef, `artifact:${artifact.artifactId}`]
  }));
  const envelope = createGovernanceOperatorActionEnvelope({
    source: "execution_governance",
    operatorAction: action
  });

  assert.ok(envelope);
  const resolution = await resolveGovernanceOperatorActionEvidence({
    envelope,
    observationStore,
    artifactStore
  });

  assert.equal(resolution.schemaVersion, "governance-operator-evidence-resolution.v1");
  assert.equal(resolution.taskId, "recovery-task");
  assert.equal(resolution.resolvedCount, 2);
  assert.equal(resolution.unresolvedCount, 0);
  assert.deepEqual(
    resolution.refs.map((entry) => [entry.kind, entry.status]),
    [
      ["execution_observation", "resolved"],
      ["artifact", "resolved"]
    ]
  );
  assert.deepEqual(resolution.refs[0]?.observation, {
    observationId: "observation-1",
    taskId: "recovery-task",
    primitiveId: "provider-plan",
    stage: "execution",
    status: "failed",
    signalKeys: ["errorClass", "permissionBlocked"],
    evidenceRef: "artifact:report-1",
    createdAt: "2026-04-27T00:04:00.000Z"
  });
  assert.deepEqual(resolution.refs[1]?.artifact, {
    artifactId: "report-1",
    taskId: "recovery-task",
    runId: "run-1",
    type: "report",
    uri: "artifact://report-1/payload",
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    createdAt: "2026-04-27T00:05:00.000Z",
    metadataKeys: ["reportKind"],
    provenanceKeys: ["source"],
    verification: {
      ok: true
    }
  });
  assert.equal("payload" in (resolution.refs[1]?.artifact ?? {}), false);
});

test("recovery control marks operator action evidence unresolved without stores", async () => {
  const envelope = GovernanceOperatorActionEnvelopeSchema.parse({
    source: "execution_governance",
    taskId: "recovery-task",
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "fork",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [],
    evidenceRefs: [
      "execution-observation:observation-1",
      "artifact:report-1"
    ],
    artifactRefs: ["artifact:report-1"]
  });

  const resolution = await resolveGovernanceOperatorActionEvidence({ envelope });

  assert.equal(resolution.resolvedCount, 0);
  assert.equal(resolution.unresolvedCount, 2);
  assert.deepEqual(
    resolution.refs.map((entry) => [entry.kind, entry.status, entry.reason]),
    [
      [
        "execution_observation",
        "store_unavailable",
        "execution_observation_store_unavailable"
      ],
      ["artifact", "store_unavailable", "artifact_store_unavailable"]
    ]
  );
});

test("recovery control fails closed when operator action evidence refs are malformed", async () => {
  const envelope = GovernanceOperatorActionEnvelopeSchema.parse({
    source: "execution_governance",
    taskId: "recovery-task",
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "fork",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [],
    evidenceRefs: [
      "execution-observation:",
      "artifact:../secret",
      "note:manual"
    ],
    artifactRefs: []
  });

  const resolution = await resolveGovernanceOperatorActionEvidence({ envelope });

  assert.equal(resolution.resolvedCount, 0);
  assert.equal(resolution.unresolvedCount, 3);
  assert.deepEqual(
    resolution.refs.map((entry) => [entry.kind, entry.status, entry.reason]),
    [
      [
        "execution_observation",
        "malformed",
        "execution_observation_ref_malformed"
      ],
      ["artifact", "malformed", "artifact_ref_malformed"],
      ["unsupported", "unsupported", "unsupported_evidence_ref"]
    ]
  );
});

test("recovery control rejects inconsistent evidence resolution entries", () => {
  assert.throws(
    () => GovernanceOperatorEvidenceResolutionEntrySchema.parse({
      ref: "note:manual",
      kind: "unsupported",
      status: "resolved"
    }),
    /operator_evidence_resolution_unsupported_requires_unsupported_status/
  );
  assert.throws(
    () => GovernanceOperatorEvidenceResolutionEntrySchema.parse({
      ref: "execution-observation:o1",
      kind: "execution_observation",
      status: "task_mismatch"
    }),
    /operator_evidence_resolution_task_mismatch_requires_artifact/
  );
});

test("recovery control does not expose cross-task artifact evidence", async () => {
  const artifactStore = new InMemoryArtifactStore({
    now: () => "2026-04-27T00:05:00.000Z"
  });
  await artifactStore.putArtifact({
    artifactId: "foreign-report",
    taskId: "other-task",
    type: "report",
    payload: {
      status: "failed"
    }
  });
  const envelope = GovernanceOperatorActionEnvelopeSchema.parse({
    source: "execution_governance",
    taskId: "recovery-task",
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "fork",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [],
    evidenceRefs: ["artifact:foreign-report"],
    artifactRefs: ["artifact:foreign-report"]
  });

  const resolution = await resolveGovernanceOperatorActionEvidence({
    envelope,
    artifactStore
  });

  assert.equal(resolution.resolvedCount, 0);
  assert.equal(resolution.unresolvedCount, 1);
  assert.equal(resolution.refs[0]?.kind, "artifact");
  assert.equal(resolution.refs[0]?.status, "task_mismatch");
  assert.equal(resolution.refs[0]?.reason, "artifact_task_mismatch");
  assert.equal(resolution.refs[0]?.artifact, undefined);
});

test("recovery control summarizes missing operator action as absent", () => {
  assert.deepEqual(summarizeGovernanceOperatorActionEnvelope(undefined), {
    schemaVersion: "governance-operator-action-summary.v1",
    present: false,
    blockingReasons: [],
    evidenceRefs: [],
    artifactRefs: []
  });
});

test("recovery control rejects absent operator summaries with stale fields", () => {
  assert.throws(
    () => GovernanceOperatorActionSummarySchema.parse({
      present: false,
      source: "desktop_live_governance",
      blockingReasons: [],
      evidenceRefs: [],
      artifactRefs: []
    }),
    /operator_action_summary_absent_forbids_field/
  );
});

test("recovery control rejects third-anomaly operator envelopes without lockdown", () => {
  assert.throws(
    () => GovernanceOperatorActionEnvelopeSchema.parse({
      schemaVersion: "governance-operator-action-envelope.v1",
      source: "desktop_live_governance",
      taskId: "recovery-task",
      status: "requires_arbitration",
      trigger: "third_anomaly",
      recommendedAction: "fork",
      requiresHumanApproval: true,
      lockdown: false,
      blockingReasons: [],
      evidenceRefs: ["execution-observation:o1"],
      artifactRefs: []
    }),
    /operator_action_envelope_lockdown_required/
  );
});

test("recovery control rejects operator envelope artifact refs outside evidence refs", () => {
  assert.throws(
    () => GovernanceOperatorActionEnvelopeSchema.parse({
      schemaVersion: "governance-operator-action-envelope.v1",
      source: "execution_governance",
      taskId: "recovery-task",
      status: "requires_arbitration",
      trigger: "first_anomaly",
      recommendedAction: "resume",
      requiresHumanApproval: false,
      lockdown: false,
      blockingReasons: [],
      evidenceRefs: ["execution-observation:o1"],
      artifactRefs: ["artifact:missing-report"]
    }),
    /operator_action_envelope_artifact_refs_must_be_evidence_refs/
  );
});

test("recovery control rejects unsafe operator envelope artifact refs", () => {
  assert.throws(
    () => GovernanceOperatorActionEnvelopeSchema.parse({
      schemaVersion: "governance-operator-action-envelope.v1",
      source: "execution_governance",
      taskId: "recovery-task",
      status: "requires_arbitration",
      trigger: "third_anomaly",
      recommendedAction: "fork",
      requiresHumanApproval: true,
      lockdown: true,
      blockingReasons: [],
      evidenceRefs: ["artifact:../secret"],
      artifactRefs: ["artifact:../secret"]
    }),
    /operator_action_envelope_artifact_refs_must_be_evidence_refs/
  );
});

test("recovery control rejects operator action reason/action mismatch", () => {
  assert.throws(
    () => RecoveryOperatorActionSchema.parse(createOperatorActionInput({
      recommendedAction: "resume",
      reasonCode: "third_anomaly_fork_for_investigation",
      requiresHumanApproval: true
    })),
    /recommendation_action_mismatch/
  );
});

test("recovery control rejects operator action that weakens required human approval", () => {
  assert.throws(
    () => RecoveryOperatorActionSchema.parse(createOperatorActionInput({
      recommendedAction: "fork",
      reasonCode: "third_anomaly_fork_for_investigation",
      requiresHumanApproval: false
    })),
    /recommendation_approval_mismatch/
  );
});

test("recovery control rejects operator action reason that does not match trigger", () => {
  assert.throws(
    () => RecoveryOperatorActionSchema.parse(createOperatorActionInput({
      trigger: "first_anomaly",
      recommendedAction: "fork",
      reasonCode: "third_anomaly_fork_for_investigation",
      requiresHumanApproval: true
    })),
    /recommendation_trigger_mismatch/
  );
});

test("recovery control rejects third-anomaly operator action without lockdown", () => {
  assert.throws(
    () => RecoveryOperatorActionSchema.parse(createOperatorActionInput({
      trigger: "third_anomaly",
      recommendedAction: "fork",
      reasonCode: "third_anomaly_fork_for_investigation",
      requiresHumanApproval: true,
      lockdown: false
    })),
    /operator_action_lockdown_required/
  );
});

test("recovery control rejects rollback operator action without checkpoint", () => {
  assert.throws(
    () => RecoveryOperatorActionSchema.parse(createOperatorActionInput({
      recommendedAction: "rollback",
      reasonCode: "third_anomaly_rollback_to_checkpoint",
      requiresHumanApproval: true
    })),
    /recommendation_checkpoint_required/
  );
});

test("recovery control rejects operator action checkpoint for non-checkpoint reason", () => {
  assert.throws(
    () => RecoveryOperatorActionSchema.parse(createOperatorActionInput({
      recommendedAction: "fork",
      reasonCode: "third_anomaly_fork_for_investigation",
      requiresHumanApproval: true,
      checkpointRef: "checkpoint:recovery-task:latest"
    })),
    /recommendation_checkpoint_not_allowed/
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

function createTestOperatorActionEnvelope(): GovernanceOperatorActionEnvelope {
  const action = RecoveryOperatorActionSchema.parse(createOperatorActionInput({
    evidenceRefs: ["execution-observation:o1"]
  }));
  const envelope = createGovernanceOperatorActionEnvelope({
    source: "execution_governance",
    operatorAction: action
  });

  assert.ok(envelope);
  return envelope;
}

function createTestOperatorActionReceipt(
  envelope: GovernanceOperatorActionEnvelope,
  overrides: Partial<GovernanceOperatorActionReceiptInput> = {}
) {
  const actionIssuedAt = typeof overrides.actionIssuedAt === "string"
    ? overrides.actionIssuedAt
    : "2026-04-27T00:04:45.000Z";
  const receiptWithoutId = {
    taskId: envelope.taskId,
    actionRef: createGovernanceOperatorActionRef(envelope, { actionIssuedAt }),
    envelopeHash: hashGovernanceOperatorActionEnvelope(envelope),
    actionIssuedAt,
    decision: "consumed" as const,
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-27T00:05:00.000Z",
    evidenceRefs: [...envelope.evidenceRefs],
    ...overrides
  };

  return GovernanceOperatorActionReceiptSchema.parse({
    receiptId: createGovernanceOperatorActionReceiptId(receiptWithoutId),
    ...receiptWithoutId
  });
}

async function createTestOperatorActionConsumption(
  envelope: GovernanceOperatorActionEnvelope,
  options: { actionIssuedAt: string }
) {
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  return validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      actionIssuedAt: options.actionIssuedAt
    }),
    actionIssuedAt: options.actionIssuedAt,
    now: "2026-04-27T00:05:30.000Z",
    maxActionAgeMs: 60_000
  });
}

function createTestOperatorActionLifecycle(
  envelope: GovernanceOperatorActionEnvelope,
  consumption: unknown,
  options: {
    actionIssuedAt: string;
    status?:
      | "idle"
      | "action_available"
      | "receipt_created"
      | "receipt_consumed"
      | "receipt_not_consumed"
      | "receipt_blocked";
  }
) {
  return {
    schemaVersion: "desktop-operator-action-lifecycle.v1",
    status: options.status ?? "receipt_consumed",
    operatorActionPresent: true,
    actionIssuedAt: options.actionIssuedAt,
    envelope,
    lastReceiptConsumption: consumption
  };
}

function createTestHostExecutorDescriptor(
  supportedActions: Array<"resume" | "rollback" | "abort" | "fork">
): GovernanceOperatorActionHostExecutorDescriptorInput {
  return {
    schemaVersion: "governance-operator-action-host-executor-descriptor.v1",
    descriptorId: "host-executor:review-only",
    descriptorKind: "injected_host_executor",
    executionMode: "review_only",
    sideEffectBoundary: "recovery_action_review",
    dispatchSupported: false,
    supportedActions,
    evidenceRefs: ["evidence:phase11-descriptor"]
  };
}

function createTestHostExecutorAuthorizationPacket(
  gate: GovernanceOperatorActionExecutionGateResult,
  descriptor: GovernanceOperatorActionHostExecutorDescriptorInput,
  overrides: Partial<{
    taskId: string;
    actionRef: string;
    receiptId: string;
    envelopeHash: string;
    recommendedAction: "resume" | "rollback" | "abort" | "fork";
    executionPlanHash: string;
    checkpointRef: string;
    hostExecutorDescriptorId: string;
    hostExecutorDescriptorHash: string;
    authorizationIdentityHash: string;
    evidenceRefs: string[];
  }> = {}
) {
  assert.ok(gate.plan);
  assert.ok(gate.taskId);
  assert.ok(gate.actionRef);
  assert.ok(gate.receiptId);
  assert.ok(gate.envelopeHash);
  assert.ok(gate.recommendedAction);
  const packet = {
    schemaVersion: "governance-operator-action-host-executor-authorization-packet.v1",
    taskId: gate.taskId,
    actionRef: gate.actionRef,
    receiptId: gate.receiptId,
    envelopeHash: gate.envelopeHash,
    recommendedAction: gate.recommendedAction,
    executionPlanHash: hashGovernanceOperatorActionExecutionPlan(gate.plan),
    ...(gate.checkpointRef !== undefined ? { checkpointRef: gate.checkpointRef } : {}),
    hostExecutorDescriptorId: descriptor.descriptorId,
    hostExecutorDescriptorHash:
      hashGovernanceOperatorActionHostExecutorDescriptor(descriptor),
    authorizationIdentityHash: "b".repeat(64),
    evidenceRefs: ["evidence:phase11-authorization"],
    ...overrides
  };

  return packet;
}

function createTestAgentExecutorAdapterDescriptor(
  hostDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput,
  supportedActions: Array<"resume" | "rollback" | "abort" | "fork">
): GovernanceOperatorActionAgentExecutorAdapterDescriptorInput {
  return {
    schemaVersion: "governance-operator-action-agent-executor-adapter-descriptor.v1",
    adapterId: "agent-executor-adapter:sub-agent-review-only",
    adapterKind: "sub_agent_adapter",
    hostExecutorDescriptorId: hostDescriptor.descriptorId,
    executionBoundary: "review_only",
    invocationSupported: false,
    sideEffectBoundary: "none",
    supportedActions,
    evidenceRefs: ["evidence:phase15-adapter-descriptor"]
  };
}

function createTestAgentExecutorAdapterReviewPacket(
  gate: GovernanceOperatorActionExecutionGateResult,
  hostAuthorization: GovernanceOperatorActionHostExecutorAuthorizationResult,
  adapterDescriptor: GovernanceOperatorActionAgentExecutorAdapterDescriptorInput,
  overrides: Partial<{
    approvalString: string;
    taskId: string;
    actionRef: string;
    receiptId: string;
    envelopeHash: string;
    recommendedAction: "resume" | "rollback" | "abort" | "fork";
    executionPlanHash: string;
    checkpointRef: string;
    hostExecutorDescriptorId: string;
    hostExecutorDescriptorHash: string;
    authorizationIdentityHash: string;
    adapterId: string;
    adapterKind:
      | "codex_cli_adapter"
      | "sub_agent_adapter"
      | "host_runtime_adapter"
      | "sandbox_reference_adapter";
    adapterDescriptorHash: string;
    executionBoundary: string;
    invocationSupported: boolean;
    evidenceRefs: string[];
  }> = {}
) {
  assert.ok(gate.taskId);
  assert.ok(gate.actionRef);
  assert.ok(gate.receiptId);
  assert.ok(gate.envelopeHash);
  assert.ok(gate.recommendedAction);
  assert.ok(hostAuthorization.executionPlanHash);
  assert.ok(hostAuthorization.hostExecutorDescriptorId);
  assert.ok(hostAuthorization.hostExecutorDescriptorHash);
  assert.ok(hostAuthorization.authorizationIdentityHash);

  return {
    schemaVersion: "governance-operator-action-agent-executor-adapter-review-packet.v1",
    approvalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
    taskId: gate.taskId,
    actionRef: gate.actionRef,
    receiptId: gate.receiptId,
    envelopeHash: gate.envelopeHash,
    recommendedAction: gate.recommendedAction,
    executionPlanHash: hostAuthorization.executionPlanHash,
    ...(gate.checkpointRef !== undefined ? { checkpointRef: gate.checkpointRef } : {}),
    hostExecutorDescriptorId: hostAuthorization.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: hostAuthorization.hostExecutorDescriptorHash,
    authorizationIdentityHash: hostAuthorization.authorizationIdentityHash,
    adapterId: adapterDescriptor.adapterId,
    adapterKind: adapterDescriptor.adapterKind,
    adapterDescriptorHash:
      hashGovernanceOperatorActionAgentExecutorAdapterDescriptor(adapterDescriptor),
    executionBoundary: "review_only",
    invocationSupported: false,
    evidenceRefs: ["evidence:phase15-adapter-review"],
    ...overrides
  };
}

function createStandaloneOperatorActionReceipt(overrides: {
  taskId: string;
  actionRef: string;
  createdAt: string;
}) {
  const receiptWithoutId = {
    taskId: overrides.taskId,
    actionRef: overrides.actionRef,
    actionIssuedAt: "2026-04-27T00:04:45.000Z",
    decision: "consumed" as const,
    operatorIdHash: "a".repeat(64),
    createdAt: overrides.createdAt,
    evidenceRefs: []
  };

  return GovernanceOperatorActionReceiptSchema.parse({
    receiptId: createGovernanceOperatorActionReceiptId(receiptWithoutId),
    ...receiptWithoutId
  });
}

type OperatorActionInputOverrides = {
  trigger?: "first_anomaly" | "second_anomaly" | "third_anomaly" | "manual";
  recommendedAction?: "resume" | "rollback" | "abort" | "fork";
  reasonCode:
    | "first_anomaly_resume_with_monitoring"
    | "second_anomaly_require_human_review"
    | "third_anomaly_rollback_to_checkpoint"
    | "third_anomaly_fork_for_investigation"
    | "third_anomaly_abort_without_reversible_action"
    | "manual_review_requested";
  requiresHumanApproval?: boolean;
  evidenceStatus?: "referenced" | "missing";
  evidenceRefs?: string[];
  checkpointRef?: string;
  availableActions?: Array<"resume" | "rollback" | "abort" | "fork">;
  lockdown?: boolean;
};

function createOperatorActionInput(
  overrides: Partial<OperatorActionInputOverrides> = {}
) {
  const evidenceRefs = overrides.evidenceRefs ?? ["execution-observation:o1"];

  return {
    schemaVersion: "recovery-operator-action.v1" as const,
    taskId: "recovery-task",
    status: "requires_arbitration" as const,
    trigger: overrides.trigger ?? "third_anomaly" as const,
    recommendedAction: overrides.recommendedAction ?? "fork" as const,
    reasonCode: overrides.reasonCode ?? "third_anomaly_fork_for_investigation" as const,
    summary: "fork for investigation",
    requiresHumanApproval: overrides.requiresHumanApproval ?? true,
    lockdown: overrides.lockdown ?? true,
    evidenceStatus: overrides.evidenceStatus
      ?? (evidenceRefs.length > 0 ? "referenced" as const : "missing" as const),
    evidenceRefs,
    ...(overrides.checkpointRef !== undefined ? { checkpointRef: overrides.checkpointRef } : {}),
    availableActions: overrides.availableActions ?? ["resume", "rollback", "abort", "fork"],
    blockingReasons: ["governance_step_back_triggered", "arbitration_required"]
  };
}

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
