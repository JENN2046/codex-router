import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { hashApprovalScope } from "../packages/approval-permit/src/index.js";
import { InMemoryArtifactStore } from "../packages/artifact-store/src/index.js";
import {
  type CodexCliProcessSpawner
} from "../packages/codex-cli-host/src/index.js";
import {
  hashProviderExecutionPlannerObject,
  planProviderExecution,
  ProviderExecutionPlanSchema,
  type PlanProviderExecutionInput
} from "../packages/execution-planner/src/index.js";
import { InMemoryKernelStore } from "../packages/kernel-store/src/index.js";
import {
  ArtifactSchema,
  CapabilityScopeSchema,
  PrincipalSchema,
  PolicyDecisionSchema,
  RunSchema,
  SandboxProfileSchema,
  TaskSchema,
  type CapabilityScope,
  type Principal,
  type PolicyDecision,
  type Run,
  type SandboxProfile,
  type Task
} from "../packages/kernel-contracts/src/index.js";
import {
  createApprovedProviderExecutionPermit,
  parseExecutorExecutionPlan,
  parseProviderManifest,
  hashProviderManifest,
  type ExecutionPlanInput,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderExecutionContext,
  type ProviderExecutionPermit,
  type ProviderExecutionResult,
  type ProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  runProviderExecutionPlanControlledReadOnly,
  runProviderExecutionPlanDryRun
} from "../packages/provider-execution-runner/src/index.js";
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

test("provider execution runner enforces policy-derived plan invariants before provider hooks", async () => {
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
  const tamperedPlan = ProviderExecutionPlanSchema.parse({
    ...planned,
    requiredCapabilities: [],
    sandboxProfile: createWorkspaceWriteSandboxProfile(),
    sideEffectClass: "workspace_write"
  });

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan: tamperedPlan,
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
  assert.ok(result.reasons.includes("provider_plan_sandbox_profile_policy_mismatch"));
  assert.ok(result.reasons.includes("provider_plan_required_capabilities_policy_mismatch"));
  assert.ok(result.reasons.includes(
    "provider_plan_side_effect_class_policy_mismatch:workspace_write:read_only"
  ));
  assert.equal(provider.calls.planExecution, 0);
  assert.equal(provider.calls.validateExecutionPlan, 0);
  assert.equal(provider.calls.execute, 0);
});

test("provider execution runner blocks disabled providers before provider hooks", async () => {
  const planningProvider = createFakeExecutorProvider();
  const planningRegistry = createRegistry(planningProvider);
  const task = createTask();
  const policyDecision = createPolicyDecision({ taskId: task.taskId });
  const run = createRun(task, policyDecision, "running");
  const providerExecutionPlan = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    providerRegistry: planningRegistry,
    preferredProviderId: planningProvider.manifest.providerId
  }));
  const disabledProvider = createFakeExecutorProvider({ enabled: false });
  const disabledRegistry = createRegistry(disabledProvider);

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan,
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: disabledRegistry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("provider_disabled:fake-executor"));
  assert.equal(disabledProvider.calls.planExecution, 0);
  assert.equal(disabledProvider.calls.validateExecutionPlan, 0);
  assert.equal(disabledProvider.calls.execute, 0);
});

