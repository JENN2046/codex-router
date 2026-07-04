import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { hashApprovalScope } from "../packages/approval-permit/src/index.js";
import { InMemoryArtifactStore } from "../packages/artifact-store/src/index.js";
import {
  type CodexCliProcessSpawner
} from "../packages/codex-cli-host/src/index.js";
import {
  parseTaskEnvelope,
  type TaskClass,
  type TaskEnvelope
} from "../packages/contracts/src/index.js";
import {
  createRecordingExecutionObservationStore,
  resolveExecutionObservationRef
} from "../packages/execution-observation/src/index.js";
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
  hashExecutorExecutionPlan,
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
  ControlledReadOnlyExecutionEvidenceSchema,
  runProviderExecutionPlanControlledReadOnly,
  runProviderExecutionPlanDryRun,
  summarizeGovernanceOperatorActionEnvelope
} from "../packages/provider-execution-runner/src/index.js";
import { ProviderRegistry } from "../packages/provider-registry/src/index.js";
import { CodexCliExecutorProvider } from "../packages/providers/codex-cli/src/index.js";
import type { GovernanceState } from "../packages/state-manager/src/index.js";
import type { StrategyDecisionV2 } from "../packages/strategy-router/src/index.js";
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
  const evidence = ControlledReadOnlyExecutionEvidenceSchema.parse(result.executionEvidence);
  const completedEventPayload = kernelStore.listEvents({ runId: fixture.run.runId }).at(-1)?.payload as {
    executionEvidence?: Record<string, unknown>;
  };
  const serializedEvidence = JSON.stringify({
    executionEvidence: result.executionEvidence,
    providerResultSummary: result.providerResultSummary,
    completedEventPayload
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
  assert.equal(evidence.schemaVersion, "provider-execution-controlled-readonly-evidence.v2");
  assert.equal(
    evidence.bindings.providerExecutionPlan.providerExecutionPlanHash,
    hashProviderExecutionPlannerObject(fixture.providerExecutionPlan)
  );
  assert.equal(
    evidence.bindings.executorPlan.executorPlanHash,
    hashExecutorExecutionPlan(fixture.executorPlan)
  );
  assert.equal(evidence.bindings.policy.policyDecisionHash, fixture.providerExecutionPlan.policyDecisionHash);
  assert.equal(evidence.bindings.principal.principalHash, fixture.providerExecutionPlan.principalHash);
  assert.equal(evidence.bindings.permit.permitId, fixture.permit.permitId);
  assert.equal(evidence.bindings.permit.planHash, fixture.permit.planHash);
  assert.equal(evidence.bindings.permit.policyDecisionHash, fixture.permit.policyDecisionHash);
  assert.equal(evidence.bindings.permit.consumptionStatus, "input_unconsumed");
  assert.equal(
    evidence.bindings.providerRegistrySelection.manifestHash,
    hashProviderManifest(fixture.provider.manifest)
  );
  assert.equal(
    evidence.bindings.environmentPreflight.artifactRef,
    createRunnerPreflightArtifactRef(fixture.provider.manifest)
  );
  assert.equal(
    evidence.bindings.environmentPreflight.artifactHash,
    createRunnerPreflightArtifactHash(fixture.provider.manifest)
  );
  assert.equal(evidence.bindings.report.artifactId, result.reportArtifact?.artifactId);
  assert.equal(completedEventPayload.executionEvidence?.reportArtifactId, result.reportArtifact?.artifactId);
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

test("provider execution runner preserves validation failures for legacy permit policy hashes", async () => {
  let spawnCalls = 0;
  const fixture = createControlledReadOnlyCodexFixture(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    });
  });
  const legacyPermit: ProviderExecutionPermit = {
    ...fixture.permit,
    policyDecisionHash: "policy_hash_other"
  };

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
    permit: legacyPermit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(fixture.provider.manifest)
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const evidence = ControlledReadOnlyExecutionEvidenceSchema.parse(result.executionEvidence);

  assert.equal(result.status, "validation_failed");
  assert.equal(result.executeInvoked, false);
  assert.equal(spawnCalls, 0);
  assert.ok(result.reasons.includes("provider_execution_permit_invalid"));
  assert.ok(result.reasons.includes("controlled_readonly_provider_execution_permit_policy_mismatch"));
  assert.equal(evidence.bindings.permit.permitId, legacyPermit.permitId);
  assert.equal(evidence.bindings.permit.policyDecisionHash, null);
  assert.equal(evidence.bindings.permit.planHash, legacyPermit.planHash);
  assert.equal(evidence.bindings.permit.consumptionStatus, "input_unconsumed");
});

