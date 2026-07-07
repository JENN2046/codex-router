import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  authorizeGovernanceOperatorActionHostExecutorReview,
  createGovernanceOperatorActionEnvelope,
  createGovernanceOperatorActionReceipt,
  createInMemoryGovernanceOperatorActionReceiptStore,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
  GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
  hashGovernanceOperatorActionAgentExecutorAdapterDescriptor,
  hashGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult,
  hashGovernanceOperatorActionAgentExecutorAdapterReviewResult,
  hashGovernanceOperatorActionExecutionGateResult,
  hashGovernanceOperatorActionExecutionPlan,
  hashGovernanceOperatorActionHostExecutorDescriptor,
  planGovernanceOperatorActionExecution,
  RecoveryOperatorActionSchema,
  reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization,
  reviewGovernanceOperatorActionAgentExecutorAdapterReadiness,
  reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization,
  validateAndConsumeGovernanceOperatorActionReceipt,
  type GovernanceOperatorActionAgentExecutorAdapterDescriptorInput,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchClass,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass,
  type GovernanceOperatorActionAgentExecutorAdapterKind,
  type GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  type GovernanceOperatorActionAgentTaskControlDispatchAuthorizationPacket,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionExecutionGateResult,
  type GovernanceOperatorActionHostExecutorAuthorizationResult,
  type GovernanceOperatorActionHostExecutorDescriptorInput,
  type RecoveryAction
} from "../packages/governance-internal-recovery-control/src/index.js";

test("phase17 task control dispatch authorization accepts review-only agent context boundary", async () => {
  const context = await createApprovedAgentTaskControlDispatchAuthorizationContext({
    recommendedAction: "fork"
  });

  const result = reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(
    result.status,
    "ready_for_agent_task_control_dispatch_authorization_review"
  );
  assert.deepEqual(result.reasons, []);
  assert.equal(
    result.approvalString,
    GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL
  );
  assert.equal(
    result.dispatchAuthorizationApprovalString,
    GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL
  );
  assert.equal(result.requestedDispatchClass, "agent_task_control");
  assert.equal(result.requestedSideEffectClass, "agent_context_only");
  assert.equal(result.hostAgentRuntimeRef, "host-agent-runtime:phase17-review-only");
  assert.equal(result.hostAgentCapabilityRef, "host-agent-capability:task-control-review-only");
  assert.equal(result.contextPackageRef, "context-package:phase17-redacted");
  assert.deepEqual(result.permittedTaskControlOperationRefs, [
    "task-control-operation:fork"
  ]);
  assert.equal(
    result.executionGateHash,
    hashGovernanceOperatorActionExecutionGateResult(context.gate)
  );
  assert.equal(
    result.phase16DispatchAuthorizationReviewHash,
    hashGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult(
      context.dispatchAuthorizationReview
    )
  );
  assert.equal(
    result.nonAuthorizationDeclaration,
    "phase17_agent_task_control_review_only_no_adapter_invocation"
  );
  assert.ok(result.evidenceRefs.includes("evidence:phase17-agent-task-control-review"));
  assert.match(result.operatorInstruction ?? "", /no adapter/);
  assert.match(result.operatorInstruction ?? "", /no Codex CLI/);
  assert.match(result.operatorInstruction ?? "", /no sub-agent runtime/);
  assert.match(result.operatorInstruction ?? "", /was invoked/);
});

test("phase17 task control dispatch authorization blocks wrong dispatch classes", async () => {
  const context = await createApprovedAgentTaskControlDispatchAuthorizationContext({
    recommendedAction: "fork",
    phase17PacketOverrides: {
      requestedDispatchClass: "review_only",
      requestedSideEffectClass: "none"
    }
  });

  const result = reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_task_control_dispatch_authorization_dispatch_class_not_agent_task_control"
  ));
  assert.ok(result.reasons.includes(
    "operator_action_agent_task_control_dispatch_authorization_side_effect_class_not_agent_context_only"
  ));
});

