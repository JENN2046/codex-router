import { createHash } from "node:crypto";
import { z } from "zod";
import { posix as pathPosix } from "node:path";
import type {
  Artifact,
  PolicyDecision,
  Run,
  SandboxProfile,
  Task
} from "../../kernel-contracts/src/index.js";
import {
  SandboxProfileSchema
} from "../../kernel-contracts/src/index.js";
import type {
  RegisteredToolManifest
} from "../../tool-registry/src/index.js";
import {
  RegisteredToolManifestSchema
} from "../../tool-registry/src/index.js";

export const ProviderKindSchema = z.enum([
  "model",
  "executor",
  "tool",
  "remote_agent"
]);

export const ProviderSideEffectClassSchema = z.enum([
  "none",
  "read",
  "read_only",
  "local_write",
  "workspace_write",
  "local_command",
  "external_write",
  "external_side_effects",
  "protected_remote",
  "destructive",
  "secret_access",
  "unknown"
]);

export const ProviderSecurityBoundarySchema = z.object({
  isolation: z.enum(["none", "process", "sandbox", "remote"]).default("none"),
  networkAccess: z.enum(["none", "restricted", "full"]).default("none"),
  filesystemAccess: z.enum(["none", "read", "workspace-write", "full"]).default("none"),
  secretAccess: z.enum(["none", "brokered", "direct"]).default("none"),
  notes: z.array(z.string().min(1)).default([])
});

export const ProviderRequiredConfigSchema = z.object({
  keys: z.array(z.string().min(1)).default([]),
  optionalKeys: z.array(z.string().min(1)).default([])
}).default({
  keys: [],
  optionalKeys: []
});

