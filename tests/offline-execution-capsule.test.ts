import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CapsuleTaskContractSchema,
  ContentTreeManifestSchema,
  InMemoryContentAddressedStore,
  canonicalJsonBytes,
  createContentTreeManifest,
  createInMemoryContentAddressedStore,
  createInMemoryOfflineCapsuleReplayStore,
  createOfflineExecutionCapsuleManifest,
  createOfflineOutputTreeReceipt,
  createTestOnlyFakeCapsuleWorker,
  digestCanonicalJson,
  simulateOfflineCapsuleCandidate,
  storeCapsuleTask,
  storeContentTree,
  verifyOfflineCapsuleCandidate,
  type ContentAddressedStore,
  type ContentDigest,
  type OfflineCapsuleAssessment,
  type OfflineExecutionCapsuleManifest,
  type OfflineOutputTreeReceipt,
  type TestOnlyFakeWorkerFile
} from "../packages/execution-capsule/src/index.js";

const issuedAt = "2026-07-15T01:00:00.000Z";
const startedAt = "2026-07-15T01:01:00.000Z";
const completedAt = "2026-07-15T01:01:01.000Z";
const verifiedAt = "2026-07-15T01:02:00.000Z";
const expiresAt = "2026-07-15T01:10:00.000Z";

test("complete input tree becomes a verified-offline canonical GovernedFileChangeSet", () => {
  const fixture = createFixture();
  const assessment = verifyFixture(fixture);

  assert.equal(assessment.status, "verified_offline");
  assert.equal(assessment.contractSatisfied, true);
  assert.equal(assessment.changeSet?.changeSetId, fixture.manifest.capsuleId);
  assert.equal(assessment.changeSet?.threadId, fixture.manifest.correlation.threadId);
  assert.equal(assessment.changeSet?.turnId, fixture.manifest.correlation.turnId);
  assert.equal(assessment.changeSet?.itemId, fixture.manifest.correlation.itemId);
  assert.equal(assessment.changeSet?.baseHead, fixture.manifest.baseHead);
  assert.equal(
    assessment.changeSet?.sourceSchemaProfile,
    "offline-execution-capsule.v1"
  );
  assert.deepEqual(assessment.changeSet?.changes.map((change) => ({
    path: change.path,
    kind: change.kind,
    beforeHash: change.beforeHash,
    afterHash: change.afterHash
  })), [{
    path: "docs/guide.md",
    kind: "update",
    beforeHash: fixture.inputGuideDigest.hash,
    afterHash: assessment.changeSet?.changes[0]?.afterHash
  }]);
  assert.match(assessment.changeSet?.changes[0]?.unifiedDiff ?? "", /^diff --git /u);
  assert.match(assessment.changeSet?.changes[0]?.unifiedDiff ?? "", /-old\n\+new\n/u);
  assertAllRuntimeFieldsFalse(assessment);

  const outputManifest = fixture.store.read(fixture.receipt.outputRoot);
  assert.ok(outputManifest.byteLength > 0);
  assert.equal(fixture.receipt.checks[0]?.status, "simulated");
  assert.equal("argv" in (fixture.receipt.checks[0] ?? {}), false);
});

test("an allowed 100644 create maps to a canonical create change", () => {
  const fixture = createFixture({
    targets: ["docs/new.md"],
    transform: (files) => [...files, {
      path: "docs/new.md",
      mode: "100644" as const,
      content: text("created\n")
    }]
  });
  const assessment = verifyFixture(fixture);
  assert.equal(assessment.status, "verified_offline");
  assert.deepEqual(assessment.changeSet?.changes.map((change) => ({
    path: change.path,
    kind: change.kind,
    beforeHash: change.beforeHash,
    addedLines: change.addedLines,
    deletedLines: change.deletedLines
  })), [{
    path: "docs/new.md",
    kind: "create",
    beforeHash: null,
    addedLines: 1,
    deletedLines: 0
  }]);
  assert.match(
    assessment.changeSet?.changes[0]?.unifiedDiff ?? "",
    /new file mode 100644\n--- \/dev\/null\n\+\+\+ b\/docs\/new\.md/u
  );
  assertAllRuntimeFieldsFalse(assessment);
});

