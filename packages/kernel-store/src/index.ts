import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
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

export * from "./jsonl-event-log.js";

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

export type FileSystemKernelStoreOptions = {
  baseDir: string;
  stateFileName?: string;
  lockTimeoutMs?: number;
  lockRetryDelayMs?: number;
  lockStaleMs?: number;
};

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

const FileSystemKernelStoreStateSchema = z.object({
  schemaVersion: z.literal("kernel-store-state.v1"),
  runs: z.array(RunSchema),
  steps: z.array(StepSchema),
  events: z.array(EventSchema),
  artifacts: z.array(ArtifactSchema)
}).superRefine((state, ctx) => {
  addDuplicateIssues(ctx, "runs", state.runs.map((run) => run.runId), "run");
  addDuplicateIssues(ctx, "steps", state.steps.map((step) => step.stepId), "step");
  addDuplicateIssues(ctx, "events", state.events.map((event) => event.eventId), "event");
  addDuplicateIssues(
    ctx,
    "artifacts",
    state.artifacts.map((artifact) => artifact.artifactId),
    "artifact"
  );
});

type FileSystemKernelStoreState = z.infer<typeof FileSystemKernelStoreStateSchema>;

type FileLockSnapshot = {
  raw: string;
  mtimeMs: number;
  ctimeMs: number;
  size: number;
  createdAtMs?: number;
};

const defaultLockTimeoutMs = 1_000;
const defaultLockRetryDelayMs = 10;
const defaultLockStaleMs = 30_000;

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

export class FileSystemKernelStore implements KernelStore {
  private readonly baseDir: string;
  private readonly statePath: string;
  private readonly lockPath: string;
  private readonly lockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;
  private readonly lockStaleMs: number;

  constructor(options: FileSystemKernelStoreOptions) {
    this.baseDir = resolve(options.baseDir);
    this.statePath = join(this.baseDir, options.stateFileName ?? "kernel-store-state.json");
    this.lockPath = join(this.baseDir, ".kernel-store.lock");
    this.lockTimeoutMs = options.lockTimeoutMs ?? defaultLockTimeoutMs;
    this.lockRetryDelayMs = options.lockRetryDelayMs ?? defaultLockRetryDelayMs;
    this.lockStaleMs = options.lockStaleMs ?? defaultLockStaleMs;
  }

  createRun(run: Run): Run {
    return this.withStateMutation((state) => {
      const parsed = RunSchema.parse(run);
      rejectDuplicateId(state.runs.map((item) => item.runId), parsed.runId, "run");
      state.runs.push(cloneRun(parsed));
      return cloneRun(parsed);
    });
  }

  getRun(runId: string): Run | undefined {
    const run = this.readState().runs.find((item) => item.runId === runId);
    return run ? cloneRun(run) : undefined;
  }

  updateRun(runId: string, patch: RunPatch): Run {
    return this.withStateMutation((state) => {
      const index = state.runs.findIndex((run) => run.runId === runId);
      if (index < 0) {
        throw new Error(`run_not_found:${runId}`);
      }

      if (patch.runId && patch.runId !== runId) {
        throw new Error("run_id_update_forbidden");
      }

      const existing = state.runs[index];
      if (!existing) {
        throw new Error(`run_not_found:${runId}`);
      }

      const updated = RunSchema.parse({
        ...existing,
        ...patch,
        runId
      });
      state.runs[index] = cloneRun(updated);
      return cloneRun(updated);
    });
  }

  listRuns(filter: KernelRunFilter = {}): Run[] {
    return this.readState().runs
      .filter((run) => matchesRun(run, filter))
      .map(cloneRun);
  }

  createStep(step: Step): Step {
    return this.withStateMutation((state) => {
      const parsed = StepSchema.parse(step);
      rejectDuplicateId(state.steps.map((item) => item.stepId), parsed.stepId, "step");
      state.steps.push(cloneStep(parsed));
      return cloneStep(parsed);
    });
  }