test("phase17 task control dispatch authorization blocks phase16 review hash drift", async () => {
  const context = await createApprovedAgentTaskControlDispatchAuthorizationContext({
    recommendedAction: "fork",
    phase17PacketOverrides: {
      phase16DispatchAuthorizationReviewHash: "0".repeat(64)
    }
  });

  const result = reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_task_control_dispatch_authorization_packet_phase16_review_hash_mismatch"
  ));
});

test("phase17 task control dispatch authorization binds permitted operation refs to action", async () => {
  const context = await createApprovedAgentTaskControlDispatchAuthorizationContext({
    recommendedAction: "fork",
    phase17PacketOverrides: {
      permittedTaskControlOperationRefs: ["task-control-operation:abort"]
    }
  });

  const result = reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_task_control_dispatch_authorization_operation_ref_mismatch"
  ));
});

test("phase17 task control dispatch authorization blocks sandbox reference adapter kind", async () => {
  const context = await createApprovedAgentTaskControlDispatchAuthorizationContext({
    recommendedAction: "fork",
    adapterKind: "sandbox_reference_adapter"
  });

  const result = reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_task_control_dispatch_authorization_adapter_kind_incompatible"
  ));
});

test("phase17 task control dispatch authorization binds rollback by checkpoint hash only", async () => {
  const checkpointRef = "checkpoint:recovery-task:phase17-rollback-target";
  const context = await createApprovedAgentTaskControlDispatchAuthorizationContext({
    recommendedAction: "rollback",
    checkpointRef
  });

  const result = reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(
    result.status,
    "ready_for_agent_task_control_dispatch_authorization_review"
  );
  assert.equal(result.checkpointRefHash, stableSha256(checkpointRef));
  assert.equal(result.rollbackExpectationRef, "expectation:phase17-rollback");
  assert.equal(JSON.stringify(result).includes(checkpointRef), false);
  assert.equal(
    JSON.stringify(context.agentTaskControlDispatchAuthorizationPacket).includes(checkpointRef),
    false
  );
});