test("provider execution runner blocks controlled read-only execution without preflight artifact binding", async () => {
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
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(
        fixture.provider.manifest,
        { omitPreflightArtifactBinding: true }
      )
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const evidence = ControlledReadOnlyExecutionEvidenceSchema.parse(result.executionEvidence);

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(spawnCalls, 0);
  assert.ok(result.reasons.includes("controlled_readonly_environment_preflight_artifact_ref_required"));
  assert.ok(result.reasons.includes("controlled_readonly_environment_preflight_artifact_hash_required"));
  assert.equal(evidence.bindings.environmentPreflight.artifactRef, null);
  assert.equal(evidence.bindings.environmentPreflight.artifactHash, null);
});

test("provider execution runner blocks controlled read-only execution with preflight artifact drift", async () => {
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
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(
        fixture.provider.manifest,
        {
          preflightArtifactRef: "artifact://controlled-readonly-provider-execution/preflight/other",
          preflightArtifactHash: "0".repeat(64)
        }
      )
    },
    now: createClock(),
    mode: "controlled-read-only"
  });
  const evidence = ControlledReadOnlyExecutionEvidenceSchema.parse(result.executionEvidence);

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(spawnCalls, 0);
  assert.ok(result.reasons.includes("controlled_readonly_environment_preflight_artifact_ref_mismatch"));
  assert.ok(result.reasons.includes("controlled_readonly_environment_preflight_artifact_hash_mismatch"));
  assert.equal(
    evidence.bindings.environmentPreflight.artifactHash,
    "0".repeat(64)
  );
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
  assert.ok(result.reasons.includes("provider_validation_failed"));
  assert.ok(result.reasons.includes(
    "codex_cli_provider_plan_must_not_store_raw_runtime"
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

test("provider execution runner bridges controlled read-only execution failures into governance", async () => {
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
      throw new Error("raw env OPENAI_API_KEY and argv should be redacted");
    }
  };
  const observationStore = createRecordingExecutionObservationStore();
  const governanceUpdates: Array<{
    state: GovernanceState;
    strategy: StrategyDecisionV2;
  }> = [];
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
    governanceState: createLowRiskGovernanceState(fixture.task.taskId),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    observationBus: observationStore,
    onGovernanceUpdate: async (state, strategy) => {
      governanceUpdates.push({ state, strategy });
    },
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "execution_failed");
  assert.equal(result.failureClass, "provider_execute_threw");
  assert.ok(result.governance);
  assert.equal(result.governance.state.anomalies.length, 1);
  assert.equal(result.governance.anomaly.message, "provider_execute_threw");
  assert.deepEqual(result.governance.evidenceRefs, result.governance.anomaly.evidenceRefs);
  assert.equal(result.governance.evidenceRefs.length, 1);
  assert.equal(governanceUpdates.length, 1);
  assert.equal(governanceUpdates[0]!.state.anomalies.length, 1);

  const resolvedObservation = await resolveExecutionObservationRef(
    observationStore,
    fixture.task.taskId,
    result.governance.evidenceRefs[0]!
  );
  assert.ok(resolvedObservation);
  assert.equal(
    resolvedObservation.primitiveId,
    `controlled_readonly_provider:${fixture.provider.manifest.providerId}:${fixture.providerExecutionPlan.planId}`
  );
  assert.equal(resolvedObservation.signals.errorClass, "provider_execute_threw");

  const completedEventPayload = kernelStore.listEvents({ runId: fixture.run.runId }).at(-1)?.payload as {
    governance?: {
      anomalyCount?: number;
      evidenceRefCount?: number;
    };
  };
  assert.equal(completedEventPayload.governance?.anomalyCount, 1);
  assert.equal(completedEventPayload.governance?.evidenceRefCount, 1);

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("argv should be redacted"), false);
});

