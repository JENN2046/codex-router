import { z } from "zod";
import {
  hashKernelObject,
  type GovernedFileChangeKind
} from "../../kernel-contracts/src/index.js";
import {
  canonicalizeGovernedFileChangeSet,
  type GovernedFileChangeDraft
} from "../../file-change-preview/src/index.js";
import type {
  CodexAdapterOutcome,
  CodexAppServerAdapter,
  CodexAppServerApprovalResponse,
  CodexAppServerMessageTransport,
  CodexAppServerNormalizedEvent
} from "./index.js";
import {
  CodexAppServerPermissionGrantSchema as V2PermissionGrantSchema,
  CodexAppServerPermissionProfileSchema as V2PermissionProfileSchema,
  isPermissionGrantSubset
} from "./permission-profile.js";

const JsonRpcRequestIdSchema = z.union([
  z.string().min(1),
  z.number()
    .int()
    .finite()
    .refine(Number.isSafeInteger, "JSON-RPC numeric request ids must be safe integers")
]);

const TimestampMsSchema = z.number()
  .int()
  .finite()
  .nonnegative()
  .refine(Number.isSafeInteger, "timestamp must be a safe integer");

const MAX_V2_WIRE_JSON_DEPTH = 64;
const MAX_V2_WIRE_JSON_NODES = 50_000;
const MAX_V2_WIRE_JSON_TEXT_CODE_UNITS = 8 * 1024 * 1024;

type V2JsonValue =
  | null
  | boolean
  | number
  | string
  | V2JsonValue[]
  | { [key: string]: V2JsonValue };

const V2JsonValueSchema = z.custom<V2JsonValue>(
  (value) => inspectV2WireJsonValue(value).success,
  "value must be bounded JSON"
);

const FullGitObjectIdSchema = z.string().regex(
  /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/,
  "baseHead must be a full Git object id"
);

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const V2TraceContextSchema = z.object({
  traceparent: z.string().optional(),
  tracestate: z.string().optional()
}).strict();

const V2FileChangeKindSchema = z.union([
  z.object({ type: z.literal("add") }).strict(),
  z.object({ type: z.literal("delete") }).strict(),
  z.object({
    type: z.literal("update"),
    move_path: z.string().nullable().optional()
  }).strict()
]);

const V2FileChangeSchema = z.object({
  diff: z.string().min(1),
  kind: V2FileChangeKindSchema,
  path: z.string().min(1)
}).strict();

const V2CommandActionSchema = z.union([
  z.object({
    command: z.string().min(1),
    name: z.string().min(1),
    path: z.string().min(1),
    type: z.literal("read")
  }).strict(),
  z.object({
    command: z.string().min(1),
    path: z.string().nullable().optional(),
    type: z.literal("listFiles")
  }).strict(),
  z.object({
    command: z.string().min(1),
    path: z.string().nullable().optional(),
    query: z.string().nullable().optional(),
    type: z.literal("search")
  }).strict(),
  z.object({
    command: z.string().min(1),
    type: z.literal("unknown")
  }).strict()
]);

const V2NetworkApprovalContextSchema = z.object({
  host: z.string(),
  protocol: z.enum(["http", "https", "socks5Tcp", "socks5Udp"])
}).strict();

const V2NetworkPolicyAmendmentSchema = z.object({
  action: z.enum(["allow", "deny"]),
  host: z.string()
}).strict();

export const CodexAppServerV2FileChangeItemSchema = z.object({
  changes: z.array(V2FileChangeSchema).min(1),
  id: z.string().min(1),
  status: z.enum(["inProgress", "completed", "failed", "declined"]),
  type: z.literal("fileChange")
}).strict();

const V2NonFileLifecycleItemTypeSchema = z.enum([
  "userMessage",
  "hookPrompt",
  "agentMessage",
  "plan",
  "reasoning",
  "commandExecution",
  "mcpToolCall",
  "dynamicToolCall",
  "collabToolCall",
  "collabAgentToolCall",
  "subAgentActivity",
  "webSearch",
  "imageView",
  "sleep",
  "imageGeneration",
  "enteredReviewMode",
  "exitedReviewMode",
  "contextCompaction"
]);

/**
 * App Server emits item lifecycle notifications for every known ThreadItem,
 * not only file changes. Keep an explicit non-file type allowlist so ordinary
 * progress cannot quarantine a session, while unknown future item types still
 * fail closed as schema drift. Non-file payload details are not governance
 * inputs and are therefore intentionally ignored after the type/id boundary.
 */
const V2NonFileLifecycleItemSchema = z.object({
  id: z.string().min(1),
  type: V2NonFileLifecycleItemTypeSchema
}).passthrough();

const V2LifecycleItemSchema = z.union([
  CodexAppServerV2FileChangeItemSchema,
  V2NonFileLifecycleItemSchema
]);

