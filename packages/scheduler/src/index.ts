import type { ExecutionLease } from "../../kernel-contracts/src/index.js";

export type SchedulerLeaseStatus = "active" | "released" | "expired" | "failed";

export type SchedulerExecutionLease = ExecutionLease & {
  status: SchedulerLeaseStatus;
  attempt: number;
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
};

export type SchedulerQueueItemStatus = "queued" | "leased" | "completed" | "failed" | "exhausted";

export type SchedulerQueueItem = {
  runId: string;
  status: SchedulerQueueItemStatus;
  attempts: number;
  maxAttempts: number;
  leaseDurationMs: number;
  enqueuedAt: string;
  updatedAt: string;
  lastLeaseId?: string;
  lastError?: Record<string, unknown>;
};

export type EnqueueRunOptions = {
  maxAttempts?: number;
  leaseDurationMs?: number;
};

export type AcquireLeaseOptions = {
  leaseDurationMs?: number;
};

export type RenewLeaseOptions = {
  leaseDurationMs?: number;
};

export type SchedulerClock = {
  now(): string;
};

export interface Scheduler {
  enqueueRun(runId: string, options?: EnqueueRunOptions): SchedulerQueueItem;
  acquireLease(workerId: string, options?: AcquireLeaseOptions): SchedulerExecutionLease | undefined;
  renewLease(leaseId: string, options?: RenewLeaseOptions): SchedulerExecutionLease;
  releaseLease(leaseId: string, result: Record<string, unknown>): SchedulerExecutionLease;
  failLease(leaseId: string, error: unknown): SchedulerExecutionLease;
  listQueue(): SchedulerQueueItem[];
  listLeases(): SchedulerExecutionLease[];
}

export type InMemorySchedulerOptions = {
  clock?: SchedulerClock;
  defaultLeaseDurationMs?: number;
  defaultMaxAttempts?: number;
};

const defaultLeaseDurationMs = 60_000;
const defaultMaxAttempts = 1;

export class InMemoryScheduler implements Scheduler {
  private readonly clock: SchedulerClock;
  private readonly defaultLeaseDurationMs: number;
  private readonly defaultMaxAttempts: number;
  private readonly queue = new Map<string, SchedulerQueueItem>();
  private readonly queueOrder: string[] = [];
  private readonly leases = new Map<string, SchedulerExecutionLease>();
  private leaseSequence = 0;

  constructor(options: InMemorySchedulerOptions = {}) {
    this.clock = options.clock ?? { now: () => new Date().toISOString() };
    this.defaultLeaseDurationMs = options.defaultLeaseDurationMs ?? defaultLeaseDurationMs;
    this.defaultMaxAttempts = options.defaultMaxAttempts ?? defaultMaxAttempts;
  }

  enqueueRun(runId: string, options: EnqueueRunOptions = {}): SchedulerQueueItem {
    const existing = this.queue.get(runId);
    if (existing) {
      if (existing.status === "completed" || existing.status === "exhausted") {
        throw new Error(`run_not_enqueueable:${existing.status}`);
      }
      return cloneQueueItem(existing);
    }

    const now = this.clock.now();
    const item: SchedulerQueueItem = {
      runId,
      status: "queued",
      attempts: 0,
      maxAttempts: options.maxAttempts ?? this.defaultMaxAttempts,
      leaseDurationMs: options.leaseDurationMs ?? this.defaultLeaseDurationMs,
      enqueuedAt: now,
      updatedAt: now
    };

    this.queue.set(runId, cloneQueueItem(item));
    this.queueOrder.push(runId);
    return cloneQueueItem(item);
  }

  acquireLease(
    workerId: string,
    options: AcquireLeaseOptions = {}
  ): SchedulerExecutionLease | undefined {
    this.expireLeases();

    for (const runId of this.queueOrder) {
      const item = this.queue.get(runId);
      if (!item || item.status !== "queued") {
        continue;
      }

      if (this.hasActiveLease(runId)) {
        continue;
      }

      if (item.attempts >= item.maxAttempts) {
        this.updateQueueItem(runId, {
          status: "exhausted"
        });
        continue;
      }

      const now = this.clock.now();
      const leaseDurationMs = options.leaseDurationMs ?? item.leaseDurationMs;
      const attempt = item.attempts + 1;
      const lease: SchedulerExecutionLease = {
        schemaVersion: "execution-lease.v1",
        leaseId: this.createLeaseId(runId, attempt),
        runId,
        workerId,
        acquiredAt: now,
        expiresAt: addMilliseconds(now, leaseDurationMs),
        status: "active",
        attempt
      };

      this.leases.set(lease.leaseId, cloneLease(lease));
      this.updateQueueItem(runId, {
        status: "leased",
        attempts: attempt,
        lastLeaseId: lease.leaseId
      });
      return cloneLease(lease);
    }

    return undefined;
  }

