import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ── Action refs ─────────────────────────────────────────────────────────────

export const ReversibleActionRefSchema = z.object({
  actionId: z.string().min(1),
  kind: z.string().min(1),
  description: z.string().min(1)
});

export const IrreversibleActionRefSchema = z.object({
  actionId: z.string().min(1),
  kind: z.string().min(1),
  description: z.string().min(1),
  requiresHumanReview: z.literal(true)
});

// ── Checkpoint ledger entry ─────────────────────────────────────────────────

export const CheckpointLedgerEntrySchema = z.object({
  schemaVersion: z.literal("checkpoint-ledger-entry.v1").default("checkpoint-ledger-entry.v1"),
  checkpointId: z.string().min(1),
  taskId: z.string().min(1),
  parentCheckpointId: z.string().min(1).optional(),
  branchId: z.string().min(1),
  stage: z.string().min(1),
  governanceStateRef: z.string().min(1),
  taskGraphDeltaRef: z.string().min(1).optional(),
  memorySnapshotRef: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string()).default([]),
  reversibleActions: z.array(ReversibleActionRefSchema).default([]),
  irreversibleActions: z.array(IrreversibleActionRefSchema).default([]),
  createdAt: z.string().min(1)
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type ReversibleActionRef = z.infer<typeof ReversibleActionRefSchema>;
export type IrreversibleActionRef = z.infer<typeof IrreversibleActionRefSchema>;
export type CheckpointLedgerEntryInput = z.input<typeof CheckpointLedgerEntrySchema>;
export type CheckpointLedgerEntry = z.infer<typeof CheckpointLedgerEntrySchema>;

// ── Store interface ─────────────────────────────────────────────────────────

export interface CheckpointLedgerStore {
  record(entry: CheckpointLedgerEntryInput): Promise<void>;
  loadAll(): Promise<CheckpointLedgerEntry[]>;
  findLatestForTask(taskId: string): Promise<CheckpointLedgerEntry | undefined>;
}

// ── Parse helper ────────────────────────────────────────────────────────────

export function parseCheckpointLedgerEntry(
  input: CheckpointLedgerEntryInput
): CheckpointLedgerEntry {
  return CheckpointLedgerEntrySchema.parse(input);
}

// ── Recording store (in-memory, for tests) ──────────────────────────────────

export class RecordingCheckpointLedgerStore implements CheckpointLedgerStore {
  private readonly entries: CheckpointLedgerEntry[] = [];

  async record(entry: CheckpointLedgerEntryInput): Promise<void> {
    this.entries.push(parseCheckpointLedgerEntry(entry));
  }

  async loadAll(): Promise<CheckpointLedgerEntry[]> {
    return [...this.entries];
  }

  async findLatestForTask(taskId: string): Promise<CheckpointLedgerEntry | undefined> {
    const matches = this.entries.filter((entry) => entry.taskId === taskId);
    return matches.at(-1);
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createRecordingCheckpointLedgerStore(): RecordingCheckpointLedgerStore {
  return new RecordingCheckpointLedgerStore();
}

// ── Safety helper ───────────────────────────────────────────────────────────

export function hasIrreversibleActions(entry: CheckpointLedgerEntry): boolean {
  return entry.irreversibleActions.length > 0;
}

// ── File-based store (JSONL persistence) ────────────────────────────────────

export interface FileCheckpointLedgerStoreOptions {
  basePath: string;
}

export class FileCheckpointLedgerStore implements CheckpointLedgerStore {
  private readonly basePath: string;

  constructor(options: FileCheckpointLedgerStoreOptions) {
    this.basePath = options.basePath;
  }

  private async ensureBaseDir(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  private getTaskPath(taskId: string): string {
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.basePath, `${safeTaskId}.jsonl`);
  }

  async record(entry: CheckpointLedgerEntryInput): Promise<void> {
    await this.ensureBaseDir();
    const taskPath = this.getTaskPath(entry.taskId);
    const line = JSON.stringify(parseCheckpointLedgerEntry(entry)) + "\n";
    await writeFile(taskPath, line, { flag: "a", encoding: "utf-8" });
  }

  async loadAll(): Promise<CheckpointLedgerEntry[]> {
    await this.ensureBaseDir();
    const entries: CheckpointLedgerEntry[] = [];
    const { readdir } = await import("node:fs/promises");
    const fileNames = await readdir(this.basePath);
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".jsonl")) continue;
      const filePath = join(this.basePath, fileName);
      const content = await readFile(filePath, "utf-8");
      for (const line of content.split("\n").filter(Boolean)) {
        const parsed = parseCheckpointLedgerEntrySafe(line);
        if (parsed) entries.push(parsed);
      }
    }
    return entries;
  }

  async findLatestForTask(taskId: string): Promise<CheckpointLedgerEntry | undefined> {
    await this.ensureBaseDir();
    const taskPath = this.getTaskPath(taskId);
    const content = await readFile(taskPath, "utf-8").catch(() => "");
    if (!content) return undefined;
    const lines = content.split("\n").filter(Boolean);
    if (lines.length === 0) return undefined;
    const lastLine = lines[lines.length - 1];
    if (!lastLine) return undefined;
    return parseCheckpointLedgerEntrySafe(lastLine);
  }
}

function parseCheckpointLedgerEntrySafe(line: string): CheckpointLedgerEntry | undefined {
  try {
    return parseCheckpointLedgerEntry(JSON.parse(line));
  } catch {
    return undefined;
  }
}

export function createFileCheckpointLedgerStore(
  options: FileCheckpointLedgerStoreOptions
): FileCheckpointLedgerStore {
  return new FileCheckpointLedgerStore(options);
}
