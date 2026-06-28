import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import type { CodexCliProcessSpawner } from "../packages/codex-cli-host/src/index.js";
import {
  dispatchFormalReadOnlyRunnerResultToProvider,
  dispatchReadOnlyProviderPlan,
  dispatchReadOnlyRunnerResultToProvider,
  dispatchToHost
} from "../packages/host-dispatcher/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";
import {
  CodexCliExecutorProvider,
  codexCliProviderManifest,
  type CodexCliProviderRealExecutionGuard
} from "../packages/providers/codex-cli/src/index.js";
import { createProviderRegistry, type ProviderRegistry } from "../packages/provider-registry/src/index.js";
import {
  hashProviderManifest,
  ProviderManifestSchema,
  type ExecutionPlanInput
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

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));
const now = "2026-06-14T00:00:00.000Z";

test("host dispatcher blocks codex-cli routing without verified runner result", async () => {
  let spawned = false;

  const result = await dispatchToHost(({
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn should not be called");
      }
    }
  } as unknown) as Parameters<typeof dispatchToHost>[0]);

  assert.equal(result.hostRoute, "codex-cli");
  assert.equal(result.cliError, "host_dispatcher_requires_verified_runner_result");
  assert.equal(spawned, false);
});

test("host dispatcher allows codex-cli routing with ready runner result", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createReadOnlyTask("host-dispatcher-verified");
  const runnerResult = await runDesktopDecision({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    now: () => "2026-06-11T00:00:00.000Z"
  });
  let spawned = false;

  assert.equal(runnerResult.status, "ready");
  assert.equal(runnerResult.preflight.ok, true);

  const result = await dispatchToHost({
    runnerResult,
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn sentinel");
      }
    }
  });

  assert.equal(result.hostRoute, "codex-cli");
  assert.equal(spawned, true);
  assert.equal(result.cliRun?.error, "spawn sentinel");
});

for (const [caseName, thrownValue] of [
  ["object", {}],
  ["undefined", undefined]
] as const) {
  test(`host dispatcher normalizes opaque ${caseName} codex-cli spawn errors`, async () => {
    const policy = await loadPolicyFromFile(policyPath);
    const task = createReadOnlyTask(`host-dispatcher-opaque-${caseName}`);
    const runnerResult = await runDesktopDecision({
      task,
      policy,
      preflight: {
        authAvailable: true,
        availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
      },
      now: () => "2026-06-11T00:00:00.000Z"
    });

    assert.equal(runnerResult.status, "ready");

    const result = await dispatchToHost({
      runnerResult,
      codexCliOptions: {
        skipExecutionModelProbe: true,
        spawn: () => {
          throw thrownValue;
        }
      }
    });

    assert.equal(result.hostRoute, "codex-cli");
    assert.equal(result.cliRun?.error, "unknown_execution_error");
    assert.notEqual(result.cliRun?.error, "[object Object]");
    assert.notEqual(result.cliRun?.error, "undefined");
  });
}

test("host dispatcher builds codex-cli plan from verified runner result only", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createReadOnlyTask("host-dispatcher-runner-source");
  const runnerResult = await runDesktopDecision({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    now: () => "2026-06-11T00:00:00.000Z"
  });
  const untrustedTask = createReadOnlyTask("host-dispatcher-untrusted-task");
  let spawned = false;

  assert.equal(runnerResult.status, "ready");

  const result = await dispatchToHost({
    runnerResult,
    task: untrustedTask,
    decision: {
      ...runnerResult.decision,
      taskId: untrustedTask.taskId
    },
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn sentinel");
      }
    }
  } as Parameters<typeof dispatchToHost>[0] & {
    task: typeof untrustedTask;
    decision: typeof runnerResult.decision;
  });

  assert.equal(result.hostRoute, "codex-cli");
  assert.equal(spawned, true);
  assert.equal(result.cliPlan?.task.taskId, runnerResult.task.taskId);
  assert.equal(
    result.cliPlan?.task.intent.requestedAction,
    runnerResult.task.intent.requestedAction
  );
  assert.notEqual(result.cliPlan?.task.taskId, untrustedTask.taskId);
});

