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
  ExecutionLeaseSchema,
  type ExecutionLease
} from "../../kernel-contracts/src/index.js";

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

export type FileSystemSchedulerOptions = InMemorySchedulerOptions & {
  baseDir: string;
  lockTimeoutMs?: number;
  lockRetryDelayMs?: number;
  lockStaleMs?: number;
};

const defaultLeaseDurationMs = 60_000;
const defaultMaxAttempts = 1;
const defaultLockTimeoutMs = 1_000;
const defaultLockRetryDelayMs = 10;
const defaultLockStaleMs = 30_000;

export const SchedulerLeaseStatusSchema = z.enum(["active", "released", "expired", "failed"]);
export const SchedulerQueueItemStatusSchema = z.enum([
  "queued",
  "leased",
  "completed",
  "failed",
  "exhausted"
]);

export const SchedulerExecutionLeaseSchema = ExecutionLeaseSchema.extend({
  status: SchedulerLeaseStatusSchema,
  attempt: z.number().int().positive(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.record(z.string(), z.unknown()).optional()
});

export const SchedulerQueueItemSchema = z.object({
  runId: z.string().min(1),
  status: SchedulerQueueItemStatusSchema,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  leaseDurationMs: z.number().int().positive(),
  enqueuedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastLeaseId: z.string().min(1).optional(),
  lastError: z.record(z.string(), z.unknown()).optional()
});

const FileSystemSchedulerStateSchema = z.object({
  schemaVersion: z.literal("scheduler-state.v1"),
  queue: z.array(SchedulerQueueItemSchema),
  queueOrder: z.array(z.string().min(1)),
  leases: z.array(SchedulerExecutionLeaseSchema),
  leaseSequence: z.number().int().nonnegative()
}).superRefine((state, ctx) => {
  for (const duplicate of findDuplicates(state.queue.map((item) => item.runId))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `duplicate_scheduler_queue_run:${duplicate}`,
      path: ["queue"]
    });
  }

  for (const duplicate of findDuplicates(state.leases.map((lease) => lease.leaseId))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `duplicate_scheduler_lease:${duplicate}`,
      path: ["leases"]
    });
  }
});

type ParsedFileSystemSchedulerState = z.infer<typeof FileSystemSchedulerStateSchema>;

type FileSystemSchedulerState = {
  schemaVersion: "scheduler-state.v1";
  queue: SchedulerQueueItem[];
  queueOrder: string[];
  leases: SchedulerExecutionLease[];
  leaseSequence: number;
};

type FileLockSnapshot = {
  raw: string;
  mtimeMs: number;
  ctimeMs: number;
  size: number;
  createdAtMs?: number;
};

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
    this.expireLeases();
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
    return formatLeaseId(runId, attempt, this.leaseSequence);
  }
}

export class FileSystemScheduler implements Scheduler {
  private readonly baseDir: string;
  private readonly statePath: string;
  private readonly lockPath: string;
  private readonly clock: SchedulerClock;
  private readonly defaultLeaseDurationMs: number;
  private readonly defaultMaxAttempts: number;
  private readonly lockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;
  private readonly lockStaleMs: number;

  constructor(options: FileSystemSchedulerOptions) {
    this.baseDir = resolve(options.baseDir);
    this.statePath = join(this.baseDir, "scheduler-state.json");
    this.lockPath = join(this.baseDir, ".scheduler.lock");
    this.clock = options.clock ?? { now: () => new Date().toISOString() };
    this.defaultLeaseDurationMs = options.defaultLeaseDurationMs ?? defaultLeaseDurationMs;
    this.defaultMaxAttempts = options.defaultMaxAttempts ?? defaultMaxAttempts;
    this.lockTimeoutMs = options.lockTimeoutMs ?? defaultLockTimeoutMs;
    this.lockRetryDelayMs = options.lockRetryDelayMs ?? defaultLockRetryDelayMs;
    this.lockStaleMs = options.lockStaleMs ?? defaultLockStaleMs;
  }

  enqueueRun(runId: string, options: EnqueueRunOptions = {}): SchedulerQueueItem {
    return this.withStateMutation((state) => {
      const existing = findQueueItem(state, runId);
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

      state.queue.push(cloneQueueItem(item));
      state.queueOrder.push(runId);
      return cloneQueueItem(item);
    });
  }

  acquireLease(
    workerId: string,
    options: AcquireLeaseOptions = {}
  ): SchedulerExecutionLease | undefined {
    return this.withStateMutation((state) => {
      expireLeasesInState(state, this.clock.now());

      for (const runId of state.queueOrder) {
        const item = findQueueItem(state, runId);
        if (!item || item.status !== "queued") {
          continue;
        }

        if (hasActiveLeaseInState(state, runId)) {
          continue;
        }

        if (item.attempts >= item.maxAttempts) {
          updateQueueItemInState(state, runId, this.clock.now(), {
            status: "exhausted"
          });
          continue;
        }

        const now = this.clock.now();
        const leaseDurationMs = options.leaseDurationMs ?? item.leaseDurationMs;
        const attempt = item.attempts + 1;
        state.leaseSequence += 1;
        const lease: SchedulerExecutionLease = {
          schemaVersion: "execution-lease.v1",
          leaseId: formatLeaseId(runId, attempt, state.leaseSequence),
          runId,
          workerId,
          acquiredAt: now,
          expiresAt: addMilliseconds(now, leaseDurationMs),
          status: "active",
          attempt
        };

        state.leases.push(cloneLease(lease));
        updateQueueItemInState(state, runId, now, {
          status: "leased",
          attempts: attempt,
          lastLeaseId: lease.leaseId
        });
        return cloneLease(lease);
      }

      return undefined;
    });
  }

