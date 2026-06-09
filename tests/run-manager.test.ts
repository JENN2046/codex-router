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

  manager.startRun(run.runId);
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
      "kernel.run.started",
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

  manager.startRun(run.runId);
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
      "kernel.run.started",
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

  manager.startRun(run.runId);
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
      "kernel.run.started",
      "kernel.step.cancelled",
      "kernel.step.started",
      "kernel.step.cancelled"
    ]
  );
});

test("run-manager starts dependent steps only after dependencies succeed", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_step_dependencies_001"
  });
  const dependency = manager.createStep(run.runId, {
    stepId: "step_run_manager_dependency_001",
    kind: "approval"
  });
  const dependent = manager.createStep(run.runId, {
    stepId: "step_run_manager_dependent_001",
    kind: "tool",
    dependsOn: [dependency.stepId]
  });

  manager.startRun(run.runId);
  assert.throws(
    () => manager.startStep(dependent.stepId),
    /step_dependency_not_succeeded:step_run_manager_dependency_001:pending/
  );

  manager.startStep(dependency.stepId);
  assert.throws(
    () => manager.startStep(dependent.stepId),
    /step_dependency_not_succeeded:step_run_manager_dependency_001:running/
  );

  manager.completeStep(dependency.stepId, {
    summary: "dependency complete"
  });
  const started = manager.startStep(dependent.stepId);

  assert.equal(started.status, "running");
  assert.deepEqual(
    store.listEvents({ runId: run.runId }).map((event) => event.eventType),
    [
      "kernel.run.created",
      "kernel.step.created",
      "kernel.step.created",
      "kernel.run.started",
      "kernel.step.started",
      "kernel.step.completed",
      "kernel.step.started"
    ]
  );
});

test("run-manager rejects dependencies that are failed, skipped, cancelled, missing, or foreign", () => {
  const cases: Array<{
    status: "failed" | "skipped" | "cancelled";
    prepare: (harness: ReturnType<typeof createHarness>, dependencyStepId: string) => void;
  }> = [
    {
      status: "failed",
      prepare: ({ manager }, dependencyStepId) => {
        manager.startStep(dependencyStepId);
        manager.failStep(dependencyStepId, "dependency failed");
      }
    },
    {
      status: "skipped",
      prepare: ({ store }, dependencyStepId) => {
        store.updateStep(dependencyStepId, {
          status: "skipped",
          updatedAt: "2026-06-04T00:05:00.000Z"
        });
      }
    },
    {
      status: "cancelled",
      prepare: ({ manager }, dependencyStepId) => {
        manager.cancelStep(dependencyStepId, "dependency cancelled");
      }
    }
  ];

  for (const entry of cases) {
    const harness = createHarness();
    const run = harness.manager.createRunFromTask(validTask, validPrincipal, {
      runId: `run_manager_step_dependency_${entry.status}_001`
    });
    const dependency = harness.manager.createStep(run.runId, {
      stepId: `step_run_manager_dependency_${entry.status}_001`,
      kind: "approval"
    });
    const dependent = harness.manager.createStep(run.runId, {
      stepId: `step_run_manager_dependent_${entry.status}_001`,
      kind: "tool",
      dependsOn: [dependency.stepId]
    });

    harness.manager.startRun(run.runId);
    entry.prepare(harness, dependency.stepId);

    assert.throws(
      () => harness.manager.startStep(dependent.stepId),
      new RegExp(`step_dependency_not_succeeded:${dependency.stepId}:${entry.status}`)
    );
    assert.equal(harness.store.getStep(dependent.stepId)?.status, "pending");
  }

  const missingHarness = createHarness();
  const missingRun = missingHarness.manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_missing_dependency_001"
  });
  const missingDependent = missingHarness.manager.createStep(missingRun.runId, {
    stepId: "step_run_manager_missing_dependency_001",
    kind: "tool",
    dependsOn: ["step_run_manager_dependency_missing_001"]
  });
  missingHarness.manager.startRun(missingRun.runId);

  assert.throws(
    () => missingHarness.manager.startStep(missingDependent.stepId),
    /step_not_found:step_run_manager_dependency_missing_001/
  );

  const foreignHarness = createHarness();
  const dependencyRun = foreignHarness.manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_foreign_dependency_source_001"
  });
  const dependentRun = foreignHarness.manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_foreign_dependency_target_001"
  });
  const foreignDependency = foreignHarness.manager.createStep(dependencyRun.runId, {
    stepId: "step_run_manager_foreign_dependency_001",
    kind: "approval"
  });
  const foreignDependent = foreignHarness.manager.createStep(dependentRun.runId, {
    stepId: "step_run_manager_foreign_dependent_001",
    kind: "tool",
    dependsOn: [foreignDependency.stepId]
  });

  foreignHarness.manager.startRun(dependencyRun.runId);
  foreignHarness.manager.startStep(foreignDependency.stepId);
  foreignHarness.manager.completeStep(foreignDependency.stepId, {
    summary: "foreign dependency complete"
  });
  foreignHarness.manager.startRun(dependentRun.runId);

  assert.throws(
    () => foreignHarness.manager.startStep(foreignDependent.stepId),
    /step_dependency_run_mismatch:step_run_manager_foreign_dependency_001:run_manager_foreign_dependency_source_001:run_manager_foreign_dependency_target_001/
  );
  assert.equal(foreignHarness.store.getStep(foreignDependent.stepId)?.status, "pending");
});