test("provider execution runner uses stable governance error classes for provider plan failures", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      throw new Error("planner failed at /tmp/runtime-1760000000");
    },
    validateExecutionPlan(): ExecutionValidationResult {
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      throw new Error("provider_execute_should_not_be_called");
    }
  };
  const observationStore = createRecordingExecutionObservationStore();

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    governanceState: createLowRiskGovernanceState(fixture.task.taskId),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    observationBus: observationStore,
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "provider_plan_failed");
  assert.ok(result.reasons.includes("provider_plan_failed:planner failed at /tmp/runtime-1760000000"));
  assert.ok(result.governance);
  assert.equal(
    result.governance.anomaly.message,
    "controlled_readonly_provider_provider_plan_failed"
  );
  assert.equal(result.governance.evidenceRefs.length, 1);

  const resolvedObservation = await resolveExecutionObservationRef(
    observationStore,
    fixture.task.taskId,
    result.governance.evidenceRefs[0]!
  );
  assert.ok(resolvedObservation);
  assert.equal(
    resolvedObservation.signals.errorClass,
    "controlled_readonly_provider_provider_plan_failed"
  );
});

test("provider execution runner uses stable governance error classes for validation failures", async () => {
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
      throw new Error("validation failed at /tmp/runtime-1760000001");
    },
    execute(): ProviderExecutionResult {
      throw new Error("provider_execute_should_not_be_called");
    }
  };
  const observationStore = createRecordingExecutionObservationStore();

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    governanceState: createLowRiskGovernanceState(fixture.task.taskId),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    observationBus: observationStore,
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "validation_failed");
  assert.ok(result.reasons.includes("provider_validation_failed"));
  assert.ok(result.governance);
  assert.equal(
    result.governance.anomaly.message,
    "controlled_readonly_provider_validation_failed"
  );
  assert.equal(result.governance.evidenceRefs.length, 1);

  const resolvedObservation = await resolveExecutionObservationRef(
    observationStore,
    fixture.task.taskId,
    result.governance.evidenceRefs[0]!
  );
  assert.ok(resolvedObservation);
  assert.equal(
    resolvedObservation.signals.errorClass,
    "controlled_readonly_provider_validation_failed"
  );
});

test("provider execution runner exposes operator action on third controlled read-only failure", async () => {
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
          code: "codex_cli_exit_nonzero",
          reasons: ["codex_cli_exit_nonzero"]
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
    governanceState: createHighRiskGovernanceStateWithTwoExecutionFailures(fixture.task.taskId),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "execution_failed");
  assert.ok(result.reportArtifact);
  assert.ok(result.governance);
  const artifactEvidenceRef = `artifact:${result.reportArtifact.artifactId}`;
  assert.deepEqual(result.governance.evidenceRefs, [artifactEvidenceRef]);
  assert.deepEqual(result.governance.anomaly.evidenceRefs, [artifactEvidenceRef]);
  assert.deepEqual(result.governance.arbitrationPacket.rawEvidenceRefs, [
    artifactEvidenceRef
  ]);
  assert.equal(result.governance.anomaly.strikeNumber, 3);
  assert.equal(result.governance.recoveryRequired, true);
  assert.equal(result.governance.lockdown, true);
  assert.ok(result.governance.recoveryRecommendation);
  assert.equal(result.governance.recoveryRecommendation.evidenceStatus, "referenced");
  assert.deepEqual(result.governance.recoveryRecommendation.evidenceRefs, [
    artifactEvidenceRef
  ]);
  assert.ok(result.governance.operatorAction);
  assert.equal(result.governance.operatorAction.trigger, "third_anomaly");
  assert.equal(result.governance.operatorAction.lockdown, true);
  assert.equal(result.governance.operatorAction.requiresHumanApproval, true);
  assert.equal(result.governance.operatorAction.recommendedAction, "rollback");
  assert.equal(result.governance.operatorAction.evidenceStatus, "referenced");
  assert.deepEqual(result.governance.operatorAction.evidenceRefs, [
    artifactEvidenceRef
  ]);
  assert.deepEqual(result.operatorActionEnvelope, {
    schemaVersion: "governance-operator-action-envelope.v1",
    source: "execution_governance",
    taskId: fixture.task.taskId,
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "rollback",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [
      "governance_step_back_triggered",
      "arbitration_required"
    ],
    evidenceRefs: [artifactEvidenceRef],
    artifactRefs: [artifactEvidenceRef]
  });
  assert.deepEqual(result.operatorActionSummary, {
    schemaVersion: "governance-operator-action-summary.v1",
    present: true,
    source: "execution_governance",
    taskId: fixture.task.taskId,
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "rollback",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [
      "governance_step_back_triggered",
      "arbitration_required"
    ],
    evidenceRefs: [artifactEvidenceRef],
    artifactRefs: [artifactEvidenceRef]
  });
  assert.deepEqual(
    summarizeGovernanceOperatorActionEnvelope(result.operatorActionEnvelope),
    result.operatorActionSummary
  );
  const completedEventPayload = kernelStore.listEvents({ runId: fixture.run.runId }).at(-1)?.payload as {
    operatorActionSummary?: {
      present?: boolean;
      source?: string;
      recommendedAction?: string;
      artifactRefs?: string[];
    };
  };
  assert.equal(completedEventPayload.operatorActionSummary?.present, true);
  assert.equal(completedEventPayload.operatorActionSummary?.source, "execution_governance");
  assert.equal(completedEventPayload.operatorActionSummary?.recommendedAction, "rollback");
  assert.deepEqual(completedEventPayload.operatorActionSummary?.artifactRefs, [
    artifactEvidenceRef
  ]);
});