test("an allowed empty-file create produces a git-apply-valid canonical diff", () => {
  const fixture = createFixture({
    targets: ["docs/empty.md"],
    transform: (files) => [...files, {
      path: "docs/empty.md",
      mode: "100644" as const,
      content: new Uint8Array()
    }]
  });
  const assessment = verifyFixture(fixture);
  assert.equal(assessment.status, "verified_offline");
  const change = assessment.changeSet?.changes[0];
  assert.equal(change?.addedLines, 0);
  assert.equal(change?.deletedLines, 0);
  assert.equal(change?.unifiedDiff, [
    "diff --git a/docs/empty.md b/docs/empty.md",
    "new file mode 100644",
    "index e69de29..e69de29",
    ""
  ].join("\n"));
  assertGitApplyCheck(change?.unifiedDiff ?? "");
  assertAllRuntimeFieldsFalse(assessment);
});

test("tree manifests sort canonically, bind every entry, and reject aliases", () => {
  const first = createContentTreeManifest([
    entry("docs/z.md", "b".repeat(64), 2),
    entry("docs/a.md", "a".repeat(64), 1)
  ]);
  const second = createContentTreeManifest([
    entry("docs/a.md", "a".repeat(64), 1),
    entry("docs/z.md", "b".repeat(64), 2)
  ]);
  assert.deepEqual(first.entries.map((value) => value.path), ["docs/a.md", "docs/z.md"]);
  assert.deepEqual(first.rootDigest, second.rootDigest);

  const drifted = structuredClone(first);
  drifted.entries[0]!.blob.hash = "c".repeat(64);
  assert.equal(ContentTreeManifestSchema.safeParse(drifted).success, false);

  for (const paths of [
    ["docs/A.md", "docs/a.md"],
    ["docs/a.md", "docs/a.md"],
    ["docs/e\u0301.md"],
    ["docs/../guide.md"],
    ["docs\\guide.md"],
    [".git/config"]
  ]) {
    const task = baseTask(paths);
    assert.equal(CapsuleTaskContractSchema.safeParse(task).success, false, paths.join(","));
  }
  assert.equal(
    CapsuleTaskContractSchema.safeParse(baseTask([`docs/${String.fromCharCode(0xd800)}.md`])).success,
    false
  );

  let symbolGetterCalls = 0;
  const symbolTask = baseTask();
  Object.defineProperty(symbolTask, Symbol("executable"), {
    get() {
      symbolGetterCalls += 1;
      return "ignored";
    }
  });
  assert.throws(
    () => storeCapsuleTask(createInMemoryContentAddressedStore(), symbolTask),
    /offline_capsule_symbol_key_input/u
  );
  assert.equal(symbolGetterCalls, 0);
});

test("in-memory CAS is immutable and fails closed on missing, mismatch, and corruption", () => {
  const store = new InMemoryContentAddressedStore();
  const source = new TextEncoder().encode("immutable");
  const digest = store.put(source);
  source[0] = 0;
  const firstRead = store.read(digest);
  firstRead[1] = 0;
  assert.equal(new TextDecoder().decode(store.read(digest)), "immutable");

  assert.throws(
    () => store.put(new TextEncoder().encode("different"), digest),
    /offline_cas_expected_digest_mismatch/u
  );
  assert.throws(
    () => store.read({ algorithm: "sha256", hash: "f".repeat(64), size: 1 }),
    /offline_cas_content_missing/u
  );

  const fixture = createFixture();
  const corruptStore: ContentAddressedStore = {
    put: (...args) => fixture.store.put(...args),
    read(requested) {
      if (requested.hash === fixture.receipt.outputRoot.hash) {
        return new TextEncoder().encode("corrupt");
      }
      return fixture.store.read(requested);
    }
  };
  const assessment = verifyOfflineCapsuleCandidate({
    store: corruptStore,
    manifest: fixture.manifest,
    receipt: fixture.receipt,
    replayStore: createInMemoryOfflineCapsuleReplayStore(),
    now: () => verifiedAt
  });
  assert.equal(assessment.status, "blocked");
  assert.deepEqual(assessment.reasons, [
    "offline_capsule_verification_output_manifest_digest_mismatch"
  ]);
  assertAllRuntimeFieldsFalse(assessment);
});

