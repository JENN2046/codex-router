import test from "node:test";
import assert from "node:assert/strict";
import { hashApprovalScope } from "../packages/approval-permit/src/index.js";
import { InMemoryArtifactStore } from "../packages/artifact-store/src/index.js";
import {
  planProviderExecution,
  ProviderExecutionPlanSchema,
  type PlanProviderExecutionInput
} from "../packages/execution-planner/src/index.js";
import { InMemoryKernelStore } from "../packages/kernel-store/src/index.js";
import {
  CapabilityScopeSchema,
  PolicyDecisionSchema,
  RunSchema,
  SandboxProfileSchema,
  TaskSchema,
  type CapabilityScope,
  type PolicyDecision,
  type Run,
  type SandboxProfile,
  type Task
} from "../packages/kernel-contracts/src/index.js";
import {
  parseExecutorExecutionPlan,
  parseProviderManifest,
  type ExecutionPlanInput,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderExecutionContext,
  type ProviderExecutionResult,
  type ProviderManifest
} from "../packages/provider-core/src/index.js";
import { runProviderExecutionPlanDryRun } from "../packages/provider-execution-runner/src/index.js";
import { ProviderRegistry } from "../packages/provider-registry/src/index.js";
import { CodexCliExecutorProvider } from "../packages/providers/codex-cli/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

const now = "2026-06-10T01:00:00.000Z";

test("provider execution runner dry-runs executor plans and records audit evidence", async () => {
  const provider = createFakeExecutorProvider();
  const registry = createRegistry(provider);
  const task = createTask();
  const policyDecision = createPolicyDecision({ taskId: task.taskId });
  const run = createRun(task, policyDecision, "running");
  const providerExecutionPlan = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));
  const kernelStore = new InMemoryKernelStore();
  const artifactStore = new InMemoryArtifactStore({ now: createClock() });

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan,
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: registry,
    kernelStore,
    artifactStore,
    now: createClock()
  });

  assert.equal(result.status, "dry_run_succeeded");
  assert.equal(result.dryRun, true);
  assert.equal(result.executeInvoked, false);
  assert.equal(provider.calls.planExecution, 1);
  assert.equal(provider.calls.validateExecutionPlan, 1);
  assert.equal(provider.calls.execute, 0);
  assert.ok(result.validation?.valid);
  assert.equal(result.executorPlan?.providerId, provider.manifest.providerId);
  assert.deepEqual(
    kernelStore.listEvents({ runId: run.runId }).map((event) => event.eventType),
    [
      "kernel.provider.execution.dry_run.started",
      "kernel.provider.execution.dry_run.succeeded"
    ]
  );
  assert.equal((await artifactStore.listArtifacts({ runId: run.runId })).length, 1);
  assert.equal(kernelStore.listArtifacts({ runId: run.runId }).length, 1);
  assert.equal(result.artifactIds.length, 1);
  assert.equal(result.eventIds.length, 2);
});

test("provider execution runner blocks non-planned provider plans before provider hooks", async () => {
  const provider = createFakeExecutorProvider();
  const registry = createRegistry(provider);
  const task = createTask();
  const policyDecision = createPolicyDecision({ taskId: task.taskId });
  const run = createRun(task, policyDecision, "running");
  const planned = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));
  const waitingPlan = ProviderExecutionPlanSchema.parse({
    ...planned,
    status: "waiting_approval",
    reasons: ["eligibility_waiting_approval"]
  });

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan: waitingPlan,
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("provider_plan_not_planned:waiting_approval"));
  assert.equal(provider.calls.planExecution, 0);
  assert.equal(provider.calls.validateExecutionPlan, 0);
  assert.equal(provider.calls.execute, 0);
});

