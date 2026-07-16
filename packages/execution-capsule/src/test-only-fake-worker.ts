import { isProxy } from "node:util/types";
import {
  OfflineExecutionCapsuleManifestSchema,
  assertPassiveJsonValue,
  canonicalJsonBytes,
  createContentTreeManifest,
  createOfflineOutputTreeReceipt,
  ownPassiveKeys,
  ownStringPropertyDescriptor,
  sameCanonicalJson,
  type CapsuleTaskContract,
  type ContentTreeManifest,
  type OfflineExecutionCapsuleManifest,
  type OfflineOutputTreeReceipt
} from "./contracts.js";
import {
  loadCapsuleTask,
  loadContentTree,
  loadContentTreeManifest,
  storeContentTree,
  type ContentAddressedStore,
  type OfflineContentTreeFile
} from "./content-addressed-store.js";
import {
  containsCredentialLikeTaskContent,
  containsCredentialLikeTreeContent,
  isSensitiveOfflineTreePath
} from "./input-safety.js";
import { createCanonicalUnifiedDiff, decodeChangedText } from "./verifier.js";

declare const testOnlyFakeWorkerBrand: unique symbol;

export interface TestOnlyFakeCapsuleWorker {
  readonly [testOnlyFakeWorkerBrand]: never;
}

export interface TestOnlyFakeWorkerFile {
  readonly path: string;
  readonly mode: "100644" | "100755";
  readonly content: Uint8Array;
}

export type TestOnlyDeterministicTreeTransform = (
  inputTree: readonly TestOnlyFakeWorkerFile[],
  task: Readonly<CapsuleTaskContract>
) => readonly TestOnlyFakeWorkerFile[];

export interface TestOnlyFakeCapsuleWorkerOptions {
  transform: TestOnlyDeterministicTreeTransform;
  cleanupStatus?: "succeeded" | "failed";
  simulatedChecks?: Array<{
    checkId: string;
    summary: string;
  }>;
}

export interface SimulateOfflineCapsuleCandidateInput {
  worker: unknown;
  store: ContentAddressedStore;
  manifest: unknown;
  now: () => string;
}

interface TrustedFakeWorkerDefinition {
  transform: TestOnlyDeterministicTreeTransform;
  cleanupStatus: "succeeded" | "failed";
  simulatedChecks: Array<{
    checkId: string;
    summary: string;
  }>;
}

const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
)?.get;
const TYPED_ARRAY_AT = Uint8Array.prototype.at;

const trustedFakeWorkers = new WeakMap<object, TrustedFakeWorkerDefinition>();

export function createTestOnlyFakeCapsuleWorker(
  options: TestOnlyFakeCapsuleWorkerOptions
): TestOnlyFakeCapsuleWorker {
  if (typeof options.transform !== "function" || isProxy(options.transform)) {
    throw new Error("offline_fake_worker_transform_invalid");
  }
  const simulatedChecks = (options.simulatedChecks ?? [{
    checkId: "synthetic-success-criteria",
    summary: "success criteria evaluated by deterministic test fixture"
  }]).map((check) => ({ ...check }));
  const token = Object.freeze({});
  trustedFakeWorkers.set(token, {
    transform: options.transform,
    cleanupStatus: options.cleanupStatus ?? "succeeded",
    simulatedChecks
  });
  return token as TestOnlyFakeCapsuleWorker;
}

