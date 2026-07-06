import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  authorizeGovernanceOperatorActionHostExecutorReview,
  createGovernanceOperatorActionEnvelope,
  createGovernanceOperatorActionReceipt,
  createInMemoryGovernanceOperatorActionReceiptStore,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL,
  hashGovernanceOperatorActionAgentExecutorAdapterDescriptor,
  hashGovernanceOperatorActionExecutionPlan,
  hashGovernanceOperatorActionHostExecutorDescriptor,
  planGovernanceOperatorActionExecution,
  RecoveryOperatorActionSchema,
  reviewGovernanceOperatorActionAgentExecutorAdapterReadiness,
  runGovernanceOperatorActionAgentExecutorAdapterSandboxContract,
  validateAndConsumeGovernanceOperatorActionReceipt,
  type GovernanceOperatorActionAgentExecutorAdapterDescriptorInput,
  type GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  type GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEvent,
  type GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation,
  type GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionExecutionGateResult,
  type GovernanceOperatorActionHostExecutorAuthorizationResult,
  type GovernanceOperatorActionHostExecutorDescriptorInput,
  type RecoveryAction
} from "../packages/governance-internal-recovery-control/src/index.js";
import {
  createPhase15SandboxAdapterContractRunId,
  Phase15SandboxReferenceAgentExecutorAdapter
} from "./fixtures/phase15-sandbox-reference-agent-executor-adapter.js";

test("phase15 sandbox adapter contract run writes a sandbox artifact for fork", async () => {
  const context = await createApprovedAdapterContractContext({ recommendedAction: "fork" });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase15-sandbox-adapter-fork-"));
  const auditEvents: GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEvent[] = [];

  const result = await runGovernanceOperatorActionAgentExecutorAdapterSandboxContract({
    ...context.contractInput,
    adapter: new Phase15SandboxReferenceAgentExecutorAdapter({
      sandboxRoot,
      now: () => "2026-07-06T01:00:00.000Z"
    }),
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(result.status, "completed");
  assert.equal(result.adapterStatus, "completed");
  assert.match(result.adapterResultRef ?? "", /^artifact:phase15-sandbox-adapter:[a-f0-9]{64}$/);
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "completed"]);

  const runId = createPhase15SandboxAdapterContractRunId(
    createExpectedSandboxContractInvocationIdentity(
      context.readiness,
      context.sandboxContractPacket
    )
  );
  const runEntries = await readdir(join(sandboxRoot, runId));
  assert.deepEqual(runEntries.sort(), [
    "contract.json",
    "fork.completed.json",
    "lineage",
    "status.json"
  ]);

  const contractRecord = await readJson(join(sandboxRoot, runId, "contract.json"));
  assert.equal(contractRecord.adapterKind, "sandbox_reference_adapter");
  assert.equal(contractRecord.recommendedAction, "fork");
  assert.equal(contractRecord.status, "accepted");
  assert.equal(typeof contractRecord.actionRefHash, "string");
  assert.equal(JSON.stringify(contractRecord).includes(context.gate.actionRef ?? ""), false);
  assert.equal(JSON.stringify(contractRecord).includes("execution-observation:o1"), false);
});

test("phase15 sandbox adapter contract run is not called when audit sink is missing", async () => {
  const context = await createApprovedAdapterContractContext({ recommendedAction: "fork" });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase15-sandbox-adapter-no-audit-"));

  const result = await runGovernanceOperatorActionAgentExecutorAdapterSandboxContract({
    ...context.contractInput,
    adapter: new Phase15SandboxReferenceAgentExecutorAdapter({ sandboxRoot })
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_sandbox_contract_audit_sink_required"
  ));
  assert.deepEqual(await readdir(sandboxRoot), []);
});