test("provider execution runner blocks mismatched governance state before provider hooks", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      calls.planExecution += 1;
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      calls.execute += 1;
      return { ok: true };
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
    governanceState: createLowRiskGovernanceState("stale-provider-governance-task"),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(result.governance, undefined);
  assert.equal(result.operatorActionEnvelope, undefined);
  assert.deepEqual(result.operatorActionSummary, {
    schemaVersion: "governance-operator-action-summary.v1",
    present: false,
    blockingReasons: [],
    evidenceRefs: [],
    artifactRefs: []
  });
  assert.ok(result.reasons.some((reason) =>
    reason.startsWith("controlled_readonly_provider_governance_state_task_mismatch:")
  ));
  assert.deepEqual(calls, {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  });
});

test("provider execution runner blocks invalid governance state before provider hooks", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      calls.planExecution += 1;
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      calls.execute += 1;
      return { ok: true };
    }
  };
  const invalidGovernanceState = {
    taskId: fixture.task.taskId
  } as unknown as GovernanceState;

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    governanceState: invalidGovernanceState,
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(result.governance, undefined);
  assert.equal(result.operatorActionEnvelope, undefined);
  assert.deepEqual(result.operatorActionSummary, {
    schemaVersion: "governance-operator-action-summary.v1",
    present: false,
    blockingReasons: [],
    evidenceRefs: [],
    artifactRefs: []
  });
  assert.ok(result.reasons.includes(
    "controlled_readonly_provider_governance_state_invalid"
  ));
  assert.deepEqual(calls, {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  });
});