const V2ItemStartedParamsSchema = z.object({
  item: V2LifecycleItemSchema,
  startedAtMs: TimestampMsSchema,
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2ItemCompletedParamsSchema = z.object({
  completedAtMs: TimestampMsSchema,
  item: V2LifecycleItemSchema,
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

type V2FileChangeItem = z.infer<typeof CodexAppServerV2FileChangeItemSchema>;
type V2ItemStartedParams = z.infer<typeof V2ItemStartedParamsSchema>;
type V2ItemCompletedParams = z.infer<typeof V2ItemCompletedParamsSchema>;
type V2FileChangeItemStartedParams = Omit<V2ItemStartedParams, "item"> & {
  item: V2FileChangeItem;
};
type V2FileChangeItemCompletedParams = Omit<V2ItemCompletedParams, "item"> & {
  item: V2FileChangeItem;
};

export const CodexAppServerV2FileChangeApprovalParamsSchema = z.object({
  grantRoot: z.string().min(1).nullable().optional(),
  itemId: z.string().min(1),
  reason: z.string().nullable().optional(),
  // The README's approval payloads omit this lifecycle timestamp. Accept it
  // when present for compatibility, but never use it as authorization input.
  startedAtMs: TimestampMsSchema.optional(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2CommandExecutionApprovalParamsSchema = z.object({
  approvalId: z.string().nullable().optional(),
  additionalPermissions: V2PermissionProfileSchema.nullable().optional(),
  availableDecisions: z.array(z.enum([
    "accept",
    "acceptForSession",
    "acceptWithExecpolicyAmendment",
    "applyNetworkPolicyAmendment",
    "decline",
    "cancel"
  ])).nullable().optional(),
  command: z.string().min(1).nullable().optional(),
  commandActions: z.array(V2CommandActionSchema).nullable().optional(),
  cwd: z.string().min(1).nullable().optional(),
  environmentId: z.string().min(1).nullable().optional(),
  itemId: z.string().min(1),
  networkApprovalContext: V2NetworkApprovalContextSchema.nullable().optional(),
  proposedExecpolicyAmendment: z.array(z.string()).nullable().optional(),
  proposedNetworkPolicyAmendments: z.array(V2NetworkPolicyAmendmentSchema)
    .nullable()
    .optional(),
  reason: z.string().nullable().optional(),
  // Older and documented approval payloads may omit this lifecycle timestamp.
  startedAtMs: TimestampMsSchema.optional(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2PermissionsApprovalParamsSchema = z.object({
  cwd: z.string().min(1),
  environmentId: z.string().min(1).nullable().optional(),
  itemId: z.string().min(1),
  permissions: V2PermissionProfileSchema,
  reason: z.string().nullable().optional(),
  // Keep approval parsing compatible with payloads that only carry the
  // documented correlation and permission fields.
  startedAtMs: TimestampMsSchema.optional(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2ServerRequestResolvedParamsSchema = z.object({
  requestId: JsonRpcRequestIdSchema,
  threadId: z.string().min(1)
}).strict();

const V2TurnDiffUpdatedParamsSchema = z.object({
  diff: z.string(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2ThreadStartedParamsSchema = z.object({
  thread: z.record(z.unknown())
}).strict();

const V2ThreadStatusSchema = z.union([
  z.object({ type: z.literal("notLoaded") }).strict(),
  z.object({ type: z.literal("idle") }).strict(),
  z.object({ type: z.literal("systemError") }).strict(),
  z.object({
    activeFlags: z.array(z.enum(["waitingOnApproval", "waitingOnUserInput"])),
    type: z.literal("active")
  }).strict()
]);

const V2ThreadStatusChangedParamsSchema = z.object({
  status: V2ThreadStatusSchema,
  threadId: z.string().min(1)
}).strict();

const V2AskForApprovalSchema = z.union([
  z.enum(["untrusted", "on-request", "never"]),
  z.object({
    granular: z.object({
      mcp_elicitations: z.boolean(),
      request_permissions: z.boolean(),
      rules: z.boolean(),
      sandbox_approval: z.boolean(),
      skill_approval: z.boolean()
    }).strict()
  }).strict()
]);

const V2ThreadSandboxPolicySchema = z.union([
  z.object({ type: z.literal("dangerFullAccess") }).strict(),
  z.object({
    networkAccess: z.boolean(),
    type: z.literal("readOnly")
  }).strict(),
  z.object({
    networkAccess: z.enum(["restricted", "enabled"]),
    type: z.literal("externalSandbox")
  }).strict(),
  z.object({
    excludeSlashTmp: z.boolean(),
    excludeTmpdirEnvVar: z.boolean(),
    networkAccess: z.boolean(),
    type: z.literal("workspaceWrite"),
    writableRoots: z.array(z.string().min(1))
  }).strict()
]);

const V2MultiAgentModeSchema = z.union([
  z.enum(["explicitRequestOnly", "proactive"]),
  z.object({ custom: z.string() }).strict()
]);

const V2ThreadSettingsSchema = z.object({
  activePermissionProfile: z.object({
    extends: z.string().min(1).nullable(),
    id: z.string().min(1)
  }).strict().nullable(),
  approvalPolicy: V2AskForApprovalSchema,
  approvalsReviewer: z.enum(["user", "auto_review", "guardian_subagent"]),
  collaborationMode: z.object({
    mode: z.enum(["plan", "default"]),
    settings: z.object({
      developer_instructions: z.string().nullable(),
      model: z.string().min(1),
      reasoning_effort: z.string().min(1).nullable()
    }).strict()
  }).strict(),
  cwd: z.string().min(1),
  effort: z.string().min(1).nullable(),
  model: z.string().min(1),
  modelProvider: z.string().min(1),
  // This deprecated experimental field is omitted from the stable generated
  // TypeScript projection but may be present on experimental connections.
  multiAgentMode: V2MultiAgentModeSchema.optional(),
  personality: z.enum(["none", "friendly", "pragmatic"]).nullable(),
  sandboxPolicy: V2ThreadSandboxPolicySchema,
  serviceTier: z.string().min(1).nullable(),
  summary: z.enum(["auto", "concise", "detailed", "none"]).nullable()
}).strict();

const V2ThreadSettingsUpdatedParamsSchema = z.object({
  threadId: z.string().min(1),
  threadSettings: V2ThreadSettingsSchema
}).strict();

const V2ThreadClosedParamsSchema = z.object({
  threadId: z.string().min(1)
}).strict();

const V2TurnLifecycleParamsSchema = z.object({
  // The documented lifecycle notification is { turn }. Some protocol
  // snapshots also include threadId; it is not a governance input.
  threadId: z.string().min(1).optional(),
  turn: z.record(z.unknown())
}).strict();

const V2TurnPlanUpdatedParamsSchema = z.object({
  explanation: z.string().nullable().optional(),
  plan: z.array(z.object({
    status: z.enum(["pending", "inProgress", "completed"]),
    step: z.string()
  }).strict()),
  // The documented notification is scoped by turnId; some protocol snapshots
  // include threadId as extra correlation metadata.
  threadId: z.string().min(1).optional(),
  turnId: z.string().min(1)
}).strict();

const V2ModelSafetyBufferingUpdatedParamsSchema = z.object({
  fasterModel: z.string().nullable().optional(),
  model: z.string().min(1),
  reasons: z.array(z.string()),
  showBufferingUi: z.boolean(),
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  useCases: z.array(z.string())
}).strict();

const V2ModelReroutedParamsSchema = z.object({
  fromModel: z.string().min(1),
  reason: z.literal("highRiskCyberActivity"),
  threadId: z.string().min(1),
  toModel: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2TurnErrorSchema = z.object({
  additionalDetails: z.string().nullable().optional(),
  // Error metadata is diagnostic only and does not affect governance.
  codexErrorInfo: z.unknown().nullable().optional(),
  message: z.string().min(1)
}).strict();

const V2ErrorNotificationParamsSchema = z.union([
  // The Events/Errors documentation defines the notification with the same
  // error-only payload carried by a failed turn status.
  z.object({
    error: V2TurnErrorSchema
  }).strict(),
  // Generated protocol snapshots also expose correlation/retry metadata.
  // Accept that complete shape without accepting arbitrary partial variants.
  z.object({
    error: V2TurnErrorSchema,
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    willRetry: z.boolean()
  }).strict()
]);

const V2ThreadTokenUsageUpdatedParamsSchema = z.object({
  threadId: z.string().min(1),
  tokenUsage: z.record(z.unknown()),
  turnId: z.string().min(1)
}).strict();

const V2ModelVerificationParamsSchema = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  verifications: z.array(z.unknown())
}).strict();

const V2TurnModerationMetadataParamsSchema = z.object({
  metadata: z.unknown().refine((value) => value !== undefined, "metadata is required"),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2WarningNotificationParamsSchema = z.object({
  message: z.string().min(1),
  threadId: z.string().min(1).nullable().optional()
}).strict();

const V2GuardianWarningNotificationParamsSchema = z.object({
  message: z.string().min(1),
  threadId: z.string().min(1)
}).strict();

const V2DeprecationNoticeNotificationParamsSchema = z.object({
  details: z.string().nullable().optional(),
  summary: z.string().min(1)
}).strict();

const V2ConfigWarningNotificationParamsSchema = z.object({
  details: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  range: z.unknown().nullable().optional(),
  summary: z.string().min(1)
}).strict();

const V2McpServerStatusUpdatedParamsSchema = z.object({
  error: z.string().nullable().optional(),
  failureReason: z.literal("reauthenticationRequired").nullable().optional(),
  name: z.string().min(1),
  status: z.enum(["starting", "ready", "failed", "cancelled"]),
  threadId: z.string().min(1).nullable().optional()
}).strict();

const V2ContextCompactedParamsSchema = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2AutoApprovalReviewActionSchema = z.union([
  z.object({
    command: z.string(),
    cwd: z.string().min(1),
    source: z.enum(["shell", "unifiedExec"]),
    type: z.literal("command")
  }).strict(),
  z.object({
    argv: z.array(z.string()),
    cwd: z.string().min(1),
    program: z.string(),
    source: z.enum(["shell", "unifiedExec"]),
    type: z.literal("execve")
  }).strict(),
  z.object({
    cwd: z.string().min(1),
    files: z.array(z.string()),
    type: z.literal("applyPatch")
  }).strict(),
  z.object({
    host: z.string(),
    port: z.number().int().min(0).max(65535),
    protocol: z.enum(["http", "https", "socks5Tcp", "socks5Udp"]),
    target: z.string(),
    type: z.literal("networkAccess")
  }).strict(),
  z.object({
    connectorId: z.string().nullable().optional(),
    connectorName: z.string().nullable().optional(),
    server: z.string(),
    toolName: z.string(),
    toolTitle: z.string().nullable().optional(),
    type: z.literal("mcpToolCall")
  }).strict(),
  z.object({
    permissions: V2PermissionProfileSchema,
    reason: z.string().nullable().optional(),
    type: z.literal("requestPermissions")
  }).strict()
]);

const V2AutoApprovalReviewSchema = z.object({
  rationale: z.string().nullable().optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
  status: z.enum(["inProgress", "approved", "denied", "timedOut", "aborted"]),
  userAuthorization: z.enum(["unknown", "low", "medium", "high"])
    .nullable()
    .optional()
}).strict();

const V2AutoApprovalReviewStartedParamsSchema = z.object({
  action: V2AutoApprovalReviewActionSchema,
  review: V2AutoApprovalReviewSchema,
  reviewId: z.string().min(1),
  startedAtMs: TimestampMsSchema,
  targetItemId: z.string().min(1).nullable().optional(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2AutoApprovalReviewCompletedParamsSchema = z.object({
  action: V2AutoApprovalReviewActionSchema,
  completedAtMs: TimestampMsSchema,
  decisionSource: z.literal("agent"),
  review: V2AutoApprovalReviewSchema,
  reviewId: z.string().min(1),
  startedAtMs: TimestampMsSchema,
  targetItemId: z.string().min(1).nullable().optional(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2RemoteControlStatusParamsSchema = z.object({
  environmentId: z.string().min(1).nullable().optional(),
  // The startup disabled snapshot is documented without an installation id.
  // Active states remain quarantined below, so this compatibility widening
  // cannot grant remote-control capability.
  installationId: z.string().min(1).optional(),
  serverName: z.string().min(1),
  status: z.enum(["disabled", "connecting", "connected", "errored"])
}).strict();

const V2ProgressIndexSchema = z.number()
  .int()
  .finite()
  .nonnegative()
  .refine(Number.isSafeInteger, "progress index must be a safe integer");

const V2ItemProgressDeltaParamsSchema = z.object({
  delta: z.string(),
  itemId: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2CommandExecutionTerminalInteractionParamsSchema = z.object({
  itemId: z.string().min(1),
  processId: z.string().min(1),
  stdin: z.string(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2McpToolCallProgressParamsSchema = z.object({
  itemId: z.string().min(1),
  message: z.string(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2ReasoningSummaryTextDeltaParamsSchema = z.object({
  delta: z.string(),
  itemId: z.string().min(1),
  summaryIndex: V2ProgressIndexSchema,
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2ReasoningSummaryPartAddedParamsSchema = z.object({
  itemId: z.string().min(1),
  summaryIndex: V2ProgressIndexSchema,
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2ReasoningTextDeltaParamsSchema = z.object({
  contentIndex: V2ProgressIndexSchema,
  delta: z.string(),
  itemId: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2FileChangePatchUpdatedChangeSchema = z.object({
  diff: z.string(),
  kind: V2FileChangeKindSchema,
  path: z.string().min(1)
}).strict();

const V2FileChangePatchUpdatedParamsSchema = z.object({
  changes: z.array(V2FileChangePatchUpdatedChangeSchema),
  itemId: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2CurrentTimeReadParamsSchema = z.object({
  threadId: z.string().min(1)
}).strict();

const V2AttestationGenerateParamsSchema = z.object({}).strict();

const V2ChatGptAuthTokensRefreshParamsSchema = z.object({
  previousAccountId: z.string().min(1).nullable().optional(),
  reason: z.literal("unauthorized")
}).strict();

const V2DynamicToolCallParamsSchema = z.object({
  arguments: V2JsonValueSchema,
  callId: z.string().min(1),
  namespace: z.string().min(1).nullable().optional(),
  threadId: z.string().min(1),
  tool: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2ToolRequestUserInputOptionSchema = z.object({
  description: z.string(),
  label: z.string().min(1)
}).strict();

const V2ToolRequestUserInputQuestionSchema = z.object({
  header: z.string().min(1),
  id: z.string().min(1),
  isOther: z.boolean().optional(),
  isSecret: z.boolean().optional(),
  options: z.array(V2ToolRequestUserInputOptionSchema).nullable().optional(),
  question: z.string().min(1)
}).strict();

const V2ToolRequestUserInputParamsSchema = z.object({
  autoResolutionMs: z.number()
    .int()
    .finite()
    .nonnegative()
    .refine(Number.isSafeInteger, "autoResolutionMs must be a safe integer")
    .nullable()
    .optional(),
  itemId: z.string().min(1),
  questions: z.array(V2ToolRequestUserInputQuestionSchema).min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2McpElicitationStringSchema = z.object({
  default: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  format: z.enum(["email", "uri", "date", "date-time"]).nullable().optional(),
  maxLength: z.number().int().nonnegative().refine(Number.isSafeInteger).nullable().optional(),
  minLength: z.number().int().nonnegative().refine(Number.isSafeInteger).nullable().optional(),
  title: z.string().nullable().optional(),
  type: z.literal("string")
}).strict();

const V2McpElicitationNumberSchema = z.object({
  default: z.number().finite().nullable().optional(),
  description: z.string().nullable().optional(),
  maximum: z.number().finite().nullable().optional(),
  minimum: z.number().finite().nullable().optional(),
  title: z.string().nullable().optional(),
  type: z.enum(["number", "integer"])
}).strict();

const V2McpElicitationBooleanSchema = z.object({
  default: z.boolean().nullable().optional(),
  description: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  type: z.literal("boolean")
}).strict();

const V2McpUntitledStringEnumSchema = z.object({
  default: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  enum: z.array(z.string()).min(1),
  enumNames: z.array(z.string()).nullable().optional(),
  title: z.string().nullable().optional(),
  type: z.literal("string")
}).strict();

const V2McpTitledEnumValueSchema = z.object({
  const: z.string(),
  title: z.string()
}).strict();

const V2McpTitledStringEnumSchema = z.object({
  default: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  oneOf: z.array(V2McpTitledEnumValueSchema).min(1),
  title: z.string().nullable().optional(),
  type: z.literal("string")
}).strict();

const V2McpUntitledMultiSelectEnumSchema = z.object({
  default: z.array(z.string()).nullable().optional(),
  description: z.string().nullable().optional(),
  items: z.object({
    enum: z.array(z.string()).min(1),
    type: z.literal("string")
  }).strict(),
  maxItems: z.number().int().nonnegative().refine(Number.isSafeInteger).nullable().optional(),
  minItems: z.number().int().nonnegative().refine(Number.isSafeInteger).nullable().optional(),
  title: z.string().nullable().optional(),
  type: z.literal("array")
}).strict();

const V2McpTitledMultiSelectEnumSchema = z.object({
  default: z.array(z.string()).nullable().optional(),
  description: z.string().nullable().optional(),
  items: z.object({
    anyOf: z.array(V2McpTitledEnumValueSchema).min(1)
  }).strict(),
  maxItems: z.number().int().nonnegative().refine(Number.isSafeInteger).nullable().optional(),
  minItems: z.number().int().nonnegative().refine(Number.isSafeInteger).nullable().optional(),
  title: z.string().nullable().optional(),
  type: z.literal("array")
}).strict();

const V2McpElicitationPrimitiveSchema = z.union([
  V2McpElicitationStringSchema,
  V2McpElicitationNumberSchema,
  V2McpElicitationBooleanSchema,
  V2McpUntitledStringEnumSchema,
  V2McpTitledStringEnumSchema,
  V2McpUntitledMultiSelectEnumSchema,
  V2McpTitledMultiSelectEnumSchema
]);

const V2McpElicitationRequestedSchema = z.object({
  $schema: z.string().nullable().optional(),
  properties: z.record(V2McpElicitationPrimitiveSchema),
  required: z.array(z.string()).nullable().optional(),
  type: z.literal("object")
}).strict();

const V2McpElicitationCommonParams = {
  _meta: V2JsonValueSchema.nullable().optional(),
  // The generated protocol schema currently emits `_meta`, while the public
  // App Server README documents `meta` for MCP approval hints. Preserve either
  // spelling for the owning client; neither value is an authorization input.
  meta: V2JsonValueSchema.nullable().optional(),
  serverName: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1).nullable().optional()
};

const V2McpServerElicitationRequestParamsSchema = z.discriminatedUnion("mode", [
  z.object({
    ...V2McpElicitationCommonParams,
    message: z.string(),
    mode: z.literal("form"),
    requestedSchema: V2McpElicitationRequestedSchema
  }).strict(),
  z.object({
    ...V2McpElicitationCommonParams,
    message: z.string(),
    mode: z.literal("openai/form"),
    requestedSchema: V2JsonValueSchema
  }).strict(),
  z.object({
    ...V2McpElicitationCommonParams,
    elicitationId: z.string().min(1),
    message: z.string(),
    mode: z.literal("url"),
    url: z.string().min(1)
  }).strict()
]).superRefine((params, context) => {
  if (params.meta !== undefined && params._meta !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "meta and _meta cannot both be present",
      path: ["meta"]
    });
  }
});

const V2PassthroughServerRequestMethodSchema = z.enum([
  "item/tool/requestUserInput",
  "mcpServer/elicitation/request",
  "item/tool/call",
  "account/chatgptAuthTokens/refresh",
  "attestation/generate",
  "currentTime/read"
]);

const V2NonGovernanceNotificationMethodSchema = z.enum([
  "thread/settings/updated",
  "turn/plan/updated",
  "model/safetyBuffering/updated",
  "model/rerouted",
  "model/verification",
  "turn/moderationMetadata",
  "thread/tokenUsage/updated",
  "error",
  "warning",
  "guardianWarning",
  "deprecationNotice",
  "configWarning",
  "mcpServer/startupStatus/updated",
  "thread/compacted",
  "thread/closed"
]);

/**
 * These server notifications carry progress/diagnostic state only. Their
 * documented fields are checked before they are ignored; unknown methods and
 * malformed payloads still quarantine the session.
 */
const V2NonGovernanceNotificationSchema = z.union([
  z.object({
    method: z.literal("thread/settings/updated"),
    params: V2ThreadSettingsUpdatedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("turn/plan/updated"),
    params: V2TurnPlanUpdatedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("model/safetyBuffering/updated"),
    params: V2ModelSafetyBufferingUpdatedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("model/rerouted"),
    params: V2ModelReroutedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("model/verification"),
    params: V2ModelVerificationParamsSchema
  }).strict(),
  z.object({
    method: z.literal("turn/moderationMetadata"),
    params: V2TurnModerationMetadataParamsSchema
  }).strict(),
  z.object({
    method: z.literal("thread/tokenUsage/updated"),
    params: V2ThreadTokenUsageUpdatedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("error"),
    params: V2ErrorNotificationParamsSchema
  }).strict(),
  z.object({
    method: z.literal("warning"),
    params: V2WarningNotificationParamsSchema
  }).strict(),
  z.object({
    method: z.literal("guardianWarning"),
    params: V2GuardianWarningNotificationParamsSchema
  }).strict(),
  z.object({
    method: z.literal("deprecationNotice"),
    params: V2DeprecationNoticeNotificationParamsSchema
  }).strict(),
  z.object({
    method: z.literal("configWarning"),
    params: V2ConfigWarningNotificationParamsSchema
  }).strict(),
  z.object({
    method: z.literal("mcpServer/startupStatus/updated"),
    params: V2McpServerStatusUpdatedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("thread/compacted"),
    params: V2ContextCompactedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("thread/closed"),
    params: V2ThreadClosedParamsSchema
  }).strict()
]);

/**
 * Item-specific streaming notifications are informational only. Validate
 * their documented shapes, then ignore them so ordinary model/tool output
 * cannot quarantine a session before a later governed approval. The explicit
 * method union keeps unknown/future notifications fail-closed.
 */
const V2ProgressNotificationMethodSchema = z.enum([
  "item/agentMessage/delta",
  "item/plan/delta",
  "item/reasoning/summaryTextDelta",
  "item/reasoning/summaryPartAdded",
  "item/reasoning/textDelta",
  "item/commandExecution/outputDelta",
  "item/commandExecution/terminalInteraction",
  "item/fileChange/outputDelta",
  "item/mcpToolCall/progress",
  "item/autoApprovalReview/started",
  "item/autoApprovalReview/completed"
]);

const V2ProgressNotificationSchema = z.union([
  z.object({
    method: z.literal("item/agentMessage/delta"),
    params: V2ItemProgressDeltaParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/plan/delta"),
    params: V2ItemProgressDeltaParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/reasoning/summaryTextDelta"),
    params: V2ReasoningSummaryTextDeltaParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/reasoning/summaryPartAdded"),
    params: V2ReasoningSummaryPartAddedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/reasoning/textDelta"),
    params: V2ReasoningTextDeltaParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/commandExecution/outputDelta"),
    params: V2ItemProgressDeltaParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/commandExecution/terminalInteraction"),
    params: V2CommandExecutionTerminalInteractionParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/fileChange/outputDelta"),
    params: V2ItemProgressDeltaParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/mcpToolCall/progress"),
    params: V2McpToolCallProgressParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/autoApprovalReview/started"),
    params: V2AutoApprovalReviewStartedParamsSchema
  }).strict(),
  z.object({
    method: z.literal("item/autoApprovalReview/completed"),
    params: V2AutoApprovalReviewCompletedParamsSchema
  }).strict()
]);

const V2JsonRpcResponseSchema = z.object({
  error: z.object({
    code: z.number().int().finite().refine(Number.isSafeInteger),
    data: z.unknown().optional(),
    message: z.string()
  }).strict().optional(),
  id: JsonRpcRequestIdSchema,
  result: z.unknown().optional()
}).strict().refine((value) => {
  const hasResult = Object.prototype.hasOwnProperty.call(value, "result");
  const hasError = Object.prototype.hasOwnProperty.call(value, "error");
  return hasResult !== hasError;
}, "JSON-RPC response must contain exactly one result or error");

const V2WireEnvelopeSchema = z.object({
  id: JsonRpcRequestIdSchema.optional(),
  method: z.string().min(1),
  params: z.unknown().refine((value) => value !== undefined, "params is required"),
  trace: V2TraceContextSchema.optional()
}).strict().refine(
  (value) => value.id !== undefined || value.trace === undefined,
  "trace is supported only on JSON-RPC requests"
);

const V2FileChangeApprovalRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("item/fileChange/requestApproval"),
  params: CodexAppServerV2FileChangeApprovalParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2CommandExecutionApprovalRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("item/commandExecution/requestApproval"),
  params: V2CommandExecutionApprovalParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2PermissionsApprovalRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("item/permissions/requestApproval"),
  params: V2PermissionsApprovalParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2CurrentTimeReadRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("currentTime/read"),
  params: V2CurrentTimeReadParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2AttestationGenerateRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("attestation/generate"),
  params: V2AttestationGenerateParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2ChatGptAuthTokensRefreshRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("account/chatgptAuthTokens/refresh"),
  params: V2ChatGptAuthTokensRefreshParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2DynamicToolCallRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("item/tool/call"),
  params: V2DynamicToolCallParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2ToolRequestUserInputRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("item/tool/requestUserInput"),
  params: V2ToolRequestUserInputParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2McpServerElicitationRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("mcpServer/elicitation/request"),
  params: V2McpServerElicitationRequestParamsSchema,
  trace: V2TraceContextSchema.optional()
}).strict();

const V2PassthroughServerRequestSchema = z.union([
  V2ToolRequestUserInputRequestSchema,
  V2McpServerElicitationRequestSchema,
  V2DynamicToolCallRequestSchema,
  V2ChatGptAuthTokensRefreshRequestSchema,
  V2AttestationGenerateRequestSchema,
  V2CurrentTimeReadRequestSchema
]);

const V2ItemStartedWireSchema = z.object({
  method: z.literal("item/started"),
  params: V2ItemStartedParamsSchema
}).strict();

const V2ItemCompletedWireSchema = z.object({
  method: z.literal("item/completed"),
  params: V2ItemCompletedParamsSchema
}).strict();

const V2ServerRequestResolvedWireSchema = z.object({
  method: z.literal("serverRequest/resolved"),
  params: V2ServerRequestResolvedParamsSchema
}).strict();

const V2FileChangePatchUpdatedWireSchema = z.object({
  method: z.literal("item/fileChange/patchUpdated"),
  params: V2FileChangePatchUpdatedParamsSchema
}).strict();

const V2TurnDiffUpdatedWireSchema = z.object({
  method: z.literal("turn/diff/updated"),
  params: V2TurnDiffUpdatedParamsSchema
}).strict();

const V2ThreadStartedWireSchema = z.object({
  method: z.literal("thread/started"),
  params: V2ThreadStartedParamsSchema
}).strict();

const V2ThreadStatusChangedWireSchema = z.object({
  method: z.literal("thread/status/changed"),
  params: V2ThreadStatusChangedParamsSchema
}).strict();

const V2TurnStartedWireSchema = z.object({
  method: z.literal("turn/started"),
  params: V2TurnLifecycleParamsSchema
}).strict();

const V2TurnCompletedWireSchema = z.object({
  method: z.literal("turn/completed"),
  params: V2TurnLifecycleParamsSchema
}).strict();

const V2RemoteControlStatusWireSchema = z.object({
  method: z.literal("remoteControl/status/changed"),
  params: V2RemoteControlStatusParamsSchema
}).strict();

/** Stable raw-wire allowlist for the v2 governance boundary. */
export const CodexAppServerV2WireMessageSchema = z.union([
  V2JsonRpcResponseSchema,
  V2FileChangeApprovalRequestSchema,
  V2CommandExecutionApprovalRequestSchema,
  V2PermissionsApprovalRequestSchema,
  V2PassthroughServerRequestSchema,
  V2ItemStartedWireSchema,
  V2ItemCompletedWireSchema,
  V2ServerRequestResolvedWireSchema,
  V2FileChangePatchUpdatedWireSchema,
  V2TurnDiffUpdatedWireSchema,
  V2ThreadStartedWireSchema,
  V2ThreadStatusChangedWireSchema,
  V2TurnStartedWireSchema,
  V2TurnCompletedWireSchema,
  V2RemoteControlStatusWireSchema,
  V2ProgressNotificationSchema,
  V2NonGovernanceNotificationSchema
]);

const V2CommandApprovalResponseResultSchema = z.object({
  decision: z.enum(["accept", "decline"])
}).strict();

const V2PermissionsApprovalResponseResultSchema = z.object({
  permissions: V2PermissionGrantSchema,
  scope: z.enum(["turn", "session"]).optional(),
  strictAutoReview: z.boolean().nullable().optional()
}).strict();

export const CodexAppServerV2WireApprovalResponseSchema = z.object({
  id: JsonRpcRequestIdSchema,
  result: z.union([
    V2CommandApprovalResponseResultSchema,
    V2PermissionsApprovalResponseResultSchema
  ])
}).strict();

const V2InitializeResponseSchema = z.object({
  id: JsonRpcRequestIdSchema,
  result: z.object({
    codexHome: z.string().min(1),
    platformFamily: z.string().min(1),
    platformOs: z.string().min(1),
    userAgent: z.string().min(1)
  }).strict()
}).strict();

const V2InitializedNotificationSchema = z.object({
  method: z.literal("initialized")
}).strict();

export type CodexAppServerV2JsonRpcRequestId = z.infer<typeof JsonRpcRequestIdSchema>;
export type CodexAppServerV2FileChangeItem = z.infer<
  typeof CodexAppServerV2FileChangeItemSchema
>;
export type CodexAppServerV2FileChangeApprovalParams = z.infer<
  typeof CodexAppServerV2FileChangeApprovalParamsSchema
>;
export type CodexAppServerV2WireApprovalResponse = z.infer<
  typeof CodexAppServerV2WireApprovalResponseSchema
>;

export type CodexAppServerV2HandshakeResult =
  | { status: "initialize_response_accepted" }
  | { status: "initialized" }
  | { status: "blocked"; reasons: string[] };

export interface CodexAppServerV2FileChangeEvidence {
  baseHead: string;
  changes: Array<{
    path: string;
    beforeHash: string | null;
    afterHash: string | null;
  }>;
}

export interface CodexAppServerV2FileChangeEvidenceInput {
  threadId: string;
  turnId: string;
  itemId: string;
  changes: ReadonlyArray<{
    path: string;
    kind: "add" | "delete" | "update";
    movePath?: string | null;
    unifiedDiff: string;
  }>;
}

export type CodexAppServerV2FileChangeEvidenceProvider = (
  input: CodexAppServerV2FileChangeEvidenceInput
) => CodexAppServerV2FileChangeEvidence | undefined;

export interface CodexAppServerV2WireNormalizerOptions {
  initializeRequestId: CodexAppServerV2JsonRpcRequestId;
  schemaProfileId: string;
  fileChangeEvidence: CodexAppServerV2FileChangeEvidenceProvider;
}

export type CodexAppServerV2NormalizationResult =
  | {
      status: "normalized";
      event: CodexAppServerNormalizedEvent;
    }
  | {
      status: "ignored";
      method: string;
    }
  | {
      status: "passthrough";
      request: z.infer<typeof V2PassthroughServerRequestSchema>;
    }
  | {
      status: "blocked";
      method?: string;
      requestId?: string;
      itemId?: string;
      reasons: string[];
    };

interface TrackedItem {
  threadId: string;
  turnId: string;
  itemId: string;
  changeSet: ReturnType<typeof canonicalizeGovernedFileChangeSet>;
  rawChangeFingerprint: string;
  snapshotFingerprint: string;
  seenSnapshotFingerprints: Set<string>;
  latestSnapshotBound: boolean;
  approvalRequestId?: string;
  completed: boolean;
}

const MAX_TRACKED_FILE_CHANGE_SNAPSHOTS = 4096;
const SNAPSHOT_FINGERPRINT_HEAD = "0".repeat(40);
const SNAPSHOT_FINGERPRINT_HASH = "0".repeat(64);
const SNAPSHOT_FINGERPRINT_PROPOSED_AT = "1970-01-01T00:00:00.000Z";

interface ApprovalBinding {
  approvalKind: "file_change" | "command" | "network" | "permission";
  requestId: string;
  wireRequestId: CodexAppServerV2JsonRpcRequestId;
  threadId: string;
  turnId: string;
  itemId: string;
  requestedPermissions?: z.infer<typeof V2PermissionProfileSchema>;
  sentDecision?: "accept" | "decline";
  resolved: boolean;
}

interface PassthroughResolutionBinding {
  method: "item/tool/requestUserInput" | "mcpServer/elicitation/request";
  threadId: string;
}

const EvidenceSchema = z.object({
  baseHead: FullGitObjectIdSchema,
  changes: z.array(z.object({
    afterHash: Sha256Schema.nullable(),
    beforeHash: Sha256Schema.nullable(),
    path: z.string().min(1)
  }).strict()).min(1)
}).strict();

const InternalApprovalResponseSchema = z.object({
  schemaVersion: z.literal("codex-app-server-normalized-response.v1"),
  schemaProfileId: z.string().min(1),
  requestId: z.string().min(1),
  decision: z.enum(["accept", "decline"]),
  reasonCode: z.string().min(1),
  permissionGrant: V2PermissionGrantSchema.optional()
}).strict();

type V2WireSessionState =
  | "awaiting_initialize_response"
  | "awaiting_initialized_notification"
  | "ready";

export class CodexAppServerV2WireNormalizer {
  private readonly initializeRequestId: CodexAppServerV2JsonRpcRequestId;
  private readonly schemaProfileId: string;
  private readonly fileChangeEvidence: CodexAppServerV2FileChangeEvidenceProvider;
  private readonly seenWireHashes = new Set<string>();
  private readonly sequenceByTurn = new Map<string, number>();
  private readonly items = new Map<string, TrackedItem>();
  private readonly approvals = new Map<string, ApprovalBinding>();
  private readonly passthroughResolutions = new Map<string, PassthroughResolutionBinding>();
  private sessionState: V2WireSessionState = "awaiting_initialize_response";
  private compromisedReason?: string;
  private disconnectEvent?: Extract<
    CodexAppServerNormalizedEvent,
    { eventType: "transport_disconnected" }
  >;

  constructor(options: CodexAppServerV2WireNormalizerOptions) {
    if (options.schemaProfileId.trim() === "") {
      throw new Error("v2_wire_schema_profile_invalid");
    }
    const initializeRequestId = JsonRpcRequestIdSchema.safeParse(options.initializeRequestId);
    if (!initializeRequestId.success) {
      throw new Error("v2_initialize_request_id_invalid");
    }
    this.initializeRequestId = initializeRequestId.data;
    this.schemaProfileId = options.schemaProfileId;
    this.fileChangeEvidence = options.fileChangeEvidence;
  }

  acceptInitializeResponse(input: unknown): CodexAppServerV2HandshakeResult {
    if (this.compromisedReason !== undefined) {
      return { status: "blocked", reasons: this.quarantinedReasons() };
    }
    if (this.sessionState !== "awaiting_initialize_response") {
      return this.handshakeBlocked("v2_initialize_response_unexpected");
    }
    const parsed = V2InitializeResponseSchema.safeParse(input);
    if (!parsed.success) {
      return this.handshakeBlocked("v2_initialize_response_schema_invalid");
    }
    if (hashKernelObject(parsed.data.id) !== hashKernelObject(this.initializeRequestId)) {
      return this.handshakeBlocked("v2_initialize_response_id_mismatch");
    }
    if (!this.recordWireHash("initialize_response", parsed.data)) {
      return this.handshakeBlocked("v2_wire_event_replay");
    }
    this.sessionState = "awaiting_initialized_notification";
    return { status: "initialize_response_accepted" };
  }

  acceptInitializedNotification(input: unknown): CodexAppServerV2HandshakeResult {
    if (this.compromisedReason !== undefined) {
      return { status: "blocked", reasons: this.quarantinedReasons() };
    }
    if (this.sessionState !== "awaiting_initialized_notification") {
      return this.handshakeBlocked("v2_initialized_notification_unexpected");
    }
    const parsed = V2InitializedNotificationSchema.safeParse(input);
    if (!parsed.success) {
      return this.handshakeBlocked("v2_initialized_notification_schema_invalid");
    }
    if (!this.recordWireHash("initialized_notification", parsed.data)) {
      return this.handshakeBlocked("v2_wire_event_replay");
    }
    this.sessionState = "ready";
    return { status: "initialized" };
  }

  normalize(input: unknown): CodexAppServerV2NormalizationResult {
    try {
      return this.normalizeUntrusted(input);
    } catch {
      return this.quarantine("v2_wire_normalization_failed");
    }
  }

  private normalizeUntrusted(input: unknown): CodexAppServerV2NormalizationResult {
    if (this.compromisedReason !== undefined) {
      return this.quarantinedResult();
    }
    if (this.sessionState !== "ready") {
      return this.quarantine("v2_session_not_initialized");
    }
    const jsonInspection = inspectV2WireJsonValue(input);
    if (!jsonInspection.success) {
      return this.quarantine(jsonInspection.reason);
    }
    const response = V2JsonRpcResponseSchema.safeParse(input);
    if (response.success) {
      const responseHash = this.wireHash("wire_response", response.data);
      if (!this.recordWireHash("wire_response", response.data, responseHash)) {
        return this.quarantine("v2_wire_event_replay");
      }
      return { status: "ignored", method: "jsonrpc_response" };
    }
    const envelope = V2WireEnvelopeSchema.safeParse(input);
    if (!envelope.success) {
      return this.quarantine("v2_wire_envelope_invalid");
    }
    const message = envelope.data;
    const wireHash = this.wireHash("wire_message", message);
    if (message.id !== undefined) {
      if (!this.recordWireHash("wire_request", message, wireHash)) {
        return this.quarantine("v2_wire_event_replay");
      }
      return this.normalizeRequest(message.method, message.params, message.id, message.trace);
    }
    return this.normalizeNotification(message.method, message.params, wireHash);
  }

  encodeApprovalResponse(
    response: CodexAppServerApprovalResponse
  ): {
    status: "encoded";
    message: CodexAppServerV2WireApprovalResponse;
  } | {
    status: "blocked";
    reasons: string[];
  } {
    if (this.compromisedReason !== undefined) {
      return { status: "blocked", reasons: ["v2_session_quarantined", this.compromisedReason] };
    }
    const parsed = InternalApprovalResponseSchema.safeParse(response);
    if (!parsed.success || parsed.data.schemaProfileId !== this.schemaProfileId) {
      return { status: "blocked", reasons: ["v2_approval_response_invalid"] };
    }
    const binding = this.approvals.get(parsed.data.requestId);
    if (binding === undefined) {
      return { status: "blocked", reasons: ["v2_approval_request_id_unknown"] };
    }
    if (binding.resolved || binding.sentDecision !== undefined) {
      return { status: "blocked", reasons: ["v2_approval_response_replay"] };
    }
    if (binding.approvalKind !== "permission" && parsed.data.permissionGrant !== undefined) {
      return { status: "blocked", reasons: ["v2_permission_grant_unexpected"] };
    }
    if (parsed.data.decision === "decline" && parsed.data.permissionGrant !== undefined) {
      return { status: "blocked", reasons: ["v2_permission_grant_unexpected"] };
    }
    if (binding.approvalKind === "permission" && parsed.data.decision === "accept") {
      if (parsed.data.permissionGrant === undefined) {
        return { status: "blocked", reasons: ["v2_permission_grant_required"] };
      }
      if (
        binding.requestedPermissions === undefined
        || !isPermissionGrantSubset(
          binding.requestedPermissions,
          parsed.data.permissionGrant
        )
      ) {
        return { status: "blocked", reasons: ["v2_permission_grant_not_subset"] };
      }
    }
    const result = binding.approvalKind === "permission"
      ? {
          permissions: parsed.data.decision === "accept"
            ? parsed.data.permissionGrant ?? {}
            : {},
          scope: "turn" as const
        }
      : { decision: parsed.data.decision };
    binding.sentDecision = parsed.data.decision;
    return {
      status: "encoded",
      message: {
        id: binding.wireRequestId,
        result
      }
    };
  }

  markApprovalResponseDeliveryUncertain(requestId: string): void {
    if (this.approvals.has(requestId)) {
      this.compromisedReason ??= "v2_approval_response_delivery_uncertain";
    }
  }

  disconnect(reason = "v2_transport_disconnected"): CodexAppServerV2NormalizationResult {
    if (this.disconnectEvent !== undefined) {
      return this.quarantinedResult();
    }
    this.compromisedReason ??= reason;
    this.disconnectEvent = {
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: this.schemaProfileId,
      eventId: eventId("transport_disconnected", hashKernelObject({
        schemaVersion: "codex-router-app-server-v2-disconnect.v1",
        reason
      })),
      eventType: "transport_disconnected"
    };
    return { status: "normalized", event: this.disconnectEvent };
  }

  private normalizeRequest(
    method: string,
    params: unknown,
    wireRequestId: CodexAppServerV2JsonRpcRequestId,
    trace?: z.infer<typeof V2TraceContextSchema>
  ): CodexAppServerV2NormalizationResult {
    const requestId = canonicalRequestId(wireRequestId);
    const wireHash = hashKernelObject({
      schemaVersion: "codex-router-app-server-v2-wire-approval.v1",
      method,
      params,
      requestId: wireRequestId
    });
    if (method === "item/fileChange/requestApproval") {
      const parsed = V2FileChangeApprovalRequestSchema.safeParse({
        id: wireRequestId,
        method,
        params
      });
      if (!parsed.success) {
        return this.quarantine("v2_file_approval_schema_invalid", {
          method,
          requestId
        });
      }
      return this.normalizeFileApproval(parsed.data.params, wireRequestId, wireHash);
    }
    if (method === "item/commandExecution/requestApproval") {
      const parsed = V2CommandExecutionApprovalRequestSchema.safeParse({
        id: wireRequestId,
        method,
        params
      });
      if (!parsed.success) {
        return this.quarantine("v2_command_approval_schema_invalid", {
          method,
          requestId
        });
      }
      const command = parsed.data.params.command;
      const networkApprovalContext = parsed.data.params.networkApprovalContext;
      if (
        (command === undefined || command === null)
        && (networkApprovalContext === undefined || networkApprovalContext === null)
      ) {
        return this.quarantine("v2_command_approval_command_missing", {
          method,
          requestId
        });
      }
      const approvalKind = command === undefined || command === null
        ? "network" as const
        : "command" as const;
      return this.normalizeManualApproval({
        approvalKind,
        itemId: parsed.data.params.itemId,
        method,
        proposal: approvalKind === "network"
          ? {
              kind: "network",
              host: networkApprovalContext!.host,
              protocol: networkApprovalContext!.protocol,
              ...(parsed.data.params.environmentId === undefined
                || parsed.data.params.environmentId === null
                ? {}
                : { environmentId: parsed.data.params.environmentId }),
              ...(parsed.data.params.additionalPermissions === undefined
                || parsed.data.params.additionalPermissions === null
                ? {}
                : {
                    requestedPermissionScope: stableJson(
                      parsed.data.params.additionalPermissions
                    )
                  })
            }
          : {
              kind: "command",
              argv: [command!],
              ...(parsed.data.params.cwd === undefined || parsed.data.params.cwd === null
                ? {}
                : { cwd: parsed.data.params.cwd }),
              ...(parsed.data.params.environmentId === undefined
                || parsed.data.params.environmentId === null
                ? {}
                : { environmentId: parsed.data.params.environmentId }),
              ...(networkApprovalContext === undefined || networkApprovalContext === null
                ? {}
                : { networkApprovalContext }),
              ...(parsed.data.params.additionalPermissions === undefined
                || parsed.data.params.additionalPermissions === null
                ? {}
                : {
                    requestedPermissionScope: stableJson(
                      parsed.data.params.additionalPermissions
                    )
                  })
            },
        requestId,
        ...(parsed.data.params.reason === undefined
          ? {}
          : { semanticContext: parsed.data.params.reason }),
        threadId: parsed.data.params.threadId,
        turnId: parsed.data.params.turnId,
        wireHash,
        wireRequestId
      });
    }
    if (method === "item/permissions/requestApproval") {
      const parsed = V2PermissionsApprovalRequestSchema.safeParse({
        id: wireRequestId,
        method,
        params
      });
      if (!parsed.success) {
        return this.quarantine("v2_permissions_approval_schema_invalid", {
          method,
          requestId
        });
      }
      return this.normalizeManualApproval({
        approvalKind: "permission",
        itemId: parsed.data.params.itemId,
        method,
        requestedPermissions: parsed.data.params.permissions,
        proposal: {
          kind: "permission",
          scope: stableJson({
            cwd: parsed.data.params.cwd,
            environmentId: parsed.data.params.environmentId ?? null,
            permissions: parsed.data.params.permissions
          }),
          requestedPermissions: parsed.data.params.permissions
        },
        requestId,
        ...(parsed.data.params.reason === undefined
          ? {}
          : { semanticContext: parsed.data.params.reason }),
        threadId: parsed.data.params.threadId,
        turnId: parsed.data.params.turnId,
        wireHash,
        wireRequestId
      });
    }
    if (V2PassthroughServerRequestMethodSchema.safeParse(method).success) {
      const parsed = V2PassthroughServerRequestSchema.safeParse({
        id: wireRequestId,
        method,
        params,
        ...(trace === undefined ? {} : { trace })
      });
      if (!parsed.success) {
        return this.quarantine(
          method === "currentTime/read"
            ? "v2_current_time_request_schema_invalid"
            : "v2_passthrough_request_schema_invalid",
          {
            method,
            requestId
          }
        );
      }
      if (
        parsed.data.method === "item/tool/requestUserInput"
        || parsed.data.method === "mcpServer/elicitation/request"
      ) {
        if (this.approvals.has(requestId) || this.passthroughResolutions.has(requestId)) {
          return this.quarantine("v2_request_id_collision", { method, requestId });
        }
        this.passthroughResolutions.set(requestId, {
          method: parsed.data.method,
          threadId: parsed.data.params.threadId
        });
      }
      return { status: "passthrough", request: parsed.data };
    }
    return this.quarantine("v2_server_request_unsupported", { method, requestId });
  }

  private normalizeNotification(
    method: string,
    params: unknown,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    switch (method) {
      case "item/started": {
        const parsed = V2ItemStartedWireSchema.safeParse({ method, params });
        if (!parsed.success) {
          return this.quarantine("v2_item_started_schema_invalid", { method });
        }
        if (!isFileChangeItemStartedParams(parsed.data.params)) {
          return { status: "ignored", method };
        }
        if (!this.recordWireHash("wire_governed_notification", { method, params }, wireHash)) {
          return this.quarantine("v2_wire_event_replay");
        }
        return this.normalizeItemStarted(parsed.data.params, wireHash);
      }
      case "item/completed": {
        const parsed = V2ItemCompletedWireSchema.safeParse({ method, params });
        if (!parsed.success) {
          return this.quarantine("v2_item_completed_schema_invalid", { method });
        }
        if (!isFileChangeItemCompletedParams(parsed.data.params)) {
          return { status: "ignored", method };
        }
        if (!this.recordWireHash("wire_governed_notification", { method, params }, wireHash)) {
          return this.quarantine("v2_wire_event_replay");
        }
        return this.normalizeItemCompleted(parsed.data.params, wireHash);
      }
      case "serverRequest/resolved": {
        const parsed = V2ServerRequestResolvedWireSchema.safeParse({ method, params });
        if (!parsed.success) {
          return this.quarantine("v2_request_resolved_schema_invalid", { method });
        }
        if (!this.recordWireHash("wire_governed_notification", { method, params }, wireHash)) {
          return this.quarantine("v2_wire_event_replay");
        }
        return this.normalizeRequestResolved(parsed.data.params, wireHash);
      }
      case "item/fileChange/patchUpdated": {
        const parsed = V2FileChangePatchUpdatedWireSchema.safeParse({ method, params });
        if (!parsed.success) {
          return this.quarantine("v2_file_change_patch_schema_invalid", { method });
        }
        return this.normalizeFileChangePatchUpdated(parsed.data.params, wireHash);
      }
      case "turn/diff/updated": {
        const parsed = V2TurnDiffUpdatedWireSchema.safeParse({ method, params });
        return parsed.success
          ? { status: "ignored", method }
          : this.quarantine("v2_turn_diff_schema_invalid", { method });
      }
      case "thread/started": {
        const parsed = V2ThreadStartedWireSchema.safeParse({ method, params });
        return parsed.success
          ? { status: "ignored", method }
          : this.quarantine("v2_thread_started_schema_invalid", { method });
      }
      case "thread/status/changed": {
        const parsed = V2ThreadStatusChangedWireSchema.safeParse({ method, params });
        if (!parsed.success) {
          return this.quarantine("v2_thread_status_schema_invalid", { method });
        }
        if (parsed.data.params.status.type === "systemError") {
          return this.quarantine("v2_thread_status_terminal", { method });
        }
        if (
          parsed.data.params.status.type === "notLoaded"
          && this.threadHasOpenGovernance(parsed.data.params.threadId)
        ) {
          return this.quarantine("v2_thread_unloaded_with_open_governance", { method });
        }
        return { status: "ignored", method };
      }
      case "thread/closed": {
        const parsed = V2ThreadClosedParamsSchema.safeParse(params);
        if (!parsed.success) {
          return this.quarantine("v2_non_governance_notification_schema_invalid", { method });
        }
        return this.threadHasOpenGovernance(parsed.data.threadId)
          ? this.quarantine("v2_thread_unloaded_with_open_governance", { method })
          : { status: "ignored", method };
      }
      case "turn/started": {
        const parsed = V2TurnStartedWireSchema.safeParse({ method, params });
        return parsed.success
          ? { status: "ignored", method }
          : this.quarantine("v2_turn_started_schema_invalid", { method });
      }
      case "turn/completed": {
        const parsed = V2TurnCompletedWireSchema.safeParse({ method, params });
        return parsed.success
          ? { status: "ignored", method }
          : this.quarantine("v2_turn_completed_schema_invalid", { method });
      }
      case "remoteControl/status/changed": {
        const parsed = V2RemoteControlStatusWireSchema.safeParse({ method, params });
        if (!parsed.success) {
          return this.quarantine("v2_remote_control_status_schema_invalid", { method });
        }
        return parsed.data.params.status === "disabled"
          ? { status: "ignored", method }
          : this.quarantine("v2_remote_control_active", { method });
      }
      default:
        if (V2ProgressNotificationMethodSchema.safeParse(method).success) {
          if (V2ProgressNotificationSchema.safeParse({ method, params }).success) {
            return { status: "ignored", method };
          }
          return this.quarantine("v2_progress_notification_schema_invalid", { method });
        }
        if (V2NonGovernanceNotificationMethodSchema.safeParse(method).success) {
          if (V2NonGovernanceNotificationSchema.safeParse({ method, params }).success) {
            return { status: "ignored", method };
          }
          return this.quarantine("v2_non_governance_notification_schema_invalid", { method });
        }
        return this.quarantine("v2_wire_method_unsupported", { method });
    }
  }

  private normalizeItemStarted(
    params: V2FileChangeItemStartedParams,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    if (params.item.status !== "inProgress") {
      return this.quarantine("v2_item_started_status_invalid", { method: "item/started" });
    }
    if (params.item.changes.some((change) => change.path.includes("\\"))) {
      return this.quarantine("v2_file_change_path_encoding_unsupported", {
        method: "item/started",
        itemId: params.item.id
      });
    }
    const key = itemKey(params.threadId, params.turnId, params.item.id);
    if (this.items.has(key)) {
      return this.quarantine("v2_item_started_duplicate", { method: "item/started" });
    }
    const proposedAt = timestampToIso(params.startedAtMs);
    if (proposedAt === undefined) {
      return this.quarantine("v2_item_started_timestamp_invalid", { method: "item/started" });
    }
    const built = this.buildGovernedChangeSet({
      threadId: params.threadId,
      turnId: params.turnId,
      itemId: params.item.id,
      proposedAt,
      changes: params.item.changes
    });
    if (!built.success) {
      return this.quarantine(built.reason, { method: "item/started" });
    }
    const changeSet = built.changeSet;
    const event: Extract<CodexAppServerNormalizedEvent, { eventType: "item_started" }> = {
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: this.schemaProfileId,
      eventId: eventId("item/started", wireHash),
      eventType: "item_started",
      sequence: this.nextSequence(params.threadId, params.turnId),
      threadId: params.threadId,
      turnId: params.turnId,
      item: {
        itemId: params.item.id,
        itemType: "file_change",
        baseHead: changeSet.baseHead,
        proposedAt: changeSet.proposedAt,
        changes: changeSet.changes.map((change) => ({
          path: change.path,
          kind: change.kind,
          ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
          unifiedDiff: change.unifiedDiff,
          ...(change.beforeHash === undefined ? {} : { beforeHash: change.beforeHash }),
          ...(change.afterHash === undefined ? {} : { afterHash: change.afterHash })
        }))
      }
    };
    const rawFingerprint = rawChangeFingerprint(params.item);
    this.items.set(key, {
      threadId: params.threadId,
      turnId: params.turnId,
      itemId: params.item.id,
      changeSet,
      rawChangeFingerprint: rawFingerprint,
      snapshotFingerprint: built.snapshotFingerprint,
      seenSnapshotFingerprints: new Set([built.snapshotFingerprint]),
      latestSnapshotBound: true,
      completed: false
    });
    return { status: "normalized", event };
  }

  private normalizeFileChangePatchUpdated(
    params: z.infer<typeof V2FileChangePatchUpdatedParamsSchema>,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    const method = "item/fileChange/patchUpdated";
    const key = itemKey(params.threadId, params.turnId, params.itemId);
    const item = this.items.get(key);
    if (item === undefined || item.completed || item.approvalRequestId !== undefined) {
      return this.quarantine("v2_file_change_patch_correlation_failed", {
        method,
        itemId: params.itemId
      });
    }
    const paths = new Set<string>();
    for (const change of params.changes) {
      if (change.path.includes("\\")) {
        return this.quarantine("v2_file_change_path_encoding_unsupported", {
          method,
          itemId: params.itemId
        });
      }
      if (paths.has(change.path)) {
        return this.quarantine("v2_file_change_duplicate_path", {
          method,
          itemId: params.itemId
        });
      }
      paths.add(change.path);
      if (
        change.kind.type === "update"
        && change.kind.move_path !== undefined
        && change.kind.move_path !== null
      ) {
        return this.quarantine("v2_file_change_move_unsupported", {
          method,
          itemId: params.itemId
        });
      }
    }
    const snapshot: CodexAppServerV2FileChangeItem = {
      id: params.itemId,
      type: "fileChange",
      status: "inProgress",
      changes: params.changes
    };
    const fingerprint = rawChangeFingerprint(snapshot);
    if (fingerprint === item.rawChangeFingerprint) {
      return { status: "ignored", method };
    }
    if (params.changes.length === 0 || params.changes.some((change) => change.diff === "")) {
      item.rawChangeFingerprint = fingerprint;
      item.latestSnapshotBound = false;
      return { status: "ignored", method };
    }
    const built = this.buildGovernedChangeSet({
      threadId: params.threadId,
      turnId: params.turnId,
      itemId: params.itemId,
      proposedAt: item.changeSet.proposedAt,
      changes: params.changes
    });
    if (!built.success) {
      return this.quarantine(built.reason, { method, itemId: params.itemId });
    }
    if (built.changeSet.baseHead !== item.changeSet.baseHead) {
      return this.quarantine("v2_file_change_patch_base_head_mismatch", {
        method,
        itemId: params.itemId
      });
    }
    if (built.snapshotFingerprint === item.snapshotFingerprint) {
      if (built.changeSet.canonicalHash !== item.changeSet.canonicalHash) {
        return this.quarantine("v2_file_change_patch_evidence_drift", {
          method,
          itemId: params.itemId
        });
      }
      item.rawChangeFingerprint = fingerprint;
      item.latestSnapshotBound = true;
      return { status: "ignored", method };
    }
    if (item.seenSnapshotFingerprints.has(built.snapshotFingerprint)) {
      return this.quarantine("v2_file_change_patch_snapshot_rollback", {
        method,
        itemId: params.itemId
      });
    }
    if (item.seenSnapshotFingerprints.size >= MAX_TRACKED_FILE_CHANGE_SNAPSHOTS) {
      return this.quarantine("v2_file_change_patch_snapshot_limit_exceeded", {
        method,
        itemId: params.itemId
      });
    }
    item.seenSnapshotFingerprints.add(built.snapshotFingerprint);
    item.changeSet = built.changeSet;
    item.rawChangeFingerprint = fingerprint;
    item.snapshotFingerprint = built.snapshotFingerprint;
    item.latestSnapshotBound = true;
    const sequence = this.nextSequence(params.threadId, params.turnId);
    const event: Extract<CodexAppServerNormalizedEvent, { eventType: "item_updated" }> = {
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: this.schemaProfileId,
      eventId: eventId(method, hashKernelObject({
        schemaVersion: "codex-router-app-server-v2-file-change-update-event.v1",
        wireHash,
        sequence
      })),
      eventType: "item_updated",
      sequence,
      threadId: params.threadId,
      turnId: params.turnId,
      item: {
        itemId: params.itemId,
        itemType: "file_change",
        baseHead: built.changeSet.baseHead,
        proposedAt: built.changeSet.proposedAt,
        changes: built.changeSet.changes.map((change) => ({
          path: change.path,
          kind: change.kind,
          ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
          unifiedDiff: change.unifiedDiff,
          ...(change.beforeHash === undefined ? {} : { beforeHash: change.beforeHash }),
          ...(change.afterHash === undefined ? {} : { afterHash: change.afterHash })
        }))
      }
    };
    return { status: "normalized", event };
  }

  private normalizeManualApproval(input: {
    approvalKind: "command" | "network" | "permission";
    itemId: string;
    method: string;
    requestedPermissions?: z.infer<typeof V2PermissionProfileSchema>;
    proposal: Extract<
      CodexAppServerNormalizedEvent,
      { eventType: "approval_requested" }
    >["proposal"];
    requestId: string;
    semanticContext?: string | null;
    threadId: string;
    turnId: string;
    wireHash: string;
    wireRequestId: CodexAppServerV2JsonRpcRequestId;
  }): CodexAppServerV2NormalizationResult {
    if (
      this.approvals.has(input.requestId)
      || this.passthroughResolutions.has(input.requestId)
    ) {
      return this.quarantine("v2_request_id_collision", {
        method: input.method,
        requestId: input.requestId,
        itemId: input.itemId
      });
    }
    const requestedPermissions = input.requestedPermissions === undefined
      ? undefined
      : cloneAndDeepFreeze(input.requestedPermissions);
    const publicProposal = structuredClone(input.proposal);
    this.approvals.set(input.requestId, {
      approvalKind: input.approvalKind,
      requestId: input.requestId,
      wireRequestId: input.wireRequestId,
      threadId: input.threadId,
      turnId: input.turnId,
      itemId: input.itemId,
      ...(requestedPermissions === undefined
        ? {}
        : { requestedPermissions }),
      resolved: false
    });
    const event: Extract<CodexAppServerNormalizedEvent, { eventType: "approval_requested" }> = {
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: this.schemaProfileId,
      eventId: eventId(input.method, input.wireHash),
      eventType: "approval_requested",
      sequence: this.nextSequence(input.threadId, input.turnId),
      threadId: input.threadId,
      turnId: input.turnId,
      requestId: input.requestId,
      itemId: input.itemId,
      proposal: publicProposal,
      ...(input.semanticContext === undefined || input.semanticContext === null
        ? {}
        : { semanticContext: input.semanticContext })
    };
    return { status: "normalized", event };
  }

  private normalizeFileApproval(
    params: CodexAppServerV2FileChangeApprovalParams,
    wireRequestId: CodexAppServerV2JsonRpcRequestId,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    const requestId = canonicalRequestId(wireRequestId);
    const key = itemKey(params.threadId, params.turnId, params.itemId);
    const item = this.items.get(key);
    if (item === undefined || item.approvalRequestId !== undefined || item.completed) {
      return this.quarantine("v2_file_approval_correlation_failed", {
        method: "item/fileChange/requestApproval",
        requestId
      });
    }
    if (!item.latestSnapshotBound) {
      return this.quarantine("v2_file_approval_snapshot_unbound", {
        method: "item/fileChange/requestApproval",
        requestId,
        itemId: params.itemId
      });
    }
    if (this.approvals.has(requestId) || this.passthroughResolutions.has(requestId)) {
      return this.quarantine("v2_request_id_collision", {
        method: "item/fileChange/requestApproval",
        requestId
      });
    }
    item.approvalRequestId = requestId;
    this.approvals.set(requestId, {
      approvalKind: "file_change",
      requestId,
      wireRequestId,
      threadId: params.threadId,
      turnId: params.turnId,
      itemId: params.itemId,
      resolved: false
    });
    const event: Extract<CodexAppServerNormalizedEvent, { eventType: "approval_requested" }> = {
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: this.schemaProfileId,
      eventId: eventId("item/fileChange/requestApproval", wireHash),
      eventType: "approval_requested",
      sequence: this.nextSequence(params.threadId, params.turnId),
      threadId: params.threadId,
      turnId: params.turnId,
      requestId,
      itemId: params.itemId,
      proposal: {
        kind: "file_change",
        ...(params.grantRoot === undefined || params.grantRoot === null
          ? {}
          : { grantRoot: params.grantRoot })
      },
      ...(params.reason === undefined || params.reason === null
        ? {}
        : { semanticContext: params.reason })
    };
    return { status: "normalized", event };
  }

  private normalizeRequestResolved(
    params: z.infer<typeof V2ServerRequestResolvedParamsSchema>,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    const requestId = canonicalRequestId(params.requestId);
    const passthrough = this.passthroughResolutions.get(requestId);
    if (passthrough !== undefined) {
      if (passthrough.threadId !== params.threadId) {
        return this.quarantine("v2_request_resolved_correlation_failed", {
          method: "serverRequest/resolved",
          requestId
        });
      }
      this.passthroughResolutions.delete(requestId);
      return { status: "ignored", method: "serverRequest/resolved" };
    }
    const approval = this.approvals.get(requestId);
    if (
      approval === undefined
      || approval.threadId !== params.threadId
      || approval.resolved
    ) {
      return this.quarantine("v2_request_resolved_correlation_failed", {
        method: "serverRequest/resolved",
        requestId
      });
    }
    approval.resolved = true;
    // App Server uses the same notification to clear unanswered requests on
    // turn start/complete/interrupt. No client decision means cancellation,
    // not an unknown resolution that would strand the adapter in reconciliation.
    const resolution = approval.sentDecision ?? "cancelled";
    const event: Extract<CodexAppServerNormalizedEvent, { eventType: "request_resolved" }> = {
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: this.schemaProfileId,
      eventId: eventId("serverRequest/resolved", wireHash),
      eventType: "request_resolved",
      sequence: this.nextSequence(approval.threadId, approval.turnId),
      threadId: approval.threadId,
      turnId: approval.turnId,
      requestId,
      itemId: approval.itemId,
      resolution
    };
    return { status: "normalized", event };
  }

  private threadHasOpenGovernance(threadId: string): boolean {
    for (const item of this.items.values()) {
      if (item.threadId === threadId && !item.completed) {
        return true;
      }
    }
    for (const approval of this.approvals.values()) {
      if (approval.threadId === threadId && !approval.resolved) {
        return true;
      }
    }
    return false;
  }

  private normalizeItemCompleted(
    params: V2FileChangeItemCompletedParams,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    const key = itemKey(params.threadId, params.turnId, params.item.id);
    const item = this.items.get(key);
    if (
      params.item.status !== "completed"
      && params.item.status !== "failed"
      && params.item.status !== "declined"
    ) {
      return this.quarantine("v2_item_completed_status_invalid", {
        method: "item/completed",
        itemId: params.item.id
      });
    }
    if (
      item === undefined
      || item.completed
      || !item.latestSnapshotBound
      || (item.approvalRequestId !== undefined
        && this.approvals.get(item.approvalRequestId)?.resolved !== true)
    ) {
      return this.quarantine("v2_item_completed_correlation_failed", {
        method: "item/completed",
        itemId: params.item.id
      });
    }
    const completedSnapshot = this.fingerprintRawSnapshot(params.item.changes);
    if (
      !completedSnapshot.success
      || completedSnapshot.snapshotFingerprint !== item.snapshotFingerprint
    ) {
      return this.quarantine("v2_item_completed_correlation_failed", {
        method: "item/completed",
        itemId: params.item.id
      });
    }
    item.completed = true;
    const event: Extract<CodexAppServerNormalizedEvent, { eventType: "item_completed" }> = {
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: this.schemaProfileId,
      eventId: eventId("item/completed", wireHash),
      eventType: "item_completed",
      sequence: this.nextSequence(params.threadId, params.turnId),
      threadId: params.threadId,
      turnId: params.turnId,
      itemId: params.item.id,
      outcome: params.item.status === "completed" ? "applied" : "not_applied"
    };
    return { status: "normalized", event };
  }

  private buildGovernedChangeSet(input: {
    threadId: string;
    turnId: string;
    itemId: string;
    proposedAt: string;
    changes: ReadonlyArray<z.infer<typeof V2FileChangePatchUpdatedChangeSchema>>;
  }): {
    success: true;
    changeSet: ReturnType<typeof canonicalizeGovernedFileChangeSet>;
    snapshotFingerprint: string;
  } | {
    success: false;
    reason: string;
  } {
    let evidence: CodexAppServerV2FileChangeEvidence | undefined;
    try {
      evidence = this.fileChangeEvidence({
        threadId: input.threadId,
        turnId: input.turnId,
        itemId: input.itemId,
        changes: input.changes.map((change) => ({
          path: change.path,
          kind: change.kind.type,
          ...(change.kind.type === "update" && change.kind.move_path !== undefined
            ? { movePath: change.kind.move_path }
            : {}),
          unifiedDiff: change.diff
        }))
      });
    } catch {
      return { success: false, reason: "v2_file_change_evidence_provider_failed" };
    }
    const parsedEvidence = EvidenceSchema.safeParse(evidence);
    if (!parsedEvidence.success) {
      return { success: false, reason: "v2_file_change_evidence_missing" };
    }
    const draftChanges = this.createDraftChanges(input.changes, parsedEvidence.data);
    if (!draftChanges.success) {
      return draftChanges;
    }
    try {
      const changeSet = canonicalizeGovernedFileChangeSet({
        changeSetId: input.threadId + ":" + input.turnId + ":" + input.itemId,
        threadId: input.threadId,
        turnId: input.turnId,
        itemId: input.itemId,
        baseHead: parsedEvidence.data.baseHead,
        proposedAt: input.proposedAt,
        sourceSchemaProfile: this.schemaProfileId,
        changes: draftChanges.changes
      });
      return {
        success: true,
        changeSet,
        snapshotFingerprint: this.canonicalSnapshotFingerprint(draftChanges.changes)
      };
    } catch {
      return { success: false, reason: "v2_file_change_canonicalization_failed" };
    }
  }

  private canonicalSnapshotFingerprint(
    changes: ReadonlyArray<GovernedFileChangeDraft>
  ): string {
    return canonicalizeGovernedFileChangeSet({
      changeSetId: "snapshot-fingerprint",
      threadId: "snapshot-fingerprint",
      turnId: "snapshot-fingerprint",
      itemId: "snapshot-fingerprint",
      baseHead: SNAPSHOT_FINGERPRINT_HEAD,
      proposedAt: SNAPSHOT_FINGERPRINT_PROPOSED_AT,
      sourceSchemaProfile: "snapshot-fingerprint",
      changes: changes.map((change) => ({
        path: change.path,
        kind: change.kind,
        ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
        unifiedDiff: change.unifiedDiff,
        beforeHash: change.kind === "create" ? null : SNAPSHOT_FINGERPRINT_HASH,
        afterHash: change.kind === "delete" ? null : SNAPSHOT_FINGERPRINT_HASH
      }))
    }).canonicalHash;
  }

  private fingerprintRawSnapshot(
    rawChanges: ReadonlyArray<z.infer<typeof V2FileChangeSchema>>
  ): {
    success: true;
    snapshotFingerprint: string;
  } | {
    success: false;
  } {
    const draftChanges = this.createDraftChanges(rawChanges, {
      baseHead: SNAPSHOT_FINGERPRINT_HEAD,
      changes: rawChanges.map((change) => ({
        path: change.path,
        beforeHash: change.kind.type === "add" ? null : SNAPSHOT_FINGERPRINT_HASH,
        afterHash: change.kind.type === "delete" ? null : SNAPSHOT_FINGERPRINT_HASH
      }))
    });
    if (!draftChanges.success) {
      return { success: false };
    }
    try {
      return {
        success: true,
        snapshotFingerprint: this.canonicalSnapshotFingerprint(draftChanges.changes)
      };
    } catch {
      return { success: false };
    }
  }

  private createDraftChanges(
    rawChanges: ReadonlyArray<z.infer<typeof V2FileChangeSchema>>,
    evidence: CodexAppServerV2FileChangeEvidence
  ): { success: true; changes: GovernedFileChangeDraft[] } | { success: false; reason: string } {
    const parsedEvidence = EvidenceSchema.parse(evidence);
    const evidenceByPath = new Map<string, (typeof parsedEvidence.changes)[number]>();
    for (const change of parsedEvidence.changes) {
      if (evidenceByPath.has(change.path)) {
        return { success: false, reason: "v2_file_change_evidence_duplicate_path" };
      }
      evidenceByPath.set(change.path, change);
    }
    const rawPaths = new Set<string>();
    const changes: GovernedFileChangeDraft[] = [];
    for (const raw of rawChanges) {
      if (raw.path.includes("\\")) {
        return { success: false, reason: "v2_file_change_path_encoding_unsupported" };
      }
      if (rawPaths.has(raw.path)) {
        return { success: false, reason: "v2_file_change_duplicate_path" };
      }
      rawPaths.add(raw.path);
      const evidenceChange = evidenceByPath.get(raw.path);
      if (evidenceChange === undefined) {
        return { success: false, reason: "v2_file_change_evidence_binding_mismatch" };
      }
      const kind: GovernedFileChangeKind = raw.kind.type === "add"
        ? "create"
        : raw.kind.type === "delete"
          ? "delete"
          : "update";
      if (
        raw.kind.type === "update"
        && raw.kind.move_path !== undefined
        && raw.kind.move_path !== null
      ) {
        return { success: false, reason: "v2_file_change_move_unsupported" };
      }
      if (
        kind === "create"
        && (evidenceChange.beforeHash !== null || evidenceChange.afterHash === null)
      ) {
        return { success: false, reason: "v2_file_change_evidence_hash_semantics_invalid" };
      }
      if (
        kind === "update"
        && (evidenceChange.beforeHash === null || evidenceChange.afterHash === null)
      ) {
        return { success: false, reason: "v2_file_change_evidence_hash_semantics_invalid" };
      }
      if (
        kind === "delete"
        && (evidenceChange.beforeHash === null || evidenceChange.afterHash !== null)
      ) {
        return { success: false, reason: "v2_file_change_evidence_hash_semantics_invalid" };
      }
      changes.push({
        path: raw.path,
        kind,
        unifiedDiff: raw.diff,
        beforeHash: evidenceChange.beforeHash,
        afterHash: evidenceChange.afterHash
      });
    }
    if (evidenceByPath.size !== rawPaths.size) {
      return { success: false, reason: "v2_file_change_evidence_binding_mismatch" };
    }
    return { success: true, changes };
  }

  private nextSequence(threadId: string, turnId: string): number {
    const key = itemKey(threadId, turnId, "");
    const next = (this.sequenceByTurn.get(key) ?? 0) + 1;
    this.sequenceByTurn.set(key, next);
    return next;
  }

  private wireHash(direction: string, message: unknown): string {
    return hashKernelObject({
      schemaVersion: "codex-router-app-server-v2-wire-message.v1",
      direction,
      message
    });
  }

  private recordWireHash(direction: string, message: unknown, hash?: string): boolean {
    const wireHash = hash ?? this.wireHash(direction, message);
    if (this.seenWireHashes.has(wireHash)) {
      return false;
    }
    this.seenWireHashes.add(wireHash);
    return true;
  }

  private handshakeBlocked(reason: string): CodexAppServerV2HandshakeResult {
    const blocked = this.quarantine(reason);
    return { status: "blocked", reasons: blocked.reasons };
  }

  private quarantinedReasons(): string[] {
    return uniqueStrings([
      "v2_session_quarantined",
      this.compromisedReason ?? "v2_session_quarantined"
    ]);
  }

  private quarantine(
    reason: string,
    details: Pick<
      Extract<CodexAppServerV2NormalizationResult, { status: "blocked" }>,
      "method" | "requestId" | "itemId"
    > = {}
  ): Extract<CodexAppServerV2NormalizationResult, { status: "blocked" }> {
    this.compromisedReason ??= reason;
    return {
      status: "blocked",
      ...details,
      reasons: uniqueStrings([reason, "v2_session_quarantined"])
    };
  }

  private quarantinedResult(): Extract<
    CodexAppServerV2NormalizationResult,
    { status: "blocked" }
  > {
    return {
      status: "blocked",
      reasons: this.quarantinedReasons()
    };
  }
}

export class CodexAppServerV2WireTransport implements CodexAppServerMessageTransport {
  private readonly normalizer: CodexAppServerV2WireNormalizer;
  private readonly sendWire: (
    message: CodexAppServerV2WireApprovalResponse
  ) => Promise<void>;

  constructor(options: {
    normalizer: CodexAppServerV2WireNormalizer;
    send: (message: CodexAppServerV2WireApprovalResponse) => Promise<void>;
  }) {
    this.normalizer = options.normalizer;
    this.sendWire = options.send;
  }

  async send(message: CodexAppServerApprovalResponse): Promise<void> {
    const encoded = this.normalizer.encodeApprovalResponse(message);
    if (encoded.status === "blocked") {
      throw new Error(encoded.reasons.join(","));
    }
    try {
      await this.sendWire(encoded.message);
    } catch (error) {
      this.normalizer.markApprovalResponseDeliveryUncertain(message.requestId);
      throw error;
    }
  }
}

export interface CodexAppServerV2WireAdapterOptions {
  adapter: Pick<CodexAppServerAdapter, "ingest">;
  normalizer: CodexAppServerV2WireNormalizer;
}

export type CodexAppServerV2WireAdapterResult =
  | {
      status: "normalized";
      normalization: Extract<CodexAppServerV2NormalizationResult, { status: "normalized" }>;
      outcome: CodexAdapterOutcome;
    }
  | {
      status: "ignored";
      normalization: Extract<CodexAppServerV2NormalizationResult, { status: "ignored" }>;
    }
  | {
      status: "passthrough";
      normalization: Extract<CodexAppServerV2NormalizationResult, { status: "passthrough" }>;
    }
  | {
      status: "blocked" | "disconnected";
      normalization: Extract<CodexAppServerV2NormalizationResult, { status: "blocked" | "normalized" }>;
      outcome?: CodexAdapterOutcome;
      reasons: string[];
    };

/**
 * The only supported raw-to-governance bridge. A wire rejection also emits a
 * normalized transport-disconnected event so the adapter reconciles open work
 * instead of leaving an approval pending in memory.
 */
export class CodexAppServerV2WireAdapter {
  private readonly adapter: Pick<CodexAppServerAdapter, "ingest">;
  private readonly normalizer: CodexAppServerV2WireNormalizer;

  constructor(options: CodexAppServerV2WireAdapterOptions) {
    this.adapter = options.adapter;
    this.normalizer = options.normalizer;
  }

  async acceptInitializeResponse(input: unknown): Promise<CodexAppServerV2HandshakeResult> {
    const result = this.normalizer.acceptInitializeResponse(input);
    if (result.status === "blocked") {
      await this.notifyDisconnect(result.reasons[0] ?? "v2_initialize_failed");
    }
    return result;
  }

  async acceptInitializedNotification(input: unknown): Promise<CodexAppServerV2HandshakeResult> {
    const result = this.normalizer.acceptInitializedNotification(input);
    if (result.status === "blocked") {
      await this.notifyDisconnect(result.reasons[0] ?? "v2_initialized_failed");
    }
    return result;
  }

  async ingest(input: unknown): Promise<CodexAppServerV2WireAdapterResult> {
    let normalization: CodexAppServerV2NormalizationResult;
    try {
      normalization = this.normalizer.normalize(input);
    } catch {
      const reason = "v2_wire_normalization_failed";
      const reasons = [reason, "v2_session_quarantined"];
      const outcome = await this.notifyDisconnect(reason);
      return {
        status: "blocked",
        normalization: { status: "blocked", reasons },
        ...(outcome === undefined ? {} : { outcome }),
        reasons
      };
    }
    if (normalization.status === "normalized") {
      try {
        const outcome = await this.adapter.ingest(normalization.event);
        return { status: "normalized", normalization, outcome };
      } catch {
        await this.notifyDisconnect("v2_adapter_ingest_failed");
        return {
          status: "blocked",
          normalization,
          reasons: ["v2_adapter_ingest_failed", "v2_session_quarantined"]
        };
      }
    }
    if (normalization.status === "ignored") {
      return { status: "ignored", normalization };
    }
    if (normalization.status === "passthrough") {
      return { status: "passthrough", normalization };
    }
    const blocked = normalization as Extract<
      CodexAppServerV2NormalizationResult,
      { status: "blocked" }
    >;
    const outcome = await this.notifyDisconnect(blocked.reasons[0] ?? "v2_wire_blocked");
    return {
      status: "blocked",
      normalization: blocked,
      ...(outcome === undefined ? {} : { outcome }),
      reasons: blocked.reasons
    };
  }

  async disconnect(reason = "v2_transport_disconnected"): Promise<CodexAppServerV2WireAdapterResult> {
    const normalization = this.normalizer.disconnect(reason);
    if (normalization.status !== "normalized") {
      const blocked = normalization as Extract<
        CodexAppServerV2NormalizationResult,
        { status: "blocked" }
      >;
      return {
        status: "blocked",
        normalization: blocked,
        reasons: blocked.reasons
      };
    }
    try {
      const outcome = await this.adapter.ingest(normalization.event);
      return {
        status: "disconnected",
        normalization,
        outcome,
        reasons: [reason]
      };
    } catch {
      return {
        status: "blocked",
        normalization,
        reasons: [reason, "v2_adapter_disconnect_failed"]
      };
    }
  }

  private async notifyDisconnect(reason: string): Promise<CodexAdapterOutcome | undefined> {
    const disconnected = this.normalizer.disconnect(reason);
    if (disconnected.status !== "normalized") {
      return undefined;
    }
    try {
      return await this.adapter.ingest(disconnected.event);
    } catch {
      return undefined;
    }
  }
}

type V2WireJsonInspection =
  | { success: true }
  | {
      success: false;
      reason:
        | "v2_wire_payload_depth_exceeded"
        | "v2_wire_payload_node_limit_exceeded"
        | "v2_wire_payload_text_limit_exceeded"
        | "v2_wire_payload_not_json";
    };

function inspectV2WireJsonValue(input: unknown): V2WireJsonInspection {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];
  const seenObjects = new WeakSet<object>();
  let nodes = 0;
  let textCodeUnits = 0;

  try {
    while (stack.length > 0) {
      const entry = stack.pop()!;
      nodes += 1;
      if (nodes > MAX_V2_WIRE_JSON_NODES) {
        return { success: false, reason: "v2_wire_payload_node_limit_exceeded" };
      }
      if (entry.depth > MAX_V2_WIRE_JSON_DEPTH) {
        return { success: false, reason: "v2_wire_payload_depth_exceeded" };
      }

      if (entry.value === null || typeof entry.value === "boolean") {
        continue;
      }
      if (typeof entry.value === "number") {
        if (!Number.isFinite(entry.value)) {
          return { success: false, reason: "v2_wire_payload_not_json" };
        }
        continue;
      }
      if (typeof entry.value === "string") {
        textCodeUnits += entry.value.length;
        if (textCodeUnits > MAX_V2_WIRE_JSON_TEXT_CODE_UNITS) {
          return { success: false, reason: "v2_wire_payload_text_limit_exceeded" };
        }
        continue;
      }
      if (typeof entry.value !== "object") {
        return { success: false, reason: "v2_wire_payload_not_json" };
      }
      if (seenObjects.has(entry.value)) {
        return { success: false, reason: "v2_wire_payload_not_json" };
      }
      seenObjects.add(entry.value);

      if (Array.isArray(entry.value)) {
        if (Object.getPrototypeOf(entry.value) !== Array.prototype) {
          return { success: false, reason: "v2_wire_payload_not_json" };
        }
        if (
          nodes + stack.length + entry.value.length
          > MAX_V2_WIRE_JSON_NODES
        ) {
          return { success: false, reason: "v2_wire_payload_node_limit_exceeded" };
        }
        const keys = Reflect.ownKeys(entry.value);
        if (
          keys.length !== entry.value.length + 1
          || !keys.includes("length")
        ) {
          return { success: false, reason: "v2_wire_payload_not_json" };
        }
        for (let index = entry.value.length - 1; index >= 0; index -= 1) {
          const descriptor = Object.getOwnPropertyDescriptor(entry.value, String(index));
          if (
            descriptor === undefined
            || !descriptor.enumerable
            || !("value" in descriptor)
          ) {
            return { success: false, reason: "v2_wire_payload_not_json" };
          }
          stack.push({ value: descriptor.value, depth: entry.depth + 1 });
        }
        continue;
      }

      const prototype = Object.getPrototypeOf(entry.value);
      if (prototype !== Object.prototype && prototype !== null) {
        return { success: false, reason: "v2_wire_payload_not_json" };
      }
      const keys = Reflect.ownKeys(entry.value);
      if (nodes + stack.length + keys.length > MAX_V2_WIRE_JSON_NODES) {
        return { success: false, reason: "v2_wire_payload_node_limit_exceeded" };
      }
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index]!;
        if (typeof key !== "string") {
          return { success: false, reason: "v2_wire_payload_not_json" };
        }
        const descriptor = Object.getOwnPropertyDescriptor(entry.value, key);
        if (
          descriptor === undefined
          || !descriptor.enumerable
          || !("value" in descriptor)
        ) {
          return { success: false, reason: "v2_wire_payload_not_json" };
        }
        textCodeUnits += key.length;
        if (textCodeUnits > MAX_V2_WIRE_JSON_TEXT_CODE_UNITS) {
          return { success: false, reason: "v2_wire_payload_text_limit_exceeded" };
        }
        stack.push({ value: descriptor.value, depth: entry.depth + 1 });
      }
    }
  } catch {
    return { success: false, reason: "v2_wire_payload_not_json" };
  }

  return { success: true };
}

function canonicalRequestId(id: CodexAppServerV2JsonRpcRequestId): string {
  return typeof id === "string" ? id : String(id);
}

function itemKey(threadId: string, turnId: string, itemId: string): string {
  return JSON.stringify([threadId, turnId, itemId]);
}

function eventId(method: string, wireHash: string): string {
  return "codex-app-server-v2:" + method + ":" + wireHash;
}

function timestampToIso(timestampMs: number): string | undefined {
  const timestamp = new Date(timestampMs);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
}

function rawChangeFingerprint(item: CodexAppServerV2FileChangeItem): string {
  return hashKernelObject({
    schemaVersion: "codex-router-app-server-v2-file-change-item.v1",
    item: {
      id: item.id,
      type: item.type,
      changes: item.changes
    }
  });
}

function isFileChangeItemStartedParams(
  params: V2ItemStartedParams
): params is V2FileChangeItemStartedParams {
  return params.item.type === "fileChange";
}

function isFileChangeItemCompletedParams(
  params: V2ItemCompletedParams
): params is V2FileChangeItemCompletedParams {
  return params.item.type === "fileChange";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function cloneAndDeepFreeze<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableJson(record[key])}`
  )).join(",")}}`;
}
