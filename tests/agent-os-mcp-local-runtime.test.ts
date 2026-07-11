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
  AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCHER_NOT_CONFIGURED,
  AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCH_REQUIRES_ASYNC,
  AGENT_OS_MCP_WORKSPACE_WRITE_CONSUMPTION_STORE_REQUIRED,
  AGENT_OS_MCP_WORKSPACE_WRITE_PREPARE_ARTIFACT_STORE_NOT_CONFIGURED,
  AGENT_OS_MCP_WORKSPACE_WRITE_PREPARE_TARGET_OUTSIDE_EXECUTOR_PLAN,
  AGENT_OS_MCP_WORKSPACE_WRITE_PREPARE_TARGET_OUTSIDE_POLICY,
  AGENT_OS_MCP_WORKSPACE_WRITE_PREPARE_TARGET_OUTSIDE_TASK,
  createAgentOsMcpLocalRuntime
} from "../packages/protocol-mcp/src/index.js";
import {
  InMemoryKernelStore
} from "../packages/kernel-store/src/index.js";
import {
  InMemoryArtifactStore
} from "../packages/artifact-store/src/index.js";
import {
  hashProviderExecutionPlannerObject,
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
  type PolicyDecision,
  type SandboxProfile
} from "../packages/kernel-contracts/src/index.js";
import {
  createApprovalPermit,
  hashApprovalScope,
  InMemoryApprovalPermitStore
} from "../packages/governance-internal-approval-permit/src/index.js";
import { validArtifact } from "../packages/kernel-contracts/test-fixtures/valid-artifact.js";
import { validEvent } from "../packages/kernel-contracts/test-fixtures/valid-event.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import {
  parseExecutorExecutionPlan,
  InMemoryProviderExecutionPermitConsumptionStore,
  parseProviderManifest,
  type ExecutionPlanInput,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderExecutionContext,
  type ProviderExecutionResult
} from "../packages/provider-core/src/index.js";

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

test("Agent OS MCP local runtime delegates controlled workspace-write dispatch asynchronously", async () => {
  const dispatchInputs: unknown[] = [];
  const runtimeConsumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();
  const callerConsumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore: new InMemoryKernelStore(),
    principal: validPrincipal,
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true,
    workspaceWriteConsumptionStore: runtimeConsumptionStore,
    controlledWorkspaceWriteProviderDispatcher(input) {
      dispatchInputs.push(input);
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "dispatch_blocked",
        runnerInvoked: false,
        executeInvoked: false,
        providerExecuteInvoked: false,
        reasons: ["agent_os_mcp_workspace_write_dispatch_test"],
        providerExecutionPlanHash: "sha256:agent-os-mcp-provider-plan",
        executorPlanHash: "sha256:agent-os-mcp-executor-plan",
        operationManifestHash: "sha256:agent-os-mcp-operations",
        providerRegistrySelection: {
          status: "selected",
          providerId: "fake-agent-os-mcp-workspace-write"
        }
      } as never;
    },
    now: () => now
  });
  const dispatchInput = {
    schemaVersion: "agent-os-mcp-workspace-write-dispatch-test.v1",
    consumptionStore: callerConsumptionStore
  };

  const syncResult = runtime.handleToolCall({
    toolName: "agentos.dispatch_workspace_write",
    input: { dispatchInput },
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true
  });
  assert.equal(syncResult.status, "blocked");
  assert.deepEqual(syncResult.reasons, [
    AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCH_REQUIRES_ASYNC
  ]);

  const result = await runtime.handleToolCallAsync({
    toolName: "agentos.dispatch_workspace_write",
    input: { dispatchInput },
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
    runtimeConsumptionStore
  );
  assert.notEqual(
    (dispatchInputs[0] as { consumptionStore?: unknown }).consumptionStore,
    callerConsumptionStore
  );
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("agent_os_mcp_workspace_write_dispatch_test"));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_dispatch_status:dispatch_blocked"
  ));
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationAttempted, true);
  assert.equal(result.audit.localMutationApplied, false);
  assert.equal(
    (result.output.dispatchResult as { providerExecuteInvoked?: boolean }).providerExecuteInvoked,
    false
  );
});