export function simulateOfflineCapsuleCandidate(
  input: SimulateOfflineCapsuleCandidateInput
): OfflineOutputTreeReceipt {
  const definition = getTrustedFakeWorker(input.worker);
  let manifest: OfflineExecutionCapsuleManifest;
  try {
    assertPassiveJsonValue(input.manifest);
    manifest = OfflineExecutionCapsuleManifestSchema.parse(input.manifest);
  } catch {
    throw new Error("offline_fake_worker_manifest_invalid");
  }

  const startedAt = input.now();
  if (!isTimestampWithinManifest(startedAt, manifest)) {
    throw new Error("offline_fake_worker_manifest_not_current");
  }
  if (manifest.taskDigest.size > manifest.limits.maxTaskBytes) {
    throw new Error("offline_fake_worker_task_byte_limit_exceeded");
  }
  const task = loadCapsuleTask(input.store, manifest.taskDigest, "worker_task");
  if (
    task.taskId !== manifest.capsuleId
    || !sameCanonicalJson(task.targetPaths, manifest.allowedTargets)
  ) {
    throw new Error("offline_fake_worker_task_binding_mismatch");
  }
  assertFakeWorkerTaskSafe(task);
  if (manifest.inputRoot.size > manifest.limits.maxTreeManifestBytes) {
    throw new Error("offline_fake_worker_tree_manifest_byte_limit_exceeded");
  }
  const inputTreeManifest = loadContentTreeManifest(
    input.store,
    manifest.inputRoot,
    "worker_input"
  );
  assertFakeWorkerInputTreeManifestSafe(inputTreeManifest.manifest, manifest);
  const inputTree = loadContentTree(input.store, manifest.inputRoot, "worker_input");
  assertFakeWorkerInputTreeContentSafe(inputTree.files);
  const workerInput = Object.freeze(inputTree.files.map((file) => Object.freeze({
    path: file.path,
    mode: file.mode,
    content: new Uint8Array(file.content)
  })));

  let output: readonly TestOnlyFakeWorkerFile[];
  try {
    output = definition.transform(workerInput, structuredClone(task));
  } catch {
    throw new Error("offline_fake_worker_transform_failed");
  }
  const outputFiles = validateWorkerOutput(output);
  assertFakeWorkerOutputPrestoreSafe(
    outputFiles,
    inputTree.files,
    inputTreeManifest.manifest,
    manifest
  );
  const outputTree = storeContentTree(input.store, outputFiles, inputTree);
  const completedAt = input.now();

  return createOfflineOutputTreeReceipt({
    schemaVersion: "offline-output-tree-receipt.v1",
    receiptId: `${manifest.capsuleId}:offline-output`,
    capsuleId: manifest.capsuleId,
    executionMode: "test_only_simulated",
    manifestHash: manifest.manifestHash,
    taskDigest: { ...manifest.taskDigest },
    inputRoot: { ...manifest.inputRoot },
    outputRoot: { ...outputTree.digest },
    repository: { ...manifest.repository },
    baseHead: manifest.baseHead,
    correlation: { ...manifest.correlation },
    worker: {
      workerId: "offline-test-only-fake-worker",
      workerVersion: "1",
      scope: "test_only"
    },
    nonce: manifest.nonce,
    startedAt,
    completedAt,
    checks: definition.simulatedChecks.map((check) => ({
      ...check,
      status: "simulated" as const
    })),
    cleanup: {
      attempted: true,
      status: definition.cleanupStatus
    }
  });
}

function assertFakeWorkerTaskSafe(task: CapsuleTaskContract): void {
  if (task.targetPaths.some(isSensitiveOfflineTreePath)) {
    throw new Error("offline_fake_worker_sensitive_path_forbidden");
  }
  if (containsCredentialLikeTaskContent(task)) {
    throw new Error("offline_fake_worker_credential_like_content_forbidden");
  }
}

function assertFakeWorkerInputTreeManifestSafe(
  inputTreeManifest: ContentTreeManifest,
  manifest: OfflineExecutionCapsuleManifest
): void {
  if (inputTreeManifest.entries.length > manifest.limits.maxTotalTreeFiles) {
    throw new Error("offline_fake_worker_total_tree_file_limit_exceeded");
  }
  let remainingBytes = manifest.limits.maxTotalTreeBytes;
  for (const entry of inputTreeManifest.entries) {
    if (entry.blob.size > remainingBytes) {
      throw new Error("offline_fake_worker_total_tree_byte_limit_exceeded");
    }
    remainingBytes -= entry.blob.size;
  }
  if (inputTreeManifest.entries.some((entry) => isSensitiveOfflineTreePath(entry.path))) {
    throw new Error("offline_fake_worker_sensitive_path_forbidden");
  }
}

function assertFakeWorkerInputTreeContentSafe(
  files: readonly OfflineContentTreeFile[]
): void {
  if (containsCredentialLikeTreeContent(files)) {
    throw new Error("offline_fake_worker_credential_like_content_forbidden");
  }
}

function getTrustedFakeWorker(worker: unknown): TrustedFakeWorkerDefinition {
  if (worker === null || typeof worker !== "object" || isProxy(worker)) {
    throw new Error("offline_fake_worker_untrusted");
  }
  if (ownPassiveKeys(worker).length !== 0) {
    throw new Error("offline_fake_worker_untrusted");
  }
  const definition = trustedFakeWorkers.get(worker);
  if (definition === undefined) {
    throw new Error("offline_fake_worker_untrusted");
  }
  return definition;
}