test("provider execution runner blocks provider manifest hash drift before provider hooks", async () => {
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
  const tamperedPlan = ProviderExecutionPlanSchema.parse({
    ...planned,
    providerManifestHash: "0".repeat(64)
  });

  const result = await runProviderExecutionPlanDryRun({
    providerExecutionPlan: tamperedPlan,
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
  assert.ok(result.reasons.includes("provider_plan_manifest_hash_mismatch"));
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

test("provider execution runner enforces executor inputHash before provider validation", async () => {
  const provider = createFakeExecutorProvider({
    executorPlanOverrides: {
      inputHash: "0".repeat(64)
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
  assert.ok(result.reasons.includes("executor_plan_input_hash_mismatch"));
  assert.equal(provider.calls.planExecution, 1);
  assert.equal(provider.calls.validateExecutionPlan, 0);
  assert.equal(provider.calls.execute, 0);
  assert.deepEqual(result.validation?.reasons, result.reasons.slice(1));
});

test("provider execution runner enforces required capability invariants before provider validation", async () => {
  const provider = createFakeExecutorProvider({
    executorPlanOverrides: {
      requiredCapabilities: []
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
  assert.ok(result.reasons.includes("executor_plan_required_capabilities_mismatch"));
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

test("provider execution runner executes controlled read-only codex-cli plans with explicit permit and guard", async () => {
  let spawnCalls = 0;
  const fixture = createControlledReadOnlyCodexFixture(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"CONTROLLED_READONLY_OK\"}\n",
      exitCode: 0
    });
  });
  const kernelStore = new InMemoryKernelStore();
  const artifactStore = new InMemoryArtifactStore({ now: createClock() });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: fixture.registry,
    kernelStore,
    artifactStore,
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(fixture.provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const providerArtifacts = result.providerResultSummary?.artifacts as Array<{
    summary?: { status?: string; approvalPolicy?: string; sandbox?: string };
  }>;
  const serializedEvidence = JSON.stringify({
    executionEvidence: result.executionEvidence,
    providerResultSummary: result.providerResultSummary
  });

  assert.equal(result.status, "controlled_readonly_succeeded", result.reasons.join(","));
  assert.equal(result.dryRun, false);
  assert.equal(result.executeInvoked, true);
  assert.equal(spawnCalls, 1);
  assert.equal(result.validation?.valid, true);
  assert.equal(result.providerResultSummary?.ok, true);
  assert.ok(result.executorPlan);
  assert.equal(result.executorPlan.providerId, fixture.provider.manifest.providerId);
  assert.equal("metadata" in result.executorPlan, false);
  assert.equal(providerArtifacts[0]?.summary?.status, "completed");
  assert.equal(providerArtifacts[0]?.summary?.approvalPolicy, "never");
  assert.equal(providerArtifacts[0]?.summary?.sandbox, "read-only");
  assert.deepEqual(
    kernelStore.listEvents({ runId: fixture.run.runId }).map((event) => event.eventType),
    [
      "kernel.provider.execution.controlled_readonly.started",
      "kernel.provider.execution.controlled_readonly.succeeded"
    ]
  );
  assert.equal((await artifactStore.listArtifacts({ runId: fixture.run.runId })).length, 1);
  assert.equal(kernelStore.listArtifacts({ runId: fixture.run.runId }).length, 1);
  assert.equal(serializedEvidence.includes("CONTROLLED_READONLY_OK"), false);
  assert.equal(serializedEvidence.includes("\"prompt\""), false);
  assert.equal(serializedEvidence.includes("\"args\""), false);
  assert.equal(serializedEvidence.includes("\"stdout\""), false);
  assert.equal(serializedEvidence.includes("\"stderr\""), false);
  assert.equal(serializedEvidence.includes("requestedAction"), false);
});

test("provider execution runner blocks controlled read-only execution without metadata before spawn", async () => {
  let spawnCalls = 0;
  const fixture = createControlledReadOnlyCodexFixture(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    });
  });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: fixture.registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(spawnCalls, 0);
  assert.ok(result.reasons.includes("controlled_readonly_provider_execution_metadata_required"));
});

test("provider execution runner blocks controlled read-only execution without a provider permit before spawn", async () => {
  let spawnCalls = 0;
  const fixture = createControlledReadOnlyCodexFixture(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    });
  });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: fixture.registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(fixture.provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(spawnCalls, 0);
  assert.ok(result.reasons.includes("controlled_readonly_provider_execution_permit_required"));
});

test("provider execution runner rejects controlled read-only executor plan metadata tampering", async () => {
  let spawnCalls = 0;
  const fixture = createControlledReadOnlyCodexFixture(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    });
  });
  const codexMetadata = fixture.executorPlan.metadata.codexCliProvider as Record<string, unknown>;
  const codexCliPlan = codexMetadata.codexCliPlan as Record<string, unknown>;
  const tamperedExecutorPlan = parseExecutorExecutionPlan({
    ...fixture.executorPlan,
    metadata: {
      ...fixture.executorPlan.metadata,
      codexCliProvider: {
        ...codexMetadata,
        codexCliPlan: {
          ...codexCliPlan,
          command: "evil-codex"
        }
      }
    }
  });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: fixture.registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: tamperedExecutorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(fixture.provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "validation_failed");
  assert.equal(result.executeInvoked, false);
  assert.equal(spawnCalls, 0);
  assert.ok(result.reasons.includes("provider_execution_permit_invalid"));
  assert.ok(result.reasons.includes(
    "controlled_readonly_provider_execution_permit_plan_hash_mismatch"
  ));
});

test("provider execution runner rejects controlled read-only task content replacement", async () => {
  let spawnCalls = 0;
  const fixture = createControlledReadOnlyCodexFixture(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    });
  });
  const replacedTask = TaskSchema.parse({
    ...fixture.task,
    requestedAction: "read a different file with the same task id"
  });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: replacedTask,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: fixture.registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(fixture.provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(spawnCalls, 0);
  assert.ok(result.reasons.includes("provider_plan_task_hash_mismatch"));
});

