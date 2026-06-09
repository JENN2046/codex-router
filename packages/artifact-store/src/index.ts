import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Buffer } from "node:buffer";

export const artifactStoreTypes = [
  "text",
  "json",
  "patch",
  "file",
  "report"
] as const;

export type ArtifactStoreType = typeof artifactStoreTypes[number];

export type ArtifactPayload = string | Buffer | Uint8Array | Record<string, unknown> | unknown[];

export type ArtifactProvenance = {
  principalId?: string;
  agentId?: string;
  toolId?: string;
  invocationId?: string;
  stepId?: string;
  source?: string;
  [key: string]: unknown;
};

export type PutArtifactInput = {
  artifactId: string;
  taskId: string;
  runId?: string;
  type: ArtifactStoreType;
  payload: ArtifactPayload;
  contentType?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
  provenance?: ArtifactProvenance;
  createdAt?: string;
  alreadyRedacted?: boolean;
  allowOverwrite?: boolean;
};

export type StoredArtifact = {
  artifactId: string;
  taskId: string;
  runId?: string;
  type: ArtifactStoreType;
  uri: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
  contentType?: string;
  fileName?: string;
  metadata: Record<string, unknown>;
  provenance: ArtifactProvenance;
  alreadyRedacted: boolean;
};

export type ArtifactStoreFilter = {
  taskId?: string;
  runId?: string;
  type?: ArtifactStoreType;
};

export type ArtifactVerificationResult = {
  ok: boolean;
  artifactId: string;
  expectedSha256?: string;
  actualSha256?: string;
  reason?: string;
};

export interface ArtifactStore {
  putArtifact(input: PutArtifactInput): Promise<StoredArtifact>;
  getArtifact(artifactId: string): Promise<StoredArtifact | undefined>;
  listArtifacts(filter?: ArtifactStoreFilter): Promise<StoredArtifact[]>;
  verifyArtifact(artifactId: string): Promise<ArtifactVerificationResult>;
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly artifacts = new Map<string, StoredArtifact>();
  private readonly payloads = new Map<string, Buffer>();
  private readonly now: () => string;

  constructor(options: { now?: () => string } = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async putArtifact(input: PutArtifactInput): Promise<StoredArtifact> {
    const normalized = normalizeArtifactInput(input, this.now);
    const existing = this.artifacts.get(normalized.artifact.artifactId);

    if (existing) {
      if (existing.sha256 !== normalized.artifact.sha256 && !input.allowOverwrite) {
        throw new Error(`artifact_hash_mismatch:${input.artifactId}`);
      }

      if (existing.sha256 === normalized.artifact.sha256 && !input.allowOverwrite) {
        return cloneArtifact(existing);
      }
    }

    this.artifacts.set(normalized.artifact.artifactId, cloneArtifact(normalized.artifact));
    this.payloads.set(normalized.artifact.artifactId, Buffer.from(normalized.payload));
    return cloneArtifact(normalized.artifact);
  }

  async getArtifact(artifactId: string): Promise<StoredArtifact | undefined> {
    const artifact = this.artifacts.get(artifactId);
    return artifact ? cloneArtifact(artifact) : undefined;
  }

  async listArtifacts(filter: ArtifactStoreFilter = {}): Promise<StoredArtifact[]> {
    return [...this.artifacts.values()]
      .filter((artifact) => matchesArtifactFilter(artifact, filter))
      .map(cloneArtifact);
  }

  async verifyArtifact(artifactId: string): Promise<ArtifactVerificationResult> {
    const artifact = this.artifacts.get(artifactId);
    const payload = this.payloads.get(artifactId);

    if (!artifact || !payload) {
      return {
        ok: false,
        artifactId,
        reason: "artifact_not_found"
      };
    }

    const actualSha256 = sha256(payload);
    return createVerificationResult({
      ok: actualSha256 === artifact.sha256,
      artifactId,
      expectedSha256: artifact.sha256,
      actualSha256,
      ...(actualSha256 === artifact.sha256 ? {} : { reason: "sha256_mismatch" })
    });
  }
}

export class FileSystemArtifactStore implements ArtifactStore {
  private readonly baseDir: string;
  private readonly now: () => string;

