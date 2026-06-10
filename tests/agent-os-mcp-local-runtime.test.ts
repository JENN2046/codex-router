import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_OS_MCP_ARTIFACT_NOT_FOUND,
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
  hashApprovalScope
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

  const storedRun = kernelStore.getRun(runId);
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
