import { createHash } from "node:crypto";
import { z } from "zod";

export const KernelTimestampSchema = z.string().min(1);

export const PrincipalKindSchema = z.enum(["user", "agent", "service", "system"]);

export const PrincipalSchema = z.object({
  schemaVersion: z.literal("principal.v1").default("principal.v1"),
  principalId: z.string().min(1),
  kind: PrincipalKindSchema,
  displayName: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
  createdAt: KernelTimestampSchema
});

export const CapabilityAccessSchema = z.enum([
  "read",
  "write",
  "execute",
  "admin"
]);

export const CapabilityScopeKindSchema = z.enum([
  "file",
  "tool",
  "network",
  "secret",
  "process",
  "external"
]);

export const CapabilityScopeSchema = z.object({
  schemaVersion: z.literal("capability-scope.v1").default("capability-scope.v1"),
  kind: CapabilityScopeKindSchema,
  resource: z.string().min(1),
  access: CapabilityAccessSchema,
  constraints: z.record(z.string(), z.unknown()).default({})
}).superRefine((scope, ctx) => {
  if (scope.kind === "secret" && scope.access !== "read") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "secret scopes only support read access",
      path: ["access"]
    });
  }

  if (scope.kind === "external" && scope.access === "read") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "external scopes must describe side-effectful access",
      path: ["access"]
    });
  }
});

export const CapabilityGrantSchema = z.object({
  schemaVersion: z.literal("capability-grant.v1").default("capability-grant.v1"),
  grantId: z.string().min(1),
  principalId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  scopes: z.array(CapabilityScopeSchema).default([]),
  issuedAt: KernelTimestampSchema,
  expiresAt: KernelTimestampSchema.optional(),
  revokedAt: KernelTimestampSchema.optional(),
  reason: z.string().min(1).optional()
});

export const SandboxProfileSchema = z.object({
  schemaVersion: z.literal("sandbox-profile.v1").default("sandbox-profile.v1"),
  sandboxId: z.string().min(1),
  mode: z.enum(["read-only", "workspace-write", "danger-full-access"]),
  networkAccess: z.enum(["none", "restricted", "full"]).default("none"),
  writableRoots: z.array(z.string().min(1)).default([]),
  envPolicy: z.object({
    inheritProcessEnv: z.boolean().default(false),
    allowlist: z.array(z.string().min(1)).default([])
  }).default({ inheritProcessEnv: false, allowlist: [] })
}).superRefine((profile, ctx) => {
  if (profile.mode === "read-only" && profile.writableRoots.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "read-only sandbox cannot declare writable roots",
      path: ["writableRoots"]
    });
  }
});

export const TaskHintProvenanceSchema = z.object({
  field: z.enum(["taskClass", "riskHints", "tags"]),
  value: z.string().min(1),
  source: z.enum(["user", "agent", "system", "policy", "memory", "legacy", "unknown"]).default("unknown"),
  reason: z.string().min(1).optional(),
  createdAt: KernelTimestampSchema.optional()
});

export const TaskSchema = z.object({
  schemaVersion: z.literal("kernel-task.v1").default("kernel-task.v1"),
  taskId: z.string().min(1),
  source: z.enum(["desktop-thread", "desktop-automation", "cli", "api"]).default("desktop-thread"),
  title: z.string().min(1),
  requestedAction: z.string().min(1),
  successCriteria: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  intent: z.object({
    summary: z.string().min(1),
    requestedAction: z.string().min(1),
    successCriteria: z.array(z.string()).default([]),
    outOfScope: z.array(z.string()).default([])
  }).optional(),
  createdBy: PrincipalSchema.optional(),
  repo: z.object({
    root: z.string().min(1).optional(),
    branch: z.string().min(1).optional(),
    worktreeClean: z.boolean().optional(),
    protectedBranch: z.boolean().optional()
  }).default({}),
  workspace: z.object({
    root: z.string().min(1).optional(),
    branch: z.string().min(1).optional(),
    worktreeClean: z.boolean().optional(),
    protectedBranch: z.boolean().optional()
  }).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  target: z.object({
    branches: z.array(z.string()).default([]),
    files: z.array(z.string()).default([]),
    modules: z.array(z.string()).default([])
  }).default({ branches: [], files: [], modules: [] }),
  hints: z.object({
    taskClass: z.string().min(1).optional(),
    riskHints: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    provenance: z.array(TaskHintProvenanceSchema).default([])
  }).default({ riskHints: [], tags: [] }),
  constraints: z.record(z.string(), z.unknown()).default({}),
  metadata: z.object({
    legacySource: z.string().min(1).optional(),
    legacyHints: z.record(z.string(), z.unknown()).optional(),
    legacy: z.record(z.string(), z.unknown()).optional()
  }).optional(),
  createdAt: KernelTimestampSchema
});

