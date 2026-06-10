import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
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

export type FileSystemProviderManifestStoreOptions = {
  baseDir: string;
  stateFileName?: string;
};

export interface ProviderManifestStore {
  saveManifest(
    manifest: ProviderManifest | z.input<typeof ProviderManifestSchema>
  ): ProviderManifest;
  getManifest(providerId: string): ProviderManifest | undefined;
  listManifests(filter?: ProviderRegistryFilter): ProviderManifest[];
  deleteManifest(providerId: string): boolean;
}

const ProviderManifestStoreStateSchema = z.object({
  schemaVersion: z.literal("provider-manifest-store.v1"),
  manifests: z.array(ProviderManifestSchema)
}).superRefine((state, ctx) => {
  for (const duplicate of findDuplicateStrings(state.manifests.map((manifest) => manifest.providerId))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `duplicate_provider_manifest_id:${duplicate}`,
      path: ["manifests"]
    });
  }
});

type ProviderManifestStoreState = z.infer<typeof ProviderManifestStoreStateSchema>;

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

export class InMemoryProviderManifestStore implements ProviderManifestStore {
  private readonly manifests = new Map<string, ProviderManifest>();

  saveManifest(
    manifestInput: ProviderManifest | z.input<typeof ProviderManifestSchema>
  ): ProviderManifest {
    const manifest = parseProviderManifestForStorage(manifestInput);
    if (this.manifests.has(manifest.providerId)) {
      throw new Error(`duplicate_provider_manifest_id:${manifest.providerId}`);
    }

    this.manifests.set(manifest.providerId, cloneManifest(manifest));
    return cloneManifest(manifest);
  }

  getManifest(providerId: string): ProviderManifest | undefined {
    const manifest = this.manifests.get(providerId);
    return manifest === undefined ? undefined : cloneManifest(manifest);
  }

  listManifests(filter: ProviderRegistryFilter = {}): ProviderManifest[] {
    return [...this.manifests.values()]
      .filter((manifest) => providerManifestMatchesFilter(manifest, filter))
      .map(cloneManifest);
  }

  deleteManifest(providerId: string): boolean {
    return this.manifests.delete(providerId);
  }
}

export class FileSystemProviderManifestStore implements ProviderManifestStore {
  private readonly baseDir: string;
  private readonly statePath: string;

  constructor(options: FileSystemProviderManifestStoreOptions) {
    this.baseDir = resolve(options.baseDir);
    this.statePath = join(this.baseDir, options.stateFileName ?? "provider-manifests.json");
  }

  saveManifest(
    manifestInput: ProviderManifest | z.input<typeof ProviderManifestSchema>
  ): ProviderManifest {
    const manifest = parseProviderManifestForStorage(manifestInput);
    const state = this.readState();
    if (state.manifests.some((item) => item.providerId === manifest.providerId)) {
      throw new Error(`duplicate_provider_manifest_id:${manifest.providerId}`);
    }

    state.manifests.push(cloneManifest(manifest));
    this.writeState(state);
    return cloneManifest(manifest);
  }

  getManifest(providerId: string): ProviderManifest | undefined {
    const manifest = this.readState().manifests.find((item) => item.providerId === providerId);
    return manifest === undefined ? undefined : cloneManifest(manifest);
  }

  listManifests(filter: ProviderRegistryFilter = {}): ProviderManifest[] {
    return this.readState().manifests
      .filter((manifest) => providerManifestMatchesFilter(manifest, filter))
      .map(cloneManifest);
  }

  deleteManifest(providerId: string): boolean {
    const state = this.readState();
    const nextManifests = state.manifests.filter((manifest) => manifest.providerId !== providerId);
    if (nextManifests.length === state.manifests.length) {
      return false;
    }

    this.writeState({
      ...state,
      manifests: nextManifests
    });
    return true;
  }

  private readState(): ProviderManifestStoreState {
    this.ensureBaseDir();
    if (!existsSync(this.statePath)) {
      return createEmptyProviderManifestStoreState();
    }

    return ProviderManifestStoreStateSchema.parse(
      JSON.parse(readFileSync(this.statePath, "utf8"))
    );
  }

  private writeState(state: ProviderManifestStoreState): void {
    this.ensureBaseDir();
    const parsed = ProviderManifestStoreStateSchema.parse(state);
    const tempPath = join(
      this.baseDir,
      `provider-manifests.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    );
    writeFileSync(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.statePath);
  }

  private ensureBaseDir(): void {
    mkdirSync(this.baseDir, { recursive: true });
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

export function createInMemoryProviderManifestStore(): InMemoryProviderManifestStore {
  return new InMemoryProviderManifestStore();
}

export function createFileSystemProviderManifestStore(
  options: FileSystemProviderManifestStoreOptions
): FileSystemProviderManifestStore {
  return new FileSystemProviderManifestStore(options);
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

function providerManifestMatchesFilter(
  manifest: ProviderManifest,
  filter: ProviderRegistryFilter
): boolean {
  const kind = filter.kind === undefined
    ? undefined
    : ProviderKindSchema.parse(filter.kind);
  const sideEffectClass = filter.sideEffectClass === undefined
    ? undefined
    : ProviderSideEffectClassSchema.parse(filter.sideEffectClass);
  const sandboxProfile = filter.sandboxProfile === undefined
    ? undefined
    : SandboxProfileSchema.parse(filter.sandboxProfile);

  return providerManifestMatchesEnabledFilter(manifest, filter)
    && (kind === undefined || manifest.kind === kind)
    && (
      sideEffectClass === undefined
      || providerSupportsSideEffectClass(manifest, sideEffectClass)
    )
    && (
      sandboxProfile === undefined
      || providerSupportsSandboxProfile(manifest, sandboxProfile)
    );
}

function providerManifestMatchesEnabledFilter(
  manifest: ProviderManifest,
  filter: ProviderRegistryFilter
): boolean {
  if (filter.enabled !== undefined) {
    return manifest.enabled === filter.enabled;
  }

  return filter.includeDisabled === true || manifest.enabled;
}

function parseProviderManifestForStorage(
  manifestInput: ProviderManifest | z.input<typeof ProviderManifestSchema>
): ProviderManifest {
  assertSecurityBoundaryPresent(manifestInput);
  const manifest = ProviderManifestSchema.parse(manifestInput);
  if (manifest.kind === "remote_agent") {
    assertRemoteAgentAuthSchemes(manifest);
  }
  return manifest;
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

function createEmptyProviderManifestStoreState(): ProviderManifestStoreState {
  return {
    schemaVersion: "provider-manifest-store.v1",
    manifests: []
  };
}

function findDuplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
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