test("run-manager rejects step transitions until parent run is running", () => {
  const queuedHarness = createHarness();
  const queuedRun = queuedHarness.manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_step_before_start_001"
  });
  const queuedStep = queuedHarness.manager.createStep(queuedRun.runId, {
    stepId: "step_run_manager_before_start_001",
    kind: "tool"
  });
  const runningQueuedStep = queuedHarness.manager.createStep(queuedRun.runId, {
    stepId: "step_run_manager_running_before_start_001",
    kind: "tool"
  });
  queuedHarness.store.updateStep(runningQueuedStep.stepId, {
    status: "running",
    updatedAt: "2026-06-04T00:05:00.000Z"
  });

  assert.throws(
    () => queuedHarness.manager.startStep(queuedStep.stepId),
    /run_not_running:queued/
  );
  assert.throws(
    () => queuedHarness.manager.cancelStep(queuedStep.stepId, "too early"),
    /run_not_running:queued/
  );
  assert.throws(
    () => queuedHarness.manager.completeStep(runningQueuedStep.stepId, {
      summary: "should not complete before run starts"
    }),
    /run_not_running:queued/
  );
  assert.throws(
    () => queuedHarness.manager.failStep(
      runningQueuedStep.stepId,
      "should not fail before run starts"
    ),
    /run_not_running:queued/
  );
  assert.throws(
    () => queuedHarness.manager.cancelStep(
      runningQueuedStep.stepId,
      "should not cancel before run starts"
    ),
    /run_not_running:queued/
  );
  assert.equal(queuedHarness.store.getStep(queuedStep.stepId)?.status, "pending");
  assert.equal(queuedHarness.store.getStep(runningQueuedStep.stepId)?.status, "running");
  assert.equal(
    queuedHarness.store.listEvents({ runId: queuedRun.runId })
      .some((event) => event.eventType === "kernel.step.started"),
    false
  );

  const blockedHarness = createHarness();
  const blockedRun = blockedHarness.manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_step_while_blocked_001"
  });
  const pendingBlockedStep = blockedHarness.manager.createStep(blockedRun.runId, {
    stepId: "step_run_manager_pending_while_blocked_001",
    kind: "approval"
  });
  const runningBlockedStep = blockedHarness.manager.createStep(blockedRun.runId, {
    stepId: "step_run_manager_running_while_blocked_001",
    kind: "tool"
  });

  blockedHarness.manager.startRun(blockedRun.runId);
  blockedHarness.manager.startStep(runningBlockedStep.stepId);
  blockedHarness.store.updateRun(blockedRun.runId, {
    status: "blocked",
    updatedAt: "2026-06-04T00:05:00.000Z"
  });

  assert.throws(
    () => blockedHarness.manager.startStep(pendingBlockedStep.stepId),
    /run_not_running:blocked/
  );
  assert.throws(
    () => blockedHarness.manager.cancelStep(pendingBlockedStep.stepId, "blocked approval"),
    /run_not_running:blocked/
  );
  assert.throws(
    () => blockedHarness.manager.completeStep(runningBlockedStep.stepId, {
      summary: "should not complete while blocked"
    }),
    /run_not_running:blocked/
  );
  assert.throws(
    () => blockedHarness.manager.failStep(
      runningBlockedStep.stepId,
      "should not fail while blocked"
    ),
    /run_not_running:blocked/
  );
  assert.throws(
    () => blockedHarness.manager.cancelStep(
      runningBlockedStep.stepId,
      "should not cancel while blocked"
    ),
    /run_not_running:blocked/
  );
  assert.equal(blockedHarness.store.getStep(pendingBlockedStep.stepId)?.status, "pending");
  assert.equal(blockedHarness.store.getStep(runningBlockedStep.stepId)?.status, "running");
});