export const ProviderManifestSchema = z.object({
  schemaVersion: z.literal("provider-manifest.v1").default("provider-manifest.v1"),
  providerId: z.string().min(1),
  kind: ProviderKindSchema,
  displayName: z.string().min(1),
  version: z.string().min(1),
  capabilities: z.array(z.string().min(1)).default([]),
  requiredConfig: ProviderRequiredConfigSchema,
  securityBoundary: ProviderSecurityBoundarySchema,
  supportedSandboxProfiles: z.array(SandboxProfileSchema).default([]),
  supportedSideEffectClasses: z.array(ProviderSideEffectClassSchema).default([]),
  enabled: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const ProviderAttestationSchema = z.object({
  schemaVersion: z.literal("provider-attestation.v1").default("provider-attestation.v1"),
  providerId: z.string().min(1),
  kind: ProviderKindSchema,
  displayName: z.string().min(1),
  version: z.string().min(1),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  capabilities: z.array(z.string().min(1)).default([]),
  securityBoundary: ProviderSecurityBoundarySchema,
  supportedSandboxProfiles: z.array(SandboxProfileSchema).default([]),
  supportedSideEffectClasses: z.array(ProviderSideEffectClassSchema).default([]),
  attestedAt: z.string().min(1)
});

export const ProviderExecutionPermitSchema = z.object({
  schemaVersion: z.literal("provider-execution-permit.v1").default("provider-execution-permit.v1"),
  permitId: z.string().min(1),
  taskId: z.string().min(1),
  taskHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  runId: z.string().min(1),
  planId: z.string().min(1),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  providerExecutionPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  providerId: z.string().min(1),
  providerManifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  policyDecisionHash: z.string().min(1).optional(),
  principalId: z.string().min(1).optional(),
  principalHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  sideEffectClass: ProviderSideEffectClassSchema,
  sandboxProfileId: z.string().min(1),
  status: z.enum(["candidate", "approved", "blocked"]),
  approvalStatus: z.enum([
    "not_required",
    "approved",
    "pending",
    "rejected",
    "expired"
  ]),
  reasons: z.array(z.string()).default([]),
  issuedAt: z.string().min(1),
  expiresAt: z.string().min(1),
  nonce: z.string().min(1),
  consumedAt: z.string().min(1).optional()
});

export const WorkspaceWriteProviderExecutionPermitSchema = z.object({
  schemaVersion: z.literal("provider-workspace-write-execution-permit.v1").default(
    "provider-workspace-write-execution-permit.v1"
  ),
  permitId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  providerId: z.string().min(1),
  providerManifestHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  policyDecisionHash: z.string().min(1).optional(),
  sideEffectClass: z.literal("workspace_write"),
  sandboxProfileId: z.string().min(1),
  sandboxMode: z.literal("workspace-write"),
  status: z.enum(["candidate", "approved", "blocked"]),
  approvalStatus: z.enum(["approved", "pending", "rejected", "expired"]),
  operatorAuthorizationId: z.string().min(1).optional(),
  targetFiles: z.array(z.string().min(1)).default([]),
  maxChangedFiles: z.number().int().positive(),
  maxDiffLines: z.number().int().positive(),
  rollbackRequired: z.boolean(),
  protectedBranchForbidden: z.boolean(),
  dirtyWorktreeForbidden: z.boolean(),
  repositoryState: z.object({
    branch: z.string().min(1),
    protectedBranch: z.boolean(),
    worktreeClean: z.boolean(),
    headCommit: z.string().min(1).optional()
  }),
  reasons: z.array(z.string()).default([]),
  issuedAt: z.string().min(1)
});

export const WorkspaceWritePermitV2RollbackCommandIdentitySchema = z.object({
  kind: z.literal("git_restore_from_commit"),
  commandHash: z.string().regex(/^[a-f0-9]{64}$/),
  affectedFiles: z.array(z.string().min(1)).default([])
});

export const WorkspaceWriteProviderExecutionPermitV2Schema = z.object({
  schemaVersion: z.literal("provider-workspace-write-execution-permit.v2").default(
    "provider-workspace-write-execution-permit.v2"
  ),
  permitId: z.string().min(1),
  taskId: z.string().min(1),
  taskHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  runId: z.string().min(1),
  planId: z.string().min(1),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  providerExecutionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
  providerId: z.string().min(1),
  providerManifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  policyDecisionHash: z.string().min(1),
  principalId: z.string().min(1).optional(),
  principalHash: z.string().regex(/^[a-f0-9]{64}$/),
  sideEffectClass: z.literal("workspace_write"),
  sandboxProfileId: z.string().min(1),
  sandboxMode: z.literal("workspace-write"),
  status: z.enum(["candidate", "approved", "blocked"]),
  approvalStatus: z.enum(["approved", "pending", "rejected", "expired"]),
  operatorAuthorizationId: z.string().min(1).optional(),
  targetFiles: z.array(z.string().min(1)).default([]),
  maxChangedFiles: z.number().int().positive(),
  maxDiffLines: z.number().int().positive(),
  rollbackRequired: z.boolean(),
  rollback: z.object({
    beforeCommit: z.string().min(1),
    commandIdentity: WorkspaceWritePermitV2RollbackCommandIdentitySchema
  }),
  protectedBranchForbidden: z.boolean(),
  dirtyWorktreeForbidden: z.boolean(),
  repositoryState: z.object({
    branch: z.string().min(1),
    protectedBranch: z.boolean(),
    worktreeClean: z.boolean(),
    headCommit: z.string().min(1).optional()
  }),
  reasons: z.array(z.string()).default([]),
  issuedAt: z.string().min(1),
  expiresAt: z.string().min(1),
  nonce: z.string().min(1),
  consumedAt: z.string().min(1).optional()
});

export const ProviderPlanBaseSchema = z.object({
  planId: z.string().min(1),
  runId: z.string().min(1),
  providerId: z.string().min(1),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  approvalRequired: z.boolean(),
  sandboxProfile: SandboxProfileSchema,
  createdAt: z.string().min(1)
});

export const ExecutorExecutionPlanSchema = ProviderPlanBaseSchema.extend({
  schemaVersion: z.literal("executor-execution-plan.v1").default("executor-execution-plan.v1"),
  kind: z.literal("executor").default("executor"),
  taskId: z.string().min(1),
  taskHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  principalId: z.string().min(1).optional(),
  principalHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  providerExecutionPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  providerManifestHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  policyDecisionHash: z.string().min(1).optional(),
  sideEffectClass: ProviderSideEffectClassSchema,
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const ToolProviderInvocationPlanSchema = ProviderPlanBaseSchema.extend({
  schemaVersion: z.literal("tool-provider-invocation-plan.v1").default("tool-provider-invocation-plan.v1"),
  kind: z.literal("tool").default("tool"),
  stepId: z.string().min(1),
  toolId: z.string().min(1),
  sideEffectClass: ProviderSideEffectClassSchema,
  metadata: z.record(z.string(), z.unknown()).default({})
});

export type ProviderKind = z.infer<typeof ProviderKindSchema>;
export type ProviderSideEffectClass = z.infer<typeof ProviderSideEffectClassSchema>;
export type ProviderSecurityBoundary = z.infer<typeof ProviderSecurityBoundarySchema>;
export type ProviderRequiredConfig = z.infer<typeof ProviderRequiredConfigSchema>;
export type ProviderManifest = z.infer<typeof ProviderManifestSchema>;
export type ProviderAttestation = z.infer<typeof ProviderAttestationSchema>;
export type ProviderExecutionPermit = z.infer<typeof ProviderExecutionPermitSchema>;
export type WorkspaceWriteProviderExecutionPermit = z.infer<
  typeof WorkspaceWriteProviderExecutionPermitSchema
>;
export type WorkspaceWritePermitV2RollbackCommandIdentity = z.infer<
  typeof WorkspaceWritePermitV2RollbackCommandIdentitySchema
>;
export type WorkspaceWriteProviderExecutionPermitV2 = z.infer<
  typeof WorkspaceWriteProviderExecutionPermitV2Schema
>;
export type ProviderExecutionPermitApprovalStatus = NonNullable<
  ProviderExecutionPermit["approvalStatus"]
>;
export type ProviderPlanBase = z.infer<typeof ProviderPlanBaseSchema>;
export type ExecutorExecutionPlan = z.infer<typeof ExecutorExecutionPlanSchema>;
export type ToolProviderInvocationPlan = z.infer<typeof ToolProviderInvocationPlanSchema>;

export type ProviderExecutionPermitIssueInput = {
  plan: ExecutorExecutionPlan;
  manifest: ProviderManifest;
  permitId?: string;
  approvalStatus?: ProviderExecutionPermitApprovalStatus;
  reasons?: string[];
  issuedAt: string;
  expiresAt?: string;
};

export type WorkspaceWriteProviderExecutionPermitIssueInput = {
  plan: ExecutorExecutionPlan;
  manifest: ProviderManifest;
  permitId?: string;
  approvalStatus?: WorkspaceWriteProviderExecutionPermit["approvalStatus"];
  operatorAuthorizationId?: string;
  targetFiles: string[];
  maxChangedFiles: number;
  maxDiffLines: number;
  rollbackRequired: boolean;
  protectedBranchForbidden: boolean;
  dirtyWorktreeForbidden: boolean;
  repositoryState: WorkspaceWriteProviderExecutionPermit["repositoryState"];
  reasons?: string[];
  issuedAt: string;
};

export type WorkspaceWriteProviderExecutionPermitV2IssueInput = {
  plan: ExecutorExecutionPlan;
  manifest: ProviderManifest;
  permitId?: string;
  approvalStatus?: WorkspaceWriteProviderExecutionPermitV2["approvalStatus"];
  operatorAuthorizationId?: string;
  targetFiles: string[];
  maxChangedFiles: number;
  maxDiffLines: number;
  rollbackRequired: boolean;
  rollback: {
    beforeCommit: string;
    affectedFiles?: string[];
  };
  protectedBranchForbidden: boolean;
  dirtyWorktreeForbidden: boolean;
  repositoryState: WorkspaceWriteProviderExecutionPermitV2["repositoryState"];
  reasons?: string[];
  issuedAt: string;
  expiresAt?: string;
};

export type ProviderExecutionPermitValidationOptions = {
  reasonPrefix?: string;
  now?: string;
};

export type ProviderExecutionPermitConsumptionOptions = ProviderExecutionPermitValidationOptions & {
  consumedAt?: string;
};

export type ProviderExecutionPermitConsumptionResult = "consumed" | "already_consumed";

export type ProviderExecutionPermitConsumptionRecord = {
  schemaVersion: "provider-execution-permit-consumption.v1";
  consumptionKey: string;
  permitId: string;
  nonce: string;
  taskId: string;
  taskHash?: string;
  runId: string;
  planId: string;
  planHash: string;
  providerExecutionPlanHash?: string;
  providerId: string;
  providerManifestHash: string;
  policyDecisionHash?: string;
  principalId?: string;
  principalHash?: string;
  sideEffectClass: ProviderSideEffectClass;
  sandboxProfileId: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string;
};

export interface ProviderExecutionPermitConsumptionStore {
  consumeIfUnused(record: ProviderExecutionPermitConsumptionRecord): ProviderExecutionPermitConsumptionResult;
  get(consumptionKey: string): ProviderExecutionPermitConsumptionRecord | undefined;
}

export class InMemoryProviderExecutionPermitConsumptionStore implements ProviderExecutionPermitConsumptionStore {
  private readonly records = new Map<string, ProviderExecutionPermitConsumptionRecord>();

  consumeIfUnused(record: ProviderExecutionPermitConsumptionRecord): ProviderExecutionPermitConsumptionResult {
    if (this.records.has(record.consumptionKey)) {
      return "already_consumed";
    }

    this.records.set(record.consumptionKey, {
      ...record
    });
    return "consumed";
  }

  get(consumptionKey: string): ProviderExecutionPermitConsumptionRecord | undefined {
    const record = this.records.get(consumptionKey);
    return record === undefined ? undefined : { ...record };
  }
}

export type ExecutionPlanInput = {
  task: Task;
  run: Run;
  policyDecision: PolicyDecision;
  sandboxProfile: SandboxProfile;
  inputHash?: string;
  taskHash?: string;
  principalId?: string;
  principalHash?: string;
  providerExecutionPlanHash?: string;
  providerManifestHash?: string;
  proposedInput?: unknown;
  now: string;
};

export type ExecutionValidationResult = {
  valid: boolean;
  reasons: string[];
};

export type ProviderExecutionContext = {
  dryRun?: boolean;
  approvals?: string[];
  permit?: ProviderExecutionPermit;
  metadata?: Record<string, unknown>;
};

export type ProviderExecutionResult = {
  ok: boolean;
  artifacts?: Artifact[];
  events?: unknown[];
  error?: Record<string, unknown>;
};

export interface ExecutorProvider {
  readonly manifest: ProviderManifest;
  planExecution(input: ExecutionPlanInput): ExecutorExecutionPlan | Promise<ExecutorExecutionPlan>;
  validateExecutionPlan(plan: ExecutorExecutionPlan): ExecutionValidationResult | Promise<ExecutionValidationResult>;
  execute(
    plan: ExecutorExecutionPlan,
    context: ProviderExecutionContext
  ): ProviderExecutionResult | Promise<ProviderExecutionResult>;
}

export type ToolInvocationInput = {
  run: Run;
  stepId: string;
  toolManifest: RegisteredToolManifest;
  proposedInput: unknown;
  sandboxProfile: SandboxProfile;
  now: string;
};

export type ProviderToolInvocationContext = {
  dryRun?: boolean;
  approvals?: string[];
  metadata?: Record<string, unknown>;
};

export type ToolInvocationResult = {
  ok: boolean;
  output?: unknown;
  artifacts?: Artifact[];
  error?: Record<string, unknown>;
};

export interface ToolProvider {
  readonly manifest: ProviderManifest;
  listTools(): RegisteredToolManifest[] | Promise<RegisteredToolManifest[]>;
  getTool(toolId: string): RegisteredToolManifest | undefined | Promise<RegisteredToolManifest | undefined>;
  planInvocation(input: ToolInvocationInput): ToolProviderInvocationPlan | Promise<ToolProviderInvocationPlan>;
  invoke(
    plan: ToolProviderInvocationPlan,
    context: ProviderToolInvocationContext
  ): ToolInvocationResult | Promise<ToolInvocationResult>;
}

export type RemoteAgentCard = {
  agentId: string;
  name: string;
  description?: string;
  version: string;
  capabilities: string[];
  metadata: Record<string, unknown>;
};

export type RemoteTaskInput = {
  task: Task;
  run: Run;
  metadata?: Record<string, unknown>;
};

export type RemoteTask = {
  taskId: string;
  providerId: string;
  status: "queued" | "running" | "waiting_approval" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type RemoteTaskEvent = {
  eventId: string;
  taskId: string;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export interface RemoteAgentProvider {
  readonly manifest: ProviderManifest;
  getAgentCard(): RemoteAgentCard | Promise<RemoteAgentCard>;
  createRemoteTask(input: RemoteTaskInput): RemoteTask | Promise<RemoteTask>;
  getRemoteTask(taskId: string): RemoteTask | undefined | Promise<RemoteTask | undefined>;
  cancelRemoteTask(taskId: string): RemoteTask | Promise<RemoteTask>;
  streamRemoteTaskEvents(taskId: string): AsyncIterable<RemoteTaskEvent>;
}

export type ModelDescriptor = {
  modelId: string;
  displayName: string;
  capabilities: string[];
  metadata: Record<string, unknown>;
};

export type ModelProbeResult = {
  modelId: string;
  available: boolean;
  reasons: string[];
};

export interface ModelProvider {
  readonly manifest: ProviderManifest;
  listModels(): ModelDescriptor[] | Promise<ModelDescriptor[]>;
  selectModel(policyDecision: PolicyDecision): ModelDescriptor | undefined | Promise<ModelDescriptor | undefined>;
  probeModel(modelId: string): ModelProbeResult | Promise<ModelProbeResult>;
}

export function parseProviderManifest(input: z.input<typeof ProviderManifestSchema>): ProviderManifest {
  return ProviderManifestSchema.parse(input);
}

export function parseProviderAttestation(
  input: z.input<typeof ProviderAttestationSchema>
): ProviderAttestation {
  return ProviderAttestationSchema.parse(input);
}

export function parseProviderExecutionPermit(
  input: z.input<typeof ProviderExecutionPermitSchema>
): ProviderExecutionPermit {
  return ProviderExecutionPermitSchema.parse(input);
}

export function parseWorkspaceWriteProviderExecutionPermit(
  input: z.input<typeof WorkspaceWriteProviderExecutionPermitSchema>
): WorkspaceWriteProviderExecutionPermit {
  return WorkspaceWriteProviderExecutionPermitSchema.parse(input);
}

export function parseWorkspaceWriteProviderExecutionPermitV2(
  input: z.input<typeof WorkspaceWriteProviderExecutionPermitV2Schema>
): WorkspaceWriteProviderExecutionPermitV2 {
  return WorkspaceWriteProviderExecutionPermitV2Schema.parse(input);
}

export function createProviderAttestation(
  manifest: ProviderManifest,
  attestedAt: string
): ProviderAttestation {
  const parsed = ProviderManifestSchema.parse(manifest);

  return ProviderAttestationSchema.parse({
    schemaVersion: "provider-attestation.v1",
    providerId: parsed.providerId,
    kind: parsed.kind,
    displayName: parsed.displayName,
    version: parsed.version,
    manifestHash: hashProviderManifest(parsed),
    capabilities: parsed.capabilities,
    securityBoundary: parsed.securityBoundary,
    supportedSandboxProfiles: parsed.supportedSandboxProfiles,
    supportedSideEffectClasses: parsed.supportedSideEffectClasses,
    attestedAt
  });
}

export function createApprovedProviderExecutionPermit(
  input: ProviderExecutionPermitIssueInput
): ProviderExecutionPermit {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const reasons = getReadOnlyProviderExecutionPermitIssuanceBlockers(
    plan,
    input.approvalStatus
  );

  if (reasons.length > 0) {
    throw new Error(`provider_execution_permit_not_approvable:${reasons.join(",")}`);
  }

  return createProviderExecutionPermit(input, "approved", []);
}

export function createBlockedProviderExecutionPermit(
  input: ProviderExecutionPermitIssueInput
): ProviderExecutionPermit {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const reasons = input.reasons ?? getReadOnlyProviderExecutionPermitIssuanceBlockers(
    plan,
    input.approvalStatus
  );

  return createProviderExecutionPermit(input, "blocked", reasons);
}

export function createApprovedWorkspaceWriteProviderExecutionPermit(
  input: WorkspaceWriteProviderExecutionPermitIssueInput
): WorkspaceWriteProviderExecutionPermit {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const reasons = getWorkspaceWriteProviderExecutionPermitIssuanceBlockers(
    plan,
    ProviderManifestSchema.parse(input.manifest),
    input
  );

  if (reasons.length > 0) {
    throw new Error(`workspace_write_provider_execution_permit_not_approvable:${reasons.join(",")}`);
  }

  return createWorkspaceWriteProviderExecutionPermit(input, "approved", []);
}

export function createBlockedWorkspaceWriteProviderExecutionPermit(
  input: WorkspaceWriteProviderExecutionPermitIssueInput
): WorkspaceWriteProviderExecutionPermit {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const reasons = input.reasons ?? getWorkspaceWriteProviderExecutionPermitIssuanceBlockers(
    plan,
    ProviderManifestSchema.parse(input.manifest),
    input
  );

  return createWorkspaceWriteProviderExecutionPermit(input, "blocked", reasons);
}

export function createApprovedWorkspaceWriteProviderExecutionPermitV2(
  input: WorkspaceWriteProviderExecutionPermitV2IssueInput
): WorkspaceWriteProviderExecutionPermitV2 {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const reasons = getWorkspaceWriteProviderExecutionPermitV2IssuanceBlockers(
    plan,
    ProviderManifestSchema.parse(input.manifest),
    input
  );

  if (reasons.length > 0) {
    throw new Error(`workspace_write_provider_execution_permit_v2_not_approvable:${reasons.join(",")}`);
  }

  return createWorkspaceWriteProviderExecutionPermitV2(input, "approved", []);
}

export function createBlockedWorkspaceWriteProviderExecutionPermitV2(
  input: WorkspaceWriteProviderExecutionPermitV2IssueInput
): WorkspaceWriteProviderExecutionPermitV2 {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const reasons = input.reasons ?? getWorkspaceWriteProviderExecutionPermitV2IssuanceBlockers(
    plan,
    ProviderManifestSchema.parse(input.manifest),
    input
  );

  return createWorkspaceWriteProviderExecutionPermitV2(input, "blocked", reasons);
}

export function validateProviderExecutionPermitForPlan(
  permitInput: ProviderExecutionPermit,
  planInput: ExecutorExecutionPlan,
  manifestInput: ProviderManifest,
  options: ProviderExecutionPermitValidationOptions = {}
): string[] {
  const parsedPermit = ProviderExecutionPermitSchema.safeParse(permitInput);
  const prefix = options.reasonPrefix ?? "provider_execution_permit";

  if (!parsedPermit.success) {
    return [`${prefix}_invalid:${normalizeProviderCoreError(parsedPermit.error)}`];
  }

  const permit = parsedPermit.data;
  const plan = ExecutorExecutionPlanSchema.parse(planInput);
  const manifest = ProviderManifestSchema.parse(manifestInput);
  const reasons: string[] = [];

  if (permit.status !== "approved") {
    reasons.push(`${prefix}_not_approved:${permit.status}`);
  }

  if (permit.approvalStatus !== "not_required") {
    reasons.push(`${prefix}_approval_status_must_be_not_required:${permit.approvalStatus}`);
  }

  if (permit.consumedAt !== undefined) {
    reasons.push(`${prefix}_already_consumed`);
  }

  if (permit.providerId !== plan.providerId) {
    reasons.push(`${prefix}_provider_mismatch:${permit.providerId}:${plan.providerId}`);
  }

  if (permit.taskId !== plan.taskId) {
    reasons.push(`${prefix}_task_mismatch:${permit.taskId}:${plan.taskId}`);
  }

  if (permit.taskHash !== undefined && plan.taskHash !== undefined && permit.taskHash !== plan.taskHash) {
    reasons.push(`${prefix}_task_hash_mismatch`);
  }

  if (plan.taskHash !== undefined && permit.taskHash === undefined) {
    reasons.push(`${prefix}_task_hash_required`);
  }

  if (permit.runId !== plan.runId) {
    reasons.push(`${prefix}_run_mismatch:${permit.runId}:${plan.runId}`);
  }

  if (permit.planId !== plan.planId) {
    reasons.push(`${prefix}_plan_mismatch:${permit.planId}:${plan.planId}`);
  }

  const expectedPlanHash = hashExecutorExecutionPlan(plan);
  if (permit.planHash !== expectedPlanHash) {
    reasons.push(`${prefix}_plan_hash_mismatch`);
  }

  const expectedNonce = createProviderPermitNonce(plan, permit.issuedAt, permit.expiresAt);
  if (permit.nonce !== expectedNonce) {
    reasons.push(`${prefix}_nonce_mismatch`);
  }

  if (
    permit.providerExecutionPlanHash !== undefined
    && plan.providerExecutionPlanHash !== undefined
    && permit.providerExecutionPlanHash !== plan.providerExecutionPlanHash
  ) {
    reasons.push(`${prefix}_provider_plan_hash_mismatch`);
  }

  if (plan.providerExecutionPlanHash !== undefined && permit.providerExecutionPlanHash === undefined) {
    reasons.push(`${prefix}_provider_plan_hash_required`);
  }

  if (permit.principalId !== undefined && plan.principalId !== undefined && permit.principalId !== plan.principalId) {
    reasons.push(`${prefix}_principal_mismatch:${permit.principalId}:${plan.principalId}`);
  }

  if (plan.principalId !== undefined && permit.principalId === undefined) {
    reasons.push(`${prefix}_principal_required`);
  }

  if (
    permit.principalHash !== undefined
    && plan.principalHash !== undefined
    && permit.principalHash !== plan.principalHash
  ) {
    reasons.push(`${prefix}_principal_hash_mismatch`);
  }

  if (plan.principalHash !== undefined && permit.principalHash === undefined) {
    reasons.push(`${prefix}_principal_hash_required`);
  }

  if (permit.sideEffectClass !== plan.sideEffectClass) {
    reasons.push(`${prefix}_side_effect_mismatch:${permit.sideEffectClass}:${plan.sideEffectClass}`);
  }

  if (permit.sandboxProfileId !== plan.sandboxProfile.sandboxId) {
    reasons.push(`${prefix}_sandbox_mismatch:${permit.sandboxProfileId}:${plan.sandboxProfile.sandboxId}`);
  }

  if (permit.providerManifestHash !== hashProviderManifest(manifest)) {
    reasons.push(`${prefix}_manifest_mismatch`);
  }

  if (plan.providerManifestHash !== undefined && permit.providerManifestHash !== plan.providerManifestHash) {
    reasons.push(`${prefix}_plan_manifest_hash_mismatch`);
  }

  if (plan.policyDecisionHash === undefined || permit.policyDecisionHash === undefined) {
    reasons.push(`${prefix}_policy_hash_required`);
  } else if (permit.policyDecisionHash !== plan.policyDecisionHash) {
    reasons.push(`${prefix}_policy_mismatch`);
  }

  reasons.push(...validateProviderExecutionPermitTimestamps(permit, prefix, options.now));

  return uniqueProviderCoreStrings(reasons);
}

export function createProviderExecutionPermitConsumptionKey(
  permitInput: ProviderExecutionPermit
): string {
  const permit = ProviderExecutionPermitSchema.parse(permitInput);

  return createHash("sha256")
    .update(stableStringifyProviderObject({
      schemaVersion: "provider-execution-permit-consumption-key.v1",
      taskId: permit.taskId,
      taskHash: permit.taskHash,
      runId: permit.runId,
      planId: permit.planId,
      planHash: permit.planHash,
      providerExecutionPlanHash: permit.providerExecutionPlanHash,
      providerId: permit.providerId,
      providerManifestHash: permit.providerManifestHash,
      policyDecisionHash: permit.policyDecisionHash,
      principalId: permit.principalId,
      principalHash: permit.principalHash,
      sideEffectClass: permit.sideEffectClass,
      sandboxProfileId: permit.sandboxProfileId
    }))
    .digest("hex");
}

export function consumeProviderExecutionPermitForPlan(
  permitInput: ProviderExecutionPermit,
  planInput: ExecutorExecutionPlan,
  manifestInput: ProviderManifest,
  store: ProviderExecutionPermitConsumptionStore,
  options: ProviderExecutionPermitConsumptionOptions = {}
): string[] {
  const prefix = options.reasonPrefix ?? "provider_execution_permit";
  const validationReasons = validateProviderExecutionPermitForPlan(
    permitInput,
    planInput,
    manifestInput,
    options
  );

  if (validationReasons.length > 0) {
    return validationReasons;
  }

  const permit = ProviderExecutionPermitSchema.parse(permitInput);
  const consumedAt = options.consumedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(consumedAt))) {
    return [`${prefix}_consumed_at_invalid`];
  }

  let result: ProviderExecutionPermitConsumptionResult;
  try {
    result = store.consumeIfUnused({
      schemaVersion: "provider-execution-permit-consumption.v1",
      consumptionKey: createProviderExecutionPermitConsumptionKey(permit),
      permitId: permit.permitId,
      nonce: permit.nonce,
      taskId: permit.taskId,
      ...(permit.taskHash !== undefined ? { taskHash: permit.taskHash } : {}),
      runId: permit.runId,
      planId: permit.planId,
      planHash: permit.planHash,
      ...(permit.providerExecutionPlanHash !== undefined
        ? { providerExecutionPlanHash: permit.providerExecutionPlanHash }
        : {}),
      providerId: permit.providerId,
      providerManifestHash: permit.providerManifestHash,
      ...(permit.policyDecisionHash !== undefined ? { policyDecisionHash: permit.policyDecisionHash } : {}),
      ...(permit.principalId !== undefined ? { principalId: permit.principalId } : {}),
      ...(permit.principalHash !== undefined ? { principalHash: permit.principalHash } : {}),
      sideEffectClass: permit.sideEffectClass,
      sandboxProfileId: permit.sandboxProfileId,
      issuedAt: permit.issuedAt,
      expiresAt: permit.expiresAt,
      consumedAt
    });
  } catch {
    return [`${prefix}_consumption_store_failed`];
  }

  return result === "consumed"
    ? []
    : [`${prefix}_already_consumed_by_store`];
}

export function validateWorkspaceWriteProviderExecutionPermitForPlan(
  permitInput: WorkspaceWriteProviderExecutionPermit,
  planInput: ExecutorExecutionPlan,
  manifestInput: ProviderManifest,
  options: ProviderExecutionPermitValidationOptions = {}
): string[] {
  const parsedPermit = WorkspaceWriteProviderExecutionPermitSchema.safeParse(permitInput);
  const prefix = options.reasonPrefix ?? "workspace_write_provider_execution_permit";

  if (!parsedPermit.success) {
    return [`${prefix}_invalid:${normalizeProviderCoreError(parsedPermit.error)}`];
  }

  const permit = parsedPermit.data;
  const plan = ExecutorExecutionPlanSchema.parse(planInput);
  const manifest = ProviderManifestSchema.parse(manifestInput);
  const reasons: string[] = [];

  if (permit.status !== "approved") {
    reasons.push(`${prefix}_not_approved:${permit.status}`);
  }

  if (permit.providerId !== plan.providerId) {
    reasons.push(`${prefix}_provider_mismatch:${permit.providerId}:${plan.providerId}`);
  }

  if (permit.taskId !== plan.taskId) {
    reasons.push(`${prefix}_task_mismatch:${permit.taskId}:${plan.taskId}`);
  }

  if (permit.runId !== undefined && permit.runId !== plan.runId) {
    reasons.push(`${prefix}_run_mismatch:${permit.runId}:${plan.runId}`);
  }

  if (permit.planId !== undefined && permit.planId !== plan.planId) {
    reasons.push(`${prefix}_plan_mismatch:${permit.planId}:${plan.planId}`);
  }

  if (permit.sideEffectClass !== plan.sideEffectClass) {
    reasons.push(`${prefix}_side_effect_mismatch:${permit.sideEffectClass}:${plan.sideEffectClass}`);
  }

  if (plan.sideEffectClass !== "workspace_write") {
    reasons.push(`${prefix}_requires_workspace_write_side_effect`);
  }

  if (permit.sandboxProfileId !== plan.sandboxProfile.sandboxId) {
    reasons.push(`${prefix}_sandbox_mismatch:${permit.sandboxProfileId}:${plan.sandboxProfile.sandboxId}`);
  }

  if (plan.sandboxProfile.mode !== "workspace-write") {
    reasons.push(`${prefix}_requires_workspace_write_sandbox`);
  }

  if (
    permit.providerManifestHash !== undefined
    && permit.providerManifestHash !== hashProviderManifest(manifest)
  ) {
    reasons.push(`${prefix}_manifest_mismatch`);
  }

  if (
    permit.policyDecisionHash !== undefined
    && permit.policyDecisionHash !== plan.policyDecisionHash
  ) {
    reasons.push(`${prefix}_policy_mismatch`);
  }

  reasons.push(...getWorkspaceWriteProviderExecutionPermitGovernanceBlockers(permit));

  return uniqueProviderCoreStrings(reasons);
}

export function validateWorkspaceWriteProviderExecutionPermitV2ForPlan(
  permitInput: WorkspaceWriteProviderExecutionPermitV2,
  planInput: ExecutorExecutionPlan,
  manifestInput: ProviderManifest,
  options: ProviderExecutionPermitValidationOptions = {}
): string[] {
  const parsedPermit = WorkspaceWriteProviderExecutionPermitV2Schema.safeParse(permitInput);
  const prefix = options.reasonPrefix ?? "workspace_write_provider_execution_permit_v2";

  if (!parsedPermit.success) {
    return [`${prefix}_invalid:${normalizeProviderCoreError(parsedPermit.error)}`];
  }

  const permit = parsedPermit.data;
  const plan = ExecutorExecutionPlanSchema.parse(planInput);
  const manifest = ProviderManifestSchema.parse(manifestInput);
  const reasons: string[] = [];

  if (permit.status !== "approved") {
    reasons.push(`${prefix}_not_approved:${permit.status}`);
  }

  if (permit.approvalStatus !== "approved") {
    reasons.push(`${prefix}_approval_required:${permit.approvalStatus}`);
  }

  if (permit.consumedAt !== undefined) {
    reasons.push(`${prefix}_already_consumed`);
  }

  if (permit.providerId !== plan.providerId) {
    reasons.push(`${prefix}_provider_mismatch:${permit.providerId}:${plan.providerId}`);
  }

  if (permit.taskId !== plan.taskId) {
    reasons.push(`${prefix}_task_mismatch:${permit.taskId}:${plan.taskId}`);
  }

  if (permit.taskHash !== undefined && plan.taskHash !== undefined && permit.taskHash !== plan.taskHash) {
    reasons.push(`${prefix}_task_hash_mismatch`);
  }

  if (plan.taskHash !== undefined && permit.taskHash === undefined) {
    reasons.push(`${prefix}_task_hash_required`);
  }

  if (permit.runId !== plan.runId) {
    reasons.push(`${prefix}_run_mismatch:${permit.runId}:${plan.runId}`);
  }

  if (permit.planId !== plan.planId) {
    reasons.push(`${prefix}_plan_mismatch:${permit.planId}:${plan.planId}`);
  }

  const expectedPlanHash = hashExecutorExecutionPlan(plan);
  if (permit.planHash !== expectedPlanHash) {
    reasons.push(`${prefix}_plan_hash_mismatch`);
  }

  if (plan.providerExecutionPlanHash === undefined) {
    reasons.push(`${prefix}_provider_plan_hash_required`);
  } else if (permit.providerExecutionPlanHash !== plan.providerExecutionPlanHash) {
    reasons.push(`${prefix}_provider_plan_hash_mismatch`);
  }

  if (permit.providerManifestHash !== hashProviderManifest(manifest)) {
    reasons.push(`${prefix}_manifest_mismatch`);
  }

  if (plan.providerManifestHash !== undefined && permit.providerManifestHash !== plan.providerManifestHash) {
    reasons.push(`${prefix}_plan_manifest_hash_mismatch`);
  }

  if (plan.policyDecisionHash === undefined) {
    reasons.push(`${prefix}_policy_hash_required`);
  } else if (permit.policyDecisionHash !== plan.policyDecisionHash) {
    reasons.push(`${prefix}_policy_mismatch`);
  }

  if (permit.principalId !== undefined && plan.principalId !== undefined && permit.principalId !== plan.principalId) {
    reasons.push(`${prefix}_principal_mismatch:${permit.principalId}:${plan.principalId}`);
  }

  if (plan.principalId !== undefined && permit.principalId === undefined) {
    reasons.push(`${prefix}_principal_required`);
  }

  if (plan.principalHash === undefined) {
    reasons.push(`${prefix}_principal_hash_required`);
  } else if (permit.principalHash !== plan.principalHash) {
    reasons.push(`${prefix}_principal_hash_mismatch`);
  }

  if (permit.sideEffectClass !== plan.sideEffectClass) {
    reasons.push(`${prefix}_side_effect_mismatch:${permit.sideEffectClass}:${plan.sideEffectClass}`);
  }

  if (plan.sideEffectClass !== "workspace_write") {
    reasons.push(`${prefix}_requires_workspace_write_side_effect`);
  }

  if (permit.sandboxProfileId !== plan.sandboxProfile.sandboxId) {
    reasons.push(`${prefix}_sandbox_mismatch:${permit.sandboxProfileId}:${plan.sandboxProfile.sandboxId}`);
  }

  if (plan.sandboxProfile.mode !== "workspace-write") {
    reasons.push(`${prefix}_requires_workspace_write_sandbox`);
  }

  if (!providerSupportsSideEffectClass(manifest, "workspace_write")) {
    reasons.push(`${prefix}_manifest_side_effect_unsupported`);
  }

  if (!providerSupportsSandboxProfile(manifest, plan.sandboxProfile)) {
    reasons.push(`${prefix}_manifest_sandbox_unsupported`);
  }

  if (permit.operatorAuthorizationId === undefined || permit.operatorAuthorizationId.length === 0) {
    reasons.push(`${prefix}_operator_authorization_required`);
  }

  reasons.push(...getWorkspaceWriteProviderExecutionPermitGovernanceBlockers(permit, prefix));
  reasons.push(...getWorkspaceWriteProviderExecutionPermitV2RollbackBlockers(permit, prefix));

  const expectedNonce = createWorkspaceWriteProviderPermitV2Nonce(permit, expectedPlanHash);
  if (permit.nonce !== expectedNonce) {
    reasons.push(`${prefix}_nonce_mismatch`);
  }

  reasons.push(...validateProviderExecutionPermitTimestamps(permit, prefix, options.now));

  return uniqueProviderCoreStrings(reasons);
}

export function createWorkspaceWriteProviderExecutionPermitV2ConsumptionKey(
  permitInput: WorkspaceWriteProviderExecutionPermitV2
): string {
  const permit = WorkspaceWriteProviderExecutionPermitV2Schema.parse(permitInput);

  return createHash("sha256")
    .update(stableStringifyProviderObject({
      schemaVersion: "workspace-write-provider-execution-permit-consumption-key.v2",
      taskId: permit.taskId,
      taskHash: permit.taskHash,
      runId: permit.runId,
      planId: permit.planId,
      planHash: permit.planHash,
      providerExecutionPlanHash: permit.providerExecutionPlanHash,
      providerId: permit.providerId,
      providerManifestHash: permit.providerManifestHash,
      policyDecisionHash: permit.policyDecisionHash,
      principalId: permit.principalId,
      principalHash: permit.principalHash,
      sideEffectClass: permit.sideEffectClass,
      sandboxProfileId: permit.sandboxProfileId,
      operatorAuthorizationId: permit.operatorAuthorizationId,
      targetFiles: normalizeWorkspaceWritePermitPathList(permit.targetFiles),
      rollback: permit.rollback
    }))
    .digest("hex");
}

export function consumeWorkspaceWriteProviderExecutionPermitV2ForPlan(
  permitInput: WorkspaceWriteProviderExecutionPermitV2,
  planInput: ExecutorExecutionPlan,
  manifestInput: ProviderManifest,
  store: ProviderExecutionPermitConsumptionStore,
  options: ProviderExecutionPermitConsumptionOptions = {}
): string[] {
  const prefix = options.reasonPrefix ?? "workspace_write_provider_execution_permit_v2";
  const validationReasons = validateWorkspaceWriteProviderExecutionPermitV2ForPlan(
    permitInput,
    planInput,
    manifestInput,
    options
  );

  if (validationReasons.length > 0) {
    return validationReasons;
  }

  const permit = WorkspaceWriteProviderExecutionPermitV2Schema.parse(permitInput);
  const consumedAt = options.consumedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(consumedAt))) {
    return [`${prefix}_consumed_at_invalid`];
  }

  let result: ProviderExecutionPermitConsumptionResult;
  try {
    result = store.consumeIfUnused({
      schemaVersion: "provider-execution-permit-consumption.v1",
      consumptionKey: createWorkspaceWriteProviderExecutionPermitV2ConsumptionKey(permit),
      permitId: permit.permitId,
      nonce: permit.nonce,
      taskId: permit.taskId,
      ...(permit.taskHash !== undefined ? { taskHash: permit.taskHash } : {}),
      runId: permit.runId,
      planId: permit.planId,
      planHash: permit.planHash,
      providerExecutionPlanHash: permit.providerExecutionPlanHash,
      providerId: permit.providerId,
      providerManifestHash: permit.providerManifestHash,
      policyDecisionHash: permit.policyDecisionHash,
      ...(permit.principalId !== undefined ? { principalId: permit.principalId } : {}),
      principalHash: permit.principalHash,
      sideEffectClass: permit.sideEffectClass,
      sandboxProfileId: permit.sandboxProfileId,
      issuedAt: permit.issuedAt,
      expiresAt: permit.expiresAt,
      consumedAt
    });
  } catch {
    return [`${prefix}_consumption_store_failed`];
  }

  return result === "consumed"
    ? []
    : [`${prefix}_already_consumed_by_store`];
}

export function hashProviderManifest(manifest: ProviderManifest): string {
  return createHash("sha256")
    .update(stableStringifyProviderObject(ProviderManifestSchema.parse(manifest)))
    .digest("hex");
}

export function hashExecutorExecutionPlan(plan: ExecutorExecutionPlan): string {
  return createHash("sha256")
    .update(stableStringifyProviderObject(ExecutorExecutionPlanSchema.parse(plan)))
    .digest("hex");
}

export function parseExecutorExecutionPlan(
  input: z.input<typeof ExecutorExecutionPlanSchema>
): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse(input);
}

export function parseToolProviderInvocationPlan(
  input: z.input<typeof ToolProviderInvocationPlanSchema>
): ToolProviderInvocationPlan {
  return ToolProviderInvocationPlanSchema.parse(input);
}

export function providerSupportsSideEffectClass(
  manifest: ProviderManifest,
  sideEffectClass: ProviderSideEffectClass
): boolean {
  const parsed = ProviderManifestSchema.parse(manifest);
  ProviderSideEffectClassSchema.parse(sideEffectClass);
  return parsed.supportedSideEffectClasses.includes(sideEffectClass);
}

export function assertProviderSupportsSideEffectClass(
  manifest: ProviderManifest,
  sideEffectClass: ProviderSideEffectClass
): void {
  if (!providerSupportsSideEffectClass(manifest, sideEffectClass)) {
    throw new Error(`unsupported_side_effect_class:${manifest.providerId}:${sideEffectClass}`);
  }
}

export function providerSupportsSandboxProfile(
  manifest: ProviderManifest,
  sandboxProfile: SandboxProfile
): boolean {
  const parsed = ProviderManifestSchema.parse(manifest);
  const requested = SandboxProfileSchema.parse(sandboxProfile);

  return parsed.supportedSandboxProfiles.some((supported) => (
    supported.mode === requested.mode
    && networkAccessImplies(supported.networkAccess, requested.networkAccess)
    && writableRootsImply(supported.writableRoots, requested.writableRoots)
    && envPolicyImplies(supported.envPolicy, requested.envPolicy)
  ));
}

export function assertProviderSupportsSandboxProfile(
  manifest: ProviderManifest,
  sandboxProfile: SandboxProfile
): void {
  if (!providerSupportsSandboxProfile(manifest, sandboxProfile)) {
    throw new Error(`unsupported_sandbox_profile:${manifest.providerId}:${sandboxProfile.sandboxId}`);
  }
}

export function parseRegisteredToolManifestForProvider(input: unknown): RegisteredToolManifest {
  return RegisteredToolManifestSchema.parse(input);
}

function networkAccessImplies(
  granted: SandboxProfile["networkAccess"],
  requested: SandboxProfile["networkAccess"]
): boolean {
  if (granted === requested) {
    return true;
  }

  if (granted === "full") {
    return true;
  }

  return granted === "restricted" && requested === "none";
}

function writableRootsImply(granted: string[], requested: string[]): boolean {
  if (requested.length === 0) {
    return true;
  }

  return requested.every((root) => (
    granted.some((grantedRoot) => writableRootImplies(grantedRoot, root))
  ));
}

function writableRootImplies(grantedRoot: string, requestedRoot: string): boolean {
  if (grantedRoot === "*") {
    return true;
  }

  const normalizedGrantedRoot = normalizeRootPattern(grantedRoot);
  const normalizedRequestedRoot = normalizeRootPattern(requestedRoot);

  if (normalizedGrantedRoot === normalizedRequestedRoot) {
    return true;
  }

  if (normalizedGrantedRoot.endsWith("/**")) {
    const prefix = normalizedGrantedRoot.slice(0, -3);
    return normalizedRequestedRoot === prefix || normalizedRequestedRoot.startsWith(`${prefix}/`);
  }

  return false;
}

function createProviderExecutionPermit(
  input: ProviderExecutionPermitIssueInput,
  status: "approved" | "blocked",
  reasons: string[]
): ProviderExecutionPermit {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const manifest = ProviderManifestSchema.parse(input.manifest);
  const approvalStatus = input.approvalStatus
    ?? (plan.approvalRequired ? "pending" : "not_required");
  const expiresAt = input.expiresAt ?? createDefaultProviderPermitExpiresAt(input.issuedAt);
  const nonce = createProviderPermitNonce(plan, input.issuedAt, expiresAt);

  return ProviderExecutionPermitSchema.parse({
    schemaVersion: "provider-execution-permit.v1",
    permitId: input.permitId ?? `permit_${plan.planId}`,
    taskId: plan.taskId,
    ...(plan.taskHash !== undefined ? { taskHash: plan.taskHash } : {}),
    runId: plan.runId,
    planId: plan.planId,
    planHash: hashExecutorExecutionPlan(plan),
    ...(plan.providerExecutionPlanHash !== undefined
      ? { providerExecutionPlanHash: plan.providerExecutionPlanHash }
      : {}),
    providerId: plan.providerId,
    providerManifestHash: hashProviderManifest(manifest),
    ...(plan.policyDecisionHash !== undefined ? { policyDecisionHash: plan.policyDecisionHash } : {}),
    ...(plan.principalId !== undefined ? { principalId: plan.principalId } : {}),
    ...(plan.principalHash !== undefined ? { principalHash: plan.principalHash } : {}),
    sideEffectClass: plan.sideEffectClass,
    sandboxProfileId: plan.sandboxProfile.sandboxId,
    status,
    approvalStatus,
    reasons,
    issuedAt: input.issuedAt,
    expiresAt,
    nonce
  });
}

function createWorkspaceWriteProviderExecutionPermit(
  input: WorkspaceWriteProviderExecutionPermitIssueInput,
  status: "approved" | "blocked",
  reasons: string[]
): WorkspaceWriteProviderExecutionPermit {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const manifest = ProviderManifestSchema.parse(input.manifest);

  return WorkspaceWriteProviderExecutionPermitSchema.parse({
    schemaVersion: "provider-workspace-write-execution-permit.v1",
    permitId: input.permitId ?? `workspace_write_permit_${plan.planId}`,
    taskId: plan.taskId,
    runId: plan.runId,
    planId: plan.planId,
    providerId: plan.providerId,
    providerManifestHash: hashProviderManifest(manifest),
    ...(plan.policyDecisionHash !== undefined
      ? { policyDecisionHash: plan.policyDecisionHash }
      : {}),
    sideEffectClass: "workspace_write",
    sandboxProfileId: plan.sandboxProfile.sandboxId,
    sandboxMode: "workspace-write",
    status,
    approvalStatus: input.approvalStatus ?? "pending",
    ...(input.operatorAuthorizationId !== undefined
      ? { operatorAuthorizationId: input.operatorAuthorizationId }
      : {}),
    targetFiles: [...input.targetFiles],
    maxChangedFiles: input.maxChangedFiles,
    maxDiffLines: input.maxDiffLines,
    rollbackRequired: input.rollbackRequired,
    protectedBranchForbidden: input.protectedBranchForbidden,
    dirtyWorktreeForbidden: input.dirtyWorktreeForbidden,
    repositoryState: input.repositoryState,
    reasons,
    issuedAt: input.issuedAt
  });
}

function createWorkspaceWriteProviderExecutionPermitV2(
  input: WorkspaceWriteProviderExecutionPermitV2IssueInput,
  status: "approved" | "blocked",
  reasons: string[]
): WorkspaceWriteProviderExecutionPermitV2 {
  const plan = ExecutorExecutionPlanSchema.parse(input.plan);
  const manifest = ProviderManifestSchema.parse(input.manifest);
  const targetFiles = normalizeWorkspaceWritePermitPathList(input.targetFiles);
  const rollbackAffectedFiles = normalizeWorkspaceWritePermitPathList(
    input.rollback.affectedFiles ?? targetFiles
  );
  const rollback = createWorkspaceWriteProviderPermitV2RollbackBinding(
    input.rollback.beforeCommit,
    rollbackAffectedFiles
  );
  const expiresAt = input.expiresAt ?? createDefaultProviderPermitExpiresAt(input.issuedAt);
  const planHash = hashExecutorExecutionPlan(plan);
  const draftPermit = {
    schemaVersion: "provider-workspace-write-execution-permit.v2" as const,
    permitId: input.permitId ?? `workspace_write_permit_v2_${plan.planId}`,
    taskId: plan.taskId,
    ...(plan.taskHash !== undefined ? { taskHash: plan.taskHash } : {}),
    runId: plan.runId,
    planId: plan.planId,
    planHash,
    providerExecutionPlanHash: plan.providerExecutionPlanHash ?? "0".repeat(64),
    providerId: plan.providerId,
    providerManifestHash: hashProviderManifest(manifest),
    policyDecisionHash: plan.policyDecisionHash ?? "missing_policy_decision_hash",
    ...(plan.principalId !== undefined ? { principalId: plan.principalId } : {}),
    principalHash: plan.principalHash ?? "0".repeat(64),
    sideEffectClass: "workspace_write" as const,
    sandboxProfileId: plan.sandboxProfile.sandboxId,
    sandboxMode: "workspace-write" as const,
    status,
    approvalStatus: input.approvalStatus ?? "pending",
    ...(input.operatorAuthorizationId !== undefined
      ? { operatorAuthorizationId: input.operatorAuthorizationId }
      : {}),
    targetFiles,
    maxChangedFiles: input.maxChangedFiles,
    maxDiffLines: input.maxDiffLines,
    rollbackRequired: input.rollbackRequired,
    rollback,
    protectedBranchForbidden: input.protectedBranchForbidden,
    dirtyWorktreeForbidden: input.dirtyWorktreeForbidden,
    repositoryState: input.repositoryState,
    reasons,
    issuedAt: input.issuedAt,
    expiresAt
  };

  return WorkspaceWriteProviderExecutionPermitV2Schema.parse({
    ...draftPermit,
    nonce: createWorkspaceWriteProviderPermitV2Nonce(draftPermit, planHash)
  });
}

function getReadOnlyProviderExecutionPermitIssuanceBlockers(
  plan: ExecutorExecutionPlan,
  approvalStatus: ProviderExecutionPermitApprovalStatus | undefined
): string[] {
  const reasons: string[] = [];

  if (plan.sideEffectClass !== "read_only") {
    reasons.push("provider_execution_permit_read_only_only");
  }

  if (plan.sandboxProfile.mode !== "read-only") {
    reasons.push("provider_execution_permit_requires_read_only_sandbox");
  }

  if (plan.approvalRequired || (approvalStatus !== undefined && approvalStatus !== "not_required")) {
    reasons.push("provider_execution_permit_approval_required");
  }

  if (plan.policyDecisionHash === undefined) {
    reasons.push("provider_execution_permit_policy_hash_required");
  }

  return uniqueProviderCoreStrings(reasons);
}

function validateProviderExecutionPermitTimestamps(
  permit: Pick<ProviderExecutionPermit, "issuedAt" | "expiresAt">,
  prefix: string,
  now?: string
): string[] {
  const reasons: string[] = [];
  const issuedAtMs = Date.parse(permit.issuedAt);
  const expiresAtMs = Date.parse(permit.expiresAt);

  if (!Number.isFinite(issuedAtMs)) {
    reasons.push(`${prefix}_issued_at_invalid`);
  }

  if (!Number.isFinite(expiresAtMs)) {
    reasons.push(`${prefix}_expires_at_invalid`);
  }

  if (
    Number.isFinite(issuedAtMs)
    && Number.isFinite(expiresAtMs)
    && expiresAtMs <= issuedAtMs
  ) {
    reasons.push(`${prefix}_expires_at_not_after_issued_at`);
  }

  if (now !== undefined) {
    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs)) {
      reasons.push(`${prefix}_validation_time_invalid`);
    } else {
      if (Number.isFinite(issuedAtMs) && issuedAtMs > nowMs + 60_000) {
        reasons.push(`${prefix}_issued_at_in_future`);
      }
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) {
        reasons.push(`${prefix}_expired`);
      }
    }
  }

  return reasons;
}

