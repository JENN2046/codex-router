import { createHash } from "node:crypto";
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
  capabilityScopeToCanonicalString
} from "../../capability/src/index.js";
import {
  PolicyDecisionSchema,
  PrincipalSchema,
  RunSchema,
  SandboxProfileSchema,
  TaskSchema,
  type PolicyDecision,
  type Principal,
  type Run,
  type SandboxProfile,
  type Task
} from "../../kernel-contracts/src/index.js";
import {
  ProviderKindSchema,
  ProviderSideEffectClassSchema,
  providerSupportsSandboxProfile,
  providerSupportsSideEffectClass,
  type ProviderKind,
  type ProviderSideEffectClass
} from "../../provider-core/src/index.js";
import {
  type ExecutionEligibilityDecision
} from "../../execution-eligibility/src/index.js";
import {
  hashApprovalScope
} from "../../approval-permit/src/index.js";
import {
  type ProviderRegistry,
  type ProviderRegistryEntry
} from "../../provider-registry/src/index.js";

export const ProviderExecutionPlanStatusSchema = z.enum([
  "planned",
  "blocked",
  "waiting_approval"
]);

export const ProviderExecutionPlanProviderKindSchema = z.union([
  ProviderKindSchema,
  z.literal("unknown")
]);

export const ProviderExecutionPlanSchema = z.object({
  schemaVersion: z.literal("provider-execution-plan.v2").default("provider-execution-plan.v2"),
  planId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1),
  providerId: z.string().min(1),
  providerKind: ProviderExecutionPlanProviderKindSchema,
  status: ProviderExecutionPlanStatusSchema,
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  policyDecisionHash: z.string().regex(/^[a-f0-9]{64}$/),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  requiredApprovals: z.array(z.string().min(1)).default([]),
  sandboxProfile: SandboxProfileSchema,
  sideEffectClass: ProviderSideEffectClassSchema,
  reasons: z.array(z.string().min(1)).default([]),
  createdAt: z.string().min(1)
});

export type ProviderExecutionPlanStatus = z.infer<typeof ProviderExecutionPlanStatusSchema>;
export type ProviderExecutionPlanProviderKind = z.infer<typeof ProviderExecutionPlanProviderKindSchema>;
export type ProviderExecutionPlan = z.infer<typeof ProviderExecutionPlanSchema>;

export type ProviderExecutionPlanFilter = {
  taskId?: string;
  runId?: string;
  providerId?: string;
  status?: ProviderExecutionPlanStatus;
};

export type FileSystemProviderExecutionPlanStoreOptions = {
  baseDir: string;
  stateFileName?: string;
  lockTimeoutMs?: number;
  lockRetryDelayMs?: number;
  lockStaleMs?: number;
};

export interface ProviderExecutionPlanStore {
  savePlan(plan: ProviderExecutionPlan): ProviderExecutionPlan;
  getPlan(planId: string): ProviderExecutionPlan | undefined;
  listPlans(filter?: ProviderExecutionPlanFilter): ProviderExecutionPlan[];
}

const ProviderExecutionPlanStoreStateSchema = z.object({
  schemaVersion: z.literal("provider-execution-plan-store.v1"),
  plans: z.array(ProviderExecutionPlanSchema)
}).superRefine((state, ctx) => {
  for (const duplicate of findDuplicateStrings(state.plans.map((plan) => plan.planId))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `duplicate_provider_execution_plan_id:${duplicate}`,
      path: ["plans"]
    });
  }
});

type ProviderExecutionPlanStoreState = z.infer<typeof ProviderExecutionPlanStoreStateSchema>;

type FileLockSnapshot = {
  raw: string;
  mtimeMs: number;
  ctimeMs: number;
  size: number;
  createdAtMs?: number;
  pid?: number;
};

const defaultLockTimeoutMs = 1_000;
const defaultLockRetryDelayMs = 10;
const defaultLockStaleMs = 30_000;

export class InMemoryProviderExecutionPlanStore implements ProviderExecutionPlanStore {
  private readonly plans = new Map<string, ProviderExecutionPlan>();

  savePlan(plan: ProviderExecutionPlan): ProviderExecutionPlan {
    const parsed = ProviderExecutionPlanSchema.parse(plan);
    if (this.plans.has(parsed.planId)) {
      throw new Error(`duplicate_provider_execution_plan_id:${parsed.planId}`);
    }

    this.plans.set(parsed.planId, cloneProviderExecutionPlan(parsed));
    return cloneProviderExecutionPlan(parsed);
  }

