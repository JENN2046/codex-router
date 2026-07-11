import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  InMemoryArtifactStore,
  type ArtifactStore
} from "../packages/artifact-store/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope, type TaskEnvelope } from "../packages/contracts/src/index.js";
import type { CodexCliProcessSpawner } from "../packages/codex-cli-host/src/index.js";
import {
  dispatchControlledWorkspaceWriteProviderPlan,
  dispatchFormalReadOnlyRunnerResultToProvider,
  dispatchReadOnlyProviderPlan,
  dispatchReadOnlyRunnerResultToProvider,
  dispatchToHost,
  prepareControlledWorkspaceWriteHostProviderDispatch
} from "../packages/host-dispatcher/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";
import {
  CodexCliExecutorProvider,
  codexCliProviderManifest,
  type CodexCliProviderRealExecutionGuard
} from "../packages/providers/codex-cli/src/index.js";
import {
  createControlledWorkspaceWriteProviderDispatchPreflight,
  recordControlledWorkspaceWriteProviderDispatchPreflightArtifact
} from "../packages/governance-internal-controlled-provider-dispatcher/src/index.js";
import { hashApprovalScope } from "../packages/governance-internal-approval-permit/src/index.js";
import type { GovernanceState } from "../packages/governance-internal-state-manager/src/index.js";
import type {
  WorkspaceWriteOperation
} from "../packages/governance-internal-workspace-write-executor/src/index.js";
import { InMemoryKernelStore } from "../packages/kernel-store/src/index.js";
import { createProviderRegistry, type ProviderRegistry } from "../packages/provider-registry/src/index.js";
import {
  hashProviderExecutionPlannerObject,
  planProviderExecution,
  type PlanProviderExecutionInput
} from "../packages/execution-planner/src/index.js";
import {
  createApprovedWorkspaceWriteProviderExecutionPermitV2,
  hashProviderManifest,
  InMemoryProviderExecutionPermitConsumptionStore,
  parseExecutorExecutionPlan,
  parseProviderManifest,
  ProviderManifestSchema,
  type ExecutionPlanInput,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderExecutionContext,
  type ProviderExecutionResult,
  type ProviderManifest,
  type WorkspaceWriteProviderExecutionPermitV2
} from "../packages/provider-core/src/index.js";
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

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));
const now = "2026-06-14T00:00:00.000Z";
const execFileAsync = promisify(execFile);
const workspaceWriteAuthorizationId =
  "operator_auth_host_dispatcher_workspace_write";

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

test("host dispatcher routes controlled workspace-write through local runner", async () => {
  const cwd = await createHostDispatcherGitRepo(
    "host-dispatcher/workspace-write-success"
  );
  const fixture = await createHostWorkspaceWriteFixture(cwd, ["tmp/host-dispatch.txt"]);
  const artifactStore = await createHostWorkspaceWriteArtifactStore(fixture);
  const consumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();

  const result = await dispatchControlledWorkspaceWriteProviderPlan({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore,
    consumptionStore,
    now: constantClock()
  });

  assert.equal(result.status, "runner_completed", result.reasons.join(","));
  assert.equal(result.runnerInvoked, true);
  assert.equal(result.executeInvoked, true);
  assert.equal(result.providerExecuteInvoked, false);
  assert.equal(result.runnerResult.status, "controlled_workspace_write_succeeded");
  assert.equal(result.runnerResult.providerExecuteInvoked, false);
  assert.equal(fixture.provider.calls.validateExecutionPlan, 1);
  assert.equal(fixture.provider.calls.execute, 0);
  assert.equal(existsSync(join(cwd, "tmp/host-dispatch.txt")), false);
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
});