test("provider execution runner rejects controlled read-only principal replacement", async () => {
  let spawnCalls = 0;
  const fixture = createControlledReadOnlyCodexFixture(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    });
  });
  const otherPrincipal: Principal = PrincipalSchema.parse({
    ...validPrincipal,
    principalId: "principal_other_controlled_readonly"
  });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: otherPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: fixture.registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(fixture.provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(spawnCalls, 0);
  assert.ok(result.reasons.some((reason) => reason.startsWith("provider_plan_principal_mismatch:")));
  assert.ok(result.reasons.includes("provider_plan_principal_hash_mismatch"));
});

test("provider execution runner blocks controlled read-only execution for non-codex providers", async () => {
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
  const executorPlan = await provider.planExecution({
    task,
    run,
    policyDecision,
    sandboxProfile: providerExecutionPlan.sandboxProfile,
    inputHash: providerExecutionPlan.inputHash,
    now
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: executorPlan,
    manifest: provider.manifest,
    issuedAt: now
  });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan,
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    providerRegistry: registry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan,
    permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.ok(result.reasons.includes("controlled_readonly_requires_codex_cli_provider"));
  assert.equal(provider.calls.execute, 0);
});

test("provider execution runner sanitizes controlled read-only validation failure reasons", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  let executeCalls = 0;
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      return {
        valid: false,
        reasons: [
          "raw env OPENAI_API_KEY reached validation",
          "\"stdout\" contained validation output",
          "sk-validation-marker",
          "safe_provider_validation_failure"
        ]
      };
    },
    execute(): ProviderExecutionResult {
      executeCalls += 1;
      throw new Error("provider_execute_should_not_be_called");
    }
  };
  const kernelStore = new InMemoryKernelStore();
  const artifactStore = new InMemoryArtifactStore({ now: createClock() });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore,
    artifactStore,
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const serialized = JSON.stringify({
    result,
    events: kernelStore.listEvents({ runId: fixture.run.runId }),
    artifacts: await artifactStore.listArtifacts({ runId: fixture.run.runId })
  });

  assert.equal(result.status, "validation_failed");
  assert.equal(result.executeInvoked, false);
  assert.equal(executeCalls, 0);
  assert.ok(result.reasons.includes("provider_validation_failed"));
  assert.ok(result.reasons.includes("provider_execution_reason_redacted"));
  assert.ok(result.validation?.reasons.includes("provider_execution_reason_redacted"));
  assert.ok(result.validation?.reasons.includes("safe_provider_validation_failure"));
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("\"stdout\" contained validation output"), false);
  assert.equal(serialized.includes("sk-validation-marker"), false);
  assert.equal(serialized.includes("raw env"), false);
});

