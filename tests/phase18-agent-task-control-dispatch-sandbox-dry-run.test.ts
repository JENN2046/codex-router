import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  authorizeGovernanceOperatorActionHostExecutorReview,
  createGovernanceOperatorActionEnvelope,
  createGovernanceOperatorActionReceipt,
  createInMemoryGovernanceOperatorActionReceiptStore,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
  GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
  GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
  GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_APPROVAL,
  hashGovernanceOperatorActionAgentExecutorAdapterDescriptor,
  hashGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult,
  hashGovernanceOperatorActionAgentExecutorAdapterReviewResult,
  hashGovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResult,
  hashGovernanceOperatorActionExecutionGateResult,
  hashGovernanceOperatorActionExecutionPlan,
  hashGovernanceOperatorActionHostExecutorDescriptor,
  planGovernanceOperatorActionExecution,
  RecoveryOperatorActionSchema,
  reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization,
  reviewGovernanceOperatorActionAgentExecutorAdapterReadiness,
  reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization,
  runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun,
  validateAndConsumeGovernanceOperatorActionReceipt,
  type GovernanceOperatorActionAgentExecutorAdapterDescriptorInput,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchClass,
  type GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass,
  type GovernanceOperatorActionAgentExecutorAdapterKind,
  type GovernanceOperatorActionAgentExecutorAdapterReviewResult,
  type GovernanceOperatorActionAgentTaskControlDispatchAuthorizationPacket,
  type GovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResult,
  type GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAuditEvent,
  type GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunPacket,
  type GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunResult,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionExecutionGateResult,
  type GovernanceOperatorActionHostExecutorAuthorizationResult,
  type GovernanceOperatorActionHostExecutorDescriptorInput,
  type RecoveryAction
} from "../packages/governance-internal-recovery-control/src/index.js";
import { Phase18SandboxTaskControlAdapter } from "./fixtures/phase18-sandbox-task-control-adapter.js";

