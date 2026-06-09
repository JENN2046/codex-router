import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTaskAdmission } from "../packages/admission-control/src/index.js";
import { InMemoryArtifactStore } from "../packages/artifact-store/src/index.js";
import {
  evaluateExecutionEligibility
} from "../packages/execution-eligibility/src/index.js";
import {
  ProviderExecutionPlanSchema,
  planProviderExecution
} from "../packages/execution-planner/src/index.js";
import { InMemoryKernelStore } from "../packages/kernel-store/src/index.js";
import {
  AgentManifestSchema,
  CapabilityGrantSchema,
  CapabilityScopeSchema,
  EventSchema,
  PolicyDecisionSchema,
  PrincipalSchema,
  RunSchema,
  TaskSchema,
  type AgentManifest,
  type ApprovalPermit,
  type CapabilityGrant,
  type CapabilityScope,
  type PolicyDecision,
  type Principal,
  type Run,
  type Task
} from "../packages/kernel-contracts/src/index.js";
import { ProviderRegistry } from "../packages/provider-registry/src/index.js";
import {
  CODEX_CLI_PROVIDER_ID,
  CodexCliExecutorProvider
} from "../packages/providers/codex-cli/src/index.js";
import { RunManager } from "../packages/run-manager/src/index.js";
import { validAgentManifest } from "../packages/kernel-contracts/test-fixtures/valid-agent-manifest.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

const READ_SCOPE = "fs.read:workspace/**";

const timestamps = [
  "2026-06-04T03:00:00.000Z",
  "2026-06-04T03:00:01.000Z",
  "2026-06-04T03:00:02.000Z",
  "2026-06-04T03:00:03.000Z",
  "2026-06-04T03:00:04.000Z",
  "2026-06-04T03:00:05.000Z"
];

