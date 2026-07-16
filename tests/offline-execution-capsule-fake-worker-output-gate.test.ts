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
  type OfflineExecutionCapsuleManifest,
  type TestOnlyFakeWorkerFile
} from "../packages/execution-capsule/src/index.js";

const startedAt = "2026-07-15T01:01:00.000Z";
const completedAt = "2026-07-15T01:01:01.000Z";

test("fake worker rejects invalid registration and manifest preconditions", () => {
  assert.throws(
    () => createTestOnlyFakeCapsuleWorker({ transform: undefined as never }),
    /offline_fake_worker_transform_invalid/u
  );
  const proxiedTransform = new Proxy(
    ((files: readonly TestOnlyFakeWorkerFile[]) => files),
    {}
  );
  assert.throws(
    () => createTestOnlyFakeCapsuleWorker({ transform: proxiedTransform }),
    /offline_fake_worker_transform_invalid/u
  );

  const validFixture = createOutputFixture();
  const worker = createTestOnlyFakeCapsuleWorker({ transform: (files) => files });
  assert.throws(
    () => simulate(validFixture.store, {} as OfflineExecutionCapsuleManifest, worker),
    /offline_fake_worker_manifest_invalid/u
  );
  assert.throws(
    () => simulateOfflineCapsuleCandidate({
      worker,
      store: validFixture.store,
      manifest: validFixture.manifest,
      now: () => "2026-07-15T00:59:59.000Z"
    }),
    /offline_fake_worker_manifest_not_current/u
  );

  assertWorkerPreconditionRejection(
    createOutputFixture({ limits: { maxTaskBytes: 1 } }),
    /offline_fake_worker_task_byte_limit_exceeded/u
  );
  assertWorkerPreconditionRejection(
    createOutputFixture({
      limits: ({ inputRootSize }) => ({ maxTreeManifestBytes: inputRootSize - 1 })
    }),
    /offline_fake_worker_tree_manifest_byte_limit_exceeded/u
  );
  assertWorkerPreconditionRejection(
    createOutputFixture({
      taskTargetPaths: ["docs/guide.md"],
      allowedTargets: ["docs/other.md"]
    }),
    /offline_fake_worker_task_binding_mismatch/u
  );
  assertWorkerPreconditionRejection(
    createOutputFixture({
      inputFiles: [
        { path: "docs/guide.md", mode: "100644", content: text("old\n") },
        { path: "docs/other.md", mode: "100644", content: text("old\n") }
      ],
      limits: { maxTotalTreeFiles: 1 }
    }),
    /offline_fake_worker_total_tree_file_limit_exceeded/u
  );
  assertWorkerPreconditionRejection(
    createOutputFixture({ limits: { maxTotalTreeBytes: 3 } }),
    /offline_fake_worker_total_tree_byte_limit_exceeded/u
  );
});

test("fake worker rejects output tree budgets before any CAS put", () => {
  const fileLimit = createOutputFixture({ limits: { maxTotalTreeFiles: 1 } });
  assertPrestoreRejection(
    fileLimit,
    (files) => files,
    /offline_fake_worker_total_tree_file_limit_exceeded/u
  );

  const byteLimit = createOutputFixture({ limits: { maxTotalTreeBytes: 4 } });
  assertPrestoreRejection(
    byteLimit,
    (files) => replaceGuide(files, text("new\n")),
    /offline_fake_worker_total_tree_byte_limit_exceeded/u
  );

  const manifestLimit = createOutputFixture({
    limits: ({ inputRootSize }) => ({ maxTreeManifestBytes: inputRootSize })
  });
  assertPrestoreRejection(
    manifestLimit,
    (files) => [...files, {
      path: "docs/additional-output-fixture-with-a-longer-path.md",
      mode: "100644",
      content: text("fixture\n")
    }],
    /offline_fake_worker_tree_manifest_byte_limit_exceeded/u
  );
});

test("fake worker rejects changed budgets before any CAS put", () => {
  const changedFileLimit = createOutputFixture({
    inputFiles: [
      { path: "docs/guide.md", mode: "100644", content: text("old\n") },
      { path: "docs/second.md", mode: "100644", content: text("old\n") }
    ],
    allowedTargets: ["docs/guide.md", "docs/second.md"],
    limits: { maxChangedFiles: 1 }
  });
  assertPrestoreRejection(
    changedFileLimit,
    (files) => files.map((file) => ({ ...file, content: text("new\n") })),
    /offline_fake_worker_changed_file_limit_exceeded/u
  );

  const changedByteLimit = createOutputFixture({ limits: { maxChangedBytes: 7 } });
  assertPrestoreRejection(
    changedByteLimit,
    (files) => replaceGuide(files, text("new\n")),
    /offline_fake_worker_changed_byte_limit_exceeded/u
  );

  const diffLimit = createOutputFixture({ limits: { maxDiffBytes: 10 } });
  assertPrestoreRejection(
    diffLimit,
    (files) => replaceGuide(files, text("new\n")),
    /offline_fake_worker_diff_limit_exceeded/u
  );

  const changedBinary = createOutputFixture();
  assertPrestoreRejection(
    changedBinary,
    (files) => replaceGuide(files, new Uint8Array([0xff, 0x00])),
    /offline_fake_worker_changed_binary_forbidden/u
  );
});