test("tree construction validates own primitive fields before reading path methods", () => {
  const store = createInMemoryContentAddressedStore();
  let inheritedPathGetterCalls = 0;
  const inheritedPathFile = Object.create({
    get path() {
      inheritedPathGetterCalls += 1;
      return "docs/inherited.md";
    }
  }) as Record<string, unknown>;
  Object.defineProperties(inheritedPathFile, {
    mode: { enumerable: true, value: "100644" },
    content: { enumerable: true, value: text("fixture\n") }
  });
  assert.throws(
    () => storeContentTree(store, [
      inheritedPathFile as unknown as {
        path: string;
        mode: "100644";
        content: Uint8Array;
      }
    ]),
    /offline_capsule_tree_file_invalid/u
  );
  assert.equal(inheritedPathGetterCalls, 0);

  let customNormalizeCalls = 0;
  const executablePath = {
    normalize() {
      customNormalizeCalls += 1;
      return "docs/executable.md";
    }
  };
  assert.throws(
    () => storeContentTree(store, [{
      path: executablePath as unknown as string,
      mode: "100644",
      content: text("fixture\n")
    }]),
    /offline_capsule_tree_file_invalid/u
  );
  assert.equal(customNormalizeCalls, 0);
});

test("missing, corrupt, and size-drifted tree blobs are rejected on independent consumption", () => {
  const missingFixture = createFixture();
  const missingTree = outputTreeRecord(missingFixture);
  const missingEntry = findTreeEntry(missingTree, "docs/guide.md");
  missingEntry.blob = { algorithm: "sha256", hash: "f".repeat(64), size: 4 };
  const missingRoot = storeRawTree(missingFixture.store, missingTree);
  const missingReceipt = rehashReceipt({
    ...missingFixture.receipt,
    outputRoot: missingRoot
  });
  assert.deepEqual(verifyFixture(missingFixture, { receipt: missingReceipt }).reasons, [
    "offline_capsule_verification_output_blob_missing"
  ]);

  const sizeFixture = createFixture();
  const sizeTree = outputTreeRecord(sizeFixture);
  const sizeEntry = findTreeEntry(sizeTree, "docs/guide.md");
  sizeEntry.blob = { ...sizeEntry.blob, size: sizeEntry.blob.size + 1 };
  const sizeRoot = storeRawTree(sizeFixture.store, sizeTree);
  const sizeReceipt = rehashReceipt({ ...sizeFixture.receipt, outputRoot: sizeRoot });
  assert.deepEqual(verifyFixture(sizeFixture, { receipt: sizeReceipt }).reasons, [
    "offline_capsule_verification_output_blob_read_failed"
  ]);

  const corruptFixture = createFixture();
  const corruptTree = outputTreeRecord(corruptFixture);
  const corruptEntry = findTreeEntry(corruptTree, "docs/guide.md");
  const corruptStore: ContentAddressedStore = {
    put: (...args) => corruptFixture.store.put(...args),
    read(digest) {
      if (digest.hash === corruptEntry.blob.hash) {
        return text("tampered\n");
      }
      return corruptFixture.store.read(digest);
    }
  };
  const corruptAssessment = verifyOfflineCapsuleCandidate({
    store: corruptStore,
    manifest: corruptFixture.manifest,
    receipt: corruptFixture.receipt,
    replayStore: createInMemoryOfflineCapsuleReplayStore(),
    now: () => verifiedAt
  });
  assert.deepEqual(corruptAssessment.reasons, [
    "offline_capsule_verification_output_blob_digest_mismatch"
  ]);
});

