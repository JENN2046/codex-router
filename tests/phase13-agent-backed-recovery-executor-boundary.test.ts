import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, symlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  authorizeGovernanceOperatorActionHostExecutorReview,
  createGovernanceOperatorActionEnvelope,
  createGovernanceOperatorActionReceipt,
  createInMemoryGovernanceOperatorActionReceiptStore,
  dispatchGovernanceOperatorActionHostExecutor,
  hashGovernanceOperatorActionExecutionPlan,
  hashGovernanceOperatorActionHostExecutorDescriptor,
  planGovernanceOperatorActionExecution,
  RecoveryOperatorActionSchema,
  validateAndConsumeGovernanceOperatorActionReceipt,
  type GovernanceOperatorActionEnvelope,
  type GovernanceOperatorActionExecutionGateResult,
  type GovernanceOperatorActionHostExecutorAuthorizationResult,
  type GovernanceOperatorActionHostExecutorDispatchAuditEvent,
  type GovernanceOperatorActionHostExecutorDispatchInvocation,
  type GovernanceOperatorActionHostExecutorDescriptorInput,
  type RecoveryAction
} from "../packages/governance-internal-recovery-control/src/index.js";
import {
  createPhase13SandboxReferenceRunId,
  Phase13SandboxReferenceRecoveryExecutor
} from "./fixtures/phase13-sandbox-reference-recovery-executor.js";

test("phase13 sandbox reference executor dispatches approved fork into sandbox", async () => {
  const context = await createApprovedDispatchContext({ recommendedAction: "fork" });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase13-sandbox-reference-fork-"));
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    ...context.dispatchInput,
    dispatchMode: "execute_injected",
    executor: new Phase13SandboxReferenceRecoveryExecutor({
      sandboxRoot,
      now: () => "2026-07-06T00:00:00.000Z"
    }),
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(dispatch.status, "dispatched");
  assert.match(dispatch.executorResultRef ?? "", /^artifact:phase13-sandbox-reference:[a-f0-9]{64}$/);
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "dispatched"]);

  const runId = createPhase13SandboxReferenceRunId(
    createExpectedSandboxInvocationIdentity(context.authorization)
  );
  const runEntries = await readdir(join(sandboxRoot, runId));
  assert.deepEqual(runEntries.sort(), [
    "action.json",
    "fork.completed.json",
    "lineage",
    "status.json"
  ]);

  const actionRecord = await readJson(join(sandboxRoot, runId, "action.json"));
  assert.equal(actionRecord.executorKind, "sandbox_reference");
  assert.equal(actionRecord.recommendedAction, "fork");
  assert.equal(actionRecord.status, "accepted");
  assert.equal(typeof actionRecord.actionRefHash, "string");
  assert.equal(JSON.stringify(actionRecord).includes(context.gate.actionRef ?? ""), false);
  assert.equal(JSON.stringify(actionRecord).includes("execution-observation:o1"), false);
});

test("phase13 sandbox reference executor is not called when audit sink is missing", async () => {
  const context = await createApprovedDispatchContext({ recommendedAction: "fork" });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase13-sandbox-reference-no-audit-"));

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    ...context.dispatchInput,
    dispatchMode: "execute_injected",
    executor: new Phase13SandboxReferenceRecoveryExecutor({ sandboxRoot })
  });

  assert.equal(dispatch.status, "blocked");
  assert.ok(dispatch.reasons.includes(
    "operator_action_host_executor_dispatch_audit_sink_required"
  ));
  assert.deepEqual(await readdir(sandboxRoot), []);
});

