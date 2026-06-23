import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  ExecutorExecutionPlanSchema,
  ProviderKindSchema,
  ProviderManifestSchema,
  ToolProviderInvocationPlanSchema,
  assertProviderSupportsSandboxProfile,
  assertProviderSupportsSideEffectClass,
  InMemoryProviderExecutionPermitConsumptionStore,
  consumeProviderExecutionPermitForPlan,
  createApprovedProviderExecutionPermit,
  createApprovedWorkspaceWriteProviderExecutionPermit,
  createBlockedProviderExecutionPermit,
  createBlockedWorkspaceWriteProviderExecutionPermit,
  createProviderExecutionPermitConsumptionKey,
  hashExecutorExecutionPlan,
  hashProviderManifest,
  providerSupportsSandboxProfile,
  providerSupportsSideEffectClass,
  validateProviderExecutionPermitForPlan,
  validateWorkspaceWriteProviderExecutionPermitForPlan,
  type ExecutorExecutionPlan,
  type ProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  SandboxProfileSchema,
  type SandboxProfile
} from "../packages/kernel-contracts/src/index.js";

test("provider-core parses a valid provider manifest", () => {
  const manifest = createProviderManifest();

  assert.equal(manifest.providerId, "provider_core_executor_001");
  assert.equal(manifest.kind, "executor");
  assert.equal(manifest.securityBoundary.isolation, "process");
  assert.deepEqual(manifest.supportedSideEffectClasses, ["read_only", "workspace_write"]);
});

test("provider-core rejects invalid provider kind", () => {
  assert.throws(
    () => ProviderKindSchema.parse("codex"),
    z.ZodError
  );

  assert.throws(
    () => ProviderManifestSchema.parse({
      ...createProviderManifest(),
      kind: "codex"
    }),
    z.ZodError
  );
});

test("provider-core validates executor plans", () => {
  const plan = ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_provider_core_executor_001",
    runId: "run_provider_core_001",
    taskId: "task_provider_core_001",
    providerId: "provider_core_executor_001",
    inputHash: "a".repeat(64),
    policyDecisionHash: "policy_hash_provider_core_001",
    requiredCapabilities: ["fs.read:/repo/**"],
    approvalRequired: false,
    sandboxProfile: createSandboxProfile("read-only"),
    sideEffectClass: "read_only",
    createdAt: "2026-06-04T00:00:00.000Z",
    metadata: {}
  });

  assert.equal(plan.planId, "plan_provider_core_executor_001");
  assert.equal(plan.kind, "executor");
  assert.equal(plan.sandboxProfile.mode, "read-only");
});

