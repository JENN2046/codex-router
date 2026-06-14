import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_OS_MCP_ARTIFACT_NOT_FOUND,
  AGENT_OS_MCP_APPROVAL_PERMIT_DUPLICATE,
  AGENT_OS_MCP_APPROVAL_SCOPE_OUTSIDE_PLAN,
  AGENT_OS_MCP_APPROVAL_STORE_NOT_CONFIGURED,
  AGENT_OS_MCP_LOCAL_MUTATION_DISABLED,
  AGENT_OS_MCP_RUN_NOT_FOUND,
  AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED,
  AGENT_OS_MCP_TOOL_CAPABILITY_MISSING,
  createAgentOsMcpLocalRuntime
} from "../packages/protocol-mcp/src/index.js";
import {
  InMemoryKernelStore
} from "../packages/kernel-store/src/index.js";
import {
  InMemoryProviderExecutionPlanStore
} from "../packages/execution-planner/src/index.js";
import {
  ProviderRegistry
} from "../packages/provider-registry/src/index.js";
import {
  CodexCliExecutorProvider
} from "../packages/providers/codex-cli/src/index.js";
import {
  ArtifactSchema,
  CapabilityScopeSchema,
  EventSchema,
  PolicyDecisionSchema,
  SandboxProfileSchema,
  type Artifact,
  type Event,
  type PolicyDecision
} from "../packages/kernel-contracts/src/index.js";
import {
  createApprovalPermit,
  hashApprovalScope,
  InMemoryApprovalPermitStore
} from "../packages/approval-permit/src/index.js";
import { validArtifact } from "../packages/kernel-contracts/test-fixtures/valid-artifact.js";
import { validEvent } from "../packages/kernel-contracts/test-fixtures/valid-event.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";

const now = "2026-06-10T00:00:00.000Z";
const taskId = "task_agentos_mcp_runtime_001";
const runId = "run_agentos_mcp_runtime_001";

