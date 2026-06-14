import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  CodexCliExecutorProvider,
  codexCliProviderManifest
} from "../packages/providers/codex-cli/src/index.js";
import {
  type CodexCliProcessSpawner
} from "../packages/codex-cli-host/src/index.js";
import {
  ProviderManifestSchema,
  hashProviderManifest,
  providerSupportsSandboxProfile,
  providerSupportsSideEffectClass,
  type ExecutionPlanInput,
  type ExecutorExecutionPlan,
  type ProviderExecutionPermit
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

const now = "2026-06-04T00:00:00.000Z";

test("codex cli provider manifest is valid", () => {
  const manifest = ProviderManifestSchema.parse(codexCliProviderManifest);

  assert.equal(manifest.providerId, "codex-cli");
  assert.equal(manifest.kind, "executor");
  assert.equal(providerSupportsSideEffectClass(manifest, "read_only"), true);
  assert.equal(providerSupportsSideEffectClass(manifest, "workspace_write"), true);
  assert.equal(providerSupportsSideEffectClass(manifest, "local_command"), true);
  assert.equal(providerSupportsSideEffectClass(manifest, "protected_remote"), false);
  assert.equal(providerSupportsSideEffectClass(manifest, "external_side_effects"), false);
  assert.equal(providerSupportsSandboxProfile(manifest, createSandboxProfile("read-only")), true);
  assert.equal(providerSupportsSandboxProfile(manifest, createSandboxProfile("workspace-write")), true);
});

test("codex cli provider creates a read-only plan without storing the prompt", () => {
  const provider = new CodexCliExecutorProvider();
  const input = createExecutionInput({
    taskId: "task_codex_cli_provider_readonly",
    taskClass: "read_only",
    sandboxMode: "read-only"
  });

  const plan = provider.planExecution(input);
  const validation = provider.validateExecutionPlan(plan);
  const metadata = readProviderMetadata(plan);

  assert.equal(plan.providerId, "codex-cli");
  assert.equal(plan.sideEffectClass, "read_only");
  assert.equal(plan.sandboxProfile.mode, "read-only");
  assert.match(plan.inputHash, /^[a-f0-9]{64}$/);
  assert.equal("prompt" in metadata, false);
  assert.equal("prompt" in metadata.codexCliPlan, false);
  assert.equal(metadata.codexCliPlan.promptOmitted, true);
  assert.equal(
    metadata.codexCliPlan.argsWithoutPrompt.some((arg: string) => arg.includes("Task envelope:")),
    false
  );
  assert.deepEqual(validation, {
    valid: true,
    reasons: []
  });
});

test("codex cli provider echoes supplied execution inputHash", () => {
  const provider = new CodexCliExecutorProvider();
  const inputHash = "a".repeat(64);
  const plan = provider.planExecution({
    ...createExecutionInput({
      taskId: "task_codex_cli_provider_supplied_input_hash",
      taskClass: "read_only",
      sandboxMode: "read-only"
    }),
    inputHash
  });

  assert.equal(plan.inputHash, inputHash);
  assert.equal(provider.validateExecutionPlan(plan).valid, true);
});

test("codex cli workspace-write plan requires a workspace-write policy decision", () => {
  const provider = new CodexCliExecutorProvider();
  const task = createTask({
    taskId: "task_codex_cli_provider_write",
    taskClass: "small_edit"
  });
  const requestedSandbox = createSandboxProfile("workspace-write");
  const readOnlyPolicy = createPolicyDecision({
    task,
    taskClass: "read_only",
    sandbox: createSandboxProfile("read-only"),
    capabilities: [createReadScope()]
  });
  const readOnlyRun = createRun(task, readOnlyPolicy);

  assert.throws(
    () => provider.planExecution({
      task,
      run: readOnlyRun,
      policyDecision: readOnlyPolicy,
      sandboxProfile: requestedSandbox,
      now
    }),
    /codex_cli_provider_policy_disallows_workspace_write/
  );

  const writePolicy = createPolicyDecision({
    task,
    taskClass: "small_edit",
    sandbox: requestedSandbox,
    capabilities: [createReadScope(), createWriteScope()]
  });
  const writeRun = createRun(task, writePolicy);
  const plan = provider.planExecution({
    task,
    run: writeRun,
    policyDecision: writePolicy,
    sandboxProfile: requestedSandbox,
    now
  });
  const validation = provider.validateExecutionPlan(plan);

  assert.equal(plan.sideEffectClass, "workspace_write");
  assert.equal(plan.sandboxProfile.mode, "workspace-write");
  assert.deepEqual(plan.requiredCapabilities, [
    "fs.read:workspace/**",
    "fs.write:workspace/**"
  ]);
  assert.equal(readProviderMetadata(plan).policyAllowsWorkspaceWrite, true);
  assert.deepEqual(validation, {
    valid: true,
    reasons: []
  });
});

test("codex cli provider enforces policy sandbox constraints before planning", () => {
  const provider = new CodexCliExecutorProvider();
  const task = createTask({
    taskId: "task_codex_cli_provider_policy_sandbox",
    taskClass: "small_edit"
  });
  const policySandbox = createSandboxProfile("workspace-write", {
    writableRoots: ["workspace/docs/**"]
  });
  const policyDecision = createPolicyDecision({
    task,
    taskClass: "small_edit",
    sandbox: policySandbox,
    capabilities: [createReadScope(), createWriteScope()]
  });
  const run = createRun(task, policyDecision);
  const plan = provider.planExecution({
    task,
    run,
    policyDecision,
    sandboxProfile: policySandbox,
    now
  });

  assert.deepEqual(plan.sandboxProfile.writableRoots, ["workspace/docs/**"]);
  assert.equal(plan.sandboxProfile.envPolicy.inheritProcessEnv, false);
  assert.deepEqual(plan.sandboxProfile.envPolicy.allowlist, []);

  const normalizedInPolicyPlan = provider.planExecution({
    task,
    run,
    policyDecision,
    sandboxProfile: createSandboxProfile("workspace-write", {
      writableRoots: ["workspace/docs/guide/../index.md"],
      envPolicy: policySandbox.envPolicy
    }),
    now
  });
  assert.deepEqual(
    normalizedInPolicyPlan.sandboxProfile.writableRoots,
    ["workspace/docs/guide/../index.md"]
  );

  assert.throws(
    () => provider.planExecution({
      task,
      run,
      policyDecision,
      sandboxProfile: createSandboxProfile("workspace-write", {
        writableRoots: ["workspace/**"],
        envPolicy: policySandbox.envPolicy
      }),
      now
    }),
    /codex_cli_provider_requested_sandbox_exceeds_policy:writableRoots/
  );

  assert.throws(
    () => provider.planExecution({
      task,
      run,
      policyDecision,
      sandboxProfile: createSandboxProfile("workspace-write", {
        writableRoots: ["workspace/docs/../secrets"],
        envPolicy: policySandbox.envPolicy
      }),
      now
    }),
    /codex_cli_provider_requested_sandbox_exceeds_policy:writableRoots/
  );

  assert.throws(
    () => provider.planExecution({
      task,
      run,
      policyDecision,
      sandboxProfile: createSandboxProfile("workspace-write", {
        networkAccess: "restricted",
        writableRoots: policySandbox.writableRoots,
        envPolicy: policySandbox.envPolicy
      }),
      now
    }),
    /codex_cli_provider_requested_sandbox_exceeds_policy:networkAccess/
  );

  assert.throws(
    () => provider.planExecution({
      task,
      run,
      policyDecision,
      sandboxProfile: createSandboxProfile("workspace-write", {
        writableRoots: policySandbox.writableRoots,
        envPolicy: {
          inheritProcessEnv: false,
          allowlist: ["EXTRA_TOKEN"]
        }
      }),
      now
    }),
    /codex_cli_provider_requested_sandbox_exceeds_policy:envPolicy/
  );
});

test("codex cli provider classifies command plans as local command before write sandbox", () => {
  const provider = new CodexCliExecutorProvider();
  const task = createTask({
    taskId: "task_codex_cli_provider_write_command",
    taskClass: "engineering"
  });
  const sandbox = createSandboxProfile("workspace-write");
  const policyDecision = createPolicyDecision({
    task,
    taskClass: "engineering",
    sandbox,
    capabilities: [
      createReadScope(),
      createWriteScope(),
      createToolExecuteScope()
    ]
  });
  const run = createRun(task, policyDecision);
  const plan = provider.planExecution({
    task,
    run,
    policyDecision,
    sandboxProfile: sandbox,
    now
  });
  const validation = provider.validateExecutionPlan(plan);

  assert.equal(plan.sideEffectClass, "local_command");
  assert.equal(plan.sandboxProfile.mode, "workspace-write");
  assert.equal(readProviderMetadata(plan).codexCliPlan.sandbox, "workspace-write");
  assert.deepEqual(validation, {
    valid: true,
    reasons: []
  });
});

test("codex cli provider rejects dangerous external side effects by default", () => {
  const provider = new CodexCliExecutorProvider();
  const task = createTask({
    taskId: "task_codex_cli_provider_external",
    taskClass: "release_external_action"
  });
  const sandbox = createSandboxProfile("workspace-write");
  const policyDecision = createPolicyDecision({
    task,
    taskClass: "release_external_action",
    sandbox,
    capabilities: [createProtectedRemoteScope()],
    approvalRequired: true
  });
  const run = createRun(task, policyDecision);

  assert.throws(
    () => provider.planExecution({
      task,
      run,
      policyDecision,
      sandboxProfile: sandbox,
      now
    }),
    /unsupported_side_effect_class:codex-cli:protected_remote/
  );
});

test("codex cli provider rejects direct model override", () => {
  const provider = new CodexCliExecutorProvider();
  const input = createExecutionInput({
    taskId: "task_codex_cli_provider_model_override",
    taskClass: "read_only",
    sandboxMode: "read-only",
    proposedInput: {
      planOptions: {
        model: "gpt-5.3-codex"
      }
    }
  });

  assert.throws(
    () => provider.planExecution(input),
    /codex_cli_provider_disallows_direct_model_override:model/
  );
});

test("codex cli provider validation rejects dangerous CLI args", () => {
  const provider = new CodexCliExecutorProvider();
  const plan = provider.planExecution(createExecutionInput({
    taskId: "task_codex_cli_provider_dangerous_args",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));
  const metadata = readProviderMetadata(plan);
  const tamperedPlan = {
    ...plan,
    metadata: {
      ...plan.metadata,
      codexCliProvider: {
        ...metadata,
        codexCliPlan: {
          ...metadata.codexCliPlan,
          argsWithoutPrompt: [
            ...metadata.codexCliPlan.argsWithoutPrompt,
            "--full-auto"
          ]
        }
      }
    }
  } as ExecutorExecutionPlan;
  const validation = provider.validateExecutionPlan(tamperedPlan);

  assert.equal(validation.valid, false);
  assert.ok(validation.reasons.includes(
    "codex_cli_dangerous_arg_not_allowed:--full-auto"
  ));
});

test("codex cli provider execute is disabled by default", async () => {
  const provider = new CodexCliExecutorProvider();
  const plan = provider.planExecution(createExecutionInput({
    taskId: "task_codex_cli_provider_execute_disabled",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));

  await assert.rejects(
    async () => provider.execute(plan, {}),
    /codex_cli_provider_execute_disabled/
  );
});

test("codex cli provider read-only execute rejects without injected spawn", async () => {
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true
  });
  const plan = provider.planExecution(createExecutionInput({
    taskId: "task_codex_cli_provider_execute_no_spawn",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));

  const result = await provider.execute(plan, {
    permit: createApprovedPermitForPlan(plan)
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.error?.code,
    "codex_cli_provider_execute_requires_injected_spawn"
  );
  assert.deepEqual(result.error?.reasons, [
    "codex_cli_provider_execute_requires_injected_spawn"
  ]);
});

test("codex cli provider dry run does not spawn and returns sanitized summary", async () => {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn: () => {
      spawnCalls += 1;
      throw new Error("spawn must not run during dry run");
    }
  });
  const plan = provider.planExecution(createExecutionInput({
    taskId: "task_codex_cli_provider_execute_dry_run",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));

  const result = await provider.execute(plan, {
    dryRun: true
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(spawnCalls, 0);
  assert.equal(result.artifacts?.[0]?.metadata.summaryKind, "codex-cli-provider-dry-run");
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("args"), false);
  assert.equal(serialized.includes("stdout"), false);
  assert.equal(serialized.includes("stderr"), false);
});

test("codex cli provider non-dry-run execute requires a permit before spawn", async () => {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const plan = provider.planExecution(createExecutionInput({
    taskId: "task_codex_cli_provider_execute_permit_required",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));

  const result = await provider.execute(plan, {});

  assert.equal(result.ok, false);
  assert.equal(spawnCalls, 0);
  assert.equal(result.error?.code, "codex_cli_provider_execution_permit_required");
  assert.deepEqual(result.error?.reasons, [
    "codex_cli_provider_execution_permit_required"
  ]);
});

test("codex cli provider execute rejects unapproved permits before spawn", async () => {
  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_permit_candidate",
    mutatePermit: (permit) => ({
      ...permit,
      status: "candidate"
    }),
    expectedReason: "codex_cli_provider_execution_permit_not_approved:candidate"
  });

  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_permit_blocked",
    mutatePermit: (permit) => ({
      ...permit,
      status: "blocked"
    }),
    expectedReason: "codex_cli_provider_execution_permit_not_approved:blocked"
  });
});

