import test from "node:test";
import assert from "node:assert/strict";
import {
  createInMemoryContentAddressedStore,
  loadContentTree,
  loadContentTreeManifest,
  storeContentTree,
  type ContentAddressedStore,
  type LoadedContentTree,
  type OfflineContentTreeFile
} from "../packages/execution-capsule/src/content-addressed-store.js";
import { isCanonicalCapsulePath } from "../packages/execution-capsule/src/contracts.js";

test("capsule prestore path validation covers platform-sensitive aliases", () => {
  assert.equal(isCanonicalCapsulePath("docs/guide.md"), true);
  for (const path of [
    "",
    ".",
    "..",
    "../escape.md",
    "/absolute.md",
    "C:/drive.md",
    "//server/share.md",
    "docs\\guide.md",
    "docs/./guide.md",
    "docs//guide.md",
    ".git/config",
    "docs/control\u0000.md",
    "docs/trailing.",
    "con.txt",
    "e\u0301.md",
    "\ud800.md"
  ]) {
    assert.equal(isCanonicalCapsulePath(path), false, path);
  }
});

test("tree storage rejects active and malformed file arrays before any CAS put", () => {
  let putCalls = 0;
  let getterCalls = 0;
  const backingStore = createInMemoryContentAddressedStore();
  const store: ContentAddressedStore = {
    put(...args) {
      putCalls += 1;
      return backingStore.put(...args);
    },
    read: (...args) => backingStore.read(...args)
  };
  const validFile = () => ({
    path: "docs/guide.md",
    mode: "100644" as const,
    content: text("fixture\n")
  });
  const sparseFiles: OfflineContentTreeFile[] = [];
  sparseFiles.length = 1;
  const symbolFile = validFile();
  Object.defineProperty(symbolFile, Symbol("active"), { value: true });
  const accessorFile = {
    get path() {
      getterCalls += 1;
      return "docs/guide.md";
    },
    mode: "100644",
    content: text("fixture\n")
  };
  const scenarios: unknown[] = [
    new Proxy([validFile()], {}),
    sparseFiles,
    [null],
    [42],
    [new Proxy(validFile(), {})],
    [symbolFile],
    [accessorFile],
    [{ path: "docs/guide.md", mode: "100644" }],
    [{ ...validFile(), path: 42 }],
    [{ ...validFile(), mode: "100600" }],
    [{ ...validFile(), content: [] }],
    [{ ...validFile(), content: new Proxy(text("fixture\n"), {}) }]
  ];

  for (const files of scenarios) {
    assert.throws(
      () => storeContentTree(store, files as OfflineContentTreeFile[]),
      /offline_capsule_tree_/u
    );
    assert.equal(putCalls, 0);
  }
  assert.equal(getterCalls, 0);
});

test("tree reuse snapshots passive files before reading caller-controlled accessors", () => {
  let putCalls = 0;
  const backingStore = createInMemoryContentAddressedStore();
  const store: ContentAddressedStore = {
    put(...args) {
      putCalls += 1;
      return backingStore.put(...args);
    },
    read: (...args) => backingStore.read(...args)
  };
  const files = [{
    path: "docs/guide.md",
    mode: "100644" as const,
    content: text("fixture\n")
  }];

  let filesGetterCalls = 0;
  const accessorTree = {};
  Object.defineProperty(accessorTree, "files", {
    get() {
      filesGetterCalls += 1;
      return [];
    }
  });
  assert.throws(
    () => storeContentTree(store, files, accessorTree as LoadedContentTree),
    /offline_capsule_reuse_tree_invalid/u
  );
  assert.equal(filesGetterCalls, 0);
  assert.equal(putCalls, 0);

  let inheritedFilesGetterCalls = 0;
  const inheritedTree = Object.create({
    get files() {
      inheritedFilesGetterCalls += 1;
      return [];
    }
  }) as LoadedContentTree;
  assert.throws(
    () => storeContentTree(store, files, inheritedTree),
    /offline_capsule_reuse_tree_invalid/u
  );
  assert.equal(inheritedFilesGetterCalls, 0);
  assert.equal(putCalls, 0);

  let slotGetterCalls = 0;
  const accessorFiles: unknown[] = [];
  Object.defineProperty(accessorFiles, "0", {
    get() {
      slotGetterCalls += 1;
      return {};
    }
  });
  accessorFiles.length = 1;
  assert.throws(
    () => storeContentTree(store, files, { files: accessorFiles } as LoadedContentTree),
    /offline_capsule_reuse_file_invalid/u
  );
  assert.equal(slotGetterCalls, 0);
  assert.equal(putCalls, 0);

  let inheritedSlotGetterCalls = 0;
  const inheritedAccessorFiles: unknown[] = [];
  const inheritedAccessorPrototype = Object.create(Array.prototype) as object;
  Object.defineProperty(inheritedAccessorPrototype, "0", {
    get() {
      inheritedSlotGetterCalls += 1;
      return {};
    }
  });
  Object.setPrototypeOf(inheritedAccessorFiles, inheritedAccessorPrototype);
  inheritedAccessorFiles.length = 1;
  assert.throws(
    () => storeContentTree(
      store,
      files,
      { files: inheritedAccessorFiles } as LoadedContentTree
    ),
    /offline_capsule_reuse_tree_invalid/u
  );
  assert.equal(inheritedSlotGetterCalls, 0);
  assert.equal(putCalls, 0);

  let pathGetterCalls = 0;
  const accessorFile = {
    get path() {
      pathGetterCalls += 1;
      return "docs/guide.md";
    },
    mode: "100644",
    content: text("fixture\n"),
    digest: {
      algorithm: "sha256",
      hash: "0".repeat(64),
      size: 8
    }
  };
  assert.throws(
    () => storeContentTree(store, files, { files: [accessorFile] } as LoadedContentTree),
    /offline_capsule_reuse_file_invalid/u
  );
  assert.equal(pathGetterCalls, 0);
  assert.equal(putCalls, 0);

  let contentGetterCalls = 0;
  const contentAccessorFile = {
    path: "docs/guide.md",
    mode: "100644",
    get content() {
      contentGetterCalls += 1;
      return text("fixture\n");
    },
    digest: {
      algorithm: "sha256",
      hash: "0".repeat(64),
      size: 8
    }
  };
  assert.throws(
    () => storeContentTree(
      store,
      files,
      { files: [contentAccessorFile] } as LoadedContentTree
    ),
    /offline_capsule_reuse_file_invalid/u
  );
  assert.equal(contentGetterCalls, 0);
  assert.equal(putCalls, 0);
});

test("validated tree reuse still materializes blobs in the target CAS", () => {
  const sourceStore = createInMemoryContentAddressedStore();
  const sourceTree = storeContentTree(sourceStore, [{
    path: "docs/guide.md",
    mode: "100644",
    content: text("fixture\n")
  }]);
  assert.deepEqual(
    loadContentTreeManifest(sourceStore, sourceTree.digest),
    sourceTree
  );
  const reusable = loadContentTree(sourceStore, sourceTree.digest);
  const targetStore = createInMemoryContentAddressedStore();
  const targetTree = storeContentTree(targetStore, [{
    path: "docs/guide.md",
    mode: "100644",
    content: text("fixture\n")
  }], reusable);

  assert.deepEqual(targetTree.manifest.entries[0]?.blob, reusable.files[0]?.digest);
  assert.equal(
    new TextDecoder().decode(loadContentTree(targetStore, targetTree.digest).files[0]?.content),
    "fixture\n"
  );
});

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