test("Agent OS Kernel Phase 3 plans Codex CLI as a provider without execution", async () => {
  const clock = createFakeClock(timestamps);
  const principal = createPrincipal();
  const agentManifest = createAgentManifest(principal);
  const task = createTask(principal);
  const policyDecision = createPolicyDecision(task);
  const runSeed = createRunSeed(task, policyDecision);
  const capabilityGrant = createCapabilityGrant(principal, task, runSeed);
  const approvalPermits: ApprovalPermit[] = [];
  const planHash = "plan_hash_agent_kernel_phase_3_provider_e2e_001";

  const admission = evaluateTaskAdmission({
    task,
    principal,
    agent: agentManifest,
    policyDecision,
    now: clock.peek()
  });

  assert.equal(admission.status, "accepted", `admission failed: ${admission.reasons.join(",")}`);
  assert.deepEqual(admission.requiredApprovals, []);

  const eligibility = evaluateExecutionEligibility({
    task,
    run: runSeed,
    principal,
    policyDecision,
    capabilityGrants: [toEligibilityGrant(capabilityGrant)],
    approvalPermits,
    requestedScopes: [READ_SCOPE],
    planHash,
    now: clock.peek()
  });

  assert.equal(
    eligibility.status,
    "eligible",
    `execution eligibility failed: ${eligibility.reasons.join(",")}`
  );
  assert.deepEqual(eligibility.acceptedPermits, []);
  assert.deepEqual(eligibility.requiredApprovals, []);

  const store = new InMemoryKernelStore();
  const runManager = new RunManager({
    store,
    now: clock.next
  });
  const artifactStore = new InMemoryArtifactStore({
    now: clock.next
  });

  const createdRun = runManager.createRunFromTask(task, principal, {
    runId: runSeed.runId,
    policyDecisionId: policyDecision.decisionId
  });
  assert.equal(createdRun.status, "queued");
  assert.equal(createdRun.runId, "run_agent_kernel_phase_3_provider_001");

  const providerRegistry = new ProviderRegistry();
  const codexProvider = new CodexCliExecutorProvider();
  let providerPlanExecutionCalls = 0;
  let providerExecuteCalls = 0;
  const originalPlanExecution = codexProvider.planExecution.bind(codexProvider);
  const originalExecute = codexProvider.execute.bind(codexProvider);

  codexProvider.planExecution = (input) => {
    providerPlanExecutionCalls += 1;
    return originalPlanExecution(input);
  };
  codexProvider.execute = (plan, context) => {
    providerExecuteCalls += 1;
    return originalExecute(plan, context);
  };

  providerRegistry.registerProvider(codexProvider.manifest, codexProvider);
  assert.equal(providerRegistry.getProvider(CODEX_CLI_PROVIDER_ID)?.manifest.providerId, "codex-cli");
  assert.equal(codexProvider.manifest.metadata.executionDefault, "disabled");

  const providerPlan = planProviderExecution({
    task,
    run: createdRun,
    principal,
    policyDecision,
    executionEligibility: eligibility,
    providerRegistry,
    preferredProviderId: CODEX_CLI_PROVIDER_ID,
    now: clock.peek()
  });

  assert.equal(ProviderExecutionPlanSchema.parse(providerPlan).planId, providerPlan.planId);
  assert.equal(providerPlan.status, "planned");
  assert.equal(providerPlan.providerId, "codex-cli");
  assert.equal(providerPlan.providerKind, "executor");
  assert.equal(providerPlan.sideEffectClass, "read_only");
  assert.equal(providerPlan.sandboxProfile.networkAccess, "none");
  assert.deepEqual(providerPlan.sandboxProfile.writableRoots, []);
  assert.equal(providerPlan.reasons.includes("provider_planned"), true);

  // Codex CLI is a provider boundary here; the kernel planner does not invoke provider runtime hooks.
  assert.equal(providerPlanExecutionCalls, 0);
  assert.equal(providerExecuteCalls, 0);

  const providerEvent = store.appendEvent(EventSchema.parse({
    schemaVersion: "kernel-event.v1",
    eventId: "event_agent_kernel_phase_3_provider_planned_001",
    eventType: "kernel.provider.execution.planned",
    taskId: task.taskId,
    runId: createdRun.runId,
    principalId: principal.principalId,
    createdAt: clock.next(),
    payload: {
      planId: providerPlan.planId,
      providerId: providerPlan.providerId,
      providerKind: providerPlan.providerKind,
      status: providerPlan.status,
      codexRole: "provider_not_kernel_center",
      externalSideEffects: "none",
      executeInvoked: false
    }
  }));
  assert.equal(providerEvent.eventType, "kernel.provider.execution.planned");

  const reportArtifact = await artifactStore.putArtifact({
    artifactId: "artifact_agent_kernel_phase_3_provider_report_001",
    taskId: task.taskId,
    runId: createdRun.runId,
    type: "report",
    payload: {
      phase: "3",
      assertion: "Codex CLI is registered as an executor provider; Agent OS Kernel remains provider-agnostic.",
      providerExecutionPlan: {
        planId: providerPlan.planId,
        providerId: providerPlan.providerId,
        providerKind: providerPlan.providerKind,
        status: providerPlan.status,
        sideEffectClass: providerPlan.sideEffectClass
      },
      defaults: {
        providerExecutionDefault: codexProvider.manifest.metadata.executionDefault,
        networkAccess: providerPlan.sandboxProfile.networkAccess,
        executeInvoked: providerExecuteCalls > 0,
        shellInvoked: false
      },
      eventId: providerEvent.eventId
    },
    alreadyRedacted: true,
    provenance: {
      principalId: principal.principalId,
      agentId: agentManifest.agentId,
      providerId: providerPlan.providerId,
      source: "agent-kernel-phase-3-provider-e2e"
    }
  });

  assert.equal(reportArtifact.artifactId, "artifact_agent_kernel_phase_3_provider_report_001");
  assert.equal(reportArtifact.type, "report");
  assert.match(reportArtifact.sha256, /^[a-f0-9]{64}$/);
  assert.equal(providerExecuteCalls, 0);

  const artifactVerification = await artifactStore.verifyArtifact(reportArtifact.artifactId);
  assert.equal(
    artifactVerification.ok,
    true,
    `artifact verification failed: ${artifactVerification.reason ?? "unknown"}`
  );

  const events = store.listEvents({ runId: createdRun.runId });
  assert.deepEqual(
    events.map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.provider.execution.planned"
    ]
  );
});

function createPrincipal(): Principal {
  return PrincipalSchema.parse({
    ...validPrincipal,
    principalId: "principal_agent_kernel_phase_3_provider_001",
    kind: "agent",
    displayName: "Phase 3 Provider Planning Agent",
    createdAt: "2026-06-04T03:00:00.000Z"
  });
}

function createAgentManifest(principal: Principal): AgentManifest {
  return AgentManifestSchema.parse({
    ...validAgentManifest,
    agentId: "agent_manifest_phase_3_provider_001",
    name: "Phase 3 Provider Planning Agent",
    principal,
    capabilities: [createReadCapabilityScope()],
    defaultSandbox: createReadOnlySandbox(),
    createdAt: "2026-06-04T03:00:00.000Z"
  });
}

