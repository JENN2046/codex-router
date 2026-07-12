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

const FullGitObjectIdSchema = z.string().regex(
  /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/,
  "baseHead must be a full Git object id"
);

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

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

const V2FileSystemSpecialPathSchema = z.union([
  z.object({ kind: z.literal("root") }).strict(),
  z.object({ kind: z.literal("minimal") }).strict(),
  z.object({
    kind: z.literal("project_roots"),
    subpath: z.string().nullable().optional()
  }).strict(),
  z.object({ kind: z.literal("tmpdir") }).strict(),
  z.object({ kind: z.literal("slash_tmp") }).strict(),
  z.object({
    kind: z.literal("unknown"),
    path: z.string(),
    subpath: z.string().nullable().optional()
  }).strict()
]);

const V2FileSystemPathSchema = z.union([
  z.object({ path: z.string(), type: z.literal("path") }).strict(),
  z.object({ pattern: z.string(), type: z.literal("glob_pattern") }).strict(),
  z.object({
    type: z.literal("special"),
    value: V2FileSystemSpecialPathSchema
  }).strict()
]);

const V2FileSystemSandboxEntrySchema = z.object({
  access: z.enum(["read", "write", "deny"]),
  path: V2FileSystemPathSchema
}).strict();

const V2AdditionalFileSystemPermissionsSchema = z.object({
  entries: z.array(V2FileSystemSandboxEntrySchema).nullable().optional(),
  globScanMaxDepth: z.number().int().min(1).nullable().optional(),
  read: z.array(z.string()).nullable().optional(),
  write: z.array(z.string()).nullable().optional()
}).strict();

const V2AdditionalNetworkPermissionsSchema = z.object({
  enabled: z.boolean().nullable().optional()
}).strict();

const V2PermissionProfileSchema = z.object({
  fileSystem: V2AdditionalFileSystemPermissionsSchema.nullable().optional(),
  network: V2AdditionalNetworkPermissionsSchema.nullable().optional()
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
  grantRoot: z.string().nullable().optional(),
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
  environmentId: z.string().nullable().optional(),
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
  environmentId: z.string().nullable().optional(),
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

const V2TurnLifecycleParamsSchema = z.object({
  threadId: z.string().min(1),
  turn: z.record(z.unknown())
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

const V2WireEnvelopeSchema = z.object({
  id: JsonRpcRequestIdSchema.optional(),
  method: z.string().min(1),
  params: z.unknown().refine((value) => value !== undefined, "params is required")
}).strict();

const V2FileChangeApprovalRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("item/fileChange/requestApproval"),
  params: CodexAppServerV2FileChangeApprovalParamsSchema
}).strict();

const V2CommandExecutionApprovalRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("item/commandExecution/requestApproval"),
  params: V2CommandExecutionApprovalParamsSchema
}).strict();

const V2PermissionsApprovalRequestSchema = z.object({
  id: JsonRpcRequestIdSchema,
  method: z.literal("item/permissions/requestApproval"),
  params: V2PermissionsApprovalParamsSchema
}).strict();

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

const V2TurnDiffUpdatedWireSchema = z.object({
  method: z.literal("turn/diff/updated"),
  params: V2TurnDiffUpdatedParamsSchema
}).strict();

const V2ThreadStartedWireSchema = z.object({
  method: z.literal("thread/started"),
  params: V2ThreadStartedParamsSchema
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
  V2FileChangeApprovalRequestSchema,
  V2CommandExecutionApprovalRequestSchema,
  V2PermissionsApprovalRequestSchema,
  V2ItemStartedWireSchema,
  V2ItemCompletedWireSchema,
  V2ServerRequestResolvedWireSchema,
  V2TurnDiffUpdatedWireSchema,
  V2ThreadStartedWireSchema,
  V2TurnStartedWireSchema,
  V2TurnCompletedWireSchema,
  V2RemoteControlStatusWireSchema
]);

const V2CommandApprovalResponseResultSchema = z.object({
  decision: z.enum(["accept", "decline"])
}).strict();