test("phase13 sandbox reference executor hashes rollback checkpoint refs", async () => {
  const checkpointRef = "checkpoint:recovery-task:phase13-rollback-target";
  const context = await createApprovedDispatchContext({
    recommendedAction: "rollback",
    checkpointRef
  });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase13-sandbox-reference-rollback-"));

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    ...context.dispatchInput,
    dispatchMode: "execute_injected",
    executor: new Phase13SandboxReferenceRecoveryExecutor({
      sandboxRoot,
      now: () => "2026-07-06T00:01:00.000Z"
    }),
    auditSink: {
      record() {}
    }
  });

  assert.equal(dispatch.status, "dispatched");
  const runId = createPhase13SandboxReferenceRunId(
    createExpectedSandboxInvocationIdentity(context.authorization)
  );
  const actionRecord = await readJson(join(sandboxRoot, runId, "action.json"));
  const statusRecord = await readJson(join(sandboxRoot, runId, "rollback.completed.json"));
  const serializedRecords = JSON.stringify([actionRecord, statusRecord]);

  assert.equal(typeof actionRecord.checkpointRefHash, "string");
  assert.equal(serializedRecords.includes(checkpointRef), false);
});

test("phase13 sandbox reference executor maps resume and abort to sandbox status files", async () => {
  for (const recommendedAction of ["resume", "abort"] as const) {
    const context = await createApprovedDispatchContext({ recommendedAction });
    const sandboxRoot = await mkdtemp(
      join(tmpdir(), `phase13-sandbox-reference-${recommendedAction}-`)
    );

    const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
      ...context.dispatchInput,
      dispatchMode: "execute_injected",
      executor: new Phase13SandboxReferenceRecoveryExecutor({
        sandboxRoot,
        now: () => "2026-07-06T00:02:00.000Z"
      }),
      auditSink: {
        record() {}
      }
    });

    assert.equal(dispatch.status, "dispatched");
    const runId = createPhase13SandboxReferenceRunId(
      createExpectedSandboxInvocationIdentity(context.authorization)
    );
    const statusRecord = await readJson(
      join(sandboxRoot, runId, `${recommendedAction}.completed.json`)
    );
    assert.equal(statusRecord.recommendedAction, recommendedAction);
    assert.equal(statusRecord.completionMeaning, "dispatch_transaction_completed");
  }
});

