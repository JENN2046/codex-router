import test from "node:test";
import assert from "node:assert/strict";
import {
  handleAgentOsAppServerRequest,
  handleAgentOsAppServerRequestAsync,
  routeAgentOsAppServerRequest,
  type AgentOsAppServerRequest
} from "../packages/agent-os-app-server/src/index.js";
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
  AGENT_OS_MCP_ARTIFACT_NOT_FOUND,
  AGENT_OS_MCP_LOCAL_MUTATION_DISABLED,
  AGENT_OS_MCP_RUN_NOT_FOUND,
  AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED,
  AGENT_OS_MCP_TOOL_CAPABILITY_MISSING,
  AGENT_OS_MCP_WORKSPACE_WRITE_CONSUMPTION_STORE_REQUIRED,
  AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCH_REQUIRES_ASYNC,
  type AgentOsMcpToolName
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

const now = "2026-06-10T02:00:00.000Z";
const taskId = "task_agentos_app_server_001";
const runId = "run_agentos_app_server_001";

test("Agent OS App Server router maps HTTP-like routes to governed tool calls", () => {
  assert.deepEqual(routeAgentOsAppServerRequest({
    method: "POST",
    path: "/agent-os/tasks",
    body: {
      title: "App task",
      requestedAction: "Create an app-server task."
    }
  }), {
    toolName: "agentos.create_task",
    input: {
      title: "App task",
      requestedAction: "Create an app-server task."
    }
  });

  assert.deepEqual(routeAgentOsAppServerRequest({
    method: "GET",
    path: "/agent-os/runs/run_001"
  }), {
    toolName: "agentos.get_run",
    input: {
      runId: "run_001"
    }
  });

  assert.deepEqual(routeAgentOsAppServerRequest({
    method: "POST",
    path: "/agent-os/workspace-write/dispatch",
    body: {
      dispatchInput: {
        schemaVersion: "agent-os-app-server-workspace-write-dispatch-test.v1"
      }
    }
  }), {
    toolName: "agentos.dispatch_workspace_write",
    input: {
      dispatchInput: {
        schemaVersion: "agent-os-app-server-workspace-write-dispatch-test.v1"
      }
    }
  });

  assert.deepEqual(routeAgentOsAppServerRequest({
    method: "POST",
    path: "/agent-os/runs/run_url_001/cancel",
    body: {
      runId: "run_body_001",
      reason: "operator requested stop"
    }
  }), {
    toolName: "agentos.cancel_run",
    input: {
      runId: "run_url_001",
      reason: "operator requested stop"
    }
  });

  assert.deepEqual(routeAgentOsAppServerRequest({
    method: "POST",
    path: "/agent-os/runs/run_url_001/approve",
    body: {
      runId: "run_body_001",
      capabilityScopes: ["fs.read:workspace/docs/report.md"],
      reason: "operator approved plan"
    }
  }), {
    toolName: "agentos.approve_run",
    input: {
      runId: "run_url_001",
      capabilityScopes: ["fs.read:workspace/docs/report.md"],
      reason: "operator approved plan"
    }
  });

  assert.deepEqual(routeAgentOsAppServerRequest({
    method: "GET",
    path: "/agent-os/runs",
    query: {
      taskId: "task_001",
      status: "queued",
      limit: "2",
      cursor: "agentos-list-runs:2"
    }
  }), {
    toolName: "agentos.list_runs",
    input: {
      taskId: "task_001",
      status: "queued",
      limit: 2,
      cursor: "agentos-list-runs:2"
    }
  });

  assert.deepEqual(routeAgentOsAppServerRequest({
    method: "GET",
    path: "/agent-os/artifacts",
    query: {
      taskId: "task_001",
      runId: "run_001",
      kind: "evidence",
      limit: "2",
      cursor: "agentos-list-artifacts:2"
    }
  }), {
    toolName: "agentos.list_artifacts",
    input: {
      taskId: "task_001",
      runId: "run_001",
      kind: "evidence",
      limit: 2,
      cursor: "agentos-list-artifacts:2"
    }
  });

  assert.deepEqual(routeAgentOsAppServerRequest({
    method: "GET",
    path: "/agent-os/events",
    query: {
      query: "cursor-pagination",
      taskId: "task_001",
      runId: "run_001",
      eventTypes: ["event.one", "event.two"],
      limit: "2",
      cursor: "agentos-search-events:2"
    }
  }), {
    toolName: "agentos.search_events",
    input: {
      query: "cursor-pagination",
      taskId: "task_001",
      runId: "run_001",
      eventTypes: ["event.one", "event.two"],
      limit: 2,
      cursor: "agentos-search-events:2"
    }
  });
});