  renewLease(leaseId: string, options: RenewLeaseOptions = {}): SchedulerExecutionLease {
    this.expireLeases();
    const lease = this.requireLease(leaseId);
    if (lease.status !== "active") {
      throw new Error(`lease_not_active:${lease.status}`);
    }

    const item = this.requireQueueItem(lease.runId);
    const now = this.clock.now();
    const updated: SchedulerExecutionLease = {
      ...lease,
      heartbeatAt: now,
      expiresAt: addMilliseconds(now, options.leaseDurationMs ?? item.leaseDurationMs)
    };

    this.leases.set(leaseId, cloneLease(updated));
    return cloneLease(updated);
  }

  releaseLease(leaseId: string, result: Record<string, unknown>): SchedulerExecutionLease {
    this.expireLeases();
    const lease = this.requireLease(leaseId);
    if (lease.status !== "active") {
      throw new Error(`lease_not_active:${lease.status}`);
    }

    const now = this.clock.now();
    const updated: SchedulerExecutionLease = {
      ...lease,
      status: "released",
      releasedAt: now,
      result
    };

    this.leases.set(leaseId, cloneLease(updated));
    this.updateQueueItem(lease.runId, {
      status: "completed"
    });
    return cloneLease(updated);
  }

  failLease(leaseId: string, error: unknown): SchedulerExecutionLease {
    this.expireLeases();
    const lease = this.requireLease(leaseId);
    if (lease.status !== "active") {
      throw new Error(`lease_not_active:${lease.status}`);
    }

    const normalizedError = normalizeError(error);
    const updated: SchedulerExecutionLease = {
      ...lease,
      status: "failed",
      releasedAt: this.clock.now(),
      error: normalizedError
    };
    this.leases.set(leaseId, cloneLease(updated));

    const item = this.requireQueueItem(lease.runId);
    this.updateQueueItem(lease.runId, {
      status: item.attempts >= item.maxAttempts ? "exhausted" : "queued",
      lastError: normalizedError
    });

    return cloneLease(updated);
  }

  listQueue(): SchedulerQueueItem[] {
    return this.queueOrder
      .map((runId) => this.queue.get(runId))
      .filter((item): item is SchedulerQueueItem => Boolean(item))
      .map(cloneQueueItem);
  }

  listLeases(): SchedulerExecutionLease[] {
    this.expireLeases();
    return [...this.leases.values()].map(cloneLease);
  }

  private expireLeases(): void {
    const now = parseTimestamp(this.clock.now());
    for (const lease of this.leases.values()) {
      if (lease.status !== "active") {
        continue;
      }

      const expiresAt = Date.parse(lease.expiresAt);
      if (!Number.isNaN(expiresAt) && expiresAt > now) {
        continue;
      }

      const expired: SchedulerExecutionLease = {
        ...lease,
        status: "expired"
      };
      this.leases.set(lease.leaseId, cloneLease(expired));

      const item = this.queue.get(lease.runId);
      if (!item || item.status !== "leased") {
        continue;
      }

      this.updateQueueItem(lease.runId, {
        status: item.attempts >= item.maxAttempts ? "exhausted" : "queued"
      });
    }
  }

  private hasActiveLease(runId: string): boolean {
    return [...this.leases.values()].some((lease) => (
      lease.runId === runId && lease.status === "active"
    ));
  }

  private requireLease(leaseId: string): SchedulerExecutionLease {
    const lease = this.leases.get(leaseId);
    if (!lease) {
      throw new Error(`lease_not_found:${leaseId}`);
    }
    return cloneLease(lease);
  }

  private requireQueueItem(runId: string): SchedulerQueueItem {
    const item = this.queue.get(runId);
    if (!item) {
      throw new Error(`run_not_queued:${runId}`);
    }
    return cloneQueueItem(item);
  }

  private updateQueueItem(
    runId: string,
    patch: Partial<Pick<
      SchedulerQueueItem,
      "status" | "attempts" | "lastLeaseId" | "lastError"
    >>
  ): SchedulerQueueItem {
    const existing = this.requireQueueItem(runId);
    const updated: SchedulerQueueItem = {
      ...existing,
      ...patch,
      updatedAt: this.clock.now()
    };
    this.queue.set(runId, cloneQueueItem(updated));
    return cloneQueueItem(updated);
  }

  private createLeaseId(runId: string, attempt: number): string {
    this.leaseSequence += 1;
    return [
      "lease",
      sanitizeIdPart(runId),
      String(attempt).padStart(3, "0"),
      String(this.leaseSequence).padStart(4, "0")
    ].join("_");
  }
}

function addMilliseconds(timestamp: string, milliseconds: number): string {
  const time = parseTimestamp(timestamp);
  return new Date(time + milliseconds).toISOString();
}

function parseTimestamp(timestamp: string): number {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) {
    throw new Error(`invalid_clock_timestamp:${timestamp}`);
  }
  return time;
}

function normalizeError(error: unknown): Record<string, unknown> {
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

  if (error && typeof error === "object") {
    return error as Record<string, unknown>;
  }

  return {
    message: String(error)
  };
}

function cloneQueueItem(item: SchedulerQueueItem): SchedulerQueueItem {
  return structuredClone(item);
}

function cloneLease(lease: SchedulerExecutionLease): SchedulerExecutionLease {
  return structuredClone(lease);
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