test("provider execution runner sanitizes controlled read-only thrown validation errors", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  let executeCalls = 0;
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      throw new Error("raw env OPENAI_API_KEY and \"stdout\" leaked from validation");
    },
    execute(): ProviderExecutionResult {
      executeCalls += 1;
      throw new Error("provider_execute_should_not_be_called");
    }
  };
  const kernelStore = new InMemoryKernelStore();
  const artifactStore = new InMemoryArtifactStore({ now: createClock() });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore,
    artifactStore,
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const serialized = JSON.stringify({
    result,
    events: kernelStore.listEvents({ runId: fixture.run.runId }),
    artifacts: await artifactStore.listArtifacts({ runId: fixture.run.runId })
  });

  assert.equal(result.status, "validation_failed");
  assert.equal(result.executeInvoked, false);
  assert.equal(executeCalls, 0);
  assert.ok(result.reasons.includes("provider_validation_failed"));
  assert.ok(
    result.validation?.reasons.includes("provider_validation_failed:redacted_execution_error")
  );
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("\"stdout\" leaked"), false);
  assert.equal(serialized.includes("raw env"), false);
});

test("provider execution runner sanitizes controlled read-only provider failure reasons", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      return {
        ok: false,
        error: {
          code: "provider_failed_OPENAI_API_KEY",
          reasons: [
            "\"stdout\" contained execution output",
            "sk-redacted-marker",
            "safe_provider_failure"
          ]
        }
      };
    }
  };
  const kernelStore = new InMemoryKernelStore();

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore,
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const serialized = JSON.stringify({
    result,
    events: kernelStore.listEvents({ runId: fixture.run.runId })
  });

  assert.equal(result.status, "execution_failed");
  assert.equal(result.executeInvoked, true);
  assert.equal(result.failureClass, "provider_execution_failed");
  assert.ok(result.reasons.includes("provider_execution_failed"));
  assert.ok(result.reasons.includes("provider_execution_reason_redacted"));
  assert.ok(result.reasons.includes("safe_provider_failure"));
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("sk-redacted-marker"), false);
  assert.equal(serialized.includes("\"stdout\" contained execution output"), false);
});

test("provider execution runner serializes controlled read-only outputs with one safe schema", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const executorPlan = parseExecutorExecutionPlan({
    ...fixture.executorPlan,
    metadata: {
      ...fixture.executorPlan.metadata,
      injectedPrompt: "Prompt EXECUTOR_PROMPT_SENTINEL",
      injectedStdout: "STDOUT EXECUTOR_STDOUT_SENTINEL",
      accessToken: "EXECUTOR_ACCESS_TOKEN_SENTINEL"
    }
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: executorPlan,
    manifest: fixture.provider.manifest,
    permitId: `permit-${executorPlan.planId}-safe-schema`,
    issuedAt: now
  });
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      return executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      return {
        ok: true,
        artifacts: [
          ArtifactSchema.parse({
            schemaVersion: "artifact.v1",
            artifactId: "artifact_PROMPT_CHANNEL_SENTINEL",
            taskId: fixture.task.taskId,
            runId: fixture.run.runId,
            kind: "evidence",
            uri: "artifact://URI_CHANNEL_SENTINEL/payload",
            sha256: "2".repeat(64),
            sizeBytes: 42,
            createdAt: now,
            metadata: {
              summaryKind: "STDOUT_CHANNEL_SENTINEL",
              summary: {
                status: "completed",
                approvalPolicy: "never",
                sandbox: "read-only",
                Prompt: "PROMPT_VALUE_SENTINEL",
                STDOUT: "STDOUT_VALUE_SENTINEL",
                processEnv: {
                  OPENAI_API_KEY: "PROCESS_ENV_VALUE_SENTINEL"
                },
                apiKey: "API_KEY_VALUE_SENTINEL",
                accessToken: "ACCESS_TOKEN_VALUE_SENTINEL",
                clientSecret: "CLIENT_SECRET_VALUE_SENTINEL",
                output: "OUTPUT_VALUE_SENTINEL",
                safeNote: "safe_summary_value"
              }
            }
          })
        ]
      };
    }
  };
  const kernelStore = new InMemoryKernelStore();
  const artifactStore = new CapturingArtifactStore({ now: createClock() });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore,
    artifactStore,
    executorPlan,
    permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const providerArtifacts = result.providerResultSummary?.artifacts as Array<Record<string, unknown>>;
  const serialized = JSON.stringify({
    result,
    events: kernelStore.listEvents({ runId: fixture.run.runId }),
    artifactWrites: artifactStore.putInputs
  });

  assert.equal(result.status, "controlled_readonly_succeeded", result.reasons.join(","));
  assert.ok(result.executorPlan);
  assert.equal("metadata" in result.executorPlan, false);
  assert.equal(providerArtifacts[0]?.artifactId, undefined);
  assert.equal(providerArtifacts[0]?.uri, undefined);
  assert.equal(providerArtifacts[0]?.summaryKind, undefined);
  assert.equal(serialized.includes("safe_summary_value"), true);
  for (const sentinel of [
    "EXECUTOR_PROMPT_SENTINEL",
    "EXECUTOR_STDOUT_SENTINEL",
    "EXECUTOR_ACCESS_TOKEN_SENTINEL",
    "PROMPT_CHANNEL_SENTINEL",
    "URI_CHANNEL_SENTINEL",
    "STDOUT_CHANNEL_SENTINEL",
    "PROMPT_VALUE_SENTINEL",
    "STDOUT_VALUE_SENTINEL",
    "PROCESS_ENV_VALUE_SENTINEL",
    "API_KEY_VALUE_SENTINEL",
    "ACCESS_TOKEN_VALUE_SENTINEL",
    "CLIENT_SECRET_VALUE_SENTINEL",
    "OUTPUT_VALUE_SENTINEL"
  ]) {
    assert.equal(serialized.includes(sentinel), false, sentinel);
  }
});