test("Agent OS App Server wrapper delegates controlled workspace-write dispatch asynchronously without network", async () => {
  const dispatchInputs: unknown[] = [];
  const dispatchInput = {
    schemaVersion: "agent-os-app-server-workspace-write-dispatch-test.v1"
  };
  const runtimeInput = {
    ...createRuntimeInput(new InMemoryKernelStore()),
    workspaceWriteConsumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"] as AgentOsMcpToolName[],
    allowLocalMutations: true,
    controlledWorkspaceWriteProviderDispatcher(input: unknown) {
      dispatchInputs.push(input);
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "dispatch_blocked",
        runnerInvoked: false,
        executeInvoked: false,
        providerExecuteInvoked: false,
        reasons: ["agent_os_app_server_workspace_write_dispatch_test"],
        providerExecutionPlanHash: "sha256:agent-os-app-server-provider-plan",
        executorPlanHash: "sha256:agent-os-app-server-executor-plan",
        operationManifestHash: "sha256:agent-os-app-server-operations",
        providerRegistrySelection: {
          status: "selected",
          providerId: "fake-agent-os-app-server-workspace-write"
        }
      } as never;
    },
    request: {
      method: "POST",
      path: "/agent-os/workspace-write/dispatch",
      body: {
        dispatchInput
      }
    }
  };

  const syncResponse = handleAgentOsAppServerRequest(runtimeInput);
  const syncResult = syncResponse.body.result as {
    status: string;
    reasons: string[];
  };
  assert.equal(syncResponse.statusCode, 403);
  assert.equal(syncResult.status, "blocked");
  assert.deepEqual(syncResult.reasons, [
    AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCH_REQUIRES_ASYNC
  ]);
  assert.equal(dispatchInputs.length, 0);

  const response = await handleAgentOsAppServerRequestAsync(runtimeInput);
  const result = response.body.result as {
    status: string;
    reasons: string[];
    output: Record<string, unknown>;
    audit: {
      publicSurface: string;
      realProviderExecutionInvoked: boolean;
      localMutationAttempted: boolean;
      localMutationApplied: boolean;
    };
  };

  assert.equal(dispatchInputs.length, 1);
  assert.equal(dispatchInputs[0], dispatchInput);
  assert.equal(response.statusCode, 403);
  assert.equal(response.audit.liveHttpServerStarted, false);
  assert.equal(response.audit.networkAccessed, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("agent_os_app_server_workspace_write_dispatch_test"));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_dispatch_status:dispatch_blocked"
  ));
  assert.equal(result.audit.publicSurface, "app_server");
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationAttempted, true);
  assert.equal(result.audit.localMutationApplied, false);
  assert.equal(
    (result.output.dispatchResult as { providerExecuteInvoked?: boolean }).providerExecuteInvoked,
    false
  );
});

test("Agent OS App Server wrapper blocks workspace-write dispatch without shared consumption store", async () => {
  let dispatcherInvoked = false;
  const response = await handleAgentOsAppServerRequestAsync({
    ...createRuntimeInput(new InMemoryKernelStore()),
    grantedCapabilities: ["workspace_write.dispatch"],
    approvedMutatingTools: ["agentos.dispatch_workspace_write"] as AgentOsMcpToolName[],
    allowLocalMutations: true,
    controlledWorkspaceWriteProviderDispatcher() {
      dispatcherInvoked = true;
      throw new Error("dispatcher should not run without shared consumption store");
    },
    request: {
      method: "POST",
      path: "/agent-os/workspace-write/dispatch",
      body: {
        dispatchInput: {
          schemaVersion: "agent-os-app-server-workspace-write-dispatch-test.v1"
        }
      }
    }
  });
  const result = response.body.result as {
    status: string;
    reasons: string[];
    audit: {
      localMutationAttempted: boolean;
      localMutationApplied: boolean;
    };
  };

  assert.equal(dispatcherInvoked, false);
  assert.equal(response.statusCode, 403);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    AGENT_OS_MCP_WORKSPACE_WRITE_CONSUMPTION_STORE_REQUIRED
  ]);
  assert.equal(result.audit.localMutationAttempted, true);
  assert.equal(result.audit.localMutationApplied, false);
  assert.equal(response.audit.liveHttpServerStarted, false);
  assert.equal(response.audit.networkAccessed, false);
});

