import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryKernelStore } from "../packages/kernel-store/src/index.js";
import { RunManager } from "../packages/run-manager/src/index.js";
import type { Principal, Task } from "../packages/kernel-contracts/src/index.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

test("run-manager creates a queued run from a task", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_create_001",
    policyDecisionId: "decision_run_manager_001"
  });

  assert.equal(run.runId, "run_manager_create_001");
  assert.equal(run.taskId, validTask.taskId);
  assert.equal(run.status, "queued");
  assert.equal(run.policyDecisionId, "decision_run_manager_001");
  assert.equal(run.createdAt, "2026-06-04T00:00:00.000Z");
  assert.equal(store.getRun(run.runId)?.runId, run.runId);
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    ["kernel.run.created"]
  );
});

test("run-manager drives run lifecycle to success", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_success_001"
  });

  const started = manager.startRun(run.runId);
  const completed = manager.completeRun(run.runId, {
    summary: "done"
  });

  assert.equal(started.status, "running");
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.completedAt, "2026-06-04T00:04:00.000Z");
  assert.deepEqual(completed.metadata?.legacy?.result, {
    summary: "done"
  });
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.run.started",
      "kernel.run.completed"
    ]
  );
});

test("run-manager drives run lifecycle to failure", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_failure_001"
  });

  manager.startRun(run.runId);
  const failed = manager.failRun(run.runId, new Error("planned failure"));

  assert.equal(failed.status, "failed");
  assert.equal(failed.completedAt, "2026-06-04T00:04:00.000Z");
  assert.deepEqual(failed.metadata?.legacy?.error, {
    name: "Error",
    message: "planned failure"
  });
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.run.started",
      "kernel.run.failed"
    ]
  );
});

test("run-manager cancels queued and running runs", () => {
  const { manager, store } = createHarness();
  const queued = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_cancel_queued_001"
  });
  const running = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_cancel_running_001"
  });

  const cancelledQueued = manager.cancelRun(queued.runId, "operator stopped before start");
  manager.startRun(running.runId);
  const cancelledRunning = manager.cancelRun(running.runId, "operator stopped during run");

  assert.equal(cancelledQueued.status, "cancelled");
  assert.equal(cancelledRunning.status, "cancelled");
  assert.equal(cancelledQueued.metadata?.legacy?.cancelReason, "operator stopped before start");
  assert.equal(cancelledRunning.metadata?.legacy?.cancelReason, "operator stopped during run");
  assert.deepEqual(
    store.listEvents({ runId: queued.runId }).map((event) => event.eventType),
    ["kernel.run.created", "kernel.run.cancelled"]
  );
});

test("run-manager starts blocked runs after approval", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_blocked_resume_001"
  });

  store.updateRun(run.runId, {
    status: "blocked",
    updatedAt: "2026-06-04T00:02:00.000Z",
    metadata: {
      legacy: {
        approvalRequired: true
      }
    }
  });
  const started = manager.startRun(run.runId);

  assert.equal(started.status, "running");
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.run.started"
    ]
  );
});

test("run-manager rejects invalid run transitions", () => {
  const { manager } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_invalid_001"
  });

  assert.throws(
    () => manager.completeRun(run.runId, {}),
    /invalid_run_transition:queued->succeeded/
  );

  manager.startRun(run.runId);
  manager.completeRun(run.runId, {});

  assert.throws(
    () => manager.failRun(run.runId, "too late"),
    /run_terminal:succeeded/
  );
});

test("run-manager creates pending steps for a run", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_step_create_001"
  });
  const step = manager.createStep(run.runId, {
    stepId: "step_run_manager_create_001",
    kind: "tool",
    input: {
      requestedTool: "dry-run-tool"
    }
  });

  assert.equal(step.stepId, "step_run_manager_create_001");
  assert.equal(step.runId, run.runId);
  assert.equal(step.taskId, run.taskId);
  assert.equal(step.status, "pending");
  assert.deepEqual(step.input, {
    requestedTool: "dry-run-tool"
  });
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    ["kernel.run.created", "kernel.step.created"]
  );
});

