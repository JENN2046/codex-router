import { isProxy } from "node:util/types";
import {
  OfflineExecutionCapsuleManifestSchema,
  assertPassiveJsonValue,
  createOfflineOutputTreeReceipt,
  sameCanonicalJson,
  type CapsuleTaskContract,
  type OfflineExecutionCapsuleManifest,
  type OfflineOutputTreeReceipt
} from "./contracts.js";
import {
  loadCapsuleTask,
  loadContentTree,
  storeContentTree,
  type ContentAddressedStore,
  type OfflineContentTreeFile
} from "./content-addressed-store.js";

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
  const task = loadCapsuleTask(input.store, manifest.taskDigest, "worker_task");
  if (
    task.taskId !== manifest.capsuleId
    || !sameCanonicalJson(task.targetPaths, manifest.allowedTargets)
  ) {
    throw new Error("offline_fake_worker_task_binding_mismatch");
  }
  const inputTree = loadContentTree(input.store, manifest.inputRoot, "worker_input");
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

function getTrustedFakeWorker(worker: unknown): TrustedFakeWorkerDefinition {
  if (worker === null || typeof worker !== "object" || isProxy(worker)) {
    throw new Error("offline_fake_worker_untrusted");
  }
  if (Reflect.ownKeys(worker).length !== 0) {
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
    const slotDescriptor = Object.getOwnPropertyDescriptor(output, String(index));
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
    const ownKeys = Reflect.ownKeys(file);
    const stringKeys = ownKeys.filter((key): key is string => typeof key === "string");
    const pathDescriptor = Object.getOwnPropertyDescriptor(file, "path");
    const modeDescriptor = Object.getOwnPropertyDescriptor(file, "mode");
    const contentDescriptor = Object.getOwnPropertyDescriptor(file, "content");
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
      content: new Uint8Array(content)
    });
  }
  return files;
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