test("host dispatcher prepares controlled workspace-write dispatch input", async () => {
  const cwd = await createHostDispatcherGitRepo(
    "host-dispatcher/workspace-write-prepare"
  );
  const fixture = await createHostWorkspaceWriteFixture(cwd, ["tmp/host-prepared.txt"]);
  const artifactStore = new InMemoryArtifactStore({ now: constantClock() });
  const consumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();
  const prepared = await prepareControlledWorkspaceWriteHostProviderDispatch({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore,
    consumptionStore,
    now: constantClock()
  });

  assert.equal(
    prepared.schemaVersion,
    "prepared-controlled-workspace-write-provider-dispatch.v1"
  );
  assert.equal(prepared.preflightArtifact.taskId, fixture.task.taskId);
  assert.equal(prepared.preflightArtifact.runId, fixture.run.runId);

  const result = await dispatchControlledWorkspaceWriteProviderPlan(
    prepared.dispatchInput
  );

  assert.equal(result.status, "runner_completed", result.reasons.join(","));
  assert.equal(result.providerExecuteInvoked, false);
  assert.equal(fixture.provider.calls.execute, 0);
  assert.equal(existsSync(join(cwd, "tmp/host-prepared.txt")), false);
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
});

test("host dispatcher requires controlled workspace-write preflight artifact", async () => {
  const cwd = await createHostDispatcherGitRepo(
    "host-dispatcher/workspace-write-missing-artifact"
  );
  const fixture = await createHostWorkspaceWriteFixture(cwd, ["tmp/host-dispatch.txt"]);

  const result = await dispatchControlledWorkspaceWriteProviderPlan({
    ...fixture,
    kernelStore: new InMemoryKernelStore(),
    artifactStore: new InMemoryArtifactStore({ now: constantClock() }),
    consumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    now: constantClock()
  });

  assert.equal(result.status, "dispatch_blocked");
  assert.equal(result.runnerInvoked, false);
  assert.equal(result.executeInvoked, false);
  assert.equal(result.providerExecuteInvoked, false);
  assert.ok(
    result.reasons.includes(
      "controlled_workspace_write_dispatch_preflight_artifact_store_missing"
    )
  );
  assert.equal(fixture.provider.calls.validateExecutionPlan, 0);
  assert.equal(fixture.provider.calls.execute, 0);
  assert.equal(existsSync(join(cwd, "tmp/host-dispatch.txt")), false);
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

type HostWorkspaceWriteProvider = ExecutorProvider & {
  calls: {
    planExecution: number;
    validateExecutionPlan: number;
    execute: number;
  };
};

type HostWorkspaceWriteFixture = {
  provider: HostWorkspaceWriteProvider;
  providerRegistry: ProviderRegistry;
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision;
  providerExecutionPlan: ReturnType<typeof planProviderExecution>;
  executorPlan: ExecutorExecutionPlan;
  permit: WorkspaceWriteProviderExecutionPermitV2;
  dispatchPreflight: ReturnType<typeof createControlledWorkspaceWriteProviderDispatchPreflight>;
  governanceState: GovernanceState;
  taskEnvelope: TaskEnvelope;
  workspaceRoot: string;
  operations: WorkspaceWriteOperation[];
  executionAuthorizationId: string;
};

async function createHostWorkspaceWriteFixture(
  cwd: string,
  targetFiles: string[]
): Promise<HostWorkspaceWriteFixture> {
  const provider = createHostWorkspaceWriteProvider(targetFiles);
  const providerRegistry = createHostWorkspaceWriteRegistry(provider);
  const task = createHostWorkspaceWriteTask(targetFiles);
  const principal = PrincipalSchema.parse({
    schemaVersion: "principal.v1",
    principalId: "principal_host_dispatcher_workspace_write",
    kind: "user",
    displayName: "Host Dispatcher Workspace Write Test",
    tenantId: "tenant_local_001",
    workspaceId: "workspace_codex_router_001",
    createdAt: now
  });
  const policyDecision = createHostWorkspaceWritePolicyDecision(task, targetFiles);
  const run = createHostWorkspaceWriteRun(task, policyDecision);
  const providerExecutionPlan = planProviderExecution({
    task,
    run,
    principal,
    policyDecision,
    executionEligibility: {
      status: "eligible",
      taskId: task.taskId,
      runId: run.runId,
      policyDecisionHash: hashApprovalScope(policyDecision),
      reasons: ["capability_grants_satisfied", "valid_approval_permit"],
      missingCapabilities: [],
      requiredApprovals: [],
      acceptedPermits: ["permit_host_dispatcher_workspace_write"],
      rejectedPermits: [],
      createdAt: now
    },
    providerRegistry,
    preferredProviderId: provider.manifest.providerId,
    now
  } satisfies PlanProviderExecutionInput);
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
  const branch = (await git(["branch", "--show-current"], cwd)).trim();
  const headCommit = (await git(["rev-parse", "HEAD"], cwd)).trim();
  const permit = createApprovedWorkspaceWriteProviderExecutionPermitV2({
    plan: executorPlan,
    manifest: provider.manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: workspaceWriteAuthorizationId,
    targetFiles,
    maxChangedFiles: targetFiles.length,
    maxDiffLines: Math.max(targetFiles.length, 1),
    rollbackRequired: true,
    rollback: {
      beforeCommit: headCommit
    },
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch,
      protectedBranch: false,
      worktreeClean: true,
      headCommit
    },
    issuedAt: now
  });
  const operations = targetFiles.map((path): WorkspaceWriteOperation => ({
    kind: "write",
    path,
    content: "host dispatcher controlled workspace write\n"
  }));

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
    dispatchPreflight: createControlledWorkspaceWriteProviderDispatchPreflight({
      providerExecutionPlan
    }),
    governanceState: createHostWorkspaceWriteGovernanceState(task.taskId),
    taskEnvelope: createHostWorkspaceWriteTaskEnvelope(task),
    workspaceRoot: cwd,
    operations,
    executionAuthorizationId: workspaceWriteAuthorizationId
  };
}

