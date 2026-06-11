import { z } from "zod";

export const TaskClassSchema = z.enum([
  "read_only",
  "small_edit",
  "engineering",
  "high_risk",
  "release_external_action"
]);

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);

export const ModelIdSchema = z.enum([
  "gpt-5.4-mini",
  "gpt-5.4",
  "gpt-5.3-codex-spark",
  "gpt-5.3-codex",
  "gpt-5.1-codex-max"
]);

export const ToolAccessLevelSchema = z.enum([
  "read_only",
  "local_write",
  "engineering_write",
  "protected_remote"
]);

export const ExecutionProfileNameSchema = z.enum([
  "recon-only",
  "clarify-then-plan",
  "engineering",
  "high-risk-change",
  "release-governance"
]);

export const ApprovalStatusSchema = z.enum([
  "not_required",
  "pending",
  "approved",
  "rejected",
  "expired"
]);

export const RolloutModeSchema = z.enum([
  "desktop-first",
  "shadow",
  "enforced-local",
  "protected-remote"
]);

export const ReasoningEffortSchema = z.enum(["low", "medium", "high"]);

export const RuntimeEventTypeSchema = z.enum([
  "attempt_failed",
  "attempt_succeeded",
  "scope_expanded",
  "context_pressure",
  "validation_failed",
  "validation_passed",
  "risk_detected"
]);

export const AgentRoleSchema = z.enum([
  "analyst",
  "architect",
  "worker",
  "reviewer"
]);

export const DesktopPrimitiveSchema = z.enum([
  "spawn_agent",
  "send_input",
  "wait_agent",
  "close_agent",
  "automation_update",
  "shell_command",
  "apply_patch",
  "read_thread_terminal"
]);

export const EnvelopeSourceSchema = z.enum([
  "desktop-thread",
  "desktop-automation",
  "cli",
  "api"
]);

export const HostRouteSchema = z.enum([
  "desktop",
  "codex-cli"
]);

export const ParallelismModeSchema = z.enum([
  "disabled",
  "read_only",
  "owned_write"
]);

export const RepoContextSchema = z.object({
  repoRoot: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  worktreeClean: z.boolean().optional(),
  protectedBranch: z.boolean().optional()
});

export const TaskIntentSchema = z.object({
  summary: z.string().min(1),
  requestedAction: z.string().min(1),
  successCriteria: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([])
});

export const TaskTargetSchema = z.object({
  branches: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  modules: z.array(z.string()).default([])
});

export const TaskConstraintsSchema = z.object({
  requiresNetwork: z.boolean().optional(),
  explicitOwnership: z.boolean().optional(),
  allowBackgroundAutomation: z.boolean().optional()
});

export const TaskHintsSchema = z.object({
  taskClassHint: TaskClassSchema.optional(),
  riskHints: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});

export const TaskEnvelopeSchema = z.object({
  schemaVersion: z.literal("task-envelope.v1").default("task-envelope.v1"),
  taskId: z.string().min(1),
  source: EnvelopeSourceSchema.default("desktop-thread"),
  intent: TaskIntentSchema,
  repoContext: RepoContextSchema.default({}),
  target: TaskTargetSchema.default({ branches: [], files: [], modules: [] }),
  constraints: TaskConstraintsSchema.default({}),
  hints: TaskHintsSchema.default({ riskHints: [], tags: [] })
});

export const IntentClassificationSchema = z.object({
  taskClass: TaskClassSchema,
  ambiguityScore: z.number().min(0).max(1),
  clarificationRequired: z.boolean(),
  ambiguityReasons: z.array(z.string()),
  recommendedProfile: ExecutionProfileNameSchema
});

