import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryArtifactStore } from "../packages/artifact-store/src/index.js";
import { hashApprovalScope } from "../packages/governance-internal-approval-permit/src/index.js";
import {
  createControlledReadOnlyProviderDispatchPreflight,
  dispatchControlledReadOnlyProviderExecution,
  reviewControlledReadOnlyProviderDispatch
} from "../packages/governance-internal-controlled-provider-dispatcher/src/index.js";
import type { GovernanceState } from "../packages/governance-internal-state-manager/src/index.js";
import { InMemoryKernelStore } from "../packages/kernel-store/src/index.js";
import {
  CapabilityScopeSchema,
  PolicyDecisionSchema,
  PrincipalSchema,
  RunSchema,
  SandboxProfileSchema,
  TaskSchema,
  type CapabilityScope,
  type PolicyDecision,
  type Principal,
  type Run,
  type SandboxProfile,
  type Task
} from "../packages/kernel-contracts/src/index.js";
import {
  hashProviderExecutionPlannerObject,
  planProviderExecution,
  ProviderExecutionPlanSchema,
  type PlanProviderExecutionInput
} from "../packages/execution-planner/src/index.js";
import {
  createApprovedProviderExecutionPermit,
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
import { ProviderRegistry } from "../packages/provider-registry/src/index.js";
import { parseTaskEnvelope, type TaskEnvelope } from "../packages/contracts/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

const now = "2026-07-09T01:00:00.000Z";

test("controlled provider dispatcher gates the runner with exact dispatch preflight", async () => {
  const fixture = createFixture();
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "runner_completed");
  assert.equal(result.runnerInvoked, true);
  assert.equal(result.executeInvoked, true);
  assert.equal(result.runnerResult.status, "controlled_readonly_succeeded");
  assert.equal(fixture.provider.calls.planExecution, 1);
  assert.equal(fixture.provider.calls.validateExecutionPlan, 1);
  assert.equal(fixture.provider.calls.execute, 1);
  assert.equal(
    result.runnerResult.executionEvidence?.bindings.providerRegistrySelection.selected,
    true
  );
  assert.equal(
    result.runnerResult.executionEvidence?.bindings.environmentPreflight.artifactHash,
    fixture.dispatchPreflight.environmentPreflight.artifactHash
  );
});

