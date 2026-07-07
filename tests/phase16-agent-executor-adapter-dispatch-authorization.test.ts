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
  hashGovernanceOperatorActionAgentExecutorAdapterDescriptor,
  hashGovernanceOperatorActionAgentExecutorAdapterReviewResult,
  hashGovernanceOperatorActionExecutionPlan,
  hashGovernanceOperatorActionHostExecutorDescriptor,
  planGovernanceOperatorActionExecution,
  RecoveryOperatorActionSchema,
  reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization,
  reviewGovernanceOperatorActionAgentExecutorAdapterReadiness,
  validateAndConsumeGovernanceOperatorActionReceipt,
  type GovernanceOperatorActionAgentExecutorAdapterDescriptorInput,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchClass,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass,
  type GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionExecutionGateResult,
  type GovernanceOperatorActionHostExecutorAuthorizationResult,
  type GovernanceOperatorActionHostExecutorDescriptorInput,
  type RecoveryAction
} from "../packages/governance-internal-recovery-control/src/index.js";

test("phase16 dispatch authorization accepts review-only adapter dispatch review", async () => {
  const context = await createApprovedDispatchAuthorizationContext({
    recommendedAction: "fork"
  });

  const result = reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(
    result.status,
    "ready_for_agent_executor_adapter_dispatch_authorization_review"
  );
  assert.deepEqual(result.reasons, []);
  assert.equal(
    result.approvalString,
    GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL
  );
  assert.equal(result.reviewApprovalString, GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL);
  assert.equal(result.requestedDispatchClass, "review_only");
  assert.equal(result.requestedSideEffectClass, "none");
  assert.equal(
    result.adapterReadinessHash,
    hashGovernanceOperatorActionAgentExecutorAdapterReviewResult(context.readiness)
  );
  assert.equal(result.nonAuthorizationDeclaration, "phase16_review_only_no_adapter_invocation");
  assert.ok(result.evidenceRefs.includes("evidence:phase16-dispatch-authorization"));
  assert.match(result.operatorInstruction ?? "", /no adapter/);
  assert.match(result.operatorInstruction ?? "", /no Codex CLI/);
  assert.match(result.operatorInstruction ?? "", /was invoked/);
});

test("phase16 dispatch authorization blocks non-review dispatch classes", async () => {
  const context = await createApprovedDispatchAuthorizationContext({
    recommendedAction: "fork",
    dispatchPacketOverrides: {
      requestedDispatchClass: "agent_task_control",
      requestedSideEffectClass: "agent_context_only"
    }
  });

  const result = reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_authorization_dispatch_class_not_review_only"
  ));
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_authorization_side_effect_class_not_none"
  ));
});

test("phase16 dispatch authorization blocks adapter readiness hash drift", async () => {
  const context = await createApprovedDispatchAuthorizationContext({
    recommendedAction: "fork",
    dispatchPacketOverrides: {
      adapterReadinessHash: "0".repeat(64)
    }
  });

  const result = reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_authorization_packet_readiness_hash_mismatch"
  ));
});

test("phase16 dispatch authorization requires sandbox proof for sandbox contract class", async () => {
  const context = await createApprovedDispatchAuthorizationContext({
    recommendedAction: "fork",
    dispatchPacketOverrides: {
      requestedDispatchClass: "sandbox_contract",
      requestedSideEffectClass: "sandbox_only"
    }
  });

  const result = reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_authorization_sandbox_proof_required"
  ));
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_authorization_dispatch_class_not_review_only"
  ));
});

test("phase16 dispatch authorization blocks supplied readiness drift", async () => {
  const context = await createApprovedDispatchAuthorizationContext({
    recommendedAction: "fork"
  });

  const result = reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization({
    ...context.reviewInput,
    adapterReadiness: {
      ...context.readiness,
      adapterId: "agent-executor-adapter:drifted"
    }
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_authorization_readiness_adapter_id_mismatch"
  ));
});

test("phase16 dispatch authorization requires supplied adapter readiness", async () => {
  const context = await createApprovedDispatchAuthorizationContext({
    recommendedAction: "fork"
  });
  const { adapterReadiness: _adapterReadiness, ...reviewInput } = context.reviewInput;

  const result = reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization(
    reviewInput
  );

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_authorization_readiness_required"
  ));
});

