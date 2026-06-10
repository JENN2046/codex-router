import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileSystemScheduler,
  InMemoryScheduler
} from "../packages/scheduler/src/index.js";

test("scheduler enqueues and acquires a run lease", () => {
  const clock = createClock();
  const scheduler = new InMemoryScheduler({ clock, defaultLeaseDurationMs: 60_000 });

  const queued = scheduler.enqueueRun("run_scheduler_001", { maxAttempts: 2 });
  const lease = scheduler.acquireLease("worker_001");

  assert.equal(queued.runId, "run_scheduler_001");
  assert.equal(queued.status, "queued");
  assert.ok(lease);
  assert.equal(lease.runId, "run_scheduler_001");
  assert.equal(lease.workerId, "worker_001");
  assert.equal(lease.status, "active");
  assert.equal(lease.attempt, 1);
  assert.equal(lease.expiresAt, "2026-06-04T00:01:00.000Z");
  assert.equal(scheduler.listQueue()[0]?.status, "leased");
});

test("scheduler allows only one active lease per run", () => {
  const scheduler = new InMemoryScheduler({ clock: createClock() });

  scheduler.enqueueRun("run_scheduler_active_001", { maxAttempts: 2 });
  const first = scheduler.acquireLease("worker_001");
  const second = scheduler.acquireLease("worker_002");

  assert.ok(first);
  assert.equal(second, undefined);
  assert.equal(
    scheduler.listLeases().filter((lease) => lease.status === "active").length,
    1
  );
});

test("scheduler renews an active lease", () => {
  const clock = createClock();
  const scheduler = new InMemoryScheduler({ clock, defaultLeaseDurationMs: 60_000 });

  scheduler.enqueueRun("run_scheduler_renew_001");
  const lease = scheduler.acquireLease("worker_001");
  assert.ok(lease);

  clock.set("2026-06-04T00:00:30.000Z");
  const renewed = scheduler.renewLease(lease.leaseId, { leaseDurationMs: 120_000 });

  assert.equal(renewed.status, "active");
  assert.equal(renewed.heartbeatAt, "2026-06-04T00:00:30.000Z");
  assert.equal(renewed.expiresAt, "2026-06-04T00:02:30.000Z");
});

test("scheduler releases a lease without completing the run itself", () => {
  const scheduler = new InMemoryScheduler({ clock: createClock() });

  scheduler.enqueueRun("run_scheduler_release_001");
  const lease = scheduler.acquireLease("worker_001");
  assert.ok(lease);

  const released = scheduler.releaseLease(lease.leaseId, { summary: "done" });

  assert.equal(released.status, "released");
  assert.deepEqual(released.result, { summary: "done" });
  assert.equal(scheduler.listQueue()[0]?.status, "completed");
});

test("scheduler reacquires expired leases and increments attempts", () => {
  const clock = createClock();
  const scheduler = new InMemoryScheduler({ clock, defaultLeaseDurationMs: 60_000 });

  scheduler.enqueueRun("run_scheduler_expired_001", { maxAttempts: 2 });
  const first = scheduler.acquireLease("worker_001");
  assert.ok(first);

  clock.set("2026-06-04T00:01:01.000Z");
  const second = scheduler.acquireLease("worker_002");

  assert.ok(second);
  assert.equal(second.runId, first.runId);
  assert.equal(second.workerId, "worker_002");
  assert.equal(second.attempt, 2);
  assert.equal(scheduler.listLeases()[0]?.status, "expired");
  assert.equal(scheduler.listLeases()[1]?.status, "active");
});

