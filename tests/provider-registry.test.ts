import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileSystemProviderManifestStore,
  ProviderRegistry,
  createProviderRegistry,
  selectProviderForGrant,
  selectProviderForRoutingDecision,
  type ProviderRegistryEntry
} from "../packages/provider-registry/src/index.js";
import {
  CodexCliExecutorProvider,
  codexCliProviderManifest
} from "../packages/providers/codex-cli/src/index.js";
import {
  McpServerRefSchema,
  createMcpToolProviderSkeleton
} from "../packages/protocol-mcp/src/index.js";
import {
  createA2ARemoteAgentProviderSkeleton
} from "../packages/protocol-a2a/src/index.js";
import {
  ProviderManifestSchema,
  hashProviderManifest,
  type ExecutorProvider,
  type ProviderManifest,
  type RemoteAgentProvider,
  type ToolProvider
} from "../packages/provider-core/src/index.js";
import {
  SandboxProfileSchema,
  type SandboxProfile
} from "../packages/kernel-contracts/src/index.js";
import {
  ProviderGrantSchema,
  RoutingDecisionSchema
} from "../packages/contracts/src/index.js";
import { validAgentManifest } from "../packages/kernel-contracts/test-fixtures/valid-agent-manifest.js";

const now = "2026-06-04T01:30:00.000Z";
const pr7aNow = "2026-06-14T00:00:00.000Z";

test("provider-registry read-only catalog registers codex-cli manifest", () => {
  const registry = createProviderRegistry();
  const entry = registry.register(codexCliProviderManifest, {
    registeredAt: pr7aNow
  });

  assert.equal(entry.providerId, "codex-cli");
  assert.equal(entry.kind, "executor");
  assert.equal(entry.displayName, codexCliProviderManifest.displayName);
  assert.equal(entry.version, codexCliProviderManifest.version);
  assert.equal(entry.enabled, true);
  assert.match(entry.manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(entry.attestation.manifestHash, entry.manifestHash);
  assert.equal(entry.manifestHash, hashProviderManifest(codexCliProviderManifest));
  assert.ok(entry.capabilities.length > 0);
  assert.ok(entry.supportedSandboxProfiles.length > 0);
  assert.ok(entry.supportedSideEffectClasses.length > 0);

  const serialized = JSON.stringify(entry);
  assert.equal(serialized.includes("execute"), false);
  assert.equal(serialized.includes("function"), false);
});

test("provider-registry read-only catalog gets provider by id", () => {
  const registry = createProviderRegistry();

  registry.register(codexCliProviderManifest, {
    registeredAt: pr7aNow
  });

  assert.equal(registry.get("codex-cli")?.providerId, "codex-cli");
  assert.equal(registry.get("missing"), undefined);
});

test("provider-registry read-only catalog lists all and enabled providers", () => {
  const registry = createProviderRegistry();
  const disabledManifest = createDisabledProviderManifest();

  registry.register(codexCliProviderManifest, {
    registeredAt: pr7aNow
  });
  registry.register(disabledManifest, {
    registeredAt: pr7aNow
  });

  assert.deepEqual(
    registry.list().map((entry) => entry.providerId),
    ["codex-cli", "codex-cli-disabled"]
  );
  assert.deepEqual(
    registry.listEnabled().map((entry) => entry.providerId),
    ["codex-cli"]
  );
});

test("provider-registry read-only catalog rejects duplicate providers", () => {
  const registry = createProviderRegistry();

  registry.register(codexCliProviderManifest, {
    registeredAt: pr7aNow
  });

  assert.throws(
    () => registry.register(codexCliProviderManifest, { registeredAt: pr7aNow }),
    /provider_registry_duplicate_provider:codex-cli/
  );
});

test("provider-registry read-only catalog excludes disabled provider from listEnabled", () => {
  const registry = createProviderRegistry();
  const disabledManifest = createDisabledProviderManifest();

  registry.register(disabledManifest, {
    registeredAt: pr7aNow
  });

  assert.deepEqual(
    registry.list().map((entry) => entry.providerId),
    ["codex-cli-disabled"]
  );
  assert.deepEqual(registry.listEnabled(), []);
});

test("provider-registry read-only catalog snapshot is stable and sanitized", () => {
  const registry = createProviderRegistry();

  registry.register(codexCliProviderManifest, {
    registeredAt: pr7aNow
  });

  const snapshot = registry.snapshot({
    generatedAt: pr7aNow
  });
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.schemaVersion, "provider-registry-snapshot.v1");
  assert.equal(snapshot.generatedAt, pr7aNow);
  assert.equal(snapshot.providerCount, 1);
  assert.equal(snapshot.enabledProviderCount, 1);
  assert.equal(snapshot.providers[0]?.providerId, "codex-cli");
  assert.equal(serialized.includes("execute"), false);
  assert.equal(serialized.includes("invoke"), false);
  assert.equal(serialized.includes("function"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("sk-"), false);
  assert.equal(serialized.includes("Bearer"), false);
});

test("provider-registry read-only catalog manifest hash changes when manifest changes", () => {
  const changedManifest = ProviderManifestSchema.parse({
    ...codexCliProviderManifest,
    version: "0.1.1"
  });

  assert.notEqual(
    hashProviderManifest(changedManifest),
    hashProviderManifest(codexCliProviderManifest)
  );
});

test("provider-registry selection selects codex-cli by providerId", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = registry.select({
    providerId: "codex-cli"
  });

  assert.equal(result.selected, true);
  assert.equal(result.provider?.providerId, "codex-cli");
  assert.deepEqual(result.reasons, []);
});

