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
  providerSupportsSandboxProfile,
  providerSupportsSideEffectClass,
  type ProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  SandboxProfileSchema
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

function createSandboxProfile(
  mode: "read-only" | "workspace-write" | "danger-full-access",
  writableRoots = mode === "read-only" ? [] : ["workspace"]
) {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_provider_core_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots,
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}