test("task, manifest, receipt, and tree schema drift or extra fields fail closed", () => {
  const fixture = createFixture();
  const manifestWithExtra = { ...fixture.manifest, liveEligible: true };
  const receiptWithExtra = { ...fixture.receipt, argv: ["npm", "test"] };
  assert.deepEqual(verifyFixture(fixture, { manifest: manifestWithExtra }).reasons, [
    "offline_capsule_manifest_invalid"
  ]);
  assert.deepEqual(verifyFixture(fixture, { receipt: receiptWithExtra }).reasons, [
    "offline_capsule_receipt_invalid"
  ]);

  const driftedManifest = { ...fixture.manifest, schemaVersion: "offline-execution-capsule.v2" };
  assert.deepEqual(verifyFixture(fixture, { manifest: driftedManifest }).reasons, [
    "offline_capsule_manifest_invalid"
  ]);

  const taskWithExtra = {
    ...baseTask(),
    hiddenInstruction: "ignored"
  };
  const taskDigest = fixture.store.put(canonicalJsonBytes(taskWithExtra));
  const manifest = rehashManifest({ ...fixture.manifest, taskDigest });
  const receipt = rehashReceipt({ ...fixture.receipt, taskDigest, manifestHash: manifest.manifestHash });
  assert.deepEqual(verifyFixture(fixture, { manifest, receipt }).reasons, [
    "offline_capsule_verification_task_schema_invalid"
  ]);

  const forbiddenEntries = [
    {
      path: "docs/link.md",
      nodeType: "symlink",
      mode: "120000",
      blob: fixture.inputGuideDigest
    },
    {
      path: "docs/hardlink.md",
      nodeType: "hardlink",
      mode: "100644",
      blob: fixture.inputGuideDigest
    },
    {
      path: "docs/device",
      nodeType: "special",
      mode: "100644",
      blob: fixture.inputGuideDigest
    },
    {
      path: "docs/xattr.md",
      nodeType: "regular_file",
      mode: "100644",
      blob: fixture.inputGuideDigest,
      xattrs: { user: "fixture" }
    }
  ];
  for (const forbiddenEntry of forbiddenEntries) {
    const specialRoot = storeRawTree(fixture.store, {
      schemaVersion: "content-tree-manifest.v1",
      entries: [forbiddenEntry]
    });
    const specialReceipt = rehashReceipt({ ...fixture.receipt, outputRoot: specialRoot });
    assert.deepEqual(verifyFixture(fixture, { receipt: specialReceipt }).reasons, [
      "offline_capsule_verification_output_manifest_schema_invalid"
    ], forbiddenEntry.nodeType);
  }
});

test("noncanonical task JSON bytes are rejected even when their digest is correct", () => {
  const fixture = createFixture();
  const task = baseTask();
  const noncanonicalBytes = new TextEncoder().encode(JSON.stringify(task));
  assert.notDeepEqual(noncanonicalBytes, canonicalJsonBytes(task));
  const taskDigest = fixture.store.put(noncanonicalBytes);
  const manifest = rehashManifest({ ...fixture.manifest, taskDigest });
  const receipt = rehashReceipt({
    ...fixture.receipt,
    taskDigest,
    manifestHash: manifest.manifestHash
  });
  assert.deepEqual(verifyFixture(fixture, { manifest, receipt }).reasons, [
    "offline_capsule_verification_task_noncanonical_bytes"
  ]);
});

test("expiry, nonce replay, duplicate receipt, and cleanup failure remain blocked", () => {
  const fixture = createFixture();
  assert.deepEqual(verifyFixture(fixture, { now: "2026-07-15T01:11:00.000Z" }).reasons, [
    "offline_capsule_manifest_expired_or_not_yet_valid"
  ]);

  const replayStore = createInMemoryOfflineCapsuleReplayStore();
  assert.equal(verifyFixture(fixture, { replayStore }).status, "verified_offline");
  assert.deepEqual(verifyFixture(fixture, { replayStore }).reasons, [
    "offline_capsule_receipt_or_nonce_replay"
  ]);

  const cleanupFixture = createFixture({ cleanupStatus: "failed" });
  assert.deepEqual(verifyFixture(cleanupFixture).reasons, ["offline_capsule_cleanup_failed"]);

  const clockFailure = verifyOfflineCapsuleCandidate({
    store: fixture.store,
    manifest: fixture.manifest,
    receipt: fixture.receipt,
    replayStore: createInMemoryOfflineCapsuleReplayStore(),
    now() {
      throw new Error("clock unavailable");
    }
  });
  assert.deepEqual(clockFailure.reasons, ["offline_capsule_verification_clock_failed"]);
});

