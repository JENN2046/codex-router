import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAgentOsCliArgv,
  runAgentOsCliCommand,
  runAgentOsCliCommandAsync,
  sanitizeAgentOsCliArgv
} from "../packages/agent-os-cli/src/index.js";
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
  AGENT_OS_MCP_TOOL_CAPABILITY_MISSING,
  AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCH_REQUIRES_ASYNC
} from "../packages/protocol-mcp/src/index.js";
import {
  createApprovalPermit,
  hashApprovalScope,
  InMemoryApprovalPermitStore
} from "../packages/governance-internal-approval-permit/src/index.js";
import type {
  ControlledWorkspaceWriteHostProviderDispatchInput
} from "../packages/host-dispatcher/src/index.js";
import {
  InMemoryProviderExecutionPermitConsumptionStore
} from "../packages/provider-core/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import {
  createAgentOsWorkspaceWriteEligibility,
  createAgentOsWorkspaceWriteGovernanceState,
  createAgentOsWorkspaceWritePolicyDecision,
  createAgentOsWorkspaceWriteProvider,
  createAgentOsWorkspaceWriteProviderRegistry
} from "./fixtures/agent-os-workspace-write-fixture.js";

const now = "2026-06-10T01:00:00.000Z";
const taskId = "task_agentos_cli_001";
const runId = "run_agentos_cli_001";

test("Agent OS CLI parser maps create-task argv to a governed tool call", () => {
  const parsed = parseAgentOsCliArgv([
    "create-task",
    "--title",
    "CLI task",
    "--requested-action",
    "Create a task from CLI argv.",
    "--success-criteria",
    "run is queued",
    "--target-file",
    "packages/agent-os-cli/src/index.ts",
    "--grant",
    "task.create",
    "--approve-tool",
    "agentos.create_task",
    "--allow-local-mutation",
    "--preferred-provider",
    "codex-cli"
  ]);

  assert.equal(parsed.command, "create-task");
  assert.equal(parsed.toolName, "agentos.create_task");
  assert.equal(parsed.toolInput.title, "CLI task");
  assert.deepEqual(parsed.grantedCapabilities, ["task.create"]);
  assert.deepEqual(parsed.approvedMutatingTools, ["agentos.create_task"]);
  assert.equal(parsed.allowLocalMutations, true);
  assert.equal(parsed.preferredProviderId, "codex-cli");
});

test("Agent OS CLI parser maps approve-run argv to a governed tool call", () => {
  const parsed = parseAgentOsCliArgv([
    "approve-run",
    "--run-id",
    runId,
    "--capability-scope",
    "fs.read:workspace/docs/report.md",
    "--expires-at",
    "2026-06-10T02:00:00.000Z",
    "--reason",
    "CLI approval",
    "--grant",
    "approval.issue",
    "--approve-tool",
    "agentos.approve_run",
    "--allow-local-mutation"
  ]);

  assert.equal(parsed.command, "approve-run");
  assert.equal(parsed.toolName, "agentos.approve_run");
  assert.deepEqual(parsed.toolInput, {
    runId,
    capabilityScopes: ["fs.read:workspace/docs/report.md"],
    expiresAt: "2026-06-10T02:00:00.000Z",
    reason: "CLI approval"
  });
  assert.deepEqual(parsed.grantedCapabilities, ["approval.issue"]);
  assert.deepEqual(parsed.approvedMutatingTools, ["agentos.approve_run"]);
  assert.equal(parsed.allowLocalMutations, true);
});

test("Agent OS CLI parser maps workspace-write dispatch argv to a governed tool call", () => {
  const parsed = parseAgentOsCliArgv([
    "dispatch-workspace-write",
    "--dispatch-input-json",
    "{\"schemaVersion\":\"agent-os-cli-workspace-write-dispatch-test.v1\"}",
    "--grant",
    "workspace_write.dispatch",
    "--approve-tool",
    "agentos.dispatch_workspace_write",
    "--allow-local-mutation"
  ]);

  assert.equal(parsed.command, "dispatch-workspace-write");
  assert.equal(parsed.toolName, "agentos.dispatch_workspace_write");
  assert.deepEqual(parsed.toolInput, {
    dispatchInput: {
      schemaVersion: "agent-os-cli-workspace-write-dispatch-test.v1"
    }
  });
  assert.deepEqual(parsed.grantedCapabilities, ["workspace_write.dispatch"]);
  assert.deepEqual(parsed.approvedMutatingTools, ["agentos.dispatch_workspace_write"]);
  assert.equal(parsed.allowLocalMutations, true);
});