test("provider-core validates provider execution permits", () => {
  const manifest = createProviderManifest();
  const plan = createExecutorPlan();
  const permit = createApprovedProviderExecutionPermit({
    plan,
    manifest,
    issuedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.equal(permit.schemaVersion, "provider-execution-permit.v1");
  assert.equal(permit.providerId, "provider_core_executor_001");
  assert.equal(permit.status, "approved");
  assert.equal(permit.approvalStatus, "not_required");
  assert.equal(permit.providerManifestHash, hashProviderManifest(manifest));
  assert.equal(permit.planHash, hashExecutorExecutionPlan(plan));
  assert.equal(permit.expiresAt, "2026-06-14T00:05:00.000Z");
  assert.equal(typeof permit.nonce, "string");
  assert.deepEqual(permit.reasons, []);
  assert.deepEqual(validateProviderExecutionPermitForPlan(
    permit,
    plan,
    manifest
  ), []);
});

test("provider-core rejects provider execution permit mismatches", () => {
  const manifest = createProviderManifest();
  const plan = createExecutorPlan();
  const permit = createApprovedProviderExecutionPermit({
    plan,
    manifest,
    issuedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    approvalStatus: "pending"
  }, plan, manifest).includes("provider_execution_permit_approval_status_must_be_not_required:pending"));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    providerId: "other-provider"
  }, plan, manifest).some((reason) => (
    reason.startsWith("provider_execution_permit_provider_mismatch:")
  )));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    taskId: "task_other"
  }, plan, manifest).some((reason) => (
    reason.startsWith("provider_execution_permit_task_mismatch:")
  )));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    planId: "plan_other"
  }, plan, manifest).some((reason) => (
    reason.startsWith("provider_execution_permit_plan_mismatch:")
  )));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    sideEffectClass: "workspace_write"
  }, plan, manifest).some((reason) => (
    reason.startsWith("provider_execution_permit_side_effect_mismatch:")
  )));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    sandboxProfileId: "sandbox_other"
  }, plan, manifest).some((reason) => (
    reason.startsWith("provider_execution_permit_sandbox_mismatch:")
  )));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    providerManifestHash: "b".repeat(64)
  }, plan, manifest).includes("provider_execution_permit_manifest_mismatch"));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    policyDecisionHash: "policy_hash_other"
  }, plan, manifest).includes("provider_execution_permit_policy_mismatch"));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    nonce: "caller_supplied_nonce"
  }, plan, manifest).includes("provider_execution_permit_nonce_mismatch"));
  assert.ok(validateProviderExecutionPermitForPlan({
    ...permit,
    consumedAt: "2026-06-14T00:01:00.000Z"
  }, plan, manifest).includes("provider_execution_permit_already_consumed"));
  assert.ok(validateProviderExecutionPermitForPlan(
    permit,
    {
      ...plan,
      metadata: {
        command: "tampered"
      }
    },
    manifest
  ).includes("provider_execution_permit_plan_hash_mismatch"));
  assert.ok(validateProviderExecutionPermitForPlan(
    permit,
    plan,
    manifest,
    { now: "2026-06-14T00:06:00.000Z" }
  ).includes("provider_execution_permit_expired"));
});

test("provider-core consumes read-only provider permits once in trusted store", () => {
  const manifest = createProviderManifest();
  const plan = createExecutorPlan();
  const permit = createApprovedProviderExecutionPermit({
    plan,
    manifest,
    issuedAt: "2026-06-14T00:00:00.000Z"
  });
  const store = new InMemoryProviderExecutionPermitConsumptionStore();
  const key = createProviderExecutionPermitConsumptionKey(permit);

  assert.deepEqual(consumeProviderExecutionPermitForPlan(
    permit,
    plan,
    manifest,
    {
      consumeIfUnused: (record) => store.consumeIfUnused(record),
      get: (consumptionKey) => store.get(consumptionKey)
    },
    {
      consumedAt: "2026-06-14T00:00:01.000Z"
    }
  ), []);
  assert.equal(store.get(key)?.permitId, permit.permitId);
  assert.equal(store.get(key)?.consumedAt, "2026-06-14T00:00:01.000Z");

  assert.deepEqual(consumeProviderExecutionPermitForPlan(
    permit,
    plan,
    manifest,
    store,
    {
      consumedAt: "2026-06-14T00:00:02.000Z"
    }
  ), ["provider_execution_permit_already_consumed_by_store"]);
});

test("provider-core store blocks caller-side consumedAt and permit id tampering", () => {
  const manifest = createProviderManifest();
  const plan = createExecutorPlan();
  const permit = createApprovedProviderExecutionPermit({
    plan,
    manifest,
    permitId: "permit_original",
    issuedAt: "2026-06-14T00:00:00.000Z"
  });
  const store = new InMemoryProviderExecutionPermitConsumptionStore();

  assert.deepEqual(consumeProviderExecutionPermitForPlan(
    permit,
    plan,
    manifest,
    store,
    {
      consumedAt: "2026-06-14T00:00:01.000Z"
    }
  ), []);

  assert.deepEqual(consumeProviderExecutionPermitForPlan(
    {
      ...permit,
      permitId: "permit_attacker_changed"
    },
    plan,
    manifest,
    store,
    {
      consumedAt: "2026-06-14T00:00:02.000Z"
    }
  ), ["provider_execution_permit_already_consumed_by_store"]);
});