const V2PermissionsApprovalResponseResultSchema = z.object({
  permissions: V2PermissionProfileSchema,
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
  approvalRequestId?: string;
  completed: boolean;
}

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
  reasonCode: z.string().min(1)
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
    if (this.compromisedReason !== undefined) {
      return this.quarantinedResult();
    }
    if (this.sessionState !== "ready") {
      return this.quarantine("v2_session_not_initialized");
    }
    const envelope = V2WireEnvelopeSchema.safeParse(input);
    if (!envelope.success) {
      return this.quarantine("v2_wire_envelope_invalid");
    }
    const message = envelope.data;
    const wireHash = this.wireHash("wire_message", message);
    if (!this.recordWireHash("wire_message", message, wireHash)) {
      return this.quarantine("v2_wire_event_replay");
    }

    if (message.id !== undefined) {
      return this.normalizeRequest(message.method, message.params, message.id);
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
    binding.sentDecision = parsed.data.decision;
    const result = binding.approvalKind === "permission"
      ? {
          permissions: parsed.data.decision === "accept"
            ? binding.requestedPermissions ?? emptyPermissionProfile()
            : emptyPermissionProfile(),
          scope: "turn" as const
        }
      : { decision: parsed.data.decision };
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
    wireRequestId: CodexAppServerV2JsonRpcRequestId
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
              protocol: networkApprovalContext!.protocol
            }
          : {
              kind: "command",
              argv: [command!],
              ...(parsed.data.params.cwd === undefined || parsed.data.params.cwd === null
                ? {}
                : { cwd: parsed.data.params.cwd })
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
        permissionGrant: parsed.data.params.permissions,
        proposal: {
          kind: "permission",
          scope: stableJson({
            cwd: parsed.data.params.cwd,
            environmentId: parsed.data.params.environmentId ?? null,
            permissions: parsed.data.params.permissions
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
        return this.normalizeItemCompleted(parsed.data.params, wireHash);
      }
      case "serverRequest/resolved": {
        const parsed = V2ServerRequestResolvedWireSchema.safeParse({ method, params });
        return parsed.success
          ? this.normalizeRequestResolved(parsed.data.params, wireHash)
          : this.quarantine("v2_request_resolved_schema_invalid", { method });
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

    let evidence: CodexAppServerV2FileChangeEvidence | undefined;
    try {
      evidence = this.fileChangeEvidence({
        threadId: params.threadId,
        turnId: params.turnId,
        itemId: params.item.id,
        changes: params.item.changes.map((change) => ({
          path: change.path,
          kind: change.kind.type,
          ...(change.kind.type === "update" && change.kind.move_path !== undefined
            ? { movePath: change.kind.move_path }
            : {}),
          unifiedDiff: change.diff
        }))
      });
    } catch {
      return this.quarantine("v2_file_change_evidence_provider_failed", {
        method: "item/started"
      });
    }
    const parsedEvidence = EvidenceSchema.safeParse(evidence);
    if (!parsedEvidence.success) {
      return this.quarantine("v2_file_change_evidence_missing", { method: "item/started" });
    }
    const draftChanges = this.createDraftChanges(params.item.changes, parsedEvidence.data);
    if (!draftChanges.success) {
      return this.quarantine(draftChanges.reason, { method: "item/started" });
    }
    const proposedAt = timestampToIso(params.startedAtMs);
    if (proposedAt === undefined) {
      return this.quarantine("v2_item_started_timestamp_invalid", { method: "item/started" });
    }
    let changeSet: ReturnType<typeof canonicalizeGovernedFileChangeSet>;
    try {
      changeSet = canonicalizeGovernedFileChangeSet({
        changeSetId: params.threadId + ":" + params.turnId + ":" + params.item.id,
        threadId: params.threadId,
        turnId: params.turnId,
        itemId: params.item.id,
        baseHead: parsedEvidence.data.baseHead,
        proposedAt,
        sourceSchemaProfile: this.schemaProfileId,
        changes: draftChanges.changes
      });
    } catch {
      return this.quarantine("v2_file_change_canonicalization_failed", {
        method: "item/started"
      });
    }
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
    this.items.set(key, {
      threadId: params.threadId,
      turnId: params.turnId,
      itemId: params.item.id,
      changeSet,
      rawChangeFingerprint: rawChangeFingerprint(params.item),
      completed: false
    });
    return { status: "normalized", event };
  }

  private normalizeManualApproval(input: {
    approvalKind: "command" | "network" | "permission";
    itemId: string;
    method: string;
    permissionGrant?: z.infer<typeof V2PermissionProfileSchema>;
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
    if (this.approvals.has(input.requestId)) {
      return this.quarantine("v2_request_id_collision", {
        method: input.method,
        requestId: input.requestId,
        itemId: input.itemId
      });
    }
    this.approvals.set(input.requestId, {
      approvalKind: input.approvalKind,
      requestId: input.requestId,
      wireRequestId: input.wireRequestId,
      threadId: input.threadId,
      turnId: input.turnId,
      itemId: input.itemId,
      ...(input.permissionGrant === undefined
        ? {}
        : { requestedPermissions: input.permissionGrant }),
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
      proposal: input.proposal,
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
    if (params.grantRoot !== undefined && params.grantRoot !== null) {
      return this.quarantine("v2_file_approval_grant_root_unsupported", {
        method: "item/fileChange/requestApproval",
        requestId
      });
    }
    const existing = this.approvals.get(requestId);
    if (existing !== undefined) {
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
      proposal: { kind: "file_change" },
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
      || rawChangeFingerprint(params.item) !== item.rawChangeFingerprint
      || (item.approvalRequestId !== undefined
        && this.approvals.get(item.approvalRequestId)?.resolved !== true)
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
    const normalization = this.normalizer.normalize(input);
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

function emptyPermissionProfile(): z.infer<typeof V2PermissionProfileSchema> {
  return { fileSystem: null, network: null };
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