test("Agent OS CLI parser maps workspace-write prepare argv to a governed tool call", () => {
  const prepare = {
    runId,
    workspaceRoot: "/tmp/agent-os-cli-workspace",
    operations: [{
      kind: "write",
      path: "workspace/docs/agent-os-cli-write.md",
      content: "agent os cli prepared workspace-write\n"
    }],
    executionAuthorizationId: "operator_auth_agentos_cli_workspace_write",
    governanceState: createAgentOsWorkspaceWriteGovernanceState({ taskId, now }),
    repositoryState: {
      branch: "agentos/cli-workspace-write",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "abc123"
    }
  };
  const parsed = parseAgentOsCliArgv([
    "dispatch-workspace-write",
    "--prepare-json",
    JSON.stringify(prepare),
    "--grant",
    "workspace_write.dispatch",
    "--approve-tool",
    "agentos.dispatch_workspace_write",
    "--allow-local-mutation"
  ]);

  assert.equal(parsed.command, "dispatch-workspace-write");
  assert.equal(parsed.toolName, "agentos.dispatch_workspace_write");
  assert.deepEqual(parsed.toolInput, { prepare });
  assert.deepEqual(parsed.grantedCapabilities, ["workspace_write.dispatch"]);
  assert.deepEqual(parsed.approvedMutatingTools, ["agentos.dispatch_workspace_write"]);
  assert.equal(parsed.allowLocalMutations, true);
});

