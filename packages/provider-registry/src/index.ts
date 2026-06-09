import { z } from "zod";
import {
  SandboxProfileSchema,
  type SandboxProfile
} from "../../kernel-contracts/src/index.js";
import {
  ProviderKindSchema,
  ProviderManifestSchema,
  ProviderSideEffectClassSchema,
  providerSupportsSandboxProfile,
  providerSupportsSideEffectClass,
  type ExecutorProvider,
  type ModelProvider,
  type ProviderKind,
  type ProviderManifest,
  type ProviderSideEffectClass,
  type RemoteAgentProvider,
  type ToolProvider
} from "../../provider-core/src/index.js";

export type ProviderImplementation =
  | ExecutorProvider
  | ToolProvider
  | RemoteAgentProvider
  | ModelProvider;

export type ProviderRegistryEntry<
  TProvider extends ProviderImplementation = ProviderImplementation
> = {
  manifest: ProviderManifest;
  provider: TProvider;
};

export type ProviderRegistryFilter = {
  kind?: ProviderKind;
  enabled?: boolean;
  includeDisabled?: boolean;
  sideEffectClass?: ProviderSideEffectClass;
  sandboxProfile?: SandboxProfile;
};

export class ProviderRegistry {
  private readonly entries = new Map<string, ProviderRegistryEntry>();

  registerProvider(
    manifestInput: ProviderManifest | z.input<typeof ProviderManifestSchema>,
    provider: ProviderImplementation
  ): ProviderRegistryEntry {
    assertSecurityBoundaryPresent(manifestInput);

    const manifest = ProviderManifestSchema.parse(manifestInput);
    const providerManifest = ProviderManifestSchema.parse(provider.manifest);

    if (this.entries.has(manifest.providerId)) {
      throw new Error(`provider_registry_duplicate_provider:${manifest.providerId}`);
    }

    if (providerManifest.providerId !== manifest.providerId) {
      throw new Error(
        `provider_registry_provider_id_mismatch:${providerManifest.providerId}:${manifest.providerId}`
      );
    }

    assertProviderInterfaceMatchesKind(manifest.kind, provider, manifest.providerId);

    if (providerManifest.kind !== manifest.kind) {
      throw new Error(
        `provider_registry_manifest_kind_mismatch:${providerManifest.kind}:${manifest.kind}`
      );
    }

    if (manifest.kind === "remote_agent") {
      assertRemoteAgentAuthSchemes(manifest);
      assertRemoteAgentAuthSchemes(providerManifest);
    }

    assertProviderManifestMatches(manifest, providerManifest);

    const entry = {
      manifest: cloneManifest(providerManifest),
      provider
    };

    this.entries.set(manifest.providerId, entry);

    return cloneEntry(entry);
  }

  getProvider(providerId: string): ProviderRegistryEntry | undefined {
    const entry = this.entries.get(providerId);
    return entry === undefined ? undefined : cloneEntry(entry);
  }

  listProviders(filter: ProviderRegistryFilter = {}): ProviderRegistryEntry[] {
    const kind = filter.kind === undefined
      ? undefined
      : ProviderKindSchema.parse(filter.kind);
    const sideEffectClass = filter.sideEffectClass === undefined
      ? undefined
      : ProviderSideEffectClassSchema.parse(filter.sideEffectClass);
    const sandboxProfile = filter.sandboxProfile === undefined
      ? undefined
      : SandboxProfileSchema.parse(filter.sandboxProfile);

    return [...this.entries.values()]
      .filter((entry) => providerMatchesEnabledFilter(entry, filter))
      .filter((entry) => kind === undefined || entry.manifest.kind === kind)
      .filter((entry) => (
        sideEffectClass === undefined
        || providerSupportsSideEffectClass(entry.manifest, sideEffectClass)
      ))
      .filter((entry) => (
        sandboxProfile === undefined
        || providerSupportsSandboxProfile(entry.manifest, sandboxProfile)
      ))
      .map(cloneEntry);
  }

  unregisterProvider(providerId: string): boolean {
    return this.entries.delete(providerId);
  }

  findProvidersByKind(kind: ProviderKind): ProviderRegistryEntry[] {
    return this.listProviders({
      kind: ProviderKindSchema.parse(kind)
    });
  }

  findProvidersSupportingSideEffect(
    sideEffectClass: ProviderSideEffectClass
  ): ProviderRegistryEntry[] {
    return this.listProviders({
      sideEffectClass: ProviderSideEffectClassSchema.parse(sideEffectClass)
    });
  }

  findProvidersSupportingSandbox(
    sandboxProfile: SandboxProfile
  ): ProviderRegistryEntry[] {
    return this.listProviders({
      sandboxProfile: SandboxProfileSchema.parse(sandboxProfile)
    });
  }
}