export const RoutingDecisionSchema = z.object({
  schemaVersion: z.literal("routing-decision.v1").default("routing-decision.v1"),
  decisionId: z.string().min(1),
  taskId: z.string().min(1),
  policyVersion: z.string().min(1),
  classification: z.object({
    taskClass: TaskClassSchema,
    riskLevel: RiskLevelSchema,
    ambiguityScore: z.number().min(0).max(1),
    clarificationRequired: z.boolean(),
    riskFactors: z.array(z.string())
  }),
  execution: z.object({
    selectedModel: ModelIdSchema,
    toolAccess: ToolAccessLevelSchema,
    executionProfile: ExecutionProfileNameSchema,
    reasoningEffort: ReasoningEffortSchema
  }),
  approval: z.object({
    required: z.boolean(),
    reasons: z.array(z.string())
  }),
  parallelism: z.object({
    allowed: z.boolean(),
    maxAgents: z.number().int().positive(),
    mode: ParallelismModeSchema
  }),
  hostRoute: HostRouteSchema
});

export const ApprovalDecisionSchema = z.object({
  status: ApprovalStatusSchema,
  reasons: z.array(z.string()),
  gateId: z.string().optional()
});

export const RuntimeSignalSchema = z.object({
  taskId: z.string().min(1),
  eventType: RuntimeEventTypeSchema,
  failureCount: z.number().int().nonnegative().default(0),
  contextPressure: z.number().min(0).max(1).optional(),
  details: z.array(z.string()).default([])
});

export const CheckpointRefSchema = z.object({
  checkpointId: z.string().min(1),
  taskId: z.string().min(1),
  stage: z.string().min(1),
  createdAt: z.string().min(1),
  summary: z.string().min(1)
});

export const DesktopOperationSchema = z.object({
  primitive: DesktopPrimitiveSchema,
  reason: z.string().min(1)
});

export const DesktopExecutionPlanSchema = z.object({
  executionProfile: ExecutionProfileNameSchema,
  primitives: z.array(DesktopOperationSchema),
  notes: z.array(z.string())
});

export function parseTaskEnvelope(input: z.input<typeof TaskEnvelopeSchema>): TaskEnvelope {
  return TaskEnvelopeSchema.parse(input);
}

export function parseRoutingDecision(input: z.input<typeof RoutingDecisionSchema>): RoutingDecision {
  return RoutingDecisionSchema.parse(input);
}

export type TaskClass = z.infer<typeof TaskClassSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ModelId = z.infer<typeof ModelIdSchema>;
export type ToolAccessLevel = z.infer<typeof ToolAccessLevelSchema>;
export type ExecutionProfileName = z.infer<typeof ExecutionProfileNameSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type RolloutMode = z.infer<typeof RolloutModeSchema>;
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;
export type RuntimeEventType = z.infer<typeof RuntimeEventTypeSchema>;
export type AgentRole = z.infer<typeof AgentRoleSchema>;
export type DesktopPrimitive = z.infer<typeof DesktopPrimitiveSchema>;
export type EnvelopeSource = z.infer<typeof EnvelopeSourceSchema>;
export type ParallelismMode = z.infer<typeof ParallelismModeSchema>;
export type HostRoute = z.infer<typeof HostRouteSchema>;
export type RepoContext = z.infer<typeof RepoContextSchema>;
export type TaskIntent = z.infer<typeof TaskIntentSchema>;
export type TaskTarget = z.infer<typeof TaskTargetSchema>;
export type TaskConstraints = z.infer<typeof TaskConstraintsSchema>;
export type TaskHints = z.infer<typeof TaskHintsSchema>;
export type TaskEnvelopeInput = z.input<typeof TaskEnvelopeSchema>;
export type TaskEnvelope = z.infer<typeof TaskEnvelopeSchema>;
export type IntentClassification = z.infer<typeof IntentClassificationSchema>;
export type RoutingDecisionInput = z.input<typeof RoutingDecisionSchema>;
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type RuntimeSignal = z.infer<typeof RuntimeSignalSchema>;
export type CheckpointRef = z.infer<typeof CheckpointRefSchema>;
export type DesktopOperation = z.infer<typeof DesktopOperationSchema>;
export type DesktopExecutionPlan = z.infer<typeof DesktopExecutionPlanSchema>;