function createDefaultProviderPermitExpiresAt(issuedAt: string): string {
  const issuedAtMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    return issuedAt;
  }

  return new Date(issuedAtMs + 5 * 60_000).toISOString();
}

function createProviderPermitNonce(
  plan: ExecutorExecutionPlan,
  issuedAt: string,
  expiresAt: string
): string {
  return createHash("sha256")
    .update(stableStringifyProviderObject({
      planHash: hashExecutorExecutionPlan(plan),
      issuedAt,
      expiresAt
    }))
    .digest("hex")
    .slice(0, 24);
}

function createWorkspaceWriteProviderPermitV2Nonce(
  permit: Pick<
    WorkspaceWriteProviderExecutionPermitV2,
    | "permitId"
    | "taskId"
    | "taskHash"
    | "runId"
    | "planId"
    | "providerExecutionPlanHash"
    | "providerId"
    | "providerManifestHash"
    | "policyDecisionHash"
    | "principalId"
    | "principalHash"
    | "sandboxProfileId"
    | "operatorAuthorizationId"
    | "targetFiles"
    | "maxChangedFiles"
    | "maxDiffLines"
    | "rollback"
    | "issuedAt"
    | "expiresAt"
  >,
  planHash: string
): string {
  return createHash("sha256")
    .update(stableStringifyProviderObject({
      schemaVersion: "workspace-write-provider-execution-permit-nonce.v2",
      permitId: permit.permitId,
      taskId: permit.taskId,
      taskHash: permit.taskHash,
      runId: permit.runId,
      planId: permit.planId,
      planHash,
      providerExecutionPlanHash: permit.providerExecutionPlanHash,
      providerId: permit.providerId,
      providerManifestHash: permit.providerManifestHash,
      policyDecisionHash: permit.policyDecisionHash,
      principalId: permit.principalId,
      principalHash: permit.principalHash,
      sandboxProfileId: permit.sandboxProfileId,
      operatorAuthorizationId: permit.operatorAuthorizationId,
      targetFiles: normalizeWorkspaceWritePermitPathList(permit.targetFiles),
      maxChangedFiles: permit.maxChangedFiles,
      maxDiffLines: permit.maxDiffLines,
      rollback: permit.rollback,
      issuedAt: permit.issuedAt,
      expiresAt: permit.expiresAt
    }))
    .digest("hex")
    .slice(0, 32);
}