  getStep(stepId: string): Step | undefined {
    const step = this.readState().steps.find((item) => item.stepId === stepId);
    return step ? cloneStep(step) : undefined;
  }

  updateStep(stepId: string, patch: StepPatch): Step {
    return this.withStateMutation((state) => {
      const index = state.steps.findIndex((step) => step.stepId === stepId);
      if (index < 0) {
        throw new Error(`step_not_found:${stepId}`);
      }

      if (patch.stepId && patch.stepId !== stepId) {
        throw new Error("step_id_update_forbidden");
      }

      const existing = state.steps[index];
      if (!existing) {
        throw new Error(`step_not_found:${stepId}`);
      }

      const updated = StepSchema.parse({
        ...existing,
        ...patch,
        stepId
      });
      state.steps[index] = cloneStep(updated);
      return cloneStep(updated);
    });
  }

  listSteps(runId: string, filter: KernelStepFilter = {}): Step[] {
    return this.readState().steps
      .filter((step) => step.runId === runId)
      .filter((step) => matchesStep(step, { ...filter, runId }))
      .map(cloneStep);
  }

  appendEvent(event: Event): Event {
    return this.withStateMutation((state) => {
      const parsed = EventSchema.parse(event);
      rejectDuplicateId(state.events.map((item) => item.eventId), parsed.eventId, "event");
      state.events.push(cloneEvent(parsed));
      return cloneEvent(parsed);
    });
  }

  listEvents(filter: KernelEventFilter = {}): Event[] {
    return this.readState().events
      .filter((event) => matchesEvent(event, filter))
      .map(cloneEvent);
  }

  createArtifact(artifact: Artifact): Artifact {
    return this.withStateMutation((state) => {
      const parsed = ArtifactSchema.parse(artifact);
      rejectDuplicateId(
        state.artifacts.map((item) => item.artifactId),
        parsed.artifactId,
        "artifact"
      );
      state.artifacts.push(cloneArtifact(parsed));
      return cloneArtifact(parsed);
    });
  }

  getArtifact(artifactId: string): Artifact | undefined {
    const artifact = this.readState().artifacts.find((item) => item.artifactId === artifactId);
    return artifact ? cloneArtifact(artifact) : undefined;
  }

  listArtifacts(filter: KernelArtifactFilter = {}): Artifact[] {
    return this.readState().artifacts
      .filter((artifact) => matchesArtifact(artifact, filter))
      .map(cloneArtifact);
  }

  private withStateMutation<T>(mutate: (state: FileSystemKernelStoreState) => T): T {
    return this.withLock(() => {
      const state = this.readState();
      const result = mutate(state);
      this.writeState(state);
      return result;
    });
  }

  private withLock<T>(fn: () => T): T {
    const token = createLockToken();
    const startedAt = Date.now();

    while (true) {
      try {
        this.ensureBaseDir();
        const fd = openSync(this.lockPath, "wx");
        try {
          writeFileSync(fd, `${JSON.stringify({
            token,
            pid: process.pid,
            createdAt: new Date().toISOString()
          })}\n`, "utf8");
        } finally {
          closeSync(fd);
        }

        try {
          return fn();
        } finally {
          this.releaseLock(token);
        }
      } catch (error) {
        if (!isNodeError(error) || error.code !== "EEXIST") {
          throw error;
        }

        this.removeStaleLock();
        if (Date.now() - startedAt >= this.lockTimeoutMs) {
          throw new Error(`kernel_store_lock_timeout:${this.lockPath}`);
        }

        sleepSync(this.lockRetryDelayMs);
      }
    }
  }