  renewLease(leaseId: string, options: RenewLeaseOptions = {}): SchedulerExecutionLease {
    return this.withStateMutation((state) => {
      expireLeasesInState(state, this.clock.now());
      const lease = requireLeaseInState(state, leaseId);
      if (lease.status !== "active") {
        throw new Error(`lease_not_active:${lease.status}`);
      }

      const item = requireQueueItemInState(state, lease.runId);
      const now = this.clock.now();
      const updated: SchedulerExecutionLease = {
        ...lease,
        heartbeatAt: now,
        expiresAt: addMilliseconds(now, options.leaseDurationMs ?? item.leaseDurationMs)
      };

      replaceLeaseInState(state, leaseId, updated);
      return cloneLease(updated);
    });
  }

  releaseLease(leaseId: string, result: Record<string, unknown>): SchedulerExecutionLease {
    return this.withStateMutation((state) => {
      expireLeasesInState(state, this.clock.now());
      const lease = requireLeaseInState(state, leaseId);
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

      replaceLeaseInState(state, leaseId, updated);
      updateQueueItemInState(state, lease.runId, now, {
        status: "completed"
      });
      return cloneLease(updated);
    });
  }

  failLease(leaseId: string, error: unknown): SchedulerExecutionLease {
    return this.withStateMutation((state) => {
      expireLeasesInState(state, this.clock.now());
      const lease = requireLeaseInState(state, leaseId);
      if (lease.status !== "active") {
        throw new Error(`lease_not_active:${lease.status}`);
      }

      const normalizedError = normalizeError(error);
      const now = this.clock.now();
      const updated: SchedulerExecutionLease = {
        ...lease,
        status: "failed",
        releasedAt: now,
        error: normalizedError
      };
      replaceLeaseInState(state, leaseId, updated);

      const item = requireQueueItemInState(state, lease.runId);
      updateQueueItemInState(state, lease.runId, now, {
        status: item.attempts >= item.maxAttempts ? "exhausted" : "queued",
        lastError: normalizedError
      });

      return cloneLease(updated);
    });
  }

  listQueue(): SchedulerQueueItem[] {
    return this.withStateMutation((state) => {
      expireLeasesInState(state, this.clock.now());
      return state.queueOrder
        .map((runId) => findQueueItem(state, runId))
        .filter((item): item is SchedulerQueueItem => Boolean(item))
        .map(cloneQueueItem);
    });
  }

  listLeases(): SchedulerExecutionLease[] {
    return this.withStateMutation((state) => {
      expireLeasesInState(state, this.clock.now());
      return state.leases.map(cloneLease);
    });
  }

