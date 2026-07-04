import test from "node:test";
import assert from "node:assert/strict";
import {
  createArbitrationPacket,
  createGovernanceOperatorActionEnvelope,
  createGovernanceOperatorActionRef,
  GovernanceOperatorEvidenceResolutionEntrySchema,
  GovernanceOperatorActionEnvelopeSchema,
  GovernanceOperatorActionReceiptSchema,
  hashGovernanceOperatorActionEnvelope,
  resolveGovernanceOperatorActionEvidence,
  GovernanceOperatorActionSummarySchema,
  RecoveryOperatorActionSchema,
  parseArbitrationPacket,
  shouldLockdown,
  summarizeGovernanceOperatorActionEnvelope,
  validateGovernanceOperatorActionReceipt,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionReceiptInput
} from "../packages/recovery-control/src/index.js";
import type { GovernanceState } from "../packages/state-manager/src/index.js";
import { InMemoryArtifactStore } from "../packages/artifact-store/src/index.js";
import {
  createExecutionObservationRef,
  createRecordingExecutionObservationStore
} from "../packages/execution-observation/src/index.js";

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

test("recovery control validates operator action receipts against the action ref", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionRef = createGovernanceOperatorActionRef(envelope);
  const envelopeHash = hashGovernanceOperatorActionEnvelope(envelope);
  const receipt = GovernanceOperatorActionReceiptSchema.parse({
    taskId: "recovery-task",
    actionRef,
    envelopeHash,
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-27T00:05:00.000Z",
    evidenceRefs: ["execution-observation:o1"]
  });

  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt,
    now: "2026-04-27T00:05:30.000Z",
    maxAgeMs: 60_000
  });

  assert.equal(validation.status, "passed");
  assert.deepEqual(validation.reasons, []);
  assert.equal(validation.taskId, "recovery-task");
  assert.equal(validation.actionRef, actionRef);
  assert.equal(validation.envelopeHash, envelopeHash);
});

test("recovery control blocks operator action receipts for the wrong task", () => {
  const envelope = createTestOperatorActionEnvelope();
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      taskId: "other-task"
    }),
    now: "2026-04-27T00:05:30.000Z",
    maxAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_task_mismatch"));
});

test("recovery control blocks operator action receipts with stale timestamps", () => {
  const envelope = createTestOperatorActionEnvelope();
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    now: "2026-04-27T00:05:30.000Z",
    maxAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_expired"));
});

test("recovery control blocks replayed operator action receipts", () => {
  const envelope = createTestOperatorActionEnvelope();
  const actionRef = createGovernanceOperatorActionRef(envelope);
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope),
    now: "2026-04-27T00:05:30.000Z",
    maxAgeMs: 60_000,
    consumedActionRefs: [actionRef]
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_replay"));
});

test("recovery control requires lockdown operator actions to be resolved explicitly", () => {
  const envelope = createTestOperatorActionEnvelope();
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      decision: "acknowledged"
    }),
    now: "2026-04-27T00:05:30.000Z",
    maxAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes(
    "operator_action_receipt_lockdown_requires_resolution"
  ));
});

test("recovery control fails closed for malformed operator action receipts", () => {
  const envelope = createTestOperatorActionEnvelope();
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: {
      taskId: "recovery-task",
      actionRef: createGovernanceOperatorActionRef(envelope),
      decision: "consumed",
      operatorIdHash: "not-a-hash",
      createdAt: "2026-04-27T00:05:00.000Z"
    },
    now: "2026-04-27T00:05:30.000Z",
    maxAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.deepEqual(validation.reasons, ["operator_action_receipt_invalid"]);
});

test("recovery control blocks operator action receipts with mismatched action refs", () => {
  const envelope = createTestOperatorActionEnvelope();
  const validation = validateGovernanceOperatorActionReceipt({
    envelope,
    receipt: createTestOperatorActionReceipt(envelope, {
      actionRef: "governance-operator-action:".concat("b".repeat(64))
    }),
    now: "2026-04-27T00:05:30.000Z",
    maxAgeMs: 60_000
  });

  assert.equal(validation.status, "blocked");
  assert.ok(validation.reasons.includes("operator_action_receipt_action_ref_mismatch"));
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
  return GovernanceOperatorActionReceiptSchema.parse({
    taskId: envelope.taskId,
    actionRef: createGovernanceOperatorActionRef(envelope),
    envelopeHash: hashGovernanceOperatorActionEnvelope(envelope),
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    createdAt: "2026-04-27T00:05:00.000Z",
    evidenceRefs: [...envelope.evidenceRefs],
    ...overrides
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
