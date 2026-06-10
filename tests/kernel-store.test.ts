import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileSystemKernelStore,
  InMemoryKernelStore
} from "../packages/kernel-store/src/index.js";
import {
  ArtifactSchema,
  EventSchema,
  RunSchema,
  StepSchema,
  type Artifact,
  type Event,
  type Run,
  type Step
} from "../packages/kernel-contracts/src/index.js";
import { validArtifact } from "../packages/kernel-contracts/test-fixtures/valid-artifact.js";
import { validEvent } from "../packages/kernel-contracts/test-fixtures/valid-event.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validStep } from "../packages/kernel-contracts/test-fixtures/valid-step.js";

test("kernel store supports run CRUD and filters", () => {
  const store = new InMemoryKernelStore();
  const firstRun = createRun();
  const secondRun = createRun({
    runId: "run_kernel_store_002",
    taskId: "task_kernel_store_002",
    status: "running"
  });

  assert.deepEqual(store.createRun(firstRun), firstRun);
  assert.deepEqual(store.getRun(firstRun.runId), firstRun);
  assert.equal(store.getRun("missing_run"), undefined);

  const updated = store.updateRun(firstRun.runId, {
    status: "running",
    updatedAt: "2026-06-04T01:00:00.000Z"
  });

  assert.equal(updated.runId, firstRun.runId);
  assert.equal(updated.status, "running");
  assert.equal(updated.updatedAt, "2026-06-04T01:00:00.000Z");

  store.createRun(secondRun);

  assert.deepEqual(
    store.listRuns({ taskId: firstRun.taskId }).map((run) => run.runId),
    [firstRun.runId]
  );
  assert.deepEqual(
    store.listRuns({ status: "running" }).map((run) => run.runId),
    [firstRun.runId, secondRun.runId]
  );
  assert.deepEqual(
    store.listRuns({ runId: secondRun.runId }).map((run) => run.taskId),
    [secondRun.taskId]
  );
});

test("kernel store supports step CRUD and filters", () => {
  const store = new InMemoryKernelStore();
  const run = store.createRun(createRun());
  const firstStep = createStep({ runId: run.runId });
  const secondStep = createStep({
    stepId: "step_kernel_store_002",
    runId: run.runId,
    kind: "approval",
    status: "blocked"
  });

  assert.deepEqual(store.createStep(firstStep), firstStep);
  assert.deepEqual(store.getStep(firstStep.stepId), firstStep);
  assert.equal(store.getStep("missing_step"), undefined);

  const updated = store.updateStep(firstStep.stepId, {
    status: "running",
    updatedAt: "2026-06-04T01:01:00.000Z",
    output: {
      result: "started"
    }
  });

  assert.equal(updated.stepId, firstStep.stepId);
  assert.equal(updated.status, "running");
  assert.deepEqual(updated.output, { result: "started" });

  store.createStep(secondStep);

  assert.deepEqual(
    store.listSteps(run.runId).map((step) => step.stepId),
    [firstStep.stepId, secondStep.stepId]
  );
  assert.deepEqual(
    store.listSteps(run.runId, { status: "blocked" }).map((step) => step.stepId),
    [secondStep.stepId]
  );
  assert.deepEqual(
    store.listSteps(run.runId, { type: "approval" }).map((step) => step.stepId),
    [secondStep.stepId]
  );
});

test("kernel store preserves event append order and supports filters", () => {
  const store = new InMemoryKernelStore();
  const firstEvent = createEvent({
    eventId: "event_kernel_store_001",
    eventType: "kernel.run.created"
  });
  const secondEvent = createEvent({
    eventId: "event_kernel_store_002",
    eventType: "kernel.step.started",
    stepId: "step_kernel_store_001"
  });
  const thirdEvent = createEvent({
    eventId: "event_kernel_store_003",
    taskId: "task_kernel_store_other",
    runId: "run_kernel_store_other",
    eventType: "kernel.run.created"
  });

  store.appendEvent(firstEvent);
  store.appendEvent(secondEvent);
  store.appendEvent(thirdEvent);

  assert.deepEqual(
    store.listEvents().map((event) => event.eventId),
    [firstEvent.eventId, secondEvent.eventId, thirdEvent.eventId]
  );
  assert.deepEqual(
    store.listEvents({ runId: firstEvent.runId! }).map((event) => event.eventId),
    [firstEvent.eventId, secondEvent.eventId]
  );
  assert.deepEqual(
    store.listEvents({ type: "kernel.run.created" }).map((event) => event.eventId),
    [firstEvent.eventId, thirdEvent.eventId]
  );
});

