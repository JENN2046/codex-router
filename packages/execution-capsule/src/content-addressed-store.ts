import type { z } from "zod";
import { isProxy } from "node:util/types";
import {
  CapsuleTaskContractSchema,
  ContentDigestSchema,
  ContentTreeManifestSchema,
  assertPassiveJsonValue,
  canonicalJsonBytes,
  createContentTreeManifest,
  digestBytes,
  ownPassiveKeys,
  ownStringPropertyDescriptor,
  sameContentDigest,
  type CapsuleTaskContract,
  type ContentDigest,
  type ContentTreeEntry,
  type ContentTreeManifest
} from "./contracts.js";

export interface ContentAddressedStore {
  put(bytes: Uint8Array, expectedDigest?: ContentDigest): ContentDigest;
  read(digest: ContentDigest): Uint8Array;
}

export class InMemoryContentAddressedStore implements ContentAddressedStore {
  private readonly blobs = new Map<string, Uint8Array>();

  put(bytesInput: Uint8Array, expectedDigest?: ContentDigest): ContentDigest {
    const bytes = new Uint8Array(bytesInput);
    const digest = digestBytes(bytes);
    if (
      expectedDigest !== undefined
      && !sameContentDigest(ContentDigestSchema.parse(expectedDigest), digest)
    ) {
      throw new Error("offline_cas_expected_digest_mismatch");
    }

    const existing = this.blobs.get(digest.hash);
    if (existing !== undefined) {
      if (!sameBytes(existing, bytes)) {
        throw new Error("offline_cas_digest_conflict");
      }
      const existingDigest = digestBytes(existing);
      if (!sameContentDigest(existingDigest, digest)) {
        throw new Error("offline_cas_existing_content_corrupt");
      }
      return { ...digest };
    }

    this.blobs.set(digest.hash, bytes);
    return { ...digest };
  }

  read(digestInput: ContentDigest): Uint8Array {
    const digest = ContentDigestSchema.parse(digestInput);
    const stored = this.blobs.get(digest.hash);
    if (stored === undefined) {
      throw new Error("offline_cas_content_missing");
    }
    const actual = digestBytes(stored);
    if (!sameContentDigest(actual, digest)) {
      throw new Error("offline_cas_content_corrupt");
    }
    return new Uint8Array(stored);
  }
}

export interface OfflineContentTreeFile {
  path: string;
  mode: "100644" | "100755";
  content: Uint8Array;
}

export interface LoadedContentTreeFile extends OfflineContentTreeFile {
  digest: ContentDigest;
}

export interface StoredContentTree {
  manifest: ContentTreeManifest;
  digest: ContentDigest;
}

export interface LoadedContentTree extends StoredContentTree {
  files: LoadedContentTreeFile[];
}

export function createInMemoryContentAddressedStore(): ContentAddressedStore {
  return new InMemoryContentAddressedStore();
}

export function storeCapsuleTask(
  store: ContentAddressedStore,
  taskInput: CapsuleTaskContract
): ContentDigest {
  assertPassiveJsonValue(taskInput);
  const task = CapsuleTaskContractSchema.parse(taskInput);
  return store.put(canonicalJsonBytes(task));
}

export function loadCapsuleTask(
  store: ContentAddressedStore,
  digest: ContentDigest,
  context = "task"
): CapsuleTaskContract {
  return readCanonicalObject(
    store,
    digest,
    CapsuleTaskContractSchema,
    `offline_capsule_${context}`
  );
}

export function storeContentTree(
  store: ContentAddressedStore,
  filesInput: OfflineContentTreeFile[],
  reuseFrom?: LoadedContentTree
): StoredContentTree {
  const files = snapshotPassiveFileArray(filesInput);
  validateContentTreeFilesBeforeStore(files);
  const reuseEntries = new Map(
    (reuseFrom?.files ?? []).map((file) => [file.path, file] as const)
  );
  const entries: ContentTreeEntry[] = files.map((file) => {
    const content = file.content;
    const reusable = reuseEntries.get(file.path);
    const blob = reusable !== undefined
      && reusable.mode === file.mode
      && sameBytes(reusable.content, content)
      ? store.put(content, reusable.digest)
      : store.put(content);
    return {
      path: file.path,
      nodeType: "regular_file",
      mode: file.mode,
      blob
    };
  });
  const manifest = createContentTreeManifest(entries);
  const digest = store.put(canonicalJsonBytes(manifest));
  return { manifest, digest };
}