test("repository identity, correlation, baseHead, input, task, and manifest drift are bound", () => {
  const scenarios: Array<[string, (fixture: Fixture) => OfflineOutputTreeReceipt, string]> = [
    ["repository", (fixture) => rehashReceipt({
      ...fixture.receipt,
      repository: { ...fixture.receipt.repository, repositoryId: "different" }
    }), "offline_capsule_repository_identity_mismatch"],
    ["correlation", (fixture) => rehashReceipt({
      ...fixture.receipt,
      correlation: { ...fixture.receipt.correlation, turnId: "different" }
    }), "offline_capsule_correlation_mismatch"],
    ["baseHead", (fixture) => rehashReceipt({
      ...fixture.receipt,
      baseHead: "different-head"
    }), "offline_capsule_base_head_mismatch"],
    ["input", (fixture) => rehashReceipt({
      ...fixture.receipt,
      inputRoot: { ...fixture.receipt.inputRoot, hash: "d".repeat(64) }
    }), "offline_capsule_input_root_mismatch"],
    ["task", (fixture) => rehashReceipt({
      ...fixture.receipt,
      taskDigest: { ...fixture.receipt.taskDigest, hash: "e".repeat(64) }
    }), "offline_capsule_task_digest_mismatch"],
    ["manifest", (fixture) => rehashReceipt({
      ...fixture.receipt,
      manifestHash: "f".repeat(64)
    }), "offline_capsule_manifest_binding_mismatch"]
  ];
  for (const [name, mutate, expected] of scenarios) {
    const fixture = createFixture();
    const assessment = verifyFixture(fixture, { receipt: mutate(fixture) });
    assert.ok(assessment.reasons.includes(expected), name);
    assertAllRuntimeFieldsFalse(assessment);
  }
});

test("delete, rename, mode drift, outside target, and no-change output trees are blocked", () => {
  const scenarios: Array<{
    name: string;
    targets?: string[];
    transform(files: readonly TestOnlyFakeWorkerFile[]): readonly TestOnlyFakeWorkerFile[];
    reason: RegExp;
  }> = [
    {
      name: "delete",
      transform: (files) => files.filter((file) => file.path !== "docs/guide.md"),
      reason: /^offline_capsule_delete_forbidden:/u
    },
    {
      name: "rename",
      targets: ["docs/guide.md", "docs/renamed.md"],
      transform: (files) => files.map((file) => file.path === "docs/guide.md"
        ? { ...file, path: "docs/renamed.md" }
        : file),
      reason: /^offline_capsule_rename_forbidden:/u
    },
    {
      name: "mode",
      transform: (files) => files.map((file) => file.path === "docs/guide.md"
        ? { ...file, mode: "100755" as const, content: text("new\n") }
        : file),
      reason: /^offline_capsule_mode_drift_forbidden:/u
    },
    {
      name: "outside target",
      transform: (files) => [...files, {
        path: "src/outside.ts",
        mode: "100644" as const,
        content: text("new\n")
      }],
      reason: /^offline_capsule_target_outside_allowlist:/u
    },
    {
      name: "no change",
      transform: (files) => files,
      reason: /^offline_capsule_no_change$/u
    }
  ];

  for (const scenario of scenarios) {
    const fixture = createFixture({
      ...(scenario.targets === undefined ? {} : { targets: scenario.targets }),
      transform: scenario.transform
    });
    const assessment = verifyFixture(fixture);
    assert.equal(assessment.status, "blocked", scenario.name);
    assert.ok(assessment.reasons.some((reason) => scenario.reason.test(reason)), scenario.name);
    assertAllRuntimeFieldsFalse(assessment);
  }
});

test("changed binary, credential-like content, sensitive path, and size limits fail closed", () => {
  const binary = createFixture({
    transform: (files) => replaceGuide(files, new Uint8Array([0xff, 0x00]))
  });
  assert.deepEqual(verifyFixture(binary).reasons, ["offline_capsule_changed_binary_forbidden"]);

  const credential = createFixture({
    transform: (files) => replaceGuide(files, text("api_key = fixture\n"))
  });
  assert.deepEqual(verifyFixture(credential).reasons, [
    "offline_capsule_credential_like_content_forbidden"
  ]);

  for (const rawCredential of [
    "sk-proj-fixture-value",
    "ghp_fixturevalue",
    "AKIAFIXTUREVALUE",
    "Bearer fixture-value",
    "-----BEGIN PRIVATE KEY-----"
  ]) {
    const rawFixture = createFixture({
      transform: (files) => replaceGuide(files, text(`${rawCredential}\n`))
    });
    assert.deepEqual(verifyFixture(rawFixture).reasons, [
      "offline_capsule_credential_like_content_forbidden"
    ], rawCredential);
  }

  const sensitive = createFixture({
    targets: [".env.example", "docs/guide.md"],
    transform: (files) => [...files, {
      path: ".env.example",
      mode: "100644" as const,
      content: text("safe=fixture\n")
    }]
  });
  assert.deepEqual(verifyFixture(sensitive).reasons, [
    "offline_capsule_sensitive_path_forbidden"
  ]);

  const fileLimit = createFixture({
    targets: ["docs/extra.md", "docs/guide.md"],
    limits: { maxChangedFiles: 1, maxChangedBytes: 4096, maxDiffBytes: 8192 },
    transform: (files) => [
      ...replaceGuide(files, text("new\n")),
      { path: "docs/extra.md", mode: "100644" as const, content: text("extra\n") }
    ]
  });
  assert.deepEqual(verifyFixture(fileLimit).reasons, [
    "offline_capsule_changed_file_limit_exceeded"
  ]);

  const byteLimit = createFixture({
    limits: { maxChangedFiles: 2, maxChangedBytes: 3, maxDiffBytes: 8192 }
  });
  assert.deepEqual(verifyFixture(byteLimit).reasons, [
    "offline_capsule_changed_byte_limit_exceeded"
  ]);

  const diffLimit = createFixture({
    limits: { maxChangedFiles: 2, maxChangedBytes: 4096, maxDiffBytes: 10 }
  });
  assert.deepEqual(verifyFixture(diffLimit).reasons, ["offline_capsule_diff_limit_exceeded"]);
});