function createHostWorkspaceWriteProvider(
  targetFiles: string[]
): HostWorkspaceWriteProvider {
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const manifest = createHostWorkspaceWriteManifest(targetFiles);

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
        requiredCapabilities: targetFiles.map((path) => `fs.write:${path}`),
        approvalRequired: true,
        sandboxProfile: input.sandboxProfile,
        sideEffectClass: "workspace_write",
        createdAt: input.now,
        metadata: {
          controlledWorkspaceWrite: true,
          source: "host-dispatcher-test"
        }
      });
    },
    validateExecutionPlan(_plan: ExecutorExecutionPlan): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(
      _plan: ExecutorExecutionPlan,
      _context: ProviderExecutionContext
    ): ProviderExecutionResult {
      calls.execute += 1;
      throw new Error("host_dispatcher_workspace_write_provider_execute_forbidden");
    }
  };
}

function createHostWorkspaceWriteManifest(targetFiles: string[]): ProviderManifest {
  return parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: "fake-host-workspace-write-dispatcher",
    kind: "executor",
    displayName: "Fake Host Workspace Write Dispatcher Provider",
    version: "0.1.0",
    capabilities: [
      "execution.plan",
      "execution.validate",
      ...targetFiles.map((path) => `fs.write:${path}`)
    ],
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
    supportedSandboxProfiles: [createHostWorkspaceWriteSandboxProfile()],
    supportedSideEffectClasses: ["workspace_write"],
    enabled: true,
    metadata: {}
  });
}

function createHostWorkspaceWriteRegistry(
  provider: ExecutorProvider
): ProviderRegistry {
  const registry = createProviderRegistry();
  registry.register(provider.manifest, { registeredAt: now });
  registry.registerProvider(provider.manifest, provider);
  return registry;
}

function createHostWorkspaceWriteTask(targetFiles: string[]): Task {
  return TaskSchema.parse({
    schemaVersion: "kernel-task.v1",
    taskId: "task_host_dispatcher_workspace_write",
    source: "cli",
    title: "Host dispatcher controlled workspace-write",
    requestedAction: "Apply a bounded local workspace-write through host dispatch.",
    successCriteria: ["host dispatcher delegates to controlled workspace-write runner"],
    outOfScope: ["provider.execute", "real Codex CLI", "external writes"],
    repo: {
      root: "workspace",
      branch: "host-dispatcher/workspace-write",
      worktreeClean: true,
      protectedBranch: false
    },
    target: {
      branches: [],
      files: targetFiles,
      modules: ["host-dispatcher"]
    },
    hints: {
      taskClass: "small_edit",
      riskHints: ["workspace-write"],
      tags: ["host-dispatcher", "workspace-write"]
    },
    constraints: {
      requiresNetwork: false
    },
    createdAt: now
  });
}

