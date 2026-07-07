import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  authorizeGovernanceOperatorActionHostExecutorReview,
  createGovernanceOperatorActionEnvelope,
  createGovernanceOperatorActionReceipt,
  createInMemoryGovernanceOperatorActionReceiptStore,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN_APPROVAL,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL,
  hashGovernanceOperatorActionAgentExecutorAdapterDescriptor,
  hashGovernanceOperatorActionAgentExecutorAdapterReviewResult,
  hashGovernanceOperatorActionExecutionPlan,
  hashGovernanceOperatorActionHostExecutorDescriptor,
  planGovernanceOperatorActionExecution,
  RecoveryOperatorActionSchema,
  reviewGovernanceOperatorActionAgentExecutorAdapterReadiness,
  runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun,
  validateAndConsumeGovernanceOperatorActionReceipt,
  type GovernanceOperatorActionAgentExecutorAdapterDescriptorInput,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchClass,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunAuditEvent,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunPacket,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunResult,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass,
  type GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  type GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionExecutionGateResult,
  type GovernanceOperatorActionHostExecutorAuthorizationResult,
  type GovernanceOperatorActionHostExecutorDescriptorInput,
  type RecoveryAction
} from "../packages/governance-internal-recovery-control/src/index.js";
import { Phase15SandboxReferenceAgentExecutorAdapter } from "./fixtures/phase15-sandbox-reference-agent-executor-adapter.js";

test("phase16 sandbox dry-run calls injected sandbox adapter and records sanitized evidence", async () => {
  const context = await createApprovedSandboxDryRunContext({ recommendedAction: "fork" });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase16-sandbox-dry-run-fork-"));
  const auditEvents: GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunAuditEvent[] = [];
  const evidenceRecords: GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunResult[] = [];

  const result = await runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun({
    ...context.runInput,
    adapter: new Phase15SandboxReferenceAgentExecutorAdapter({
      sandboxRoot,
      now: () => "2026-07-07T03:00:00.000Z"
    }),
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    },
    evidenceSink: {
      record(record) {
        evidenceRecords.push(record);
      }
    }
  });

  assert.equal(result.status, "completed");
  assert.equal(result.approvalString, GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN_APPROVAL);
  assert.equal(result.requestedDispatchClass, "sandbox_contract");
  assert.equal(result.requestedSideEffectClass, "sandbox_only");
  assert.equal(result.adapterKind, "sandbox_reference_adapter");
  assert.equal(result.adapterStatus, "completed");
  assert.equal(result.nonAuthorizationDeclaration, "phase16_sandbox_dry_run_no_real_recovery_execution");
  assert.match(result.adapterResultRef ?? "", /^artifact:phase15-sandbox-adapter:[a-f0-9]{64}$/);
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "completed"]);
  assert.equal(evidenceRecords.length, 1);
  assert.equal(evidenceRecords[0]?.status, "completed");

  const runRoots = await readdir(sandboxRoot);
  assert.equal(runRoots.length, 1);
  const runEntries = await readdir(join(sandboxRoot, runRoots[0] ?? ""));
  assert.deepEqual(runEntries.sort(), [
    "contract.json",
    "fork.completed.json",
    "lineage",
    "status.json"
  ]);
});

test("phase16 sandbox dry-run blocks before adapter when evidence sink is missing", async () => {
  const context = await createApprovedSandboxDryRunContext({ recommendedAction: "fork" });
  let adapterCalls = 0;

  const result = await runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun({
    ...context.runInput,
    adapter: {
      runSandboxContract() {
        adapterCalls += 1;
        return { status: "completed" };
      }
    },
    auditSink: {
      record() {}
    }
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_evidence_sink_required"
  ));
  assert.equal(adapterCalls, 0);
});

test("phase16 sandbox dry-run blocks before adapter when dispatch packet drifts", async () => {
  const context = await createApprovedSandboxDryRunContext({
    recommendedAction: "fork",
    dryRunPacketOverrides: {
      adapterReadinessHash: "0".repeat(64)
    }
  });
  let adapterCalls = 0;

  const result = await runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun({
    ...context.runInput,
    adapter: {
      runSandboxContract() {
        adapterCalls += 1;
        return { status: "completed" };
      }
    },
    auditSink: {
      record() {}
    },
    evidenceSink: {
      record() {}
    }
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_packet_readiness_hash_mismatch"
  ));
  assert.equal(adapterCalls, 0);
});

test("phase16 sandbox dry-run requires sandbox dispatch and side-effect classes", async () => {
  const context = await createApprovedSandboxDryRunContext({
    recommendedAction: "fork",
    dryRunPacketOverrides: {
      requestedDispatchClass: "review_only",
      requestedSideEffectClass: "none"
    }
  });

  const result = await runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun({
    ...context.runInput,
    adapter: {
      runSandboxContract() {
        return { status: "completed" };
      }
    },
    auditSink: {
      record() {}
    },
    evidenceSink: {
      record() {}
    }
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_dispatch_class_not_sandbox_contract"
  ));
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_side_effect_class_not_sandbox_only"
  ));
});