test("Agent OS MCP local runtime blocks mutating task creation by default", () => {
  const kernelStore = new InMemoryKernelStore();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    principal: validPrincipal,
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  });

  const result = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a task through the local MCP wrapper."
    }
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_CAPABILITY_MISSING}:task.create`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED}:agentos.create_task`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_LOCAL_MUTATION_DISABLED}:agentos.create_task`));
  assert.equal(result.audit.liveMcpServerConnection, false);
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationApplied, false);
  assert.deepEqual(kernelStore.listRuns(), []);
});

test("Agent OS MCP local runtime creates a governed run and provider plan without execution", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createEligibility(policyDecision),
    grantedCapabilities: ["task.create", "run.read", "event.read"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  });

  const result = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a task through the local MCP wrapper.",
      successCriteria: ["run is queued", "provider plan is stored"],
      outOfScope: ["real provider execution"],
      repoRoot: "A:/AGENTS_OS_Workspace/governance/codex-router/repo",
      branch: "feature/phase-4-provider-execution-runner",
      targetFiles: ["packages/protocol-mcp/src/agent-os-local-runtime.ts"],
      metadata: {
        source: "phase-8-test"
      }
    }
  });

  const providerPlanId = result.output.providerPlanId;
  assert.equal(result.status, "succeeded");
  assert.equal(result.output.taskId, taskId);
  assert.equal(result.output.runId, runId);
  assert.equal(result.output.status, "queued");
  assert.equal(result.output.providerPlanStatus, "planned");
  assert.equal(result.audit.liveMcpServerConnection, false);
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationApplied, true);
  assert.equal(typeof providerPlanId, "string");

  const storedTask = kernelStore.getTask(taskId);
  const storedRun = kernelStore.getRun(runId);
  assert.equal(storedTask?.taskId, taskId);
  assert.equal(storedTask?.requestedAction, "Create a task through the local MCP wrapper.");
  assert.equal(storedRun?.taskId, taskId);
  assert.equal(storedRun?.policyDecisionId, policyDecision.decisionId);
  assert.equal(planStore.getPlan(String(providerPlanId))?.providerId, "codex-cli");
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    ["kernel.run.created", "kernel.public_surface.mcp.create_task"]
  );

  const getRun = runtime.handleToolCall({
    toolName: "agentos.get_run",
    input: { runId },
    grantedCapabilities: ["run.read"]
  });
  assert.equal(getRun.status, "succeeded");
  assert.equal((getRun.output.run as { runId?: string }).runId, runId);

  const searchEvents = runtime.handleToolCall({
    toolName: "agentos.search_events",
    input: {
      runId,
      eventTypes: ["kernel.public_surface.mcp.create_task"]
    },
    grantedCapabilities: ["event.read"]
  });
  assert.equal(searchEvents.status, "succeeded");
  assert.deepEqual(
    (searchEvents.output.events as Array<{ eventType: string }>).map((event) => event.eventType),
    ["kernel.public_surface.mcp.create_task"]
  );
});

test("Agent OS MCP local runtime consumes approval permits into a planned provider plan", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createWaitingEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId,
    createPermitId: () => "permit_agentos_mcp_runtime_consumed"
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run that waits for approval."
    }
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "waiting_approval");
  assert.equal(planStore.listPlans({ runId }).length, 1);

  const approve = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/**"],
      reason: "review approval"
    }
  });

  const plans = planStore.listPlans({ runId });
  const latestPlan = plans.at(-1);
  assert.equal(approve.status, "succeeded");
  assert.equal(approve.output.consumedProviderPlanId, latestPlan?.planId);
  assert.deepEqual(approve.output.approvalConsumptionReasons, [
    "approval_permit_consumed"
  ]);
  assert.equal(plans.length, 2);
  assert.equal(plans[0]?.status, "waiting_approval");
  assert.equal(latestPlan?.status, "planned");
  assert.ok(latestPlan?.reasons.includes("valid_approval_permit"));
  assert.equal(approve.audit.realProviderExecutionInvoked, false);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.mcp.create_task",
      "kernel.approval.permit.issued",
      "kernel.approval.permit.consumed"
    ]
  );
});

test("Agent OS MCP local runtime records revoked permits during approval consumption", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createWaitingEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId,
    createPermitId: () => "permit_agentos_mcp_runtime_valid_after_revoked"
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run with a revoked approval candidate."
    }
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "waiting_approval");

  const waitingPlan = planStore.listPlans({ runId }).at(-1);
  assert.ok(waitingPlan);
  permitStore.savePermit(createApprovalPermit({
    permitId: "permit_agentos_mcp_runtime_revoked_candidate",
    taskId,
    runId,
    principalId: validPrincipal.principalId,
    approverId: validPrincipal.principalId,
    policyDecisionHash: waitingPlan.policyDecisionHash,
    planHash: hashApprovalScope(waitingPlan),
    capabilityScopes: ["fs.read:workspace/**"],
    createdAt: "2026-06-10T00:00:00.000Z",
    expiresAt: "2026-06-10T01:00:00.000Z"
  }));
  permitStore.revokePermit(
    "permit_agentos_mcp_runtime_revoked_candidate",
    "2026-06-10T00:05:00.000Z",
    "operator revoked stale approval"
  );

  const approve = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/**"],
      reason: "replacement approval"
    }
  });

  const plans = planStore.listPlans({ runId });
  const latestPlan = plans.at(-1);
  const consumedEvent = kernelStore.listEvents({
    runId,
    type: "kernel.approval.permit.consumed"
  }).at(-1);
  const payload = consumedEvent?.payload as {
    acceptedPermits?: string[];
    rejectedPermits?: string[];
  } | undefined;

  assert.equal(approve.status, "succeeded");
  assert.equal(approve.output.consumedProviderPlanId, latestPlan?.planId);
  assert.equal(plans.length, 2);
  assert.equal(latestPlan?.status, "planned");
  assert.deepEqual(payload?.acceptedPermits, [
    "permit_agentos_mcp_runtime_valid_after_revoked"
  ]);
  assert.ok(payload?.rejectedPermits?.some((reason) => (
    reason.includes("permit_agentos_mcp_runtime_revoked_candidate")
    && reason.includes("permit_revoked")
  )));
  assert.equal(permitStore.listPermits({ runId }).length, 2);
});

test("Agent OS MCP local runtime rejects stale permits during approval consumption", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createWaitingEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId,
    createPermitId: () => "permit_agentos_mcp_runtime_valid_after_stale"
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run with stale approval candidates."
    }
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "waiting_approval");

  const waitingPlan = planStore.listPlans({ runId }).at(-1);
  assert.ok(waitingPlan);
  permitStore.savePermit(createApprovalPermit({
    permitId: "permit_agentos_mcp_runtime_expired_candidate",
    taskId,
    runId,
    principalId: validPrincipal.principalId,
    approverId: validPrincipal.principalId,
    policyDecisionHash: waitingPlan.policyDecisionHash,
    planHash: hashApprovalScope(waitingPlan),
    capabilityScopes: ["fs.read:workspace/**"],
    createdAt: "2026-06-09T00:00:00.000Z",
    expiresAt: "2026-06-09T00:05:00.000Z"
  }));
  permitStore.savePermit(createApprovalPermit({
    permitId: "permit_agentos_mcp_runtime_plan_mismatch_candidate",
    taskId,
    runId,
    principalId: validPrincipal.principalId,
    approverId: validPrincipal.principalId,
    policyDecisionHash: waitingPlan.policyDecisionHash,
    planHash: "old_provider_plan_hash",
    capabilityScopes: ["fs.read:workspace/**"],
    createdAt: "2026-06-10T00:00:00.000Z",
    expiresAt: "2026-06-10T01:00:00.000Z"
  }));

  const approve = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/**"],
      reason: "replacement approval for stale candidates"
    }
  });

  const plans = planStore.listPlans({ runId });
  const latestPlan = plans.at(-1);
  const consumedEvent = kernelStore.listEvents({
    runId,
    type: "kernel.approval.permit.consumed"
  }).at(-1);
  const payload = consumedEvent?.payload as {
    acceptedPermits?: string[];
    rejectedPermits?: string[];
  } | undefined;

  assert.equal(approve.status, "succeeded");
  assert.equal(approve.output.consumedProviderPlanId, latestPlan?.planId);
  assert.equal(plans.length, 2);
  assert.equal(latestPlan?.status, "planned");
  assert.deepEqual(payload?.acceptedPermits, [
    "permit_agentos_mcp_runtime_valid_after_stale"
  ]);
  assert.ok(payload?.rejectedPermits?.some((reason) => (
    reason.includes("permit_agentos_mcp_runtime_expired_candidate")
    && reason.includes("permit_expired")
  )));
  assert.ok(payload?.rejectedPermits?.some((reason) => (
    reason.includes("permit_agentos_mcp_runtime_plan_mismatch_candidate")
    && reason.includes("plan_hash_mismatch")
  )));
  assert.equal(permitStore.listPermits({ runId }).length, 3);
});

test("Agent OS MCP local runtime does not consume permits without planning context", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const createRuntime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createWaitingEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId,
    createPermitId: () => "permit_agentos_mcp_runtime_context_missing_create"
  });
  const approveRuntime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    principal: validPrincipal,
    policyDecision,
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true,
    now: () => now,
    createPermitId: () => "permit_agentos_mcp_runtime_context_missing"
  });

  const create = createRuntime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run that cannot be consumed without context."
    }
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "waiting_approval");

  const approve = approveRuntime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/**"],
      reason: "approval without planning context"
    }
  });

  assert.equal(approve.status, "succeeded");
  assert.equal(approve.output.permitId, "permit_agentos_mcp_runtime_context_missing");
  assert.equal(approve.output.consumedProviderPlanId, undefined);
  assert.deepEqual(approve.output.approvalConsumptionReasons, [
    "approval_permit_consumption_context_missing"
  ]);
  assert.equal(planStore.listPlans({ runId }).length, 1);
  assert.equal(planStore.listPlans({ runId }).at(-1)?.status, "waiting_approval");
  assert.equal(
    kernelStore.listEvents({
      runId,
      type: "kernel.approval.permit.consumed"
    }).length,
    0
  );
});

test("Agent OS MCP local runtime default IDs do not collide for repeated titles", () => {
  const kernelStore = new InMemoryKernelStore();
  const firstRuntime = createAgentOsMcpLocalRuntime({
    kernelStore,
    principal: validPrincipal,
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    now: () => now
  });
  const secondRuntime = createAgentOsMcpLocalRuntime({
    kernelStore,
    principal: validPrincipal,
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    now: () => now
  });
  const input = {
    title: "Fix tests",
    requestedAction: "Create a repeated-title task through the local MCP wrapper."
  };

  const first = firstRuntime.handleToolCall({
    toolName: "agentos.create_task",
    input
  });
  const second = secondRuntime.handleToolCall({
    toolName: "agentos.create_task",
    input
  });

  assert.equal(first.status, "succeeded");
  assert.equal(second.status, "succeeded");
  assert.notEqual(first.output.taskId, second.output.taskId);
  assert.notEqual(first.output.runId, second.output.runId);
  assert.deepEqual(
    kernelStore.listRuns().map((run) => run.runId),
    [first.output.runId, second.output.runId]
  );
});

test("Agent OS MCP local runtime returns not found for missing runs", () => {
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore: new InMemoryKernelStore(),
    principal: validPrincipal,
    grantedCapabilities: ["run.read"],
    now: () => now
  });

  const result = runtime.handleToolCall({
    toolName: "agentos.get_run",
    input: {
      runId: "run_agentos_mcp_runtime_missing"
    }
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    `${AGENT_OS_MCP_RUN_NOT_FOUND}:run_agentos_mcp_runtime_missing`
  ]);
  assert.deepEqual(result.output, {});
  assert.equal(result.audit.localMutationApplied, false);
});

test("Agent OS MCP local runtime converts cancel failures into blocked results", () => {
  const kernelStore = new InMemoryKernelStore();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    principal: validPrincipal,
    grantedCapabilities: ["task.create", "run.cancel"],
    approvedMutatingTools: ["agentos.create_task", "agentos.cancel_run"],
    allowLocalMutations: true,
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  });

  const missing = runtime.handleToolCall({
    toolName: "agentos.cancel_run",
    input: {
      runId: "run_agentos_mcp_runtime_missing",
      reason: "missing run"
    }
  });
  assert.equal(missing.status, "blocked");
  assert.deepEqual(missing.reasons, [
    `${AGENT_OS_MCP_RUN_NOT_FOUND}:run_agentos_mcp_runtime_missing`
  ]);
  assert.equal(missing.audit.localMutationAttempted, true);
  assert.equal(missing.audit.localMutationApplied, false);

  runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Cancel once",
      requestedAction: "Create a run to cancel."
    }
  });
  const firstCancel = runtime.handleToolCall({
    toolName: "agentos.cancel_run",
    input: {
      runId,
      reason: "first cancel"
    }
  });
  const secondCancel = runtime.handleToolCall({
    toolName: "agentos.cancel_run",
    input: {
      runId,
      reason: "second cancel"
    }
  });

  assert.equal(firstCancel.status, "succeeded");
  assert.equal(firstCancel.audit.localMutationApplied, true);
  assert.equal(secondCancel.status, "blocked");
  assert.deepEqual(secondCancel.reasons, ["run_terminal:cancelled"]);
  assert.equal(secondCancel.audit.localMutationApplied, false);
});

test("Agent OS MCP local runtime blocks approve_run without a permit store", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run before approval."
    }
  });
  assert.equal(create.status, "succeeded");

  const result = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/docs/report.md"],
      reason: "review approval"
    }
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    AGENT_OS_MCP_APPROVAL_STORE_NOT_CONFIGURED
  ]);
  assert.deepEqual(result.output, {
    status: "blocked"
  });
  assert.equal(result.audit.localMutationAttempted, true);
  assert.equal(result.audit.localMutationApplied, false);
});

test("Agent OS MCP local runtime rejects approve_run scopes outside the provider plan", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId,
    createPermitId: () => "permit_agentos_mcp_runtime_outside_plan"
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run before approval."
    }
  });
  assert.equal(create.status, "succeeded");

  const result = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.write:workspace/docs/report.md"],
      reason: "review approval"
    }
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    `${AGENT_OS_MCP_APPROVAL_SCOPE_OUTSIDE_PLAN}:fs.write:workspace/docs/report.md`
  ]);
  assert.equal(permitStore.listPermits().length, 0);
  assert.equal(result.audit.localMutationApplied, false);
});

test("Agent OS MCP local runtime issues an approval permit for a planned run scope", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId,
    createPermitId: () => "permit_agentos_mcp_runtime_001"
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run before approval."
    }
  });
  assert.equal(create.status, "succeeded");

  const approve = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/docs/report.md"],
      reason: "review approval"
    }
  });

  const storedPlan = planStore.listPlans({ runId }).at(-1);
  const storedPermit = permitStore.getPermit("permit_agentos_mcp_runtime_001");
  assert.ok(storedPlan);
  assert.ok(storedPermit);
  assert.equal(approve.status, "succeeded");
  assert.deepEqual(approve.reasons, []);
  assert.deepEqual(approve.output, {
    permitId: "permit_agentos_mcp_runtime_001",
    runId,
    expiresAt: "2026-06-10T01:00:00.000Z"
  });
  assert.equal(approve.audit.localMutationAttempted, true);
  assert.equal(approve.audit.localMutationApplied, true);
  assert.equal(storedPermit.taskId, taskId);
  assert.equal(storedPermit.runId, runId);
  assert.equal(storedPermit.principalId, validPrincipal.principalId);
  assert.equal(storedPermit.approverId, validPrincipal.principalId);
  assert.equal(storedPermit.policyDecisionHash, storedPlan.policyDecisionHash);
  assert.equal(storedPermit.planHash, hashApprovalScope(storedPlan));
  assert.deepEqual(storedPermit.capabilityScopes, ["fs.read:workspace/docs/report.md"]);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.mcp.create_task",
      "kernel.approval.permit.issued"
    ]
  );
});

test("Agent OS MCP local runtime default approval permit IDs are unique for repeated approvals", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run before repeated approval."
    }
  });
  assert.equal(create.status, "succeeded");

  const first = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/docs/report.md"],
      reason: "review approval"
    }
  });
  const second = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/docs/report.md"],
      reason: "review approval"
    }
  });
  const firstPermitId = String(first.output.permitId);
  const secondPermitId = String(second.output.permitId);

  assert.equal(first.status, "succeeded");
  assert.equal(second.status, "succeeded");
  assert.match(firstPermitId, /^permit_agentos_mcp_run_agentos_mcp_runtime_001_/);
  assert.match(secondPermitId, /^permit_agentos_mcp_run_agentos_mcp_runtime_001_/);
  assert.notEqual(firstPermitId, secondPermitId);
  assert.equal(permitStore.listPermits({ runId }).length, 2);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.mcp.create_task",
      "kernel.approval.permit.issued",
      "kernel.approval.permit.issued"
    ]
  );
});

test("Agent OS MCP local runtime returns blocked instead of throwing on duplicate approval permit IDs", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    approvalPermitStore: permitStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createEligibility(policyDecision),
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools: ["agentos.create_task", "agentos.approve_run"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId,
    createPermitId: () => "permit_agentos_mcp_runtime_duplicate"
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Create governed task",
      requestedAction: "Create a run before duplicate approval."
    }
  });
  assert.equal(create.status, "succeeded");

  const first = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/docs/report.md"],
      reason: "review approval"
    }
  });
  const second = runtime.handleToolCall({
    toolName: "agentos.approve_run",
    input: {
      runId,
      capabilityScopes: ["fs.read:workspace/docs/report.md"],
      reason: "review approval"
    }
  });

  assert.equal(first.status, "succeeded");
  assert.equal(second.status, "blocked");
  assert.deepEqual(second.reasons, [
    `${AGENT_OS_MCP_APPROVAL_PERMIT_DUPLICATE}:permit_agentos_mcp_runtime_duplicate`
  ]);
  assert.deepEqual(second.output, {
    status: "blocked"
  });
  assert.equal(second.audit.localMutationAttempted, true);
  assert.equal(second.audit.localMutationApplied, false);
  assert.equal(permitStore.listPermits({ runId }).length, 1);
});

test("Agent OS MCP local runtime honors list runs cursor pagination", () => {
  const kernelStore = new InMemoryKernelStore();
  let sequence = 0;
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    principal: validPrincipal,
    grantedCapabilities: ["task.create", "run.read"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    now: () => now,
    createTaskId: () => {
      sequence += 1;
      return `task_agentos_mcp_runtime_page_${sequence}`;
    },
    createRunId: (task) => `run_${task.taskId}`
  });

  for (const title of ["First paged run", "Second paged run", "Third paged run"]) {
    const createResult = runtime.handleToolCall({
      toolName: "agentos.create_task",
      input: {
        title,
        requestedAction: "Create a run for cursor pagination."
      }
    });
    assert.equal(createResult.status, "succeeded");
  }

  const firstPage = runtime.handleToolCall({
    toolName: "agentos.list_runs",
    input: {
      limit: 2
    }
  });
  const firstPageRuns = firstPage.output.runs as Array<{ runId: string }>;
  const nextCursor = firstPage.output.nextCursor;

  assert.equal(firstPage.status, "succeeded");
  assert.deepEqual(
    firstPageRuns.map((run) => run.runId),
    [
      "run_task_agentos_mcp_runtime_page_1",
      "run_task_agentos_mcp_runtime_page_2"
    ]
  );
  assert.equal(typeof nextCursor, "string");

  const secondPage = runtime.handleToolCall({
    toolName: "agentos.list_runs",
    input: {
      limit: 2,
      cursor: nextCursor
    }
  });
  const secondPageRuns = secondPage.output.runs as Array<{ runId: string }>;

  assert.equal(secondPage.status, "succeeded");
  assert.deepEqual(
    secondPageRuns.map((run) => run.runId),
    ["run_task_agentos_mcp_runtime_page_3"]
  );
  assert.equal(secondPage.output.nextCursor, undefined);
});

test("Agent OS MCP local runtime rejects invalid list runs cursors", () => {
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore: new InMemoryKernelStore(),
    principal: validPrincipal,
    grantedCapabilities: ["run.read"],
    now: () => now
  });

  assert.throws(() => runtime.handleToolCall({
    toolName: "agentos.list_runs",
    input: {
      cursor: "not-a-list-runs-cursor"
    }
  }), /agent_os_list_runs_invalid_cursor:not-a-list-runs-cursor/);
});

test("Agent OS MCP local runtime honors artifact and event cursors", () => {
  const kernelStore = new InMemoryKernelStore();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    principal: validPrincipal,
    grantedCapabilities: ["artifact.read", "event.read"],
    now: () => now
  });

  for (const index of [1, 2, 3]) {
    kernelStore.createArtifact(createArtifact(index));
    kernelStore.appendEvent(createEvent(index));
  }

  const artifactFirstPage = runtime.handleToolCall({
    toolName: "agentos.list_artifacts",
    input: {
      kind: "evidence",
      limit: 2
    }
  });
  const artifactCursor = artifactFirstPage.output.nextCursor;

  assert.equal(artifactFirstPage.status, "succeeded");
  assert.deepEqual(
    (artifactFirstPage.output.artifacts as Array<{ artifactId: string }>).map((artifact) => (
      artifact.artifactId
    )),
    ["artifact_agentos_mcp_runtime_001", "artifact_agentos_mcp_runtime_002"]
  );
  assert.equal(typeof artifactCursor, "string");

  const artifactSecondPage = runtime.handleToolCall({
    toolName: "agentos.list_artifacts",
    input: {
      kind: "evidence",
      limit: 2,
      cursor: artifactCursor
    }
  });

  assert.deepEqual(
    (artifactSecondPage.output.artifacts as Array<{ artifactId: string }>).map((artifact) => (
      artifact.artifactId
    )),
    ["artifact_agentos_mcp_runtime_003"]
  );
  assert.equal(artifactSecondPage.output.nextCursor, undefined);

  const artifact = runtime.handleToolCall({
    toolName: "agentos.get_artifact",
    input: {
      artifactId: "artifact_agentos_mcp_runtime_001"
    }
  });
  assert.equal(artifact.status, "succeeded");
  assert.equal((artifact.output.artifact as { artifactId?: string }).artifactId, "artifact_agentos_mcp_runtime_001");

  const eventFirstPage = runtime.handleToolCall({
    toolName: "agentos.search_events",
    input: {
      query: "cursor-pagination",
      limit: 2
    }
  });
  const eventCursor = eventFirstPage.output.nextCursor;

  assert.equal(eventFirstPage.status, "succeeded");
  assert.deepEqual(
    (eventFirstPage.output.events as Array<{ eventId: string }>).map((event) => event.eventId),
    ["event_agentos_mcp_runtime_001", "event_agentos_mcp_runtime_002"]
  );
  assert.equal(typeof eventCursor, "string");

  const eventSecondPage = runtime.handleToolCall({
    toolName: "agentos.search_events",
    input: {
      query: "cursor-pagination",
      limit: 2,
      cursor: eventCursor
    }
  });

  assert.deepEqual(
    (eventSecondPage.output.events as Array<{ eventId: string }>).map((event) => event.eventId),
    ["event_agentos_mcp_runtime_003"]
  );
  assert.equal(eventSecondPage.output.nextCursor, undefined);
});

test("Agent OS MCP local runtime returns not found for missing artifacts", () => {
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore: new InMemoryKernelStore(),
    principal: validPrincipal,
    grantedCapabilities: ["artifact.read"],
    now: () => now
  });

  const result = runtime.handleToolCall({
    toolName: "agentos.get_artifact",
    input: {
      artifactId: "artifact_agentos_mcp_runtime_missing"
    }
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    `${AGENT_OS_MCP_ARTIFACT_NOT_FOUND}:artifact_agentos_mcp_runtime_missing`
  ]);
  assert.deepEqual(result.output, {});
  assert.equal(result.audit.localMutationApplied, false);
});

test("Agent OS MCP local runtime rejects invalid artifact and event cursors", () => {
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore: new InMemoryKernelStore(),
    principal: validPrincipal,
    grantedCapabilities: ["artifact.read", "event.read"],
    now: () => now
  });

  assert.throws(() => runtime.handleToolCall({
    toolName: "agentos.list_artifacts",
    input: {
      cursor: "not-an-artifact-cursor"
    }
  }), /agent_os_list_artifacts_invalid_cursor:not-an-artifact-cursor/);

  assert.throws(() => runtime.handleToolCall({
    toolName: "agentos.search_events",
    input: {
      cursor: "not-an-event-cursor"
    }
  }), /agent_os_search_events_invalid_cursor:not-an-event-cursor/);
});

function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  const provider = new CodexCliExecutorProvider();
  registry.registerProvider(provider.manifest, provider);
  return registry;
}

function createPolicyDecision(): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "decision_agentos_mcp_runtime_001",
    taskId,
    risk: {
      level: "low",
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      executor: "codex-cli",
      model: "gpt-5.4-mini",
      profile: "read-only",
      reasoningEffort: "low",
      sandbox: SandboxProfileSchema.parse({
        schemaVersion: "sandbox-profile.v1",
        sandboxId: "sandbox_agentos_mcp_runtime_readonly",
        mode: "read-only",
        networkAccess: "none",
        writableRoots: [],
        envPolicy: {
          inheritProcessEnv: false,
          allowlist: []
        }
      })
    },
    capabilities: [
      CapabilityScopeSchema.parse({
        kind: "file",
        resource: "workspace/**",
        access: "read"
      })
    ],
    approval: {
      required: false,
      reasons: []
    },
    createdAt: now,
    legacy: {
      taskClass: "read_only",
      toolAccess: "read_only"
    }
  });
}

function createEligibility(policyDecision: PolicyDecision) {
  return {
    status: "eligible" as const,
    taskId,
    runId,
    policyDecisionHash: hashApprovalScope(policyDecision),
    reasons: ["capability_grants_satisfied"],
    missingCapabilities: [],
    requiredApprovals: [],
    acceptedPermits: [],
    rejectedPermits: [],
    createdAt: now
  };
}

function createWaitingEligibility(policyDecision: PolicyDecision) {
  const missingScope = "fs.read:workspace/docs/report.md";
  return {
    status: "waiting_approval" as const,
    taskId,
    runId,
    policyDecisionHash: hashApprovalScope(policyDecision),
    reasons: ["missing_capability"],
    missingCapabilities: [missingScope],
    requiredApprovals: [`approval:${missingScope}`],
    acceptedPermits: [],
    rejectedPermits: [],
    createdAt: now
  };
}

function createArtifact(index: number): Artifact {
  return ArtifactSchema.parse({
    ...validArtifact,
    artifactId: `artifact_agentos_mcp_runtime_${String(index).padStart(3, "0")}`,
    taskId,
    runId,
    kind: "evidence",
    uri: `memory://agent-os-mcp-runtime/artifact-${index}`,
    sha256: String(index).repeat(64),
    sizeBytes: index,
    createdAt: now,
    metadata: {
      marker: "cursor-pagination"
    }
  });
}

function createEvent(index: number): Event {
  return EventSchema.parse({
    ...validEvent,
    eventId: `event_agentos_mcp_runtime_${String(index).padStart(3, "0")}`,
    eventType: "kernel.public_surface.mcp.cursor-pagination",
    taskId,
    runId,
    createdAt: now,
    payload: {
      marker: "cursor-pagination",
      index
    }
  });
}
