import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CheckpointRef } from "../../contracts/src/index.js";
import { createSafeAuditDetails } from "../../governance-internal-redaction/src/index.js";

export interface AuditEvent {
  type:
    | "task_created"
    | "intent_classified"
    | "clarification_required"
    | "routing_decided"
    | "preflight_passed"
    | "preflight_failed"
    | "executor_started"
    | "escalation_triggered"
    | "approval_required"
    | "approval_granted"
    | "approval_rejected"
    | "runner_dispatched"
    | "execution_blocked"
    | "primitive_executed"
    | "primitive_failed"
    | "task_resumed"
    | "runner_ready"
    | "runner_blocked"
    | "task_completed"
    | "task_failed"
    | "circuit_broken";
  taskId: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface MemoryAdapter {
  recordCheckpoint(checkpoint: CheckpointRef): Promise<void>;
}

export interface CheckpointRecallAdapter {
  recallLatestCheckpointRef(input: {
    taskId: string;
    stage?: string;
    limit?: number;
    includeContent?: boolean;
  }): Promise<CheckpointRef | undefined>;
}

export interface MemoryOverviewProvider {
  memoryOverview(input?: {
    auditWindow?: number;
    limit?: number;
  }): Promise<Record<string, unknown>>;
}

export class NoopMemoryAdapter implements MemoryAdapter {
  async recordCheckpoint(_checkpoint: CheckpointRef): Promise<void> {
    return Promise.resolve();
  }
}

export class FileAuditStore {
  constructor(private readonly path: string) {}

  async record(event: AuditEvent): Promise<void> {
    const events = await this.loadAll();
    events.push(sanitizeAuditEvent(event));
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(events, null, 2), "utf8");
  }

  async loadAll(): Promise<AuditEvent[]> {
    try {
      const raw = await readFile(this.path, "utf8");
      return JSON.parse(raw) as AuditEvent[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }
}

export function sanitizeAuditEvent(event: AuditEvent): AuditEvent {
  return {
    ...event,
    details: createSafeAuditDetails(event.details)
  };
}

export async function checkpointAndAudit(
  checkpoint: CheckpointRef,
  adapter: MemoryAdapter,
  store: FileAuditStore
): Promise<void> {
  await adapter.recordCheckpoint(checkpoint);
  await store.record({
    type: "task_resumed",
    taskId: checkpoint.taskId,
    timestamp: checkpoint.createdAt,
    details: {
      checkpointId: checkpoint.checkpointId,
      stage: checkpoint.stage,
      summary: checkpoint.summary
    }
  });
}