function createWorkspaceWriteProviderPermitV2RollbackBinding(
  beforeCommit: string,
  affectedFiles: string[]
): WorkspaceWriteProviderExecutionPermitV2["rollback"] {
  const normalizedAffectedFiles = normalizeWorkspaceWritePermitPathList(affectedFiles);
  return {
    beforeCommit,
    commandIdentity: {
      kind: "git_restore_from_commit",
      commandHash: createWorkspaceWriteProviderPermitV2RollbackCommandHash(
        beforeCommit,
        normalizedAffectedFiles
      ),
      affectedFiles: normalizedAffectedFiles
    }
  };
}

function createWorkspaceWriteProviderPermitV2RollbackCommandHash(
  beforeCommit: string,
  affectedFiles: string[]
): string {
  return createHash("sha256")
    .update(stableStringifyProviderObject({
      schemaVersion: "workspace-write-rollback-command-identity.v2",
      kind: "git_restore_from_commit",
      beforeCommit,
      affectedFiles: normalizeWorkspaceWritePermitPathList(affectedFiles)
    }))
    .digest("hex");
}

function getWorkspaceWriteProviderExecutionPermitIssuanceBlockers(
  plan: ExecutorExecutionPlan,
  manifest: ProviderManifest,
  input: WorkspaceWriteProviderExecutionPermitIssueInput
): string[] {
  const reasons: string[] = [];

  if (plan.sideEffectClass !== "workspace_write") {
    reasons.push("workspace_write_provider_execution_permit_requires_workspace_write_side_effect");
  }

  if (plan.sandboxProfile.mode !== "workspace-write") {
    reasons.push("workspace_write_provider_execution_permit_requires_workspace_write_sandbox");
  }

  if (!providerSupportsSideEffectClass(manifest, "workspace_write")) {
    reasons.push("workspace_write_provider_execution_permit_manifest_side_effect_unsupported");
  }

  if (!providerSupportsSandboxProfile(manifest, plan.sandboxProfile)) {
    reasons.push("workspace_write_provider_execution_permit_manifest_sandbox_unsupported");
  }

  if (input.approvalStatus !== "approved") {
    reasons.push("workspace_write_provider_execution_permit_approval_required");
  }

  if (input.operatorAuthorizationId === undefined || input.operatorAuthorizationId.length === 0) {
    reasons.push("workspace_write_provider_execution_permit_operator_authorization_required");
  }

  reasons.push(...getWorkspaceWriteProviderExecutionPermitGovernanceBlockers({
    targetFiles: input.targetFiles,
    maxChangedFiles: input.maxChangedFiles,
    rollbackRequired: input.rollbackRequired,
    protectedBranchForbidden: input.protectedBranchForbidden,
    dirtyWorktreeForbidden: input.dirtyWorktreeForbidden,
    repositoryState: input.repositoryState
  }));

  return uniqueProviderCoreStrings(reasons);
}