test("fake worker rejects sensitive, credential-like, and invalid output before any CAS put", () => {
  const sensitive = createOutputFixture();
  assertPrestoreRejection(
    sensitive,
    () => [{ path: ".env", mode: "100644", content: text("fixture=true\n") }],
    /offline_fake_worker_sensitive_path_forbidden/u
  );

  const credential = createOutputFixture();
  assertPrestoreRejection(
    credential,
    (files) => replaceGuide(files, text("Bearer synthetic-fixture-value\n")),
    /offline_fake_worker_credential_like_content_forbidden/u
  );

  const invalidPath = createOutputFixture();
  assertPrestoreRejection(
    invalidPath,
    () => [{ path: "../escape.md", mode: "100644", content: text("fixture\n") }],
    /offline_fake_worker_output_invalid/u
  );

  const detachedContent = createOutputFixture();
  assertPrestoreRejection(
    detachedContent,
    () => {
      const content = text("new\n");
      structuredClone(content, { transfer: [content.buffer] });
      return [{ path: "docs/guide.md", mode: "100644", content }];
    },
    /offline_fake_worker_output_invalid/u
  );
});

test("fake worker rejects active and malformed output shapes before any CAS put", () => {
  const fixture = createOutputFixture();
  const baseFile = () => ({
    path: "docs/guide.md",
    mode: "100644" as const,
    content: text("new\n")
  });
  const nullPrototypeFile = Object.assign(Object.create(null) as object, baseFile());
  const proxiedContent = new Proxy(text("new\n"), {});
  const scenarios = [
    () => ({}) as unknown as readonly TestOnlyFakeWorkerFile[],
    () => new Proxy([] as TestOnlyFakeWorkerFile[], {}),
    () => [null as unknown as TestOnlyFakeWorkerFile],
    () => [42 as unknown as TestOnlyFakeWorkerFile],
    () => [new Proxy(baseFile(), {})],
    () => [nullPrototypeFile as TestOnlyFakeWorkerFile],
    () => [{ ...baseFile(), extra: true } as unknown as TestOnlyFakeWorkerFile],
    () => [{ ...baseFile(), path: 42 } as unknown as TestOnlyFakeWorkerFile],
    () => [{ ...baseFile(), mode: "100600" } as unknown as TestOnlyFakeWorkerFile],
    () => [{ ...baseFile(), content: [] } as unknown as TestOnlyFakeWorkerFile],
    () => [{ ...baseFile(), content: proxiedContent }]
  ];

  for (const transform of scenarios) {
    assertPrestoreRejection(
      fixture,
      transform,
      /offline_fake_worker_output_invalid/u
    );
  }
});

test("fake worker stores output only after exact prestore budgets pass", () => {
  const fixture = createOutputFixture({
    limits: {
      maxTotalTreeFiles: 2,
      maxTotalTreeBytes: 8,
      maxChangedFiles: 1,
      maxChangedBytes: 8
    }
  });
  let putCalls = 0;
  const observedStore: ContentAddressedStore = {
    put(...args) {
      putCalls += 1;
      return fixture.store.put(...args);
    },
    read: (digest) => fixture.store.read(digest)
  };
  const worker = createTestOnlyFakeCapsuleWorker({
    transform: (files) => replaceGuide(files, text("new\n")),
    simulatedChecks: [{
      checkId: "prestore-boundary",
      summary: "prestore boundary exercised by a synthetic fixture"
    }]
  });

  const receipt = simulate(observedStore, fixture.manifest, worker);

  assert.equal(receipt.executionMode, "test_only_simulated");
  assert.equal(receipt.checks[0]?.checkId, "prestore-boundary");
  assert.equal(putCalls, 2);
});