test("host dispatcher preserves ready desktop routing", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createEngineeringTask("host-dispatcher-desktop");
  const runnerResult = await runDesktopDecision({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "shell_command",
        "apply_patch",
        "read_thread_terminal",
        "send_input"
      ],
      memoryOverview: {
        adapterStatus: {
          codexMcp: "disabled"
        },
        summary: {
          rejected: 0
        },
        shadowSync: {
          reconcileCount: 0
        },
        recall: {
          available: true,
          status: "active"
        }
      }
    },
    now: () => "2026-06-11T00:00:00.000Z"
  });
  let spawned = false;

  assert.equal(runnerResult.status, "ready");
  assert.equal(runnerResult.decision.hostRoute, "desktop");

  const result = await dispatchToHost({
    runnerResult,
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn should not be called");
      }
    }
  });

  assert.equal(result.hostRoute, "desktop");
  assert.equal(result.cliPlan, undefined);
  assert.equal(result.cliRun, undefined);
  assert.equal(result.cliError, undefined);
  assert.equal(spawned, false);
});

test("host dispatcher read-only provider dispatch creates permit and uses fake in-memory execution", async () => {
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now)
  });
  const plan = provider.planExecution(createProviderExecutionInput({
    taskId: "task_host_dispatcher_readonly_provider",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));

  const result = await dispatchReadOnlyProviderPlan({
    provider,
    plan,
    now
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.permit?.status, "approved");
  assert.equal(result.permit?.planId, plan.planId);
  assert.equal(result.permitId, result.permit?.permitId);
  assert.equal(result.eventCount, 0);
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("args"), false);
  assert.equal(serialized.includes("stdout"), false);
  assert.equal(serialized.includes("stderr"), false);
});

test("host dispatcher read-only provider dry run does not spawn", async () => {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now),
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const plan = provider.planExecution(createProviderExecutionInput({
    taskId: "task_host_dispatcher_readonly_provider_dry_run",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));

  const result = await dispatchReadOnlyProviderPlan({
    provider,
    plan,
    now,
    dryRun: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "dry_run");
  assert.equal(spawnCalls, 0);
  assert.equal(result.permit?.status, "approved");
});

test("host dispatcher rejects workspace-write provider dispatch before spawn", async () => {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now),
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const plan = provider.planExecution(createProviderExecutionInput({
    taskId: "task_host_dispatcher_workspace_write_provider",
    taskClass: "small_edit",
    sandboxMode: "workspace-write"
  }));

  const result = await dispatchReadOnlyProviderPlan({
    provider,
    plan,
    now
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(spawnCalls, 0);
  assert.equal(result.permit, undefined);
  assert.equal(result.error?.code, "host_dispatcher_provider_plan_invalid");
  assert.ok(result.blockingReasons?.includes(
    "codex_cli_workspace_write_smoke_requires_clean_worktree"
  ));
});

test("host dispatcher rejects invalid provider plans before permit issuance", async () => {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now),
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const plan = provider.planExecution(createProviderExecutionInput({
    taskId: "task_host_dispatcher_invalid_provider_plan",
    taskClass: "read_only",
    sandboxMode: "read-only"
  }));
  const invalidPlan = {
    ...plan,
    metadata: {}
  };

  const result = await dispatchReadOnlyProviderPlan({
    provider,
    plan: invalidPlan,
    now
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.permit, undefined);
  assert.equal(spawnCalls, 0);
  assert.equal(result.error?.code, "host_dispatcher_provider_plan_invalid");
});

test("host dispatcher dispatches ready read-only runner results through provider permits", async () => {
  const runnerResult = await createReadOnlyRunnerResult("host-dispatcher-runner-provider-success");
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now)
  });

  const result = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    now
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.taskId, runnerResult.task.taskId);
  assert.equal(result.decisionId, runnerResult.decision.decisionId);
  assert.equal(result.providerId, "codex-cli");
  assert.equal(result.sideEffectClass, "read_only");
  assert.equal(result.sandbox, "read-only");
  assert.equal(result.permit?.status, "approved");
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("args"), false);
  assert.equal(serialized.includes("stdout"), false);
  assert.equal(serialized.includes("stderr"), false);
});