function createHostWorkspaceWritePolicyDecision(
  task: Task,
  targetFiles: string[]
): PolicyDecision {
  return PolicyDecisionSchema.parse({
    schemaVersion: "policy-decision.v1",
    decisionId: "decision_host_dispatcher_workspace_write",
    taskId: task.taskId,
    policyVersion: "host-dispatcher-workspace-write-test-policy",
    classification: {
      taskClass: "small_edit",
      riskLevel: "medium",
      ambiguityScore: 0,
      clarificationRequired: false,
      riskFactors: ["workspace_write"]
    },
    risk: {
      level: "medium",
      factors: ["workspace_write"],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      executor: "codex-cli",
      model: "gpt-5.4-mini",
      profile: "workspace-write",
      reasoningEffort: "low",
      sandbox: createHostWorkspaceWriteSandboxProfile()
    },
    capabilities: targetFiles.map(createHostWorkspaceWriteScope),
    approval: {
      required: true,
      reasons: ["workspace_write_requires_operator_authorization"]
    },
    parallelism: {
      allowed: false,
      maxAgents: 1,
      mode: "disabled"
    },
    hostRoute: "codex-cli",
    createdAt: now,
    legacy: {
      taskClass: "small_edit",
      toolAccess: "workspace_write"
    }
  });
}

function createHostWorkspaceWriteRun(
  task: Task,
  policyDecision: PolicyDecision
): Run {
  return RunSchema.parse({
    schemaVersion: "kernel-run.v1",
    runId: "run_host_dispatcher_workspace_write",
    taskId: task.taskId,
    status: "running",
    policyDecisionId: policyDecision.decisionId,
    createdAt: now,
    updatedAt: now
  });
}

function createHostWorkspaceWriteSandboxProfile(): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_host_dispatcher_workspace_write",
    mode: "workspace-write",
    networkAccess: "none",
    writableRoots: ["workspace"],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function createHostWorkspaceWriteScope(path: string): CapabilityScope {
  return CapabilityScopeSchema.parse({
    kind: "file",
    resource: path,
    access: "write"
  });
}

function createHostWorkspaceWriteGovernanceState(taskId: string): GovernanceState {
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

function createHostWorkspaceWriteTaskEnvelope(task: Task): TaskEnvelope {
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
      repoRoot: task.repo.root,
      branch: task.repo.branch,
      worktreeClean: task.repo.worktreeClean,
      protectedBranch: task.repo.protectedBranch
    },
    target: task.target,
    constraints: {
      ...(typeof task.constraints.requiresNetwork === "boolean"
        ? { requiresNetwork: task.constraints.requiresNetwork }
        : {})
    },
    hints: {
      taskClassHint: "small_edit",
      riskHints: task.hints.riskHints,
      tags: task.hints.tags,
      provenance: []
    }
  });
}

async function createHostWorkspaceWriteArtifactStore(
  fixture: HostWorkspaceWriteFixture
): Promise<ArtifactStore> {
  const artifactStore = new InMemoryArtifactStore({ now: constantClock() });
  await recordControlledWorkspaceWriteProviderDispatchPreflightArtifact({
    artifactStore,
    dispatchPreflight: fixture.dispatchPreflight,
    providerExecutionPlan: fixture.providerExecutionPlan,
    executorPlan: fixture.executorPlan,
    policyDecision: fixture.policyDecision,
    task: fixture.task,
    run: fixture.run,
    operations: fixture.operations,
    now: constantClock()
  });
  return artifactStore;
}

function constantClock(): () => string {
  return () => now;
}

async function createHostDispatcherGitRepo(branch: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "host-dispatcher-workspace-write-"));
  await git(["init"], cwd);
  await git(["config", "user.email", "host-dispatcher@example.invalid"], cwd);
  await git(["config", "user.name", "Host Dispatcher Test"], cwd);
  await writeFile(join(cwd, "README.md"), "fixture\n", "utf8");
  await git(["add", "."], cwd);
  await git(["commit", "-m", "initial"], cwd);
  await git(["branch", "-M", "main"], cwd);
  if (branch !== "main") {
    await git(["switch", "-c", branch], cwd);
  }
  return cwd;
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

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