test("provider execution runner blocks governance states requiring step-back before provider hooks", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      calls.planExecution += 1;
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      calls.execute += 1;
      return { ok: true };
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
    governanceState: createRecoveryRequiredGovernanceState(fixture.task.taskId),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(result.governance, undefined);
  assert.ok(result.preflightGovernance);
  assert.equal(result.preflightGovernance.phase, "execution");
  assert.equal(result.preflightGovernance.strategyDecision.actionFamily, "step_back");
  assert.equal(result.preflightGovernance.executionAllowed, false);
  assert.equal(result.preflightGovernance.recoveryRequired, true);
  assert.equal(result.preflightGovernance.lockdown, true);
  assert.equal(result.preflightGovernance.arbitrationPacket?.trigger, "third_anomaly");
  assert.equal(result.preflightGovernance.operatorAction?.recommendedAction, "rollback");
  assert.deepEqual(result.preflightGovernance.operatorAction?.blockingReasons, [
    "controlled_readonly_provider_governance_state_strategy_blocked:step_back"
  ]);
  assert.deepEqual(result.operatorActionEnvelope, {
    schemaVersion: "governance-operator-action-envelope.v1",
    source: "preflight_governance",
    taskId: fixture.task.taskId,
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "rollback",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [
      "controlled_readonly_provider_governance_state_strategy_blocked:step_back"
    ],
    evidenceRefs: ["artifact:provider-runner-third-failure-report"],
    artifactRefs: ["artifact:provider-runner-third-failure-report"]
  });
  assert.deepEqual(result.operatorActionSummary, {
    schemaVersion: "governance-operator-action-summary.v1",
    present: true,
    source: "preflight_governance",
    taskId: fixture.task.taskId,
    status: "requires_arbitration",
    trigger: "third_anomaly",
    recommendedAction: "rollback",
    requiresHumanApproval: true,
    lockdown: true,
    blockingReasons: [
      "controlled_readonly_provider_governance_state_strategy_blocked:step_back"
    ],
    evidenceRefs: ["artifact:provider-runner-third-failure-report"],
    artifactRefs: ["artifact:provider-runner-third-failure-report"]
  });
  assert.ok(result.reasons.includes(
    "controlled_readonly_provider_governance_state_strategy_blocked:step_back"
  ));
  const completedEventPayload = kernelStore.listEvents({ runId: fixture.run.runId }).at(-1)?.payload as {
    preflightGovernance?: {
      actionFamily?: string;
      operatorAction?: { recommendedAction?: string };
    };
    operatorActionEnvelope?: { recommendedAction?: string; source?: string };
    operatorActionSummary?: { present?: boolean; recommendedAction?: string; source?: string };
  };
  assert.equal(completedEventPayload.preflightGovernance?.actionFamily, "step_back");
  assert.equal(
    completedEventPayload.preflightGovernance?.operatorAction?.recommendedAction,
    "rollback"
  );
  assert.equal(completedEventPayload.operatorActionEnvelope?.source, "preflight_governance");
  assert.equal(
    completedEventPayload.operatorActionEnvelope?.recommendedAction,
    "rollback"
  );
  assert.equal(completedEventPayload.operatorActionSummary?.present, true);
  assert.equal(completedEventPayload.operatorActionSummary?.source, "preflight_governance");
  assert.equal(
    completedEventPayload.operatorActionSummary?.recommendedAction,
    "rollback"
  );
  assert.deepEqual(calls, {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  });
});

test("provider execution runner blocks simulate-only governance states before provider hooks", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      calls.planExecution += 1;
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      calls.execute += 1;
      return { ok: true };
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
    governanceState: createCriticalRiskGovernanceState(fixture.task.taskId),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(result.governance, undefined);
  assert.ok(result.preflightGovernance);
  assert.equal(result.preflightGovernance.phase, "execution");
  assert.equal(result.preflightGovernance.strategyDecision.actionFamily, "simulate");
  assert.equal(result.preflightGovernance.strategyDecision.agentBudget.executor, 0);
  assert.equal(result.preflightGovernance.executionAllowed, false);
  assert.equal(result.preflightGovernance.recoveryRequired, false);
  assert.equal(result.preflightGovernance.lockdown, false);
  assert.equal(result.preflightGovernance.operatorAction, undefined);
  assert.equal(result.operatorActionEnvelope, undefined);
  assert.deepEqual(result.operatorActionSummary, {
    schemaVersion: "governance-operator-action-summary.v1",
    present: false,
    blockingReasons: [],
    evidenceRefs: [],
    artifactRefs: []
  });
  assert.ok(result.reasons.includes(
    "controlled_readonly_provider_governance_state_strategy_blocked:simulate"
  ));
  const completedEventPayload = kernelStore.listEvents({ runId: fixture.run.runId }).at(-1)?.payload as {
    preflightGovernance?: {
      actionFamily?: string;
      executorBudget?: number;
      operatorAction?: unknown;
    };
    operatorActionEnvelope?: unknown;
    operatorActionSummary?: { present?: boolean };
  };
  assert.equal(completedEventPayload.preflightGovernance?.actionFamily, "simulate");
  assert.equal(completedEventPayload.preflightGovernance?.executorBudget, 0);
  assert.equal(completedEventPayload.preflightGovernance?.operatorAction, undefined);
  assert.equal(completedEventPayload.operatorActionEnvelope, undefined);
  assert.equal(completedEventPayload.operatorActionSummary?.present, false);
  assert.deepEqual(calls, {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  });
});