async function createApprovedAgentTaskControlDispatchAuthorizationContext(options: {
  recommendedAction: RecoveryAction;
  checkpointRef?: string;
  adapterKind?: GovernanceOperatorActionAgentExecutorAdapterKind;
  phase16DispatchPacketOverrides?: Partial<{
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
  }>;
  phase17PacketOverrides?: Partial<{
    executionGateHash: string;
    phase16DispatchAuthorizationReviewHash: string;
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
    permittedTaskControlOperationRefs: string[];
  }>;
}): Promise<{
  envelope: GovernanceOperatorActionEnvelope;
  gate: GovernanceOperatorActionExecutionGateResult;
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  dispatchAuthorizationReview:
    GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult;
  dispatchAuthorizationPacket:
    GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket;
  agentTaskControlDispatchAuthorizationPacket:
    GovernanceOperatorActionAgentTaskControlDispatchAuthorizationPacket;
  reviewInput: {
    executionGate: GovernanceOperatorActionExecutionGateResult;
    lifecycleState: unknown;
    authorizationPacket: unknown;
    hostExecutorDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput;
    hostExecutorAuthorization: GovernanceOperatorActionHostExecutorAuthorizationResult;
    adapterDescriptor: GovernanceOperatorActionAgentExecutorAdapterDescriptorInput;
    adapterReviewPacket: unknown;
    adapterReadiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    dispatchAuthorizationPacket:
      GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket;
    agentTaskControlDispatchAuthorizationPacket:
      GovernanceOperatorActionAgentTaskControlDispatchAuthorizationPacket;
  };
}> {
  const actionIssuedAt = "2026-07-07T02:00:00.000Z";
  const envelope = createTestOperatorActionEnvelope(options);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const receipt = createGovernanceOperatorActionReceipt({
    envelope,
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    actionIssuedAt,
    createdAt: "2026-07-07T02:00:30.000Z",
    evidenceRefs: [...envelope.evidenceRefs]
  });
  const consumption = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-07-07T02:01:00.000Z",
    maxActionAgeMs: 60_000
  });
  const lifecycleState = {
    schemaVersion: "desktop-operator-action-lifecycle.v1",
    status: "receipt_consumed",
    operatorActionPresent: true,
    actionIssuedAt,
    envelope,
    lastReceiptConsumption: consumption
  };
  const gate = planGovernanceOperatorActionExecution({
    envelope,
    receiptConsumption: consumption,
    lifecycleState,
    allowedActions: [options.recommendedAction],
    executionMode: "plan_only"
  });
  assert.equal(gate.status, "planned");
  assert.ok(gate.plan);

  const hostDescriptor = createTestHostExecutorDescriptor([options.recommendedAction]);
  const authorizationPacket = createTestHostExecutorAuthorizationPacket(gate, hostDescriptor);
  const hostAuthorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket,
    hostExecutorDescriptor: hostDescriptor
  });
  assert.equal(hostAuthorization.status, "ready_for_host_executor_review");

  const adapterDescriptor = createTestAgentExecutorAdapterDescriptor(
    hostDescriptor,
    [options.recommendedAction],
    options.adapterKind ?? "sub_agent_adapter"
  );
  const adapterReviewPacket = createTestAgentExecutorAdapterReviewPacket(
    gate,
    hostAuthorization,
    adapterDescriptor
  );
  const readiness = reviewGovernanceOperatorActionAgentExecutorAdapterReadiness({
    executionGate: gate,
    lifecycleState,
    authorizationPacket,
    hostExecutorDescriptor: hostDescriptor,
    hostExecutorAuthorization: hostAuthorization,
    adapterDescriptor,
    adapterReviewPacket
  });
  assert.equal(readiness.status, "ready_for_agent_executor_adapter_review");

  const dispatchAuthorizationPacket = createTestDispatchAuthorizationPacket(
    readiness,
    options.phase16DispatchPacketOverrides
  );
  const dispatchAuthorizationReview =
    reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization({
      executionGate: gate,
      lifecycleState,
      authorizationPacket,
      hostExecutorDescriptor: hostDescriptor,
      hostExecutorAuthorization: hostAuthorization,
      adapterDescriptor,
      adapterReviewPacket,
      adapterReadiness: readiness,
      dispatchAuthorizationPacket
    });
  assert.equal(
    dispatchAuthorizationReview.status,
    "ready_for_agent_executor_adapter_dispatch_authorization_review"
  );

  const agentTaskControlDispatchAuthorizationPacket =
    createTestAgentTaskControlDispatchAuthorizationPacket(
      dispatchAuthorizationReview,
      gate,
      options.phase17PacketOverrides
    );

  return {
    envelope,
    gate,
    readiness,
    dispatchAuthorizationReview,
    dispatchAuthorizationPacket,
    agentTaskControlDispatchAuthorizationPacket,
    reviewInput: {
      executionGate: gate,
      lifecycleState,
      authorizationPacket,
      hostExecutorDescriptor: hostDescriptor,
      hostExecutorAuthorization: hostAuthorization,
      adapterDescriptor,
      adapterReviewPacket,
      adapterReadiness: readiness,
      dispatchAuthorizationPacket,
      agentTaskControlDispatchAuthorizationPacket
    }
  };
}

function createTestOperatorActionEnvelope(options: {
  recommendedAction: RecoveryAction;
  checkpointRef?: string;
}): GovernanceOperatorActionEnvelope {
  const shape = createOperatorActionShape(options);
  const action = RecoveryOperatorActionSchema.parse({
    schemaVersion: "recovery-operator-action.v1",
    taskId: "recovery-task",
    status: "requires_arbitration",
    trigger: shape.trigger,
    recommendedAction: options.recommendedAction,
    reasonCode: shape.reasonCode,
    summary: `${options.recommendedAction} through phase17 task control dispatch review`,
    requiresHumanApproval: shape.requiresHumanApproval,
    lockdown: shape.lockdown,
    evidenceStatus: "referenced",
    evidenceRefs: ["execution-observation:o1"],
    ...(options.checkpointRef !== undefined
      ? { checkpointRef: options.checkpointRef }
      : {}),
    availableActions: ["resume", "rollback", "abort", "fork"],
    blockingReasons: ["governance_step_back_triggered", "arbitration_required"]
  });
  const envelope = createGovernanceOperatorActionEnvelope({
    source: "execution_governance",
    operatorAction: action
  });

  assert.ok(envelope);
  return envelope;
}