  private releaseLock(token: string): void {
    try {
      const raw = readFileSync(this.lockPath, "utf8");
      const parsed = JSON.parse(raw) as { token?: unknown };
      if (parsed.token === token) {
        unlinkSync(this.lockPath);
      }
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  private removeStaleLock(): void {
    try {
      const staleCandidate = readFileLockSnapshot(this.lockPath);
      if (!isFileLockSnapshotStale(staleCandidate, this.lockStaleMs)) {
        return;
      }

      const current = readFileLockSnapshot(this.lockPath);
      if (
        isSameFileLockSnapshot(staleCandidate, current)
        && isFileLockSnapshotStale(current, this.lockStaleMs)
      ) {
        unlinkSync(this.lockPath);
      }
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  private readState(): FileSystemKernelStoreState {
    this.ensureBaseDir();
    if (!existsSync(this.statePath)) {
      return createEmptyFileSystemKernelStoreState();
    }

    return FileSystemKernelStoreStateSchema.parse(
      JSON.parse(readFileSync(this.statePath, "utf8"))
    );
  }

  private writeState(state: FileSystemKernelStoreState): void {
    this.ensureBaseDir();
    const parsed = FileSystemKernelStoreStateSchema.parse(state);
    const tempPath = join(
      this.baseDir,
      `kernel-store-state.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    );
    writeFileSync(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.statePath);
  }

  private ensureBaseDir(): void {
    mkdirSync(this.baseDir, { recursive: true });
  }
}

export function createFileSystemKernelStore(
  options: FileSystemKernelStoreOptions
): FileSystemKernelStore {
  return new FileSystemKernelStore(options);
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

function rejectDuplicateId(
  values: string[],
  id: string,
  kind: "run" | "step" | "event" | "artifact"
): void {
  if (values.includes(id)) {
    throw new Error(`duplicate_${kind}_id:${id}`);
  }
}

function createEmptyFileSystemKernelStoreState(): FileSystemKernelStoreState {
  return {
    schemaVersion: "kernel-store-state.v1",
    runs: [],
    steps: [],
    events: [],
    artifacts: []
  };
}

function readFileLockSnapshot(lockPath: string): FileLockSnapshot {
  const lockStat = statSync(lockPath);
  const raw = readFileSync(lockPath, "utf8");
  const metadata = parseFileLockMetadata(raw);
  return {
    raw,
    mtimeMs: lockStat.mtimeMs,
    ctimeMs: lockStat.ctimeMs,
    size: lockStat.size,
    ...(metadata.createdAtMs !== undefined ? { createdAtMs: metadata.createdAtMs } : {})
  };
}

function isFileLockSnapshotStale(snapshot: FileLockSnapshot, lockStaleMs: number): boolean {
  const now = Date.now();
  if (now - snapshot.mtimeMs < lockStaleMs) {
    return false;
  }
  if (snapshot.createdAtMs !== undefined && now - snapshot.createdAtMs < lockStaleMs) {
    return false;
  }
  return true;
}

function isSameFileLockSnapshot(left: FileLockSnapshot, right: FileLockSnapshot): boolean {
  return left.raw === right.raw
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs
    && left.size === right.size;
}

function parseFileLockMetadata(raw: string): { createdAtMs?: number } {
  try {
    const parsed = JSON.parse(raw) as { createdAt?: unknown };
    if (typeof parsed.createdAt !== "string") {
      return {};
    }
    const createdAtMs = Date.parse(parsed.createdAt);
    return Number.isNaN(createdAtMs) ? {} : { createdAtMs };
  } catch {
    return {};
  }
}

function addDuplicateIssues(
  ctx: z.RefinementCtx,
  path: string,
  values: string[],
  kind: string
): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  for (const duplicate of duplicates) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `duplicate_${kind}_id:${duplicate}`,
      path: [path]
    });
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

function createLockToken(): string {
  return [
    process.pid,
    Date.now(),
    Math.random().toString(36).slice(2)
  ].join(":");
}

function sleepSync(milliseconds: number): void {
  if (milliseconds <= 0) {
    return;
  }

  const shared = new SharedArrayBuffer(4);
  const view = new Int32Array(shared);
  Atomics.wait(view, 0, 0, milliseconds);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