  getPlan(planId: string): ProviderExecutionPlan | undefined {
    const plan = this.plans.get(planId);
    return plan === undefined ? undefined : cloneProviderExecutionPlan(plan);
  }

  listPlans(filter: ProviderExecutionPlanFilter = {}): ProviderExecutionPlan[] {
    return [...this.plans.values()]
      .filter((plan) => matchesProviderExecutionPlan(plan, filter))
      .map(cloneProviderExecutionPlan);
  }
}

export class FileSystemProviderExecutionPlanStore implements ProviderExecutionPlanStore {
  private readonly baseDir: string;
  private readonly statePath: string;
  private readonly lockPath: string;
  private readonly lockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;
  private readonly lockStaleMs: number;

  constructor(options: FileSystemProviderExecutionPlanStoreOptions) {
    this.baseDir = resolve(options.baseDir);
    this.statePath = join(
      this.baseDir,
      options.stateFileName ?? "provider-execution-plans.json"
    );
    this.lockPath = join(this.baseDir, ".provider-execution-plan-store.lock");
    this.lockTimeoutMs = options.lockTimeoutMs ?? defaultLockTimeoutMs;
    this.lockRetryDelayMs = options.lockRetryDelayMs ?? defaultLockRetryDelayMs;
    this.lockStaleMs = options.lockStaleMs ?? defaultLockStaleMs;
  }

  savePlan(plan: ProviderExecutionPlan): ProviderExecutionPlan {
    const parsed = ProviderExecutionPlanSchema.parse(plan);
    return this.withStateMutation((state) => {
      if (state.plans.some((item) => item.planId === parsed.planId)) {
        throw new Error(`duplicate_provider_execution_plan_id:${parsed.planId}`);
      }

      state.plans.push(cloneProviderExecutionPlan(parsed));
      return cloneProviderExecutionPlan(parsed);
    });
  }

  getPlan(planId: string): ProviderExecutionPlan | undefined {
    const plan = this.readState().plans.find((item) => item.planId === planId);
    return plan === undefined ? undefined : cloneProviderExecutionPlan(plan);
  }

  listPlans(filter: ProviderExecutionPlanFilter = {}): ProviderExecutionPlan[] {
    return this.readState().plans
      .filter((plan) => matchesProviderExecutionPlan(plan, filter))
      .map(cloneProviderExecutionPlan);
  }

