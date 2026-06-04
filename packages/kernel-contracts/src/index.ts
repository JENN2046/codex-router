import { createHash } from "node:crypto";
import { z } from "zod";
import {
  parseRoutingDecision,
  parseTaskEnvelope,
  type RoutingDecision,
  type RoutingDecisionInput,
  type TaskEnvelope,
  type TaskEnvelopeInput,
  type ToolAccessLevel
} from "../../contracts/src/index.js";

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

export const TaskSchema = z.object({
  schemaVersion: z.literal("kernel-task.v1").default("kernel-task.v1"),
  taskId: z.string().min(1),
  source: z.enum(["desktop-thread", "desktop-automation", "cli", "api"]).default("desktop-thread"),
  title: z.string().min(1),
  requestedAction: z.string().min(1),
  successCriteria: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  createdBy: PrincipalSchema.optional(),
  repo: z.object({
    root: z.string().min(1).optional(),
    branch: z.string().min(1).optional(),
    worktreeClean: z.boolean().optional(),
    protectedBranch: z.boolean().optional()
  }).default({}),
  target: z.object({
    branches: z.array(z.string()).default([]),
    files: z.array(z.string()).default([]),
    modules: z.array(z.string()).default([])
  }).default({ branches: [], files: [], modules: [] }),
  hints: z.object({
    taskClass: z.string().min(1).optional(),
    riskHints: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([])
  }).default({ riskHints: [], tags: [] }),
  constraints: z.record(z.string(), z.unknown()).default({}),
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
  decisionHash: z.string().min(1),
  planHash: z.string().min(1),
  approvedBy: PrincipalSchema,
  scopes: z.array(CapabilityScopeSchema).min(1),
  issuedAt: KernelTimestampSchema,
  expiresAt: KernelTimestampSchema,
  revokedAt: KernelTimestampSchema.optional(),
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

export function createTaskFromLegacyTaskEnvelope(
  input: TaskEnvelope | TaskEnvelopeInput,
  options: { createdAt?: string; createdBy?: Principal } = {}
): Task {
  const legacy = parseTaskEnvelope(input);
  return TaskSchema.parse({
    taskId: legacy.taskId,
    source: legacy.source,
    title: legacy.intent.summary,
    requestedAction: legacy.intent.requestedAction,
    successCriteria: legacy.intent.successCriteria,
    outOfScope: legacy.intent.outOfScope,
    ...(options.createdBy ? { createdBy: options.createdBy } : {}),
    repo: {
      root: legacy.repoContext.repoRoot,
      branch: legacy.repoContext.branch,
      worktreeClean: legacy.repoContext.worktreeClean,
      protectedBranch: legacy.repoContext.protectedBranch
    },
    target: legacy.target,
    hints: {
      taskClass: legacy.hints.taskClassHint,
      riskHints: legacy.hints.riskHints,
      tags: legacy.hints.tags
    },
    constraints: legacy.constraints,
    createdAt: options.createdAt ?? "1970-01-01T00:00:00.000Z"
  });
}

export function createPolicyDecisionFromLegacyRoutingDecision(
  input: RoutingDecision | RoutingDecisionInput,
  options: { createdAt?: string } = {}
): PolicyDecision {
  const legacy = parseRoutingDecision(input);
  const sandbox = createSandboxProfileFromToolAccess(legacy.execution.toolAccess);

  return PolicyDecisionSchema.parse({
    decisionId: legacy.decisionId,
    taskId: legacy.taskId,
    policyVersion: legacy.policyVersion,
    risk: {
      level: legacy.classification.taskClass === "release_external_action"
        ? "critical"
        : legacy.classification.riskLevel,
      factors: legacy.classification.riskFactors,
      ambiguityScore: legacy.classification.ambiguityScore,
      clarificationRequired: legacy.classification.clarificationRequired
    },
    execution: {
      executor: legacy.hostRoute === "codex-cli" ? "codex-cli" : "codex-desktop",
      model: legacy.execution.selectedModel,
      profile: legacy.execution.executionProfile,
      reasoningEffort: legacy.execution.reasoningEffort,
      sandbox
    },
    capabilities: createCapabilityScopesFromToolAccess(legacy.execution.toolAccess),
    approval: legacy.approval,
    parallelism: legacy.parallelism,
    createdAt: options.createdAt ?? "1970-01-01T00:00:00.000Z",
    legacy: {
      routingDecisionId: legacy.decisionId,
      taskClass: legacy.classification.taskClass,
      toolAccess: legacy.execution.toolAccess
    }
  });
}

export function hashKernelObject(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

function createSandboxProfileFromToolAccess(toolAccess: ToolAccessLevel): SandboxProfile {
  if (toolAccess === "read_only") {
    return SandboxProfileSchema.parse({
      sandboxId: "legacy-read-only",
      mode: "read-only"
    });
  }

  return SandboxProfileSchema.parse({
    sandboxId: "legacy-workspace-write",
    mode: "workspace-write",
    writableRoots: ["workspace"]
  });
}

function createCapabilityScopesFromToolAccess(toolAccess: ToolAccessLevel): CapabilityScope[] {
  switch (toolAccess) {
    case "read_only":
      return [
        CapabilityScopeSchema.parse({
          kind: "file",
          resource: "workspace/**",
          access: "read"
        })
      ];
    case "local_write":
      return [
        CapabilityScopeSchema.parse({
          kind: "file",
          resource: "workspace/**",
          access: "read"
        }),
        CapabilityScopeSchema.parse({
          kind: "file",
          resource: "workspace/**",
          access: "write"
        })
      ];
    case "engineering_write":
      return [
        CapabilityScopeSchema.parse({
          kind: "file",
          resource: "workspace/**",
          access: "write"
        }),
        CapabilityScopeSchema.parse({
          kind: "tool",
          resource: "shell_command",
          access: "execute"
        }),
        CapabilityScopeSchema.parse({
          kind: "tool",
          resource: "apply_patch",
          access: "execute"
        })
      ];
    case "protected_remote":
      return [
        CapabilityScopeSchema.parse({
          kind: "external",
          resource: "protected_remote",
          access: "write"
        })
      ];
  }
}

export type KernelTimestamp = z.infer<typeof KernelTimestampSchema>;
export type PrincipalKind = z.infer<typeof PrincipalKindSchema>;
export type Principal = z.infer<typeof PrincipalSchema>;
export type CapabilityAccess = z.infer<typeof CapabilityAccessSchema>;
export type CapabilityScopeKind = z.infer<typeof CapabilityScopeKindSchema>;
export type CapabilityScope = z.infer<typeof CapabilityScopeSchema>;
export type CapabilityGrant = z.infer<typeof CapabilityGrantSchema>;
export type SandboxProfile = z.infer<typeof SandboxProfileSchema>;
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

