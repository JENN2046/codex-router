import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAgentOsCliArgv,
  runAgentOsCliCommand,
  sanitizeAgentOsCliArgv
} from "../packages/agent-os-cli/src/index.js";
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

test("Agent OS CLI sanitizer redacts secret-like option values", () => {
  assert.deepEqual(
    sanitizeAgentOsCliArgv([
      "create-task",
      "--title",
      "safe",
      "--metadata-json",
      "{\"apiKey\":\"secret\"}",
      "--token",
      "raw-token"
    ]),
    [
      "create-task",
      "--title",
      "safe",
      "--metadata-json",
      "<REDACTED>",
      "--token",
      "<REDACTED>"
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
