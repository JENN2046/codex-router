import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ── Observation status ──────────────────────────────────────────────────────

export const ExecutionObservationStatusSchema = z.enum([
  "started",
  "succeeded",
  "failed",
  "degraded",
  "blocked"
]);

// ── Observation signals (generalized, not CLI-specific) ─────────────────────

export const ExecutionObservationSignalsSchema = z.object({
  errorClass: z.string().min(1).optional(),
  contextConflict: z.boolean().optional(),
  permissionBlocked: z.boolean().optional(),
  outputDrift: z.boolean().optional(),
  latencyPressure: z.number().min(0).max(1).optional()
});

// ── Execution observation ───────────────────────────────────────────────────

export const ExecutionObservationSchema = z.object({
  schemaVersion: z.literal("execution-observation.v1").default("execution-observation.v1"),
  observationId: z.string().min(1),
  taskId: z.string().min(1),
  primitiveId: z.string().min(1),
  stage: z.string().min(1),
  status: ExecutionObservationStatusSchema,
  signals: ExecutionObservationSignalsSchema.default({}),
  evidenceRef: z.string().min(1).optional(),
  createdAt: z.string().min(1)
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type ExecutionObservationStatus = z.infer<typeof ExecutionObservationStatusSchema>;
export type ExecutionObservationSignals = z.infer<typeof ExecutionObservationSignalsSchema>;
export type ExecutionObservationInput = z.input<typeof ExecutionObservationSchema>;
export type ExecutionObservation = z.infer<typeof ExecutionObservationSchema>;

// ── Evidence ref helpers ───────────────────────────────────────────────────

export const EXECUTION_OBSERVATION_REF_PREFIX = "execution-observation:";

export interface ParsedExecutionObservationRef {
  kind: "execution-observation";
  observationId: string;
  ref: string;
}

// ── Bus interface ───────────────────────────────────────────────────────────

export interface ExecutionObservationBus {
  emit(observation: ExecutionObservationInput): Promise<void>;
}

// ── Store interface (extends Bus with query) ────────────────────────────────

export interface ExecutionObservationStore extends ExecutionObservationBus {
  loadAll(): Promise<ExecutionObservation[]>;
  findByTaskId(taskId: string): Promise<ExecutionObservation[]>;
}

// ── Parse helper ────────────────────────────────────────────────────────────

export function parseExecutionObservation(
  input: ExecutionObservationInput
): ExecutionObservation {
  return ExecutionObservationSchema.parse(input);
}

// ── Recording store (in-memory, for tests and light usage) ──────────────────

export class RecordingExecutionObservationStore implements ExecutionObservationStore {
  private readonly observations: ExecutionObservation[] = [];

  async emit(observation: ExecutionObservationInput): Promise<void> {
    this.observations.push(parseExecutionObservation(observation));
  }

  async loadAll(): Promise<ExecutionObservation[]> {
    return [...this.observations];
  }

  async findByTaskId(taskId: string): Promise<ExecutionObservation[]> {
    return this.observations.filter((item) => item.taskId === taskId);
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createRecordingExecutionObservationStore(): RecordingExecutionObservationStore {
  return new RecordingExecutionObservationStore();
}

// ── Observation ID helper ───────────────────────────────────────────────────

export function createObservationId(input: {
  taskId: string;
  primitiveId: string;
  status: ExecutionObservationStatus;
  createdAt: string;
}): string {
  return `${input.taskId}:${input.primitiveId}:${input.status}:${input.createdAt}`;
}

export function createExecutionObservationRef(observationId: string): string {
  if (observationId.length === 0) {
    throw new Error("execution_observation_ref_requires_observation_id");
  }

  return `${EXECUTION_OBSERVATION_REF_PREFIX}${observationId}`;
}

export function parseExecutionObservationRef(
  ref: string
): ParsedExecutionObservationRef | undefined {
  if (!ref.startsWith(EXECUTION_OBSERVATION_REF_PREFIX)) {
    return undefined;
  }

  const observationId = ref.slice(EXECUTION_OBSERVATION_REF_PREFIX.length);
  if (observationId.length === 0) {
    return undefined;
  }

  return {
    kind: "execution-observation",
    observationId,
    ref: createExecutionObservationRef(observationId)
  };
}

export async function resolveExecutionObservationRef(
  store: ExecutionObservationStore,
  taskId: string,
  ref: string
): Promise<ExecutionObservation | undefined> {
  const parsedRef = parseExecutionObservationRef(ref);
  if (parsedRef === undefined) {
    return undefined;
  }

  const observations = await store.findByTaskId(taskId);
  return observations.find(
    (observation) =>
      observation.taskId === taskId
      && observation.observationId === parsedRef.observationId
  );
}

// ── File-based store (JSONL persistence) ────────────────────────────────────

export interface FileExecutionObservationStoreOptions {
  basePath: string;
}

export class FileExecutionObservationStore implements ExecutionObservationStore {
  private readonly basePath: string;

  constructor(options: FileExecutionObservationStoreOptions) {
    this.basePath = options.basePath;
  }

  private async ensureBaseDir(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  private getTaskPath(taskId: string): string {
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.basePath, `${safeTaskId}.jsonl`);
  }

  async emit(observation: ExecutionObservationInput): Promise<void> {
    await this.ensureBaseDir();
    const taskPath = this.getTaskPath(observation.taskId);
    const line = JSON.stringify(parseExecutionObservation(observation)) + "\n";
    await writeFile(taskPath, line, { flag: "a", encoding: "utf-8" });
  }

  async loadAll(): Promise<ExecutionObservation[]> {
    await this.ensureBaseDir();
    const observations: ExecutionObservation[] = [];
    const { readdir } = await import("node:fs/promises");
    const fileNames = await readdir(this.basePath);
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".jsonl")) continue;
      const filePath = join(this.basePath, fileName);
      const content = await readFile(filePath, "utf-8");
      for (const line of content.split("\n").filter(Boolean)) {
        const parsed = parseExecutionObservationSafe(line);
        if (parsed) observations.push(parsed);
      }
    }
    return observations;
  }

  async findByTaskId(taskId: string): Promise<ExecutionObservation[]> {
    await this.ensureBaseDir();
    const taskPath = this.getTaskPath(taskId);
    const content = await readFile(taskPath, "utf-8").catch(() => "");
    if (!content) return [];
    const observations: ExecutionObservation[] = [];
    for (const line of content.split("\n").filter(Boolean)) {
      const parsed = parseExecutionObservationSafe(line);
      if (parsed) observations.push(parsed);
    }
    return observations;
  }
}

function parseExecutionObservationSafe(line: string): ExecutionObservation | undefined {
  try {
    return parseExecutionObservation(JSON.parse(line));
  } catch {
    return undefined;
  }
}

export function createFileExecutionObservationStore(
  options: FileExecutionObservationStoreOptions
): FileExecutionObservationStore {
  return new FileExecutionObservationStore(options);
}
