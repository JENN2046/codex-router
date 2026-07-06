import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFileCheckpointLedgerStore,
  createRecordingCheckpointLedgerStore,
  parseCheckpointLedgerEntry,
  hasIrreversibleActions
} from "../packages/governance-internal-checkpoint-ledger-v2/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEST_BASE_PATH = join(__dirname, "..", ".test-checkpoint-ledger");

// ── Recording store tests (existing) ─────────────────────────────────────────

test("checkpoint ledger records metadata-only entries", async () => {
  const store = createRecordingCheckpointLedgerStore();

  const entry = parseCheckpointLedgerEntry({
    checkpointId: "checkpoint-1",
    taskId: "ledger-task",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "governance-state:ledger-task:1",
    evidenceRefs: ["evidence:1"],
    reversibleActions: [
      {
        actionId: "action-1",
        kind: "file_patch",
        description: "patch package file"
      }
    ],
    irreversibleActions: [],
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  await store.record(entry);

  const latest = await store.findLatestForTask("ledger-task");
  assert.ok(latest);
  assert.equal(latest.checkpointId, "checkpoint-1");
});

test("checkpoint ledger entry has default schema version", () => {
  const entry = parseCheckpointLedgerEntry({
    checkpointId: "checkpoint-1",
    taskId: "ledger-task",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "governance-state:ledger-task:1",
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(entry.schemaVersion, "checkpoint-ledger-entry.v1");
});

test("checkpoint ledger finds latest for task among multiple entries", async () => {
  const store = createRecordingCheckpointLedgerStore();

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "checkpoint-1",
    taskId: "ledger-task",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "governance-state:ledger-task:1",
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "checkpoint-2",
    taskId: "ledger-task",
    branchId: "main",
    stage: "verification",
    governanceStateRef: "governance-state:ledger-task:2",
    createdAt: "2026-04-27T00:01:00.000Z"
  }));

  const latest = await store.findLatestForTask("ledger-task");
  assert.ok(latest);
  assert.equal(latest.checkpointId, "checkpoint-2");
});

test("checkpoint ledger detects irreversible actions", () => {
  const entry = parseCheckpointLedgerEntry({
    checkpointId: "checkpoint-3",
    taskId: "ledger-task",
    branchId: "main",
    stage: "release",
    governanceStateRef: "governance-state:ledger-task:3",
    irreversibleActions: [
      {
        actionId: "deploy-1",
        kind: "deploy",
        description: "deploy production release",
        requiresHumanReview: true
      }
    ],
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(hasIrreversibleActions(entry), true);
});

test("checkpoint ledger reports no irreversible actions when empty", () => {
  const entry = parseCheckpointLedgerEntry({
    checkpointId: "checkpoint-4",
    taskId: "ledger-task",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "governance-state:ledger-task:4",
    reversibleActions: [],
    irreversibleActions: [],
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(hasIrreversibleActions(entry), false);
});

test("checkpoint ledger loads all entries across tasks", async () => {
  const store = createRecordingCheckpointLedgerStore();

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "cp-a",
    taskId: "task-a",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "gs:task-a:1",
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "cp-b",
    taskId: "task-b",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "gs:task-b:1",
    createdAt: "2026-04-27T00:01:00.000Z"
  }));

  const all = await store.loadAll();
  assert.equal(all.length, 2);
});

test("checkpoint ledger supports parent checkpoint chain", () => {
  const entry = parseCheckpointLedgerEntry({
    checkpointId: "cp-child",
    taskId: "ledger-task",
    parentCheckpointId: "cp-parent",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "gs:ledger-task:2",
    createdAt: "2026-04-27T00:01:00.000Z"
  });

  assert.equal(entry.parentCheckpointId, "cp-parent");
});

// ── File store tests ─────────────────────────────────────────────────────────

test("file checkpoint ledger store persists entries to disk", async () => {
  const store = createFileCheckpointLedgerStore({ basePath: TEST_BASE_PATH });

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "file-cp-1",
    taskId: "file-task",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "gs:file-task:1",
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  const latest = await store.findLatestForTask("file-task");
  assert.ok(latest);
  assert.equal(latest.checkpointId, "file-cp-1");

  await rm(TEST_BASE_PATH, { recursive: true, force: true });
});

test("file checkpoint ledger store finds latest for task", async () => {
  const store = createFileCheckpointLedgerStore({ basePath: TEST_BASE_PATH });

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "file-cp-1",
    taskId: "file-task-2",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "gs:file-task-2:1",
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "file-cp-2",
    taskId: "file-task-2",
    branchId: "main",
    stage: "verification",
    governanceStateRef: "gs:file-task-2:2",
    createdAt: "2026-04-27T00:01:00.000Z"
  }));

  const latest = await store.findLatestForTask("file-task-2");
  assert.ok(latest);
  assert.equal(latest.checkpointId, "file-cp-2");

  await rm(TEST_BASE_PATH, { recursive: true, force: true });
});

test("file checkpoint ledger store loads all entries", async () => {
  const store = createFileCheckpointLedgerStore({ basePath: TEST_BASE_PATH });

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "file-cp-a",
    taskId: "file-task-a",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "gs:file-task-a:1",
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  await store.record(parseCheckpointLedgerEntry({
    checkpointId: "file-cp-b",
    taskId: "file-task-b",
    branchId: "main",
    stage: "execution",
    governanceStateRef: "gs:file-task-b:1",
    createdAt: "2026-04-27T00:01:00.000Z"
  }));

  const all = await store.loadAll();
  assert.ok(all.length >= 2);

  await rm(TEST_BASE_PATH, { recursive: true, force: true });
});

test("file checkpoint ledger store returns undefined for non-existent task", async () => {
  const store = createFileCheckpointLedgerStore({ basePath: TEST_BASE_PATH });
  const latest = await store.findLatestForTask("non-existent-task");
  assert.equal(latest, undefined);
});
