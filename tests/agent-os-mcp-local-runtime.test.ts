import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_OS_MCP_LOCAL_MUTATION_DISABLED,
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
  CapabilityScopeSchema,
  PolicyDecisionSchema,
  SandboxProfileSchema,
  type PolicyDecision
} from "../packages/kernel-contracts/src/index.js";
import {
  hashApprovalScope
} from "../packages/approval-permit/src/index.js";
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