test("host dispatcher validates provider registry selection before read-only runner dispatch", async () => {
  const runnerResult = await createReadOnlyRunnerResult(
    "host-dispatcher-runner-provider-registry-success"
  );
  const registry = createRegistryWithCodexCatalog();
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now)
  });

  const result = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    providerRegistry: registry,
    now
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.providerSelection?.selected, true);
  assert.equal(result.providerSelection?.providerId, "codex-cli");
  assert.equal(result.permit?.status, "approved");
  assertSafeDispatch(serialized);
});

test("host dispatcher formal read-only dispatch requires registry and metadata before spawn", async () => {
  const runnerResult = await createReadOnlyRunnerResult(
    "host-dispatcher-formal-readonly-required-fields"
  );
  const registry = createRegistryWithCodexCatalog();
  let spawnCalls = 0;
  let planCalls = 0;
  const provider = createRealModeProvider(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "",
      exitCode: 0
    });
  });
  const originalPlanExecution = provider.planExecution.bind(provider);
  provider.planExecution = ((input: ExecutionPlanInput) => {
    planCalls += 1;
    return originalPlanExecution(input);
  }) as typeof provider.planExecution;

  const missingRegistry = await dispatchFormalReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    providerRegistry: undefined,
    now,
    providerExecutionMetadata: {
      codexCliProviderRealExecutionGuard: createRealExecutionGuard()
    }
  } as unknown as Parameters<typeof dispatchFormalReadOnlyRunnerResultToProvider>[0]);
  const missingMetadata = await dispatchFormalReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    providerRegistry: registry,
    now,
    providerExecutionMetadata: undefined
  } as unknown as Parameters<typeof dispatchFormalReadOnlyRunnerResultToProvider>[0]);

  assert.equal(missingRegistry.ok, false);
  assert.equal(missingRegistry.status, "blocked");
  assert.ok(missingRegistry.blockingReasons?.includes(
    "host_dispatcher_formal_read_only_provider_registry_required"
  ));
  assert.equal(missingMetadata.ok, false);
  assert.equal(missingMetadata.status, "blocked");
  assert.ok(missingMetadata.blockingReasons?.includes(
    "host_dispatcher_formal_read_only_provider_metadata_required"
  ));
  assert.equal(planCalls, 0);
  assert.equal(spawnCalls, 0);
});

test("host dispatcher formal read-only dispatch executes only through guarded fake spawner", async () => {
  const runnerResult = await createReadOnlyRunnerResult(
    "host-dispatcher-formal-readonly-success"
  );
  const registry = createRegistryWithCodexCatalog();
  let spawnCalls = 0;
  const provider = createRealModeProvider(() => {
    spawnCalls += 1;
    return createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"formal completed\"}\n",
      exitCode: 0
    });
  });

  const result = await dispatchFormalReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    providerRegistry: registry,
    now,
    providerExecutionMetadata: {
      codexCliProviderRealExecutionGuard: createRealExecutionGuard()
    }
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(spawnCalls, 1);
  assert.equal(result.providerSelection?.selected, true);
  assert.equal(result.permit?.status, "approved");
  assert.equal(result.sideEffectClass, "read_only");
  assert.equal(result.sandbox, "read-only");
  assertSafeDispatch(serialized);
});

test("host dispatcher dry-runs read-only runner provider dispatch without spawn", async () => {
  const runnerResult = await createReadOnlyRunnerResult("host-dispatcher-runner-provider-dry-run");
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now),
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });

  const result = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult,
    provider,
    now,
    dryRun: true
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(result.status, "dry_run");
  assert.equal(result.dryRun, true);
  assert.equal(spawnCalls, 0);
  assert.equal(result.permit?.status, "approved");
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("args"), false);
  assert.equal(serialized.includes("stdout"), false);
  assert.equal(serialized.includes("stderr"), false);
});