test("codex cli provider execute rejects mismatched permits before spawn", async () => {
  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_provider_mismatch",
    mutatePermit: (permit) => ({
      ...permit,
      providerId: "other-provider"
    }),
    expectedReasonPrefix: "codex_cli_provider_execution_permit_provider_mismatch:"
  });

  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_task_mismatch",
    mutatePermit: (permit) => ({
      ...permit,
      taskId: "task_other"
    }),
    expectedReasonPrefix: "codex_cli_provider_execution_permit_task_mismatch:"
  });

  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_plan_mismatch",
    mutatePermit: (permit) => ({
      ...permit,
      planId: "plan_other"
    }),
    expectedReasonPrefix: "codex_cli_provider_execution_permit_plan_mismatch:"
  });

  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_side_effect_mismatch",
    mutatePermit: (permit) => ({
      ...permit,
      sideEffectClass: "workspace_write"
    }),
    expectedReasonPrefix: "codex_cli_provider_execution_permit_side_effect_mismatch:"
  });

  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_sandbox_mismatch",
    mutatePermit: (permit) => ({
      ...permit,
      sandboxProfileId: "sandbox_other"
    }),
    expectedReasonPrefix: "codex_cli_provider_execution_permit_sandbox_mismatch:"
  });
});

test("codex cli provider execute rejects manifest and policy permit mismatches before spawn", async () => {
  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_manifest_mismatch",
    mutatePermit: (permit) => ({
      ...permit,
      providerManifestHash: "b".repeat(64)
    }),
    expectedReason: "codex_cli_provider_execution_permit_manifest_mismatch"
  });

  await assertPermitRejection({
    taskId: "task_codex_cli_provider_execute_policy_mismatch",
    mutatePermit: (permit) => ({
      ...permit,
      policyDecisionHash: "policy_hash_other"
    }),
    expectedReason: "codex_cli_provider_execution_permit_policy_mismatch"
  });
});