function getWorkspaceWriteProviderExecutionPermitV2IssuanceBlockers(
  plan: ExecutorExecutionPlan,
  manifest: ProviderManifest,
  input: WorkspaceWriteProviderExecutionPermitV2IssueInput
): string[] {
  const prefix = "workspace_write_provider_execution_permit_v2";
  const reasons: string[] = [];

  if (plan.sideEffectClass !== "workspace_write") {
    reasons.push(`${prefix}_requires_workspace_write_side_effect`);
  }

  if (plan.sandboxProfile.mode !== "workspace-write") {
    reasons.push(`${prefix}_requires_workspace_write_sandbox`);
  }

  if (!providerSupportsSideEffectClass(manifest, "workspace_write")) {
    reasons.push(`${prefix}_manifest_side_effect_unsupported`);
  }

  if (!providerSupportsSandboxProfile(manifest, plan.sandboxProfile)) {
    reasons.push(`${prefix}_manifest_sandbox_unsupported`);
  }

  if (input.approvalStatus !== "approved") {
    reasons.push(`${prefix}_approval_required`);
  }

  if (input.operatorAuthorizationId === undefined || input.operatorAuthorizationId.length === 0) {
    reasons.push(`${prefix}_operator_authorization_required`);
  }

  if (plan.providerExecutionPlanHash === undefined) {
    reasons.push(`${prefix}_provider_plan_hash_required`);
  }

  if (plan.providerManifestHash !== undefined && plan.providerManifestHash !== hashProviderManifest(manifest)) {
    reasons.push(`${prefix}_plan_manifest_hash_mismatch`);
  }

  if (plan.policyDecisionHash === undefined) {
    reasons.push(`${prefix}_policy_hash_required`);
  }

  if (plan.principalHash === undefined) {
    reasons.push(`${prefix}_principal_hash_required`);
  }

  if (input.repositoryState.headCommit === undefined || input.repositoryState.headCommit.length === 0) {
    reasons.push(`${prefix}_before_commit_required`);
  } else if (input.rollback.beforeCommit !== input.repositoryState.headCommit) {
    reasons.push(`${prefix}_rollback_before_commit_mismatch`);
  }

  const targetFiles = normalizeWorkspaceWritePermitPathList(input.targetFiles);
  const rollbackAffectedFiles = normalizeWorkspaceWritePermitPathList(
    input.rollback.affectedFiles ?? targetFiles
  );
  if (!sameProviderCoreStringSet(targetFiles, rollbackAffectedFiles)) {
    reasons.push(`${prefix}_rollback_affected_files_mismatch`);
  }

  if (rollbackAffectedFiles.some((affectedFile) => !isSafeWorkspaceRelativeFilePath(affectedFile))) {
    reasons.push(`${prefix}_rollback_affected_file_out_of_bounds`);
  }

  reasons.push(...getWorkspaceWriteProviderExecutionPermitGovernanceBlockers({
    targetFiles: input.targetFiles,
    maxChangedFiles: input.maxChangedFiles,
    rollbackRequired: input.rollbackRequired,
    protectedBranchForbidden: input.protectedBranchForbidden,
    dirtyWorktreeForbidden: input.dirtyWorktreeForbidden,
    repositoryState: input.repositoryState
  }, prefix));

  return uniqueProviderCoreStrings(reasons);
}

