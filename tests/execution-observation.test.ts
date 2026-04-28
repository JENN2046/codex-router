import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFileExecutionObservationStore,
  createRecordingExecutionObservationStore,
  parseExecutionObservation,
  createObservationId
} from "../packages/execution-observation/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEST_BASE_PATH = join(__dirname, "..", ".test-exec-observation");

// ── Recording store tests ────────────────────────────────────────────────────

test("execution observation parses a succeeded primitive event", () => {
  const observation = parseExecutionObservation({
    observationId: "obs-1",
    taskId: "task-1",
    primitiveId: "step-1",
    stage: "execution",
    status: "succeeded",
    signals: {},
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(observation.schemaVersion, "execution-observation.v1");
  assert.equal(observation.status, "succeeded");
  assert.equal(observation.taskId, "task-1");
});

test("execution observation parses a failed primitive with permission blocked signal", () => {
  const observation = parseExecutionObservation({
    observationId: "obs-2",
    taskId: "task-2",
    primitiveId: "step-2",
    stage: "execution",
    status: "failed",
    signals: {
      permissionBlocked: true,
      errorClass: "permission_denied"
    },
    evidenceRef: "evidence:step-2",
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(observation.status, "failed");
  assert.equal(observation.signals.permissionBlocked, true);
  assert.equal(observation.signals.errorClass, "permission_denied");
  assert.equal(observation.evidenceRef, "evidence:step-2");
});

test("recording observation store keeps events across emits", async () => {
  const store = createRecordingExecutionObservationStore();

  await store.emit(parseExecutionObservation({
    observationId: createObservationId({
      taskId: "task-1",
      primitiveId: "step-1",
      status: "succeeded",
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    taskId: "task-1",
    primitiveId: "step-1",
    stage: "execution",
    status: "succeeded",
    signals: {},
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  await store.emit(parseExecutionObservation({
    observationId: createObservationId({
      taskId: "task-1",
      primitiveId: "step-2",
      status: "failed",
      createdAt: "2026-04-27T00:01:00.000Z"
    }),
    taskId: "task-1",
    primitiveId: "step-2",
    stage: "execution",
    status: "failed",
    signals: {
      errorClass: "timeout"
    },
    createdAt: "2026-04-27T00:01:00.000Z"
  }));

  const all = await store.loadAll();
  const taskEvents = await store.findByTaskId("task-1");

  assert.equal(all.length, 2);
  assert.equal(taskEvents.length, 2);
});

test("recording observation store filters by taskId correctly", async () => {
  const store = createRecordingExecutionObservationStore();

  await store.emit(parseExecutionObservation({
    observationId: "obs-a",
    taskId: "task-a",
    primitiveId: "step-1",
    stage: "execution",
    status: "succeeded",
    signals: {},
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  await store.emit(parseExecutionObservation({
    observationId: "obs-b",
    taskId: "task-b",
    primitiveId: "step-1",
    stage: "execution",
    status: "succeeded",
    signals: {},
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  const taskAEvents = await store.findByTaskId("task-a");
  const taskBEvents = await store.findByTaskId("task-b");
  const noEvents = await store.findByTaskId("task-c");

  assert.equal(taskAEvents.length, 1);
  assert.equal(taskAEvents[0]?.taskId, "task-a");
  assert.equal(taskBEvents.length, 1);
  assert.equal(noEvents.length, 0);
});

test("createObservationId builds id from task, primitive, status, and timestamp", () => {
  const id = createObservationId({
    taskId: "task-1",
    primitiveId: "read_thread_terminal:0",
    status: "succeeded",
    createdAt: "2026-04-27T00:00:00.000Z"
  });

  assert.equal(id, "task-1:read_thread_terminal:0:succeeded:2026-04-27T00:00:00.000Z");
});

test("recording observation store returns empty array for unknown taskId", async () => {
  const store = createRecordingExecutionObservationStore();

  const events = await store.findByTaskId("nonexistent");

  assert.deepEqual(events, []);
});

// ── File store tests ─────────────────────────────────────────────────────────

test("file execution observation store persists events to disk", async () => {
  const store = createFileExecutionObservationStore({ basePath: TEST_BASE_PATH });

  await store.emit(parseExecutionObservation({
    observationId: "file-obs-1",
    taskId: "file-task",
    primitiveId: "step-1",
    stage: "execution",
    status: "succeeded",
    signals: {},
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  const all = await store.loadAll();
  const found = all.find(o => o.observationId === "file-obs-1");
  assert.ok(found);
  assert.equal(found.taskId, "file-task");

  await rm(TEST_BASE_PATH, { recursive: true, force: true });
});

test("file execution observation store finds by task id", async () => {
  const store = createFileExecutionObservationStore({ basePath: TEST_BASE_PATH });

  await store.emit(parseExecutionObservation({
    observationId: "file-obs-1",
    taskId: "file-task-2",
    primitiveId: "step-1",
    stage: "execution",
    status: "succeeded",
    signals: {},
    createdAt: "2026-04-27T00:00:00.000Z"
  }));

  await store.emit(parseExecutionObservation({
    observationId: "file-obs-2",
    taskId: "file-task-2",
    primitiveId: "step-2",
    stage: "execution",
    status: "failed",
    signals: { errorClass: "test" },
    createdAt: "2026-04-27T00:01:00.000Z"
  }));

  const events = await store.findByTaskId("file-task-2");
  assert.equal(events.length, 2);
  assert.equal(events[0]?.observationId, "file-obs-1");
  assert.equal(events[1]?.observationId, "file-obs-2");

  await rm(TEST_BASE_PATH, { recursive: true, force: true });
});

test("file execution observation store returns empty for non-existent task", async () => {
  const store = createFileExecutionObservationStore({ basePath: TEST_BASE_PATH });
  const events = await store.findByTaskId("non-existent");
  assert.deepEqual(events, []);
});