test("host dispatcher rejects invalid runner result states before provider dispatch", async () => {
  const runnerResult = await createReadOnlyRunnerResult("host-dispatcher-runner-provider-blocked");

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      preflight: {
        ...runnerResult.preflight,
        ok: false,
        errors: ["auth_unavailable"]
      }
    },
    expectedReason: "runner_result_preflight_failed"
  });

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      status: "blocked_approval",
      approval: {
        status: "pending",
        reasons: ["approval_required"],
        gateId: "gate_test"
      }
    },
    expectedReason: "runner_result_not_ready"
  });

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      approval: {
        status: "pending",
        reasons: ["approval_required"],
        gateId: "gate_test"
      }
    },
    expectedReason: "runner_result_approval_unresolved"
  });

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      decision: {
        ...runnerResult.decision,
        hostRoute: "desktop"
      }
    },
    expectedReason: "runner_result_host_route_not_codex_cli"
  });

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      decision: {
        ...runnerResult.decision,
        execution: {
          ...runnerResult.decision.execution,
          toolAccess: "local_write"
        }
      }
    },
    expectedReason: "runner_result_tool_access_not_read_only"
  });
});

test("host dispatcher rejects invalid provider grants before spawn", async () => {
  const runnerResult = await createReadOnlyRunnerResult("host-dispatcher-runner-provider-grants");
  const decisionWithoutGrant = {
    ...runnerResult.decision
  };
  delete (decisionWithoutGrant as { providerGrant?: unknown }).providerGrant;

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      decision: decisionWithoutGrant
    },
    expectedReason: "runner_result_provider_grant_missing"
  });

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      decision: {
        ...runnerResult.decision,
        providerGrant: {
          ...runnerResult.decision.providerGrant!,
          providerId: "other-provider"
        }
      }
    },
    expectedReason: "runner_result_provider_grant_provider_mismatch"
  });

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      decision: {
        ...runnerResult.decision,
        providerGrant: {
          ...runnerResult.decision.providerGrant!,
          sideEffectClass: "workspace_write"
        }
      }
    },
    expectedReason: "runner_result_provider_grant_side_effect_not_read_only"
  });

  await assertRunnerDispatchRejected({
    runnerResult: {
      ...runnerResult,
      decision: {
        ...runnerResult.decision,
        providerGrant: {
          ...runnerResult.decision.providerGrant!,
          sandboxMode: "workspace-write"
        }
      }
    },
    expectedReason: "runner_result_provider_grant_sandbox_not_read_only"
  });
});

test("host dispatcher rejects missing registry providers before permit and execute", async () => {
  const runnerResult = await createReadOnlyRunnerResult(
    "host-dispatcher-runner-provider-registry-missing"
  );

  await assertRegistryDispatchRejected({
    runnerResult,
    providerRegistry: createProviderRegistry(),
    expectedReason: "provider_selection_provider_missing:codex-cli"
  });
});

test("host dispatcher rejects disabled registry providers before permit and execute", async () => {
  const runnerResult = await createReadOnlyRunnerResult(
    "host-dispatcher-runner-provider-registry-disabled"
  );
  const registry = createProviderRegistry();
  registry.register(ProviderManifestSchema.parse({
    ...codexCliProviderManifest,
    enabled: false
  }));

  await assertRegistryDispatchRejected({
    runnerResult,
    providerRegistry: registry,
    expectedReason: "provider_selection_provider_disabled:codex-cli"
  });
});

test("host dispatcher rejects registry manifest mismatches before permit and execute", async () => {
  const runnerResult = await createReadOnlyRunnerResult(
    "host-dispatcher-runner-provider-registry-hash-mismatch"
  );
  const registry = createProviderRegistry();
  registry.register(ProviderManifestSchema.parse({
    ...codexCliProviderManifest,
    version: "0.0.0-host-dispatcher-mismatch"
  }));

  await assertRegistryDispatchRejected({
    runnerResult,
    providerRegistry: registry,
    expectedReason: "provider_selection_manifest_hash_mismatch"
  });
});