test("provider-core fails closed when permit consumption store throws", () => {
  const manifest = createProviderManifest();
  const plan = createExecutorPlan();
  const permit = createApprovedProviderExecutionPermit({
    plan,
    manifest,
    issuedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.deepEqual(consumeProviderExecutionPermitForPlan(
    permit,
    plan,
    manifest,
    {
      consumeIfUnused: () => {
        throw new Error("store unavailable");
      },
      get: () => undefined
    },
    {
      consumedAt: "2026-06-14T00:00:01.000Z"
    }
  ), ["provider_execution_permit_consumption_store_failed"]);
});

test("provider-core blocks non-read-only provider execution permits", () => {
  const workspaceWritePlan = createExecutorPlan({
      sandboxProfile: createSandboxProfile("workspace-write"),
      sideEffectClass: "workspace_write"
  });
  const blocked = createBlockedProviderExecutionPermit({
    plan: workspaceWritePlan,
    manifest: createProviderManifest(),
    issuedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.reasons.includes("provider_execution_permit_read_only_only"));
  assert.ok(blocked.reasons.includes("provider_execution_permit_requires_read_only_sandbox"));
  assert.throws(
    () => createApprovedProviderExecutionPermit({
      plan: workspaceWritePlan,
      manifest: createProviderManifest(),
      issuedAt: "2026-06-14T00:00:00.000Z"
    }),
    /provider_execution_permit_not_approvable:/
  );
});

test("provider-core validates approved workspace-write governance permits", () => {
  const manifest = createProviderManifest();
  const plan = createExecutorPlan({
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write"),
    sideEffectClass: "workspace_write"
  });
  const permit = createApprovedWorkspaceWriteProviderExecutionPermit({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: "operator_auth_workspace_write_001",
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 120,
    rollbackRequired: true,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "codex/workspace-write-governance",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "abc123"
    },
    issuedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.equal(permit.schemaVersion, "provider-workspace-write-execution-permit.v1");
  assert.equal(permit.status, "approved");
  assert.equal(permit.sideEffectClass, "workspace_write");
  assert.equal(permit.sandboxMode, "workspace-write");
  assert.equal(permit.operatorAuthorizationId, "operator_auth_workspace_write_001");
  assert.deepEqual(permit.targetFiles, ["workspace/packages/provider-core/src/index.ts"]);
  assert.deepEqual(validateWorkspaceWriteProviderExecutionPermitForPlan(
    permit,
    plan,
    manifest
  ), []);
});

test("provider-core blocks workspace-write governance permits without hard gates", () => {
  const plan = createExecutorPlan({
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write"),
    sideEffectClass: "workspace_write"
  });
  const blocked = createBlockedWorkspaceWriteProviderExecutionPermit({
    plan,
    manifest: createProviderManifest(),
    approvalStatus: "pending",
    targetFiles: [
      "../outside.ts",
      "workspace/packages/provider-core/src/index.ts",
      "workspace/tests/provider-core.test.ts"
    ],
    maxChangedFiles: 1,
    maxDiffLines: 120,
    rollbackRequired: false,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "main",
      protectedBranch: true,
      worktreeClean: false
    },
    issuedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.reasons.includes("workspace_write_provider_execution_permit_approval_required"));
  assert.ok(blocked.reasons.includes("workspace_write_provider_execution_permit_operator_authorization_required"));
  assert.ok(blocked.reasons.includes("workspace_write_provider_execution_permit_target_file_count_exceeds_max"));
  assert.ok(blocked.reasons.includes("workspace_write_provider_execution_permit_target_file_out_of_bounds"));
  assert.ok(blocked.reasons.includes("workspace_write_provider_execution_permit_rollback_required"));
  assert.ok(blocked.reasons.includes("workspace_write_provider_execution_permit_protected_branch_forbidden"));
  assert.ok(blocked.reasons.includes("workspace_write_provider_execution_permit_dirty_worktree_forbidden"));
  assert.ok(validateWorkspaceWriteProviderExecutionPermitForPlan(
    blocked,
    plan,
    createProviderManifest()
  ).includes("workspace_write_provider_execution_permit_not_approved:blocked"));
});

test("provider-core rejects workspace-write governance permit mismatches", () => {
  const manifest = createProviderManifest();
  const plan = createExecutorPlan({
    approvalRequired: true,
    sandboxProfile: createSandboxProfile("workspace-write"),
    sideEffectClass: "workspace_write"
  });
  const permit = createApprovedWorkspaceWriteProviderExecutionPermit({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: "operator_auth_workspace_write_001",
    targetFiles: ["workspace/packages/provider-core/src/index.ts"],
    maxChangedFiles: 1,
    maxDiffLines: 120,
    rollbackRequired: true,
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch: "codex/workspace-write-governance",
      protectedBranch: false,
      worktreeClean: true
    },
    issuedAt: "2026-06-14T00:00:00.000Z"
  });

  assert.ok(validateWorkspaceWriteProviderExecutionPermitForPlan({
    ...permit,
    providerId: "other-provider"
  }, plan, manifest).some((reason) => (
    reason.startsWith("workspace_write_provider_execution_permit_provider_mismatch:")
  )));
  assert.ok(validateWorkspaceWriteProviderExecutionPermitForPlan({
    ...permit,
    planId: "plan_other"
  }, plan, manifest).some((reason) => (
    reason.startsWith("workspace_write_provider_execution_permit_plan_mismatch:")
  )));
  assert.ok(validateWorkspaceWriteProviderExecutionPermitForPlan({
    ...permit,
    providerManifestHash: "b".repeat(64)
  }, plan, manifest).includes("workspace_write_provider_execution_permit_manifest_mismatch"));
});

test("provider-core validates tool invocation plans", () => {
  const plan = ToolProviderInvocationPlanSchema.parse({
    schemaVersion: "tool-provider-invocation-plan.v1",
    kind: "tool",
    planId: "plan_provider_core_tool_001",
    runId: "run_provider_core_001",
    stepId: "step_provider_core_001",
    providerId: "provider_core_tool_001",
    toolId: "builtin.read_file",
    inputHash: "b".repeat(64),
    requiredCapabilities: ["fs.read:/repo/**"],
    approvalRequired: false,
    sandboxProfile: createSandboxProfile("read-only"),
    sideEffectClass: "read",
    createdAt: "2026-06-04T00:00:00.000Z",
    metadata: {}
  });

  assert.equal(plan.toolId, "builtin.read_file");
  assert.equal(plan.kind, "tool");
});

test("provider-core parses a remote agent provider manifest", () => {
  const manifest = ProviderManifestSchema.parse({
    ...createProviderManifest(),
    providerId: "provider_core_remote_agent_001",
    kind: "remote_agent",
    displayName: "Remote Agent Provider",
    securityBoundary: {
      isolation: "remote",
      networkAccess: "restricted",
      filesystemAccess: "none",
      secretAccess: "none",
      notes: ["skeleton only"]
    },
    supportedSideEffectClasses: ["protected_remote"],
    metadata: {
      authSchemes: ["bearer-ref"],
      enabledByDefault: false
    }
  });

  assert.equal(manifest.kind, "remote_agent");
  assert.deepEqual(manifest.metadata.authSchemes, ["bearer-ref"]);
});

test("provider-core rejects unsupported sideEffectClass via helper", () => {
  const manifest = createProviderManifest();

  assert.equal(providerSupportsSideEffectClass(manifest, "read_only"), true);
  assert.equal(providerSupportsSideEffectClass(manifest, "external_side_effects"), false);
  assert.throws(
    () => assertProviderSupportsSideEffectClass(manifest, "external_side_effects"),
    /unsupported_side_effect_class:provider_core_executor_001:external_side_effects/
  );
});

test("provider-core detects supported sandbox profiles", () => {
  const manifest = createProviderManifest();

  assert.equal(
    providerSupportsSandboxProfile(manifest, createSandboxProfile("read-only")),
    true
  );
  assert.equal(
    providerSupportsSandboxProfile(manifest, createSandboxProfile("workspace-write")),
    true
  );
  assert.equal(
    providerSupportsSandboxProfile(manifest, createSandboxProfile("danger-full-access")),
    false
  );
});

test("provider-core constrains workspace wildcard writable roots", () => {
  const manifest = ProviderManifestSchema.parse({
    ...createProviderManifest(),
    supportedSandboxProfiles: [
      createSandboxProfile("workspace-write", ["workspace/**"])
    ]
  });

  assert.equal(
    providerSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["workspace/packages/provider-core/**"])
    ),
    true
  );
  assert.equal(
    providerSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["/tmp/**"])
    ),
    false
  );
  assert.equal(
    providerSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["/etc/**"])
    ),
    false
  );
  assert.throws(
    () => assertProviderSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["/tmp/**"])
    ),
    /unsupported_sandbox_profile:provider_core_executor_001:/
  );
  assert.equal(
    providerSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["workspace/packages/../src/**"])
    ),
    true
  );
  assert.equal(
    providerSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["workspace/../outside/**"])
    ),
    false
  );
});