test("provider execution runner sanitizes controlled read-only thrown execution errors", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      throw new Error("raw env OPENAI_API_KEY and \"args\" were exposed");
    }
  };
  const kernelStore = new InMemoryKernelStore();

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore,
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const serialized = JSON.stringify({
    result,
    events: kernelStore.listEvents({ runId: fixture.run.runId })
  });

  assert.equal(result.status, "execution_failed");
  assert.equal(result.executeInvoked, true);
  assert.equal(result.failureClass, "provider_execute_threw");
  assert.ok(result.reasons.includes("provider_execute_threw:redacted_execution_error"));
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("raw env"), false);
  assert.equal(serialized.includes("\"args\" were exposed"), false);
});

test("provider execution runner records provider attestation in dry-run evidence", async () => {
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

  assert.equal(result.providerAttestation?.schemaVersion, "provider-attestation.v1");
  assert.equal(result.providerAttestation.providerId, provider.manifest.providerId);
  assert.equal(result.providerAttestation.kind, "executor");
  assert.equal(result.providerAttestation.version, provider.manifest.version);
  assert.match(result.providerAttestation.manifestHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.providerAttestation.securityBoundary, provider.manifest.securityBoundary);

  assert.equal(
    result.reportArtifact?.metadata.providerAttestationManifestHash,
    result.providerAttestation.manifestHash
  );

  const completedEvent = kernelStore.listEvents({ runId: run.runId }).at(-1);
  const eventPayload = completedEvent?.payload as {
    providerAttestation?: { providerId?: string; manifestHash?: string };
  };
  assert.equal(eventPayload.providerAttestation?.providerId, provider.manifest.providerId);
  assert.equal(eventPayload.providerAttestation?.manifestHash, result.providerAttestation.manifestHash);
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
  enabled?: boolean;
} = {}): FakeExecutorProvider {
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const manifest = createFakeExecutorManifest({
    enabled: options.enabled ?? true
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
        ...(input.providerManifestHash !== undefined ? { providerManifestHash: input.providerManifestHash } : {}),
        providerId: manifest.providerId,
        inputHash: input.inputHash ?? "1".repeat(64),
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

class CapturingArtifactStore extends InMemoryArtifactStore {
  readonly putInputs: Array<Parameters<InMemoryArtifactStore["putArtifact"]>[0]> = [];

  override async putArtifact(
    input: Parameters<InMemoryArtifactStore["putArtifact"]>[0]
  ): ReturnType<InMemoryArtifactStore["putArtifact"]> {
    this.putInputs.push(input);
    return super.putArtifact(input);
  }
}

function createFakeExecutorManifest(options: {
  enabled?: boolean;
} = {}): ProviderManifest {
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
    enabled: options.enabled ?? true,
    metadata: {}
  });
}

type ControlledReadOnlyCodexFixture = {
  provider: CodexCliExecutorProvider;
  registry: ProviderRegistry;
  task: Task;
  policyDecision: PolicyDecision;
  run: Run;
  providerExecutionPlan: ReturnType<typeof planProviderExecution>;
  executorPlan: ExecutorExecutionPlan;
  permit: ProviderExecutionPermit;
};

function createControlledReadOnlyCodexFixture(
  spawn: CodexCliProcessSpawner
): ControlledReadOnlyCodexFixture {
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    executionMode: "real",
    realExecutionAllowed: true,
    nowMs: () => Date.parse(now),
    timeoutMs: 1_000,
    spawn
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
  const executorPlan = provider.planExecution({
    task,
    run,
    policyDecision,
    sandboxProfile: providerExecutionPlan.sandboxProfile,
    inputHash: providerExecutionPlan.inputHash,
    taskHash: providerExecutionPlan.taskHash,
    principalId: providerExecutionPlan.principalId,
    principalHash: providerExecutionPlan.principalHash,
    providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan),
    ...(providerExecutionPlan.providerManifestHash !== undefined
      ? { providerManifestHash: providerExecutionPlan.providerManifestHash }
      : {}),
    now
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: executorPlan,
    manifest: provider.manifest,
    permitId: `permit-${executorPlan.planId}`,
    issuedAt: now
  });

  return {
    provider,
    registry,
    task,
    policyDecision,
    run,
    providerExecutionPlan,
    executorPlan,
    permit
  };
}