export function loadContentTree(
  store: ContentAddressedStore,
  digest: ContentDigest,
  context = "tree"
): LoadedContentTree {
  const manifest = readCanonicalObject(
    store,
    digest,
    ContentTreeManifestSchema,
    `offline_capsule_${context}_manifest`
  );
  const files = manifest.entries.map((entry) => ({
    path: entry.path,
    mode: entry.mode,
    digest: { ...entry.blob },
    content: readVerifiedBytes(
      store,
      entry.blob,
      `offline_capsule_${context}_blob`
    )
  }));
  return {
    manifest,
    digest: ContentDigestSchema.parse(digest),
    files
  };
}

export function readVerifiedBytes(
  store: ContentAddressedStore,
  digestInput: ContentDigest,
  context = "content"
): Uint8Array {
  const digest = ContentDigestSchema.parse(digestInput);
  let bytes: Uint8Array;
  try {
    bytes = store.read(digest);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown";
    if (reason === "offline_cas_content_missing") {
      throw new Error(`${context}_missing`);
    }
    throw new Error(`${context}_read_failed`);
  }
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`${context}_non_bytes`);
  }
  const copy = new Uint8Array(bytes);
  if (!sameContentDigest(digestBytes(copy), digest)) {
    throw new Error(`${context}_digest_mismatch`);
  }
  return copy;
}

export function readCanonicalObject<T>(
  store: ContentAddressedStore,
  digest: ContentDigest,
  schema: z.ZodType<T>,
  context = "offline_capsule_object"
): T {
  const bytes = readVerifiedBytes(store, digest, context);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${context}_utf8_invalid`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${context}_json_invalid`);
  }
  try {
    assertPassiveJsonValue(raw);
  } catch {
    throw new Error(`${context}_data_invalid`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${context}_schema_invalid`);
  }
  if (!sameBytes(bytes, canonicalJsonBytes(parsed.data))) {
    throw new Error(`${context}_noncanonical_bytes`);
  }
  return parsed.data;
}

export function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left.at(index) !== right.at(index)) {
      return false;
    }
  }
  return true;
}

function snapshotPassiveFileArray(
  input: OfflineContentTreeFile[]
): OfflineContentTreeFile[] {
  if (!Array.isArray(input) || isProxy(input)) {
    throw new Error("offline_capsule_tree_files_invalid");
  }
  const aliases = new Set<string>();
  const snapshots: OfflineContentTreeFile[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const elementDescriptor = ownStringPropertyDescriptor(input, String(index));
    if (
      elementDescriptor === undefined
      || elementDescriptor.get !== undefined
      || elementDescriptor.set !== undefined
    ) {
      throw new Error("offline_capsule_tree_file_invalid");
    }
    const file = elementDescriptor.value as unknown;
    if (file === null || typeof file !== "object" || isProxy(file)) {
      throw new Error("offline_capsule_tree_file_invalid");
    }
    for (const key of ownPassiveKeys(file)) {
      if (typeof key === "symbol") {
        throw new Error("offline_capsule_tree_file_accessor");
      }
      const descriptor = ownStringPropertyDescriptor(file, key);
      if (
        descriptor === undefined
        || descriptor.get !== undefined
        || descriptor.set !== undefined
      ) {
        throw new Error("offline_capsule_tree_file_accessor");
      }
    }
    const pathDescriptor = ownStringPropertyDescriptor(file, "path");
    const modeDescriptor = ownStringPropertyDescriptor(file, "mode");
    const contentDescriptor = ownStringPropertyDescriptor(file, "content");
    if (
      pathDescriptor === undefined
      || modeDescriptor === undefined
      || contentDescriptor === undefined
      || typeof pathDescriptor.value !== "string"
      || (modeDescriptor.value !== "100644" && modeDescriptor.value !== "100755")
    ) {
      throw new Error("offline_capsule_tree_file_invalid");
    }
    const content = contentDescriptor.value as unknown;
    if (isProxy(content) || !(content instanceof Uint8Array)) {
      throw new Error("offline_capsule_tree_content_invalid");
    }
    const path = pathDescriptor.value;
    const mode = modeDescriptor.value;
    const alias = path.normalize("NFC").toLocaleLowerCase("en-US");
    if (aliases.has(alias)) {
      throw new Error("offline_capsule_tree_path_alias_collision");
    }
    aliases.add(alias);
    snapshots.push({ path, mode, content: new Uint8Array(content) });
  }
  return snapshots;
}

function validateContentTreeFilesBeforeStore(files: OfflineContentTreeFile[]): void {
  const placeholderBlob: ContentDigest = {
    algorithm: "sha256",
    hash: "0".repeat(64),
    size: 0
  };
  createContentTreeManifest(files.map((file) => ({
    path: file.path,
    nodeType: "regular_file" as const,
    mode: file.mode,
    blob: placeholderBlob
  })));
}