function getWorkspaceWriteProviderExecutionPermitGovernanceBlockers(
  input: Pick<
    WorkspaceWriteProviderExecutionPermit,
    | "targetFiles"
    | "maxChangedFiles"
    | "rollbackRequired"
    | "protectedBranchForbidden"
    | "dirtyWorktreeForbidden"
    | "repositoryState"
  >,
  prefix = "workspace_write_provider_execution_permit"
): string[] {
  const reasons: string[] = [];
  const targetFiles = uniqueProviderCoreStrings(input.targetFiles);

  if (targetFiles.length === 0) {
    reasons.push(`${prefix}_target_files_required`);
  }

  if (targetFiles.length > input.maxChangedFiles) {
    reasons.push(`${prefix}_target_file_count_exceeds_max`);
  }

  if (targetFiles.some((targetFile) => !isSafeWorkspaceRelativeFilePath(targetFile))) {
    reasons.push(`${prefix}_target_file_out_of_bounds`);
  }

  if (!input.rollbackRequired) {
    reasons.push(`${prefix}_rollback_required`);
  }

  if (!input.protectedBranchForbidden || input.repositoryState.protectedBranch) {
    reasons.push(`${prefix}_protected_branch_forbidden`);
  }

  if (!input.dirtyWorktreeForbidden || !input.repositoryState.worktreeClean) {
    reasons.push(`${prefix}_dirty_worktree_forbidden`);
  }

  return uniqueProviderCoreStrings(reasons);
}

