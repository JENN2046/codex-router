import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
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
  createProviderAttestation,
  hashProviderManifest,
  parseProviderManifest,
  providerSupportsSandboxProfile,
  providerSupportsSideEffectClass,
  type ExecutorProvider,
  type ModelProvider,
  type ProviderAttestation,
  type ProviderKind,
  type ProviderManifest,
  type ProviderSecurityBoundary,
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

export interface ProviderRegistryAttestationEntry {
  providerId: string;
  kind: ProviderKind;
  displayName: string;
  version: string;
  enabled: boolean;
  manifestHash: string;
  capabilities: string[];
  securityBoundary: ProviderSecurityBoundary;
  supportedSandboxProfiles: SandboxProfile[];
  supportedSideEffectClasses: ProviderSideEffectClass[];
  attestation: ProviderAttestation;
  registeredAt: string;
}

export interface ProviderRegistrySnapshot {
  schemaVersion: "provider-registry-snapshot.v1";
  generatedAt: string;
  providerCount: number;
  enabledProviderCount: number;
  providers: ProviderRegistrySnapshotEntry[];
}

export type ProviderRegistrySnapshotSecurityBoundary = Omit<
  ProviderSecurityBoundary,
  "secretAccess"
> & {
  credentialAccess: ProviderSecurityBoundary["secretAccess"];
};

export type ProviderRegistrySnapshotAttestation = Omit<
  ProviderAttestation,
  "securityBoundary"
> & {
  securityBoundary: ProviderRegistrySnapshotSecurityBoundary;
};

export type ProviderRegistrySnapshotEntry = Omit<
  ProviderRegistryAttestationEntry,
  "securityBoundary" | "attestation"