test("provider-core constrains sandbox env policy", () => {
  const manifest = ProviderManifestSchema.parse({
    ...createProviderManifest(),
    supportedSandboxProfiles: [
      createSandboxProfile("workspace-write", ["workspace/**"], {
        inheritProcessEnv: false,
        allowlist: ["SAFE_TOKEN"]
      })
    ]
  });

  assert.equal(
    providerSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["workspace/packages/provider-core/**"], {
        inheritProcessEnv: false,
        allowlist: ["SAFE_TOKEN"]
      })
    ),
    true
  );
  assert.equal(
    providerSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["workspace/packages/provider-core/**"], {
        inheritProcessEnv: true,
        allowlist: ["SAFE_TOKEN"]
      })
    ),
    false
  );
  assert.equal(
    providerSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["workspace/packages/provider-core/**"], {
        inheritProcessEnv: false,
        allowlist: ["SAFE_TOKEN", "EXTRA_TOKEN"]
      })
    ),
    false
  );
  assert.throws(
    () => assertProviderSupportsSandboxProfile(
      manifest,
      createSandboxProfile("workspace-write", ["workspace/packages/provider-core/**"], {
        inheritProcessEnv: true,
        allowlist: ["SAFE_TOKEN"]
      })
    ),
    /unsupported_sandbox_profile:provider_core_executor_001:/
  );
});