test("controlled provider dispatcher blocks preflight artifact drift before runner", () => {
  const fixture = createFixture();
  const review = reviewControlledReadOnlyProviderDispatch({
    ...fixture,
    dispatchPreflight: {
      ...fixture.dispatchPreflight,
      environmentPreflight: {
        ...fixture.dispatchPreflight.environmentPreflight,
        artifactHash: "0".repeat(64)
      }
    },
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(review.status, "dispatch_blocked");
  assert.equal(review.runnerInvoked, false);
  assert.equal(review.executeInvoked, false);
  assert.ok(
    review.reasons.includes(
      "controlled_readonly_dispatch_environment_preflight_artifact_hash_mismatch"
    )
  );
  assert.equal(fixture.provider.calls.planExecution, 1);
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks permit drift before runner", () => {
  const fixture = createFixture();
  const review = reviewControlledReadOnlyProviderDispatch({
    ...fixture,
    permit: {
      ...fixture.permit,
      providerExecutionPlanHash: "0".repeat(64)
    },
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(review.status, "dispatch_blocked");
  assert.equal(review.runnerInvoked, false);
  assert.equal(review.executeInvoked, false);
  assert.ok(
    review.reasons.includes(
      "controlled_readonly_dispatch_permit_provider_plan_hash_mismatch"
    )
  );
  assert.equal(fixture.provider.calls.planExecution, 1);
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks stale task content before runner", async () => {
  const fixture = createFixture();
  const replacedTask = TaskSchema.parse({
    ...fixture.task,
    requestedAction: "Inspect a different repository state with the same task id."
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    task: replacedTask,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes("controlled_readonly_dispatch_task_hash_mismatch")
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks governance recovery before runner", () => {
  const fixture = createFixture();
  const review = reviewControlledReadOnlyProviderDispatch({
    ...fixture,
    governanceState: {
      ...fixture.governanceState,
      phase: "recovery"
    },
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(review.status, "dispatch_blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_readonly_dispatch_governance_phase_blocked:recovery"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks broad provider plans before runner", () => {
  const fixture = createFixture();
  const review = reviewControlledReadOnlyProviderDispatch({
    ...fixture,
    providerExecutionPlan: ProviderExecutionPlanSchema.parse({
      ...fixture.providerExecutionPlan,
      sideEffectClass: "workspace_write"
    }),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(review.status, "dispatch_blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_readonly_dispatch_requires_read_only_side_effect:workspace_write"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

type Fixture = {
  provider: FakeExecutorProvider;
  providerRegistry: ProviderRegistry;
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision;
  providerExecutionPlan: ReturnType<typeof planProviderExecution>;
  executorPlan: ExecutorExecutionPlan;
  permit: ReturnType<typeof createApprovedProviderExecutionPermit>;
  dispatchPreflight: ReturnType<typeof createControlledReadOnlyProviderDispatchPreflight>;
  governanceState: GovernanceState;
  taskEnvelope: TaskEnvelope;
};

function createFixture(): Fixture {
  const provider = createFakeCodexCliProvider();
  const providerRegistry = createRegistry(provider);
  const task = createTask();
  const principal = PrincipalSchema.parse(validPrincipal);
  const policyDecision = createPolicyDecision(task);
  const run = createRun(task, policyDecision);
  const providerExecutionPlan = planProviderExecution(createPlannerInput({
    task,
    run,
    principal,
    policyDecision,
    providerRegistry,
    preferredProviderId: provider.manifest.providerId
  }));
  const executorPlan = parseExecutorExecutionPlan(provider.planExecution({
    task,
    run,
    policyDecision,
    sandboxProfile: providerExecutionPlan.sandboxProfile,
    inputHash: providerExecutionPlan.inputHash,
    ...(providerExecutionPlan.taskHash !== undefined
      ? { taskHash: providerExecutionPlan.taskHash }
      : {}),
    ...(providerExecutionPlan.principalId !== undefined
      ? { principalId: providerExecutionPlan.principalId }
      : {}),
    ...(providerExecutionPlan.principalHash !== undefined
      ? { principalHash: providerExecutionPlan.principalHash }
      : {}),
    providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan),
    ...(providerExecutionPlan.providerManifestHash !== undefined
      ? { providerManifestHash: providerExecutionPlan.providerManifestHash }
      : {}),
    now
  } as ExecutionPlanInput) as ExecutorExecutionPlan);
  const permit = createApprovedProviderExecutionPermit({
    plan: executorPlan,
    manifest: provider.manifest,
    permitId: `permit-${executorPlan.planId}`,
    issuedAt: now
  });

  return {
    provider,
    providerRegistry,
    task,
    run,
    principal,
    policyDecision,
    providerExecutionPlan,
    executorPlan,
    permit,
    dispatchPreflight: createControlledReadOnlyProviderDispatchPreflight({
      providerExecutionPlan
    }),
    governanceState: createLowRiskGovernanceState(task.taskId),
    taskEnvelope: createTaskEnvelope(task)
  };
}

function createPlannerInput(
  overrides: Partial<PlanProviderExecutionInput> = {}
): PlanProviderExecutionInput {
  const task = overrides.task ?? createTask();
  const policyDecision = overrides.policyDecision ?? createPolicyDecision(task);
  const run = overrides.run ?? createRun(task, policyDecision);

  return {
    task,
    run,
    principal: overrides.principal ?? PrincipalSchema.parse(validPrincipal),
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
    providerRegistry: overrides.providerRegistry ?? createRegistry(createFakeCodexCliProvider()),
    ...(overrides.preferredProviderId !== undefined
      ? { preferredProviderId: overrides.preferredProviderId }
      : {}),
    now: overrides.now ?? now
  };
}

function createTask(): Task {
  return TaskSchema.parse({
    ...validTask,
    taskId: "task_controlled_provider_dispatcher_001",
    requestedAction: "Inspect repository state through controlled provider dispatch.",
    successCriteria: ["controlled dispatcher gates runner"],
    outOfScope: ["workspace-write", "external writes"],
    repo: {
      root: "workspace",
      branch: "agent/controlled-provider-dispatcher",
      worktreeClean: true,
      protectedBranch: false
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["governance"]
    },
    hints: {
      taskClass: "read_only",
      riskHints: [],
      tags: ["controlled-provider-dispatcher"],
      provenance: []
    }
  });
}

function createPolicyDecision(task: Task): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "decision_controlled_provider_dispatcher_001",
    taskId: task.taskId,
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
      sandbox: createReadOnlySandboxProfile()
    },
    capabilities: [createReadScope()],
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

function createRun(task: Task, policyDecision: PolicyDecision): Run {
  return RunSchema.parse({
    ...validRun,
    runId: "run_controlled_provider_dispatcher_001",
    taskId: task.taskId,
    policyDecisionId: policyDecision.decisionId,
    status: "running",
    createdAt: now,
    updatedAt: now
  });
}

function createReadOnlySandboxProfile(): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_controlled_provider_dispatcher_read_only",
    mode: "read-only",
    networkAccess: "none",
    writableRoots: [],
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
  planExecution(input: ExecutionPlanInput): ExecutorExecutionPlan;
  validateExecutionPlan(plan: ExecutorExecutionPlan): ExecutionValidationResult;
  execute(
    plan: ExecutorExecutionPlan,
    context: ProviderExecutionContext
  ): ProviderExecutionResult;
};

function createFakeCodexCliProvider(options: {
  validation?: ExecutionValidationResult;
  manifest?: ProviderManifest;
} = {}): FakeExecutorProvider {
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const manifest = options.manifest ?? createFakeCodexCliManifest();

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
        ...(input.principalHash !== undefined
          ? { principalHash: input.principalHash }
          : {}),
        ...(input.providerExecutionPlanHash !== undefined
          ? { providerExecutionPlanHash: input.providerExecutionPlanHash }
          : {}),
        ...(input.providerManifestHash !== undefined
          ? { providerManifestHash: input.providerManifestHash }
          : {}),
        providerId: manifest.providerId,
        inputHash: input.inputHash ?? "1".repeat(64),
        policyDecisionHash: hashProviderExecutionPlannerObject(input.policyDecision),
        requiredCapabilities: ["fs.read:workspace/**"],
        approvalRequired: false,
        sandboxProfile: input.sandboxProfile,
        sideEffectClass: "read_only",
        createdAt: input.now,
        metadata: {
          codexCliProvider: {
            schemaVersion: "codex-cli-provider-executor-plan.v1",
            codexCliPlan: {
              approvalPolicy: "never"
            }
          }
        }
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
      return {
        ok: true,
        artifacts: [],
        events: []
      };
    }
  };
}

function createFakeCodexCliManifest(): ProviderManifest {
  return parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: "codex-cli",
    kind: "executor",
    displayName: "Fake Codex CLI",
    version: "0.1.0",
    capabilities: ["execution.plan", "execution.validate", "execution.execute"],
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
    supportedSandboxProfiles: [createReadOnlySandboxProfile()],
    supportedSideEffectClasses: ["read_only"],
    enabled: true,
    metadata: {}
  });
}

function createRegistry(provider: ExecutorProvider): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(provider.manifest, { registeredAt: now });
  registry.registerProvider(provider.manifest, provider);
  return registry;
}

function createLowRiskGovernanceState(taskId: string): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId,
    branchId: "main",
    phase: "execution",
    trustBalance: { centralOrder: 0.5, distributedVitality: 0.5 },
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

function createTaskEnvelope(task: Task): TaskEnvelope {
  return parseTaskEnvelope({
    taskId: task.taskId,
    source: task.source,
    intent: {
      summary: task.intent?.summary ?? task.title,
      requestedAction: task.intent?.requestedAction ?? task.requestedAction,
      successCriteria: task.successCriteria,
      outOfScope: task.outOfScope
    },
    repoContext: {
      ...(task.repo.root !== undefined ? { repoRoot: task.repo.root } : {}),
      ...(task.repo.branch !== undefined ? { branch: task.repo.branch } : {}),
      ...(task.repo.worktreeClean !== undefined
        ? { worktreeClean: task.repo.worktreeClean }
        : {}),
      ...(task.repo.protectedBranch !== undefined
        ? { protectedBranch: task.repo.protectedBranch }
        : {})
    },
    target: task.target,
    constraints: {
      ...(typeof task.constraints.requiresNetwork === "boolean"
        ? { requiresNetwork: task.constraints.requiresNetwork }
        : {}),
      ...(typeof task.constraints.explicitOwnership === "boolean"
        ? { explicitOwnership: task.constraints.explicitOwnership }
        : {}),
      ...(typeof task.constraints.allowBackgroundAutomation === "boolean"
        ? { allowBackgroundAutomation: task.constraints.allowBackgroundAutomation }
        : {})
    },
    hints: {
      taskClassHint: "read_only",
      riskHints: task.hints.riskHints,
      tags: task.hints.tags,
      provenance: []
    }
  });
}

function createClock(): () => string {
  let index = 0;
  return () => {
    const timestamp = `2026-07-09T01:00:${String(index).padStart(2, "0")}.000Z`;
    index += 1;
    return timestamp;
  };
}
