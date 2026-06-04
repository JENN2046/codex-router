import {
  ArtifactSchema,
  EventSchema,
  RunSchema,
  StepSchema,
  type Artifact,
  type Event,
  type Run,
  type Step
} from "../../kernel-contracts/src/index.js";

export type KernelRunFilter = {
  taskId?: string;
  runId?: string;
  status?: Run["status"];
  type?: string;
};

export type KernelStepFilter = {
  taskId?: string;
  runId?: string;
  status?: Step["status"];
  type?: Step["kind"];
};

export type KernelEventFilter = {
  taskId?: string;
  runId?: string;
  status?: string;
  type?: string;
};

export type KernelArtifactFilter = {
  taskId?: string;
  runId?: string;
  status?: string;
  type?: Artifact["kind"];
};

export type RunPatch = Partial<Run>;
export type StepPatch = Partial<Step>;

export interface KernelStore {
  createRun(run: Run): Run;
  getRun(runId: string): Run | undefined;
  updateRun(runId: string, patch: RunPatch): Run;
  listRuns(filter?: KernelRunFilter): Run[];
  createStep(step: Step): Step;
  getStep(stepId: string): Step | undefined;
  updateStep(stepId: string, patch: StepPatch): Step;
  listSteps(runId: string, filter?: KernelStepFilter): Step[];
  appendEvent(event: Event): Event;
  listEvents(filter?: KernelEventFilter): Event[];
  createArtifact(artifact: Artifact): Artifact;
  getArtifact(artifactId: string): Artifact | undefined;
  listArtifacts(filter?: KernelArtifactFilter): Artifact[];
}

export class InMemoryKernelStore implements KernelStore {
  private readonly runs = new Map<string, Run>();
  private readonly steps = new Map<string, Step>();
  private readonly events: Event[] = [];
  private readonly eventIds = new Set<string>();
  private readonly artifacts = new Map<string, Artifact>();

  createRun(run: Run): Run {
    const parsed = RunSchema.parse(run);
    rejectDuplicate(this.runs, parsed.runId, "run");
    this.runs.set(parsed.runId, cloneRun(parsed));
    return cloneRun(parsed);
  }

  getRun(runId: string): Run | undefined {
    const run = this.runs.get(runId);
    return run ? cloneRun(run) : undefined;
  }

  updateRun(runId: string, patch: RunPatch): Run {
    const existing = this.runs.get(runId);
    if (!existing) {
      throw new Error(`run_not_found:${runId}`);
    }

    if (patch.runId && patch.runId !== runId) {
      throw new Error("run_id_update_forbidden");
    }

    const updated = RunSchema.parse({
      ...existing,
      ...patch,
      runId
    });
    this.runs.set(runId, cloneRun(updated));
    return cloneRun(updated);
  }

  listRuns(filter: KernelRunFilter = {}): Run[] {
    return [...this.runs.values()]
      .filter((run) => matchesRun(run, filter))
      .map(cloneRun);
  }

  createStep(step: Step): Step {
    const parsed = StepSchema.parse(step);
    rejectDuplicate(this.steps, parsed.stepId, "step");
    this.steps.set(parsed.stepId, cloneStep(parsed));
    return cloneStep(parsed);
  }

  getStep(stepId: string): Step | undefined {
    const step = this.steps.get(stepId);
    return step ? cloneStep(step) : undefined;
  }

  updateStep(stepId: string, patch: StepPatch): Step {
    const existing = this.steps.get(stepId);
    if (!existing) {
      throw new Error(`step_not_found:${stepId}`);
    }

    if (patch.stepId && patch.stepId !== stepId) {
      throw new Error("step_id_update_forbidden");
    }

    const updated = StepSchema.parse({
      ...existing,
      ...patch,
      stepId
    });
    this.steps.set(stepId, cloneStep(updated));
    return cloneStep(updated);
  }

  listSteps(runId: string, filter: KernelStepFilter = {}): Step[] {
    return [...this.steps.values()]
      .filter((step) => step.runId === runId)
      .filter((step) => matchesStep(step, { ...filter, runId }))
      .map(cloneStep);
  }

  appendEvent(event: Event): Event {
    const parsed = EventSchema.parse(event);
    if (this.eventIds.has(parsed.eventId)) {
      throw new Error(`duplicate_event_id:${parsed.eventId}`);
    }

    this.eventIds.add(parsed.eventId);
    this.events.push(cloneEvent(parsed));
    return cloneEvent(parsed);
  }

  listEvents(filter: KernelEventFilter = {}): Event[] {
    return this.events
      .filter((event) => matchesEvent(event, filter))
      .map(cloneEvent);
  }

  createArtifact(artifact: Artifact): Artifact {
    const parsed = ArtifactSchema.parse(artifact);
    rejectDuplicate(this.artifacts, parsed.artifactId, "artifact");
    this.artifacts.set(parsed.artifactId, cloneArtifact(parsed));
    return cloneArtifact(parsed);
  }

  getArtifact(artifactId: string): Artifact | undefined {
    const artifact = this.artifacts.get(artifactId);
    return artifact ? cloneArtifact(artifact) : undefined;
  }

  listArtifacts(filter: KernelArtifactFilter = {}): Artifact[] {
    return [...this.artifacts.values()]
      .filter((artifact) => matchesArtifact(artifact, filter))
      .map(cloneArtifact);
  }
}

function rejectDuplicate<T>(
  map: Map<string, T>,
  id: string,
  kind: "run" | "step" | "artifact"
): void {
  if (map.has(id)) {
    throw new Error(`duplicate_${kind}_id:${id}`);
  }
}

function matchesRun(run: Run, filter: KernelRunFilter): boolean {
  return matchesOptional(filter.taskId, run.taskId)
    && matchesOptional(filter.runId, run.runId)
    && matchesOptional(filter.status, run.status);
}

function matchesStep(step: Step, filter: KernelStepFilter): boolean {
  return matchesOptional(filter.taskId, step.taskId)
    && matchesOptional(filter.runId, step.runId)
    && matchesOptional(filter.status, step.status)
    && matchesOptional(filter.type, step.kind);
}

function matchesEvent(event: Event, filter: KernelEventFilter): boolean {
  return matchesOptional(filter.taskId, event.taskId)
    && matchesOptional(filter.runId, event.runId)
    && matchesOptional(filter.type, event.eventType);
}

function matchesArtifact(artifact: Artifact, filter: KernelArtifactFilter): boolean {
  return matchesOptional(filter.taskId, artifact.taskId)
    && matchesOptional(filter.runId, artifact.runId)
    && matchesOptional(filter.type, artifact.kind);
}

function matchesOptional<T>(expected: T | undefined, actual: T | undefined): boolean {
  return expected === undefined || actual === expected;
}

function cloneRun(run: Run): Run {
  return RunSchema.parse(structuredClone(run));
}

function cloneStep(step: Step): Step {
  return StepSchema.parse(structuredClone(step));
}

function cloneEvent(event: Event): Event {
  return EventSchema.parse(structuredClone(event));
}

function cloneArtifact(artifact: Artifact): Artifact {
  return ArtifactSchema.parse(structuredClone(artifact));
}
