import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileSystemProviderManifestStore,
  ProviderRegistry,
  createProviderRegistry,
  type ProviderRegistryEntry
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
  ProviderManifestSchema,
  type ExecutorProvider,
  type RemoteAgentProvider,
  type ToolProvider
} from "../packages/provider-core/src/index.js";
import {
  SandboxProfileSchema,
  type SandboxProfile
} from "../packages/kernel-contracts/src/index.js";
import { validAgentManifest } from "../packages/kernel-contracts/test-fixtures/valid-agent-manifest.js";

const now = "2026-06-04T01:30:00.000Z";

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

function createCodexProvider(): CodexCliExecutorProvider {
  return new CodexCliExecutorProvider();
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
  mode: "read-only" | "workspace-write"
): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `sandbox_provider_registry_${mode.replace(/[^a-z0-9]+/g, "_")}`,
    mode,
    networkAccess: "none",
    writableRoots: mode === "read-only" ? [] : ["workspace"],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function providerIds(entries: ProviderRegistryEntry[]): string[] {
  return entries.map((entry) => entry.manifest.providerId);
}

async function createProviderRegistryTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "codex-router-provider-registry-"));
}
