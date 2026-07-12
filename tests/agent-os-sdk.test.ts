import test from "node:test";
import assert from "node:assert/strict";
import {
  createAgentOsSdk
} from "../packages/agent-os-sdk/src/index.js";
import {
  InMemoryArtifactStore
} from "../packages/artifact-store/src/index.js";
import {
  hashProviderExecutionPlannerObject,
  InMemoryProviderExecutionPlanStore
} from "../packages/execution-planner/src/index.js";
import {
  InMemoryKernelStore
} from "../packages/kernel-store/src/index.js";
import {
  ProviderRegistry
} from "../packages/provider-registry/src/index.js";
import {
  CodexCliExecutorProvider
} from "../packages/providers/codex-cli/src/index.js";
import {
  CapabilityScopeSchema,
  PolicyDecisionSchema,
  SandboxProfileSchema,
  type PolicyDecision
} from "../packages/kernel-contracts/src/index.js";
import {
  AGENT_OS_MCP_LOCAL_MUTATION_DISABLED,
  AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED,
  AGENT_OS_MCP_TOOL_CAPABILITY_MISSING
} from "../packages/protocol-mcp/src/index.js";
import {
  createApprovalPermit,
  hashApprovalScope,
  InMemoryApprovalPermitStore
} from "../packages/governance-internal-approval-permit/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import {
  InMemoryProviderExecutionPermitConsumptionStore
} from "../packages/provider-core/src/index.js";
import {
  createAgentOsWorkspaceWriteEligibility,
  createAgentOsWorkspaceWriteGovernanceState,
  createAgentOsWorkspaceWritePolicyDecision,
  createAgentOsWorkspaceWriteProvider,
  createAgentOsWorkspaceWriteProviderRegistry
} from "./fixtures/agent-os-workspace-write-fixture.js";

const now = "2026-06-10T03:00:00.000Z";
const taskId = "task_agentos_sdk_001";
const runId = "run_agentos_sdk_001";