function validateWorkerOutput(
  output: readonly TestOnlyFakeWorkerFile[]
): OfflineContentTreeFile[] {
  if (!Array.isArray(output) || isProxy(output)) {
    throw new Error("offline_fake_worker_output_invalid");
  }
  const files: OfflineContentTreeFile[] = [];
  for (let index = 0; index < output.length; index += 1) {
    const slotDescriptor = ownStringPropertyDescriptor(output, String(index));
    if (
      slotDescriptor === undefined
      || slotDescriptor.get !== undefined
      || slotDescriptor.set !== undefined
    ) {
      throw new Error("offline_fake_worker_output_invalid");
    }
    const file = slotDescriptor.value as unknown;
    if (
      file === null
      || typeof file !== "object"
      || isProxy(file)
      || Object.getPrototypeOf(file) !== Object.prototype
    ) {
      throw new Error("offline_fake_worker_output_invalid");
    }
    const ownKeys = ownPassiveKeys(file);
    const stringKeys = ownKeys.filter((key): key is string => typeof key === "string");
    const pathDescriptor = ownStringPropertyDescriptor(file, "path");
    const modeDescriptor = ownStringPropertyDescriptor(file, "mode");
    const contentDescriptor = ownStringPropertyDescriptor(file, "content");
    if (
      stringKeys.length !== ownKeys.length
      || stringKeys.sort().join("\0") !== "content\0mode\0path"
      || pathDescriptor === undefined
      || modeDescriptor === undefined
      || contentDescriptor === undefined
      || pathDescriptor.get !== undefined
      || pathDescriptor.set !== undefined
      || modeDescriptor.get !== undefined
      || modeDescriptor.set !== undefined
      || contentDescriptor.get !== undefined
      || contentDescriptor.set !== undefined
    ) {
      throw new Error("offline_fake_worker_output_invalid");
    }
    const path = pathDescriptor.value as unknown;
    const mode = modeDescriptor.value as unknown;
    const content = contentDescriptor.value as unknown;
    if (
      typeof path !== "string"
      || (mode !== "100644" && mode !== "100755")
      || isProxy(content)
      || !(content instanceof Uint8Array)
    ) {
      throw new Error("offline_fake_worker_output_invalid");
    }
    files.push({
      path,
      mode,
      content
    });
  }
  return files;
}

function assertFakeWorkerOutputPrestoreSafe(
  outputFiles: readonly OfflineContentTreeFile[],
  inputFiles: readonly OfflineContentTreeFile[],
  inputTreeManifest: ContentTreeManifest,
  manifest: OfflineExecutionCapsuleManifest
): void {
  let remainingFiles = manifest.limits.maxTotalTreeFiles
    - inputTreeManifest.entries.length;
  let remainingTreeBytes = manifest.limits.maxTotalTreeBytes;
  for (const entry of inputTreeManifest.entries) {
    if (entry.blob.size > remainingTreeBytes) {
      throw new Error("offline_fake_worker_total_tree_byte_limit_exceeded");
    }
    remainingTreeBytes -= entry.blob.size;
  }

  const outputByteLengths: number[] = [];
  for (const file of outputFiles) {
    if (remainingFiles <= 0) {
      throw new Error("offline_fake_worker_total_tree_file_limit_exceeded");
    }
    remainingFiles -= 1;
    if (isSensitiveOfflineTreePath(file.path)) {
      throw new Error("offline_fake_worker_sensitive_path_forbidden");
    }
    const byteLength = readPassiveUint8ArrayByteLength(file.content);
    if (byteLength > remainingTreeBytes) {
      throw new Error("offline_fake_worker_total_tree_byte_limit_exceeded");
    }
    remainingTreeBytes -= byteLength;
    outputByteLengths.push(byteLength);
  }

  // Digest hashes have a fixed width, so placeholder hashes plus the real byte
  // lengths produce the exact canonical output-manifest byte length without
  // copying or storing transform output.
  const placeholderHash = "0".repeat(64);
  let outputManifest: ContentTreeManifest;
  try {
    outputManifest = createContentTreeManifest(outputFiles.map((file, index) => ({
      path: file.path,
      nodeType: "regular_file" as const,
      mode: file.mode,
      blob: {
        algorithm: "sha256" as const,
        hash: placeholderHash,
        size: outputByteLengths.at(index)!
      }
    })));
  } catch {
    throw new Error("offline_fake_worker_output_invalid");
  }
  if (canonicalJsonBytes(outputManifest).byteLength > manifest.limits.maxTreeManifestBytes) {
    throw new Error("offline_fake_worker_tree_manifest_byte_limit_exceeded");
  }

  assertFakeWorkerChangedBudgetSafe(outputFiles, outputByteLengths, inputFiles, manifest);
  try {
    if (containsCredentialLikeTreeContent(outputFiles)) {
      throw new Error("offline_fake_worker_credential_like_content_forbidden");
    }
  } catch (error: unknown) {
    if (
      error instanceof Error
      && error.message === "offline_fake_worker_credential_like_content_forbidden"
    ) {
      throw error;
    }
    throw new Error("offline_fake_worker_output_invalid");
  }
}