test("host dispatcher rejects registry capability mismatches before permit and execute", async () => {
  const runnerResult = await createReadOnlyRunnerResult(
    "host-dispatcher-runner-provider-registry-capability-mismatch"
  );
  const registry = createRegistryWithCodexCatalog();
  const providerGrantWithCapabilityMismatch = {
    ...runnerResult.decision.providerGrant!,
    capabilities: [
      ...((runnerResult.decision.providerGrant as { capabilities?: string[] }).capabilities ?? []),
      "fs.read:outside-registry/**"
    ]
  };

  await assertRegistryDispatchRejected({
    runnerResult: {
      ...runnerResult,
      decision: {
        ...runnerResult.decision,
        providerGrant: providerGrantWithCapabilityMismatch
      }
    },
    providerRegistry: registry,
    expectedReason: "provider_selection_missing_capability:fs.read:outside-registry/**"
  });
});

function createReadOnlyTask(taskId: string) {
  return parseTaskEnvelope({
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "review current config",
      requestedAction: "inspect and summarize routing policy",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });
}

async function createReadOnlyRunnerResult(taskId: string) {
  const policy = await loadPolicyFromFile(policyPath);
  const runnerResult = await runDesktopDecision({
    task: createReadOnlyTask(taskId),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    },
    now: () => now
  });

  assert.equal(runnerResult.status, "ready");
  assert.equal(runnerResult.preflight.ok, true);
  assert.equal(runnerResult.approval.status, "not_required");
  assert.equal(runnerResult.decision.hostRoute, "codex-cli");
  assert.equal(runnerResult.decision.execution.toolAccess, "read_only");
  assert.equal(runnerResult.decision.providerGrant?.providerId, "codex-cli");
  assert.equal(runnerResult.decision.providerGrant?.sideEffectClass, "read_only");
  assert.equal(runnerResult.decision.providerGrant?.sandboxMode, "read-only");

  return runnerResult;
}

async function assertRunnerDispatchRejected(options: {
  runnerResult: Awaited<ReturnType<typeof createReadOnlyRunnerResult>>;
  expectedReason: string;
}): Promise<void> {
  let spawnCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now),
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });

  const result = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult: options.runnerResult,
    provider,
    now
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(spawnCalls, 0);
  assert.ok(result.blockingReasons?.includes(options.expectedReason));
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("args"), false);
  assert.equal(serialized.includes("stdout"), false);
  assert.equal(serialized.includes("stderr"), false);
}