test("Agent OS CLI wrapper blocks local mutation by default", () => {
  const kernelStore = new InMemoryKernelStore();
  const result = runAgentOsCliCommand({
    ...createRuntimeInput(kernelStore),
    argv: [
      "create-task",
      "--title",
      "Blocked CLI task",
      "--requested-action",
      "Try to create a task without gates."
    ]
  });

  assert.equal(result.surface, "cli");
  assert.equal(result.command, "create-task");
  assert.equal(result.status, "blocked");
  assert.equal(result.audit.publicSurface, "cli");
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_CAPABILITY_MISSING}:task.create`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED}:agentos.create_task`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_LOCAL_MUTATION_DISABLED}:agentos.create_task`));
  assert.deepEqual(kernelStore.listRuns(), []);
});

test("Agent OS CLI wrapper creates a local run and provider plan without spawning CLI", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const result = runAgentOsCliCommand({
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    argv: [
      "create-task",
      "--title",
      "CLI governed task",
      "--requested-action",
      "Create a task from the Agent OS CLI wrapper.",
      "--success-criteria",
      "run is queued",
      "--out-of-scope",
      "real Codex CLI execution",
      "--repo-root",
      "A:/AGENTS_OS_Workspace/governance/codex-router/repo",
      "--branch",
      "feature/phase-4-provider-execution-runner",
      "--target-file",
      "packages/agent-os-cli/src/index.ts",
      "--metadata-json",
      "{\"source\":\"phase-8-cli-test\",\"token\":\"raw-token\"}",
      "--grant",
      "task.create",
      "--approve-tool",
      "agentos.create_task",
      "--allow-local-mutation",
      "--preferred-provider",
      "codex-cli"
    ]
  });

  const providerPlanId = String(result.output.providerPlanId);
  assert.equal(result.status, "succeeded");
  assert.equal(result.surface, "cli");
  assert.equal(result.audit.publicSurface, "cli");
  assert.equal(result.audit.liveMcpServerConnection, false);
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationApplied, true);
  assert.equal(result.sanitizedArgv.includes("{\"source\":\"phase-8-cli-test\",\"token\":\"raw-token\"}"), false);
  assert.equal(result.sanitizedArgv.includes("<REDACTED>"), true);

  assert.equal(kernelStore.getRun(runId)?.taskId, taskId);
  assert.equal(planStore.getPlan(providerPlanId)?.providerId, "codex-cli");
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    ["kernel.run.created", "kernel.public_surface.cli.create_task"]
  );

  const getRun = runAgentOsCliCommand({
    ...createRuntimeInput(kernelStore),
    argv: [
      "get-run",
      "--run-id",
      runId,
      "--grant",
      "run.read"
    ]
  });
  assert.equal(getRun.status, "succeeded");
  assert.equal((getRun.output.run as { runId?: string }).runId, runId);

  const searchEvents = runAgentOsCliCommand({
    ...createRuntimeInput(kernelStore),
    argv: [
      "search-events",
      "--run-id",
      runId,
      "--event-type",
      "kernel.public_surface.cli.create_task",
      "--grant",
      "event.read"
    ]
  });
  assert.equal(searchEvents.status, "succeeded");
  assert.deepEqual(
    (searchEvents.output.events as Array<{ eventType: string }>).map((event) => event.eventType),
    ["kernel.public_surface.cli.create_task"]
  );
});

test("Agent OS CLI wrapper delegates controlled workspace-write dispatch asynchronously", async () => {
  const dispatchInputs: unknown[] = [];
  const dispatchInput = {
    schemaVersion: "agent-os-cli-workspace-write-dispatch-test.v1"
  };
  const argv = [
    "dispatch-workspace-write",
    "--dispatch-input-json",
    JSON.stringify(dispatchInput),
    "--grant",
    "workspace_write.dispatch",
    "--approve-tool",
    "agentos.dispatch_workspace_write",
    "--allow-local-mutation"
  ];
  const runtimeInput = {
    ...createRuntimeInput(new InMemoryKernelStore()),
    workspaceWriteConsumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    controlledWorkspaceWriteProviderDispatcher(input: unknown) {
      dispatchInputs.push(input);
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "dispatch_blocked",
        runnerInvoked: false,
        executeInvoked: false,
        providerExecuteInvoked: false,
        reasons: ["agent_os_cli_workspace_write_dispatch_test"],
        providerExecutionPlanHash: "sha256:agent-os-cli-provider-plan",
        executorPlanHash: "sha256:agent-os-cli-executor-plan",
        operationManifestHash: "sha256:agent-os-cli-operations",
        providerRegistrySelection: {
          status: "selected",
          providerId: "fake-agent-os-cli-workspace-write"
        }
      } as never;
    }
  };

  const syncResult = runAgentOsCliCommand({
    ...runtimeInput,
    argv
  });
  assert.equal(syncResult.status, "blocked");
  assert.deepEqual(syncResult.reasons, [
    AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCH_REQUIRES_ASYNC
  ]);
  assert.equal(dispatchInputs.length, 0);

  const result = await runAgentOsCliCommandAsync({
    ...runtimeInput,
    argv
  });

  assert.equal(dispatchInputs.length, 1);
  assert.deepEqual(dispatchInputs[0], dispatchInput);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("agent_os_cli_workspace_write_dispatch_test"));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_dispatch_status:dispatch_blocked"
  ));
  assert.equal(result.surface, "cli");
  assert.equal(result.command, "dispatch-workspace-write");
  assert.equal(result.audit.publicSurface, "cli");
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationAttempted, true);
  assert.equal(result.audit.localMutationApplied, false);
  assert.equal(
    (result.output.dispatchResult as { providerExecuteInvoked?: boolean }).providerExecuteInvoked,
    false
  );
  assert.equal(result.sanitizedArgv.includes(JSON.stringify(dispatchInput)), false);
  assert.equal(result.sanitizedArgv.includes("<REDACTED>"), true);
});

test("Agent OS CLI wrapper prepares controlled workspace-write dispatch asynchronously", async () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const artifactStore = new InMemoryArtifactStore({ now: () => now });
  const targetFile = "workspace/docs/agent-os-cli-write.md";
  const provider = createAgentOsWorkspaceWriteProvider({
    providerId: "agent-os-cli-workspace-write-provider",
    targetFiles: [targetFile],
    sandboxId: "sandbox_agentos_cli_workspace_write",
    source: "agent-os-cli-test"
  });
  const providerRegistry = createAgentOsWorkspaceWriteProviderRegistry(provider);
  const policyDecision = createAgentOsWorkspaceWritePolicyDecision({
    basePolicyDecision: validPolicyDecision,
    decisionId: "decision_agentos_cli_workspace_write",
    taskId,
    targetFiles: [targetFile],
    sandboxId: "sandbox_agentos_cli_workspace_write",
    now
  });
  const dispatchInputs: unknown[] = [];
  const runtimeInput = {
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    artifactStore,
    workspaceWriteConsumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    executionEligibility: createAgentOsWorkspaceWriteEligibility({
      policyDecision,
      taskId,
      runId,
      permitId: "permit_agentos_cli_workspace_write_planner",
      now
    }),
    controlledWorkspaceWriteProviderDispatcher(
      input: ControlledWorkspaceWriteHostProviderDispatchInput
    ) {
      dispatchInputs.push(input);
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "dispatch_blocked",
        runnerInvoked: false,
        executeInvoked: false,
        providerExecuteInvoked: false,
        reasons: ["agent_os_cli_workspace_write_prepare_dispatch_test"],
        providerExecutionPlanHash: hashProviderExecutionPlannerObject(input.providerExecutionPlan),
        executorPlanHash: hashProviderExecutionPlannerObject(input.executorPlan),
        operationManifestHash: hashProviderExecutionPlannerObject(input.operations),
        providerRegistrySelection: {
          status: "selected",
          providerId: provider.manifest.providerId
        }
      } as never;
    }
  };
  const create = runAgentOsCliCommand({
    ...runtimeInput,
    argv: [
      "create-task",
      "--title",
      "CLI workspace-write prepare",
      "--requested-action",
      "Prepare a controlled workspace-write from CLI prepare JSON.",
      "--repo-root",
      "workspace",
      "--branch",
      "agentos/cli-workspace-write",
      "--target-file",
      targetFile,
      "--grant",
      "task.create",
      "--approve-tool",
      "agentos.create_task",
      "--allow-local-mutation",
      "--preferred-provider",
      provider.manifest.providerId
    ]
  });
  assert.equal(create.status, "succeeded");

  const prepare = {
    runId,
    workspaceRoot: "/tmp/agent-os-cli-workspace",
    operations: [{
      kind: "write",
      path: targetFile,
      content: "agent os cli prepared workspace-write\n"
    }],
    executionAuthorizationId: "operator_auth_agentos_cli_workspace_write",
    governanceState: createAgentOsWorkspaceWriteGovernanceState({ taskId, now }),
    repositoryState: {
      branch: "agentos/cli-workspace-write",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "abc123"
    },
    permitId: "permit_agentos_cli_workspace_write_prepare",
    maxChangedFiles: 1,
    maxDiffLines: 1
  };
  const argv = [
    "dispatch-workspace-write",
    "--prepare-json",
    JSON.stringify(prepare),
    "--grant",
    "workspace_write.dispatch",
    "--approve-tool",
    "agentos.dispatch_workspace_write",
    "--allow-local-mutation"
  ];
  const result = await runAgentOsCliCommandAsync({
    ...runtimeInput,
    argv
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
  assert.ok(result.reasons.includes("agent_os_cli_workspace_write_prepare_dispatch_test"));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_dispatch_status:dispatch_blocked"
  ));
  assert.equal(result.surface, "cli");
  assert.equal(result.command, "dispatch-workspace-write");
  assert.equal(preparedDispatch.providerPlanId, create.output.providerPlanId);
  assert.equal(preparedDispatch.permitId, "permit_agentos_cli_workspace_write_prepare");
  assert.deepEqual(preparedDispatch.targetFiles, [targetFile]);
  assert.equal(
    (result.output.dispatchResult as { providerExecuteInvoked?: boolean }).providerExecuteInvoked,
    false
  );
  assert.equal(result.sanitizedArgv.includes(JSON.stringify(prepare)), false);
  assert.equal(result.sanitizedArgv.includes("<REDACTED>"), true);
});

test("Agent OS CLI wrapper issues an approval permit without spawning CLI", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtimeInput = {
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_cli_001"
  };

  const create = runAgentOsCliCommand({
    ...runtimeInput,
    argv: [
      "create-task",
      "--title",
      "CLI governed task",
      "--requested-action",
      "Create a run before CLI approval.",
      "--grant",
      "task.create",
      "--approve-tool",
      "agentos.create_task",
      "--allow-local-mutation",
      "--preferred-provider",
      "codex-cli"
    ]
  });
  assert.equal(create.status, "succeeded");

  const approve = runAgentOsCliCommand({
    ...runtimeInput,
    argv: [
      "approve-run",
      "--run-id",
      runId,
      "--capability-scope",
      "fs.read:workspace/docs/report.md",
      "--reason",
      "CLI approval",
      "--grant",
      "approval.issue",
      "--approve-tool",
      "agentos.approve_run",
      "--allow-local-mutation"
    ]
  });

  const storedPermit = permitStore.getPermit("permit_agentos_cli_001");
  assert.equal(approve.status, "succeeded");
  assert.equal(approve.surface, "cli");
  assert.equal(approve.command, "approve-run");
  assert.equal(approve.audit.publicSurface, "cli");
  assert.equal(approve.audit.localMutationApplied, true);
  assert.deepEqual(approve.output, {
    permitId: "permit_agentos_cli_001",
    runId,
    expiresAt: "2026-06-10T02:00:00.000Z"
  });
  assert.equal(storedPermit?.runId, runId);
  assert.deepEqual(storedPermit?.capabilityScopes, ["fs.read:workspace/docs/report.md"]);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.cli.create_task",
      "kernel.approval.permit.issued"
    ]
  );
});

test("Agent OS CLI wrapper consumes approval permits without spawning CLI", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtimeInput = {
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    executionEligibility: createWaitingEligibility(policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_cli_consumed"
  };

  const create = runAgentOsCliCommand({
    ...runtimeInput,
    argv: [
      "create-task",
      "--title",
      "CLI approval consumption task",
      "--requested-action",
      "Create a run that waits for CLI approval consumption.",
      "--grant",
      "task.create",
      "--approve-tool",
      "agentos.create_task",
      "--allow-local-mutation",
      "--preferred-provider",
      "codex-cli"
    ]
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "waiting_approval");

  const approve = runAgentOsCliCommand({
    ...runtimeInput,
    argv: [
      "approve-run",
      "--run-id",
      runId,
      "--capability-scope",
      "fs.read:workspace/**",
      "--reason",
      "CLI approval consumption",
      "--grant",
      "approval.issue",
      "--approve-tool",
      "agentos.approve_run",
      "--allow-local-mutation"
    ]
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
  assert.equal(approve.audit.realProviderExecutionInvoked, false);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.cli.create_task",
      "kernel.approval.permit.issued",
      "kernel.approval.permit.consumed"
    ]
  );
});

test("Agent OS CLI wrapper preserves rejected permit audit without spawning CLI", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtimeInput = {
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    executionEligibility: createWaitingEligibility(policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_cli_valid_after_rejected"
  };

  const create = runAgentOsCliCommand({
    ...runtimeInput,
    argv: [
      "create-task",
      "--title",
      "CLI rejected permit audit task",
      "--requested-action",
      "Create a run with rejected CLI approval candidates.",
      "--grant",
      "task.create",
      "--approve-tool",
      "agentos.create_task",
      "--allow-local-mutation",
      "--preferred-provider",
      "codex-cli"
    ]
  });
  assert.equal(create.status, "succeeded");
  assert.equal(create.output.providerPlanStatus, "waiting_approval");

  const waitingPlan = planStore.listPlans({ runId }).at(-1);
  assert.ok(waitingPlan);
  permitStore.savePermit(createApprovalPermit({
    permitId: "permit_agentos_cli_expired_candidate",
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

  const approve = runAgentOsCliCommand({
    ...runtimeInput,
    argv: [
      "approve-run",
      "--run-id",
      runId,
      "--capability-scope",
      "fs.read:workspace/**",
      "--reason",
      "CLI replacement approval",
      "--grant",
      "approval.issue",
      "--approve-tool",
      "agentos.approve_run",
      "--allow-local-mutation"
    ]
  });
  const consumedEvent = kernelStore.listEvents({
    runId,
    type: "kernel.approval.permit.consumed"
  }).at(-1);
  const payload = consumedEvent?.payload as {
    acceptedPermits?: string[];
    rejectedPermits?: string[];
  } | undefined;

  assert.equal(approve.status, "succeeded");
  assert.deepEqual(payload?.acceptedPermits, [
    "permit_agentos_cli_valid_after_rejected"
  ]);
  assert.ok(payload?.rejectedPermits?.some((reason) => (
    reason.includes("permit_agentos_cli_expired_candidate")
    && reason.includes("permit_expired")
  )));
  assert.equal(approve.audit.realProviderExecutionInvoked, false);
  assert.equal(planStore.listPlans({ runId }).at(-1)?.status, "planned");
});

test("Agent OS CLI parser accepts cursors on paginated commands", () => {
  const listRuns = parseAgentOsCliArgv([
    "list-runs",
    "--task-id",
    taskId,
    "--status",
    "queued",
    "--limit",
    "2",
    "--cursor",
    "agentos-list-runs:2"
  ]);
  assert.equal(listRuns.toolName, "agentos.list_runs");
  assert.deepEqual(listRuns.toolInput, {
    taskId,
    status: "queued",
    limit: 2,
    cursor: "agentos-list-runs:2"
  });

  const listArtifacts = parseAgentOsCliArgv([
    "list-artifacts",
    "--task-id",
    taskId,
    "--run-id",
    runId,
    "--kind",
    "evidence",
    "--limit",
    "2",
    "--cursor",
    "agentos-list-artifacts:2"
  ]);
  assert.equal(listArtifacts.toolName, "agentos.list_artifacts");
  assert.deepEqual(listArtifacts.toolInput, {
    taskId,
    runId,
    kind: "evidence",
    limit: 2,
    cursor: "agentos-list-artifacts:2"
  });

  const searchEvents = parseAgentOsCliArgv([
    "search-events",
    "--query",
    "cursor-pagination",
    "--task-id",
    taskId,
    "--run-id",
    runId,
    "--event-type",
    "event.one",
    "--event-type",
    "event.two",
    "--limit",
    "2",
    "--cursor",
    "agentos-search-events:2"
  ]);
  assert.equal(searchEvents.toolName, "agentos.search_events");
  assert.deepEqual(searchEvents.toolInput, {
    query: "cursor-pagination",
    taskId,
    runId,
    eventTypes: ["event.one", "event.two"],
    limit: 2,
    cursor: "agentos-search-events:2"
  });
});

test("Agent OS CLI sanitizer redacts secret-like option values", () => {
  assert.deepEqual(
    sanitizeAgentOsCliArgv([
      "create-task",
      "--title",
      "safe",
      "--metadata-json",
      "{\"apiKey\":\"secret\"}",
      "dispatch-workspace-write",
      "--dispatch-input-json",
      "{\"token\":\"raw-token\"}",
      "--prepare-json",
      "{\"token\":\"raw-token\"}",
      "--token",
      "raw-token"
    ]),
    [
      "create-task",
      "--title",
      "safe",
      "--metadata-json",
      "<REDACTED>",
      "dispatch-workspace-write",
      "--dispatch-input-json",
      "<REDACTED>",
      "--prepare-json",
      "<REDACTED>",
      "--token",
      "<REDACTED>"
    ]
  );

  assert.deepEqual(
    sanitizeAgentOsCliArgv([
      "create-task",
      "--api-key=raw-api-key",
      "--title",
      "safe",
      "--token=raw-token",
      "--target-file",
      "packages/agent-os-cli/src/index.ts"
    ]),
    [
      "create-task",
      "--api-key=<REDACTED>",
      "--title",
      "safe",
      "--token=<REDACTED>",
      "--target-file",
      "packages/agent-os-cli/src/index.ts"
    ]
  );
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
    decisionId: "decision_agentos_cli_001",
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
        sandboxId: "sandbox_agentos_cli_readonly",
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