test("fake worker preflight accepts unchanged, created, and differently sized files", () => {
  const unchanged = createOutputFixture({
    inputFiles: [
      { path: "docs/guide.md", mode: "100755", content: text("old\n") }
    ]
  });
  const unchangedReceipt = simulate(
    unchanged.store,
    unchanged.manifest,
    createTestOnlyFakeCapsuleWorker({
      transform: (files) => files,
      cleanupStatus: "failed"
    })
  );
  assert.equal(unchangedReceipt.cleanup.status, "failed");

  const created = createOutputFixture({
    allowedTargets: ["docs/guide.md", "docs/new.md"]
  });
  const createdReceipt = simulate(
    created.store,
    created.manifest,
    createTestOnlyFakeCapsuleWorker({
      transform: (files) => [...files, {
        path: "docs/new.md",
        mode: "100644",
        content: text("new fixture\n")
      }]
    })
  );
  assert.equal(createdReceipt.executionMode, "test_only_simulated");

  const resized = createOutputFixture();
  const resizedReceipt = simulate(
    resized.store,
    resized.manifest,
    createTestOnlyFakeCapsuleWorker({
      transform: (files) => replaceGuide(files, text("longer replacement\n"))
    })
  );
  assert.equal(resizedReceipt.executionMode, "test_only_simulated");
});

interface OutputFixtureOptions {
  inputFiles?: OfflineContentTreeFile[];
  allowedTargets?: string[];
  taskTargetPaths?: string[];
  limits?: Partial<OfflineExecutionCapsuleManifest["limits"]> | ((input: {
    inputRootSize: number;
  }) => Partial<OfflineExecutionCapsuleManifest["limits"]>);
}

function createOutputFixture(
  options: OutputFixtureOptions = {}
): { store: ContentAddressedStore; manifest: OfflineExecutionCapsuleManifest } {
  const store = createInMemoryContentAddressedStore();
  const allowedTargets = options.allowedTargets ?? ["docs/guide.md"];
  const taskTargetPaths = options.taskTargetPaths ?? allowedTargets;
  const task: CapsuleTaskContract = {
    schemaVersion: "offline-capsule-task.v1",
    dataClassification: "synthetic_non_sensitive",
    taskId: "capsule-fake-worker-output-gate",
    instruction: "Replace the synthetic guide fixture.",
    successCriteria: ["The guide contains the synthetic replacement."],
    outOfScope: ["Any live execution."],
    targetPaths: taskTargetPaths
  };
  const taskDigest = storeCapsuleTask(store, task);
  const inputTree = storeContentTree(store, options.inputFiles ?? [
    { path: "docs/guide.md", mode: "100644", content: text("old\n") }
  ]);
  const limitOverrides = typeof options.limits === "function"
    ? options.limits({ inputRootSize: inputTree.digest.size })
    : options.limits;
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
    allowedTargets,
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
      maxDiffBytes: 8192,
      ...limitOverrides
    },
    nonce: "fixture-nonce-0123456789abcdef01",
    issuedAt: "2026-07-15T01:00:00.000Z",
    expiresAt: "2026-07-15T01:10:00.000Z",
    policyVersion: "offline-execution-capsule-policy.v1"
  });
  return { store, manifest };
}

function assertPrestoreRejection(
  fixture: { store: ContentAddressedStore; manifest: OfflineExecutionCapsuleManifest },
  transform: (
    files: readonly TestOnlyFakeWorkerFile[]
  ) => readonly TestOnlyFakeWorkerFile[],
  reason: RegExp
): void {
  let putCalls = 0;
  const observedStore: ContentAddressedStore = {
    put(...args) {
      putCalls += 1;
      return fixture.store.put(...args);
    },
    read: (digest) => fixture.store.read(digest)
  };
  const worker = createTestOnlyFakeCapsuleWorker({ transform });

  assert.throws(() => simulate(observedStore, fixture.manifest, worker), reason);
  assert.equal(putCalls, 0, reason.source);
}

function assertWorkerPreconditionRejection(
  fixture: { store: ContentAddressedStore; manifest: OfflineExecutionCapsuleManifest },
  reason: RegExp
): void {
  let transformCalls = 0;
  const worker = createTestOnlyFakeCapsuleWorker({
    transform(files) {
      transformCalls += 1;
      return files;
    }
  });

  assert.throws(() => simulate(fixture.store, fixture.manifest, worker), reason);
  assert.equal(transformCalls, 0, reason.source);
}

function simulate(
  store: ContentAddressedStore,
  manifest: OfflineExecutionCapsuleManifest,
  worker: unknown
) {
  const timestamps = [startedAt, completedAt];
  return simulateOfflineCapsuleCandidate({
    worker,
    store,
    manifest,
    now: () => timestamps.shift() ?? completedAt
  });
}

function replaceGuide(
  files: readonly TestOnlyFakeWorkerFile[],
  content: Uint8Array
): readonly TestOnlyFakeWorkerFile[] {
  return files.map((file) => file.path === "docs/guide.md"
    ? { ...file, content }
    : file);
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
