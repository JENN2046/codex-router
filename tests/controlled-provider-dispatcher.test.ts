import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileSystemArtifactStore,
  InMemoryArtifactStore,
  type ArtifactStore
} from "../packages/artifact-store/src/index.js";
import { hashApprovalScope } from "../packages/governance-internal-approval-permit/src/index.js";
import {
  createControlledReadOnlyProviderDispatchPreflight,
  dispatchControlledReadOnlyProviderExecution,
  recordControlledReadOnlyProviderDispatchPreflightArtifact,
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
  const artifactStore = await createArtifactStoreWithPreflight(fixture);
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore,
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

test("controlled provider dispatcher requires stored preflight artifact before runner", async () => {
  const fixture = createFixture();
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_preflight_artifact_store_missing"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher verifies stored preflight artifact payload before runner", async () => {
  const fixture = createFixture();
  await withTamperedPreflightArtifactStore(fixture, async (artifactStore) => {
    const result = await dispatchControlledReadOnlyProviderExecution({
      ...fixture,
      kernelStore: new InMemoryKernelStore(),
      artifactStore,
      now: createClock()
    });

    assert.equal(result.status, "dispatch_blocked");
    assert.equal(result.runnerInvoked, false);
    assert.equal(result.executeInvoked, false);
    assert.ok(
      result.reasons.includes(
        "controlled_readonly_dispatch_preflight_artifact_store_verification_failed:sha256_mismatch"
      )
    );
    assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
    assert.equal(fixture.provider.calls.execute, 0);
  });
});

test("controlled provider dispatcher binds stored preflight artifact metadata before runner", async () => {
  const fixture = createFixture();
  const artifactStore = await createArtifactStoreWithPreflight(fixture);
  const artifactId = (await artifactStore.listArtifacts({
    taskId: fixture.task.taskId,
    runId: fixture.run.runId,
    type: "json"
  }))[0]?.artifactId;
  if (artifactId === undefined) {
    throw new Error("preflight_artifact_fixture_missing");
  }
  await artifactStore.putArtifact({
    artifactId,
    taskId: fixture.task.taskId,
    runId: fixture.run.runId,
    type: "json",
    payload: {
      ok: true,
      note: "metadata drift fixture"
    },
    metadata: {
      controlledReadOnlyDispatchPreflight: {
        schemaVersion:
          "controlled-provider-execution-dispatch-preflight-artifact-binding.v1",
        artifactRef: fixture.dispatchPreflight.environmentPreflight.artifactRef,
        artifactHash: "0".repeat(64),
        providerExecutionPlanHash: hashProviderExecutionPlannerObject(
          fixture.providerExecutionPlan
        ),
        executorPlanHash: hashProviderExecutionPlannerObject(fixture.executorPlan),
        providerManifestHash:
          fixture.providerExecutionPlan.providerManifestHash ?? "",
        policyDecisionHash: hashProviderExecutionPlannerObject(
          fixture.policyDecision
        ),
        providerId: fixture.providerExecutionPlan.providerId,
        taskId: fixture.task.taskId,
        runId: fixture.run.runId
      }
    },
    allowOverwrite: true,
    alreadyRedacted: true
  });

  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore,
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_preflight_artifact_hash_mismatch"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher binds stored preflight artifact authorization context before runner", async () => {
  const fixture = createFixture();
  const artifactStore = await createArtifactStoreWithPreflight(fixture);
  const artifactId = (await artifactStore.listArtifacts({
    taskId: fixture.task.taskId,
    runId: fixture.run.runId,
    type: "json"
  }))[0]?.artifactId;
  if (artifactId === undefined) {
    throw new Error("preflight_artifact_fixture_missing");
  }
  await artifactStore.putArtifact({
    artifactId,
    taskId: fixture.task.taskId,
    runId: fixture.run.runId,
    type: "json",
    payload: {
      ok: true,
      note: "authorization context drift fixture"
    },
    metadata: {
      controlledReadOnlyDispatchPreflight: {
        schemaVersion:
          "controlled-provider-execution-dispatch-preflight-artifact-binding.v1",
        artifactRef: fixture.dispatchPreflight.environmentPreflight.artifactRef,
        artifactHash: fixture.dispatchPreflight.environmentPreflight.artifactHash,
        providerExecutionPlanHash: hashProviderExecutionPlannerObject(
          fixture.providerExecutionPlan
        ),
        executorPlanHash: "0".repeat(64),
        providerManifestHash: "1".repeat(64),
        policyDecisionHash: "2".repeat(64),
        providerId: fixture.providerExecutionPlan.providerId,
        taskId: fixture.task.taskId,
        runId: fixture.run.runId
      }
    },
    allowOverwrite: true,
    alreadyRedacted: true
  });

  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore,
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_preflight_artifact_executor_plan_hash_mismatch"
    )
  );
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_preflight_artifact_provider_manifest_hash_mismatch"
    )
  );
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_preflight_artifact_policy_decision_hash_mismatch"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher stores distinct preflight artifacts for same provider runs", async () => {
  const artifactStore = new InMemoryArtifactStore({ now: createClock() });
  const first = createFixture();
  const second = createFixture({
    taskId: "task_controlled_provider_dispatcher_002",
    runId: "run_controlled_provider_dispatcher_002",
    decisionId: "decision_controlled_provider_dispatcher_002"
  });

  await recordControlledReadOnlyProviderDispatchPreflightArtifact({
    artifactStore,
    dispatchPreflight: first.dispatchPreflight,
    providerExecutionPlan: first.providerExecutionPlan,
    executorPlan: first.executorPlan,
    policyDecision: first.policyDecision,
    task: first.task,
    run: first.run,
    now: createClock()
  });
  await recordControlledReadOnlyProviderDispatchPreflightArtifact({
    artifactStore,
    dispatchPreflight: second.dispatchPreflight,
    providerExecutionPlan: second.providerExecutionPlan,
    executorPlan: second.executorPlan,
    policyDecision: second.policyDecision,
    task: second.task,
    run: second.run,
    now: createClock()
  });

  const artifacts = await artifactStore.listArtifacts({ type: "json" });
  assert.equal(artifacts.length, 2);
  assert.equal(new Set(artifacts.map((artifact) => artifact.artifactId)).size, 2);
  assert.equal(
    artifacts.filter((artifact) =>
      artifact.metadata.controlledReadOnlyDispatchPreflight !== undefined
    ).length,
    2
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

test("controlled provider dispatcher blocks unsafe preflight metadata before runner", async () => {
  const fixture = createFixture();
  const dispatchPreflight = createControlledReadOnlyProviderDispatchPreflight({
    providerExecutionPlan: fixture.providerExecutionPlan,
    environmentChecks: {
      versionProbe: "raw stdout contained provider probe output"
    }
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    dispatchPreflight,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_preflight_metadata_not_sanitized"
    )
  );
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

test("controlled provider dispatcher blocks stale principal content before runner", async () => {
  const fixture = createFixture();
  const replacedPrincipal = PrincipalSchema.parse({
    ...fixture.principal,
    displayName: "Edited Principal With Same Id"
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    principal: replacedPrincipal,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes("controlled_readonly_dispatch_principal_hash_mismatch")
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks stale task envelope content before runner", async () => {
  const fixture = createFixture();
  const replacedTaskEnvelope = parseTaskEnvelope({
    ...fixture.taskEnvelope,
    intent: {
      ...fixture.taskEnvelope.intent,
      requestedAction: "Inspect a different envelope with the same task id."
    }
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    taskEnvelope: replacedTaskEnvelope,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_task_envelope_hash_mismatch"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks non-running runs before runner", async () => {
  const fixture = createFixture();
  const completedRun = RunSchema.parse({
    ...fixture.run,
    status: "succeeded",
    completedAt: now
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    run: completedRun,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes("controlled_readonly_dispatch_run_not_running:succeeded")
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks provider plans requiring approvals before runner", async () => {
  const fixture = createFixture();
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse({
    ...fixture.providerExecutionPlan,
    requiredApprovals: ["approval:manual-review"]
  });
  const executorPlan = parseExecutorExecutionPlan({
    ...fixture.executorPlan,
    providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan)
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: executorPlan,
    manifest: fixture.provider.manifest,
    permitId: `permit-${executorPlan.planId}-provider-approvals`,
    issuedAt: now
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    providerExecutionPlan,
    executorPlan,
    permit,
    dispatchPreflight: createControlledReadOnlyProviderDispatchPreflight({
      providerExecutionPlan
    }),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_provider_plan_required_approvals_present"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks policy-derived provider plan drift before runner", async () => {
  const fixture = createFixture();
  const policyRequiringLocalCommand = PolicyDecisionSchema.parse({
    ...fixture.policyDecision,
    capabilities: [
      CapabilityScopeSchema.parse({
        kind: "process",
        resource: "codex-cli",
        access: "execute"
      })
    ]
  });
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse({
    ...fixture.providerExecutionPlan,
    policyDecisionHash: hashProviderExecutionPlannerObject(policyRequiringLocalCommand)
  });
  const executorPlan = parseExecutorExecutionPlan({
    ...fixture.executorPlan,
    providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan),
    policyDecisionHash: providerExecutionPlan.policyDecisionHash
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: executorPlan,
    manifest: fixture.provider.manifest,
    permitId: `permit-${executorPlan.planId}-policy-drift`,
    issuedAt: now
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    policyDecision: policyRequiringLocalCommand,
    providerExecutionPlan,
    executorPlan,
    permit,
    dispatchPreflight: createControlledReadOnlyProviderDispatchPreflight({
      providerExecutionPlan
    }),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_provider_plan_required_capabilities_policy_mismatch"
    )
  );
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_provider_plan_side_effect_class_policy_mismatch:read_only:local_command"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks providers missing required capabilities before runner", async () => {
  const manifestWithoutReadCapability = createFakeCodexCliManifest({
    capabilities: ["execution.plan", "execution.validate", "execution.execute"]
  });
  const fixture = createFixture({ manifest: manifestWithoutReadCapability });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes("provider_selection_missing_capability:fs.read:workspace/**")
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher accepts runtime provider entries without duplicate attestation registration", async () => {
  const fixture = createFixture();
  const providerRegistry = new ProviderRegistry();
  providerRegistry.registerProvider(fixture.provider.manifest, fixture.provider);
  const artifactStore = await createArtifactStoreWithPreflight(fixture);
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    providerRegistry,
    kernelStore: new InMemoryKernelStore(),
    artifactStore,
    now: createClock()
  });

  assert.equal(result.status, "runner_completed");
  assert.equal(result.runnerInvoked, true);
  assert.equal(result.executeInvoked, true);
});

test("controlled provider dispatcher blocks policy task and run binding drift before runner", async () => {
  const fixture = createFixture();
  const otherPolicy = PolicyDecisionSchema.parse({
    ...fixture.policyDecision,
    decisionId: "decision_controlled_provider_dispatcher_other",
    taskId: "task_controlled_provider_dispatcher_other"
  });
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse({
    ...fixture.providerExecutionPlan,
    policyDecisionHash: hashProviderExecutionPlannerObject(otherPolicy)
  });
  const executorPlan = parseExecutorExecutionPlan({
    ...fixture.executorPlan,
    providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan),
    policyDecisionHash: providerExecutionPlan.policyDecisionHash
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: executorPlan,
    manifest: fixture.provider.manifest,
    permitId: `permit-${executorPlan.planId}-policy-binding`,
    issuedAt: now
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    policyDecision: otherPolicy,
    providerExecutionPlan,
    executorPlan,
    permit,
    dispatchPreflight: createControlledReadOnlyProviderDispatchPreflight({
      providerExecutionPlan
    }),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_policy_task_mismatch:task_controlled_provider_dispatcher_other:task_controlled_provider_dispatcher_001"
    )
  );
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_run_policy_decision_mismatch:decision_controlled_provider_dispatcher_001:decision_controlled_provider_dispatcher_other"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks provider plans without manifest binding before runner", async () => {
  const fixture = createFixture();
  const providerExecutionPlan = ProviderExecutionPlanSchema.parse({
    ...fixture.providerExecutionPlan,
    providerManifestHash: undefined
  });
  const executorPlan = parseExecutorExecutionPlan({
    ...fixture.executorPlan,
    providerExecutionPlanHash: hashProviderExecutionPlannerObject(providerExecutionPlan),
    providerManifestHash: undefined
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: executorPlan,
    manifest: fixture.provider.manifest,
    permitId: `permit-${executorPlan.planId}-manifestless`,
    issuedAt: now
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    providerExecutionPlan,
    executorPlan,
    permit,
    dispatchPreflight: createControlledReadOnlyProviderDispatchPreflight({
      providerExecutionPlan
    }),
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_provider_manifest_hash_required"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks stale executor plan fields before runner", async () => {
  const fixture = createFixture();
  const alteredExecutorPlan = parseExecutorExecutionPlan({
    ...fixture.executorPlan,
    taskId: "task_controlled_provider_dispatcher_other",
    runId: "run_controlled_provider_dispatcher_other",
    taskHash: "0".repeat(64),
    principalHash: "0".repeat(64),
    inputHash: "0".repeat(64)
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: alteredExecutorPlan,
    manifest: fixture.provider.manifest,
    permitId: `permit-${alteredExecutorPlan.planId}-altered`,
    issuedAt: now
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    executorPlan: alteredExecutorPlan,
    permit,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_executor_plan_task_hash_mismatch"
    )
  );
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_executor_plan_run_mismatch:run_controlled_provider_dispatcher_other:run_controlled_provider_dispatcher_001"
    )
  );
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_executor_plan_principal_hash_mismatch"
    )
  );
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_executor_plan_input_hash_mismatch"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
});

test("controlled provider dispatcher blocks stale executor approval policy before runner", async () => {
  const fixture = createFixture();
  const alteredExecutorPlan = parseExecutorExecutionPlan({
    ...fixture.executorPlan,
    metadata: {
      codexCliProvider: {
        schemaVersion: "codex-cli-provider-executor-plan.v1",
        codexCliPlan: {
          approvalPolicy: "on-request"
        }
      }
    }
  });
  const permit = createApprovedProviderExecutionPermit({
    plan: alteredExecutorPlan,
    manifest: fixture.provider.manifest,
    permitId: `permit-${alteredExecutorPlan.planId}-approval`,
    issuedAt: now
  });
  const result = await dispatchControlledReadOnlyProviderExecution({
    ...fixture,
    executorPlan: alteredExecutorPlan,
    permit,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: createClock() }),
    now: createClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_readonly_dispatch_executor_plan_requires_approval_policy_never:on-request"
    )
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

function createFixture(options: {
  manifest?: ProviderManifest;
  taskId?: string;
  runId?: string;
  decisionId?: string;
} = {}): Fixture {
  const provider = createFakeCodexCliProvider({
    ...(options.manifest !== undefined ? { manifest: options.manifest } : {})
  });
  const providerRegistry = createRegistry(provider);
  const task = createTask({
    ...(options.taskId !== undefined ? { taskId: options.taskId } : {})
  });
  const principal = PrincipalSchema.parse(validPrincipal);
  const policyDecision = createPolicyDecision(task, {
    ...(options.decisionId !== undefined ? { decisionId: options.decisionId } : {})
  });
  const run = createRun(task, policyDecision, {
    ...(options.runId !== undefined ? { runId: options.runId } : {})
  });
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

function createTask(options: {
  taskId?: string;
} = {}): Task {
  return TaskSchema.parse({
    ...validTask,
    taskId: options.taskId ?? "task_controlled_provider_dispatcher_001",
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

function createPolicyDecision(task: Task, options: {
  decisionId?: string;
} = {}): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: options.decisionId ?? "decision_controlled_provider_dispatcher_001",
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

function createRun(task: Task, policyDecision: PolicyDecision, options: {
  runId?: string;
} = {}): Run {
  return RunSchema.parse({
    ...validRun,
    runId: options.runId ?? "run_controlled_provider_dispatcher_001",
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

function createFakeCodexCliManifest(overrides: Partial<ProviderManifest> = {}): ProviderManifest {
  return parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: "codex-cli",
    kind: "executor",
    displayName: "Fake Codex CLI",
    version: "0.1.0",
    capabilities: [
      "execution.plan",
      "execution.validate",
      "execution.execute",
      "fs.read:workspace/**"
    ],
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
    metadata: {},
    ...overrides
  });
}

function createRegistry(provider: ExecutorProvider): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(provider.manifest, { registeredAt: now });
  registry.registerProvider(provider.manifest, provider);
  return registry;
}

async function createArtifactStoreWithPreflight(
  fixture: Fixture
): Promise<ArtifactStore> {
  const artifactStore = new InMemoryArtifactStore({ now: createClock() });
  await recordControlledReadOnlyProviderDispatchPreflightArtifact({
    artifactStore,
    dispatchPreflight: fixture.dispatchPreflight,
    providerExecutionPlan: fixture.providerExecutionPlan,
    executorPlan: fixture.executorPlan,
    policyDecision: fixture.policyDecision,
    task: fixture.task,
    run: fixture.run,
    now: createClock()
  });
  return artifactStore;
}

async function withTamperedPreflightArtifactStore(
  fixture: Fixture,
  callback: (artifactStore: ArtifactStore) => Promise<void>
): Promise<void> {
  const baseDir = await mkdtemp(join(tmpdir(), "codex-router-dispatcher-"));
  const artifactStore = new FileSystemArtifactStore({
    baseDir,
    now: createClock()
  });

  try {
    const artifact = await recordControlledReadOnlyProviderDispatchPreflightArtifact({
      artifactStore,
      dispatchPreflight: fixture.dispatchPreflight,
      providerExecutionPlan: fixture.providerExecutionPlan,
      executorPlan: fixture.executorPlan,
      policyDecision: fixture.policyDecision,
      task: fixture.task,
      run: fixture.run,
      now: createClock()
    });
    await writeFile(join(baseDir, artifact.artifactId, "payload"), "tampered", "utf8");
    await callback(artifactStore);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
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