test("unregistered, proxy, and accessor workers are rejected before their code runs", () => {
  const fixture = createFixture({ createReceipt: false });
  let calls = 0;
  const arbitrary = {
    transform() {
      calls += 1;
      return [];
    }
  };
  assert.throws(
    () => simulateWithWorker(fixture, arbitrary),
    /offline_fake_worker_untrusted/u
  );
  assert.equal(calls, 0);

  const proxied = new Proxy(arbitrary, {
    get(target, property, receiver) {
      calls += 1;
      return Reflect.get(target, property, receiver);
    }
  });
  assert.throws(
    () => simulateWithWorker(fixture, proxied),
    /offline_fake_worker_untrusted/u
  );
  assert.equal(calls, 0);

  const accessor = {};
  Object.defineProperty(accessor, "run", {
    enumerable: true,
    get() {
      calls += 1;
      return () => [];
    }
  });
  assert.throws(
    () => simulateWithWorker(fixture, accessor),
    /offline_fake_worker_untrusted/u
  );
  assert.equal(calls, 0);

  const symbolAccessor = {};
  Object.defineProperty(symbolAccessor, Symbol("run"), {
    enumerable: true,
    get() {
      calls += 1;
      return () => [];
    }
  });
  assert.throws(
    () => simulateWithWorker(fixture, symbolAccessor),
    /offline_fake_worker_untrusted/u
  );
  assert.equal(calls, 0);
});

test("worker transform failure and executable output objects fail closed", () => {
  const failed = createFixture({
    createReceipt: false,
    transform() {
      throw new Error("fixture failure");
    }
  });
  assert.throws(
    () => simulateWithWorker(failed, failed.worker),
    /offline_fake_worker_transform_failed/u
  );

  const executableOutput = createFixture({
    createReceipt: false,
    transform() {
      const value = { path: "docs/guide.md", mode: "100644", content: text("new\n") };
      Object.defineProperty(value, "path", {
        enumerable: true,
        get: () => "docs/guide.md"
      });
      return [value as unknown as TestOnlyFakeWorkerFile];
    }
  });
  assert.throws(
    () => simulateWithWorker(executableOutput, executableOutput.worker),
    /offline_fake_worker_output_invalid/u
  );
});

test("worker output array slots are validated before getters can execute", () => {
  let slotGetterCalls = 0;
  const ownAccessorOutput = createFixture({
    createReceipt: false,
    transform() {
      const output: TestOnlyFakeWorkerFile[] = [];
      Object.defineProperty(output, "0", {
        enumerable: true,
        get() {
          slotGetterCalls += 1;
          return { path: "docs/guide.md", mode: "100644", content: text("new\n") };
        }
      });
      output.length = 1;
      return output;
    }
  });
  assert.throws(
    () => simulateWithWorker(ownAccessorOutput, ownAccessorOutput.worker),
    /offline_fake_worker_output_invalid/u
  );
  assert.equal(slotGetterCalls, 0);

  const inheritedAccessorOutput = createFixture({
    createReceipt: false,
    transform() {
      const output: TestOnlyFakeWorkerFile[] = [];
      const prototype = Object.create(Array.prototype) as object;
      Object.defineProperty(prototype, "0", {
        get() {
          slotGetterCalls += 1;
          return { path: "docs/guide.md", mode: "100644", content: text("new\n") };
        }
      });
      Object.setPrototypeOf(output, prototype);
      output.length = 1;
      return output;
    }
  });
  assert.throws(
    () => simulateWithWorker(inheritedAccessorOutput, inheritedAccessorOutput.worker),
    /offline_fake_worker_output_invalid/u
  );
  assert.equal(slotGetterCalls, 0);
});