function createTask(principal: Principal): Task {
  return TaskSchema.parse({
    ...validTask,
    taskId: "task_agent_kernel_phase_3_provider_001",
    title: "Plan governed provider execution",
    requestedAction: "Create a provider execution plan for a read-only Agent OS task without invoking provider runtime.",
    intent: {
      summary: "Exercise Phase 3 provider abstraction from task admission through provider planning.",
      requestedAction: "Create a provider execution plan for a read-only Agent OS task without invoking provider runtime.",
      successCriteria: [
        "ProviderExecutionPlan is planned",
        "codex-cli is selected as provider",
        "provider execute is not invoked"
      ],
      outOfScope: [
        "real Codex CLI execution",
        "shell execution",
        "network access"
      ]
    },
    createdBy: principal,
    repo: {
      root: "workspace",
      branch: "codex/agent-os-kernel-phase-0-1",
      worktreeClean: true,
      protectedBranch: false
    },
    target: {
      branches: [],
      files: ["workspace/README.md"],
      modules: ["agent-os-kernel", "provider-registry", "execution-planner"]
    },
    hints: {
      taskClass: "read_only",
      riskHints: [],
      tags: ["phase-3-provider-e2e"]
    },
    constraints: {
      providerRuntimeInvocation: "disabled",
      sideEffects: "none"
    },
    createdAt: "2026-06-04T03:00:00.000Z"
  });
}

function createPolicyDecision(task: Task): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "policy_agent_kernel_phase_3_provider_001",
    taskId: task.taskId,
    policyVersion: "agent-kernel-phase-3-provider-e2e",
    classification: {
      taskClass: "read_only",
      riskLevel: "low",
      ambiguityScore: 0,
      clarificationRequired: false,
      riskFactors: []
    },
    risk: {
      level: "low",
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      executor: "provider-registry",
      model: "gpt-5.4-mini",
      profile: "recon-only",
      reasoningEffort: "low",
      sandbox: createReadOnlySandbox()
    },
    capabilities: [createReadCapabilityScope()],
    approval: {
      required: false,
      reasons: []
    },
    parallelism: {
      allowed: false,
      maxAgents: 1,
      mode: "disabled"
    },
    legacy: {
      taskClass: "read_only",
      toolAccess: "read_only"
    },
    createdAt: "2026-06-04T03:00:00.000Z"
  });
}

function createRunSeed(task: Task, policyDecision: PolicyDecision): Run {
  return RunSchema.parse({
    ...validRun,
    runId: "run_agent_kernel_phase_3_provider_001",
    taskId: task.taskId,
    status: "queued",
    policyDecisionId: policyDecision.decisionId,
    createdAt: "2026-06-04T03:00:00.000Z",
    updatedAt: "2026-06-04T03:00:00.000Z"
  });
}

function createCapabilityGrant(
  principal: Principal,
  task: Task,
  run: Run
): CapabilityGrant {
  return CapabilityGrantSchema.parse({
    schemaVersion: "capability-grant.v1",
    grantId: "grant_agent_kernel_phase_3_provider_001",
    principalId: principal.principalId,
    taskId: task.taskId,
    runId: run.runId,
    scopes: [createReadCapabilityScope()],
    issuedAt: "2026-06-04T03:00:00.000Z",
    expiresAt: "2026-06-04T04:00:00.000Z",
    reason: "agent_kernel_phase_3_provider_e2e_fixture"
  });
}

function toEligibilityGrant(grant: CapabilityGrant): {
  scopes: string[];
  principalId: string;
  taskId: string;
  runId: string;
  expiresAt: string;
} {
  return {
    scopes: [READ_SCOPE],
    principalId: grant.principalId,
    taskId: grant.taskId!,
    runId: grant.runId!,
    expiresAt: grant.expiresAt!
  };
}

function createReadCapabilityScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    schemaVersion: "capability-scope.v1",
    kind: "file",
    resource: "workspace/**",
    access: "read",
    constraints: {
      capabilityScope: READ_SCOPE
    }
  });
}

function createReadOnlySandbox() {
  return {
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_agent_kernel_phase_3_provider_readonly",
    mode: "read-only",
    networkAccess: "none",
    writableRoots: [],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  };
}

function createFakeClock(values: string[]): {
  next: () => string;
  peek: () => string;
} {
  let index = 0;

  return {
    next: () => {
      const value = values[index] ?? values[values.length - 1];
      index += 1;
      return value!;
    },
    peek: () => values[index] ?? values[values.length - 1]!
  };
}