test("kernel store supports artifact CRUD and filters", () => {
  const store = new InMemoryKernelStore();
  const firstArtifact = createArtifact();
  const secondArtifact = createArtifact({
    artifactId: "artifact_kernel_store_002",
    taskId: "task_kernel_store_002",
    runId: "run_kernel_store_002",
    kind: "patch"
  });

  assert.deepEqual(store.createArtifact(firstArtifact), firstArtifact);
  assert.deepEqual(store.getArtifact(firstArtifact.artifactId), firstArtifact);
  assert.equal(store.getArtifact("missing_artifact"), undefined);

  store.createArtifact(secondArtifact);

  assert.deepEqual(
    store.listArtifacts({ taskId: firstArtifact.taskId }).map((artifact) => artifact.artifactId),
    [firstArtifact.artifactId]
  );
  assert.deepEqual(
    store.listArtifacts({ runId: secondArtifact.runId! }).map((artifact) => artifact.artifactId),
    [secondArtifact.artifactId]
  );
  assert.deepEqual(
    store.listArtifacts({ type: "patch" }).map((artifact) => artifact.artifactId),
    [secondArtifact.artifactId]
  );
});

test("kernel store rejects duplicate ids", () => {
  const store = new InMemoryKernelStore();
  const run = createRun();
  const step = createStep();
  const event = createEvent();
  const artifact = createArtifact();

  store.createRun(run);
  assert.throws(() => store.createRun(run), /duplicate_run_id/);

  store.createStep(step);
  assert.throws(() => store.createStep(step), /duplicate_step_id/);

  store.appendEvent(event);
  assert.throws(() => store.appendEvent(event), /duplicate_event_id/);

  store.createArtifact(artifact);
  assert.throws(() => store.createArtifact(artifact), /duplicate_artifact_id/);
});

test("kernel store updates cannot change ids", () => {
  const store = new InMemoryKernelStore();
  const run = store.createRun(createRun());
  const step = store.createStep(createStep({ runId: run.runId }));

  assert.throws(
    () => store.updateRun(run.runId, { runId: "run_changed" }),
    /run_id_update_forbidden/
  );
  assert.equal(store.getRun(run.runId)?.runId, run.runId);

  assert.throws(
    () => store.updateStep(step.stepId, { stepId: "step_changed" }),
    /step_id_update_forbidden/
  );
  assert.equal(store.getStep(step.stepId)?.stepId, step.stepId);
});