function assertProviderManifestMatches(
  manifest: ProviderManifest,
  providerManifest: ProviderManifest
): void {
  if (stableStringify(manifest) !== stableStringify(providerManifest)) {
    throw new Error(`provider_registry_manifest_mismatch:${providerManifest.providerId}`);
  }
}

export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}

function providerMatchesEnabledFilter(
  entry: ProviderRegistryEntry,
  filter: ProviderRegistryFilter
): boolean {
  if (filter.enabled !== undefined) {
    return entry.manifest.enabled === filter.enabled;
  }

  return filter.includeDisabled === true || entry.manifest.enabled;
}

function assertSecurityBoundaryPresent(
  manifestInput: ProviderManifest | z.input<typeof ProviderManifestSchema>
): void {
  if (
    !isRecord(manifestInput)
    || !isRecord(manifestInput.securityBoundary)
  ) {
    const providerId = isRecord(manifestInput) && typeof manifestInput.providerId === "string"
      ? manifestInput.providerId
      : "unknown";

    throw new Error(`provider_registry_security_boundary_missing:${providerId}`);
  }
}

function assertProviderInterfaceMatchesKind(
  kind: ProviderKind,
  provider: ProviderImplementation,
  providerId: string
): void {
  switch (kind) {
    case "executor":
      if (!isExecutorProvider(provider)) {
        throw new Error(`provider_registry_kind_mismatch:${providerId}:executor`);
      }
      return;
    case "tool":
      if (!isToolProvider(provider)) {
        throw new Error(`provider_registry_kind_mismatch:${providerId}:tool`);
      }
      return;
    case "remote_agent":
      if (!isRemoteAgentProvider(provider)) {
        throw new Error(`provider_registry_kind_mismatch:${providerId}:remote_agent`);
      }
      return;
    case "model":
      if (!isModelProvider(provider)) {
        throw new Error(`provider_registry_kind_mismatch:${providerId}:model`);
      }
      return;
  }
}

function assertRemoteAgentAuthSchemes(manifest: ProviderManifest): void {
  const authSchemes = manifest.metadata.authSchemes;

  if (!Array.isArray(authSchemes) || authSchemes.length === 0) {
    throw new Error(`provider_registry_remote_agent_auth_schemes_required:${manifest.providerId}`);
  }

  if (authSchemes.some(isAnonymousAuthScheme)) {
    throw new Error(`provider_registry_remote_agent_anonymous_auth_rejected:${manifest.providerId}`);
  }
}

function isAnonymousAuthScheme(input: unknown): boolean {
  if (typeof input === "string") {
    return normalizeAuthSchemeField(input) === "anonymous";
  }

  if (!isRecord(input)) {
    return false;
  }

  return isAnonymousAuthSchemeField(input.schemeId)
    || isAnonymousAuthSchemeField(input.type)
    || isAnonymousAuthSchemeField(input.name);
}

function isAnonymousAuthSchemeField(input: unknown): boolean {
  return typeof input === "string" && normalizeAuthSchemeField(input) === "anonymous";
}

function normalizeAuthSchemeField(input: string): string {
  return input.trim().toLowerCase();
}

function isExecutorProvider(provider: ProviderImplementation): provider is ExecutorProvider {
  return hasFunction(provider, "planExecution")
    && hasFunction(provider, "validateExecutionPlan")
    && hasFunction(provider, "execute");
}

function isToolProvider(provider: ProviderImplementation): provider is ToolProvider {
  return hasFunction(provider, "listTools")
    && hasFunction(provider, "getTool")
    && hasFunction(provider, "planInvocation")
    && hasFunction(provider, "invoke");
}

function isRemoteAgentProvider(
  provider: ProviderImplementation
): provider is RemoteAgentProvider {
  return hasFunction(provider, "getAgentCard")
    && hasFunction(provider, "createRemoteTask")
    && hasFunction(provider, "getRemoteTask")
    && hasFunction(provider, "cancelRemoteTask")
    && hasFunction(provider, "streamRemoteTaskEvents");
}

function isModelProvider(provider: ProviderImplementation): provider is ModelProvider {
  return hasFunction(provider, "listModels")
    && hasFunction(provider, "selectModel")
    && hasFunction(provider, "probeModel");
}

function hasFunction(input: unknown, key: string): boolean {
  return isRecord(input) && typeof input[key] === "function";
}

function cloneEntry(entry: ProviderRegistryEntry): ProviderRegistryEntry {
  return {
    manifest: cloneManifest(entry.manifest),
    provider: entry.provider
  };
}

function cloneManifest(manifest: ProviderManifest): ProviderManifest {
  return structuredClone(manifest) as ProviderManifest;
}

function stableStringify(input: unknown): string {
  return JSON.stringify(canonicalize(input));
}

function canonicalize(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(canonicalize);
  }

  if (isRecord(input)) {
    return Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, canonicalize(value)])
    );
  }

  return input;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