function createRunnerRealExecutionGuard(manifest: ProviderManifest): Record<string, unknown> {
  return {
    schemaVersion: "codex-cli-provider-real-execution-guard.v1",
    realExecutionAllowed: true,
    providerRegistrySelection: {
      selected: true,
      providerId: manifest.providerId,
      manifestHash: hashProviderManifest(manifest),
      kind: manifest.kind,
      enabled: manifest.enabled
    },
    environmentPreflight: {
      status: "ready",
      checks: {
        injectedSpawner: true,
        realCliAllowed: true,
        versionProbe: "passed",
        noTaskEnvelope: true,
        noPromptSent: true,
        noWorkspaceWrite: true,
        noRealCliFallback: true
      },
      blockingReasons: []
    }
  };
}

class FakeCodexCliStream extends EventEmitter {
  setEncoding(_encoding: BufferEncoding): void {}
  destroy(): void {}
}

class FakeCodexCliWritableStream {
  end(): void {}
  destroy(): void {}
}

class FakeCodexCliChild extends EventEmitter {
  readonly stdin = new FakeCodexCliWritableStream();
  readonly stdout = new FakeCodexCliStream();
  readonly stderr = new FakeCodexCliStream();

  constructor(
    private readonly closeCode: number,
    private readonly closeSignal: NodeJS.Signals | null
  ) {
    super();
  }

  kill(_signal?: NodeJS.Signals | number): boolean {
    queueMicrotask(() => {
      this.emit("close", this.closeCode, this.closeSignal);
    });
    return true;
  }

  unref(): void {}
}

function createFakeCodexCliChild(options: {
  stdout: string;
  stderr?: string;
  exitCode: number;
  signal?: NodeJS.Signals | null;
}): FakeCodexCliChild {
  const child = new FakeCodexCliChild(
    options.exitCode,
    options.signal ?? null
  );

  queueMicrotask(() => {
    if (options.stdout) {
      child.stdout.emit("data", options.stdout);
    }
    if (options.stderr) {
      child.stderr.emit("data", options.stderr);
    }
    child.emit("close", options.exitCode, options.signal ?? null);
  });

  return child;
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