test("Agent OS MCP local runtime blocks workspace-write dispatch without shared consumption store", async () => {
  let dispatcherInvoked = false;
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore: new InMemoryKernelStore(),
    principal: validPrincipal,
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true,
    controlledWorkspaceWriteProviderDispatcher() {
      dispatcherInvoked = true;
      throw new Error("dispatcher should not run without shared consumption store");
    },
    now: () => now
  });

  const result = await runtime.handleToolCallAsync({
    toolName: "agentos.dispatch_workspace_write",
    input: {
      dispatchInput: {
        schemaVersion: "agent-os-mcp-workspace-write-dispatch-test.v1"
      }
    },
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true
  });

  assert.equal(dispatcherInvoked, false);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    AGENT_OS_MCP_WORKSPACE_WRITE_CONSUMPTION_STORE_REQUIRED
  ]);
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationAttempted, true);
  assert.equal(result.audit.localMutationApplied, false);
});

test("Agent OS MCP local runtime blocks completed workspace-write dispatches when runner failed", async () => {
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore: new InMemoryKernelStore(),
    principal: validPrincipal,
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true,
    workspaceWriteConsumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    controlledWorkspaceWriteProviderDispatcher() {
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "runner_completed",
        runnerInvoked: true,
        executeInvoked: true,
        providerExecuteInvoked: false,
        reasons: [
          "controlled_workspace_write_provider_dispatch_runner_completed",
          "workspace_write_execution_target_outside_writable_roots:README.md"
        ],
        providerExecutionPlanHash: "sha256:agent-os-mcp-provider-plan",
        executorPlanHash: "sha256:agent-os-mcp-executor-plan",
        operationManifestHash: "sha256:agent-os-mcp-operations",
        providerRegistrySelection: {
          status: "selected",
          providerId: "fake-agent-os-mcp-workspace-write"
        },
        runnerResult: {
          status: "controlled_workspace_write_blocked"
        }
      } as never;
    },
    now: () => now
  });

  const result = await runtime.handleToolCallAsync({
    toolName: "agentos.dispatch_workspace_write",
    input: {
      dispatchInput: {
        schemaVersion: "agent-os-mcp-workspace-write-dispatch-test.v1"
      }
    },
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true
  });

  assert.equal(result.status, "blocked");
  assert.ok(!result.reasons.includes(
    "controlled_workspace_write_provider_dispatch_runner_completed"
  ));
  assert.ok(result.reasons.includes(
    "workspace_write_execution_target_outside_writable_roots:README.md"
  ));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_runner_status:controlled_workspace_write_blocked"
  ));
  assert.equal(result.audit.localMutationApplied, true);
});