test("run-manager drives step lifecycle to success", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_step_success_001"
  });
  const step = manager.createStep(run.runId, {
    stepId: "step_run_manager_success_001",
    kind: "executor"
  });

  const started = manager.startStep(step.stepId);
  const completed = manager.completeStep(step.stepId, {
    summary: "step complete"
  });

  assert.equal(started.status, "running");
  assert.equal(completed.status, "succeeded");
  assert.deepEqual(completed.output, {
    summary: "step complete"
  });
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.step.created",
      "kernel.step.started",
      "kernel.step.completed"
    ]
  );
});

test("run-manager drives step lifecycle to failure", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_step_failure_001"
  });
  const step = manager.createStep(run.runId, {
    stepId: "step_run_manager_failure_001",
    kind: "tool"
  });

  manager.startStep(step.stepId);
  const failed = manager.failStep(step.stepId, "tool failed before execution");

  assert.equal(failed.status, "failed");
  assert.deepEqual(failed.output, {
    error: {
      message: "tool failed before execution"
    }
  });
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.step.created",
      "kernel.step.started",
      "kernel.step.failed"
    ]
  );
});

test("run-manager cancels pending and running steps", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_step_cancel_001"
  });
  const pending = manager.createStep(run.runId, {
    stepId: "step_run_manager_cancel_pending_001",
    kind: "approval"
  });
  const running = manager.createStep(run.runId, {
    stepId: "step_run_manager_cancel_running_001",
    kind: "tool"
  });

  const cancelledPending = manager.cancelStep(pending.stepId, "approval no longer needed");
  manager.startStep(running.stepId);
  const cancelledRunning = manager.cancelStep(running.stepId, "operator stopped step");

  assert.equal(cancelledPending.status, "cancelled");
  assert.equal(cancelledRunning.status, "cancelled");
  assert.deepEqual(cancelledPending.output, {
    cancelReason: "approval no longer needed"
  });
  assert.deepEqual(cancelledRunning.output, {
    cancelReason: "operator stopped step"
  });
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.step.created",
      "kernel.step.created",
      "kernel.step.cancelled",
      "kernel.step.started",
      "kernel.step.cancelled"
    ]
  );
});

test("run-manager emits events in lifecycle order", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_event_order_001"
  });
  const step = manager.createStep(run.runId, {
    stepId: "step_run_manager_event_order_001",
    kind: "checkpoint"
  });

  manager.startRun(run.runId);
  manager.startStep(step.stepId);
  manager.completeStep(step.stepId, { checkpoint: "ok" });
  manager.completeRun(run.runId, { summary: "run complete" });

  const events = store.listEvents({ runId: run.runId });

  assert.deepEqual(events.map((event) => event.eventType), [
    "kernel.run.created",
    "kernel.step.created",
    "kernel.run.started",
    "kernel.step.started",
    "kernel.step.completed",
    "kernel.run.completed"
  ]);
  assert.deepEqual(events.map((event) => event.createdAt), [
    "2026-06-04T00:01:00.000Z",
    "2026-06-04T00:03:00.000Z",
    "2026-06-04T00:05:00.000Z",
    "2026-06-04T00:07:00.000Z",
    "2026-06-04T00:09:00.000Z",
    "2026-06-04T00:11:00.000Z"
  ]);
});

function createHarness(): {
  store: InMemoryKernelStore;
  manager: RunManager;
} {
  const store = new InMemoryKernelStore();
  const timestamps = [
    "2026-06-04T00:00:00.000Z",
    "2026-06-04T00:01:00.000Z",
    "2026-06-04T00:02:00.000Z",
    "2026-06-04T00:03:00.000Z",
    "2026-06-04T00:04:00.000Z",
    "2026-06-04T00:05:00.000Z",
    "2026-06-04T00:06:00.000Z",
    "2026-06-04T00:07:00.000Z",
    "2026-06-04T00:08:00.000Z",
    "2026-06-04T00:09:00.000Z",
    "2026-06-04T00:10:00.000Z",
    "2026-06-04T00:11:00.000Z"
  ];
  let index = 0;
  const manager = new RunManager({
    store,
    now: () => timestamps[index++] ?? "2026-06-04T00:59:00.000Z"
  });

  return {
    store,
    manager
  };
}

const _typeCheckTask: Task = validTask;
const _typeCheckPrincipal: Principal = validPrincipal;
void _typeCheckTask;
void _typeCheckPrincipal;