> & {
  securityBoundary: ProviderRegistrySnapshotSecurityBoundary;
  attestation: ProviderRegistrySnapshotAttestation;
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
  lockTimeoutMs?: number;
  lockRetryDelayMs?: number;
  lockStaleMs?: number;
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

type FileLockSnapshot = {
  raw: string;
  mtimeMs: number;
  ctimeMs: number;
  size: number;
  createdAtMs?: number;
  pid?: number;
};

const defaultLockTimeoutMs = 1_000;
const defaultLockRetryDelayMs = 10;
const defaultLockStaleMs = 30_000;

export class ProviderRegistry {
  private readonly entries = new Map<string, ProviderRegistryEntry>();
  private readonly attestationCatalog = new Map<string, ProviderRegistryAttestationEntry>();

  register(
    manifestInput: ProviderManifest | z.input<typeof ProviderManifestSchema>,
    options: { registeredAt?: string } = {}
  ): ProviderRegistryAttestationEntry {
    const manifest = parseProviderManifest(manifestInput);
    const registeredAt = options.registeredAt ?? new Date().toISOString();

    if (this.attestationCatalog.has(manifest.providerId)) {
      throw new Error(`provider_registry_duplicate_provider:${manifest.providerId}`);
    }

    const attestation = createProviderAttestation(manifest, registeredAt);
    const entry: ProviderRegistryAttestationEntry = {
      providerId: manifest.providerId,
      kind: manifest.kind,
      displayName: manifest.displayName,
      version: manifest.version,
      enabled: manifest.enabled,
      manifestHash: attestation.manifestHash,
      capabilities: [...attestation.capabilities],
      securityBoundary: structuredClone(attestation.securityBoundary) as ProviderSecurityBoundary,
      supportedSandboxProfiles: structuredClone(attestation.supportedSandboxProfiles) as SandboxProfile[],
      supportedSideEffectClasses: [...attestation.supportedSideEffectClasses],
      attestation: structuredClone(attestation) as ProviderAttestation,
      registeredAt
    };

    if (entry.manifestHash !== hashProviderManifest(manifest)) {
      throw new Error(`provider_registry_manifest_hash_mismatch:${manifest.providerId}`);
    }

    this.attestationCatalog.set(manifest.providerId, entry);
    return cloneAttestationEntry(entry);
  }

  get(providerId: string): ProviderRegistryAttestationEntry | undefined {
    const entry = this.attestationCatalog.get(providerId);
    return entry === undefined ? undefined : cloneAttestationEntry(entry);
  }

  list(): ProviderRegistryAttestationEntry[] {
    return [...this.attestationCatalog.values()].map(cloneAttestationEntry);
  }

  listEnabled(): ProviderRegistryAttestationEntry[] {
    return this.list().filter((entry) => entry.enabled);
  }

  snapshot(options: { generatedAt?: string } = {}): ProviderRegistrySnapshot {
    const entries = this.list();
    const providers = entries.map(toSnapshotEntry);
    return {
      schemaVersion: "provider-registry-snapshot.v1",
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      providerCount: providers.length,
      enabledProviderCount: entries.filter((entry) => entry.enabled).length,
      providers
    };
  }

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
  private readonly lockPath: string;
  private readonly lockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;
  private readonly lockStaleMs: number;

  constructor(options: FileSystemProviderManifestStoreOptions) {
    this.baseDir = resolve(options.baseDir);
    this.statePath = join(this.baseDir, options.stateFileName ?? "provider-manifests.json");
    this.lockPath = join(this.baseDir, ".provider-manifest-store.lock");
    this.lockTimeoutMs = options.lockTimeoutMs ?? defaultLockTimeoutMs;
    this.lockRetryDelayMs = options.lockRetryDelayMs ?? defaultLockRetryDelayMs;
    this.lockStaleMs = options.lockStaleMs ?? defaultLockStaleMs;
  }

  saveManifest(
    manifestInput: ProviderManifest | z.input<typeof ProviderManifestSchema>
  ): ProviderManifest {
    const manifest = parseProviderManifestForStorage(manifestInput);
    return this.withLock(() => {
      const state = this.readState();
      if (state.manifests.some((item) => item.providerId === manifest.providerId)) {
        throw new Error(`duplicate_provider_manifest_id:${manifest.providerId}`);
      }

      state.manifests.push(cloneManifest(manifest));
      this.writeState(state);
      return cloneManifest(manifest);
    });
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
    return this.withLock(() => {
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
    });
  }

  private withLock<T>(fn: () => T): T {
    const token = createLockToken();
    const startedAt = Date.now();

    while (true) {
      try {
        this.ensureBaseDir();
        const fd = openSync(this.lockPath, "wx");
        try {
          writeFileSync(fd, `${JSON.stringify({
            token,
            pid: process.pid,
            createdAt: new Date().toISOString()
          })}\n`, "utf8");
        } finally {
          closeSync(fd);
        }

        try {
          return fn();
        } finally {
          this.releaseLock(token);
        }
      } catch (error) {
        if (!isNodeError(error) || error.code !== "EEXIST") {
          throw error;
        }

        this.removeStaleLock();
        if (Date.now() - startedAt >= this.lockTimeoutMs) {
          throw new Error(`provider_manifest_store_lock_timeout:${this.lockPath}`);
        }

        sleepSync(this.lockRetryDelayMs);
      }
    }
  }

  private releaseLock(token: string): void {
    try {
      const raw = readFileSync(this.lockPath, "utf8");
      const parsed = JSON.parse(raw) as { token?: unknown };
      if (parsed.token === token) {
        unlinkSync(this.lockPath);
      }
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  private removeStaleLock(): void {
    try {
      const staleCandidate = readFileLockSnapshot(this.lockPath);
      if (!isFileLockSnapshotStale(staleCandidate, this.lockStaleMs)) {
        return;
      }
      if (isFileLockOwnerAlive(staleCandidate)) {
        return;
      }

      const current = readFileLockSnapshot(this.lockPath);
      if (
        isSameFileLockSnapshot(staleCandidate, current)
        && isFileLockSnapshotStale(current, this.lockStaleMs)
        && !isFileLockOwnerAlive(current)
      ) {
        unlinkSync(this.lockPath);
      }
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
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

function cloneAttestationEntry(
  entry: ProviderRegistryAttestationEntry
): ProviderRegistryAttestationEntry {
  return structuredClone(entry) as ProviderRegistryAttestationEntry;
}

function toSnapshotEntry(
  entry: ProviderRegistryAttestationEntry
): ProviderRegistrySnapshotEntry {
  const securityBoundary = toSnapshotSecurityBoundary(entry.securityBoundary);
  return {
    providerId: entry.providerId,
    kind: entry.kind,
    displayName: entry.displayName,
    version: entry.version,
    enabled: entry.enabled,
    manifestHash: entry.manifestHash,
    capabilities: [...entry.capabilities],
    securityBoundary,
    supportedSandboxProfiles: structuredClone(entry.supportedSandboxProfiles) as SandboxProfile[],
    supportedSideEffectClasses: [...entry.supportedSideEffectClasses],
    attestation: {
      schemaVersion: entry.attestation.schemaVersion,
      providerId: entry.attestation.providerId,
      kind: entry.attestation.kind,
      displayName: entry.attestation.displayName,
      version: entry.attestation.version,
      manifestHash: entry.attestation.manifestHash,
      capabilities: [...entry.attestation.capabilities],
      securityBoundary,
      supportedSandboxProfiles: structuredClone(
        entry.attestation.supportedSandboxProfiles
      ) as SandboxProfile[],
      supportedSideEffectClasses: [...entry.attestation.supportedSideEffectClasses],
      attestedAt: entry.attestation.attestedAt
    },
    registeredAt: entry.registeredAt
  };
}

function toSnapshotSecurityBoundary(
  boundary: ProviderSecurityBoundary
): ProviderRegistrySnapshotSecurityBoundary {
  return {
    isolation: boundary.isolation,
    networkAccess: boundary.networkAccess,
    filesystemAccess: boundary.filesystemAccess,
    credentialAccess: boundary.secretAccess,
    notes: [...boundary.notes]
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

function readFileLockSnapshot(lockPath: string): FileLockSnapshot {
  const lockStat = statSync(lockPath);
  const raw = readFileSync(lockPath, "utf8");
  const metadata = parseFileLockMetadata(raw);
  return {
    raw,
    mtimeMs: lockStat.mtimeMs,
    ctimeMs: lockStat.ctimeMs,
    size: lockStat.size,
    ...(metadata.createdAtMs !== undefined ? { createdAtMs: metadata.createdAtMs } : {}),
    ...(metadata.pid !== undefined ? { pid: metadata.pid } : {})
  };
}

function isFileLockSnapshotStale(snapshot: FileLockSnapshot, lockStaleMs: number): boolean {
  const now = Date.now();
  if (now - snapshot.mtimeMs < lockStaleMs) {
    return false;
  }
  if (snapshot.createdAtMs !== undefined && now - snapshot.createdAtMs < lockStaleMs) {
    return false;
  }
  return true;
}

function isSameFileLockSnapshot(left: FileLockSnapshot, right: FileLockSnapshot): boolean {
  return left.raw === right.raw
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs
    && left.size === right.size;
}

function isFileLockOwnerAlive(snapshot: FileLockSnapshot): boolean {
  if (snapshot.pid === undefined) {
    return false;
  }
  if (snapshot.pid === process.pid) {
    return true;
  }

  try {
    process.kill(snapshot.pid, 0);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") {
      return false;
    }
    return true;
  }
}

function parseFileLockMetadata(raw: string): { createdAtMs?: number; pid?: number } {
  try {
    const parsed = JSON.parse(raw) as { createdAt?: unknown; pid?: unknown };
    const result: { createdAtMs?: number; pid?: number } = {};

    if (typeof parsed.createdAt === "string") {
      const createdAtMs = Date.parse(parsed.createdAt);
      if (!Number.isNaN(createdAtMs)) {
        result.createdAtMs = createdAtMs;
      }
    }

    if (typeof parsed.pid === "number" && Number.isSafeInteger(parsed.pid) && parsed.pid > 0) {
      result.pid = parsed.pid;
    }

    return result;
  } catch {
    return {};
  }
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

function createLockToken(): string {
  return [
    process.pid,
    Date.now(),
    Math.random().toString(36).slice(2)
  ].join(":");
}

function sleepSync(milliseconds: number): void {
  if (milliseconds <= 0) {
    return;
  }

  const shared = new SharedArrayBuffer(4);
  const view = new Int32Array(shared);
  Atomics.wait(view, 0, 0, milliseconds);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
