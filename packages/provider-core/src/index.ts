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
  runId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  providerId: z.string().min(1),
  providerManifestHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  policyDecisionHash: z.string().min(1).optional(),
  sideEffectClass: ProviderSideEffectClassSchema,
  sandboxProfileId: z.string().min(1),
  status: z.enum(["candidate", "approved", "blocked"]),
  approvalStatus: z.enum([
    "not_required",
    "approved",
    "pending",
    "rejected",
    "expired"
  ]).optional(),
  reasons: z.array(z.string()).default([]),
  issuedAt: z.string().min(1)
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

export type ProviderExecutionPermitValidationOptions = {
  reasonPrefix?: string;
};

export type ExecutionPlanInput = {
  task: Task;
  run: Run;
  policyDecision: PolicyDecision;
  sandboxProfile: SandboxProfile;
  inputHash?: string;
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

  if (permit.sandboxProfileId !== plan.sandboxProfile.sandboxId) {
    reasons.push(`${prefix}_sandbox_mismatch:${permit.sandboxProfileId}:${plan.sandboxProfile.sandboxId}`);
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

  return uniqueProviderCoreStrings(reasons);
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

export function hashProviderManifest(manifest: ProviderManifest): string {
  return createHash("sha256")
    .update(stableStringifyProviderObject(ProviderManifestSchema.parse(manifest)))
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

  return ProviderExecutionPermitSchema.parse({
    schemaVersion: "provider-execution-permit.v1",
    permitId: input.permitId ?? `permit_${plan.planId}`,
    taskId: plan.taskId,
    runId: plan.runId,
    planId: plan.planId,
    providerId: plan.providerId,
    providerManifestHash: hashProviderManifest(manifest),
    ...(plan.policyDecisionHash !== undefined
      ? { policyDecisionHash: plan.policyDecisionHash }
      : {}),
    sideEffectClass: plan.sideEffectClass,
    sandboxProfileId: plan.sandboxProfile.sandboxId,
    status,
    approvalStatus,
    reasons,
    issuedAt: input.issuedAt
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

  return uniqueProviderCoreStrings(reasons);
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

function getWorkspaceWriteProviderExecutionPermitGovernanceBlockers(
  input: Pick<
    WorkspaceWriteProviderExecutionPermit,
    | "targetFiles"
    | "maxChangedFiles"
    | "rollbackRequired"
    | "protectedBranchForbidden"
    | "dirtyWorktreeForbidden"
    | "repositoryState"
  >
): string[] {
  const reasons: string[] = [];
  const targetFiles = uniqueProviderCoreStrings(input.targetFiles);

  if (targetFiles.length === 0) {
    reasons.push("workspace_write_provider_execution_permit_target_files_required");
  }

  if (targetFiles.length > input.maxChangedFiles) {
    reasons.push("workspace_write_provider_execution_permit_target_file_count_exceeds_max");
  }

  if (targetFiles.some((targetFile) => !isSafeWorkspaceRelativeFilePath(targetFile))) {
    reasons.push("workspace_write_provider_execution_permit_target_file_out_of_bounds");
  }

  if (!input.rollbackRequired) {
    reasons.push("workspace_write_provider_execution_permit_rollback_required");
  }

  if (!input.protectedBranchForbidden || input.repositoryState.protectedBranch) {
    reasons.push("workspace_write_provider_execution_permit_protected_branch_forbidden");
  }

  if (!input.dirtyWorktreeForbidden || !input.repositoryState.worktreeClean) {
    reasons.push("workspace_write_provider_execution_permit_dirty_worktree_forbidden");
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
