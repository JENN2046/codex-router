import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryScheduler } from "../packages/scheduler/src/index.js";

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
  assert.equal(scheduler.listQueue()[0]?.status, "leased");

  assert.throws(
    () => scheduler.renewLease(lease.leaseId),
    /invalid_clock_timestamp:not-a-timestamp/
  );

  clock.set("2026-06-04T00:00:30.000Z");
  assert.equal(scheduler.listLeases()[0]?.status, "active");
  assert.equal(scheduler.listQueue()[0]?.status, "leased");
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