test("provider execution runner blocks recovery-phase governance states before provider hooks", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      calls.planExecution += 1;
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      calls.execute += 1;
      return { ok: true };
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
    governanceState: {
      ...createLowRiskGovernanceState(fixture.task.taskId),
      phase: "recovery"
    },
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(result.governance, undefined);
  assert.ok(result.preflightGovernance);
  assert.equal(result.preflightGovernance.phase, "recovery");
  assert.equal(result.preflightGovernance.strategyDecision.actionFamily, "execute");
  assert.equal(result.preflightGovernance.executionAllowed, false);
  assert.equal(result.preflightGovernance.recoveryRequired, true);
  assert.equal(result.preflightGovernance.lockdown, false);
  assert.equal(result.preflightGovernance.operatorAction, undefined);
  assert.ok(result.reasons.includes(
    "controlled_readonly_provider_governance_state_phase_blocked:recovery"
  ));
  const completedEventPayload = kernelStore.listEvents({ runId: fixture.run.runId }).at(-1)?.payload as {
    preflightGovernance?: {
      phase?: string;
      actionFamily?: string;
      recoveryRequired?: boolean;
    };
  };
  assert.equal(completedEventPayload.preflightGovernance?.phase, "recovery");
  assert.equal(completedEventPayload.preflightGovernance?.actionFamily, "execute");
  assert.equal(completedEventPayload.preflightGovernance?.recoveryRequired, true);
  assert.deepEqual(calls, {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  });
});

test("provider execution runner blocks stale governance task envelopes before provider hooks", async () => {
  const fixture = createControlledReadOnlyCodexFixture(() => createFakeCodexCliChild({
    stdout: "",
    exitCode: 0
  }));
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const provider: ExecutorProvider = {
    manifest: fixture.provider.manifest,
    planExecution(): ExecutorExecutionPlan {
      calls.planExecution += 1;
      return fixture.executorPlan;
    },
    validateExecutionPlan(): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(): ProviderExecutionResult {
      calls.execute += 1;
      return { ok: true };
    }
  };
  const staleEnvelope = parseTaskEnvelope({
    ...createTaskEnvelopeForProviderTask(fixture.task),
    repoContext: {
      ...createTaskEnvelopeForProviderTask(fixture.task).repoContext,
      protectedBranch: true
    },
    target: {
      branches: ["stale-target-branch"],
      files: ["packages/provider-execution-runner/src/index.ts"],
      modules: ["provider-execution-runner"]
    },
    constraints: {
      requiresNetwork: true,
      explicitOwnership: true
    }
  });

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    governanceState: createLowRiskGovernanceState(fixture.task.taskId),
    taskEnvelope: staleEnvelope,
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.executeInvoked, false);
  assert.equal(result.governance, undefined);
  assert.ok(result.reasons.some((reason) =>
    reason.startsWith("controlled_readonly_provider_governance_task_envelope_hash_mismatch:")
  ));
  assert.deepEqual(calls, {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  });
});

test("provider execution runner preserves governance task envelope provenance before hashing", async () => {
  const task = TaskSchema.parse({
    ...createTask(),
    hints: {
      taskClass: "read_only",
      riskHints: ["runtime_governance"],
      tags: ["provider-execution-runner"],
      provenance: [
        {
          field: "taskClass",
          value: "read_only",
          source: "policy",
          reason: "legacy envelope carried taskClassHint provenance",
          createdAt: now
        },
        {
          field: "riskHints",
          value: "runtime_governance",
          source: "agent",
          createdAt: now
        }
      ]
    }
  });
  const fixture = createControlledReadOnlyCodexFixture(
    () => createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    }),
    { task }
  );
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
      throw new Error("provider failure after provenance-preserving envelope match");
    }
  };

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    governanceState: createLowRiskGovernanceState(fixture.task.taskId),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "execution_failed");
  assert.ok(!result.reasons.some((reason) =>
    reason.startsWith("controlled_readonly_provider_governance_task_envelope_hash_mismatch:")
  ));
  assert.ok(result.governance);
  assert.equal(result.governance.anomaly.message, "provider_execute_threw");
});