export const AgentManifestSchema = z.object({
  schemaVersion: z.literal("agent-manifest.v1").default("agent-manifest.v1"),
  agentId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  principal: PrincipalSchema,
  description: z.string().min(1).optional(),
  capabilities: z.array(CapabilityScopeSchema).default([]),
  defaultSandbox: SandboxProfileSchema.optional(),
  maxConcurrentRuns: z.number().int().positive().default(1),
  createdAt: KernelTimestampSchema
});

export const RunStatusSchema = z.enum([
  "queued",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "cancelled"
]);

export const RunSchema = z.object({
  schemaVersion: z.literal("kernel-run.v1").default("kernel-run.v1"),
  runId: z.string().min(1),
  taskId: z.string().min(1),
  status: RunStatusSchema.default("queued"),
  policyDecisionId: z.string().min(1).optional(),
  metadata: z.object({
    legacy: z.record(z.string(), z.unknown()).optional()
  }).optional(),
  createdAt: KernelTimestampSchema,
  updatedAt: KernelTimestampSchema,
  completedAt: KernelTimestampSchema.optional()
});

export const StepStatusSchema = z.enum([
  "pending",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "skipped",
  "cancelled"
]);

export const StepSchema = z.object({
  schemaVersion: z.literal("kernel-step.v1").default("kernel-step.v1"),
  stepId: z.string().min(1),
  runId: z.string().min(1),
  taskId: z.string().min(1),
  kind: z.enum(["tool", "executor", "approval", "checkpoint", "system"]),
  status: StepStatusSchema.default("pending"),
  dependsOn: z.array(z.string()).default([]),
  createdAt: KernelTimestampSchema,
  updatedAt: KernelTimestampSchema,
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).optional()
});

export const PolicyDecisionSchema = z.object({
  schemaVersion: z.literal("policy-decision.v1").default("policy-decision.v1"),
  decisionId: z.string().min(1),
  taskId: z.string().min(1),
  policyVersion: z.string().min(1),
  classification: z.object({
    taskClass: z.enum([
      "read_only",
      "small_edit",
      "engineering",
      "high_risk",
      "release_external_action"
    ]),
    riskLevel: z.enum(["low", "medium", "high"]),
    ambiguityScore: z.number().min(0).max(1),
    clarificationRequired: z.boolean(),
    riskFactors: z.array(z.string()).default([])
  }).optional(),
  risk: z.object({
    level: z.enum(["low", "medium", "high", "critical"]),
    factors: z.array(z.string()).default([]),
    ambiguityScore: z.number().min(0).max(1).default(0),
    clarificationRequired: z.boolean().default(false)
  }),
  execution: z.object({
    executor: z.string().min(1),
    model: z.string().min(1).optional(),
    profile: z.string().min(1).optional(),
    reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
    sandbox: SandboxProfileSchema
  }),
  capabilities: z.array(CapabilityScopeSchema).default([]),
  approval: z.object({
    required: z.boolean(),
    reasons: z.array(z.string()).default([])
  }),
  parallelism: z.object({
    allowed: z.boolean().default(false),
    maxAgents: z.number().int().positive().default(1),
    mode: z.string().min(1).default("disabled")
  }).default({ allowed: false, maxAgents: 1, mode: "disabled" }),
  hostRoute: z.enum(["desktop", "codex-cli"]).optional(),
  metadata: z.object({
    legacy: z.record(z.string(), z.unknown()).optional()
  }).optional(),
  createdAt: KernelTimestampSchema,
  legacy: z.object({
    routingDecisionId: z.string().min(1).optional(),
    taskClass: z.string().min(1).optional(),
    toolAccess: z.string().min(1).optional()
  }).default({})
});

export const ApprovalPermitSchema = z.object({
  schemaVersion: z.literal("approval-permit.v1").default("approval-permit.v1"),
  permitId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1),
  principalId: z.string().min(1).optional(),
  approverId: z.string().min(1).optional(),
  decisionHash: z.string().min(1),
  policyDecisionHash: z.string().min(1).optional(),
  planHash: z.string().min(1),
  approvedBy: PrincipalSchema,
  scopes: z.array(CapabilityScopeSchema).min(1),
  capabilityScopes: z.array(z.string().min(1)).default([]),
  issuedAt: KernelTimestampSchema,
  createdAt: KernelTimestampSchema.optional(),
  expiresAt: KernelTimestampSchema,
  revokedAt: KernelTimestampSchema.optional(),
  revokedReason: z.string().min(1).optional(),
  signature: z.string().min(1).optional(),
  reason: z.string().min(1).optional()
});