test("Agent OS MCP local runtime prepares workspace-write dispatch from run context", async () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const artifactStore = new InMemoryArtifactStore({ now: () => now });
  const targetFile = "workspace/docs/agent-os-runtime-write.md";
  const provider = createWorkspaceWriteProvider([targetFile]);
  const providerRegistry = createWorkspaceWriteProviderRegistry(provider);
  const policyDecision = createWorkspaceWritePolicyDecision([targetFile]);
  const dispatchInputs: unknown[] = [];
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    artifactStore,
    providerExecutionPlanStore: planStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createWorkspaceWriteEligibility(policyDecision),
    grantedCapabilities: ["task.create", "workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.create_task", "agentos.dispatch_workspace_write"],
    allowLocalMutations: true,
    preferredProviderId: provider.manifest.providerId,
    workspaceWriteConsumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    controlledWorkspaceWriteProviderDispatcher(input) {
      dispatchInputs.push(input);
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "dispatch_blocked",
        runnerInvoked: false,
        executeInvoked: false,
        providerExecuteInvoked: false,
        reasons: ["agent_os_mcp_workspace_write_prepare_dispatch_test"],
        providerExecutionPlanHash: hashProviderExecutionPlannerObject(input.providerExecutionPlan),
        executorPlanHash: hashProviderExecutionPlannerObject(input.executorPlan),
        operationManifestHash: hashProviderExecutionPlannerObject(input.operations),
        providerRegistrySelection: {
          status: "selected",
          providerId: provider.manifest.providerId
        }
      } as never;
    },
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Prepare workspace-write",
      requestedAction: "Prepare a controlled Agent OS workspace-write dispatch.",
      repoRoot: "workspace",
      branch: "agentos/workspace-write",
      targetFiles: [targetFile]
    }
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "planned");

  const result = await runtime.handleToolCallAsync({
    toolName: "agentos.dispatch_workspace_write",
    input: {
      prepare: {
        runId,
        workspaceRoot: "/tmp/agent-os-runtime-workspace",
        operations: [{
          kind: "write",
          path: targetFile,
          content: "agent os runtime prepared workspace-write\n"
        }],
        executionAuthorizationId: "operator_auth_agentos_mcp_workspace_write",
        governanceState: createWorkspaceWriteGovernanceState(),
        repositoryState: {
          branch: "agentos/workspace-write",
          protectedBranch: false,
          worktreeClean: true,
          headCommit: "abc123"
        },
        permitId: "permit_agentos_mcp_workspace_write_prepare",
        maxChangedFiles: 1,
        maxDiffLines: 1
      }
    }
  });

  const preparedDispatch = result.output.preparedDispatch as {
    providerPlanId?: string;
    executorPlanId?: string;
    permitId?: string;
    preflightArtifactId?: string;
    preflightArtifactRef?: string;
    targetFiles?: string[];
  };
  const dispatchInput = dispatchInputs[0] as {
    providerExecutionPlan?: { planId?: string };
    executorPlan?: { sideEffectClass?: string };
    permit?: { permitId?: string };
    operations?: Array<{ path: string }>;
    dispatchPreflight?: {
      environmentPreflight?: {
        artifactRef?: string;
      };
    };
  };

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("agent_os_mcp_workspace_write_prepare_dispatch_test"));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_dispatch_status:dispatch_blocked"
  ));
  assert.equal(dispatchInputs.length, 1);
  assert.equal(provider.calls.planExecution, 1);
  assert.equal(provider.calls.execute, 0);
  assert.equal(preparedDispatch.providerPlanId, create.output.providerPlanId);
  assert.match(String(preparedDispatch.executorPlanId), /^executor_run_agentos_mcp_runtime_001$/);
  assert.equal(preparedDispatch.permitId, "permit_agentos_mcp_workspace_write_prepare");
  assert.deepEqual(preparedDispatch.targetFiles, [targetFile]);
  assert.equal(preparedDispatch.preflightArtifactRef, dispatchInput.dispatchPreflight?.environmentPreflight?.artifactRef);
  assert.equal(dispatchInput.providerExecutionPlan?.planId, create.output.providerPlanId);
  assert.equal(dispatchInput.executorPlan?.sideEffectClass, "workspace_write");
  assert.equal(dispatchInput.permit?.permitId, "permit_agentos_mcp_workspace_write_prepare");
  assert.deepEqual(dispatchInput.operations?.map((operation) => operation.path), [targetFile]);
  assert.equal(
    (result.output.dispatchResult as { providerExecuteInvoked?: boolean }).providerExecuteInvoked,
    false
  );
});

test("Agent OS MCP local runtime blocks workspace-write prepare outside task and policy targets", async () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const artifactStore = new InMemoryArtifactStore({ now: () => now });
  const targetFile = "workspace/docs/agent-os-runtime-write.md";
  const otherFile = "workspace/docs/agent-os-runtime-other.md";
  const provider = createWorkspaceWriteProvider([targetFile]);
  const providerRegistry = createWorkspaceWriteProviderRegistry(provider);
  const policyDecision = createWorkspaceWritePolicyDecision([targetFile]);
  const dispatchInputs: unknown[] = [];
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    artifactStore,
    providerExecutionPlanStore: planStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createWorkspaceWriteEligibility(policyDecision),
    grantedCapabilities: ["task.create", "workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.create_task", "agentos.dispatch_workspace_write"],
    allowLocalMutations: true,
    preferredProviderId: provider.manifest.providerId,
    workspaceWriteConsumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    controlledWorkspaceWriteProviderDispatcher(input) {
      dispatchInputs.push(input);
      throw new Error("dispatcher should not run for out-of-scope workspace-write target");
    },
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Prepare workspace-write with an out-of-scope target",
      requestedAction: "Prepare a controlled Agent OS workspace-write dispatch.",
      repoRoot: "workspace",
      branch: "agentos/workspace-write",
      targetFiles: [targetFile]
    }
  });
  assert.equal(create.status, "succeeded");

  const result = await runtime.handleToolCallAsync({
    toolName: "agentos.dispatch_workspace_write",
    input: {
      prepare: {
        runId,
        workspaceRoot: "/tmp/agent-os-runtime-workspace",
        operations: [{
          kind: "write",
          path: otherFile,
          content: "agent os runtime out-of-scope workspace-write\n"
        }],
        executionAuthorizationId: "operator_auth_agentos_mcp_workspace_write",
        governanceState: createWorkspaceWriteGovernanceState(),
        repositoryState: {
          branch: "agentos/workspace-write",
          protectedBranch: false,
          worktreeClean: true,
          headCommit: "abc123"
        },
        permitId: "permit_agentos_mcp_workspace_write_prepare_outside_scope",
        maxChangedFiles: 1,
        maxDiffLines: 1
      }
    }
  });

  assert.equal(result.status, "blocked");
  assert.equal(provider.calls.planExecution, 1);
  assert.equal(dispatchInputs.length, 0);
  assert.ok(result.reasons.includes(
    `${AGENT_OS_MCP_WORKSPACE_WRITE_PREPARE_TARGET_OUTSIDE_TASK}:${otherFile}`
  ));
  assert.ok(result.reasons.includes(
    `${AGENT_OS_MCP_WORKSPACE_WRITE_PREPARE_TARGET_OUTSIDE_POLICY}:${otherFile}`
  ));
  assert.ok(result.reasons.includes(
    `${AGENT_OS_MCP_WORKSPACE_WRITE_PREPARE_TARGET_OUTSIDE_EXECUTOR_PLAN}:${otherFile}`
  ));
  assert.equal(result.audit.localMutationApplied, false);
});