test("Agent OS SDK blocks mutating task creation by default", () => {
  const kernelStore = new InMemoryKernelStore();
  const sdk = createAgentOsSdk(createRuntimeInput(kernelStore));
  const result = sdk.createTask({
    title: "Blocked SDK task",
    requestedAction: "Try to create a task without gates."
  });

  assert.equal(result.surface, "sdk");
  assert.equal(result.operation, "createTask");
  assert.equal(result.status, "blocked");
  assert.equal(result.audit.publicSurface, "sdk");
  assert.equal(result.audit.liveMcpServerConnection, false);
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_CAPABILITY_MISSING}:task.create`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED}:agentos.create_task`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_LOCAL_MUTATION_DISABLED}:agentos.create_task`));
  assert.deepEqual(kernelStore.listRuns(), []);
});

test("Agent OS SDK creates a local run and provider plan without real execution", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const sdk = createAgentOsSdk(
    createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision)
  );

  const result = sdk.createTask({
    title: "SDK governed task",
    requestedAction: "Create a task from the Agent OS SDK wrapper.",
    successCriteria: ["run is queued", "plan is stored"],
    outOfScope: ["real provider execution"],
    repoRoot: "A:/AGENTS_OS_Workspace/governance/codex-router/repo",
    branch: "feature/phase-4-provider-execution-runner",
    targetFiles: ["packages/agent-os-sdk/src/index.ts"],
    metadata: {
      source: "phase-8-sdk-test"
    }
  }, {
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli"
  });

  const providerPlanId = String(result.output.providerPlanId);
  assert.equal(result.status, "succeeded");
  assert.equal(result.surface, "sdk");
  assert.equal(result.operation, "createTask");
  assert.equal(result.audit.publicSurface, "sdk");
  assert.equal(result.audit.liveMcpServerConnection, false);
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationApplied, true);
  assert.equal(result.output.taskId, taskId);
  assert.equal(result.output.runId, runId);
  assert.equal(result.output.providerPlanStatus, "planned");
  assert.equal(kernelStore.getRun(runId)?.taskId, taskId);
  assert.equal(planStore.getPlan(providerPlanId)?.providerId, "codex-cli");
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    ["kernel.run.created", "kernel.public_surface.sdk.create_task"]
  );

  const getRun = sdk.getRun(runId, {
    grantedCapabilities: ["run.read"]
  });
  assert.equal(getRun.status, "succeeded");
  assert.equal(getRun.operation, "getRun");
  assert.equal((getRun.output.run as { runId?: string }).runId, runId);

  const listRuns = sdk.listRuns({
    taskId,
    limit: 10
  }, {
    grantedCapabilities: ["run.read"]
  });
  assert.equal(listRuns.status, "succeeded");
  assert.deepEqual(
    (listRuns.output.runs as Array<{ runId: string }>).map((run) => run.runId),
    [runId]
  );

  const searchEvents = sdk.searchEvents({
    runId,
    eventTypes: ["kernel.public_surface.sdk.create_task"]
  }, {
    grantedCapabilities: ["event.read"]
  });
  assert.equal(searchEvents.status, "succeeded");
  assert.equal(searchEvents.operation, "searchEvents");
  assert.deepEqual(
    (searchEvents.output.events as Array<{ eventType: string }>).map((event) => event.eventType),
    ["kernel.public_surface.sdk.create_task"]
  );
});

test("Agent OS SDK delegates controlled workspace-write dispatch through async wrapper", async () => {
  const dispatchInputs: unknown[] = [];
  const workspaceWriteConsumptionStore =
    new InMemoryProviderExecutionPermitConsumptionStore();
  const sdk = createAgentOsSdk({
    ...createRuntimeInput(new InMemoryKernelStore()),
    workspaceWriteConsumptionStore,
    controlledWorkspaceWriteProviderDispatcher(input) {
      dispatchInputs.push(input);
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "dispatch_blocked",
        runnerInvoked: false,
        executeInvoked: false,
        providerExecuteInvoked: false,
        reasons: ["agent_os_sdk_workspace_write_dispatch_test"],
        providerExecutionPlanHash: "sha256:agent-os-sdk-provider-plan",
        executorPlanHash: "sha256:agent-os-sdk-executor-plan",
        operationManifestHash: "sha256:agent-os-sdk-operations",
        providerRegistrySelection: {
          status: "selected",
          providerId: "fake-agent-os-sdk-workspace-write"
        }
      } as never;
    }
  });
  const dispatchInput = {
    schemaVersion: "agent-os-sdk-workspace-write-dispatch-test.v1"
  };

  const result = await sdk.dispatchWorkspaceWrite({
    dispatchInput: dispatchInput as never
  }, {
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true
  });

  assert.equal(dispatchInputs.length, 1);
  assert.notEqual(dispatchInputs[0], dispatchInput);
  assert.equal(
    (dispatchInputs[0] as { schemaVersion?: string }).schemaVersion,
    dispatchInput.schemaVersion
  );
  assert.equal(
    (dispatchInputs[0] as { consumptionStore?: unknown }).consumptionStore,
    workspaceWriteConsumptionStore
  );
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("agent_os_sdk_workspace_write_dispatch_test"));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_dispatch_status:dispatch_blocked"
  ));
  assert.equal(result.surface, "sdk");
  assert.equal(result.operation, "dispatchWorkspaceWrite");
  assert.equal(result.audit.publicSurface, "sdk");
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationAttempted, true);
  assert.equal(result.audit.localMutationApplied, false);
  assert.equal(
    (result.output.dispatchResult as { providerExecuteInvoked?: boolean }).providerExecuteInvoked,
    false
  );
});

test("Agent OS SDK prepares workspace-write dispatch through typed input", async () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const artifactStore = new InMemoryArtifactStore({ now: () => now });
  const targetFile = "workspace/docs/agent-os-sdk-write.md";
  const provider = createAgentOsWorkspaceWriteProvider({
    providerId: "agent-os-sdk-workspace-write-provider",
    targetFiles: [targetFile],
    sandboxId: "sandbox_agentos_sdk_workspace_write",
    source: "agent-os-sdk-test"
  });
  const providerRegistry = createAgentOsWorkspaceWriteProviderRegistry(provider);
  const policyDecision = createAgentOsWorkspaceWritePolicyDecision({
    basePolicyDecision: validPolicyDecision,
    decisionId: "decision_agentos_sdk_workspace_write",
    taskId,
    targetFiles: [targetFile],
    sandboxId: "sandbox_agentos_sdk_workspace_write",
    now
  });
  const dispatchInputs: unknown[] = [];
  const sdk = createAgentOsSdk({
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    artifactStore,
    workspaceWriteConsumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    executionEligibility: createAgentOsWorkspaceWriteEligibility({
      policyDecision,
      taskId,
      runId,
      permitId: "permit_agentos_sdk_workspace_write_planner",
      now
    }),
    controlledWorkspaceWriteProviderDispatcher(input) {
      dispatchInputs.push(input);
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "dispatch_blocked",
        runnerInvoked: false,
        executeInvoked: false,
        providerExecuteInvoked: false,
        reasons: ["agent_os_sdk_workspace_write_prepare_dispatch_test"],
        providerExecutionPlanHash: hashProviderExecutionPlannerObject(input.providerExecutionPlan),
        executorPlanHash: hashProviderExecutionPlannerObject(input.executorPlan),
        operationManifestHash: hashProviderExecutionPlannerObject(input.operations),
        providerRegistrySelection: {
          status: "selected",
          providerId: provider.manifest.providerId
        }
      } as never;
    }
  });

  const create = sdk.createTask({
    title: "SDK workspace-write prepare",
    requestedAction: "Prepare a controlled workspace-write from SDK typed input.",
    repoRoot: "workspace",
    branch: "agentos/sdk-workspace-write",
    targetFiles: [targetFile]
  }, {
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: provider.manifest.providerId
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "planned");

  const result = await sdk.dispatchWorkspaceWrite({
    prepare: {
      runId,
      workspaceRoot: "/tmp/agent-os-sdk-workspace",
      operations: [{
        kind: "write",
        path: targetFile,
        content: "agent os sdk prepared workspace-write\n"
      }],
      executionAuthorizationId: "operator_auth_agentos_sdk_workspace_write",
      governanceState: createAgentOsWorkspaceWriteGovernanceState({ taskId, now }),
      repositoryState: {
        branch: "agentos/sdk-workspace-write",
        protectedBranch: false,
        worktreeClean: true,
        headCommit: "abc123"
      },
      permitId: "permit_agentos_sdk_workspace_write_prepare",
      maxChangedFiles: 1,
      maxDiffLines: 1
    }
  }, {
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true
  });
  const preparedDispatch = result.output.preparedDispatch as {
    providerPlanId?: string;
    permitId?: string;
    targetFiles?: string[];
  };

  assert.equal(dispatchInputs.length, 1);
  assert.equal(provider.calls.planExecution, 1);
  assert.equal(provider.calls.execute, 0);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("agent_os_sdk_workspace_write_prepare_dispatch_test"));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_dispatch_status:dispatch_blocked"
  ));
  assert.equal(result.surface, "sdk");
  assert.equal(result.operation, "dispatchWorkspaceWrite");
  assert.equal(preparedDispatch.providerPlanId, create.output.providerPlanId);
  assert.equal(preparedDispatch.permitId, "permit_agentos_sdk_workspace_write_prepare");
  assert.deepEqual(preparedDispatch.targetFiles, [targetFile]);
  assert.equal(
    (result.output.dispatchResult as { providerExecuteInvoked?: boolean }).providerExecuteInvoked,
    false
  );
});

test("Agent OS SDK issues an approval permit through the shared local runtime", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const sdk = createAgentOsSdk({
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_sdk_001"
  });

  const create = sdk.createTask({
    title: "SDK governed task",
    requestedAction: "Create a run before SDK approval."
  }, {
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli"
  });
  assert.equal(create.status, "succeeded");

  const approve = sdk.approveRun({
    runId,
    capabilityScopes: ["fs.read:workspace/docs/report.md"],
    reason: "SDK approval"
  }, {
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true
  });
  const storedPermit = permitStore.getPermit("permit_agentos_sdk_001");

  assert.equal(approve.status, "succeeded");
  assert.equal(approve.surface, "sdk");
  assert.equal(approve.operation, "approveRun");
  assert.equal(approve.audit.publicSurface, "sdk");
  assert.equal(approve.audit.localMutationApplied, true);
  assert.deepEqual(approve.output, {
    permitId: "permit_agentos_sdk_001",
    runId,
    expiresAt: "2026-06-10T04:00:00.000Z"
  });
  assert.equal(storedPermit?.runId, runId);
  assert.deepEqual(storedPermit?.capabilityScopes, ["fs.read:workspace/docs/report.md"]);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.sdk.create_task",
      "kernel.approval.permit.issued"
    ]
  );
});

test("Agent OS SDK does not let approval permits expand missing capabilities", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const sdk = createAgentOsSdk({
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    executionEligibility: createWaitingEligibility(policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_sdk_consumed"
  });

  const create = sdk.createTask({
    title: "SDK approval consumption task",
    requestedAction: "Create a run that waits for SDK approval consumption."
  }, {
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli"
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "waiting_approval");

  const approve = sdk.approveRun({
    runId,
    capabilityScopes: ["fs.read:workspace/**"],
    reason: "SDK approval consumption"
  }, {
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true
  });
  const plans = planStore.listPlans({ runId });
  const latestPlan = plans.at(-1);

  assert.equal(approve.status, "succeeded");
  assert.equal(approve.output.consumedProviderPlanId, undefined);
  assert.deepEqual(approve.output.approvalConsumptionReasons, [
    "approval_permit_consumption_not_eligible:waiting_approval"
  ]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0]?.status, "waiting_approval");
  assert.equal(latestPlan?.status, "waiting_approval");
  assert.equal(approve.audit.realProviderExecutionInvoked, false);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.sdk.create_task",
      "kernel.approval.permit.issued"
    ]
  );
});

test("Agent OS SDK keeps missing-capability approval candidates fail closed", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const sdk = createAgentOsSdk({
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    executionEligibility: createWaitingEligibility(policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_sdk_valid_after_rejected"
  });

  const create = sdk.createTask({
    title: "SDK rejected permit audit task",
    requestedAction: "Create a run with rejected approval candidates."
  }, {
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli"
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "waiting_approval");

  const waitingPlan = planStore.listPlans({ runId }).at(-1);
  assert.ok(waitingPlan);
  permitStore.savePermit(createApprovalPermit({
    permitId: "permit_agentos_sdk_expired_candidate",
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

  const approve = sdk.approveRun({
    runId,
    capabilityScopes: ["fs.read:workspace/**"],
    reason: "SDK replacement approval"
  }, {
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true
  });
  const consumedEvent = kernelStore.listEvents({
    runId,
    type: "kernel.approval.permit.consumed"
  }).at(-1);
  assert.equal(approve.status, "succeeded");
  assert.equal(consumedEvent, undefined);
  assert.deepEqual(approve.output.approvalConsumptionReasons, [
    "approval_permit_consumption_not_eligible:waiting_approval"
  ]);
  assert.equal(approve.audit.realProviderExecutionInvoked, false);
  assert.equal(planStore.listPlans({ runId }).length, 1);
  assert.equal(planStore.listPlans({ runId }).at(-1)?.status, "waiting_approval");
});

test("Agent OS SDK default approval permit IDs are unique for repeated approvals", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const sdk = createAgentOsSdk({
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    approvalPermitStore: permitStore
  });

  const create = sdk.createTask({
    title: "SDK repeated approval task",
    requestedAction: "Create a run before repeated SDK approval."
  }, {
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli"
  });
  assert.equal(create.status, "succeeded");

  const first = sdk.approveRun({
    runId,
    capabilityScopes: ["fs.read:workspace/docs/report.md"],
    reason: "SDK approval"
  }, {
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true
  });
  const second = sdk.approveRun({
    runId,
    capabilityScopes: ["fs.read:workspace/docs/report.md"],
    reason: "SDK approval"
  }, {
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true
  });
  const firstPermitId = String(first.output.permitId);
  const secondPermitId = String(second.output.permitId);

  assert.equal(first.status, "succeeded");
  assert.equal(second.status, "succeeded");
  assert.match(firstPermitId, /^permit_agentos_mcp_run_agentos_sdk_001_/);
  assert.match(secondPermitId, /^permit_agentos_mcp_run_agentos_sdk_001_/);
  assert.notEqual(firstPermitId, secondPermitId);
  assert.equal(permitStore.listPermits({ runId }).length, 2);
});

function createRuntimeInput(
  kernelStore: InMemoryKernelStore,
  planStore?: InMemoryProviderExecutionPlanStore,
  providerRegistry?: ProviderRegistry,
  policyDecision = createPolicyDecision()
) {
  return {
    kernelStore,
    ...(planStore !== undefined ? { providerExecutionPlanStore: planStore } : {}),
    ...(providerRegistry !== undefined ? { providerRegistry } : {}),
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createEligibility(policyDecision),
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  };
}

function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  const provider = new CodexCliExecutorProvider();
  registry.registerProvider(provider.manifest, provider);
  return registry;
}

function createPolicyDecision(): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "decision_agentos_sdk_001",
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
        sandboxId: "sandbox_agentos_sdk_readonly",
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