async function assertRegistryDispatchRejected(options: {
  runnerResult: Awaited<ReturnType<typeof createReadOnlyRunnerResult>>;
  providerRegistry: ProviderRegistry;
  expectedReason: string;
}): Promise<void> {
  let spawnCalls = 0;
  let planCalls = 0;
  const provider = new CodexCliExecutorProvider({
    executionEnabled: true,
    nowMs: () => Date.parse(now),
    spawn: () => {
      spawnCalls += 1;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const originalPlanExecution = provider.planExecution.bind(provider);
  provider.planExecution = ((input: ExecutionPlanInput) => {
    planCalls += 1;
    return originalPlanExecution(input);
  }) as typeof provider.planExecution;

  const result = await dispatchReadOnlyRunnerResultToProvider({
    runnerResult: options.runnerResult,
    provider,
    providerRegistry: options.providerRegistry,
    now
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.permit, undefined);
  assert.equal(planCalls, 0);
  assert.equal(spawnCalls, 0);
  assert.equal(result.providerSelection?.selected, false);
  assert.ok(result.blockingReasons?.includes(options.expectedReason));
  assertSafeDispatch(serialized);
}

function createRegistryWithCodexCatalog(): ProviderRegistry {
  const registry = createProviderRegistry();
  registry.register(codexCliProviderManifest, {
    registeredAt: now
  });
  return registry;
}

function createRealModeProvider(
  spawn: CodexCliProcessSpawner
): CodexCliExecutorProvider {
  return new CodexCliExecutorProvider({
    executionEnabled: true,
    executionMode: "real",
    realExecutionAllowed: true,
    nowMs: () => Date.parse(now),
    timeoutMs: 1_000,
    spawn
  });
}

function createRealExecutionGuard(
  manifestHash = hashProviderManifest(codexCliProviderManifest)
): CodexCliProviderRealExecutionGuard {
  return {
    schemaVersion: "codex-cli-provider-real-execution-guard.v1",
    realExecutionAllowed: true,
    providerRegistrySelection: {
      selected: true,
      providerId: "codex-cli",
      manifestHash,
      kind: "executor",
      enabled: true
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

function assertSafeDispatch(serialized: string): void {
  for (const marker of [
    "prompt",
    "args",
    "stdout",
    "stderr",
    "execute",
    "invoke",
    "function",
    "secret",
    "token",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer",
    "raw env",
    "raw command"
  ]) {
    assert.equal(serialized.includes(marker), false, marker);
  }
}

function createProviderExecutionInput(options: {
  taskId: string;
  taskClass: "read_only" | "small_edit";
  sandboxMode: "read-only" | "workspace-write";
}): ExecutionPlanInput {
  const task = createProviderTask(options.taskId, options.taskClass);
  const sandbox = createProviderSandboxProfile(options.sandboxMode);
  const policyDecision = createProviderPolicyDecision({
    task,
    taskClass: options.taskClass,
    sandbox,
    capabilities: options.sandboxMode === "read-only"
      ? [createProviderReadScope()]
      : [createProviderReadScope(), createProviderWriteScope()]
  });
  const run = createProviderRun(task, policyDecision);

  return {
    task,
    run,
    policyDecision,
    sandboxProfile: sandbox,
    now
  };
}

function createProviderTask(
  taskId: string,
  taskClass: "read_only" | "small_edit"
): Task {
  return TaskSchema.parse({
    schemaVersion: "kernel-task.v1",
    taskId,
    source: "cli",
    title: `Host dispatcher provider ${taskClass}`,
    requestedAction: taskClass === "read_only"
      ? "inspect repository state without edits"
      : "make a bounded local workspace change",
    successCriteria: ["provider dispatch can be validated"],
    outOfScope: ["remote writes", "real Codex CLI execution"],
    repo: {
      root: "A:/codex-router",
      branch: "codex/provider-dispatch-test",
      worktreeClean: true,
      protectedBranch: false
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["host-dispatcher"]
    },
    hints: {
      taskClass,
      riskHints: [],
      tags: ["host-dispatcher-test"]
    },
    constraints: {
      requiresNetwork: false
    },
    createdAt: now
  });
}

function createProviderPolicyDecision(options: {
  task: Task;
  taskClass: "read_only" | "small_edit";
  sandbox: SandboxProfile;
  capabilities: CapabilityScope[];
}): PolicyDecision {
  const riskLevel = options.taskClass === "read_only" ? "low" : "medium";

  return PolicyDecisionSchema.parse({
    schemaVersion: "policy-decision.v1",
    decisionId: `decision_${options.task.taskId}`,
    taskId: options.task.taskId,
    policyVersion: "host-dispatcher-provider-test-policy",
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
      required: false,
      reasons: []
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

function createProviderRun(task: Task, policyDecision: PolicyDecision): Run {
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

function createProviderSandboxProfile(
  mode: "read-only" | "workspace-write"
): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_host_dispatcher_provider_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots: mode === "read-only" ? [] : ["workspace"],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function createProviderReadScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "file",
    resource: "workspace/**",
    access: "read"
  });
}

function createProviderWriteScope(): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "file",
    resource: "workspace/**",
    access: "write"
  });
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

function createEngineeringTask(taskId: string) {
  return parseTaskEnvelope({
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "implement package",
      requestedAction: "add multi-file TypeScript changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/contracts/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });
}