test("Agent OS MCP local runtime blocks workspace-write prepare without artifact store", async () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const targetFile = "workspace/docs/agent-os-runtime-write.md";
  const provider = createWorkspaceWriteProvider([targetFile]);
  const providerRegistry = createWorkspaceWriteProviderRegistry(provider);
  const policyDecision = createWorkspaceWritePolicyDecision([targetFile]);
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore,
    providerExecutionPlanStore: planStore,
    providerRegistry,
    principal: validPrincipal,
    policyDecision,
    executionEligibility: createEligibility(policyDecision),
    grantedCapabilities: ["task.create", "workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.create_task", "agentos.dispatch_workspace_write"],
    allowLocalMutations: true,
    preferredProviderId: provider.manifest.providerId,
    workspaceWriteConsumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    controlledWorkspaceWriteProviderDispatcher() {
      throw new Error("dispatcher should not run without artifact store");
    },
    now: () => now,
    createTaskId: () => taskId,
    createRunId: () => runId
  });

  const create = runtime.handleToolCall({
    toolName: "agentos.create_task",
    input: {
      title: "Prepare workspace-write without artifact store",
      requestedAction: "Prepare a controlled Agent OS workspace-write dispatch.",
      targetFiles: [targetFile]
    }
  });
  assert.equal(create.status, "succeeded");

  const result = await runtime.handleToolCallAsync({
    toolName: "agentos.dispatch_workspace_write",
    input: {
      prepare: {
        runId,
        workspaceRoot: "/tmp/agent-os-runtime-workspace",
        operations: [{
          kind: "write",
          path: targetFile,
          content: "agent os runtime prepared workspace-write\n"
        }],
        executionAuthorizationId: "operator_auth_agentos_mcp_workspace_write",
        governanceState: createWorkspaceWriteGovernanceState(),
        repositoryState: {
          branch: "agentos/workspace-write",
          protectedBranch: false,
          worktreeClean: true,
          headCommit: "abc123"
        }
      }
    }
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    AGENT_OS_MCP_WORKSPACE_WRITE_PREPARE_ARTIFACT_STORE_NOT_CONFIGURED
  ]);
  assert.equal(provider.calls.planExecution, 0);
  assert.equal(result.audit.localMutationApplied, false);
});