function createOperatorActionShape(options: {
  recommendedAction: RecoveryAction;
  checkpointRef?: string;
}): {
  trigger: "first_anomaly" | "third_anomaly";
  reasonCode:
    | "first_anomaly_resume_with_monitoring"
    | "third_anomaly_rollback_to_checkpoint"
    | "third_anomaly_fork_for_investigation"
    | "third_anomaly_abort_without_reversible_action";
  requiresHumanApproval: boolean;
  lockdown: boolean;
} {
  switch (options.recommendedAction) {
    case "resume":
      return {
        trigger: "first_anomaly",
        reasonCode: "first_anomaly_resume_with_monitoring",
        requiresHumanApproval: false,
        lockdown: false
      };
    case "rollback":
      assert.ok(options.checkpointRef);
      return {
        trigger: "third_anomaly",
        reasonCode: "third_anomaly_rollback_to_checkpoint",
        requiresHumanApproval: true,
        lockdown: true
      };
    case "abort":
      return {
        trigger: "third_anomaly",
        reasonCode: "third_anomaly_abort_without_reversible_action",
        requiresHumanApproval: true,
        lockdown: true
      };
    case "fork":
      return {
        trigger: "third_anomaly",
        reasonCode: "third_anomaly_fork_for_investigation",
        requiresHumanApproval: true,
        lockdown: true
      };
  }
}

function createTestHostExecutorDescriptor(
  supportedActions: RecoveryAction[]
): GovernanceOperatorActionHostExecutorDescriptorInput {
  return {
    schemaVersion: "governance-operator-action-host-executor-descriptor.v1",
    descriptorId: "host-executor:phase17-task-control-review-only",
    descriptorKind: "injected_host_executor",
    executionMode: "review_only",
    sideEffectBoundary: "recovery_action_review",
    dispatchSupported: false,
    supportedActions,
    evidenceRefs: ["evidence:phase17-host-descriptor"]
  };
}

function createTestHostExecutorAuthorizationPacket(
  gate: GovernanceOperatorActionExecutionGateResult,
  descriptor: GovernanceOperatorActionHostExecutorDescriptorInput
) {
  assert.ok(gate.plan);
  assert.ok(gate.taskId);
  assert.ok(gate.actionRef);
  assert.ok(gate.receiptId);
  assert.ok(gate.envelopeHash);
  assert.ok(gate.recommendedAction);

  return {
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
    evidenceRefs: ["evidence:phase17-host-authorization"]
  };
}

function createTestAgentExecutorAdapterDescriptor(
  hostDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput,
  supportedActions: RecoveryAction[],
  adapterKind: GovernanceOperatorActionAgentExecutorAdapterKind
): GovernanceOperatorActionAgentExecutorAdapterDescriptorInput {
  return {
    schemaVersion: "governance-operator-action-agent-executor-adapter-descriptor.v1",
    adapterId: `agent-executor-adapter:phase17-${adapterKind}`,
    adapterKind,
    hostExecutorDescriptorId: hostDescriptor.descriptorId,
    executionBoundary: "review_only",
    invocationSupported: false,
    sideEffectBoundary: "none",
    supportedActions,
    evidenceRefs: ["evidence:phase17-adapter-descriptor"]
  };
}