test("scheduler rejects invalid clocks before expiring active leases", () => {
  const clock = createClock();
  const scheduler = new InMemoryScheduler({ clock, defaultLeaseDurationMs: 60_000 });

  scheduler.enqueueRun("run_scheduler_invalid_clock_001", { maxAttempts: 2 });
  const lease = scheduler.acquireLease("worker_001");
  assert.ok(lease);

  clock.set("not-a-timestamp");

  assert.throws(
    () => scheduler.listLeases(),
    /invalid_clock_timestamp:not-a-timestamp/
  );
  assert.throws(
    () => scheduler.listQueue(),
    /invalid_clock_timestamp:not-a-timestamp/
  );

  assert.throws(
    () => scheduler.renewLease(lease.leaseId),
    /invalid_clock_timestamp:not-a-timestamp/
  );

  clock.set("2026-06-04T00:00:30.000Z");
  assert.equal(scheduler.listLeases()[0]?.status, "active");
  assert.equal(scheduler.listQueue()[0]?.status, "leased");
});

test("scheduler expires leases before listing the queue", () => {
  const clock = createClock();
  const scheduler = new InMemoryScheduler({ clock, defaultLeaseDurationMs: 60_000 });

  scheduler.enqueueRun("run_scheduler_list_expired_001", { maxAttempts: 2 });
  const lease = scheduler.acquireLease("worker_001");
  assert.ok(lease);

  clock.set("2026-06-04T00:01:01.000Z");
  const queue = scheduler.listQueue();

  assert.equal(queue[0]?.status, "queued");
  assert.equal(scheduler.listLeases()[0]?.status, "expired");
});

test("scheduler retries failed leases while attempts remain", () => {
  const scheduler = new InMemoryScheduler({ clock: createClock() });

  scheduler.enqueueRun("run_scheduler_retry_001", { maxAttempts: 2 });
  const first = scheduler.acquireLease("worker_001");
  assert.ok(first);

  const failed = scheduler.failLease(first.leaseId, new Error("worker failed"));
  const retry = scheduler.acquireLease("worker_002");

  assert.equal(failed.status, "failed");
  assert.deepEqual(failed.error, {
    name: "Error",
    message: "worker failed"
  });
  assert.ok(retry);
  assert.equal(retry.attempt, 2);
  assert.equal(retry.workerId, "worker_002");
});

test("scheduler stops dispatching after maxAttempts is exhausted", () => {
  const scheduler = new InMemoryScheduler({ clock: createClock() });

  scheduler.enqueueRun("run_scheduler_exhausted_001", { maxAttempts: 1 });
  const first = scheduler.acquireLease("worker_001");
  assert.ok(first);

  scheduler.failLease(first.leaseId, "failed once");
  const next = scheduler.acquireLease("worker_002");

  assert.equal(next, undefined);
  assert.equal(scheduler.listQueue()[0]?.status, "exhausted");
});

test("scheduler lists queue and leases as stable snapshots", () => {
  const scheduler = new InMemoryScheduler({ clock: createClock() });

  scheduler.enqueueRun("run_scheduler_list_001", { maxAttempts: 2 });
  scheduler.enqueueRun("run_scheduler_list_002", { maxAttempts: 2 });
  const lease = scheduler.acquireLease("worker_001");
  assert.ok(lease);

  const queue = scheduler.listQueue();
  const leases = scheduler.listLeases();

  assert.deepEqual(queue.map((item) => item.runId), [
    "run_scheduler_list_001",
    "run_scheduler_list_002"
  ]);
  assert.deepEqual(queue.map((item) => item.status), ["leased", "queued"]);
  assert.deepEqual(leases.map((item) => item.leaseId), [lease.leaseId]);

  queue[0]!.status = "completed";
  leases[0]!.status = "released";

  assert.equal(scheduler.listQueue()[0]?.status, "leased");
  assert.equal(scheduler.listLeases()[0]?.status, "active");
});