test("provider-registry selection rejects missing providers", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = registry.select({
    providerId: "missing"
  });

  assert.equal(result.selected, false);
  assert.equal(result.provider, undefined);
  assert.deepEqual(result.reasons, [
    "provider_selection_provider_missing:missing"
  ]);
});

test("provider-registry selection rejects disabled provider by default", () => {
  const registry = createProviderRegistry();

  registry.register(createDisabledProviderManifest(), {
    registeredAt: pr7aNow
  });

  const result = registry.select({
    providerId: "codex-cli-disabled"
  });

  assert.equal(result.selected, false);
  assert.equal(result.provider, undefined);
  assert.ok(result.reasons.includes(
    "provider_selection_provider_disabled:codex-cli-disabled"
  ));
});

test("provider-registry selection can read disabled provider when enabled is not required", () => {
  const registry = createProviderRegistry();

  registry.register(createDisabledProviderManifest(), {
    registeredAt: pr7aNow
  });

  const result = registry.select({
    providerId: "codex-cli-disabled",
    requireEnabled: false
  });

  assert.equal(result.selected, true);
  assert.equal(result.provider?.providerId, "codex-cli-disabled");
});

test("provider-registry selection rejects kind mismatch", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = registry.select({
    providerId: "codex-cli",
    kind: "tool"
  });

  assert.equal(result.selected, false);
  assert.deepEqual(result.reasons, [
    "provider_selection_kind_mismatch:tool:executor"
  ]);
});

test("provider-registry selection rejects manifest hash mismatch", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = registry.select({
    providerId: "codex-cli",
    expectedManifestHash: "0".repeat(64)
  });

  assert.equal(result.selected, false);
  assert.ok(result.reasons.includes("provider_selection_manifest_hash_mismatch"));
});

test("provider-registry selection rejects missing capabilities", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = registry.select({
    providerId: "codex-cli",
    requiredCapabilities: ["missing.capability"]
  });

  assert.equal(result.selected, false);
  assert.deepEqual(result.reasons, [
    "provider_selection_missing_capability:missing.capability"
  ]);
});

test("provider-registry selection rejects unsupported side effects", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = registry.select({
    providerId: "codex-cli",
    requiredSideEffectClass: "protected_remote"
  });

  assert.equal(result.selected, false);
  assert.deepEqual(result.reasons, [
    "provider_selection_unsupported_side_effect:protected_remote"
  ]);
});

test("provider-registry selection accepts supported side effects", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = registry.select({
    providerId: "codex-cli",
    requiredSideEffectClass: "read_only"
  });

  assert.equal(result.selected, true);
  assert.equal(result.provider?.providerId, "codex-cli");
});