test("provider execution runner requires the parent run to be running", async () => {
  const provider = createFakeExecutorProvider();
  const registry = createRegistry(provider);
  const task = createTask();
  const policyDecision = createPolicyDecision({ taskId: task.taskId });
  const queuedRun = createRun(task, policyDecision, "queued");
  const providerExecutionPlan = planProviderExecution(createPlannerInput({
    task,
    run: queuedRun,
    policyDecision,
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan,
    task,
    run: queuedRun,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("run_not_running:queued"));
  assert.equal(provider.calls.planExecution, 0);
  assert.equal(provider.calls.execute, 0);
});

test("provider execution runner rejects real execution modes before provider hooks", async () => {
  const provider = createFakeExecutorProvider();
  const registry = createRegistry(provider);
  const task = createTask();
  const policyDecision = createPolicyDecision({ taskId: task.taskId });
  const run = createRun(task, policyDecision, "running");
  const providerExecutionPlan = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan,
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock(),
    mode: "execute" as never
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("real_execution_mode_not_supported:execute"));
  assert.equal(result.executeInvoked, false);
  assert.equal(provider.calls.planExecution, 0);
  assert.equal(provider.calls.validateExecutionPlan, 0);
  assert.equal(provider.calls.execute, 0);
});

test("provider execution runner reports validation failures without execution", async () => {
  const provider = createFakeExecutorProvider({
    validation: {
      valid: false,
      reasons: ["fake_executor_validation_rejected"]
    }
  });
  const registry = createRegistry(provider);
  const task = createTask();
  const policyDecision = createPolicyDecision({ taskId: task.taskId });
  const run = createRun(task, policyDecision, "running");
  const providerExecutionPlan = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan,
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "validation_failed");
  assert.ok(result.reasons.includes("fake_executor_validation_rejected"));
  assert.equal(provider.calls.planExecution, 1);
  assert.equal(provider.calls.validateExecutionPlan, 1);
  assert.equal(provider.calls.execute, 0);
});

test("provider execution runner enforces executor plan invariants before provider validation", async () => {
  const provider = createFakeExecutorProvider({
    executorPlanOverrides: {
      taskId: "task_provider_execution_runner_other",
      runId: "run_provider_execution_runner_other",
      providerId: "other-executor",
      policyDecisionHash: "0".repeat(64),
      sandboxProfile: createWorkspaceWriteSandboxProfile(),
      sideEffectClass: "workspace_write"
    }
  });
  const registry = createRegistry(provider);
  const task = createTask();
  const policyDecision = createPolicyDecision({ taskId: task.taskId });
  const run = createRun(task, policyDecision, "running");
  const providerExecutionPlan = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan,
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "validation_failed");
  assert.ok(result.reasons.includes("executor_plan_invariant_mismatch"));
  assert.ok(result.reasons.includes(
    "executor_plan_task_mismatch:task_provider_execution_runner_other:task_provider_execution_runner_001"
  ));
  assert.ok(result.reasons.includes(
    "executor_plan_run_mismatch:run_provider_execution_runner_other:run_provider_execution_runner_001"
  ));
  assert.ok(result.reasons.includes("executor_plan_provider_mismatch:other-executor:fake-executor"));
  assert.ok(result.reasons.includes("executor_plan_policy_decision_hash_mismatch"));
  assert.ok(result.reasons.includes("executor_plan_sandbox_profile_mismatch"));
  assert.ok(result.reasons.includes("executor_plan_side_effect_class_mismatch:workspace_write:read_only"));
  assert.equal(provider.calls.planExecution, 1);
  assert.equal(provider.calls.validateExecutionPlan, 0);
  assert.equal(provider.calls.execute, 0);
  assert.deepEqual(result.validation?.reasons, result.reasons.slice(1));
});

test("provider execution runner validates codex-cli dry-runs without invoking execute", async () => {
  const codexProvider = new CodexCliExecutorProvider();
  let executeCalls = 0;
  const originalExecute = codexProvider.execute.bind(codexProvider);

  codexProvider.execute = (plan, context) => {
    executeCalls += 1;
    return originalExecute(plan, context);
  };

  const registry = createRegistry(codexProvider);
  const task = createTask();
  const policyDecision = createPolicyDecision({ taskId: task.taskId });
  const run = createRun(task, policyDecision, "running");
  const providerExecutionPlan = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    providerRegistry: registry,
    preferredProviderId: codexProvider.manifest.providerId
  }));

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan,
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dry_run_succeeded");
  assert.equal(result.providerId, "codex-cli");
  assert.equal(result.executeInvoked, false);
  assert.equal(executeCalls, 0);
  assert.ok(result.executorPlan);
  assert.equal(result.executorPlan.metadata.codexCliProvider !== undefined, true);
});

function createPlannerInput(
  overrides: Partial<PlanProviderExecutionInput> = {}
): PlanProviderExecutionInput {
  const task = overrides.task ?? createTask();
  const policyDecision = overrides.policyDecision ?? createPolicyDecision({
    taskId: task.taskId
  });
  const run = overrides.run ?? createRun(task, policyDecision, "running");

  return {
    task,
    run,
    principal: overrides.principal ?? validPrincipal,
    policyDecision,
    executionEligibility: overrides.executionEligibility ?? {
      status: "eligible",
      taskId: task.taskId,
      runId: run.runId,
      policyDecisionHash: hashApprovalScope(policyDecision),
      reasons: ["capability_grants_satisfied"],
      missingCapabilities: [],
      requiredApprovals: [],
      acceptedPermits: [],
      rejectedPermits: [],
      createdAt: now
    },
    providerRegistry: overrides.providerRegistry ?? createRegistry(createFakeExecutorProvider()),
    ...(overrides.preferredProviderId !== undefined
      ? { preferredProviderId: overrides.preferredProviderId }
      : {}),
    now: overrides.now ?? now
  };
}