function createProviderManifest(): ProviderManifest {
  return ProviderManifestSchema.parse({
    schemaVersion: "provider-manifest.v1",
    providerId: "provider_core_executor_001",
    kind: "executor",
    displayName: "Provider Core Executor",
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
    supportedSandboxProfiles: [
      createSandboxProfile("read-only"),
      createSandboxProfile("workspace-write")
    ],
    supportedSideEffectClasses: ["read_only", "workspace_write"],
    metadata: {}
  });
}

function createExecutorPlan(
  overrides: Partial<ExecutorExecutionPlan> = {}
): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_provider_core_executor_001",
    runId: "run_provider_core_001",
    taskId: "task_provider_core_001",
    providerId: "provider_core_executor_001",
    inputHash: "a".repeat(64),
    policyDecisionHash: "policy_hash_provider_core_001",
    requiredCapabilities: ["fs.read:/repo/**"],
    approvalRequired: false,
    sandboxProfile: createSandboxProfile("read-only"),
    sideEffectClass: "read_only",
    createdAt: "2026-06-04T00:00:00.000Z",
    metadata: {},
    ...overrides
  });
}

function createSandboxProfile(
  mode: "read-only" | "workspace-write" | "danger-full-access",
  writableRoots = mode === "read-only" ? [] : ["workspace"],
  envPolicy: SandboxProfile["envPolicy"] = {
    inheritProcessEnv: false,
    allowlist: []
  }
) {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_provider_core_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots,
    envPolicy
  });
}