interface Fixture {
  store: ContentAddressedStore;
  manifest: OfflineExecutionCapsuleManifest;
  receipt: OfflineOutputTreeReceipt;
  worker: unknown;
  inputGuideDigest: ContentDigest;
}

interface FixtureOptions {
  targets?: string[];
  limits?: OfflineExecutionCapsuleManifest["limits"];
  transform?: (
    files: readonly TestOnlyFakeWorkerFile[]
  ) => readonly TestOnlyFakeWorkerFile[];
  cleanupStatus?: "succeeded" | "failed";
  createReceipt?: boolean;
}

function createFixture(options: FixtureOptions = {}): Fixture {
  const store = createInMemoryContentAddressedStore();
  const targets = [...(options.targets ?? ["docs/guide.md"])].sort();
  const task = baseTask(targets);
  const taskDigest = storeCapsuleTask(store, task);
  const inputTree = storeContentTree(store, [
    { path: "assets/unchanged.bin", mode: "100644", content: new Uint8Array([0xff, 0x00]) },
    { path: "docs/guide.md", mode: "100644", content: text("old\n") },
    { path: "scripts/existing.sh", mode: "100755", content: text("echo fixture\n") }
  ]);
  const inputGuideDigest = inputTree.manifest.entries.find(
    (entryValue) => entryValue.path === "docs/guide.md"
  )!.blob;
  const manifest = createOfflineExecutionCapsuleManifest({
    schemaVersion: "offline-execution-capsule.v1",
    capsuleId: "capsule-synthetic-1",
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
    allowedTargets: targets,
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
    limits: options.limits ?? {
      maxChangedFiles: 2,
      maxChangedBytes: 4096,
      maxDiffBytes: 8192
    },
    nonce: "fixture-nonce-0123456789abcdef01",
    issuedAt,
    expiresAt,
    policyVersion: "offline-execution-capsule-policy.v1"
  });
  const worker = createTestOnlyFakeCapsuleWorker({
    transform: (files) => (options.transform ?? ((input) => (
      replaceGuide(input, text("new\n"))
    )))(files),
    ...(options.cleanupStatus === undefined ? {} : { cleanupStatus: options.cleanupStatus })
  });
  const placeholderReceipt = createOfflineOutputTreeReceipt({
    schemaVersion: "offline-output-tree-receipt.v1",
    receiptId: "placeholder",
    capsuleId: manifest.capsuleId,
    executionMode: "test_only_simulated",
    manifestHash: manifest.manifestHash,
    taskDigest,
    inputRoot: inputTree.digest,
    outputRoot: inputTree.digest,
    repository: manifest.repository,
    baseHead: manifest.baseHead,
    correlation: manifest.correlation,
    worker: {
      workerId: "offline-test-only-fake-worker",
      workerVersion: "1",
      scope: "test_only"
    },
    nonce: manifest.nonce,
    startedAt,
    completedAt,
    checks: [{
      checkId: "placeholder-simulated-check",
      status: "simulated",
      summary: "placeholder receipt for worker rejection tests"
    }],
    cleanup: { attempted: true, status: "succeeded" }
  });
  const fixture: Fixture = {
    store,
    manifest,
    receipt: placeholderReceipt,
    worker,
    inputGuideDigest
  };
  if (options.createReceipt !== false) {
    fixture.receipt = simulateWithWorker(fixture, worker);
  }
  return fixture;
}

function simulateWithWorker(fixture: Fixture, worker: unknown): OfflineOutputTreeReceipt {
  const timestamps = [startedAt, completedAt];
  return simulateOfflineCapsuleCandidate({
    worker,
    store: fixture.store,
    manifest: fixture.manifest,
    now: () => timestamps.shift() ?? completedAt
  });
}

