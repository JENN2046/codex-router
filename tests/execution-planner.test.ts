import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileSystemProviderExecutionPlanStore,
  hashProviderExecutionPlannerObject,
  InMemoryProviderExecutionPlanStore,
  ProviderExecutionPlanSchema,
  planProviderExecution,
  type PlanProviderExecutionInput
} from "../packages/execution-planner/src/index.js";
import {
  type ExecutionEligibilityDecision
} from "../packages/execution-eligibility/src/index.js";
import {
  hashApprovalScope
} from "../packages/approval-permit/src/index.js";
import {
  ProviderRegistry
} from "../packages/provider-registry/src/index.js";
import {
  CodexCliExecutorProvider
} from "../packages/providers/codex-cli/src/index.js";
import {
  McpServerRefSchema,
  createMcpToolProviderSkeleton
} from "../packages/protocol-mcp/src/index.js";
import {
  createA2ARemoteAgentProviderSkeleton
} from "../packages/protocol-a2a/src/index.js";
import {
  parseProviderManifest,
  type ExecutionPlanInput,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderExecutionContext,
  type ProviderExecutionResult
} from "../packages/provider-core/src/index.js";
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
import { validAgentManifest } from "../packages/kernel-contracts/test-fixtures/valid-agent-manifest.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

const now = "2026-06-04T02:00:00.000Z";

test("execution planner creates a planned plan with codex-cli provider", () => {
  const registry = createRegistryWithCodex();
  const input = createPlannerInput({
    providerRegistry: registry,
    preferredProviderId: "codex-cli"
  });
  const plan = planProviderExecution(input);

  assert.equal(ProviderExecutionPlanSchema.parse(plan).planId, plan.planId);
  assert.equal(plan.status, "planned");
  assert.equal(plan.taskId, input.task.taskId);
  assert.equal(plan.runId, input.run.runId);
  assert.equal(plan.providerId, "codex-cli");
  assert.equal(plan.providerKind, "executor");
  assert.equal(plan.sideEffectClass, "read_only");
  assert.equal(plan.sandboxProfile.mode, "read-only");
  assert.equal(plan.requiredCapabilities.includes("fs.read:workspace/**"), true);
  assert.equal(plan.reasons.includes("provider_planned"), true);
  assert.match(plan.inputHash, /^[a-f0-9]{64}$/);
  assert.match(plan.policyDecisionHash, /^[a-f0-9]{64}$/);
});

test("provider execution plan store saves and filters stable snapshots", () => {
  const store = new InMemoryProviderExecutionPlanStore();
  const plan = planProviderExecution(createPlannerInput({
    preferredProviderId: "codex-cli"
  }));

  assert.deepEqual(store.savePlan(plan), plan);
  assert.deepEqual(store.getPlan(plan.planId), plan);
  assert.deepEqual(
    store.listPlans({ runId: plan.runId }).map((item) => item.planId),
    [plan.planId]
  );
  assert.deepEqual(
    store.listPlans({ status: "planned" }).map((item) => item.planId),
    [plan.planId]
  );

  const snapshot = store.listPlans()[0];
  assert.ok(snapshot);
  snapshot.reasons.push("mutated_snapshot");
  assert.equal(store.getPlan(plan.planId)?.reasons.includes("mutated_snapshot"), false);
});