function createTestAgentExecutorAdapterReviewPacket(
  gate: GovernanceOperatorActionExecutionGateResult,
  hostAuthorization: GovernanceOperatorActionHostExecutorAuthorizationResult,
  adapterDescriptor: GovernanceOperatorActionAgentExecutorAdapterDescriptorInput
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
    evidenceRefs: ["evidence:phase17-adapter-review"]
  };
}

function createTestDispatchAuthorizationPacket(
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  overrides: Partial<{
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
  }> = {}
): GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket {
  assert.ok(readiness.taskId);
  assert.ok(readiness.actionRef);
  assert.ok(readiness.receiptId);
  assert.ok(readiness.envelopeHash);
  assert.ok(readiness.recommendedAction);
  assert.ok(readiness.executionPlanHash);
  assert.ok(readiness.hostExecutorDescriptorId);
  assert.ok(readiness.hostExecutorDescriptorHash);
  assert.ok(readiness.authorizationIdentityHash);
  assert.ok(readiness.adapterId);
  assert.ok(readiness.adapterKind);
  assert.ok(readiness.adapterDescriptorHash);

  return {
    schemaVersion:
      "governance-operator-action-agent-executor-adapter-dispatch-authorization-packet.v1",
    approvalString:
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
    reviewApprovalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
    taskId: readiness.taskId,
    actionRef: readiness.actionRef,
    receiptId: readiness.receiptId,
    envelopeHash: readiness.envelopeHash,
    recommendedAction: readiness.recommendedAction,
    executionPlanHash: readiness.executionPlanHash,
    ...(readiness.checkpointRef !== undefined
      ? { checkpointRefHash: stableSha256(readiness.checkpointRef) }
      : {}),
    hostExecutorDescriptorId: readiness.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: readiness.hostExecutorDescriptorHash,
    authorizationIdentityHash: readiness.authorizationIdentityHash,
    adapterId: readiness.adapterId,
    adapterKind: readiness.adapterKind,
    adapterDescriptorHash: readiness.adapterDescriptorHash,
    adapterReadinessHash:
      hashGovernanceOperatorActionAgentExecutorAdapterReviewResult(readiness),
    requestedDispatchClass: "review_only",
    requestedSideEffectClass: "none",
    authorizedScopeRef: "scope:phase17-dispatch-review-only",
    ...(readiness.recommendedAction === "rollback"
      ? { rollbackExpectationRef: "expectation:phase16-rollback" }
      : {}),
    abortExpectationRef: "expectation:phase16-abort",
    timeoutPolicyRef: "policy:phase16-timeout",
    auditSinkIdentityRef: "audit-sink:phase16-review",
    evidenceSinkIdentityRef: "evidence-sink:phase16-review",
    receiptContractVersion:
      "governance-operator-action-host-executor-dispatch-executor-result.v1",
    validationCommandRefs: ["validation:phase17-phase16-dispatch-authorization-test"],
    nonAuthorizationDeclaration: "phase16_review_only_no_adapter_invocation",
    evidenceRefs: ["evidence:phase17-dispatch-authorization"],
    ...overrides
  };
}