test("file kernel store persists runs, steps, events, and artifacts across instances", async () => {
  const baseDir = await createKernelStoreTempDir();
  try {
    const first = new FileSystemKernelStore({ baseDir });
    const run = first.createRun(createRun());
    const step = first.createStep(createStep({ runId: run.runId }));
    const firstEvent = first.appendEvent(createEvent({
      eventId: "event_kernel_store_file_001",
      eventType: "kernel.run.created"
    }));
    const secondEvent = first.appendEvent(createEvent({
      eventId: "event_kernel_store_file_002",
      eventType: "kernel.step.created",
      stepId: step.stepId
    }));
    const artifact = first.createArtifact(createArtifact({
      artifactId: "artifact_kernel_store_file_001"
    }));

    first.updateRun(run.runId, {
      status: "running",
      updatedAt: "2026-06-04T01:10:00.000Z"
    });
    first.updateStep(step.stepId, {
      status: "running",
      updatedAt: "2026-06-04T01:11:00.000Z"
    });

    const second = new FileSystemKernelStore({ baseDir });

    assert.equal(second.getRun(run.runId)?.status, "running");
    assert.equal(second.getStep(step.stepId)?.status, "running");
    assert.deepEqual(
      second.listEvents().map((event) => event.eventId),
      [firstEvent.eventId, secondEvent.eventId]
    );
    assert.deepEqual(
      second.listEvents({ type: "kernel.run.created" }).map((event) => event.eventId),
      [firstEvent.eventId]
    );
    assert.deepEqual(second.getArtifact(artifact.artifactId), artifact);
    assert.deepEqual(
      second.listArtifacts({ type: "evidence" }).map((item) => item.artifactId),
      [artifact.artifactId]
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file kernel store rejects duplicate ids after reload", async () => {
  const baseDir = await createKernelStoreTempDir();
  try {
    const first = new FileSystemKernelStore({ baseDir });
    const run = first.createRun(createRun());
    const step = first.createStep(createStep({ runId: run.runId }));
    const event = first.appendEvent(createEvent());
    const artifact = first.createArtifact(createArtifact());

    const second = new FileSystemKernelStore({ baseDir });

    assert.throws(() => second.createRun(run), /duplicate_run_id/);
    assert.throws(() => second.createStep(step), /duplicate_step_id/);
    assert.throws(() => second.appendEvent(event), /duplicate_event_id/);
    assert.throws(() => second.createArtifact(artifact), /duplicate_artifact_id/);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file kernel store refuses state mutation while another lock is present", async () => {
  const baseDir = await createKernelStoreTempDir();
  try {
    await writeFile(join(baseDir, ".kernel-store.lock"), "{\"token\":\"held\"}\n", "utf8");
    const store = new FileSystemKernelStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 60_000
    });

    assert.throws(
      () => store.createRun(createRun()),
      /kernel_store_lock_timeout:/
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file kernel store does not remove a fresh lock during stale cleanup", async () => {
  const baseDir = await createKernelStoreTempDir();
  try {
    const lockPath = join(baseDir, ".kernel-store.lock");
    const lockPayload = `${JSON.stringify({
      token: "fresh-owner",
      createdAt: "2999-01-01T00:00:00.000Z"
    })}\n`;
    await writeFile(lockPath, lockPayload, "utf8");
    await utimes(lockPath, new Date(0), new Date(0));
    const store = new FileSystemKernelStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 1
    });

    assert.throws(
      () => store.createRun(createRun({ runId: "run_kernel_store_fresh_lock_001" })),
      /kernel_store_lock_timeout:/
    );
    assert.equal(await readFile(lockPath, "utf8"), lockPayload);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file kernel store does not remove a stale-looking lock owned by a live process", async () => {
  const baseDir = await createKernelStoreTempDir();
  try {
    const lockPath = join(baseDir, ".kernel-store.lock");
    const lockPayload = `${JSON.stringify({
      token: "live-owner",
      pid: process.pid,
      createdAt: "2000-01-01T00:00:00.000Z"
    })}\n`;
    await writeFile(lockPath, lockPayload, "utf8");
    await utimes(lockPath, new Date(0), new Date(0));
    const store = new FileSystemKernelStore({
      baseDir,
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 1
    });

    assert.throws(
      () => store.createRun(createRun({ runId: "run_kernel_store_live_lock_001" })),
      /kernel_store_lock_timeout:/
    );
    assert.equal(await readFile(lockPath, "utf8"), lockPayload);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

function createRun(overrides: Partial<Run> = {}): Run {
  return RunSchema.parse({
    ...validRun,
    runId: "run_kernel_store_001",
    taskId: "task_kernel_store_001",
    status: "queued",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...overrides
  });
}

function createStep(overrides: Partial<Step> = {}): Step {
  return StepSchema.parse({
    ...validStep,
    stepId: "step_kernel_store_001",
    runId: "run_kernel_store_001",
    taskId: "task_kernel_store_001",
    kind: "tool",
    status: "pending",
    createdAt: "2026-06-04T00:01:00.000Z",
    updatedAt: "2026-06-04T00:01:00.000Z",
    input: {},
    ...overrides
  });
}

function createEvent(overrides: Partial<Event> = {}): Event {
  return EventSchema.parse({
    ...validEvent,
    eventId: "event_kernel_store_001",
    eventType: "kernel.store.fixture",
    taskId: "task_kernel_store_001",
    runId: "run_kernel_store_001",
    stepId: undefined,
    principalId: undefined,
    createdAt: "2026-06-04T00:02:00.000Z",
    payload: {},
    ...overrides
  });
}

function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return ArtifactSchema.parse({
    ...validArtifact,
    artifactId: "artifact_kernel_store_001",
    taskId: "task_kernel_store_001",
    runId: "run_kernel_store_001",
    kind: "evidence",
    uri: "memory://artifact/kernel-store-001",
    sha256: "a".repeat(64),
    sizeBytes: 10,
    createdAt: "2026-06-04T00:03:00.000Z",
    metadata: {},
    ...overrides
  });
}

async function createKernelStoreTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "codex-router-kernel-store-"));
}