test("provider execution runner preserves task hint when policy classification differs before hashing", async () => {
  const task = TaskSchema.parse({
    ...createTask(),
    hints: {
      taskClass: "engineering",
      riskHints: ["runtime_governance"],
      tags: ["provider-execution-runner"],
      provenance: [
        {
          field: "taskClass",
          value: "engineering",
          source: "agent",
          reason: "task envelope should preserve task-owned hint",
          createdAt: now
        }
      ]
    }
  });
  const policyDecision = createPolicyDecision({
    taskId: task.taskId,
    classification: {
      taskClass: "read_only",
      riskLevel: "low",
      ambiguityScore: 0,
      clarificationRequired: false,
      riskFactors: []
    }
  });
  const fixture = createControlledReadOnlyCodexFixture(
    () => createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    }),
    { task, policyDecision }
  );
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
      throw new Error("provider failure after task-hint-preserving envelope match");
    }
  };

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    governanceState: createLowRiskGovernanceState(fixture.task.taskId),
    taskEnvelope: createTaskEnvelopeForProviderTask(fixture.task),
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(result.status, "execution_failed");
  assert.ok(!result.reasons.some((reason) =>
    reason.startsWith("controlled_readonly_provider_governance_task_envelope_hash_mismatch:")
  ));
  assert.ok(result.governance);
  assert.equal(result.governance.anomaly.message, "provider_execute_threw");
});

test("provider execution runner does not synthesize policy-only task hints before hashing", async () => {
  const task = TaskSchema.parse({
    ...createTask(),
    hints: {
      riskHints: ["runtime_governance"],
      tags: ["provider-execution-runner"]
    }
  });
  const policyDecision = createPolicyDecision({
    taskId: task.taskId,
    classification: {
      taskClass: "read_only",
      riskLevel: "low",
      ambiguityScore: 0,
      clarificationRequired: false,
      riskFactors: []
    }
  });
  const fixture = createControlledReadOnlyCodexFixture(
    () => createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    }),
    { task, policyDecision }
  );
  const taskEnvelope = createTaskEnvelopeForProviderTask(fixture.task);
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
      throw new Error("provider failure after policy-only hint omission");
    }
  };

  const result = await runProviderExecutionPlanControlledReadOnly({
    providerExecutionPlan: fixture.providerExecutionPlan,
    task: fixture.task,
    run: fixture.run,
    principal: validPrincipal,
    policyDecision: fixture.policyDecision,
    providerRegistry: createRegistry(provider),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    executorPlan: fixture.executorPlan,
    permit: fixture.permit,
    executionMetadata: {
      codexCliProviderRealExecutionGuard: createRunnerRealExecutionGuard(provider.manifest)
    },
    governanceState: createLowRiskGovernanceState(fixture.task.taskId),
    taskEnvelope,
    now: createClock(),
    mode: "controlled-read-only"
  });

  assert.equal(taskEnvelope.hints.taskClassHint, undefined);
  assert.equal(result.status, "execution_failed");
  assert.ok(!result.reasons.some((reason) =>
    reason.startsWith("controlled_readonly_provider_governance_task_envelope_hash_mismatch:")
  ));
  assert.ok(result.governance);
  assert.equal(result.governance.anomaly.message, "provider_execute_threw");
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

function createTaskEnvelopeForProviderTask(task: Task): TaskEnvelope {
  const taskClassHint = toTaskEnvelopeTaskClassHint(task.hints.taskClass);

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
      ...(taskClassHint !== undefined ? { taskClassHint } : {}),
      riskHints: task.hints.riskHints,
      tags: task.hints.tags,
      provenance: task.hints.provenance.map((entry) => ({
        ...entry,
        field: entry.field === "taskClass" ? "taskClassHint" : entry.field
      }))
    }
  });
}

const TaskEnvelopeTaskClassHints = new Set<TaskClass>([
  "read_only",
  "small_edit",
  "engineering",
  "high_risk",
  "release_external_action"
]);

function toTaskEnvelopeTaskClassHint(
  value: string | undefined
): TaskClass | undefined {
  if (value === undefined || !TaskEnvelopeTaskClassHints.has(value as TaskClass)) {
    return undefined;
  }

  return value as TaskClass;
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
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z"
  };
}