test("Agent OS App Server wrapper prepares controlled workspace-write dispatch asynchronously without network", async () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const artifactStore = new InMemoryArtifactStore({ now: () => now });
  const targetFile = "workspace/docs/agent-os-app-server-write.md";
  const provider = createAgentOsWorkspaceWriteProvider({
    providerId: "agent-os-app-server-workspace-write-provider",
    targetFiles: [targetFile],
    sandboxId: "sandbox_agentos_app_server_workspace_write",
    source: "agent-os-app-server-test"
  });
  const providerRegistry = createAgentOsWorkspaceWriteProviderRegistry(provider);
  const policyDecision = createAgentOsWorkspaceWritePolicyDecision({
    basePolicyDecision: validPolicyDecision,
    decisionId: "decision_agentos_app_server_workspace_write",
    taskId,
    targetFiles: [targetFile],
    sandboxId: "sandbox_agentos_app_server_workspace_write",
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
      permitId: "permit_agentos_app_server_workspace_write_planner",
      now
    }),
    grantedCapabilities: ["task.create", "workspace_write.dispatch"],
    approvedMutatingTools: [
      "agentos.create_task",
      "agentos.dispatch_workspace_write"
    ] as AgentOsMcpToolName[],
    allowLocalMutations: true,
    preferredProviderId: provider.manifest.providerId,
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
        reasons: ["agent_os_app_server_workspace_write_prepare_dispatch_test"],
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
  const createResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    request: {
      method: "POST",
      path: "/agent-os/tasks",
      body: {
        title: "App Server workspace-write prepare",
        requestedAction: "Prepare a controlled workspace-write from app-server body.",
        repoRoot: "workspace",
        branch: "agentos/app-server-workspace-write",
        targetFiles: [targetFile]
      }
    }
  });
  const createResult = createResponse.body.result as {
    status: string;
    output: Record<string, unknown>;
  };
  assert.equal(createResponse.statusCode, 200);
  assert.equal(createResult.status, "succeeded");

  const response = await handleAgentOsAppServerRequestAsync({
    ...runtimeInput,
    request: {
      method: "POST",
      path: "/agent-os/workspace-write/dispatch",
      body: {
        prepare: {
          runId,
          workspaceRoot: "/tmp/agent-os-app-server-workspace",
          operations: [{
            kind: "write",
            path: targetFile,
            content: "agent os app-server prepared workspace-write\n"
          }],
          executionAuthorizationId: "operator_auth_agentos_app_server_workspace_write",
          governanceState: createAgentOsWorkspaceWriteGovernanceState({ taskId, now }),
          repositoryState: {
            branch: "agentos/app-server-workspace-write",
            protectedBranch: false,
            worktreeClean: true,
            headCommit: "abc123"
          },
          permitId: "permit_agentos_app_server_workspace_write_prepare",
          maxChangedFiles: 1,
          maxDiffLines: 1
        }
      }
    }
  });
  const result = response.body.result as {
    status: string;
    reasons: string[];
    output: Record<string, unknown>;
    audit: {
      publicSurface: string;
      realProviderExecutionInvoked: boolean;
      localMutationAttempted: boolean;
      localMutationApplied: boolean;
    };
  };
  const preparedDispatch = result.output.preparedDispatch as {
    providerPlanId?: string;
    permitId?: string;
    targetFiles?: string[];
  };

  assert.equal(dispatchInputs.length, 1);
  assert.equal(provider.calls.planExecution, 1);
  assert.equal(provider.calls.execute, 0);
  assert.equal(response.statusCode, 403);
  assert.equal(response.audit.liveHttpServerStarted, false);
  assert.equal(response.audit.networkAccessed, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("agent_os_app_server_workspace_write_prepare_dispatch_test"));
  assert.ok(result.reasons.includes(
    "controlled_workspace_write_dispatch_status:dispatch_blocked"
  ));
  assert.equal(result.audit.publicSurface, "app_server");
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(result.audit.localMutationAttempted, true);
  assert.equal(result.audit.localMutationApplied, false);
  assert.equal(preparedDispatch.providerPlanId, createResult.output.providerPlanId);
  assert.equal(preparedDispatch.permitId, "permit_agentos_app_server_workspace_write_prepare");
  assert.deepEqual(preparedDispatch.targetFiles, [targetFile]);
  assert.equal(
    (result.output.dispatchResult as { providerExecuteInvoked?: boolean }).providerExecuteInvoked,
    false
  );
});