  private withStateMutation<T>(mutate: (state: ProviderExecutionPlanStoreState) => T): T {
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
          throw new Error(`provider_execution_plan_store_lock_timeout:${this.lockPath}`);
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
      if (isFileLockOwnerAlive(staleCandidate)) {
        return;
      }

      const current = readFileLockSnapshot(this.lockPath);
      if (
        isSameFileLockSnapshot(staleCandidate, current)
        && isFileLockSnapshotStale(current, this.lockStaleMs)
        && !isFileLockOwnerAlive(current)
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

  private readState(): ProviderExecutionPlanStoreState {
    this.ensureBaseDir();
    if (!existsSync(this.statePath)) {
      return createEmptyProviderExecutionPlanStoreState();
    }

    return ProviderExecutionPlanStoreStateSchema.parse(
      JSON.parse(readFileSync(this.statePath, "utf8"))
    );
  }

  private writeState(state: ProviderExecutionPlanStoreState): void {
    this.ensureBaseDir();
    const parsed = ProviderExecutionPlanStoreStateSchema.parse(state);
    const tempPath = join(
      this.baseDir,
      `provider-execution-plans.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    );
    writeFileSync(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.statePath);
  }

  private ensureBaseDir(): void {
    mkdirSync(this.baseDir, { recursive: true });
  }
}

export function createInMemoryProviderExecutionPlanStore(): InMemoryProviderExecutionPlanStore {
  return new InMemoryProviderExecutionPlanStore();
}

export function createFileSystemProviderExecutionPlanStore(
  options: FileSystemProviderExecutionPlanStoreOptions
): FileSystemProviderExecutionPlanStore {
  return new FileSystemProviderExecutionPlanStore(options);
}

export type PlanProviderExecutionInput = {
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision;
  executionEligibility: ExecutionEligibilityDecision;
  providerRegistry: ProviderRegistry;
  preferredProviderId?: string;
  now: string;
};

export function planProviderExecution(
  input: PlanProviderExecutionInput
): ProviderExecutionPlan {
  const task = TaskSchema.parse(input.task);
  const run = RunSchema.parse(input.run);
  const principal = PrincipalSchema.parse(input.principal);
  const policyDecision = PolicyDecisionSchema.parse(input.policyDecision);
  const eligibility = parseExecutionEligibility(input.executionEligibility);
  const sandboxProfile = SandboxProfileSchema.parse(policyDecision.execution.sandbox);
  const sideEffectClass = resolveProviderSideEffectClass(policyDecision, sandboxProfile);
  const requiredCapabilities = policyDecision.capabilities.map(capabilityScopeToCanonicalString);
  const requiredApprovals = uniqueStrings([...eligibility.requiredApprovals]);
  const policyDecisionHash = hashProviderExecutionPlannerObject(policyDecision);
  const providerResolution = resolveProvider({
    providerRegistry: input.providerRegistry,
    sideEffectClass,
    sandboxProfile,
    ...(input.preferredProviderId !== undefined
      ? { preferredProviderId: input.preferredProviderId }
      : {})
  });
  const providerId = providerResolution.providerId;
  const providerKind = providerResolution.providerKind;
  const inputHash = createInputHash({
    taskId: task.taskId,
    runId: run.runId,
    principalId: principal.principalId,
    providerId,
    providerKind,
    policyDecisionHash,
    eligibilityStatus: eligibility.status,
    sideEffectClass,
    sandboxProfile,
    preferredProviderId: input.preferredProviderId
  });
  const basePlan = {
    schemaVersion: "provider-execution-plan.v2" as const,
    planId: createPlanId(run.runId, providerId, inputHash),
    taskId: task.taskId,
    runId: run.runId,
    providerId,
    providerKind,
    inputHash,
    policyDecisionHash,
    requiredCapabilities,
    requiredApprovals,
    sandboxProfile,
    sideEffectClass,
    createdAt: input.now
  };
  const integrityReasons = collectKernelIntegrityReasons(task, run, policyDecision, eligibility);

  if (providerResolution.reasons.length > 0 || integrityReasons.length > 0) {
    return ProviderExecutionPlanSchema.parse({
      ...basePlan,
      status: "blocked",
      reasons: uniqueStrings([
        ...integrityReasons,
        ...providerResolution.reasons
      ])
    });
  }

  if (eligibility.status === "blocked") {
    return ProviderExecutionPlanSchema.parse({
      ...basePlan,
      status: "blocked",
      reasons: uniqueStrings([
        "eligibility_blocked",
        ...eligibility.reasons
      ])
    });
  }

  if (eligibility.status === "waiting_approval") {
    return ProviderExecutionPlanSchema.parse({
      ...basePlan,
      status: "waiting_approval",
      reasons: uniqueStrings([
        "eligibility_waiting_approval",
        ...eligibility.reasons
      ])
    });
  }

  return ProviderExecutionPlanSchema.parse({
    ...basePlan,
    status: "planned",
    reasons: uniqueStrings([
      "provider_planned",
      ...eligibility.reasons
    ])
  });
}

export function hashProviderExecutionPlannerObject(input: unknown): string {
  return createHash("sha256")
    .update(stableStringify(input))
    .digest("hex");
}

function resolveProvider(input: {
  providerRegistry: ProviderRegistry;
  preferredProviderId?: string;
  sideEffectClass: ProviderSideEffectClass;
  sandboxProfile: SandboxProfile;
}): {
  providerId: string;
  providerKind: ProviderExecutionPlanProviderKind;
  entry?: ProviderRegistryEntry;
  reasons: string[];
} {
  if (input.preferredProviderId !== undefined) {
    const entry = input.providerRegistry.getProvider(input.preferredProviderId);

    if (entry === undefined) {
      return {
        providerId: input.preferredProviderId,
        providerKind: "unknown",
        reasons: [`provider_not_found:${input.preferredProviderId}`]
      };
    }

    return evaluateProviderEntry(entry, input.sideEffectClass, input.sandboxProfile);
  }

  const candidates = input.providerRegistry.listProviders({
    sideEffectClass: input.sideEffectClass,
    sandboxProfile: input.sandboxProfile
  });

  if (candidates[0] !== undefined) {
    return {
      providerId: candidates[0].manifest.providerId,
      providerKind: candidates[0].manifest.kind,
      entry: candidates[0],
      reasons: []
    };
  }

  const disabledCandidate = input.providerRegistry.listProviders({
    sideEffectClass: input.sideEffectClass,
    sandboxProfile: input.sandboxProfile,
    enabled: false
  })[0];

  if (disabledCandidate !== undefined) {
    return evaluateProviderEntry(
      disabledCandidate,
      input.sideEffectClass,
      input.sandboxProfile
    );
  }

  return {
    providerId: "unresolved",
    providerKind: "unknown",
    reasons: [
      `provider_not_found_for_requirements:${input.sideEffectClass}:${input.sandboxProfile.sandboxId}`
    ]
  };
}

function evaluateProviderEntry(
  entry: ProviderRegistryEntry,
  sideEffectClass: ProviderSideEffectClass,
  sandboxProfile: SandboxProfile
): {
  providerId: string;
  providerKind: ProviderKind;
  entry: ProviderRegistryEntry;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (!entry.manifest.enabled) {
    reasons.push(`provider_disabled:${entry.manifest.providerId}`);
  }

  if (!providerSupportsSideEffectClass(entry.manifest, sideEffectClass)) {
    reasons.push(`unsupported_side_effect_class:${entry.manifest.providerId}:${sideEffectClass}`);
  }

  if (!providerSupportsSandboxProfile(entry.manifest, sandboxProfile)) {
    reasons.push(`unsupported_sandbox_profile:${entry.manifest.providerId}:${sandboxProfile.sandboxId}`);
  }

  return {
    providerId: entry.manifest.providerId,
    providerKind: entry.manifest.kind,
    entry,
    reasons
  };
}

function collectKernelIntegrityReasons(
  task: Task,
  run: Run,
  policyDecision: PolicyDecision,
  eligibility: ExecutionEligibilityDecision
): string[] {
  const reasons: string[] = [];

  if (task.taskId !== run.taskId) {
    reasons.push(`task_run_mismatch:${task.taskId}:${run.taskId}`);
  }

  if (policyDecision.taskId !== task.taskId) {
    reasons.push(`policy_task_mismatch:${policyDecision.taskId}:${task.taskId}`);
  }

  if (eligibility.taskId !== task.taskId) {
    reasons.push(`eligibility_task_mismatch:${eligibility.taskId}:${task.taskId}`);
  }

  if (eligibility.runId !== run.runId) {
    reasons.push(`eligibility_run_mismatch:${eligibility.runId}:${run.runId}`);
  }

  const expectedPolicyDecisionHash = hashApprovalScope(policyDecision);
  if (eligibility.policyDecisionHash !== expectedPolicyDecisionHash) {
    reasons.push("eligibility_policy_decision_hash_mismatch");
  }

  if (
    run.policyDecisionId !== undefined
    && run.policyDecisionId !== policyDecision.decisionId
  ) {
    reasons.push(`run_policy_decision_mismatch:${run.policyDecisionId}:${policyDecision.decisionId}`);
  }

  if (eligibility.status === "eligible") {
    if (eligibility.missingCapabilities.length > 0) {
      reasons.push("eligibility_has_unresolved_missing_capabilities");
    }

    if (eligibility.requiredApprovals.length > 0) {
      reasons.push("eligibility_has_unresolved_required_approvals");
    }

    if (
      policyDecision.approval.required
      && eligibility.acceptedPermits.length === 0
    ) {
      reasons.push("eligibility_missing_policy_approval_permit");
    }

    if (
      eligibility.reasons.includes("valid_approval_permit")
      && eligibility.acceptedPermits.length === 0
    ) {
      reasons.push("eligibility_valid_permit_without_accepted_permit");
    }
  }

  return reasons;
}

function parseExecutionEligibility(
  input: ExecutionEligibilityDecision
): ExecutionEligibilityDecision {
  return {
    status: z.enum(["eligible", "blocked", "waiting_approval"]).parse(input.status),
    taskId: z.string().min(1).parse(input.taskId),
    runId: z.string().min(1).parse(input.runId),
    policyDecisionHash: z.string().regex(/^[a-f0-9]{64}$/).parse(input.policyDecisionHash),
    reasons: z.array(z.string().min(1)).parse(input.reasons),
    missingCapabilities: z.array(z.string().min(1)).parse(input.missingCapabilities),
    requiredApprovals: z.array(z.string().min(1)).parse(input.requiredApprovals),
    acceptedPermits: z.array(z.string().min(1)).parse(input.acceptedPermits),
    rejectedPermits: z.array(z.string().min(1)).parse(input.rejectedPermits),
    createdAt: z.string().min(1).parse(input.createdAt)
  };
}

function resolveProviderSideEffectClass(
  policyDecision: PolicyDecision,
  sandboxProfile: SandboxProfile
): ProviderSideEffectClass {
  if (hasProtectedRemoteSideEffect(policyDecision)) {
    return "protected_remote";
  }

  if (hasExternalSideEffect(policyDecision)) {
    return "external_side_effects";
  }

  if (hasSecretAccess(policyDecision)) {
    return "secret_access";
  }

  if (hasLocalCommand(policyDecision)) {
    return "local_command";
  }

  if (sandboxProfile.mode === "workspace-write") {
    return "workspace_write";
  }

  return "read_only";
}

function hasProtectedRemoteSideEffect(policyDecision: PolicyDecision): boolean {
  return policyDecision.legacy.toolAccess === "protected_remote"
    || policyDecision.capabilities.some((scope) => (
      scope.kind === "external"
      && scope.resource === "protected_remote"
      && scope.access !== "read"
    ));
}

function hasExternalSideEffect(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => (
    scope.kind === "external"
    && scope.access !== "read"
  ));
}

function hasSecretAccess(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => scope.kind === "secret");
}

function hasLocalCommand(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => (
    (scope.kind === "tool" || scope.kind === "process")
    && scope.access === "execute"
  ));
}

function createInputHash(input: Record<string, unknown>): string {
  return hashProviderExecutionPlannerObject(input);
}

function createPlanId(runId: string, providerId: string, inputHash: string): string {
  return `plan_provider_${toSafeIdPart(runId)}_${toSafeIdPart(providerId)}_${inputHash.slice(0, 12)}`;
}

function stableStringify(input: unknown): string {
  if (input === undefined) {
    return "null";
  }

  if (input === null || typeof input !== "object") {
    return JSON.stringify(input) ?? "null";
  }

  if (Array.isArray(input)) {
    return `[${Array.from(input, (item) => stableStringify(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();

  return `{${keys.map((key) => (
    `${JSON.stringify(key)}:${stableStringify(record[key])}`
  )).join(",")}}`;
}

function toSafeIdPart(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe || "unnamed";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function cloneProviderExecutionPlan(plan: ProviderExecutionPlan): ProviderExecutionPlan {
  return ProviderExecutionPlanSchema.parse(structuredClone(plan));
}

function matchesProviderExecutionPlan(
  plan: ProviderExecutionPlan,
  filter: ProviderExecutionPlanFilter
): boolean {
  return matchesOptionalString(filter.taskId, plan.taskId)
    && matchesOptionalString(filter.runId, plan.runId)
    && matchesOptionalString(filter.providerId, plan.providerId)
    && matchesOptionalString(filter.status, plan.status);
}

function matchesOptionalString<T extends string>(expected: T | undefined, actual: T): boolean {
  return expected === undefined || actual === expected;
}

function createEmptyProviderExecutionPlanStoreState(): ProviderExecutionPlanStoreState {
  return {
    schemaVersion: "provider-execution-plan-store.v1",
    plans: []
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
    ...(metadata.createdAtMs !== undefined ? { createdAtMs: metadata.createdAtMs } : {}),
    ...(metadata.pid !== undefined ? { pid: metadata.pid } : {})
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

function isFileLockOwnerAlive(snapshot: FileLockSnapshot): boolean {
  if (snapshot.pid === undefined) {
    return false;
  }
  if (snapshot.pid === process.pid) {
    return true;
  }

  try {
    process.kill(snapshot.pid, 0);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") {
      return false;
    }
    return true;
  }
}

function parseFileLockMetadata(raw: string): { createdAtMs?: number; pid?: number } {
  try {
    const parsed = JSON.parse(raw) as { createdAt?: unknown; pid?: unknown };
    const result: { createdAtMs?: number; pid?: number } = {};

    if (typeof parsed.createdAt === "string") {
      const createdAtMs = Date.parse(parsed.createdAt);
      if (!Number.isNaN(createdAtMs)) {
        result.createdAtMs = createdAtMs;
      }
    }

    if (typeof parsed.pid === "number" && Number.isSafeInteger(parsed.pid) && parsed.pid > 0) {
      result.pid = parsed.pid;
    }

    return result;
  } catch {
    return {};
  }
}

function findDuplicateStrings(values: string[]): string[] {
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