export const ToolManifestSchema = z.object({
  schemaVersion: z.literal("tool-manifest.v1").default("tool-manifest.v1"),
  toolId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1).optional(),
  requiredScopes: z.array(CapabilityScopeSchema).default([]),
  sideEffectLevel: z.enum(["none", "local", "external"]).default("none"),
  inputSchema: z.record(z.string(), z.unknown()).default({}),
  outputSchema: z.record(z.string(), z.unknown()).default({})
});

export const ToolInvocationSchema = z.object({
  schemaVersion: z.literal("tool-invocation.v1").default("tool-invocation.v1"),
  invocationId: z.string().min(1),
  toolId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1),
  stepId: z.string().min(1),
  principalId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
  requestedScopes: z.array(CapabilityScopeSchema).default([]),
  createdAt: KernelTimestampSchema
});

export const ArtifactSchema = z.object({
  schemaVersion: z.literal("artifact.v1").default("artifact.v1"),
  artifactId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1).optional(),
  kind: z.enum(["file", "log", "patch", "evidence", "checkpoint", "other"]),
  uri: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: KernelTimestampSchema,
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const EventSchema = z.object({
  schemaVersion: z.literal("kernel-event.v1").default("kernel-event.v1"),
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  taskId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  stepId: z.string().min(1).optional(),
  principalId: z.string().min(1).optional(),
  createdAt: KernelTimestampSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  prevHash: z.string().min(1).optional(),
  hash: z.string().min(1).optional()
});

export const ExecutionLeaseSchema = z.object({
  schemaVersion: z.literal("execution-lease.v1").default("execution-lease.v1"),
  leaseId: z.string().min(1),
  runId: z.string().min(1),
  workerId: z.string().min(1),
  acquiredAt: KernelTimestampSchema,
  expiresAt: KernelTimestampSchema,
  heartbeatAt: KernelTimestampSchema.optional(),
  releasedAt: KernelTimestampSchema.optional()
});

export function parsePrincipal(input: z.input<typeof PrincipalSchema>): Principal {
  return PrincipalSchema.parse(input);
}

export function parseTask(input: z.input<typeof TaskSchema>): Task {
  return TaskSchema.parse(input);
}

export function parsePolicyDecision(input: z.input<typeof PolicyDecisionSchema>): PolicyDecision {
  return PolicyDecisionSchema.parse(input);
}

export function parseCapabilityScope(
  input: z.input<typeof CapabilityScopeSchema>
): CapabilityScope {
  return CapabilityScopeSchema.parse(input);
}

export function parseApprovalPermit(
  input: z.input<typeof ApprovalPermitSchema>
): ApprovalPermit {
  return ApprovalPermitSchema.parse(input);
}

export function hashKernelObject(input: unknown): string {
  return createHash("sha256")
    .update(stableStringifyKernelObject(input))
    .digest("hex");
}

function stableStringifyKernelObject(input: unknown): string {
  if (input === undefined) {
    return "null";
  }

  if (input === null || typeof input !== "object") {
    return JSON.stringify(input) ?? "null";
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringifyKernelObject(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();

  return `{${keys.map((key) => (
    `${JSON.stringify(key)}:${stableStringifyKernelObject(record[key])}`
  )).join(",")}}`;
}

export type KernelTimestamp = z.infer<typeof KernelTimestampSchema>;
export type PrincipalKind = z.infer<typeof PrincipalKindSchema>;
export type Principal = z.infer<typeof PrincipalSchema>;
export type CapabilityAccess = z.infer<typeof CapabilityAccessSchema>;
export type CapabilityScopeKind = z.infer<typeof CapabilityScopeKindSchema>;
export type CapabilityScope = z.infer<typeof CapabilityScopeSchema>;
export type CapabilityGrant = z.infer<typeof CapabilityGrantSchema>;
export type SandboxProfile = z.infer<typeof SandboxProfileSchema>;
export type TaskHintProvenance = z.infer<typeof TaskHintProvenanceSchema>;
export type AgentManifest = z.infer<typeof AgentManifestSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type Run = z.infer<typeof RunSchema>;
export type StepStatus = z.infer<typeof StepStatusSchema>;
export type Step = z.infer<typeof StepSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type ApprovalPermit = z.infer<typeof ApprovalPermitSchema>;
export type ToolManifest = z.infer<typeof ToolManifestSchema>;
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type Event = z.infer<typeof EventSchema>;
export type ExecutionLease = z.infer<typeof ExecutionLeaseSchema>;

export * from "./codex-governance.js";
export * from "./legacy-adapter.js";