test("phase13 dispatch fails closed when an executor returns unsafe evidence refs", async () => {
  const context = await createApprovedDispatchContext({ recommendedAction: "fork" });
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    ...context.dispatchInput,
    dispatchMode: "execute_injected",
    executor: {
      dispatch() {
        return {
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

  assert.equal(dispatch.status, "failed");
  assert.ok(dispatch.reasons.includes("operator_action_host_executor_dispatch_executor_failed"));
  assert.equal(dispatch.errorClass, "zoderror");
  assert.equal(JSON.stringify(dispatch).includes("token-secret"), false);
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "failed"]);
});

test("phase13 sandbox reference executor rejects symlink run directory escapes", async () => {
  const context = await createApprovedDispatchContext({ recommendedAction: "fork" });
  const sandboxRoot = await mkdtemp(join(tmpdir(), "phase13-sandbox-reference-symlink-root-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "phase13-sandbox-reference-outside-"));
  const runId = createPhase13SandboxReferenceRunId(
    createExpectedSandboxInvocationIdentity(context.authorization)
  );
  const auditEvents: GovernanceOperatorActionHostExecutorDispatchAuditEvent[] = [];
  await symlink(outsideRoot, join(sandboxRoot, runId), "dir");

  const dispatch = await dispatchGovernanceOperatorActionHostExecutor({
    ...context.dispatchInput,
    dispatchMode: "execute_injected",
    executor: new Phase13SandboxReferenceRecoveryExecutor({ sandboxRoot }),
    auditSink: {
      record(event) {
        auditEvents.push(event);
      }
    }
  });

  assert.equal(dispatch.status, "failed");
  assert.equal(dispatch.errorClass, "phase13_sandbox_symlink_escape");
  assert.deepEqual(auditEvents.map((event) => event.status), ["attempting", "failed"]);
  assert.deepEqual(await readdir(outsideRoot), []);
});

async function createApprovedDispatchContext(options: {
  recommendedAction: RecoveryAction;
  checkpointRef?: string;
}): Promise<{
  envelope: GovernanceOperatorActionEnvelope;
  gate: GovernanceOperatorActionExecutionGateResult;
  authorization: GovernanceOperatorActionHostExecutorAuthorizationResult;
  dispatchInput: {
    executionGate: GovernanceOperatorActionExecutionGateResult;
    lifecycleState: unknown;
    authorizationPacket: unknown;
    hostExecutorDescriptor: GovernanceOperatorActionHostExecutorDescriptorInput;
    authorization: GovernanceOperatorActionHostExecutorAuthorizationResult;
  };
}> {
  const actionIssuedAt = "2026-07-06T00:00:00.000Z";
  const envelope = createTestOperatorActionEnvelope(options);
  const store = createInMemoryGovernanceOperatorActionReceiptStore();
  const receipt = createGovernanceOperatorActionReceipt({
    envelope,
    decision: "consumed",
    operatorIdHash: "a".repeat(64),
    actionIssuedAt,
    createdAt: "2026-07-06T00:00:30.000Z",
    evidenceRefs: [...envelope.evidenceRefs]
  });
  const consumption = await validateAndConsumeGovernanceOperatorActionReceipt({
    store,
    envelope,
    receipt,
    actionIssuedAt,
    now: "2026-07-06T00:01:00.000Z",
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

  const descriptor = createTestHostExecutorDescriptor([options.recommendedAction]);
  const authorizationPacket = createTestHostExecutorAuthorizationPacket(gate, descriptor);
  const authorization = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: gate,
    lifecycleState,
    authorizationPacket,
    hostExecutorDescriptor: descriptor
  });
  assert.equal(authorization.status, "ready_for_host_executor_review");

  return {
    envelope,
    gate,
    authorization,
    dispatchInput: {
      executionGate: gate,
      lifecycleState,
      authorizationPacket,
      hostExecutorDescriptor: descriptor,
      authorization
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
    summary: `${options.recommendedAction} through sandbox reference executor`,
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
    descriptorId: "host-executor:sandbox-reference",
    descriptorKind: "injected_host_executor",
    executionMode: "review_only",
    sideEffectBoundary: "recovery_action_review",
    dispatchSupported: false,
    supportedActions,
    evidenceRefs: ["evidence:phase13-sandbox-reference-descriptor"]
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
    evidenceRefs: ["evidence:phase13-sandbox-reference-authorization"]
  };
}

function createExpectedSandboxInvocationIdentity(
  authorization: GovernanceOperatorActionHostExecutorAuthorizationResult
): Pick<
  GovernanceOperatorActionHostExecutorDispatchInvocation,
  | "dispatchMode"
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
> {
  assert.ok(authorization.taskId);
  assert.ok(authorization.actionRef);
  assert.ok(authorization.receiptId);
  assert.ok(authorization.envelopeHash);
  assert.ok(authorization.recommendedAction);
  assert.ok(authorization.executionPlanHash);
  assert.ok(authorization.hostExecutorDescriptorId);
  assert.ok(authorization.hostExecutorDescriptorHash);
  assert.ok(authorization.authorizationIdentityHash);

  return {
    dispatchMode: "execute_injected",
    taskId: authorization.taskId,
    actionRef: authorization.actionRef,
    receiptId: authorization.receiptId,
    envelopeHash: authorization.envelopeHash,
    recommendedAction: authorization.recommendedAction,
    executionPlanHash: authorization.executionPlanHash,
    ...(authorization.checkpointRef !== undefined
      ? { checkpointRef: authorization.checkpointRef }
      : {}),
    hostExecutorDescriptorId: authorization.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: authorization.hostExecutorDescriptorHash,
    authorizationIdentityHash: authorization.authorizationIdentityHash
  };
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}