test("phase18 task-control sandbox dry-run calls injected sandbox adapter and records sanitized evidence", async () => {
  const context = await createApprovedTaskControlSandboxDryRunContext({
    recommendedAction: "fork"
  });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase18-task-control-fork-"));
  const auditEvents: GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAuditEvent[] = [];
  const evidenceRecords: GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunResult[] = [];

  const result = await runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun({
    ...context.runInput,
    adapter: new Phase18SandboxTaskControlAdapter({
      sandboxRoot,
      now: () => "2026-07-08T01:00:00.000Z"
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
  assert.equal(
    result.approvalString,
    GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_APPROVAL
  );
  assert.equal(result.requestedDispatchClass, "agent_task_control");
  assert.equal(result.requestedSideEffectClass, "agent_context_only");
  assert.equal(result.adapterKind, "sandbox_task_control_adapter");
  assert.equal(result.adapterStatus, "completed");
  assert.equal(
    result.nonAuthorizationDeclaration,
    "phase18_task_control_sandbox_dry_run_no_real_recovery_execution"
  );
  assert.match(
    result.adapterResultRef ?? "",
    /^artifact:phase18-task-control-sandbox:[a-f0-9]{64}$/
  );
  assert.deepEqual(auditEvents.map((event) => event.status), [
    "attempting",
    "completed"
  ]);
  assert.equal(evidenceRecords.length, 1);
  assert.equal(evidenceRecords[0]?.status, "completed");

  const runRoots = await readdir(sandboxRoot);
  assert.equal(runRoots.length, 1);
  const runDir = join(sandboxRoot, runRoots[0] ?? "");
  assert.deepEqual((await readdir(runDir)).sort(), [
    "evidence.json",
    "task-control-receipt.json",
    "task-control-request.json"
  ]);

  const requestText = await readFile(join(runDir, "task-control-request.json"), "utf8");
  assert.equal(requestText.includes(context.authorizationReview.taskId ?? ""), false);
  assert.equal(requestText.includes(context.authorizationReview.actionRef ?? ""), false);
  assert.equal(requestText.includes(context.authorizationReview.receiptId ?? ""), false);
  assert.match(requestText, /"taskIdHash"/);
  assert.match(requestText, /"actionRefHash"/);
});

test("phase18 task-control sandbox dry-run blocks before adapter when evidence sink is missing", async () => {
  const context = await createApprovedTaskControlSandboxDryRunContext({
    recommendedAction: "fork"
  });
  let adapterCalls = 0;

  const result = await runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun({
    ...context.runInput,
    adapter: {
      runTaskControlSandboxDryRun() {
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
    "operator_action_agent_task_control_dispatch_sandbox_dry_run_evidence_sink_required"
  ));
  assert.equal(adapterCalls, 0);
});

test("phase18 task-control sandbox dry-run blocks before adapter when phase17 review hash drifts", async () => {
  const context = await createApprovedTaskControlSandboxDryRunContext({
    recommendedAction: "fork",
    dryRunPacketOverrides: {
      phase17TaskControlAuthorizationReviewHash: "0".repeat(64)
    }
  });
  let adapterCalls = 0;

  const result = await runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun({
    ...context.runInput,
    adapter: {
      runTaskControlSandboxDryRun() {
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
    "operator_action_agent_task_control_dispatch_sandbox_dry_run_packet_phase17_review_hash_mismatch"
  ));
  assert.equal(adapterCalls, 0);
});

test("phase18 task-control sandbox dry-run rejects phase15 sandbox reference adapter kind", async () => {
  const context = await createApprovedTaskControlSandboxDryRunContext({
    recommendedAction: "fork",
    dryRunPacketOverrides: {
      adapterKind: "sandbox_reference_adapter"
    }
  });
  let adapterCalls = 0;

  const result = await runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun({
    ...context.runInput,
    adapter: {
      runTaskControlSandboxDryRun() {
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
    "operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_kind_incompatible"
  ));
  assert.ok(result.reasons.includes(
    "operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_kind_not_sandbox_task_control"
  ));
  assert.equal(adapterCalls, 0);
});

test("phase18 task-control sandbox dry-run records completion evidence only after final audit succeeds", async () => {
  const context = await createApprovedTaskControlSandboxDryRunContext({
    recommendedAction: "fork"
  });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase18-task-control-audit-fail-"));
  const auditEvents: GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAuditEvent[] = [];
  const evidenceRecords: GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunResult[] = [];

  const result = await runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun({
    ...context.runInput,
    adapter: new Phase18SandboxTaskControlAdapter({
      sandboxRoot,
      now: () => "2026-07-08T01:05:00.000Z"
    }),
    auditSink: {
      record(event) {
        if (event.status === "completed") {
          throw new Error("audit unavailable after adapter");
        }
        auditEvents.push(event);
      }
    },
    evidenceSink: {
      record(record) {
        evidenceRecords.push(record);
      }
    }
  });

  assert.equal(result.status, "failed");
  assert.ok(result.reasons.includes(
    "operator_action_agent_task_control_dispatch_sandbox_dry_run_audit_sink_failed"
  ));
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting"]);
  assert.equal(evidenceRecords.length, 0);
});

test("phase18 task-control sandbox dry-run sanitizes adapter failures", async () => {
  const context = await createApprovedTaskControlSandboxDryRunContext({
    recommendedAction: "fork"
  });
  const auditEvents: GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAuditEvent[] = [];

  const result = await runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun({
    ...context.runInput,
    adapter: {
      runTaskControlSandboxDryRun() {
        throw new Error("OPENAI_API_KEY=raw-secret");
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
    "operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_failed"
  ));
  assert.equal(JSON.stringify(result).includes("OPENAI_API_KEY"), false);
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "failed"]);
});

test("phase18 task-control sandbox adapter refuses symlink sandbox roots", async () => {
  const context = await createApprovedTaskControlSandboxDryRunContext({
    recommendedAction: "fork"
  });
  const parent = await mkdtemp(join(tmpdir(), "phase18-task-control-symlink-"));
  const target = join(parent, "target");
  const link = join(parent, "link");
  await mkdir(target);
  await symlink(target, link);

  const result = await runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun({
    ...context.runInput,
    adapter: new Phase18SandboxTaskControlAdapter({
      sandboxRoot: link,
      now: () => "2026-07-08T01:10:00.000Z"
    }),
    auditSink: {
      record() {}
    },
    evidenceSink: {
      record() {}
    }
  });

  assert.equal(result.status, "failed");
  assert.ok(result.reasons.includes(
    "operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_failed"
  ));
  assert.equal(result.errorClass, "phase18_task_control_sandbox_root_not_directory");
});

async function createApprovedTaskControlSandboxDryRunContext(options: {
  recommendedAction: RecoveryAction;
  checkpointRef?: string;
  dryRunPacketOverrides?: Partial<{
    phase17TaskControlAuthorizationReviewHash: string;
    adapterKind: GovernanceOperatorActionAgentExecutorAdapterKind;
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
    permittedTaskControlOperationRef: string;
  }>;
}): Promise<{
  envelope: GovernanceOperatorActionEnvelope;
  gate: GovernanceOperatorActionExecutionGateResult;
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  dispatchAuthorizationReview:
    GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult;
  authorizationReview:
    GovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResult;
  taskControlSandboxDryRunPacket:
    GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunPacket;
  runInput: {
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
    taskControlAuthorizationReview:
      GovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResult;
    taskControlSandboxDryRunPacket:
      GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunPacket;
  };
}> {
  const actionIssuedAt = "2026-07-08T01:00:00.000Z";
  const envelope = createTestOperatorActionEnvelope(options);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const receipt = createGovernanceOperatorActionReceipt({
    envelope,
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    actionIssuedAt,
    createdAt: "2026-07-08T01:00:30.000Z",
    evidenceRefs: [...envelope.evidenceRefs]
  });
  const consumption = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-07-08T01:01:00.000Z",
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
    "sub_agent_adapter"
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

  const dispatchAuthorizationPacket = createTestDispatchAuthorizationPacket(readiness);
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
      gate
    );
  const authorizationReview =
    reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization({
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
    });
  assert.equal(
    authorizationReview.status,
    "ready_for_agent_task_control_dispatch_authorization_review"
  );

  const taskControlSandboxDryRunPacket = createTestTaskControlSandboxDryRunPacket(
    authorizationReview,
    options.dryRunPacketOverrides
  );

  return {
    envelope,
    gate,
    readiness,
    dispatchAuthorizationReview,
    authorizationReview,
    taskControlSandboxDryRunPacket,
    runInput: {
      executionGate: gate,
      lifecycleState,
      authorizationPacket,
      hostExecutorDescriptor: hostDescriptor,
      hostExecutorAuthorization: hostAuthorization,
      adapterDescriptor,
      adapterReviewPacket,
      adapterReadiness: readiness,
      dispatchAuthorizationPacket,
      agentTaskControlDispatchAuthorizationPacket,
      taskControlAuthorizationReview: authorizationReview,
      taskControlSandboxDryRunPacket
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
    summary: `${options.recommendedAction} through phase18 task-control sandbox dry-run`,
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
    descriptorId: "host-executor:phase18-task-control-sandbox-dry-run",
    descriptorKind: "injected_host_executor",
    executionMode: "review_only",
    sideEffectBoundary: "recovery_action_review",
    dispatchSupported: false,
    supportedActions,
    evidenceRefs: ["evidence:phase18-host-descriptor"]
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
    evidenceRefs: ["evidence:phase18-host-authorization"]
  };
}

function createTestAgentExecutorAdapterDescriptor(
  hostDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput,
  supportedActions: RecoveryAction[],
  adapterKind: GovernanceOperatorActionAgentExecutorAdapterKind
): GovernanceOperatorActionAgentExecutorAdapterDescriptorInput {
  return {
    schemaVersion: "governance-operator-action-agent-executor-adapter-descriptor.v1",
    adapterId: `agent-executor-adapter:phase18-${adapterKind}`,
    adapterKind,
    hostExecutorDescriptorId: hostDescriptor.descriptorId,
    executionBoundary: "review_only",
    invocationSupported: false,
    sideEffectBoundary: "none",
    supportedActions,
    evidenceRefs: ["evidence:phase18-adapter-descriptor"]
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
    evidenceRefs: ["evidence:phase18-adapter-review"]
  };
}

function createTestDispatchAuthorizationPacket(
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult
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
    authorizedScopeRef: "scope:phase18-dispatch-review-only",
    ...(readiness.recommendedAction === "rollback"
      ? { rollbackExpectationRef: "expectation:phase18-rollback" }
      : {}),
    abortExpectationRef: "expectation:phase18-abort",
    timeoutPolicyRef: "policy:phase18-timeout",
    auditSinkIdentityRef: "audit-sink:phase18-review",
    evidenceSinkIdentityRef: "evidence-sink:phase18-review",
    receiptContractVersion:
      "governance-operator-action-host-executor-dispatch-executor-result.v1",
    validationCommandRefs: ["validation:phase18-phase16-dispatch-authorization-test"],
    nonAuthorizationDeclaration: "phase16_review_only_no_adapter_invocation",
    evidenceRefs: ["evidence:phase18-dispatch-authorization"]
  };
}

function createTestAgentTaskControlDispatchAuthorizationPacket(
  dispatchAuthorizationReview:
    GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult,
  gate: GovernanceOperatorActionExecutionGateResult
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
    authorizedTaskControlScopeRef: "scope:phase18-agent-task-control",
    hostAgentRuntimeRef: "host-agent-runtime:phase18-review-only",
    hostAgentCapabilityRef: "host-agent-capability:task-control-review-only",
    contextPackageRef: "context-package:phase18-redacted",
    contextPackageHash: stableSha256({
      taskId: dispatchAuthorizationReview.taskId,
      actionRef: dispatchAuthorizationReview.actionRef,
      contextPackageRef: "context-package:phase18-redacted"
    }),
    permittedTaskControlOperationRefs: [operationRef],
    promptContentPolicyRef: "prompt-policy:phase18-redacted-context-only",
    workspaceBoundaryRef: "workspace-boundary:phase18-no-workspace-write",
    ...(dispatchAuthorizationReview.recommendedAction === "rollback"
      ? { rollbackExpectationRef: "expectation:phase18-rollback" }
      : {}),
    abortExpectationRef: "expectation:phase18-abort",
    timeoutPolicyRef: "policy:phase18-task-control-timeout",
    idempotencyKeyHash: stableSha256({
      taskId: dispatchAuthorizationReview.taskId,
      actionRef: dispatchAuthorizationReview.actionRef,
      phase: "phase18-agent-task-control"
    }),
    auditSinkIdentityRef: "audit-sink:phase18-review",
    evidenceSinkIdentityRef: "evidence-sink:phase18-review",
    receiptContractVersion:
      "governance-operator-action-host-executor-dispatch-executor-result.v1",
    validationCommandRefs: [
      "validation:phase18-agent-task-control-dispatch-authorization-test"
    ],
    nonAuthorizationDeclaration:
      "phase17_agent_task_control_review_only_no_adapter_invocation",
    evidenceRefs: ["evidence:phase18-agent-task-control-review"]
  };
}

function createTestTaskControlSandboxDryRunPacket(
  authorizationReview:
    GovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResult,
  overrides: Partial<{
    phase17TaskControlAuthorizationReviewHash: string;
    adapterKind: GovernanceOperatorActionAgentExecutorAdapterKind;
    requestedDispatchClass: GovernanceOperatorActionAgentExecutorAdapterDispatchClass;
    requestedSideEffectClass: GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass;
    permittedTaskControlOperationRef: string;
  }> = {}
): GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunPacket {
  assert.ok(authorizationReview.taskId);
  assert.ok(authorizationReview.actionRef);
  assert.ok(authorizationReview.receiptId);
  assert.ok(authorizationReview.envelopeHash);
  assert.ok(authorizationReview.recommendedAction);
  assert.ok(authorizationReview.executionPlanHash);
  assert.ok(authorizationReview.executionGateHash);
  assert.ok(authorizationReview.hostExecutorDescriptorId);
  assert.ok(authorizationReview.hostExecutorDescriptorHash);
  assert.ok(authorizationReview.authorizationIdentityHash);
  assert.ok(authorizationReview.adapterReadinessHash);
  assert.ok(authorizationReview.phase16DispatchAuthorizationReviewHash);
  assert.ok(authorizationReview.authorizedTaskControlScopeRef);
  assert.ok(authorizationReview.hostAgentRuntimeRef);
  assert.ok(authorizationReview.hostAgentCapabilityRef);
  assert.ok(authorizationReview.contextPackageRef);
  assert.ok(authorizationReview.contextPackageHash);
  assert.ok(authorizationReview.permittedTaskControlOperationRefs[0]);
  assert.ok(authorizationReview.promptContentPolicyRef);
  assert.ok(authorizationReview.workspaceBoundaryRef);
  assert.ok(authorizationReview.abortExpectationRef);
  assert.ok(authorizationReview.timeoutPolicyRef);
  assert.ok(authorizationReview.idempotencyKeyHash);
  assert.ok(authorizationReview.auditSinkIdentityRef);
  assert.ok(authorizationReview.evidenceSinkIdentityRef);
  assert.ok(authorizationReview.receiptContractVersion);

  return {
    schemaVersion:
      "governance-operator-action-agent-task-control-dispatch-sandbox-dry-run-packet.v1",
    approvalString:
      GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_APPROVAL,
    authorizationReviewApprovalString:
      GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
    taskId: authorizationReview.taskId,
    actionRef: authorizationReview.actionRef,
    receiptId: authorizationReview.receiptId,
    envelopeHash: authorizationReview.envelopeHash,
    recommendedAction: authorizationReview.recommendedAction,
    executionPlanHash: authorizationReview.executionPlanHash,
    ...(authorizationReview.checkpointRefHash !== undefined
      ? { checkpointRefHash: authorizationReview.checkpointRefHash }
      : {}),
    executionGateHash: authorizationReview.executionGateHash,
    hostExecutorDescriptorId: authorizationReview.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: authorizationReview.hostExecutorDescriptorHash,
    authorizationIdentityHash: authorizationReview.authorizationIdentityHash,
    adapterId: "agent-task-control-adapter:phase18-sandbox",
    adapterKind: "sandbox_task_control_adapter",
    adapterDescriptorHash: stableSha256({
      adapterId: "agent-task-control-adapter:phase18-sandbox",
      adapterKind: "sandbox_task_control_adapter"
    }),
    adapterReadinessHash: authorizationReview.adapterReadinessHash,
    phase16DispatchAuthorizationReviewHash:
      authorizationReview.phase16DispatchAuthorizationReviewHash,
    phase17TaskControlAuthorizationReviewHash:
      hashGovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResult(
        authorizationReview
      ),
    requestedDispatchClass: "agent_task_control",
    requestedSideEffectClass: "agent_context_only",
    authorizedTaskControlScopeRef: authorizationReview.authorizedTaskControlScopeRef,
    hostAgentRuntimeRef: authorizationReview.hostAgentRuntimeRef,
    hostAgentCapabilityRef: authorizationReview.hostAgentCapabilityRef,
    contextPackageRef: authorizationReview.contextPackageRef,
    contextPackageHash: authorizationReview.contextPackageHash,
    permittedTaskControlOperationRef:
      authorizationReview.permittedTaskControlOperationRefs[0],
    promptContentPolicyRef: authorizationReview.promptContentPolicyRef,
    workspaceBoundaryRef: authorizationReview.workspaceBoundaryRef,
    sandboxScopeRef: "sandbox:phase18-task-control-dry-run",
    sandboxRootBindingHash: stableSha256("target/phase18-task-control-sandbox"),
    ...(authorizationReview.rollbackExpectationRef !== undefined
      ? { rollbackExpectationRef: authorizationReview.rollbackExpectationRef }
      : {}),
    abortExpectationRef: authorizationReview.abortExpectationRef,
    timeoutPolicyRef: authorizationReview.timeoutPolicyRef,
    idempotencyKeyHash: authorizationReview.idempotencyKeyHash,
    auditSinkIdentityRef: authorizationReview.auditSinkIdentityRef,
    evidenceSinkIdentityRef: authorizationReview.evidenceSinkIdentityRef,
    receiptContractVersion: authorizationReview.receiptContractVersion,
    validationCommandRefs: ["validation:phase18-task-control-sandbox-dry-run-test"],
    nonAuthorizationDeclaration:
      "phase18_task_control_sandbox_dry_run_no_real_recovery_execution",
    evidenceRefs: ["evidence:phase18-task-control-sandbox-dry-run"],
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