test("Agent OS MCP local runtime blocks workspace-write dispatch without configured dispatcher", async () => {
  const runtime = createAgentOsMcpLocalRuntime({
    kernelStore: new InMemoryKernelStore(),
    principal: validPrincipal,
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"],
    allowLocalMutations: true,
    now: () => now
  });

  const result = await runtime.handleToolCallAsync({
    toolName: "agentos.dispatch_workspace_write",
    input: {
      dispatchInput: {
        schemaVersion: "agent-os-mcp-workspace-write-dispatch-test.v1"
      }
    }
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCHER_NOT_CONFIGURED
  ]);
  assert.equal(result.audit.localMutationApplied, false);
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

type WorkspaceWriteTestProvider = ExecutorProvider & {
  calls: {
    planExecution: number;
    validateExecutionPlan: number;
    execute: number;
  };
};

function createWorkspaceWriteProvider(targetFiles: string[]): WorkspaceWriteTestProvider {
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const manifest = parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: "agent-os-mcp-workspace-write-provider",
    kind: "executor",
    displayName: "Agent OS MCP Workspace Write Provider",
    version: "0.1.0",
    capabilities: [
      "execution.plan",
      "execution.validate",
      ...targetFiles.map((path) => `fs.write:${path}`)
    ],
    requiredConfig: {
      keys: [],
      optionalKeys: []
    },
    securityBoundary: {
      isolation: "process",
      networkAccess: "none",
      filesystemAccess: "workspace-write",
      secretAccess: "none",
      notes: ["test fixture"]
    },
    supportedSandboxProfiles: [createWorkspaceWriteSandboxProfile()],
    supportedSideEffectClasses: ["workspace_write"],
    enabled: true,
    metadata: {}
  });

  return {
    manifest,
    calls,
    planExecution(input: ExecutionPlanInput): ExecutorExecutionPlan {
      calls.planExecution += 1;
      return parseExecutorExecutionPlan({
        schemaVersion: "executor-execution-plan.v1",
        kind: "executor",
        planId: `executor_${input.run.runId}`,
        runId: input.run.runId,
        taskId: input.task.taskId,
        ...(input.taskHash !== undefined ? { taskHash: input.taskHash } : {}),
        ...(input.principalId !== undefined ? { principalId: input.principalId } : {}),
        ...(input.principalHash !== undefined ? { principalHash: input.principalHash } : {}),
        ...(input.providerExecutionPlanHash !== undefined
          ? { providerExecutionPlanHash: input.providerExecutionPlanHash }
          : {}),
        ...(input.providerManifestHash !== undefined
          ? { providerManifestHash: input.providerManifestHash }
          : {}),
        providerId: manifest.providerId,
        inputHash: input.inputHash ?? "1".repeat(64),
        policyDecisionHash: hashProviderExecutionPlannerObject(input.policyDecision),
        requiredCapabilities: targetFiles.map((path) => `fs.write:${path}`),
        approvalRequired: true,
        sandboxProfile: input.sandboxProfile,
        sideEffectClass: "workspace_write",
        createdAt: input.now,
        metadata: {
          controlledWorkspaceWrite: true,
          source: "agent-os-mcp-local-runtime-test"
        }
      });
    },
    validateExecutionPlan(_plan: ExecutorExecutionPlan): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(
      _plan: ExecutorExecutionPlan,
      _context: ProviderExecutionContext
    ): ProviderExecutionResult {
      calls.execute += 1;
      throw new Error("agent_os_mcp_workspace_write_provider_execute_forbidden");
    }
  };
}

function createWorkspaceWriteProviderRegistry(
  provider: WorkspaceWriteTestProvider
): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.registerProvider(provider.manifest, provider);
  return registry;
}

function createWorkspaceWritePolicyDecision(targetFiles: string[]): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "decision_agentos_mcp_runtime_workspace_write",
    taskId,
    risk: {
      level: "medium",
      factors: ["workspace_write"],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      executor: "codex-cli",
      model: "gpt-5.4-mini",
      profile: "workspace-write",
      reasoningEffort: "low",
      sandbox: createWorkspaceWriteSandboxProfile()
    },
    capabilities: targetFiles.map((path) => CapabilityScopeSchema.parse({
      kind: "file",
      resource: path,
      access: "write"
    })),
    approval: {
      required: true,
      reasons: ["workspace_write_requires_operator_authorization"]
    },
    createdAt: now,
    legacy: {
      taskClass: "small_edit",
      toolAccess: "local_write"
    }
  });
}

function createWorkspaceWriteEligibility(policyDecision: PolicyDecision) {
  return {
    status: "eligible" as const,
    taskId,
    runId,
    policyDecisionHash: hashApprovalScope(policyDecision),
    reasons: ["capability_grants_satisfied", "valid_approval_permit"],
    missingCapabilities: [],
    requiredApprovals: [],
    acceptedPermits: ["permit_agentos_mcp_workspace_write_planner"],
    rejectedPermits: [],
    createdAt: now
  };
}

function createWorkspaceWriteSandboxProfile(): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_agentos_mcp_runtime_workspace_write",
    mode: "workspace-write",
    networkAccess: "none",
    writableRoots: ["workspace"],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function createWorkspaceWriteGovernanceState() {
  return {
    schemaVersion: "governance-state.v1",
    taskId,
    branchId: "main",
    phase: "execution",
    trustBalance: {
      centralOrder: 0.5,
      distributedVitality: 0.5
    },
    risk: {
      entanglement: 0.2,
      entropy: 0.2,
      failureCost: 0.2,
      reversibility: 0.8,
      contextPressure: 0.2,
      historicalTrust: 0.5,
      globalCoherence: 0.9,
      finalRiskLevel: "low"
    },
    anomalies: [],
    approvals: [],
    taskGraphRef: `task-graph:${taskId}`,
    createdAt: now,
    updatedAt: now
  };
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