function createHighRiskGovernanceStateWithTwoExecutionFailures(taskId: string): GovernanceState {
  return {
    ...createLowRiskGovernanceState(taskId),
    risk: {
      entanglement: 0.6,
      entropy: 0.7,
      failureCost: 0.8,
      reversibility: 0.3,
      contextPressure: 0.5,
      historicalTrust: 0.4,
      globalCoherence: 0.6,
      finalRiskLevel: "high"
    },
    latestCheckpointId: "checkpoint:provider-runner-before-third-failure",
    anomalies: [
      {
        anomalyId: "anomaly:provider-runner:pre1",
        taskId,
        kind: "execution_failure",
        message: "first controlled provider failure",
        strikeNumber: 1,
        createdAt: "2026-06-10T00:10:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: "anomaly:provider-runner:pre2",
        taskId,
        kind: "execution_failure",
        message: "second controlled provider failure",
        strikeNumber: 2,
        createdAt: "2026-06-10T00:20:00.000Z",
        evidenceRefs: []
      }
    ]
  };
}

function createRecoveryRequiredGovernanceState(taskId: string): GovernanceState {
  const state = createHighRiskGovernanceStateWithTwoExecutionFailures(taskId);

  return {
    ...state,
    anomalies: [
      ...state.anomalies,
      {
        anomalyId: "anomaly:provider-runner:pre3",
        taskId,
        kind: "execution_failure",
        message: "third controlled provider failure",
        strikeNumber: 3,
        createdAt: "2026-06-10T00:30:00.000Z",
        evidenceRefs: ["artifact:provider-runner-third-failure-report"]
      }
    ]
  };
}

function createCriticalRiskGovernanceState(taskId: string): GovernanceState {
  return {
    ...createLowRiskGovernanceState(taskId),
    risk: {
      entanglement: 0.8,
      entropy: 0.8,
      failureCost: 0.9,
      reversibility: 0.1,
      contextPressure: 0.8,
      historicalTrust: 0.2,
      globalCoherence: 0.4,
      finalRiskLevel: "critical"
    }
  };
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
  classification: PolicyDecision["classification"];
}> = {}): PolicyDecision {
  const sandboxProfile = overrides.sandboxProfile ?? createSandboxProfile();
  const taskId = overrides.taskId ?? "task_provider_execution_runner_001";

  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "decision_provider_execution_runner_001",
    taskId,
    ...(overrides.classification !== undefined
      ? { classification: overrides.classification }
      : {}),
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
  spawn: CodexCliProcessSpawner,
  options: {
    task?: Task;
    policyDecision?: PolicyDecision;
  } = {}
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
  const task = options.task ?? createTask();
  const policyDecision = options.policyDecision ?? createPolicyDecision({
    taskId: task.taskId
  });
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
    ...(providerExecutionPlan.taskHash !== undefined ? { taskHash: providerExecutionPlan.taskHash } : {}),
    ...(providerExecutionPlan.principalId !== undefined ? { principalId: providerExecutionPlan.principalId } : {}),
    ...(providerExecutionPlan.principalHash !== undefined ? { principalHash: providerExecutionPlan.principalHash } : {}),
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

function createRunnerRealExecutionGuard(
  manifest: ProviderManifest,
  options: {
    omitPreflightArtifactBinding?: boolean;
    preflightArtifactRef?: string;
    preflightArtifactHash?: string;
  } = {}
): Record<string, unknown> {
  const artifactBinding = options.omitPreflightArtifactBinding
    ? {}
    : {
        artifactRef: options.preflightArtifactRef ?? createRunnerPreflightArtifactRef(manifest),
        artifactHash: options.preflightArtifactHash ?? createRunnerPreflightArtifactHash(manifest)
      };

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
      ...artifactBinding,
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

function createRunnerPreflightArtifactRef(manifest: ProviderManifest): string {
  return `artifact://controlled-readonly-provider-execution/preflight/${manifest.providerId}`;
}

function createRunnerPreflightArtifactHash(manifest: ProviderManifest): string {
  return hashProviderExecutionPlannerObject({
    schemaVersion: "controlled-readonly-provider-execution-preflight.v1",
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
      blockingReasonCount: 0
    }
  });
}

class FakeCodexCliStream extends EventEmitter {
  setEncoding(_encoding: BufferEncoding): void {}
  destroy(): void {}
}

class FakeCodexCliWritableStream {
  end(_chunk?: string): void {}
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