function getWorkspaceWriteProviderExecutionPermitV2RollbackBlockers(
  permit: WorkspaceWriteProviderExecutionPermitV2,
  prefix: string
): string[] {
  const reasons: string[] = [];
  const targetFiles = normalizeWorkspaceWritePermitPathList(permit.targetFiles);
  const affectedFiles = normalizeWorkspaceWritePermitPathList(permit.rollback.commandIdentity.affectedFiles);

  if (permit.repositoryState.headCommit === undefined || permit.repositoryState.headCommit.length === 0) {
    reasons.push(`${prefix}_before_commit_required`);
  } else if (permit.rollback.beforeCommit !== permit.repositoryState.headCommit) {
    reasons.push(`${prefix}_rollback_before_commit_mismatch`);
  }

  if (!sameProviderCoreStringSet(targetFiles, affectedFiles)) {
    reasons.push(`${prefix}_rollback_affected_files_mismatch`);
  }

  if (affectedFiles.some((affectedFile) => !isSafeWorkspaceRelativeFilePath(affectedFile))) {
    reasons.push(`${prefix}_rollback_affected_file_out_of_bounds`);
  }

  const expectedRollbackHash = createWorkspaceWriteProviderPermitV2RollbackCommandHash(
    permit.rollback.beforeCommit,
    affectedFiles
  );
  if (permit.rollback.commandIdentity.commandHash !== expectedRollbackHash) {
    reasons.push(`${prefix}_rollback_command_hash_mismatch`);
  }

  return uniqueProviderCoreStrings(reasons);
}