  constructor(options: { baseDir: string; now?: () => string }) {
    this.baseDir = resolve(options.baseDir);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async putArtifact(input: PutArtifactInput): Promise<StoredArtifact> {
    const normalized = normalizeArtifactInput(input, this.now);
    const artifactDir = this.getArtifactDir(normalized.artifact.artifactId);
    const metadataPath = this.getMetadataPath(normalized.artifact.artifactId);
    const payloadPath = this.getPayloadPath(normalized.artifact.artifactId);
    const existing = await readArtifactMetadata(metadataPath);

    if (existing) {
      if (existing.sha256 !== normalized.artifact.sha256 && !input.allowOverwrite) {
        throw new Error(`artifact_hash_mismatch:${input.artifactId}`);
      }

      if (existing.sha256 === normalized.artifact.sha256 && !input.allowOverwrite) {
        return existing;
      }
    }

    await mkdir(artifactDir, { recursive: true });
    await writeFile(payloadPath, normalized.payload);
    await writeFile(
      metadataPath,
      `${JSON.stringify(stripUndefined(normalized.artifact), null, 2)}\n`,
      "utf8"
    );

    return cloneArtifact(normalized.artifact);
  }

  async getArtifact(artifactId: string): Promise<StoredArtifact | undefined> {
    const metadataPath = this.getMetadataPath(artifactId);
    return readArtifactMetadata(metadataPath);
  }

  async listArtifacts(filter: ArtifactStoreFilter = {}): Promise<StoredArtifact[]> {
    await mkdir(this.baseDir, { recursive: true });
    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const artifacts: StoredArtifact[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const artifact = await this.getArtifact(entry.name);
      if (artifact && matchesArtifactFilter(artifact, filter)) {
        artifacts.push(artifact);
      }
    }

    return artifacts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async verifyArtifact(artifactId: string): Promise<ArtifactVerificationResult> {
    const artifact = await this.getArtifact(artifactId);
    if (!artifact) {
      return {
        ok: false,
        artifactId,
        reason: "artifact_not_found"
      };
    }

    const payloadPath = this.getPayloadPath(artifactId);
    const payload = await readFile(payloadPath).catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return undefined;
      }

      throw error;
    });

    if (!payload) {
      return {
        ok: false,
        artifactId,
        expectedSha256: artifact.sha256,
        reason: "artifact_payload_not_found"
      };
    }

    const actualSha256 = sha256(payload);

    return createVerificationResult({
      ok: actualSha256 === artifact.sha256,
      artifactId,
      expectedSha256: artifact.sha256,
      actualSha256,
      ...(actualSha256 === artifact.sha256 ? {} : { reason: "sha256_mismatch" })
    });
  }

  private getArtifactDir(artifactId: string): string {
    assertSafeArtifactId(artifactId);
    const dir = resolve(this.baseDir, artifactId);
    assertInsideBaseDir(this.baseDir, dir);
    return dir;
  }

  private getMetadataPath(artifactId: string): string {
    return resolve(this.getArtifactDir(artifactId), "metadata.json");
  }

  private getPayloadPath(artifactId: string): string {
    return resolve(this.getArtifactDir(artifactId), "payload");
  }
}

export function redactArtifactMetadata(input: Record<string, unknown>): Record<string, unknown> {
  return redactSecretLikeFields(input) as Record<string, unknown>;
}

export function hashArtifactPayload(payload: ArtifactPayload, type: ArtifactStoreType): string {
  return sha256(normalizePayload(payload, type));
}

