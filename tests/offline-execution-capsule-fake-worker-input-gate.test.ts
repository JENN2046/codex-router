import test from "node:test";
import assert from "node:assert/strict";
import {
  createInMemoryContentAddressedStore,
  createOfflineExecutionCapsuleManifest,
  createTestOnlyFakeCapsuleWorker,
  simulateOfflineCapsuleCandidate,
  storeCapsuleTask,
  storeContentTree,
  type CapsuleTaskContract,
  type ContentAddressedStore,
  type OfflineContentTreeFile,
  type OfflineExecutionCapsuleManifest
} from "../packages/execution-capsule/src/index.js";

const startedAt = "2026-07-15T01:01:00.000Z";
const completedAt = "2026-07-15T01:01:01.000Z";

test("fake worker rejects credential-like task content before invoking transform", () => {
  let transformCalls = 0;
  const fixture = createInputFixture({
    instruction: "Use Bearer synthetic-fixture-value while updating the guide."
  });
  const worker = createTestOnlyFakeCapsuleWorker({
    transform(files) {
      transformCalls += 1;
      return files;
    }
  });

  assert.throws(
    () => simulate(fixture.store, fixture.manifest, worker),
    /offline_fake_worker_credential_like_content_forbidden/u
  );
  assert.equal(transformCalls, 0);
});

test("fake worker rejects sensitive input paths before tree blob reads or transform", () => {
  let transformCalls = 0;
  const fixture = createInputFixture({
    inputFiles: [
      { path: ".env", mode: "100644", content: text("synthetic=fixture\n") },
      { path: "docs/guide.md", mode: "100644", content: text("old\n") }
    ]
  });
  const readHashes: string[] = [];
  const observedStore: ContentAddressedStore = {
    put: (...args) => fixture.store.put(...args),
    read(digest) {
      readHashes.push(digest.hash);
      return fixture.store.read(digest);
    }
  };
  const worker = createTestOnlyFakeCapsuleWorker({
    transform(files) {
      transformCalls += 1;
      return files;
    }
  });

  assert.throws(
    () => simulate(observedStore, fixture.manifest, worker),
    /offline_fake_worker_sensitive_path_forbidden/u
  );
  assert.equal(transformCalls, 0);
  assert.deepEqual(readHashes, [
    fixture.manifest.taskDigest.hash,
    fixture.manifest.inputRoot.hash
  ]);
});

test("fake worker rejects credential-like input content before invoking transform", () => {
  let transformCalls = 0;
  const fixture = createInputFixture({
    inputFiles: [
      {
        path: "docs/fixture.txt",
        mode: "100644",
        content: text("Bearer synthetic-fixture-value\n")
      },
      { path: "docs/guide.md", mode: "100644", content: text("old\n") }
    ]
  });
  const worker = createTestOnlyFakeCapsuleWorker({
    transform(files) {
      transformCalls += 1;
      return files;
    }
  });

  assert.throws(
    () => simulate(fixture.store, fixture.manifest, worker),
    /offline_fake_worker_credential_like_content_forbidden/u
  );
  assert.equal(transformCalls, 0);
});

interface InputFixtureOptions {
  instruction?: string;
  inputFiles?: OfflineContentTreeFile[];
}

function createInputFixture(
  options: InputFixtureOptions = {}
): { store: ContentAddressedStore; manifest: OfflineExecutionCapsuleManifest } {
  const store = createInMemoryContentAddressedStore();
  const task: CapsuleTaskContract = {
    schemaVersion: "offline-capsule-task.v1",
    dataClassification: "synthetic_non_sensitive",
    taskId: "capsule-fake-worker-input-gate",
    instruction: options.instruction ?? "Replace the synthetic guide fixture.",
    successCriteria: ["The guide contains the synthetic replacement."],
    outOfScope: ["Any live execution."],
    targetPaths: ["docs/guide.md"]
  };
  const taskDigest = storeCapsuleTask(store, task);
  const inputTree = storeContentTree(store, options.inputFiles ?? [
    { path: "docs/guide.md", mode: "100644", content: text("old\n") }
  ]);
  const manifest = createOfflineExecutionCapsuleManifest({
    schemaVersion: "offline-execution-capsule.v1",
    capsuleId: task.taskId,
    executionMode: "test_only_simulated",
    taskDigest,
    inputRoot: inputTree.digest,
    repository: {
      repositoryId: "1220937060",
      fullName: "JENN2046/codex-router"
    },
    baseHead: "a".repeat(40),
    correlation: {
      threadId: "opaque-thread",
      turnId: "opaque-turn",
      itemId: "opaque-item"
    },
    allowedTargets: task.targetPaths,
    restrictions: {
      networkAccess: "none",
      credentialAccess: "none",
      inheritEnvironment: false,
      hostSocketAccess: false,
      sourceWorkspaceMounted: false,
      gitMetadataMounted: false,
      inputTreeAccess: "immutable_content_tree_only",
      outputForm: "complete_content_tree"
    },
    limits: {
      maxTaskBytes: 64 * 1024,
      maxTreeManifestBytes: 64 * 1024,
      maxTotalTreeFiles: 16,
      maxTotalTreeBytes: 64 * 1024,
      maxChangedFiles: 2,
      maxChangedBytes: 4096,
      maxDiffBytes: 8192
    },
    nonce: "fixture-nonce-0123456789abcdef01",
    issuedAt: "2026-07-15T01:00:00.000Z",
    expiresAt: "2026-07-15T01:10:00.000Z",
    policyVersion: "offline-execution-capsule-policy.v1"
  });
  return { store, manifest };
}

function simulate(
  store: ContentAddressedStore,
  manifest: OfflineExecutionCapsuleManifest,
  worker: unknown
): void {
  const timestamps = [startedAt, completedAt];
  simulateOfflineCapsuleCandidate({
    worker,
    store,
    manifest,
    now: () => timestamps.shift() ?? completedAt
  });
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