test("phase15 sandbox adapter contract run blocks before adapter when packet drifts", async () => {
  const context = await createApprovedAdapterContractContext({ recommendedAction: "fork" });
  let adapterCalls = 0;

  const result = await runGovernanceOperatorActionAgentExecutorAdapterSandboxContract({
    ...context.contractInput,
    sandboxContractPacket: {
      ...context.sandboxContractPacket,
      adapterDescriptorHash: "0".repeat(64)
    },
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
    "operator_action_agent_executor_adapter_sandbox_contract_packet_descriptor_hash_mismatch"
  ));
  assert.equal(adapterCalls, 0);
});

test("phase15 sandbox adapter contract run hashes rollback checkpoint refs", async () => {
  const checkpointRef = "checkpoint:recovery-task:phase15-rollback-target";
  const context = await createApprovedAdapterContractContext({
    recommendedAction: "rollback",
    checkpointRef
  });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase15-sandbox-adapter-rollback-"));

  const result = await runGovernanceOperatorActionAgentExecutorAdapterSandboxContract({
    ...context.contractInput,
    adapter: new Phase15SandboxReferenceAgentExecutorAdapter({
      sandboxRoot,
      now: () => "2026-07-06T01:01:00.000Z"
    }),
    auditSink: {
      record() {}
    }
  });

  assert.equal(result.status, "completed");
  const runId = createPhase15SandboxAdapterContractRunId(
    createExpectedSandboxContractInvocationIdentity(
      context.readiness,
      context.sandboxContractPacket
    )
  );
  const contractRecord = await readJson(join(sandboxRoot, runId, "contract.json"));
  const statusRecord = await readJson(join(sandboxRoot, runId, "rollback.completed.json"));
  const serializedRecords = JSON.stringify([contractRecord, statusRecord]);

  assert.equal(typeof contractRecord.checkpointRefHash, "string");
  assert.equal(serializedRecords.includes(checkpointRef), false);
});

test("phase15 sandbox adapter contract run fails closed on unsafe adapter refs", async () => {
  const context = await createApprovedAdapterContractContext({ recommendedAction: "fork" });
  const auditEvents: GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEvent[] = [];

  const result = await runGovernanceOperatorActionAgentExecutorAdapterSandboxContract({
    ...context.contractInput,
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
    }
  });

  assert.equal(result.status, "failed");
  assert.ok(result.reasons.includes(
    "operator_action_agent_executor_adapter_sandbox_contract_adapter_failed"
  ));
  assert.equal(result.errorClass, "zoderror");
  assert.equal(JSON.stringify(result).includes("token-secret"), false);
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "failed"]);
});

test("phase15 sandbox adapter contract run rejects symlink run directory escapes", async () => {
  const context = await createApprovedAdapterContractContext({ recommendedAction: "fork" });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase15-sandbox-adapter-symlink-root-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "phase15-sandbox-adapter-outside-"));
  const runId = createPhase15SandboxAdapterContractRunId(
    createExpectedSandboxContractInvocationIdentity(
      context.readiness,
      context.sandboxContractPacket
    )
  );
  const auditEvents: GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEvent[] = [];
  await symlink(outsideRoot, join(sandboxRoot, runId), "dir");

  const result = await runGovernanceOperatorActionAgentExecutorAdapterSandboxContract({
    ...context.contractInput,
    adapter: new Phase15SandboxReferenceAgentExecutorAdapter({ sandboxRoot }),
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(result.errorClass, "phase15_sandbox_symlink_escape");
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "failed"]);
  assert.deepEqual(await readdir(outsideRoot), []);
});