  private withStateMutation<T>(mutate: (state: FileSystemSchedulerState) => T): T {
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
          throw new Error(`scheduler_lock_timeout:${this.lockPath}`);
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

  private readState(): FileSystemSchedulerState {
    this.ensureBaseDir();
    if (!existsSync(this.statePath)) {
      return createEmptyFileSystemSchedulerState();
    }

    const raw = readFileSync(this.statePath, "utf8");
    return normalizeFileSystemSchedulerState(
      FileSystemSchedulerStateSchema.parse(JSON.parse(raw))
    );
  }

  private writeState(state: FileSystemSchedulerState): void {
    this.ensureBaseDir();
    const parsed = normalizeFileSystemSchedulerState(FileSystemSchedulerStateSchema.parse(state));
    const tempPath = join(
      this.baseDir,
      `scheduler-state.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    );

    writeFileSync(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.statePath);
  }

  private ensureBaseDir(): void {
    mkdirSync(this.baseDir, { recursive: true });
  }
}

export function createFileSystemScheduler(options: FileSystemSchedulerOptions): FileSystemScheduler {
  return new FileSystemScheduler(options);
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

function createEmptyFileSystemSchedulerState(): FileSystemSchedulerState {
  return {
    schemaVersion: "scheduler-state.v1",
    queue: [],
    queueOrder: [],
    leases: [],
    leaseSequence: 0
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

function findQueueItem(
  state: FileSystemSchedulerState,
  runId: string
): SchedulerQueueItem | undefined {
  return state.queue.find((item) => item.runId === runId);
}

function requireQueueItemInState(
  state: FileSystemSchedulerState,
  runId: string
): SchedulerQueueItem {
  const item = findQueueItem(state, runId);
  if (!item) {
    throw new Error(`run_not_queued:${runId}`);
  }
  return cloneQueueItem(item);
}

function updateQueueItemInState(
  state: FileSystemSchedulerState,
  runId: string,
  updatedAt: string,
  patch: Partial<Pick<
    SchedulerQueueItem,
    "status" | "attempts" | "lastLeaseId" | "lastError"
  >>
): SchedulerQueueItem {
  const index = state.queue.findIndex((item) => item.runId === runId);
  if (index < 0) {
    throw new Error(`run_not_queued:${runId}`);
  }

  const existing = state.queue[index];
  if (!existing) {
    throw new Error(`run_not_queued:${runId}`);
  }

  const updated: SchedulerQueueItem = {
    ...existing,
    updatedAt
  };
  if (patch.status !== undefined) {
    updated.status = patch.status;
  }
  if (patch.attempts !== undefined) {
    updated.attempts = patch.attempts;
  }
  if (patch.lastLeaseId !== undefined) {
    updated.lastLeaseId = patch.lastLeaseId;
  }
  if (patch.lastError !== undefined) {
    updated.lastError = patch.lastError;
  }
  state.queue[index] = cloneQueueItem(updated);
  return cloneQueueItem(updated);
}

function requireLeaseInState(
  state: FileSystemSchedulerState,
  leaseId: string
): SchedulerExecutionLease {
  const lease = state.leases.find((item) => item.leaseId === leaseId);
  if (!lease) {
    throw new Error(`lease_not_found:${leaseId}`);
  }
  return cloneLease(lease);
}

function replaceLeaseInState(
  state: FileSystemSchedulerState,
  leaseId: string,
  lease: SchedulerExecutionLease
): void {
  const index = state.leases.findIndex((item) => item.leaseId === leaseId);
  if (index < 0) {
    throw new Error(`lease_not_found:${leaseId}`);
  }
  state.leases[index] = cloneLease(lease);
}

function expireLeasesInState(state: FileSystemSchedulerState, nowInput: string): void {
  const now = parseTimestamp(nowInput);

  for (const [index, lease] of state.leases.entries()) {
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
    state.leases[index] = cloneLease(expired);

    const item = findQueueItem(state, lease.runId);
    if (!item || item.status !== "leased") {
      continue;
    }

    updateQueueItemInState(state, lease.runId, nowInput, {
      status: item.attempts >= item.maxAttempts ? "exhausted" : "queued"
    });
  }
}

function hasActiveLeaseInState(state: FileSystemSchedulerState, runId: string): boolean {
  return state.leases.some((lease) => (
    lease.runId === runId && lease.status === "active"
  ));
}

function formatLeaseId(runId: string, attempt: number, sequence: number): string {
  return [
    "lease",
    sanitizeIdPart(runId),
    String(attempt).padStart(3, "0"),
    String(sequence).padStart(4, "0")
  ].join("_");
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

  const buffer = new SharedArrayBuffer(4);
  const array = new Int32Array(buffer);
  Atomics.wait(array, 0, 0, milliseconds);
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function normalizeFileSystemSchedulerState(
  input: ParsedFileSystemSchedulerState
): FileSystemSchedulerState {
  return {
    schemaVersion: input.schemaVersion,
    queue: input.queue.map(normalizeSchedulerQueueItem),
    queueOrder: [...input.queueOrder],
    leases: input.leases.map(normalizeSchedulerExecutionLease),
    leaseSequence: input.leaseSequence
  };
}

function normalizeSchedulerQueueItem(
  input: z.infer<typeof SchedulerQueueItemSchema>
): SchedulerQueueItem {
  const item: SchedulerQueueItem = {
    runId: input.runId,
    status: input.status,
    attempts: input.attempts,
    maxAttempts: input.maxAttempts,
    leaseDurationMs: input.leaseDurationMs,
    enqueuedAt: input.enqueuedAt,
    updatedAt: input.updatedAt
  };

  if (input.lastLeaseId !== undefined) {
    item.lastLeaseId = input.lastLeaseId;
  }
  if (input.lastError !== undefined) {
    item.lastError = input.lastError;
  }

  return item;
}

function normalizeSchedulerExecutionLease(
  input: z.infer<typeof SchedulerExecutionLeaseSchema>
): SchedulerExecutionLease {
  const lease: SchedulerExecutionLease = {
    schemaVersion: input.schemaVersion,
    leaseId: input.leaseId,
    runId: input.runId,
    workerId: input.workerId,
    acquiredAt: input.acquiredAt,
    expiresAt: input.expiresAt,
    status: input.status,
    attempt: input.attempt
  };

  if (input.heartbeatAt !== undefined) {
    lease.heartbeatAt = input.heartbeatAt;
  }
  if (input.releasedAt !== undefined) {
    lease.releasedAt = input.releasedAt;
  }
  if (input.result !== undefined) {
    lease.result = input.result;
  }
  if (input.error !== undefined) {
    lease.error = input.error;
  }

  return lease;
}