function normalizeArtifactInput(
  input: PutArtifactInput,
  now: () => string
): { artifact: StoredArtifact; payload: Buffer } {
  assertSafeArtifactId(input.artifactId);
  assertArtifactType(input.type);

  if (!input.taskId) {
    throw new Error("artifact_task_id_required");
  }

  const payload = normalizePayload(input.payload, input.type);
  const artifactBase = {
    artifactId: input.artifactId,
    taskId: input.taskId,
    type: input.type,
    uri: `artifact://${input.artifactId}/payload`,
    sha256: sha256(payload),
    sizeBytes: payload.byteLength,
    createdAt: input.createdAt ?? now(),
    metadata: redactArtifactMetadata(input.metadata ?? {}),
    provenance: redactArtifactMetadata(input.provenance ?? {}) as ArtifactProvenance,
    alreadyRedacted: input.alreadyRedacted ?? false
  };

  const artifact: StoredArtifact = {
    ...artifactBase,
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.contentType ? { contentType: input.contentType } : {}),
    ...(input.fileName ? { fileName: input.fileName } : {})
  };

  return { artifact, payload };
}

function normalizePayload(payload: ArtifactPayload, type: ArtifactStoreType): Buffer {
  if (Buffer.isBuffer(payload)) {
    return Buffer.from(payload);
  }

  if (payload instanceof Uint8Array) {
    return Buffer.from(payload);
  }

  if (typeof payload === "string") {
    return Buffer.from(payload, "utf8");
  }

  if (type !== "json" && type !== "report") {
    throw new Error(`artifact_payload_must_be_bytes_or_string:${type}`);
  }

  return Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function assertArtifactType(type: string): asserts type is ArtifactStoreType {
  if (!artifactStoreTypes.includes(type as ArtifactStoreType)) {
    throw new Error(`unknown_artifact_type:${type}`);
  }
}

function assertSafeArtifactId(artifactId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(artifactId)) {
    throw new Error(`unsafe_artifact_id:${artifactId}`);
  }

  if (artifactId.includes("..") || artifactId.includes("/") || artifactId.includes("\\")) {
    throw new Error(`unsafe_artifact_id:${artifactId}`);
  }
}

function assertInsideBaseDir(baseDir: string, candidate: string): void {
  const normalizedBase = baseDir.endsWith(sep) ? baseDir : `${baseDir}${sep}`;
  if (candidate !== baseDir && !candidate.startsWith(normalizedBase)) {
    throw new Error("artifact_path_traversal_rejected");
  }
}

async function readArtifactMetadata(path: string): Promise<StoredArtifact | undefined> {
  try {
    const pathStat = await stat(path);
    if (!pathStat.isFile()) {
      return undefined;
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  const raw = await readFile(path, "utf8");
  return cloneArtifact(JSON.parse(raw) as StoredArtifact);
}

function matchesArtifactFilter(artifact: StoredArtifact, filter: ArtifactStoreFilter): boolean {
  return matchesOptional(filter.taskId, artifact.taskId)
    && matchesOptional(filter.runId, artifact.runId)
    && matchesOptional(filter.type, artifact.type);
}

function createVerificationResult(input: {
  ok: boolean;
  artifactId: string;
  expectedSha256: string;
  actualSha256: string;
  reason?: string;
}): ArtifactVerificationResult {
  return {
    ok: input.ok,
    artifactId: input.artifactId,
    expectedSha256: input.expectedSha256,
    actualSha256: input.actualSha256,
    ...(input.reason ? { reason: input.reason } : {})
  };
}

function matchesOptional<T>(expected: T | undefined, actual: T | undefined): boolean {
  return expected === undefined || expected === actual;
}

function sha256(payload: Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}

function redactSecretLikeFields(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(redactSecretLikeFields);
  }

  if (!isRecord(input)) {
    return input;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    output[key] = isSecretLikeKey(key)
      ? "<REDACTED_SECRET>"
      : redactSecretLikeFields(value);
  }

  return output;
}

function isSecretLikeKey(key: string): boolean {
  return /api[-_]?key|authorization|credential|password|secret|token/i.test(key);
}

function stripUndefined(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(stripUndefined);
  }

  if (!isRecord(input)) {
    return input;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = stripUndefined(value);
    }
  }

  return output;
}

function cloneArtifact(artifact: StoredArtifact): StoredArtifact {
  return structuredClone(artifact);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