function verifyFixture(
  fixture: Fixture,
  options: {
    manifest?: unknown;
    receipt?: unknown;
    replayStore?: ReturnType<typeof createInMemoryOfflineCapsuleReplayStore>;
    now?: string;
  } = {}
): OfflineCapsuleAssessment {
  return verifyOfflineCapsuleCandidate({
    store: fixture.store,
    manifest: options.manifest ?? fixture.manifest,
    receipt: options.receipt ?? fixture.receipt,
    replayStore: options.replayStore ?? createInMemoryOfflineCapsuleReplayStore(),
    now: () => options.now ?? verifiedAt
  });
}

function baseTask(targetPaths = ["docs/guide.md"]) {
  return {
    schemaVersion: "offline-capsule-task.v1" as const,
    dataClassification: "synthetic_non_sensitive" as const,
    taskId: "capsule-synthetic-1",
    instruction: "Replace the synthetic guide fixture.",
    successCriteria: ["The guide contains the synthetic replacement."],
    outOfScope: ["Any live execution."],
    targetPaths
  };
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

function entry(path: string, hash: string, size: number) {
  return {
    path,
    nodeType: "regular_file" as const,
    mode: "100644" as const,
    blob: { algorithm: "sha256" as const, hash, size }
  };
}

function rehashManifest(input: Record<string, any>): OfflineExecutionCapsuleManifest {
  const { manifestHash: _manifestHash, ...content } = input;
  return createOfflineExecutionCapsuleManifest(
    content as Parameters<typeof createOfflineExecutionCapsuleManifest>[0]
  );
}

function rehashReceipt(input: Record<string, any>): OfflineOutputTreeReceipt {
  const { receiptHash: _receiptHash, ...content } = input;
  return createOfflineOutputTreeReceipt(
    content as Parameters<typeof createOfflineOutputTreeReceipt>[0]
  );
}

function storeRawTree(
  store: ContentAddressedStore,
  tree: { schemaVersion: string; entries: unknown[] }
): ContentDigest {
  const raw = {
    ...tree,
    rootDigest: digestCanonicalJson({
      schemaVersion: "content-tree-root.v1",
      entries: tree.entries
    })
  };
  return store.put(canonicalJsonBytes(raw));
}

function outputTreeRecord(fixture: Fixture): {
  schemaVersion: string;
  entries: Array<{
    path: string;
    nodeType: string;
    mode: string;
    blob: ContentDigest;
  }>;
} {
  const parsed = JSON.parse(new TextDecoder().decode(
    fixture.store.read(fixture.receipt.outputRoot)
  )) as {
    schemaVersion: string;
    entries: Array<{
      path: string;
      nodeType: string;
      mode: string;
      blob: ContentDigest;
    }>;
  };
  return { schemaVersion: parsed.schemaVersion, entries: parsed.entries };
}

function findTreeEntry(
  tree: ReturnType<typeof outputTreeRecord>,
  path: string
): ReturnType<typeof outputTreeRecord>["entries"][number] {
  const entryValue = tree.entries.find((candidate) => candidate.path === path);
  assert.ok(entryValue);
  return entryValue;
}

function assertAllRuntimeFieldsFalse(assessment: OfflineCapsuleAssessment): void {
  assert.equal(assessment.runtimeExecutionVerified, false);
  assert.equal(assessment.workerFidelityMechanicallyProven, false);
  assert.equal(assessment.realIsolationMechanicallyProven, false);
  assert.equal(assessment.filesystemTopologyMechanicallyProven, false);
  assert.equal(assessment.durableReplayProtectionMechanicallyProven, false);
  assert.equal(assessment.injectedTransformSideEffectsMechanicallyExcluded, false);
  assert.equal(assessment.liveExecutionAuthorized, false);
  assert.equal(assessment.autoApprovalEligible, false);
  assert.equal(assessment.retainEligible, false);
  assert.equal(assessment.applyEligible, false);
  assert.equal(assessment.outputRetentionAuthorized, false);
  assert.equal(assessment.workspaceWriteEligible, false);
}

function assertGitApplyCheck(unifiedDiff: string): void {
  const directory = mkdtempSync(join(tmpdir(), "offline-capsule-diff-"));
  try {
    const initialized = spawnSync("git", ["init", "-q"], {
      cwd: directory,
      encoding: "utf8"
    });
    assert.equal(initialized.status, 0, initialized.stderr);
    const checked = spawnSync("git", ["apply", "--check", "--cached", "-"], {
      cwd: directory,
      encoding: "utf8",
      input: unifiedDiff
    });
    assert.equal(checked.status, 0, checked.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