test("provider-registry selection rejects unsupported sandbox", () => {
  const registry = createRegistryWithCodexCatalog();
  const sandbox = createSandboxProfile("read-only", {
    sandboxId: "sandbox_provider_registry_full_network",
    networkAccess: "full"
  });
  const result = registry.select({
    providerId: "codex-cli",
    requiredSandboxProfile: sandbox
  });

  assert.equal(result.selected, false);
  assert.deepEqual(result.reasons, [
    "provider_selection_unsupported_sandbox:sandbox_provider_registry_full_network"
  ]);
});

test("provider-registry selection accepts supported read-only sandbox", () => {
  const registry = createRegistryWithCodexCatalog();
  const readOnlySandbox = codexCliProviderManifest.supportedSandboxProfiles.find(
    (sandbox) => sandbox.mode === "read-only"
  );
  assert.ok(readOnlySandbox);

  const result = registry.select({
    providerId: "codex-cli",
    requiredSandboxProfile: readOnlySandbox
  });

  assert.equal(result.selected, true);
  assert.equal(result.provider?.providerId, "codex-cli");
});

test("provider-registry selection selects provider for grant", () => {
  const registry = createRegistryWithCodexCatalog();
  const grant = createCodexReadOnlyProviderGrant();
  const result = selectProviderForGrant(registry, grant);

  assert.equal(result.selected, true);
  assert.equal(result.provider?.providerId, "codex-cli");
});

test("provider-registry selection selects provider for routing decision", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = selectProviderForRoutingDecision(
    registry,
    createCodexReadOnlyRoutingDecision()
  );

  assert.equal(result.selected, true);
  assert.equal(result.provider?.providerId, "codex-cli");
  assert.deepEqual(result.reasons, []);
});

test("provider-registry selection rejects routing decisions without provider grants", () => {
  const registry = createRegistryWithCodexCatalog();
  const decision = createCodexReadOnlyRoutingDecision();
  delete (decision as { providerGrant?: unknown }).providerGrant;
  const result = selectProviderForRoutingDecision(registry, decision);

  assert.equal(result.selected, false);
  assert.equal(result.provider, undefined);
  assert.deepEqual(result.reasons, ["provider_selection_grant_missing"]);
});

test("provider-registry selection rejects routing decision manifest mismatch", () => {
  const registry = createRegistryWithCodexCatalog();
  const decision = createCodexReadOnlyRoutingDecision({
    manifestHash: "0".repeat(64)
  });
  const result = selectProviderForRoutingDecision(registry, decision);

  assert.equal(result.selected, false);
  assert.ok(result.reasons.includes("provider_selection_manifest_hash_mismatch"));
});

test("provider-registry selection rejects provider grant manifest mismatch", () => {
  const registry = createRegistryWithCodexCatalog();
  const grant = {
    ...createCodexReadOnlyProviderGrant(),
    manifestHash: "0".repeat(64)
  };
  const result = selectProviderForGrant(registry, grant);

  assert.equal(result.selected, false);
  assert.ok(result.reasons.includes("provider_selection_manifest_hash_mismatch"));
});