test("codex cli provider read-only execute succeeds with approved permit and fake spawn", async () => {
  let spawnCalls = 0;
  const spawn: CodexCliProcessSpawner = () => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"completed\"}\n",
      exitCode: 0
    });
  };
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn
  });
  const plan = provider.planExecution(createExecutionInput({
    taskId: "task_codex_cli_provider_execute_fake_spawn_success",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));

  const result = await provider.execute(plan, {
    permit: createApprovedPermitForPlan(plan)
  });
  const summary = result.artifacts?.[0]?.metadata.summary as any;
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(spawnCalls, 1);
  assert.equal(summary.status, "completed");
  assert.equal(summary.inspection.status, "completed");
  assert.equal(summary.inspection.eventCount, 1);
  assert.equal(summary.exitCode, 0);
  assert.equal(serialized.includes("agent_message"), false);
  assert.equal(serialized.includes("requestedAction"), false);
  assert.equal(serialized.includes("args"), false);
  assert.equal(serialized.includes("stdout"), false);
  assert.equal(serialized.includes("stderr"), false);
  assert.equal(serialized.includes("prompt"), false);
});

test("codex cli provider execute rejects workspace-write plans before spawn", async () => {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const plan = provider.planExecution(createExecutionInput({
    taskId: "task_codex_cli_provider_execute_workspace_write_rejected",
    taskClass: "small_edit",
    sandboxMode: "workspace-write"
  }));

  const result = await provider.execute(plan, {});

  assert.equal(result.ok, false);
  assert.equal(spawnCalls, 0);
  assert.ok((result.error?.reasons as string[]).includes(
    "codex_cli_provider_execute_only_supports_read_only"
  ));
});