test("file provider execution plan store persists plans across instances", async () => {
  const baseDir = await createExecutionPlannerTempDir();
  try {
    const first = new FileSystemProviderExecutionPlanStore({ baseDir });
    const plan = planProviderExecution(createPlannerInput({
      preferredProviderId: "codex-cli"
    }));

    first.savePlan(plan);
    const second = new FileSystemProviderExecutionPlanStore({ baseDir });

    assert.deepEqual(second.getPlan(plan.planId), plan);
    assert.deepEqual(
      second.listPlans({ taskId: plan.taskId }).map((item) => item.planId),
      [plan.planId]
    );
    assert.deepEqual(
      second.listPlans({ providerId: "codex-cli" }).map((item) => item.planId),
      [plan.planId]
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file provider execution plan store rejects duplicate ids after reload", async () => {
  const baseDir = await createExecutionPlannerTempDir();
  try {
    const plan = planProviderExecution(createPlannerInput({
      preferredProviderId: "codex-cli"
    }));
    new FileSystemProviderExecutionPlanStore({ baseDir }).savePlan(plan);

    const second = new FileSystemProviderExecutionPlanStore({ baseDir });

    assert.throws(
      () => second.savePlan(plan),
      /duplicate_provider_execution_plan_id:/
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file provider execution plan store refuses state mutation while another lock is present", async () => {
  const baseDir = await createExecutionPlannerTempDir();
  try {
    await writeFile(
      join(baseDir, ".provider-execution-plan-store.lock"),
      "{\"token\":\"held\"}\n",
      "utf8"
    );
    const plan = planProviderExecution(createPlannerInput({
      preferredProviderId: "codex-cli"
    }));
    const store = new FileSystemProviderExecutionPlanStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 60_000
    });

    assert.throws(
      () => store.savePlan(plan),
      /provider_execution_plan_store_lock_timeout:/
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file provider execution plan store does not remove a fresh lock during stale cleanup", async () => {
  const baseDir = await createExecutionPlannerTempDir();
  try {
    const lockPath = join(baseDir, ".provider-execution-plan-store.lock");
    const lockPayload = `${JSON.stringify({
      token: "fresh-owner",
      createdAt: "2999-01-01T00:00:00.000Z"
    })}\n`;
    await writeFile(lockPath, lockPayload, "utf8");
    await utimes(lockPath, new Date(0), new Date(0));
    const plan = planProviderExecution(createPlannerInput({
      preferredProviderId: "codex-cli"
    }));
    const store = new FileSystemProviderExecutionPlanStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 1
    });

    assert.throws(
      () => store.savePlan(plan),
      /provider_execution_plan_store_lock_timeout:/
    );
    assert.equal(await readFile(lockPath, "utf8"), lockPayload);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file provider execution plan store does not remove a stale-looking lock owned by a live process", async () => {
  const baseDir = await createExecutionPlannerTempDir();
  try {
    const lockPath = join(baseDir, ".provider-execution-plan-store.lock");
    const lockPayload = `${JSON.stringify({
      token: "live-owner",
      pid: process.pid,
      createdAt: "2000-01-01T00:00:00.000Z"
    })}\n`;
    await writeFile(lockPath, lockPayload, "utf8");
    await utimes(lockPath, new Date(0), new Date(0));
    const plan = planProviderExecution(createPlannerInput({
      preferredProviderId: "codex-cli"
    }));
    const store = new FileSystemProviderExecutionPlanStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 1
    });

    assert.throws(
      () => store.savePlan(plan),
      /provider_execution_plan_store_lock_timeout:/
    );
    assert.equal(await readFile(lockPath, "utf8"), lockPayload);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("execution planner emits canonical required capability scopes", () => {
  const sandboxProfile = createSandboxProfile("workspace-write");
  const policyDecision = createPolicyDecision({
    sandboxProfile,
    capabilities: [
      createReadScope(),
      createWriteScope(),
      createToolExecuteScope()
    ]
  });
  const plan = planProviderExecution(createPlannerInput({
    policyDecision,
    providerRegistry: createRegistryWithCodex(),
    preferredProviderId: "codex-cli"
  }));

  assert.deepEqual(plan.requiredCapabilities, [
    "fs.read:workspace/**",
    "fs.write:workspace/**",
    "shell.exec:pytest"
  ]);
});

test("execution planner preserves local command side effects before write sandbox", () => {
  const sandboxProfile = createSandboxProfile("workspace-write");
  const policyDecision = createPolicyDecision({
    sandboxProfile,
    capabilities: [
      createReadScope(),
      createWriteScope(),
      createToolExecuteScope()
    ]
  });
  const plan = planProviderExecution(createPlannerInput({
    policyDecision,
    preferredProviderId: "codex-cli"
  }));

  assert.equal(plan.status, "planned");
  assert.equal(plan.sandboxProfile.mode, "workspace-write");
  assert.equal(plan.sideEffectClass, "local_command");
});

test("execution planner blocks when execution eligibility is blocked", () => {
  const plan = planProviderExecution(createPlannerInput({
    executionEligibility: createEligibility({
      status: "blocked",
      reasons: ["policy_blocked"]
    }),
    preferredProviderId: "codex-cli"
  }));

  assert.equal(plan.status, "blocked");
  assert.equal(plan.providerId, "codex-cli");
  assert.ok(plan.reasons.includes("eligibility_blocked"));
  assert.ok(plan.reasons.includes("policy_blocked"));
});

test("execution planner waits when execution eligibility waits for approval", () => {
  const plan = planProviderExecution(createPlannerInput({
    executionEligibility: createEligibility({
      status: "waiting_approval",
      reasons: ["missing_capability"],
      requiredApprovals: ["approval:file:write:workspace/**"]
    }),
    preferredProviderId: "codex-cli"
  }));

  assert.equal(plan.status, "waiting_approval");
  assert.equal(plan.providerId, "codex-cli");
  assert.deepEqual(plan.requiredApprovals, ["approval:file:write:workspace/**"]);
  assert.ok(plan.reasons.includes("eligibility_waiting_approval"));
  assert.ok(plan.reasons.includes("missing_capability"));
});

test("execution planner blocks forged eligible decisions when policy requires approval", () => {
  const policyDecision = PolicyDecisionSchema.parse({
    ...createPolicyDecision(),
    approval: {
      required: true,
      reasons: ["policy_high_risk_context"]
    }
  });
  const plan = planProviderExecution(createPlannerInput({
    policyDecision,
    executionEligibility: createEligibility({
      status: "eligible",
      reasons: ["capability_grants_satisfied"],
      acceptedPermits: [],
      policyDecisionHash: hashApprovalScope(policyDecision)
    }),
    preferredProviderId: "codex-cli"
  }));

  assert.equal(plan.status, "blocked");
  assert.ok(plan.reasons.includes("eligibility_missing_policy_approval_permit"));
});

test("execution planner blocks eligibility decisions bound to another policy hash", () => {
  const plan = planProviderExecution(createPlannerInput({
    executionEligibility: createEligibility({
      policyDecisionHash: "0".repeat(64)
    }),
    preferredProviderId: "codex-cli"
  }));

  assert.equal(plan.status, "blocked");
  assert.ok(plan.reasons.includes("eligibility_policy_decision_hash_mismatch"));
});

test("execution planner blocks eligible decisions with unresolved approvals or capabilities", () => {
  const plan = planProviderExecution(createPlannerInput({
    executionEligibility: createEligibility({
      status: "eligible",
      reasons: ["valid_approval_permit"],
      missingCapabilities: ["fs.write:workspace/**"],
      requiredApprovals: ["approval:fs.write:workspace/**"],
      acceptedPermits: []
    }),
    preferredProviderId: "codex-cli"
  }));

  assert.equal(plan.status, "blocked");
  assert.ok(plan.reasons.includes("eligibility_has_unresolved_missing_capabilities"));
  assert.ok(plan.reasons.includes("eligibility_has_unresolved_required_approvals"));
  assert.ok(plan.reasons.includes("eligibility_valid_permit_without_accepted_permit"));
});

test("execution planner blocks when preferred provider is missing", () => {
  const plan = planProviderExecution(createPlannerInput({
    providerRegistry: new ProviderRegistry(),
    preferredProviderId: "missing-provider"
  }));

  assert.equal(plan.status, "blocked");
  assert.equal(plan.providerId, "missing-provider");
  assert.equal(plan.providerKind, "unknown");
  assert.ok(plan.reasons.includes("provider_not_found:missing-provider"));
});

test("execution planner blocks when preferred provider is disabled", () => {
  const registry = new ProviderRegistry();
  const provider = createA2ARemoteAgentProviderSkeleton(validAgentManifest);
  const policyDecision = createPolicyDecision({
    capabilities: [createProtectedRemoteScope()]
  });
  const task = createTask();
  const run = createRun(task, policyDecision);

  registry.registerProvider(provider.manifest, provider);

  const plan = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    executionEligibility: createEligibility({
      taskId: task.taskId,
      runId: run.runId,
      policyDecisionHash: hashApprovalScope(policyDecision)
    }),
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));

  assert.equal(plan.status, "blocked");
  assert.equal(plan.providerId, provider.manifest.providerId);
  assert.equal(plan.providerKind, "remote_agent");
  assert.equal(plan.sideEffectClass, "protected_remote");
  assert.ok(plan.reasons.includes(`provider_disabled:${provider.manifest.providerId}`));
});

test("execution planner blocks unsupported side effect classes", () => {
  const registry = new ProviderRegistry();
  const provider = createMcpProvider();

  registry.registerProvider(provider.manifest, provider);

  const plan = planProviderExecution(createPlannerInput({
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));

  assert.equal(plan.status, "blocked");
  assert.equal(plan.providerId, "mcp.local-dev");
  assert.equal(plan.sideEffectClass, "read_only");
  assert.ok(plan.reasons.includes("unsupported_side_effect_class:mcp.local-dev:read_only"));
});

test("execution planner blocks unsupported sandbox profiles", () => {
  const registry = new ProviderRegistry();
  const provider = createWorkspaceSideEffectOnlyReadOnlySandboxProvider();
  const policyDecision = createPolicyDecision({
    sandboxProfile: createSandboxProfile("workspace-write"),
    capabilities: [createWriteScope()]
  });
  const task = createTask();
  const run = createRun(task, policyDecision);

  registry.registerProvider(provider.manifest, provider);

  const plan = planProviderExecution(createPlannerInput({
    task,
    run,
    policyDecision,
    executionEligibility: createEligibility({
      taskId: task.taskId,
      runId: run.runId,
      policyDecisionHash: hashApprovalScope(policyDecision)
    }),
    providerRegistry: registry,
    preferredProviderId: provider.manifest.providerId
  }));

  assert.equal(plan.status, "blocked");
  assert.equal(plan.providerId, "fake-workspace-no-sandbox");
  assert.equal(plan.sideEffectClass, "workspace_write");
  assert.ok(plan.reasons.includes(
    "unsupported_sandbox_profile:fake-workspace-no-sandbox:sandbox_execution_planner_workspace_write"
  ));
});

test("execution planner uses a stable policyDecisionHash", () => {
  const policyDecision = createPolicyDecision();
  const reorderedPolicyDecision = PolicyDecisionSchema.parse({
    legacy: policyDecision.legacy,
    createdAt: policyDecision.createdAt,
    hostRoute: policyDecision.hostRoute,
    parallelism: policyDecision.parallelism,
    approval: policyDecision.approval,
    capabilities: policyDecision.capabilities,
    execution: {
      sandbox: policyDecision.execution.sandbox,
      reasoningEffort: policyDecision.execution.reasoningEffort,
      profile: policyDecision.execution.profile,
      model: policyDecision.execution.model,
      executor: policyDecision.execution.executor
    },
    risk: {
      clarificationRequired: policyDecision.risk.clarificationRequired,
      ambiguityScore: policyDecision.risk.ambiguityScore,
      factors: policyDecision.risk.factors,
      level: policyDecision.risk.level
    },
    policyVersion: policyDecision.policyVersion,
    taskId: policyDecision.taskId,
    decisionId: policyDecision.decisionId,
    schemaVersion: policyDecision.schemaVersion
  });
  const first = planProviderExecution(createPlannerInput({
    policyDecision,
    preferredProviderId: "codex-cli"
  }));
  const second = planProviderExecution(createPlannerInput({
    policyDecision: reorderedPolicyDecision,
    preferredProviderId: "codex-cli"
  }));

  assert.equal(first.policyDecisionHash, second.policyDecisionHash);
});

test("execution planner hash canonicalizes undefined deterministically", () => {
  assert.equal(
    hashProviderExecutionPlannerObject(undefined),
    hashProviderExecutionPlannerObject(null)
  );
  assert.equal(
    hashProviderExecutionPlannerObject([undefined]),
    hashProviderExecutionPlannerObject([null])
  );
  assert.notEqual(
    hashProviderExecutionPlannerObject([undefined]),
    hashProviderExecutionPlannerObject([])
  );
  assert.notEqual(
    hashProviderExecutionPlannerObject(Array(1)),
    hashProviderExecutionPlannerObject([])
  );
});

function createRegistryWithCodex(): ProviderRegistry {
  const registry = new ProviderRegistry();
  const provider = new CodexCliExecutorProvider();

  registry.registerProvider(provider.manifest, provider);

  return registry;
}

function createMcpProvider() {
  return createMcpToolProviderSkeleton(McpServerRefSchema.parse({
    schemaVersion: "mcp-server-ref.v1",
    serverId: "local-dev",
    transport: "stdio",
    commandRef: "mcp-command:local-dev",
    allowedTools: ["repo_search"],
    disabledTools: [],
    trustLevel: "untrusted",
    createdAt: now
  }));
}

function createPlannerInput(overrides: Partial<PlanProviderExecutionInput> = {}): PlanProviderExecutionInput {
  const task = overrides.task ?? createTask();
  const policyDecision = overrides.policyDecision ?? createPolicyDecision({
    taskId: task.taskId
  });
  const run = overrides.run ?? createRun(task, policyDecision);

  return {
    task,
    run,
    principal: overrides.principal ?? validPrincipal,
    policyDecision,
    executionEligibility: overrides.executionEligibility ?? createEligibility({
      taskId: task.taskId,
      runId: run.runId,
      policyDecisionHash: hashApprovalScope(policyDecision)
    }),
    providerRegistry: overrides.providerRegistry ?? createRegistryWithCodex(),
    ...(overrides.preferredProviderId !== undefined
      ? { preferredProviderId: overrides.preferredProviderId }
      : {}),
    now: overrides.now ?? now
  };
}

function createTask(): Task {
  return TaskSchema.parse({
    ...validTask,
    taskId: "task_execution_planner_001",
    requestedAction: "Plan provider execution without running provider runtime.",
    hints: {
      taskClass: "read_only",
      riskHints: [],
      tags: ["execution-planner"]
    }
  });
}

function createRun(task: Task, policyDecision: PolicyDecision): Run {
  return RunSchema.parse({
    ...validRun,
    runId: "run_execution_planner_001",
    taskId: task.taskId,
    policyDecisionId: policyDecision.decisionId,
    status: "queued",
    createdAt: now,
    updatedAt: now
  });
}

function createPolicyDecision(overrides: Partial<{
  taskId: string;
  sandboxProfile: SandboxProfile;
  capabilities: CapabilityScope[];
}> = {}): PolicyDecision {
  const sandboxProfile = overrides.sandboxProfile ?? createSandboxProfile("read-only");
  const taskId = overrides.taskId ?? "task_execution_planner_001";

  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "decision_execution_planner_001",
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
      taskClass: sandboxProfile.mode === "read-only" ? "read_only" : "small_edit",
      toolAccess: sandboxProfile.mode === "read-only" ? "read_only" : "local_write"
    }
  });
}

