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

export const CodexAppServerV2FileChangeItemSchema = z.object({
  changes: z.array(V2FileChangeSchema).min(1),
  id: z.string().min(1),
  status: z.enum(["inProgress", "completed", "failed", "declined"]),
  type: z.literal("fileChange")
}).strict();

const V2ItemStartedParamsSchema = z.object({
  item: CodexAppServerV2FileChangeItemSchema,
  startedAtMs: TimestampMsSchema,
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

const V2ItemCompletedParamsSchema = z.object({
  completedAtMs: TimestampMsSchema,
  item: CodexAppServerV2FileChangeItemSchema,
  threadId: z.string().min(1),
  turnId: z.string().min(1)
}).strict();

export const CodexAppServerV2FileChangeApprovalParamsSchema = z.object({
  grantRoot: z.string().nullable().optional(),
  itemId: z.string().min(1),
  reason: z.string().nullable().optional(),
  startedAtMs: TimestampMsSchema,
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
  environmentId: z.string().nullable().optional(),
  installationId: z.string(),
  serverName: z.string(),
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
  V2ItemStartedWireSchema,
  V2ItemCompletedWireSchema,
  V2ServerRequestResolvedWireSchema,
  V2TurnDiffUpdatedWireSchema,
  V2ThreadStartedWireSchema,
  V2TurnStartedWireSchema,
  V2TurnCompletedWireSchema,
  V2RemoteControlStatusWireSchema
]);

export const CodexAppServerV2WireApprovalResponseSchema = z.object({
  id: JsonRpcRequestIdSchema,
  result: z.object({
    decision: z.enum(["accept", "decline"])
  }).strict()
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
  requestId: string;
  wireRequestId: CodexAppServerV2JsonRpcRequestId;
  threadId: string;
  turnId: string;
  itemId: string;
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

export class CodexAppServerV2WireNormalizer {
  private readonly schemaProfileId: string;
  private readonly fileChangeEvidence: CodexAppServerV2FileChangeEvidenceProvider;
  private readonly seenWireHashes = new Set<string>();
  private readonly sequenceByTurn = new Map<string, number>();
  private readonly items = new Map<string, TrackedItem>();
  private readonly approvals = new Map<string, ApprovalBinding>();
  private compromisedReason?: string;

  constructor(options: CodexAppServerV2WireNormalizerOptions) {
    if (options.schemaProfileId.trim() === "") {
      throw new Error("v2_wire_schema_profile_invalid");
    }
    this.schemaProfileId = options.schemaProfileId;
    this.fileChangeEvidence = options.fileChangeEvidence;
  }

  normalize(input: unknown): CodexAppServerV2NormalizationResult {
    if (this.compromisedReason !== undefined) {
      return this.quarantinedResult();
    }
    const envelope = V2WireEnvelopeSchema.safeParse(input);
    if (!envelope.success) {
      return this.quarantine("v2_wire_envelope_invalid");
    }
    const message = envelope.data;
    const wireHash = hashKernelObject({
      schemaVersion: "codex-router-app-server-v2-wire-message.v1",
      message
    });
    if (this.seenWireHashes.has(wireHash)) {
      return this.quarantine("v2_wire_event_replay");
    }
    this.seenWireHashes.add(wireHash);

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
    return {
      status: "encoded",
      message: {
        id: binding.wireRequestId,
        result: { decision: parsed.data.decision }
      }
    };
  }

  markApprovalResponseDeliveryUncertain(requestId: string): void {
    if (this.approvals.has(requestId)) {
      this.compromisedReason ??= "v2_approval_response_delivery_uncertain";
    }
  }

  private normalizeRequest(
    method: string,
    params: unknown,
    wireRequestId: CodexAppServerV2JsonRpcRequestId
  ): CodexAppServerV2NormalizationResult {
    if (method !== "item/fileChange/requestApproval") {
      return this.quarantine(
        method === "item/commandExecution/requestApproval"
          || method === "item/permissions/requestApproval"
          ? "v2_manual_approval_wire_codec_required"
          : "v2_server_request_unsupported",
        { method, requestId: canonicalRequestId(wireRequestId) }
      );
    }
    const parsed = V2FileChangeApprovalRequestSchema.safeParse({
      id: wireRequestId,
      method,
      params
    });
    if (!parsed.success) {
      return this.quarantine("v2_file_approval_schema_invalid", {
        method,
        requestId: canonicalRequestId(wireRequestId)
      });
    }
    return this.normalizeFileApproval(parsed.data.params, wireRequestId, hashKernelObject({
      schemaVersion: "codex-router-app-server-v2-wire-approval.v1",
      method,
      params,
      requestId: wireRequestId
    }));
  }

  private normalizeNotification(
    method: string,
    params: unknown,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    switch (method) {
      case "item/started": {
        const parsed = V2ItemStartedWireSchema.safeParse({ method, params });
        return parsed.success
          ? this.normalizeItemStarted(parsed.data.params, wireHash)
          : this.quarantine("v2_item_started_schema_invalid", { method });
      }
      case "item/completed": {
        const parsed = V2ItemCompletedWireSchema.safeParse({ method, params });
        return parsed.success
          ? this.normalizeItemCompleted(parsed.data.params, wireHash)
          : this.quarantine("v2_item_completed_schema_invalid", { method });
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
        return parsed.success
          ? { status: "ignored", method }
          : this.quarantine("v2_remote_control_status_schema_invalid", { method });
      }
      default:
        return this.quarantine("v2_wire_method_unsupported", { method });
    }
  }

  private normalizeItemStarted(
    params: z.infer<typeof V2ItemStartedParamsSchema>,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    if (params.item.status !== "inProgress") {
      return this.quarantine("v2_item_started_status_invalid", { method: "item/started" });
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

  private normalizeFileApproval(
    params: CodexAppServerV2FileChangeApprovalParams,
    wireRequestId: CodexAppServerV2JsonRpcRequestId,
    wireHash: string
  ): CodexAppServerV2NormalizationResult {
    const requestId = canonicalRequestId(wireRequestId);
    const key = itemKey(params.threadId, params.turnId, params.itemId);
    const item = this.items.get(key);
    if (item === undefined || item.approvalRequestId !== undefined) {
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
    if (
      existing !== undefined
      && hashKernelObject(existing.wireRequestId) !== hashKernelObject(wireRequestId)
    ) {
      return this.quarantine("v2_request_id_collision", {
        method: "item/fileChange/requestApproval",
        requestId
      });
    }
    item.approvalRequestId = requestId;
    this.approvals.set(requestId, {
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
      resolution: approval.sentDecision ?? "unknown"
    };
    return { status: "normalized", event };
  }

  private normalizeItemCompleted(
    params: z.infer<typeof V2ItemCompletedParamsSchema>,
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
      reasons: uniqueStrings([
        "v2_session_quarantined",
        this.compromisedReason ?? "v2_session_quarantined"
      ])
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

function canonicalRequestId(id: CodexAppServerV2JsonRpcRequestId): string {
  return typeof id === "string" ? id : String(id);
}

function itemKey(threadId: string, turnId: string, itemId: string): string {
  return threadId + ":" + turnId + ":" + itemId;
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