test("Agent OS App Server wrapper blocks mutating requests by default", () => {
  const kernelStore = new InMemoryKernelStore();
  const response = handleAgentOsAppServerRequest({
    ...createRuntimeInput(kernelStore),
    request: {
      method: "POST",
      path: "/agent-os/tasks",
      body: {
        title: "Blocked app task",
        requestedAction: "Try to create a task without gates."
      }
    }
  });
  const result = response.body.result as {
    status: string;
    reasons: string[];
  };

  assert.equal(response.statusCode, 403);
  assert.equal(response.audit.publicSurface, "app_server");
  assert.equal(response.audit.liveHttpServerStarted, false);
  assert.equal(response.audit.networkAccessed, false);
  assert.equal(response.audit.realProviderExecutionInvoked, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_CAPABILITY_MISSING}:task.create`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED}:agentos.create_task`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_LOCAL_MUTATION_DISABLED}:agentos.create_task`));
  assert.deepEqual(kernelStore.listRuns(), []);
});

test("Agent OS App Server wrapper ignores client-supplied gate fields", () => {
  const kernelStore = new InMemoryKernelStore();
  const clientControlledRequest: AgentOsAppServerRequest & {
    grantedCapabilities: string[];
    approvedMutatingTools: ["agentos.create_task"];
    allowLocalMutations: true;
    preferredProviderId: string;
  } = {
    method: "POST",
    path: "/agent-os/tasks",
    body: {
      title: "Spoofed app task",
      requestedAction: "Try to create a task with client-side gates."
    },
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli"
  };

  const response = handleAgentOsAppServerRequest({
    ...createRuntimeInput(kernelStore),
    request: clientControlledRequest
  });
  const result = response.body.result as {
    status: string;
    reasons: string[];
  };

  assert.equal(response.statusCode, 403);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_CAPABILITY_MISSING}:task.create`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED}:agentos.create_task`));
  assert.ok(result.reasons.includes(`${AGENT_OS_MCP_LOCAL_MUTATION_DISABLED}:agentos.create_task`));
  assert.deepEqual(kernelStore.listRuns(), []);
});

test("Agent OS App Server wrapper returns audited bad requests for invalid client input", () => {
  const cases: Array<{
    request: AgentOsAppServerRequest;
    reason: string;
  }> = [
    {
      request: {
        method: "PATCH",
        path: "/agent-os/tasks"
      },
      reason: "agent_os_app_server_invalid_method"
    },
    {
      request: {
        method: "GET",
        path: "/agent-os/runs/%E0%A4%A"
      },
      reason: "agent_os_app_server_invalid_path"
    },
    {
      request: {
        method: "POST",
        path: "/agent-os/tasks",
        body: "not an object"
      },
      reason: "agent_os_app_server_body_must_be_object"
    },
    {
      request: {
        method: "GET",
        path: "/agent-os/runs",
        query: {
          limit: "not-an-integer"
        }
      },
      reason: "agent_os_app_server_query_must_be_integer:limit"
    }
  ];

  for (const item of cases) {
    const kernelStore = new InMemoryKernelStore();
    const response = handleAgentOsAppServerRequest({
      ...createRuntimeInput(kernelStore),
      request: item.request
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      status: "blocked",
      reasons: [item.reason]
    });
    assert.equal(response.audit.liveHttpServerStarted, false);
    assert.equal(response.audit.networkAccessed, false);
    assert.equal(response.audit.realProviderExecutionInvoked, false);
    assert.deepEqual(kernelStore.listRuns(), []);
  }
});

test("Agent OS App Server wrapper converts invalid cursors into audited bad requests", () => {
  const cases: Array<{
    request: AgentOsAppServerRequest;
    capabilities: string[];
    reason: string;
  }> = [
    {
      request: {
        method: "GET",
        path: "/agent-os/runs",
        query: {
          cursor: "bogus"
        }
      },
      capabilities: ["run.read"],
      reason: "agent_os_list_runs_invalid_cursor:bogus"
    },
    {
      request: {
        method: "GET",
        path: "/agent-os/artifacts",
        query: {
          cursor: "bogus"
        }
      },
      capabilities: ["artifact.read"],
      reason: "agent_os_list_artifacts_invalid_cursor:bogus"
    },
    {
      request: {
        method: "GET",
        path: "/agent-os/events",
        query: {
          cursor: "bogus"
        }
      },
      capabilities: ["event.read"],
      reason: "agent_os_search_events_invalid_cursor:bogus"
    }
  ];

  for (const item of cases) {
    const response = handleAgentOsAppServerRequest({
      ...createRuntimeInput(new InMemoryKernelStore()),
      grantedCapabilities: item.capabilities,
      request: item.request
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      status: "blocked",
      reasons: [item.reason]
    });
    assert.equal(response.audit.liveHttpServerStarted, false);
    assert.equal(response.audit.networkAccessed, false);
    assert.equal(response.audit.realProviderExecutionInvoked, false);
  }
});

test("Agent OS App Server wrapper returns not found for missing runs", () => {
  const response = handleAgentOsAppServerRequest({
    ...createRuntimeInput(new InMemoryKernelStore()),
    grantedCapabilities: ["run.read"],
    request: {
      method: "GET",
      path: "/agent-os/runs/run_agentos_app_server_missing"
    }
  });
  const result = response.body.result as {
    status: string;
    reasons: string[];
    output: Record<string, unknown>;
  };

  assert.equal(response.statusCode, 404);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    `${AGENT_OS_MCP_RUN_NOT_FOUND}:run_agentos_app_server_missing`
  ]);
  assert.deepEqual(result.output, {});
});

test("Agent OS App Server wrapper returns not found for missing artifacts", () => {
  const response = handleAgentOsAppServerRequest({
    ...createRuntimeInput(new InMemoryKernelStore()),
    grantedCapabilities: ["artifact.read"],
    request: {
      method: "GET",
      path: "/agent-os/artifacts/artifact_agentos_app_server_missing"
    }
  });
  const result = response.body.result as {
    status: string;
    reasons: string[];
    output: Record<string, unknown>;
  };

  assert.equal(response.statusCode, 404);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    `${AGENT_OS_MCP_ARTIFACT_NOT_FOUND}:artifact_agentos_app_server_missing`
  ]);
  assert.deepEqual(result.output, {});
});

test("Agent OS App Server wrapper returns blocked cancel failures", () => {
  const response = handleAgentOsAppServerRequest({
    ...createRuntimeInput(new InMemoryKernelStore()),
    grantedCapabilities: ["run.cancel"],
    approvedMutatingTools: ["agentos.cancel_run"],
    allowLocalMutations: true,
    request: {
      method: "POST",
      path: "/agent-os/runs/run_agentos_app_server_missing/cancel",
      body: {
        reason: "missing run"
      }
    }
  });
  const result = response.body.result as {
    status: string;
    reasons: string[];
    output: Record<string, unknown>;
  };

  assert.equal(response.statusCode, 404);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.reasons, [
    `${AGENT_OS_MCP_RUN_NOT_FOUND}:run_agentos_app_server_missing`
  ]);
  assert.deepEqual(result.output, {
    status: "blocked"
  });
});

test("Agent OS App Server wrapper creates local run and provider plan without network", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const response = handleAgentOsAppServerRequest({
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    request: {
      method: "POST",
      path: "/agent-os/tasks",
      body: {
        title: "App governed task",
        requestedAction: "Create a task from an App Server request envelope.",
        successCriteria: ["run is queued", "plan is stored"],
        outOfScope: ["real network service", "real provider execution"],
        repoRoot: "A:/AGENTS_OS_Workspace/governance/codex-router/repo",
        branch: "feature/phase-4-provider-execution-runner",
        targetFiles: ["packages/agent-os-app-server/src/index.ts"],
        metadata: {
          source: "phase-8-app-server-test"
        }
      }
    }
  });
  const result = response.body.result as {
    status: string;
    output: Record<string, unknown>;
    audit: { publicSurface: string; realProviderExecutionInvoked: boolean };
  };
  const providerPlanId = String(result.output.providerPlanId);

  assert.equal(response.statusCode, 200);
  assert.equal(response.audit.liveHttpServerStarted, false);
  assert.equal(response.audit.networkAccessed, false);
  assert.equal(result.status, "succeeded");
  assert.equal(result.audit.publicSurface, "app_server");
  assert.equal(result.audit.realProviderExecutionInvoked, false);
  assert.equal(kernelStore.getRun(runId)?.taskId, taskId);
  assert.equal(planStore.getPlan(providerPlanId)?.providerId, "codex-cli");
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    ["kernel.run.created", "kernel.public_surface.app_server.create_task"]
  );

  const getRunResponse = handleAgentOsAppServerRequest({
    ...createRuntimeInput(kernelStore),
    grantedCapabilities: ["run.read"],
    request: {
      method: "GET",
      path: `/agent-os/runs/${runId}`
    }
  });
  const getRunResult = getRunResponse.body.result as {
    status: string;
    output: { run?: { runId?: string } };
  };
  assert.equal(getRunResponse.statusCode, 200);
  assert.equal(getRunResult.output.run?.runId, runId);

  const eventsResponse = handleAgentOsAppServerRequest({
    ...createRuntimeInput(kernelStore),
    grantedCapabilities: ["event.read"],
    request: {
      method: "GET",
      path: "/agent-os/events",
      query: {
        runId,
        eventTypes: ["kernel.public_surface.app_server.create_task"]
      }
    }
  });
  const eventsResult = eventsResponse.body.result as {
    status: string;
    output: { events: Array<{ eventType: string }> };
  };
  assert.equal(eventsResponse.statusCode, 200);
  assert.deepEqual(
    eventsResult.output.events.map((event) => event.eventType),
    ["kernel.public_surface.app_server.create_task"]
  );
});

test("Agent OS App Server wrapper issues an approval permit without network", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtimeInput = {
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_app_server_001"
  };

  const createResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    request: {
      method: "POST",
      path: "/agent-os/tasks",
      body: {
        title: "App governed task",
        requestedAction: "Create a run before App Server approval."
      }
    }
  });
  const createResult = createResponse.body.result as {
    status: string;
  };
  assert.equal(createResponse.statusCode, 200);
  assert.equal(createResult.status, "succeeded");

  const approveResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true,
    request: {
      method: "POST",
      path: `/agent-os/runs/${runId}/approve`,
      body: {
        capabilityScopes: ["fs.read:workspace/docs/report.md"],
        reason: "App Server approval"
      }
    }
  });
  const approveResult = approveResponse.body.result as {
    status: string;
    output: Record<string, unknown>;
    audit: { publicSurface: string; localMutationApplied: boolean };
  };
  const storedPermit = permitStore.getPermit("permit_agentos_app_server_001");

  assert.equal(approveResponse.statusCode, 200);
  assert.equal(approveResponse.audit.liveHttpServerStarted, false);
  assert.equal(approveResponse.audit.networkAccessed, false);
  assert.equal(approveResult.status, "succeeded");
  assert.equal(approveResult.audit.publicSurface, "app_server");
  assert.equal(approveResult.audit.localMutationApplied, true);
  assert.deepEqual(approveResult.output, {
    permitId: "permit_agentos_app_server_001",
    runId,
    expiresAt: "2026-06-10T03:00:00.000Z"
  });
  assert.equal(storedPermit?.runId, runId);
  assert.deepEqual(storedPermit?.capabilityScopes, ["fs.read:workspace/docs/report.md"]);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.app_server.create_task",
      "kernel.approval.permit.issued"
    ]
  );
});

test("Agent OS App Server wrapper consumes approval permits without network", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const approvedMutatingTools: AgentOsMcpToolName[] = [
    "agentos.create_task",
    "agentos.approve_run"
  ];
  const runtimeInput = {
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    executionEligibility: createWaitingEligibility(policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_app_server_consumed",
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools,
    allowLocalMutations: true,
    preferredProviderId: "codex-cli"
  };

  const createResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    request: {
      method: "POST",
      path: "/agent-os/tasks",
      body: {
        title: "App approval consumption task",
        requestedAction: "Create a run that waits for App Server approval consumption."
      }
    }
  });
  const createResult = createResponse.body.result as {
    status: string;
    output: Record<string, unknown>;
  };
  assert.equal(createResponse.statusCode, 200);
  assert.equal(createResult.status, "succeeded");
  assert.equal(createResult.output.providerPlanStatus, "waiting_approval");

  const approveResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    request: {
      method: "POST",
      path: `/agent-os/runs/${runId}/approve`,
      body: {
        capabilityScopes: ["fs.read:workspace/**"],
        reason: "App Server approval consumption"
      }
    }
  });
  const approveResult = approveResponse.body.result as {
    status: string;
    output: Record<string, unknown>;
    audit: { realProviderExecutionInvoked: boolean };
  };
  const plans = planStore.listPlans({ runId });
  const latestPlan = plans.at(-1);

  assert.equal(approveResponse.statusCode, 200);
  assert.equal(approveResponse.audit.liveHttpServerStarted, false);
  assert.equal(approveResponse.audit.networkAccessed, false);
  assert.equal(approveResult.status, "succeeded");
  assert.equal(approveResult.output.consumedProviderPlanId, latestPlan?.planId);
  assert.deepEqual(approveResult.output.approvalConsumptionReasons, [
    "approval_permit_consumed"
  ]);
  assert.equal(plans.length, 2);
  assert.equal(plans[0]?.status, "waiting_approval");
  assert.equal(latestPlan?.status, "planned");
  assert.equal(approveResult.audit.realProviderExecutionInvoked, false);
  assert.deepEqual(
    kernelStore.listEvents({ runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.public_surface.app_server.create_task",
      "kernel.approval.permit.issued",
      "kernel.approval.permit.consumed"
    ]
  );
});

test("Agent OS App Server wrapper preserves rejected permit audit without network", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const approvedMutatingTools: AgentOsMcpToolName[] = [
    "agentos.create_task",
    "agentos.approve_run"
  ];
  const runtimeInput = {
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    executionEligibility: createWaitingEligibility(policyDecision),
    approvalPermitStore: permitStore,
    createPermitId: () => "permit_agentos_app_server_valid_after_rejected",
    grantedCapabilities: ["task.create", "approval.issue"],
    approvedMutatingTools,
    allowLocalMutations: true,
    preferredProviderId: "codex-cli"
  };

  const createResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    request: {
      method: "POST",
      path: "/agent-os/tasks",
      body: {
        title: "App rejected permit audit task",
        requestedAction: "Create a run with rejected App Server approval candidates."
      }
    }
  });
  const createResult = createResponse.body.result as {
    status: string;
    output: Record<string, unknown>;
  };
  assert.equal(createResponse.statusCode, 200);
  assert.equal(createResult.status, "succeeded");
  assert.equal(createResult.output.providerPlanStatus, "waiting_approval");

  const waitingPlan = planStore.listPlans({ runId }).at(-1);
  assert.ok(waitingPlan);
  permitStore.savePermit(createApprovalPermit({
    permitId: "permit_agentos_app_server_expired_candidate",
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

  const approveResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    request: {
      method: "POST",
      path: `/agent-os/runs/${runId}/approve`,
      body: {
        capabilityScopes: ["fs.read:workspace/**"],
        reason: "App Server replacement approval"
      }
    }
  });
  const approveResult = approveResponse.body.result as {
    status: string;
    audit: { realProviderExecutionInvoked: boolean };
  };
  const consumedEvent = kernelStore.listEvents({
    runId,
    type: "kernel.approval.permit.consumed"
  }).at(-1);
  const payload = consumedEvent?.payload as {
    acceptedPermits?: string[];
    rejectedPermits?: string[];
  } | undefined;

  assert.equal(approveResponse.statusCode, 200);
  assert.equal(approveResponse.audit.liveHttpServerStarted, false);
  assert.equal(approveResponse.audit.networkAccessed, false);
  assert.equal(approveResult.status, "succeeded");
  assert.deepEqual(payload?.acceptedPermits, [
    "permit_agentos_app_server_valid_after_rejected"
  ]);
  assert.ok(payload?.rejectedPermits?.some((reason) => (
    reason.includes("permit_agentos_app_server_expired_candidate")
    && reason.includes("permit_expired")
  )));
  assert.equal(approveResult.audit.realProviderExecutionInvoked, false);
  assert.equal(planStore.listPlans({ runId }).at(-1)?.status, "planned");
});

test("Agent OS App Server wrapper default approval permit IDs are unique for repeated approvals", () => {
  const kernelStore = new InMemoryKernelStore();
  const planStore = new InMemoryProviderExecutionPlanStore();
  const permitStore = new InMemoryApprovalPermitStore();
  const providerRegistry = createProviderRegistry();
  const policyDecision = createPolicyDecision();
  const runtimeInput = {
    ...createRuntimeInput(kernelStore, planStore, providerRegistry, policyDecision),
    approvalPermitStore: permitStore
  };

  const createResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    grantedCapabilities: ["task.create"],
    approvedMutatingTools: ["agentos.create_task"],
    allowLocalMutations: true,
    preferredProviderId: "codex-cli",
    request: {
      method: "POST",
      path: "/agent-os/tasks",
      body: {
        title: "App repeated approval task",
        requestedAction: "Create a run before repeated App Server approval."
      }
    }
  });
  const createResult = createResponse.body.result as {
    status: string;
  };
  assert.equal(createResponse.statusCode, 200);
  assert.equal(createResult.status, "succeeded");

  const firstResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true,
    request: {
      method: "POST",
      path: `/agent-os/runs/${runId}/approve`,
      body: {
        capabilityScopes: ["fs.read:workspace/docs/report.md"],
        reason: "App Server approval"
      }
    }
  });
  const secondResponse = handleAgentOsAppServerRequest({
    ...runtimeInput,
    grantedCapabilities: ["approval.issue"],
    approvedMutatingTools: ["agentos.approve_run"],
    allowLocalMutations: true,
    request: {
      method: "POST",
      path: `/agent-os/runs/${runId}/approve`,
      body: {
        capabilityScopes: ["fs.read:workspace/docs/report.md"],
        reason: "App Server approval"
      }
    }
  });
  const firstResult = firstResponse.body.result as {
    status: string;
    output: Record<string, unknown>;
  };
  const secondResult = secondResponse.body.result as {
    status: string;
    output: Record<string, unknown>;
  };
  const firstPermitId = String(firstResult.output.permitId);
  const secondPermitId = String(secondResult.output.permitId);

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(firstResult.status, "succeeded");
  assert.equal(secondResult.status, "succeeded");
  assert.match(firstPermitId, /^permit_agentos_mcp_run_agentos_app_server_001_/);
  assert.match(secondPermitId, /^permit_agentos_mcp_run_agentos_app_server_001_/);
  assert.notEqual(firstPermitId, secondPermitId);
  assert.equal(permitStore.listPermits({ runId }).length, 2);
});

test("Agent OS App Server wrapper reports unknown local routes without starting a server", () => {
  const response = handleAgentOsAppServerRequest({
    ...createRuntimeInput(new InMemoryKernelStore()),
    request: {
      method: "GET",
      path: "/agent-os/unknown"
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.audit.liveHttpServerStarted, false);
  assert.equal(response.audit.networkAccessed, false);
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
    decisionId: "decision_agentos_app_server_001",
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
        sandboxId: "sandbox_agentos_app_server_readonly",
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