function assertFakeWorkerChangedBudgetSafe(
  outputFiles: readonly OfflineContentTreeFile[],
  outputByteLengths: readonly number[],
  inputFiles: readonly OfflineContentTreeFile[],
  manifest: OfflineExecutionCapsuleManifest
): void {
  const inputByPath = new Map(inputFiles.map((file) => [file.path, file] as const));
  let remainingChangedFiles = manifest.limits.maxChangedFiles;
  let remainingChangedBytes = manifest.limits.maxChangedBytes;
  let remainingDiffBytes = manifest.limits.maxDiffBytes;
  for (let index = 0; index < outputFiles.length; index += 1) {
    const outputFile = outputFiles.at(index)!;
    const outputByteLength = outputByteLengths.at(index)!;
    const inputFile = inputByPath.get(outputFile.path);
    if (
      inputFile !== undefined
      && samePassiveBytes(
        inputFile.content,
        outputFile.content,
        inputFile.content.byteLength,
        outputByteLength
      )
    ) {
      continue;
    }
    if (remainingChangedFiles === 0) {
      throw new Error("offline_fake_worker_changed_file_limit_exceeded");
    }
    remainingChangedFiles -= 1;
    const inputByteLength = inputFile?.content.byteLength ?? 0;
    if (
      inputByteLength > remainingChangedBytes
      || outputByteLength > remainingChangedBytes - inputByteLength
    ) {
      throw new Error("offline_fake_worker_changed_byte_limit_exceeded");
    }
    remainingChangedBytes -= inputByteLength + outputByteLength;
    let unifiedDiff: string;
    try {
      unifiedDiff = createCanonicalUnifiedDiff(
        outputFile.path,
        inputFile === undefined ? undefined : decodeChangedText(inputFile.content),
        decodeChangedText(outputFile.content)
      );
    } catch (error: unknown) {
      if (
        error instanceof Error
        && error.message === "offline_capsule_changed_binary_forbidden"
      ) {
        throw new Error("offline_fake_worker_changed_binary_forbidden");
      }
      throw new Error("offline_fake_worker_output_invalid");
    }
    const diffBytes = new TextEncoder().encode(unifiedDiff).byteLength;
    if (diffBytes > remainingDiffBytes) {
      throw new Error("offline_fake_worker_diff_limit_exceeded");
    }
    remainingDiffBytes -= diffBytes;
  }
}

function readPassiveUint8ArrayByteLength(content: Uint8Array): number {
  if (TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined) {
    throw new Error("offline_fake_worker_output_invalid");
  }
  let byteLength: unknown;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(content);
    TYPED_ARRAY_AT.call(content, 0);
  } catch {
    throw new Error("offline_fake_worker_output_invalid");
  }
  if (!Number.isSafeInteger(byteLength) || (byteLength as number) < 0) {
    throw new Error("offline_fake_worker_output_invalid");
  }
  return byteLength as number;
}

function samePassiveBytes(
  left: Uint8Array,
  right: Uint8Array,
  leftByteLength: number,
  rightByteLength: number
): boolean {
  if (leftByteLength !== rightByteLength) {
    return false;
  }
  try {
    for (let index = 0; index < leftByteLength; index += 1) {
      if (
        TYPED_ARRAY_AT.call(left, index)
        !== TYPED_ARRAY_AT.call(right, index)
      ) {
        return false;
      }
    }
  } catch {
    throw new Error("offline_fake_worker_output_invalid");
  }
  return true;
}

function isTimestampWithinManifest(
  timestamp: string,
  manifest: OfflineExecutionCapsuleManifest
): boolean {
  const now = Date.parse(timestamp);
  const issuedAt = Date.parse(manifest.issuedAt);
  const expiresAt = Date.parse(manifest.expiresAt);
  return Number.isFinite(now)
    && Number.isFinite(issuedAt)
    && Number.isFinite(expiresAt)
    && issuedAt <= now
    && now <= expiresAt
    && issuedAt < expiresAt;
}