test("provider-registry selection result is sanitized", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = registry.select({
    providerId: "codex-cli",
    requiredSideEffectClass: "read_only"
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.selected, true);
  assert.equal(serialized.includes("execute"), false);
  assert.equal(serialized.includes("invoke"), false);
  assert.equal(serialized.includes("function"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("sk-"), false);
  assert.equal(serialized.includes("Bearer"), false);
});

test("provider-registry routing decision selection result is sanitized", () => {
  const registry = createRegistryWithCodexCatalog();
  const result = selectProviderForRoutingDecision(
    registry,
    createCodexReadOnlyRoutingDecision()
  );
  const serialized = JSON.stringify(result);

  assert.equal(result.selected, true);
  assert.equal(serialized.includes("execute"), false);
  assert.equal(serialized.includes("invoke"), false);
  assert.equal(serialized.includes("function"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("sk-"), false);
  assert.equal(serialized.includes("Bearer"), false);
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("args"), false);
  assert.equal(serialized.includes("stdout"), false);
  assert.equal(serialized.includes("stderr"), false);
});

test("provider-registry registers, gets, lists, and unregisters providers", () => {
  const registry = createProviderRegistry();
  const codexProvider = createCodexProvider();
  const mcpProvider = createMcpProvider();
  const a2aProvider = createA2AProvider();

  registry.registerProvider(codexProvider.manifest, codexProvider);
  registry.registerProvider(mcpProvider.manifest, mcpProvider);
  registry.registerProvider(a2aProvider.manifest, a2aProvider);

  assert.equal(registry.getProvider("codex-cli")?.manifest.providerId, "codex-cli");
  assert.equal(registry.getProvider("mcp.local-dev")?.manifest.kind, "tool");
  assert.equal(registry.getProvider(a2aProvider.manifest.providerId)?.manifest.kind, "remote_agent");
  assert.deepEqual(
    registry.listProviders().map((entry) => entry.manifest.providerId),
    ["codex-cli", "mcp.local-dev"]
  );
  assert.deepEqual(
    registry.listProviders({ includeDisabled: true }).map((entry) => entry.manifest.providerId),
    ["codex-cli", "mcp.local-dev", a2aProvider.manifest.providerId]
  );

  assert.equal(registry.unregisterProvider("mcp.local-dev"), true);
  assert.equal(registry.unregisterProvider("mcp.local-dev"), false);
  assert.equal(registry.getProvider("mcp.local-dev"), undefined);
});

test("provider-registry rejects duplicate provider ids", () => {
  const registry = new ProviderRegistry();
  const provider = createCodexProvider();

  registry.registerProvider(provider.manifest, provider);

  assert.throws(
    () => registry.registerProvider(provider.manifest, provider),
    /provider_registry_duplicate_provider:codex-cli/
  );
});

test("provider-registry rejects manifest kind mismatches with provider interface", () => {
  const registry = new ProviderRegistry();
  const toolProvider = createMcpProvider();
  const executorManifest = ProviderManifestSchema.parse({
    ...toolProvider.manifest,
    kind: "executor"
  });

  assert.throws(
    () => registry.registerProvider(executorManifest, toolProvider),
    /provider_registry_kind_mismatch:mcp\.local-dev:executor/
  );
});

test("provider-registry rejects mismatched provider manifests", () => {
  const registry = new ProviderRegistry();
  const provider = createMcpProvider();
  const spoofedManifest = ProviderManifestSchema.parse({
    ...provider.manifest,
    supportedSandboxProfiles: [
      ...provider.manifest.supportedSandboxProfiles,
      createSandboxProfile("workspace-write")
    ],
    supportedSideEffectClasses: [
      ...provider.manifest.supportedSideEffectClasses,
      "local_command"
    ]
  });

  assert.throws(
    () => registry.registerProvider(spoofedManifest, provider),
    /provider_registry_manifest_mismatch:mcp\.local-dev/
  );
  assert.deepEqual(registry.listProviders({ includeDisabled: true }), []);
});

test("provider-registry excludes disabled providers from automatic selection", () => {
  const registry = new ProviderRegistry();
  const remoteProvider = createA2AProvider();

  registry.registerProvider(remoteProvider.manifest, remoteProvider);

  assert.equal(registry.getProvider(remoteProvider.manifest.providerId)?.manifest.enabled, false);
  assert.deepEqual(registry.listProviders(), []);
  assert.deepEqual(registry.findProvidersByKind("remote_agent"), []);
  assert.deepEqual(
    registry.listProviders({ includeDisabled: true }).map((entry) => entry.manifest.providerId),
    [remoteProvider.manifest.providerId]
  );
  assert.deepEqual(
    registry.listProviders({ enabled: false }).map((entry) => entry.manifest.providerId),
    [remoteProvider.manifest.providerId]
  );
});

test("provider-registry queries providers by kind", () => {
  const registry = createPopulatedRegistry();

  assert.deepEqual(providerIds(registry.findProvidersByKind("executor")), [
    "codex-cli"
  ]);
  assert.deepEqual(providerIds(registry.findProvidersByKind("tool")), [
    "mcp.local-dev"
  ]);
  assert.deepEqual(providerIds(registry.findProvidersByKind("remote_agent")), []);
});

test("provider-registry queries providers by sideEffectClass", () => {
  const registry = createPopulatedRegistry();

  assert.deepEqual(providerIds(registry.findProvidersSupportingSideEffect("read_only")), [
    "codex-cli"
  ]);
  assert.deepEqual(providerIds(registry.findProvidersSupportingSideEffect("read")), [
    "mcp.local-dev"
  ]);
  assert.deepEqual(providerIds(registry.findProvidersSupportingSideEffect("protected_remote")), []);
  assert.deepEqual(
    providerIds(registry.listProviders({
      sideEffectClass: "protected_remote",
      includeDisabled: true
    })),
    [createA2AProvider().manifest.providerId]
  );
});

test("provider-registry queries providers by sandbox support", () => {
  const registry = createPopulatedRegistry();

  assert.deepEqual(
    providerIds(registry.findProvidersSupportingSandbox(createSandboxProfile("read-only"))),
    ["codex-cli", "mcp.local-dev"]
  );
  assert.deepEqual(
    providerIds(registry.findProvidersSupportingSandbox(createSandboxProfile("workspace-write"))),
    ["codex-cli"]
  );
});

test("provider-registry rejects remote agents without explicit authSchemes", () => {
  const registry = new ProviderRegistry();
  const remoteProvider = createA2AProvider();
  const manifestWithoutAuth = ProviderManifestSchema.parse({
    ...remoteProvider.manifest,
    metadata: {
      a2a: remoteProvider.manifest.metadata.a2a
    }
  });

  assert.throws(
    () => registry.registerProvider(manifestWithoutAuth, remoteProvider),
    /provider_registry_remote_agent_auth_schemes_required:a2a\.agent_coding_worker_001/
  );
});

test("provider-registry rejects anonymous remote agent auth schemes case-insensitively", () => {
  const anonymousSchemes = [
    " Anonymous ",
    { schemeId: "Anonymous" },
    { schemeId: " Anonymous " },
    { type: "ANONYMOUS" },
    { name: "Anonymous" }
  ];

  for (const authScheme of anonymousSchemes) {
    const registry = new ProviderRegistry();
    const remoteProvider = createA2AProvider();
    const manifestWithAnonymousAuth = ProviderManifestSchema.parse({
      ...remoteProvider.manifest,
      metadata: {
        ...remoteProvider.manifest.metadata,
        authSchemes: [authScheme]
      }
    });

    assert.throws(
      () => registry.registerProvider(manifestWithAnonymousAuth, remoteProvider),
      /provider_registry_remote_agent_anonymous_auth_rejected:a2a\.agent_coding_worker_001/
    );
  }
});

test("provider-registry rejects anonymous auth declared only on provider manifest", () => {
  const registry = new ProviderRegistry();
  const remoteProvider = createA2AProvider();
  const unsafeProvider: RemoteAgentProvider = {
    ...remoteProvider,
    manifest: ProviderManifestSchema.parse({
      ...remoteProvider.manifest,
      metadata: {
        ...remoteProvider.manifest.metadata,
        authSchemes: [{ schemeId: "Anonymous" }]
      }
    })
  };

  assert.throws(
    () => registry.registerProvider(remoteProvider.manifest, unsafeProvider),
    /provider_registry_remote_agent_anonymous_auth_rejected:a2a\.agent_coding_worker_001/
  );
});

test("provider-registry accepts Codex CLI provider while execution remains disabled", async () => {
  const registry = new ProviderRegistry();
  const codexProvider = createCodexProvider();

  registry.registerProvider(codexProvider.manifest, codexProvider);

  const registered = registry.getProvider("codex-cli");
  assert.ok(registered);
  assert.equal(registered.manifest.kind, "executor");
  assert.equal(registered.manifest.enabled, true);
  await assert.rejects(
    async () => (registered.provider as ExecutorProvider).execute({} as never, {}),
    /codex_cli_provider_execute_disabled/
  );
});

test("provider-registry rejects manifests without securityBoundary", () => {
  const registry = new ProviderRegistry();
  const provider = createCodexProvider();
  const unsafeManifest = {
    ...provider.manifest,
    securityBoundary: undefined
  } as unknown as typeof provider.manifest;

  assert.throws(
    () => registry.registerProvider(unsafeManifest, provider),
    /provider_registry_security_boundary_missing:codex-cli/
  );
});

test("file provider manifest store persists provider metadata across instances", async () => {
  const baseDir = await createProviderRegistryTempDir();
  try {
    const codexProvider = createCodexProvider();
    const mcpProvider = createMcpProvider();
    const a2aProvider = createA2AProvider();
    const first = new FileSystemProviderManifestStore({ baseDir });

    first.saveManifest(codexProvider.manifest);
    first.saveManifest(mcpProvider.manifest);
    first.saveManifest(a2aProvider.manifest);

    const second = new FileSystemProviderManifestStore({ baseDir });

    assert.equal(second.getManifest("codex-cli")?.kind, "executor");
    assert.deepEqual(
      second.listManifests().map((manifest) => manifest.providerId),
      ["codex-cli", "mcp.local-dev"]
    );
    assert.deepEqual(
      second.listManifests({ includeDisabled: true }).map((manifest) => manifest.providerId),
      ["codex-cli", "mcp.local-dev", a2aProvider.manifest.providerId]
    );
    assert.deepEqual(
      second.listManifests({ kind: "tool" }).map((manifest) => manifest.providerId),
      ["mcp.local-dev"]
    );
    assert.deepEqual(
      second.listManifests({ sideEffectClass: "read_only" }).map((manifest) => manifest.providerId),
      ["codex-cli"]
    );
    assert.deepEqual(
      second.listManifests({
        sandboxProfile: createSandboxProfile("workspace-write")
      }).map((manifest) => manifest.providerId),
      ["codex-cli"]
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file provider manifest store rejects duplicates and persists deletes", async () => {
  const baseDir = await createProviderRegistryTempDir();
  try {
    const first = new FileSystemProviderManifestStore({ baseDir });
    const provider = createCodexProvider();

    first.saveManifest(provider.manifest);

    const second = new FileSystemProviderManifestStore({ baseDir });
    assert.throws(
      () => second.saveManifest(provider.manifest),
      /duplicate_provider_manifest_id:codex-cli/
    );

    assert.equal(second.deleteManifest("codex-cli"), true);
    assert.equal(second.deleteManifest("codex-cli"), false);
    assert.equal(new FileSystemProviderManifestStore({ baseDir }).getManifest("codex-cli"), undefined);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file provider manifest store refuses mutations while another lock is present", async () => {
  const baseDir = await createProviderRegistryTempDir();
  try {
    await writeFile(
      join(baseDir, ".provider-manifest-store.lock"),
      "{\"token\":\"held\"}\n",
      "utf8"
    );
    const store = new FileSystemProviderManifestStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 60_000
    });

    assert.throws(
      () => store.saveManifest(createCodexProvider().manifest),
      /provider_manifest_store_lock_timeout:/
    );
    assert.throws(
      () => store.deleteManifest("codex-cli"),
      /provider_manifest_store_lock_timeout:/
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file provider manifest store does not remove a fresh lock during stale cleanup", async () => {
  const baseDir = await createProviderRegistryTempDir();
  try {
    const lockPath = join(baseDir, ".provider-manifest-store.lock");
    const lockPayload = `${JSON.stringify({
      token: "fresh-owner",
      createdAt: "2999-01-01T00:00:00.000Z"
    })}\n`;
    await writeFile(lockPath, lockPayload, "utf8");
    await utimes(lockPath, new Date(0), new Date(0));
    const store = new FileSystemProviderManifestStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 1
    });

    assert.throws(
      () => store.saveManifest(createCodexProvider().manifest),
      /provider_manifest_store_lock_timeout:/
    );
    assert.equal(await readFile(lockPath, "utf8"), lockPayload);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file provider manifest store does not remove a stale-looking lock owned by a live process", async () => {
  const baseDir = await createProviderRegistryTempDir();
  try {
    const lockPath = join(baseDir, ".provider-manifest-store.lock");
    const lockPayload = `${JSON.stringify({
      token: "live-owner",
      pid: process.pid,
      createdAt: "2000-01-01T00:00:00.000Z"
    })}\n`;
    await writeFile(lockPath, lockPayload, "utf8");
    await utimes(lockPath, new Date(0), new Date(0));
    const store = new FileSystemProviderManifestStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 1
    });

    assert.throws(
      () => store.saveManifest(createCodexProvider().manifest),
      /provider_manifest_store_lock_timeout:/
    );
    assert.equal(await readFile(lockPath, "utf8"), lockPayload);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

function createPopulatedRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  const codexProvider = createCodexProvider();
  const mcpProvider = createMcpProvider();
  const a2aProvider = createA2AProvider();

  registry.registerProvider(codexProvider.manifest, codexProvider);
  registry.registerProvider(mcpProvider.manifest, mcpProvider);
  registry.registerProvider(a2aProvider.manifest, a2aProvider);

  return registry;
}

function createRegistryWithCodexCatalog(): ProviderRegistry {
  const registry = createProviderRegistry();
  registry.register(codexCliProviderManifest, {
    registeredAt: pr7aNow
  });
  return registry;
}

function createCodexProvider(): CodexCliExecutorProvider {
  return new CodexCliExecutorProvider();
}

function createDisabledProviderManifest(): ProviderManifest {
  return ProviderManifestSchema.parse({
    ...codexCliProviderManifest,
    providerId: "codex-cli-disabled",
    displayName: "Codex CLI Disabled",
    enabled: false
  });
}

function createMcpProvider(): ToolProvider {
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

function createA2AProvider(): RemoteAgentProvider {
  return createA2ARemoteAgentProviderSkeleton(validAgentManifest);
}

function createSandboxProfile(
  mode: "read-only" | "workspace-write",
  options: {
    sandboxId?: string;
    networkAccess?: SandboxProfile["networkAccess"];
    writableRoots?: string[];
  } = {}
): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: options.sandboxId
      ?? `sandbox_provider_registry_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: options.networkAccess ?? "none",
    writableRoots: options.writableRoots ?? (mode === "read-only" ? [] : ["workspace"]),
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function createCodexReadOnlyProviderGrant() {
  return ProviderGrantSchema.parse({
    schemaVersion: "provider-grant.v1",
    grantId: "grant_provider_registry_codex_cli_readonly",
    providerId: "codex-cli",
    providerKind: "executor",
    manifestHash: hashProviderManifest(codexCliProviderManifest),
    sideEffectClass: "read_only",
    toolAccess: "read_only",
    sandboxMode: "read-only",
    approvalRequired: false,
    requiredApprovals: [],
    reasons: ["test"]
  });
}

function createCodexReadOnlyRoutingDecision(
  grantOverrides: Partial<ReturnType<typeof createCodexReadOnlyProviderGrant>> = {}
) {
  const grant = ProviderGrantSchema.parse({
    ...createCodexReadOnlyProviderGrant(),
    ...grantOverrides
  });

  return RoutingDecisionSchema.parse({
    schemaVersion: "routing-decision.v1",
    decisionId: "decision_provider_registry_codex_cli_readonly",
    taskId: "task_provider_registry_codex_cli_readonly",
    policyVersion: "provider-registry-test-policy",
    classification: {
      taskClass: "read_only",
      riskLevel: "low",
      ambiguityScore: 0,
      clarificationRequired: false,
      riskFactors: []
    },
    execution: {
      selectedModel: "gpt-5.4-mini",
      toolAccess: "read_only",
      executionProfile: "recon-only",
      reasoningEffort: "low"
    },
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
    providerGrant: grant
  });
}

function providerIds(entries: ProviderRegistryEntry[]): string[] {
  return entries.map((entry) => entry.manifest.providerId);
}

async function createProviderRegistryTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "codex-router-provider-registry-"));
}