test("file scheduler persists queue and leases across instances", async () => {
  const baseDir = await createSchedulerTempDir();
  try {
    const clock = createClock();
    const first = new FileSystemScheduler({
      baseDir,
      clock,
      defaultLeaseDurationMs: 60_000
    });

    first.enqueueRun("run_scheduler_file_001", { maxAttempts: 2 });
    const lease = first.acquireLease("worker_001");
    assert.ok(lease);

    const second = new FileSystemScheduler({ baseDir, clock });

    assert.equal(second.listQueue()[0]?.status, "leased");
    assert.equal(second.listLeases()[0]?.leaseId, lease.leaseId);
    assert.equal(second.acquireLease("worker_002"), undefined);
    assert.equal(
      second.listLeases().filter((item) => item.status === "active").length,
      1
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file scheduler reacquires expired leases across instances", async () => {
  const baseDir = await createSchedulerTempDir();
  try {
    const clock = createClock();
    const first = new FileSystemScheduler({
      baseDir,
      clock,
      defaultLeaseDurationMs: 60_000
    });

    first.enqueueRun("run_scheduler_file_expired_001", { maxAttempts: 2 });
    const firstLease = first.acquireLease("worker_001");
    assert.ok(firstLease);

    clock.set("2026-06-04T00:01:01.000Z");
    const second = new FileSystemScheduler({ baseDir, clock });
    const secondLease = second.acquireLease("worker_002");

    assert.ok(secondLease);
    assert.equal(secondLease.runId, firstLease.runId);
    assert.equal(secondLease.workerId, "worker_002");
    assert.equal(secondLease.attempt, 2);
    assert.deepEqual(
      second.listLeases().map((lease) => lease.status),
      ["expired", "active"]
    );
    assert.equal(second.listQueue()[0]?.status, "leased");
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file scheduler persists release and completion across instances", async () => {
  const baseDir = await createSchedulerTempDir();
  try {
    const clock = createClock();
    const first = new FileSystemScheduler({ baseDir, clock });

    first.enqueueRun("run_scheduler_file_release_001");
    const lease = first.acquireLease("worker_001");
    assert.ok(lease);
    first.releaseLease(lease.leaseId, { summary: "done" });

    const second = new FileSystemScheduler({ baseDir, clock });
    const released = second.listLeases()[0];

    assert.equal(second.listQueue()[0]?.status, "completed");
    assert.equal(released?.status, "released");
    assert.deepEqual(released?.result, { summary: "done" });
    assert.throws(
      () => second.enqueueRun("run_scheduler_file_release_001"),
      /run_not_enqueueable:completed/
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file scheduler refuses state mutation while another lock is present", async () => {
  const baseDir = await createSchedulerTempDir();
  try {
    await writeFile(join(baseDir, ".scheduler.lock"), "{\"token\":\"held\"}\n", "utf8");
    const scheduler = new FileSystemScheduler({
      baseDir,
      clock: createClock(),
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 60_000
    });

    assert.throws(
      () => scheduler.enqueueRun("run_scheduler_file_locked_001"),
      /scheduler_lock_timeout:/
    );
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("file scheduler does not remove a fresh lock during stale cleanup", async () => {
  const baseDir = await createSchedulerTempDir();
  try {
    const lockPath = join(baseDir, ".scheduler.lock");
    const lockPayload = `${JSON.stringify({
      token: "fresh-owner",
      createdAt: "2999-01-01T00:00:00.000Z"
    })}\n`;
    await writeFile(lockPath, lockPayload, "utf8");
    await utimes(lockPath, new Date(0), new Date(0));
    const scheduler = new FileSystemScheduler({
      baseDir,
      clock: createClock(),
      lockTimeoutMs: 0,
      lockRetryDelayMs: 0,
      lockStaleMs: 1
    });

    assert.throws(
      () => scheduler.enqueueRun("run_scheduler_file_fresh_lock_001"),
      /scheduler_lock_timeout:/
    );
    assert.equal(await readFile(lockPath, "utf8"), lockPayload);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

function createClock(initial = "2026-06-04T00:00:00.000Z"): {
  now(): string;
  set(value: string): void;
} {
  let current = initial;
  return {
    now: () => current,
    set: (value: string) => {
      current = value;
    }
  };
}

async function createSchedulerTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "codex-router-scheduler-"));
}