function createEligibility(
  overrides: Partial<ExecutionEligibilityDecision> = {}
): ExecutionEligibilityDecision {
  return {
    status: overrides.status ?? "eligible",
    taskId: overrides.taskId ?? "task_execution_planner_001",
    runId: overrides.runId ?? "run_execution_planner_001",
    policyDecisionHash: overrides.policyDecisionHash ?? hashApprovalScope(createPolicyDecision({
      taskId: overrides.taskId ?? "task_execution_planner_001"
    })),
    reasons: overrides.reasons ?? ["capability_grants_satisfied"],
    missingCapabilities: overrides.missingCapabilities ?? [],
    requiredApprovals: overrides.requiredApprovals ?? [],
    acceptedPermits: overrides.acceptedPermits ?? [],
    rejectedPermits: overrides.rejectedPermits ?? [],
    createdAt: overrides.createdAt ?? now
  };
}

function createSandboxProfile(
  mode: "read-only" | "workspace-write"
): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_execution_planner_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots: mode === "read-only" ? [] : ["workspace"],
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

function createWriteScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "file",
    resource: "workspace/**",
    access: "write"
  });
}

function createToolExecuteScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "tool",
    resource: "pytest",
    access: "execute"
  });
}

function createProtectedRemoteScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "external",
    resource: "protected_remote",
    access: "write"
  });
}

