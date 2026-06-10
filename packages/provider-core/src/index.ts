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
export type ProviderPlanBase = z.infer<typeof ProviderPlanBaseSchema>;
export type ExecutorExecutionPlan = z.infer<typeof ExecutorExecutionPlanSchema>;
export type ToolProviderInvocationPlan = z.infer<typeof ToolProviderInvocationPlanSchema>;

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