function createTestAgentTaskControlDispatchAuthorizationPacket(
  dispatchAuthorizationReview:
    GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult,
  gate: GovernanceOperatorActionExecutionGateResult,
  overrides: Partial<{
    executionGateHash: string;
    phase16DispatchAuthorizationReviewHash: string;
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
  }> = {}
): GovernanceOperatorActionAgentTaskControlDispatchAuthorizationPacket {
  assert.ok(dispatchAuthorizationReview.taskId);
  assert.ok(dispatchAuthorizationReview.actionRef);
  assert.ok(dispatchAuthorizationReview.receiptId);
  assert.ok(dispatchAuthorizationReview.envelopeHash);
  assert.ok(dispatchAuthorizationReview.recommendedAction);
  assert.ok(dispatchAuthorizationReview.executionPlanHash);
  assert.ok(dispatchAuthorizationReview.hostExecutorDescriptorId);
  assert.ok(dispatchAuthorizationReview.hostExecutorDescriptorHash);
  assert.ok(dispatchAuthorizationReview.authorizationIdentityHash);
  assert.ok(dispatchAuthorizationReview.adapterId);
  assert.ok(dispatchAuthorizationReview.adapterKind);
  assert.ok(dispatchAuthorizationReview.adapterDescriptorHash);
  assert.ok(dispatchAuthorizationReview.adapterReadinessHash);

  const operationRef =
    `task-control-operation:${dispatchAuthorizationReview.recommendedAction}`;

  return {
    schemaVersion:
      "governance-operator-action-agent-task-control-dispatch-authorization-packet.v1",
    approvalString:
      GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
    dispatchAuthorizationApprovalString:
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
    taskId: dispatchAuthorizationReview.taskId,
    actionRef: dispatchAuthorizationReview.actionRef,
    receiptId: dispatchAuthorizationReview.receiptId,
    envelopeHash: dispatchAuthorizationReview.envelopeHash,
    recommendedAction: dispatchAuthorizationReview.recommendedAction,
    executionPlanHash: dispatchAuthorizationReview.executionPlanHash,
    ...(dispatchAuthorizationReview.checkpointRefHash !== undefined
      ? { checkpointRefHash: dispatchAuthorizationReview.checkpointRefHash }
      : {}),
    executionGateHash: hashGovernanceOperatorActionExecutionGateResult(gate),
    hostExecutorDescriptorId: dispatchAuthorizationReview.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: dispatchAuthorizationReview.hostExecutorDescriptorHash,
    authorizationIdentityHash: dispatchAuthorizationReview.authorizationIdentityHash,
    adapterId: dispatchAuthorizationReview.adapterId,
    adapterKind: dispatchAuthorizationReview.adapterKind,
    adapterDescriptorHash: dispatchAuthorizationReview.adapterDescriptorHash,
    adapterReadinessHash: dispatchAuthorizationReview.adapterReadinessHash,
    phase16DispatchAuthorizationReviewHash:
      hashGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult(
        dispatchAuthorizationReview
      ),
    requestedDispatchClass: "agent_task_control",
    requestedSideEffectClass: "agent_context_only",
    authorizedTaskControlScopeRef: "scope:phase17-agent-task-control",
    hostAgentRuntimeRef: "host-agent-runtime:phase17-review-only",
    hostAgentCapabilityRef: "host-agent-capability:task-control-review-only",
    contextPackageRef: "context-package:phase17-redacted",
    contextPackageHash: stableSha256({
      taskId: dispatchAuthorizationReview.taskId,
      actionRef: dispatchAuthorizationReview.actionRef,
      contextPackageRef: "context-package:phase17-redacted"
    }),
    permittedTaskControlOperationRefs: [operationRef],
    promptContentPolicyRef: "prompt-policy:phase17-redacted-context-only",
    workspaceBoundaryRef: "workspace-boundary:phase17-no-workspace-write",
    ...(dispatchAuthorizationReview.recommendedAction === "rollback"
      ? { rollbackExpectationRef: "expectation:phase17-rollback" }
      : {}),
    abortExpectationRef: "expectation:phase17-abort",
    timeoutPolicyRef: "policy:phase17-task-control-timeout",
    idempotencyKeyHash: stableSha256({
      taskId: dispatchAuthorizationReview.taskId,
      actionRef: dispatchAuthorizationReview.actionRef,
      phase: "phase17-agent-task-control"
    }),
    auditSinkIdentityRef: "audit-sink:phase17-review",
    evidenceSinkIdentityRef: "evidence-sink:phase17-review",
    receiptContractVersion:
      "governance-operator-action-host-executor-dispatch-executor-result.v1",
    validationCommandRefs: [
      "validation:phase17-agent-task-control-dispatch-authorization-test"
    ],
    nonAuthorizationDeclaration:
      "phase17_agent_task_control_review_only_no_adapter_invocation",
    evidenceRefs: ["evidence:phase17-agent-task-control-review"],
    ...overrides
  };
}

function stableSha256(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