function isSafeWorkspaceRelativeFilePath(targetFile: string): boolean {
  const slashPath = targetFile.replace(/\\/g, "/");

  if (
    slashPath.length === 0
    || slashPath.startsWith("/")
    || /^[a-zA-Z]:/.test(slashPath)
    || slashPath.endsWith("/")
  ) {
    return false;
  }

  const parts = slashPath.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function normalizeWorkspaceWritePermitPathList(paths: string[]): string[] {
  return uniqueProviderCoreStrings(paths.map((path) => path.replace(/\\/g, "/")))
    .sort((left, right) => left.localeCompare(right));
}

function sameProviderCoreStringSet(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizeWorkspaceWritePermitPathList(left);
  const normalizedRight = normalizeWorkspaceWritePermitPathList(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function uniqueProviderCoreStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeProviderCoreError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeRootPattern(root: string): string {
  const slashRoot = root.replace(/\\/g, "/");
  const hasRecursiveWildcard = slashRoot.endsWith("/**");
  const rootBase = hasRecursiveWildcard ? slashRoot.slice(0, -3) : slashRoot;
  const normalizedBase = trimTrailingSlash(pathPosix.normalize(rootBase));

  return hasRecursiveWildcard ? `${normalizedBase}/**` : normalizedBase;
}

function trimTrailingSlash(root: string): string {
  if (root.length > 1 && root.endsWith("/")) {
    return root.slice(0, -1);
  }

  return root;
}

function envPolicyImplies(
  granted: SandboxProfile["envPolicy"],
  requested: SandboxProfile["envPolicy"]
): boolean {
  if (!granted.inheritProcessEnv && requested.inheritProcessEnv) {
    return false;
  }

  if (granted.inheritProcessEnv) {
    return true;
  }

  return requested.allowlist.every((key) => granted.allowlist.includes(key));
}

function stableStringifyProviderObject(input: unknown): string {
  if (input === undefined) {
    return "null";
  }

  if (input === null || typeof input !== "object") {
    return JSON.stringify(input) ?? "null";
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringifyProviderObject(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();

  return `{${keys.map((key) => (
    `${JSON.stringify(key)}:${stableStringifyProviderObject(record[key])}`
  )).join(",")}}`;
}
