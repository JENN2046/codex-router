import {
  EventSchema,
  RunSchema,
  StepSchema,
  type Event,
  type Principal,
  type Run,
  type Step,
  type Task
} from "../../kernel-contracts/src/index.js";
import type { KernelStore } from "../../kernel-store/src/index.js";

export type RunManagerOptions = {
  store: KernelStore;
  now?: () => string;
};

export type CreateRunOptions = {
  runId?: string;
  policyDecisionId?: string;
  metadata?: Run["metadata"];
};

export type CompleteRunResult = Record<string, unknown>;
export type FailRunError = string | Error | Record<string, unknown>;

export type CreateStepInput = {
  stepId?: string;
  kind: Step["kind"];
  input?: Record<string, unknown>;
  dependsOn?: string[];
};

const terminalRunStatuses = new Set<Run["status"]>([
  "succeeded",
  "failed",
  "cancelled"
]);

const terminalStepStatuses = new Set<Step["status"]>([
  "succeeded",
  "failed",
  "cancelled",
  "skipped"
]);

export class RunManager {
  private readonly store: KernelStore;
  private readonly now: () => string;
  private runSequence = 0;
  private stepSequence = 0;
  private eventSequence = 0;

  constructor(options: RunManagerOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  createRunFromTask(
    task: Task,
    principal: Principal,
    options: CreateRunOptions = {}
  ): Run {
    const createdAt = this.now();
    const run = RunSchema.parse({
      schemaVersion: "kernel-run.v1",
      runId: options.runId ?? this.createRunId(task.taskId),
      taskId: task.taskId,
      status: "queued",
      ...(options.policyDecisionId ? { policyDecisionId: options.policyDecisionId } : {}),
      metadata: {
        ...(options.metadata ?? {}),
        legacy: {
          ...(options.metadata?.legacy ?? {}),
          createdByPrincipalId: principal.principalId
        }
      },
      createdAt,
      updatedAt: createdAt
    });

    const stored = this.store.createRun(run);
    this.appendEvent("kernel.run.created", stored, {
      principalId: principal.principalId
    });
    return stored;
  }

  startRun(runId: string): Run {
    const run = this.requireRun(runId);
    this.assertRunTransition(run, "running");
    const updated = this.store.updateRun(runId, {
      status: "running",
      updatedAt: this.now()
    });
    this.appendEvent("kernel.run.started", updated);
    return updated;
  }

  completeRun(runId: string, result: CompleteRunResult): Run {
    const run = this.requireRun(runId);
    this.assertRunTransition(run, "succeeded");
    const timestamp = this.now();
    const updated = this.store.updateRun(runId, {
      status: "succeeded",
      updatedAt: timestamp,
      completedAt: timestamp,
      metadata: mergeRunMetadata(run.metadata, {
        result
      })
    });
    this.appendEvent("kernel.run.completed", updated, { result });
    return updated;
  }

  failRun(runId: string, error: FailRunError): Run {
    const run = this.requireRun(runId);
    this.assertRunTransition(run, "failed");
    const timestamp = this.now();
    const normalizedError = normalizeFailure(error);
    const updated = this.store.updateRun(runId, {
      status: "failed",
      updatedAt: timestamp,
      completedAt: timestamp,
      metadata: mergeRunMetadata(run.metadata, {
        error: normalizedError
      })
    });
    this.appendEvent("kernel.run.failed", updated, { error: normalizedError });
    return updated;
  }

  cancelRun(runId: string, reason: string): Run {
    const run = this.requireRun(runId);
    this.assertRunTransition(run, "cancelled");
    const timestamp = this.now();
    const updated = this.store.updateRun(runId, {
      status: "cancelled",
      updatedAt: timestamp,
      completedAt: timestamp,
      metadata: mergeRunMetadata(run.metadata, {
        cancelReason: reason
      })
    });
    this.appendEvent("kernel.run.cancelled", updated, { reason });
    return updated;
  }

  createStep(runId: string, input: CreateStepInput): Step {
    const run = this.requireRun(runId);
    if (terminalRunStatuses.has(run.status)) {
      throw new Error(`run_terminal:${run.status}`);
    }

    const createdAt = this.now();
    const step = StepSchema.parse({
      schemaVersion: "kernel-step.v1",
      stepId: input.stepId ?? this.createStepId(runId),
      runId,
      taskId: run.taskId,
      kind: input.kind,
      status: "pending",
      dependsOn: input.dependsOn ?? [],
      createdAt,
      updatedAt: createdAt,
      input: input.input ?? {}
    });

    const stored = this.store.createStep(step);
    this.appendEvent("kernel.step.created", run, {
      stepId: stored.stepId,
      stepKind: stored.kind
    });
    return stored;
  }

  startStep(stepId: string): Step {
    const step = this.requireStep(stepId);
    this.assertStepParentRunRunning(step);
    this.assertStepTransition(step, "running");
    this.assertStepDependenciesSucceeded(step);
    const updated = this.store.updateStep(stepId, {
      status: "running",
      updatedAt: this.now()
    });
    this.appendStepEvent("kernel.step.started", updated);
    return updated;
  }

  completeStep(stepId: string, output: Record<string, unknown>): Step {
    const step = this.requireStep(stepId);
    this.assertStepParentRunRunning(step);
    this.assertStepTransition(step, "succeeded");
    const updated = this.store.updateStep(stepId, {
      status: "succeeded",
      updatedAt: this.now(),
      output
    });
    this.appendStepEvent("kernel.step.completed", updated, { output });
    return updated;
  }

  failStep(stepId: string, error: FailRunError): Step {
    const step = this.requireStep(stepId);
    this.assertStepParentRunRunning(step);
    this.assertStepTransition(step, "failed");
    const normalizedError = normalizeFailure(error);
    const updated = this.store.updateStep(stepId, {
      status: "failed",
      updatedAt: this.now(),
      output: {
        error: normalizedError
      }
    });
    this.appendStepEvent("kernel.step.failed", updated, { error: normalizedError });
    return updated;
  }

  cancelStep(stepId: string, reason: string): Step {
    const step = this.requireStep(stepId);
    this.assertStepParentRunRunning(step);
    this.assertStepTransition(step, "cancelled");
    const updated = this.store.updateStep(stepId, {
      status: "cancelled",
      updatedAt: this.now(),
      output: {
        cancelReason: reason
      }
    });
    this.appendStepEvent("kernel.step.cancelled", updated, { reason });
    return updated;
  }

  private createRunId(taskId: string): string {
    this.runSequence += 1;
    return `run_${sanitizeIdPart(taskId)}_${String(this.runSequence).padStart(3, "0")}`;
  }

  private createStepId(runId: string): string {
    this.stepSequence += 1;
    return `step_${sanitizeIdPart(runId)}_${String(this.stepSequence).padStart(3, "0")}`;
  }

  private createEventId(eventType: string, runId: string, stepId?: string): string {
    this.eventSequence += 1;
    return [
      "event",
      eventType.replace(/[^a-zA-Z0-9]+/g, "_"),
      sanitizeIdPart(runId),
      ...(stepId ? [sanitizeIdPart(stepId)] : []),
      String(this.eventSequence).padStart(4, "0")
    ].join("_");
  }

  private requireRun(runId: string): Run {
    const run = this.store.getRun(runId);
    if (!run) {
      throw new Error(`run_not_found:${runId}`);
    }
    return run;
  }

  private requireStep(stepId: string): Step {
    const step = this.store.getStep(stepId);
    if (!step) {
      throw new Error(`step_not_found:${stepId}`);
    }
    return step;
  }

  private assertRunTransition(run: Run, nextStatus: Run["status"]): void {
    if (terminalRunStatuses.has(run.status)) {
      throw new Error(`run_terminal:${run.status}`);
    }

    const allowed = (run.status === "queued" && (nextStatus === "running" || nextStatus === "cancelled"))
      || (run.status === "blocked" && nextStatus === "running")
      || (run.status === "running" && (
        nextStatus === "succeeded"
        || nextStatus === "failed"
        || nextStatus === "cancelled"
      ));

    if (!allowed) {
      throw new Error(`invalid_run_transition:${run.status}->${nextStatus}`);
    }
  }

  private assertStepTransition(step: Step, nextStatus: Step["status"]): void {
    if (terminalStepStatuses.has(step.status)) {
      throw new Error(`step_terminal:${step.status}`);
    }

    const allowed = (step.status === "pending" && (nextStatus === "running" || nextStatus === "cancelled"))
      || (step.status === "running" && (
        nextStatus === "succeeded"
        || nextStatus === "failed"
        || nextStatus === "cancelled"
      ));

    if (!allowed) {
      throw new Error(`invalid_step_transition:${step.status}->${nextStatus}`);
    }
  }

  private assertStepDependenciesSucceeded(step: Step): void {
    for (const dependencyStepId of step.dependsOn) {
      const dependency = this.requireStep(dependencyStepId);
      if (dependency.runId !== step.runId) {
        throw new Error(
          `step_dependency_run_mismatch:${dependency.stepId}:${dependency.runId}:${step.runId}`
        );
      }
      if (dependency.status !== "succeeded") {
        throw new Error(`step_dependency_not_succeeded:${dependency.stepId}:${dependency.status}`);
      }
    }
  }

  private assertStepParentRunRunning(step: Step): void {
    const run = this.requireRun(step.runId);
    if (terminalRunStatuses.has(run.status)) {
      throw new Error(`run_terminal:${run.status}`);
    }
    if (run.status !== "running") {
      throw new Error(`run_not_running:${run.status}`);
    }
  }

  private appendStepEvent(
    eventType: string,
    step: Step,
    payload: Record<string, unknown> = {}
  ): Event {
    return this.appendEvent(eventType, {
      runId: step.runId,
      taskId: step.taskId
    }, {
      ...payload,
      stepId: step.stepId,
      stepKind: step.kind
    }, step.stepId);
  }

  private appendEvent(
    eventType: string,
    target: Pick<Run, "runId" | "taskId">,
    payload: Record<string, unknown> = {},
    stepId?: string
  ): Event {
    const createdAt = this.now();
    const event = EventSchema.parse({
      schemaVersion: "kernel-event.v1",
      eventId: this.createEventId(eventType, target.runId, stepId),
      eventType,
      taskId: target.taskId,
      runId: target.runId,
      ...(stepId ? { stepId } : {}),
      createdAt,
      payload
    });

    return this.store.appendEvent(event);
  }
}

function mergeRunMetadata(
  metadata: Run["metadata"],
  legacyPatch: Record<string, unknown>
): Run["metadata"] {
  return {
    ...(metadata ?? {}),
    legacy: {
      ...(metadata?.legacy ?? {}),
      ...legacyPatch
    }
  };
}

function normalizeFailure(error: FailRunError): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  if (typeof error === "string") {
    return {
      message: error
    };
  }

  return error;
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