function createTask(): Task {
  return TaskSchema.parse({
    ...validTask,
    taskId: "task_provider_execution_runner_001",
    requestedAction: "Dry-run a provider execution plan without invoking provider runtime.",
    repo: {
      root: "workspace",
      branch: "feature/provider-execution-runner",
      worktreeClean: true,
      protectedBranch: false
    },
    hints: {
      taskClass: "read_only",
      riskHints: [],
      tags: ["provider-execution-runner"]
    }
  });
}

function createRun(
  task: Task,
  policyDecision: PolicyDecision,
  status: Run["status"]
): Run {
  return RunSchema.parse({
    ...validRun,
    runId: "run_provider_execution_runner_001",
    taskId: task.taskId,
    policyDecisionId: policyDecision.decisionId,
    status,
    createdAt: now,
    updatedAt: now
  });
}

function createPolicyDecision(overrides: Partial<{
  taskId: string;
  sandboxProfile: SandboxProfile;
  capabilities: CapabilityScope[];
}> = {}): PolicyDecision {
  const sandboxProfile = overrides.sandboxProfile ?? createSandboxProfile();
  const taskId = overrides.taskId ?? "task_provider_execution_runner_001";

  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "decision_provider_execution_runner_001",
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
      profile: "recon-only",
      reasoningEffort: "low",
      sandbox: sandboxProfile
    },
    capabilities: overrides.capabilities ?? [createReadScope()],
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
    }
  });
}

function createSandboxProfile(): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_provider_execution_runner_read_only",
    mode: "read-only",
    networkAccess: "none",
    writableRoots: [],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function createWorkspaceWriteSandboxProfile(): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_provider_execution_runner_workspace_write",
    mode: "workspace-write",
    networkAccess: "none",
    writableRoots: ["workspace"],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function createReadScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "file",
    resource: "workspace/**",
    access: "read"
  });
}

type FakeExecutorProvider = ExecutorProvider & {
  calls: {
    planExecution: number;
    validateExecutionPlan: number;
    execute: number;
  };
};

function createFakeExecutorProvider(options: {
  validation?: ExecutionValidationResult;
  executorPlanOverrides?: Partial<ExecutorExecutionPlan>;
} = {}): FakeExecutorProvider {
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const manifest = createFakeExecutorManifest();

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
        providerId: manifest.providerId,
        inputHash: "1".repeat(64),
        policyDecisionHash: hashApprovalScope(input.policyDecision),
        requiredCapabilities: ["fs.read:workspace/**"],
        approvalRequired: false,
        sandboxProfile: input.sandboxProfile,
        sideEffectClass: "read_only",
        createdAt: input.now,
        metadata: {
          fakeExecutor: true
        },
        ...(options.executorPlanOverrides ?? {})
      });
    },
    validateExecutionPlan(_plan: ExecutorExecutionPlan): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return options.validation ?? {
        valid: true,
        reasons: []
      };
    },
    execute(
      _plan: ExecutorExecutionPlan,
      _context: ProviderExecutionContext
    ): ProviderExecutionResult {
      calls.execute += 1;
      throw new Error("fake_executor_execute_should_not_be_called");
    }
  };
}

function createFakeExecutorManifest(): ProviderManifest {
  return parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: "fake-executor",
    kind: "executor",
    displayName: "Fake Executor",
    version: "0.1.0",
    capabilities: ["execution.plan", "execution.validate"],
    requiredConfig: {
      keys: [],
      optionalKeys: []
    },
    securityBoundary: {
      isolation: "process",
      networkAccess: "none",
      filesystemAccess: "read",
      secretAccess: "none",
      notes: ["test fixture"]
    },
    supportedSandboxProfiles: [createSandboxProfile()],
    supportedSideEffectClasses: ["read_only"],
    enabled: true,
    metadata: {}
  });
}

function createRegistry(provider: ExecutorProvider): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.registerProvider(provider.manifest, provider);
  return registry;
}

function createClock(): () => string {
  let index = 0;
  return () => {
    const timestamp = `2026-06-10T01:00:0${index}.000Z`;
    index += 1;
    return timestamp;
  };
}