test("phase16 dispatch authorization binds rollback by checkpoint hash only", async () => {
  const checkpointRef = "checkpoint:recovery-task:phase16-rollback-target";
  const context = await createApprovedDispatchAuthorizationContext({
    recommendedAction: "rollback",
    checkpointRef
  });

  const result = reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization(
    context.reviewInput
  );

  assert.equal(
    result.status,
    "ready_for_agent_executor_adapter_dispatch_authorization_review"
  );
  assert.equal(result.checkpointRefHash, stableSha256(checkpointRef));
  assert.equal(result.rollbackExpectationRef, "expectation:phase16-rollback");
  assert.equal(JSON.stringify(result).includes(checkpointRef), false);
  assert.equal(JSON.stringify(context.dispatchAuthorizationPacket).includes(checkpointRef), false);
});

async function createApprovedDispatchAuthorizationContext(options: {
  recommendedAction: RecoveryAction;
  checkpointRef?: string;
  dispatchPacketOverrides?: Partial<{
    adapterReadinessHash: string;
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
    sandboxContractProofRef: string;
  }>;
}): Promise<{
  envelope: GovernanceOperatorActionEnvelope;
  gate: GovernanceOperatorActionExecutionGateResult;
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  dispatchAuthorizationPacket:
    GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket;
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
  };
}> {
  const actionIssuedAt = "2026-07-07T01:00:00.000Z";
  const envelope = createTestOperatorActionEnvelope(options);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const receipt = createGovernanceOperatorActionReceipt({
    envelope,
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    actionIssuedAt,
    createdAt: "2026-07-07T01:00:30.000Z",
    evidenceRefs: [...envelope.evidenceRefs]
  });
  const consumption = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-07-07T01:01:00.000Z",
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
    [options.recommendedAction]
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
    options.dispatchPacketOverrides
  );

  return {
    envelope,
    gate,
    readiness,
    dispatchAuthorizationPacket,
    reviewInput: {
      executionGate: gate,
      lifecycleState,
      authorizationPacket,
      hostExecutorDescriptor: hostDescriptor,
      hostExecutorAuthorization: hostAuthorization,
      adapterDescriptor,
      adapterReviewPacket,
      adapterReadiness: readiness,
      dispatchAuthorizationPacket
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
    summary: `${options.recommendedAction} through phase16 dispatch authorization review`,
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
    descriptorId: "host-executor:phase16-dispatch-review-only",
    descriptorKind: "injected_host_executor",
    executionMode: "review_only",
    sideEffectBoundary: "recovery_action_review",
    dispatchSupported: false,
    supportedActions,
    evidenceRefs: ["evidence:phase16-host-descriptor"]
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
    evidenceRefs: ["evidence:phase16-host-authorization"]
  };
}

function createTestAgentExecutorAdapterDescriptor(
  hostDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput,
  supportedActions: RecoveryAction[]
): GovernanceOperatorActionAgentExecutorAdapterDescriptorInput {
  return {
    schemaVersion: "governance-operator-action-agent-executor-adapter-descriptor.v1",
    adapterId: "agent-executor-adapter:phase16-sub-agent-review-only",
    adapterKind: "sub_agent_adapter",
    hostExecutorDescriptorId: hostDescriptor.descriptorId,
    executionBoundary: "review_only",
    invocationSupported: false,
    sideEffectBoundary: "none",
    supportedActions,
    evidenceRefs: ["evidence:phase16-adapter-descriptor"]
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
    evidenceRefs: ["evidence:phase16-adapter-review"]
  };
}

function createTestDispatchAuthorizationPacket(
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  overrides: Partial<{
    adapterReadinessHash: string;
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
    sandboxContractProofRef: string;
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
    authorizedScopeRef: "scope:phase16-dispatch-review-only",
    ...(readiness.recommendedAction === "rollback"
      ? { rollbackExpectationRef: "expectation:phase16-rollback" }
      : {}),
    abortExpectationRef: "expectation:phase16-abort",
    timeoutPolicyRef: "policy:phase16-timeout",
    auditSinkIdentityRef: "audit-sink:phase16-review",
    evidenceSinkIdentityRef: "evidence-sink:phase16-review",
    receiptContractVersion:
      "governance-operator-action-host-executor-dispatch-executor-result.v1",
    validationCommandRefs: ["validation:phase16-dispatch-authorization-test"],
    nonAuthorizationDeclaration: "phase16_review_only_no_adapter_invocation",
    evidenceRefs: ["evidence:phase16-dispatch-authorization"],
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