async function createApprovedAdapterContractContext(options: {
  recommendedAction: RecoveryAction;
  checkpointRef?: string;
}): Promise<{
  envelope: GovernanceOperatorActionEnvelope;
  gate: GovernanceOperatorActionExecutionGateResult;
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  sandboxContractPacket: GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket;
  contractInput: {
    executionGate: GovernanceOperatorActionExecutionGateResult;
    lifecycleState: unknown;
    authorizationPacket: unknown;
    hostExecutorDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput;
    hostExecutorAuthorization: GovernanceOperatorActionHostExecutorAuthorizationResult;
    adapterDescriptor: GovernanceOperatorActionAgentExecutorAdapterDescriptorInput;
    adapterReviewPacket: unknown;
    adapterReadiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    sandboxContractPacket: GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket;
  };
}> {
  const actionIssuedAt = "2026-07-06T01:00:00.000Z";
  const envelope = createTestOperatorActionEnvelope(options);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const receipt = createGovernanceOperatorActionReceipt({
    envelope,
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    actionIssuedAt,
    createdAt: "2026-07-06T01:00:30.000Z",
    evidenceRefs: [...envelope.evidenceRefs]
  });
  const consumption = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-07-06T01:01:00.000Z",
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

  const sandboxContractPacket = createTestSandboxContractPacket(readiness);

  return {
    envelope,
    gate,
    readiness,
    sandboxContractPacket,
    contractInput: {
      executionGate: gate,
      lifecycleState,
      authorizationPacket,
      hostExecutorDescriptor: hostDescriptor,
      hostExecutorAuthorization: hostAuthorization,
      adapterDescriptor,
      adapterReviewPacket,
      adapterReadiness: readiness,
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
    summary: `${options.recommendedAction} through phase15 sandbox adapter contract`,
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
    descriptorId: "host-executor:phase15-sandbox-reference",
    descriptorKind: "injected_host_executor",
    executionMode: "review_only",
    sideEffectBoundary: "recovery_action_review",
    dispatchSupported: false,
    supportedActions,
    evidenceRefs: ["evidence:phase15-host-descriptor"]
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
    evidenceRefs: ["evidence:phase15-host-authorization"]
  };
}

function createTestAgentExecutorAdapterDescriptor(
  hostDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput,
  supportedActions: RecoveryAction[]
): GovernanceOperatorActionAgentExecutorAdapterDescriptorInput {
  return {
    schemaVersion: "governance-operator-action-agent-executor-adapter-descriptor.v1",
    adapterId: "agent-executor-adapter:phase15-sandbox-reference",
    adapterKind: "sandbox_reference_adapter",
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
    evidenceRefs: ["evidence:phase15-adapter-review"]
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
    sandboxScopeRef: "sandbox:phase15-agent-executor-adapter-contract",
    sideEffectBoundary: "sandbox_only",
    evidenceRefs: ["evidence:phase15-sandbox-contract"]
  };
}

function createExpectedSandboxContractInvocationIdentity(
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  packet: GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket
): Pick<
  GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation,
  | "contractMode"
  | "taskId"
  | "actionRef"
  | "receiptId"
  | "envelopeHash"
  | "recommendedAction"
  | "executionPlanHash"
  | "checkpointRef"
  | "hostExecutorDescriptorId"
  | "hostExecutorDescriptorHash"
  | "authorizationIdentityHash"
  | "adapterId"
  | "adapterKind"
  | "adapterDescriptorHash"
  | "sandboxScopeRef"
  | "sideEffectBoundary"
> {
  assert.ok(readiness.taskId);
  assert.ok(readiness.actionRef);
  assert.ok(readiness.receiptId);
  assert.ok(readiness.envelopeHash);
  assert.ok(readiness.recommendedAction);
  assert.ok(readiness.executionPlanHash);
  assert.ok(readiness.hostExecutorDescriptorId);
  assert.ok(readiness.hostExecutorDescriptorHash);
  assert.ok(readiness.authorizationIdentityHash);

  return {
    contractMode: "sandbox_contract",
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
    adapterId: packet.adapterId,
    adapterKind: packet.adapterKind,
    adapterDescriptorHash: packet.adapterDescriptorHash,
    sandboxScopeRef: packet.sandboxScopeRef,
    sideEffectBoundary: packet.sideEffectBoundary
  };
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}
