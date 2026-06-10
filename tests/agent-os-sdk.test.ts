import test from "node:test";
import assert from "node:assert/strict";
import {
  createAgentOsSdk
} from "../packages/agent-os-sdk/src/index.js";
import {
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
  hashApprovalScope
} from "../packages/approval-permit/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";

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