test("run-manager rejects step transitions after parent run is terminal", () => {
  const cases: Array<{
    runId: string;
    stepId: string;
    terminalStatus: "cancelled" | "failed" | "succeeded";
    makeTerminal: (manager: RunManager, runId: string) => void;
  }> = [
    {
      runId: "run_manager_step_after_cancel_001",
      stepId: "step_run_manager_after_cancel_001",
      terminalStatus: "cancelled",
      makeTerminal: (manager, runId) => {
        manager.cancelRun(runId, "operator stopped run");
      }
    },
    {
      runId: "run_manager_step_after_fail_001",
      stepId: "step_run_manager_after_fail_001",
      terminalStatus: "failed",
      makeTerminal: (manager, runId) => {
        manager.startRun(runId);
        manager.failRun(runId, "run failed before step dispatch");
      }
    },
    {
      runId: "run_manager_step_after_complete_001",
      stepId: "step_run_manager_after_complete_001",
      terminalStatus: "succeeded",
      makeTerminal: (manager, runId) => {
        manager.startRun(runId);
        manager.completeRun(runId, {
          summary: "run finished before step dispatch"
        });
      }
    }
  ];

  for (const entry of cases) {
    const { manager, store } = createHarness();
    const run = manager.createRunFromTask(validTask, validPrincipal, {
      runId: entry.runId
    });
    const step = manager.createStep(run.runId, {
      stepId: entry.stepId,
      kind: "tool"
    });

    entry.makeTerminal(manager, run.runId);

    assert.throws(
      () => manager.startStep(step.stepId),
      new RegExp(`run_terminal:${entry.terminalStatus}`)
    );
    assert.equal(store.getStep(step.stepId)?.status, "pending");
    assert.equal(
      store.listEvents({ runId: run.runId })
        .some((event) => event.eventType === "kernel.step.started"),
      false
    );
  }
});

test("run-manager rejects completing a running step after parent run completes", () => {
  const { manager, store } = createHarness();
  const run = manager.createRunFromTask(validTask, validPrincipal, {
    runId: "run_manager_running_step_after_complete_001"
  });
  const step = manager.createStep(run.runId, {
    stepId: "step_run_manager_running_after_complete_001",
    kind: "tool"
  });

  manager.startRun(run.runId);
  manager.startStep(step.stepId);
  manager.completeRun(run.runId, {
    summary: "run finished before step reported"
  });

  assert.throws(
    () => manager.completeStep(step.stepId, { summary: "late step" }),
    /run_terminal:succeeded/
  );
  assert.equal(store.getStep(step.stepId)?.status, "running");
  assert.equal(
    store.listEvents({ runId: run.runId })
      .some((event) => event.eventType === "kernel.step.completed"),
    false
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