test("phase16 sandbox dry-run binds rollback by checkpoint hash only", async () => {
  const checkpointRef = "checkpoint:recovery-task:phase16-sandbox-rollback-target";
  const context = await createApprovedSandboxDryRunContext({
    recommendedAction: "rollback",
    checkpointRef
  });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase16-sandbox-dry-run-rollback-"));
  const auditEvents: GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunAuditEvent[] = [];
  const evidenceRecords: GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunResult[] = [];

  const result = await runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun({
    ...context.runInput,
    adapter: new Phase15SandboxReferenceAgentExecutorAdapter({
      sandboxRoot,
      now: () => "2026-07-07T03:01:00.000Z"
    }),
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    },
    evidenceSink: {
      record(record) {
        evidenceRecords.push(record);
      }
    }
  });

  assert.equal(result.status, "completed");
  assert.equal(result.checkpointRefHash, stableSha256(checkpointRef));
  assert.equal(result.rollbackExpectationRef, "expectation:phase16-sandbox-rollback");
  assert.equal(JSON.stringify(result).includes(checkpointRef), false);
  assert.equal(JSON.stringify(context.dispatchSandboxDryRunPacket).includes(checkpointRef), false);
  assert.equal(JSON.stringify(auditEvents).includes(checkpointRef), false);
  assert.equal(JSON.stringify(evidenceRecords).includes(checkpointRef), false);
});

test("phase16 sandbox dry-run fails closed on unsafe adapter refs", async () => {
  const context = await createApprovedSandboxDryRunContext({ recommendedAction: "fork" });
  const auditEvents: GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunAuditEvent[] = [];

  const result = await runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun({
    ...context.runInput,
    adapter: {
      runSandboxContract() {
        return {
          schemaVersion:
            "governance-operator-action-agent-executor-adapter-sandbox-contract-adapter-result.v1",
          status: "completed",
          resultRef: "artifact:token-secret",
          evidenceRefs: ["artifact:token-secret"]
        };
      }
    },
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    },
    evidenceSink: {
      record() {}
    }
  });

  assert.equal(result.status, "failed");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_sandbox_contract_failed"
  ));
  assert.equal(result.errorClass, "zoderror");
  assert.equal(JSON.stringify(result).includes("token-secret"), false);
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "failed"]);
});

test("phase16 sandbox dry-run blocks contract packet sandbox-scope drift before adapter", async () => {
  const context = await createApprovedSandboxDryRunContext({ recommendedAction: "fork" });
  let adapterCalls = 0;

  const result = await runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun({
    ...context.runInput,
    sandboxContractPacket: {
      ...context.sandboxContractPacket,
      sandboxScopeRef: "sandbox:phase16-drifted"
    },
    adapter: {
      runSandboxContract() {
        adapterCalls += 1;
        return { status: "completed" };
      }
    },
    auditSink: {
      record() {}
    },
    evidenceSink: {
      record() {}
    }
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_contract_packet_sandbox_scope_mismatch"
  ));
  assert.equal(adapterCalls, 0);
});