test("codex cli provider execute rejects invalid plans before spawn", async () => {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const plan = provider.planExecution(createExecutionInput({
    taskId: "task_codex_cli_provider_execute_invalid_plan",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));
  const invalidPlan = {
    ...plan,
    providerId: "other-provider"
  } as ExecutorExecutionPlan;

  const result = await provider.execute(invalidPlan, {});

  assert.equal(result.ok, false);
  assert.equal(spawnCalls, 0);
  assert.equal(result.error?.code, "codex_cli_provider_execution_plan_invalid");
  assert.ok((result.error?.reasons as string[]).some((reason) => (
    reason.startsWith("codex_cli_provider_id_mismatch:")
  )));
});

function createExecutionInput(options: {
  taskId: string;
  taskClass: "read_only" | "small_edit" | "engineering" | "high_risk" | "release_external_action";
  sandboxMode: "read-only" | "workspace-write";
  proposedInput?: unknown;
}): ExecutionPlanInput {
  const task = createTask({
    taskId: options.taskId,
    taskClass: options.taskClass
  });
  const sandbox = createSandboxProfile(options.sandboxMode);
  const policyDecision = createPolicyDecision({
    task,
    taskClass: options.taskClass,
    sandbox,
    capabilities: options.sandboxMode === "read-only"
      ? [createReadScope()]
      : [createReadScope(), createWriteScope()]
  });
  const run = createRun(task, policyDecision);
  const input: ExecutionPlanInput = {
    task,
    run,
    policyDecision,
    sandboxProfile: sandbox,
    now
  };

  if (options.proposedInput !== undefined) {
    input.proposedInput = options.proposedInput;
  }

  return input;
}

function createTask(options: {
  taskId: string;
  taskClass: "read_only" | "small_edit" | "engineering" | "high_risk" | "release_external_action";
}): Task {
  return TaskSchema.parse({
    schemaVersion: "kernel-task.v1",
    taskId: options.taskId,
    source: "cli",
    title: `Codex CLI provider ${options.taskClass}`,
    requestedAction: options.taskClass === "read_only"
      ? "inspect repository state without edits"
      : "make a bounded local workspace change",
    successCriteria: ["provider plan can be validated"],
    outOfScope: ["remote writes", "real Codex CLI execution"],
    repo: {
      root: "A:/codex-router",
      branch: "codex/provider-test",
      worktreeClean: true,
      protectedBranch: false
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-provider"]
    },
    hints: {
      taskClass: options.taskClass,
      riskHints: [],
      tags: ["provider-test"]
    },
    constraints: {
      requiresNetwork: false
    },
    createdAt: now
  });
}

function createPolicyDecision(options: {
  task: Task;
  taskClass: "read_only" | "small_edit" | "engineering" | "high_risk" | "release_external_action";
  sandbox: SandboxProfile;
  capabilities: CapabilityScope[];
  approvalRequired?: boolean;
}): PolicyDecision {
  const riskLevel = options.taskClass === "read_only" ? "low" : "medium";

  return PolicyDecisionSchema.parse({
    schemaVersion: "policy-decision.v1",
    decisionId: `decision_${options.task.taskId}`,
    taskId: options.task.taskId,
    policyVersion: "codex-cli-provider-test-policy",
    classification: {
      taskClass: options.taskClass,
      riskLevel,
      ambiguityScore: 0,
      clarificationRequired: false,
      riskFactors: []
    },
    risk: {
      level: riskLevel,
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      executor: "codex-cli",
      model: "gpt-5.4-mini",
      profile: options.taskClass === "read_only" ? "recon-only" : "engineering",
      reasoningEffort: "medium",
      sandbox: options.sandbox
    },
    capabilities: options.capabilities,
    approval: {
      required: options.approvalRequired ?? false,
      reasons: options.approvalRequired ? ["test_approval_required"] : []
    },
    parallelism: {
      allowed: false,
      maxAgents: 1,
      mode: "disabled"
    },
    hostRoute: "codex-cli",
    createdAt: now,
    legacy: {
      taskClass: options.taskClass,
      toolAccess: options.sandbox.mode === "read-only"
        ? "read_only"
        : "local_write"
    }
  });
}

function createRun(task: Task, policyDecision: PolicyDecision): Run {
  return RunSchema.parse({
    schemaVersion: "kernel-run.v1",
    runId: `run_${task.taskId}`,
    taskId: task.taskId,
    status: "queued",
    policyDecisionId: policyDecision.decisionId,
    createdAt: now,
    updatedAt: now
  });
}

function createSandboxProfile(
  mode: "read-only" | "workspace-write",
  overrides: Partial<Pick<SandboxProfile, "networkAccess" | "writableRoots" | "envPolicy">> = {}
): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_codex_cli_provider_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: overrides.networkAccess ?? "none",
    writableRoots: overrides.writableRoots ?? (mode === "read-only" ? [] : ["workspace"]),
    envPolicy: overrides.envPolicy ?? {
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

function readProviderMetadata(plan: ExecutorExecutionPlan): any {
  const metadata = plan.metadata.codexCliProvider;
  assert.equal(typeof metadata, "object");
  assert.notEqual(metadata, null);
  return metadata;
}

function createApprovedPermitForPlan(
  plan: ExecutorExecutionPlan
): ProviderExecutionPermit {
  return {
    schemaVersion: "provider-execution-permit.v1",
    permitId: `permit-${plan.planId}`,
    taskId: plan.taskId,
    runId: plan.runId,
    planId: plan.planId,
    providerId: plan.providerId,
    providerManifestHash: hashProviderManifest(codexCliProviderManifest),
    ...(plan.policyDecisionHash !== undefined
      ? { policyDecisionHash: plan.policyDecisionHash }
      : {}),
    sideEffectClass: plan.sideEffectClass,
    sandboxProfileId: plan.sandboxProfile.sandboxId,
    status: "approved",
    approvalStatus: plan.approvalRequired ? "approved" : "not_required",
    reasons: [],
    issuedAt: now
  };
}

async function assertPermitRejection(options: {
  taskId: string;
  mutatePermit: (permit: ProviderExecutionPermit) => ProviderExecutionPermit;
  expectedReason?: string;
  expectedReasonPrefix?: string;
}): Promise<void> {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const plan = provider.planExecution(createExecutionInput({
    taskId: options.taskId,
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));
  const permit = options.mutatePermit(createApprovedPermitForPlan(plan));

  const result = await provider.execute(plan, {
    permit
  });

  assert.equal(result.ok, false);
  assert.equal(spawnCalls, 0);
  assert.equal(result.error?.code, "codex_cli_provider_execution_permit_invalid");
  const reasons = result.error?.reasons as string[];
  if (options.expectedReason !== undefined) {
    assert.ok(reasons.includes(options.expectedReason));
  }
  if (options.expectedReasonPrefix !== undefined) {
    assert.ok(reasons.some((reason) => (
      reason.startsWith(options.expectedReasonPrefix ?? "")
    )));
  }
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