function createWorkspaceSideEffectOnlyReadOnlySandboxProvider(): ExecutorProvider {
  const manifest = parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: "fake-workspace-no-sandbox",
    kind: "executor",
    displayName: "Fake Workspace Executor",
    version: "0.1.0",
    capabilities: ["execution.plan"],
    requiredConfig: {
      keys: [],
      optionalKeys: []
    },
    securityBoundary: {
      isolation: "process",
      networkAccess: "none",
      filesystemAccess: "workspace-write",
      secretAccess: "none",
      notes: ["test fixture"]
    },
    supportedSandboxProfiles: [createSandboxProfile("read-only")],
    supportedSideEffectClasses: ["workspace_write"],
    enabled: true,
    metadata: {}
  });

  return {
    manifest,
    planExecution(_input: ExecutionPlanInput): ExecutorExecutionPlan {
      throw new Error("fake_provider_plan_execution_should_not_be_called");
    },
    validateExecutionPlan(_plan: ExecutorExecutionPlan): ExecutionValidationResult {
      throw new Error("fake_provider_validate_should_not_be_called");
    },
    execute(
      _plan: ExecutorExecutionPlan,
      _context: ProviderExecutionContext
    ): ProviderExecutionResult {
      throw new Error("fake_provider_execute_should_not_be_called");
    }
  };
}

async function createExecutionPlannerTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "codex-router-execution-planner-"));
}