async function createApprovedSandboxDryRunContext(options: {
  recommendedAction: RecoveryAction;
  checkpointRef?: string;
  dryRunPacketOverrides?: Partial<{
    adapterReadinessHash: string;
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
  }>;
}): Promise<{
  envelope: GovernanceOperatorActionEnvelope;
  gate: GovernanceOperatorActionExecutionGateResult;
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  dispatchSandboxDryRunPacket:
    GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunPacket;
  sandboxContractPacket: GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket;
  runInput: {
    executionGate: GovernanceOperatorActionExecutionGateResult;
    lifecycleState: unknown;
    authorizationPacket: unknown;
    hostExecutorDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput;
    hostExecutorAuthorization: GovernanceOperatorActionHostExecutorAuthorizationResult;
    adapterDescriptor: GovernanceOperatorActionAgentExecutorAdapterDescriptorInput;
    adapterReviewPacket: unknown;
    adapterReadiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    dispatchSandboxDryRunPacket:
      GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunPacket;
    sandboxContractPacket: GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket;
  };
}> {
  const actionIssuedAt = "2026-07-07T03:00:00.000Z";
  const envelope = createTestOperatorActionEnvelope(options);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const receipt = createGovernanceOperatorActionReceipt({
    envelope,
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    actionIssuedAt,
    createdAt: "2026-07-07T03:00:30.000Z",
    evidenceRefs: [...envelope.evidenceRefs]
  });
  const consumption = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-07-07T03:01:00.000Z",
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

  const dispatchSandboxDryRunPacket = createTestDispatchSandboxDryRunPacket(
    readiness,
    options.dryRunPacketOverrides
  );
  const sandboxContractPacket = createTestSandboxContractPacket(readiness);

  return {
    envelope,
    gate,
    readiness,
    dispatchSandboxDryRunPacket,
    sandboxContractPacket,
    runInput: {
      executionGate: gate,
      lifecycleState,
      authorizationPacket,
      hostExecutorDescriptor: hostDescriptor,
      hostExecutorAuthorization: hostAuthorization,
      adapterDescriptor,
      adapterReviewPacket,
      adapterReadiness: readiness,
      dispatchSandboxDryRunPacket,
      sandboxContractPacket
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
    summary: `${options.recommendedAction} through phase16 sandbox dry-run`,
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
    descriptorId: "host-executor:phase16-sandbox-dry-run",
    descriptorKind: "injected_host_executor",
    executionMode: "review_only",
    sideEffectBoundary: "recovery_action_review",
    dispatchSupported: false,
    supportedActions,
    evidenceRefs: ["evidence:phase16-sandbox-host-descriptor"]
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
    evidenceRefs: ["evidence:phase16-sandbox-host-authorization"]
  };
}

function createTestAgentExecutorAdapterDescriptor(
  hostDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput,
  supportedActions: RecoveryAction[]
): GovernanceOperatorActionAgentExecutorAdapterDescriptorInput {
  return {
    schemaVersion: "governance-operator-action-agent-executor-adapter-descriptor.v1",
    adapterId: "agent-executor-adapter:phase16-sandbox-reference",
    adapterKind: "sandbox_reference_adapter",
    hostExecutorDescriptorId: hostDescriptor.descriptorId,
    executionBoundary: "review_only",
    invocationSupported: false,
    sideEffectBoundary: "none",
    supportedActions,
    evidenceRefs: ["evidence:phase16-sandbox-adapter-descriptor"]
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
    evidenceRefs: ["evidence:phase16-sandbox-adapter-review"]
  };
}

function createTestDispatchSandboxDryRunPacket(
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  overrides: Partial<{
    adapterReadinessHash: string;
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
  }> = {}
): GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunPacket {
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
  assert.equal(readiness.adapterKind, "sandbox_reference_adapter");
  assert.ok(readiness.adapterDescriptorHash);

  return {
    schemaVersion:
      "governance-operator-action-agent-executor-adapter-dispatch-sandbox-dry-run-packet.v1",
    approvalString:
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN_APPROVAL,
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
    adapterKind: "sandbox_reference_adapter",
    adapterDescriptorHash: readiness.adapterDescriptorHash,
    adapterReadinessHash:
      hashGovernanceOperatorActionAgentExecutorAdapterReviewResult(readiness),
    sandboxContractProofMode: "fresh_run",
    requestedDispatchClass: "sandbox_contract",
    requestedSideEffectClass: "sandbox_only",
    authorizedScopeRef: "scope:phase16-sandbox-dry-run",
    sandboxScopeRef: "sandbox:phase16-sandbox-dry-run",
    ...(readiness.recommendedAction === "rollback"
      ? { rollbackExpectationRef: "expectation:phase16-sandbox-rollback" }
      : {}),
    abortExpectationRef: "expectation:phase16-sandbox-abort",
    timeoutPolicyRef: "policy:phase16-sandbox-timeout",
    auditSinkIdentityRef: "audit-sink:phase16-sandbox-dry-run",
    evidenceSinkIdentityRef: "evidence-sink:phase16-sandbox-dry-run",
    receiptContractVersion:
      "governance-operator-action-host-executor-dispatch-executor-result.v1",
    validationCommandRefs: ["validation:phase16-sandbox-dry-run-test"],
    nonAuthorizationDeclaration: "phase16_sandbox_dry_run_no_real_recovery_execution",
    evidenceRefs: ["evidence:phase16-sandbox-dry-run"],
    ...overrides
  };
}

function createTestSandboxContractPacket(
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult
): GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket {
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
  assert.equal(readiness.adapterKind, "sandbox_reference_adapter");
  assert.ok(readiness.adapterDescriptorHash);

  return {
    schemaVersion:
      "governance-operator-action-agent-executor-adapter-sandbox-contract-packet.v1",
    approvalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL,
    reviewApprovalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
    taskId: readiness.taskId,
    actionRef: readiness.actionRef,
    receiptId: readiness.receiptId,
    envelopeHash: readiness.envelopeHash,
    recommendedAction: readiness.recommendedAction,
    executionPlanHash: readiness.executionPlanHash,
    ...(readiness.checkpointRef !== undefined
      ? { checkpointRef: readiness.checkpointRef }
      : {}),
    hostExecutorDescriptorId: readiness.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: readiness.hostExecutorDescriptorHash,
    authorizationIdentityHash: readiness.authorizationIdentityHash,
    adapterId: readiness.adapterId,
    adapterKind: "sandbox_reference_adapter",
    adapterDescriptorHash: readiness.adapterDescriptorHash,
    sandboxScopeRef: "sandbox:phase16-sandbox-dry-run",
    sideEffectBoundary: "sandbox_only",
    evidenceRefs: ["evidence:phase16-sandbox-contract"]
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
