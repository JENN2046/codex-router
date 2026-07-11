import { z } from "zod";
import {
  AuthorizationDecisionSchema,
  CapabilityScopeSchema,
  GovernedFileChangeKindSchema,
  PreviewPolicySchema,
  hashKernelObject,
  type AuthorizationDecision,
  type CapabilityFacts,
  type CapabilityScope,
  type FileChangeLifecycleState,
  type GovernanceRiskLevel,
  type GovernedFileChangeSet,
  type PreviewPolicy,
  type PreviewReceipt,
  type RetainPermit,
  type RetainReceipt
} from "../../kernel-contracts/src/index.js";
import {
  authorizeCapabilityFacts,
  classifySemanticRiskSignal,
  deriveCapabilityFactsFromChangeSet
} from "../../authorization-kernel/src/index.js";
import {
  canonicalizeGovernedFileChangeSet,
  getTrustedPreviewerAttestation,
  PreviewIsolationAttestationSchema,
  type FileChangePreviewer,
  type GovernedFileChangeDraft,
  type PreviewIsolationAttestation
} from "../../file-change-preview/src/index.js";
import {
  createPendingApprovalJournalEntry,
  issueRetainPermit,
  verifyRetainedChange,
  type PendingApprovalJournalEntry,
  type PendingApprovalJournalStore
} from "../../retain-control/src/index.js";

export const AppServerSessionAttestationSchema = z.object({
  schemaVersion: z.literal("app-server-session-attestation.v1").default(
    "app-server-session-attestation.v1"
  ),
  sessionId: z.string().min(1),
  schemaProfileId: z.string().min(1),
  codexVersion: z.string().min(1),
  effectiveApprovalPolicy: z.enum(["on-request", "never", "untrusted", "unknown"]),
  effectiveSandboxPolicy: z.enum([
    "read-only",
    "workspace-write",
    "danger-full-access",
    "unknown"
  ]),
  fileChangeApprovalInterceptionProven: z.boolean(),
  evidenceSource: z.enum(["fake_fixture", "generated_schema", "live_acceptance"]),
  scope: z.enum(["test_only", "live"]),
  attestedAt: z.string().min(1)
}).strict();

const NormalizedEventBaseSchema = z.object({
  schemaVersion: z.literal("codex-app-server-normalized-event.v1"),
  schemaProfileId: z.string().min(1),
  eventId: z.string().min(1)
}).strict();

const TurnEventBaseSchema = NormalizedEventBaseSchema.extend({
  sequence: z.number().int().positive(),
  threadId: z.string().min(1),
  turnId: z.string().min(1)
});

export const CodexApprovalProposalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("file_change") }).strict(),
  z.object({
    kind: z.literal("command"),
    argv: z.array(z.string()).min(1),
    cwd: z.string().min(1).optional()
  }).strict(),
  z.object({
    kind: z.literal("permission"),
    scope: z.string().min(1)
  }).strict()
]);

export const CodexAppServerNormalizedEventSchema = z.discriminatedUnion("eventType", [
  TurnEventBaseSchema.extend({
    eventType: z.literal("item_started"),
    item: z.object({
      itemId: z.string().min(1),
      itemType: z.literal("file_change"),
      baseHead: z.string().min(1),
      proposedAt: z.string().min(1),
      changes: z.array(z.object({
        path: z.string().min(1),
        kind: GovernedFileChangeKindSchema,
        oldPath: z.string().min(1).optional(),
        unifiedDiff: z.string().min(1),
        beforeHash: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
        afterHash: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional()
      }).strict()).min(1)
    }).strict()
  }),
  TurnEventBaseSchema.extend({
    eventType: z.literal("approval_requested"),
    requestId: z.string().min(1),
    itemId: z.string().min(1),
    proposal: CodexApprovalProposalSchema,
    semanticContext: z.string().optional()
  }),
  TurnEventBaseSchema.extend({
    eventType: z.literal("request_resolved"),
    requestId: z.string().min(1),
    itemId: z.string().min(1),
    resolution: z.enum(["accept", "decline", "cancelled", "unknown"])
  }),
  TurnEventBaseSchema.extend({
    eventType: z.literal("item_completed"),
    itemId: z.string().min(1),
    outcome: z.enum(["applied", "not_applied", "unknown"])
  }),
  NormalizedEventBaseSchema.extend({
    eventType: z.literal("transport_disconnected")
  })
]);

export const CodexAppServerApprovalResponseSchema = z.object({
  schemaVersion: z.literal("codex-app-server-normalized-response.v1"),
  schemaProfileId: z.string().min(1),
  requestId: z.string().min(1),
  decision: z.enum(["accept", "decline"]),
  reasonCode: z.string().min(1)
}).strict();

export type AppServerSessionAttestation = z.infer<typeof AppServerSessionAttestationSchema>;
export type CodexAppServerNormalizedEvent = z.infer<typeof CodexAppServerNormalizedEventSchema>;
export type CodexAppServerApprovalResponse = z.infer<typeof CodexAppServerApprovalResponseSchema>;
export type CodexApprovalProposal = z.infer<typeof CodexApprovalProposalSchema>;
export type CodexAppServerAuthorizationMode = "authorization_enforced" | "observe_only";

export interface CodexAppServerMessageTransport {
  send(message: CodexAppServerApprovalResponse): Promise<void>;
}

export interface CodexWorkspaceContext {
  repoRoot: string;
  repository: CapabilityFacts["repository"];
  networkAccess?: CapabilityFacts["networkAccess"];
  credentialAccess?: CapabilityFacts["credentialAccess"];
  externalTargets?: string[];
  releaseAction?: boolean;
  exactTargets?: boolean;
  ambiguous?: boolean;
  unknowns?: string[];
}

export interface CodexWorkspaceContextProvider {
  getContext(changeSet: GovernedFileChangeSet): Promise<CodexWorkspaceContext>;
}

export interface CodexAppServerAdapterOptions {
  sessionAttestation: AppServerSessionAttestation;
  transport: CodexAppServerMessageTransport;
  journalStore: PendingApprovalJournalStore;
  previewer: FileChangePreviewer;
  previewPolicy: PreviewPolicy;
  previewIsolation: PreviewIsolationAttestation;
  workspaceContextProvider: CodexWorkspaceContextProvider;
  capabilityCeiling: CapabilityScope[];
  allowTestProfiles?: boolean;
  semanticRisk?: (
    changeSet: GovernedFileChangeSet,
    context: string | undefined
  ) => GovernanceRiskLevel;
  now?: () => string;
  retainPermitTtlMs?: number;
  nonce?: (requestId: string) => string;
}

export type CodexAdapterOutcomeStatus =
  | "proposed"
  | "manual_required"
  | "accepted"
  | "retained"
  | "observed"
  | "blocked"
  | "reconciliation_required";

export interface CodexAdapterOutcome {
  status: CodexAdapterOutcomeStatus;
  mode: CodexAppServerAuthorizationMode;
  reasons: string[];
  requestId?: string;
  itemId?: string;
  lifecycleState?: FileChangeLifecycleState;
  authorizationDecision?: AuthorizationDecision;
  previewReceipt?: PreviewReceipt;
  retainReceipt?: RetainReceipt;
  approvalProposal?: CodexApprovalProposal;
}

type TurnRecord = {
  lastSequence: number;
  blocked: boolean;
  completedItems: Set<string>;
};

type ItemRecord = {
  key: string;
  threadId: string;
  turnId: string;
  itemId: string;
  changeSet: GovernedFileChangeSet;
  state: FileChangeLifecycleState;
  approvalRequestId?: string;
  authorizationDecision?: AuthorizationDecision;
  previewReceipt?: PreviewReceipt;
  retainPermit?: RetainPermit;
  retainReceipt?: RetainReceipt;
  journalId?: string;
  repoRoot?: string;
};

type ApprovalRecord = {
  requestId: string;
  threadId: string;
  turnId: string;
  itemId: string;
  proposal: CodexApprovalProposal;
  resolved: boolean;
  sentDecision?: "accept" | "decline";
};

const HumanApprovalInputSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["accept", "decline"]),
  operatorId: z.string().min(1),
  nonce: z.string().min(1).optional()
}).strict();

type HumanApprovalInput = z.infer<typeof HumanApprovalInputSchema>;

export class CodexAppServerAdapter {
  private readonly attestation: AppServerSessionAttestation;
  private readonly mode: CodexAppServerAuthorizationMode;
  private readonly transport: CodexAppServerMessageTransport;
  private readonly journalStore: PendingApprovalJournalStore;
  private readonly previewer: FileChangePreviewer;
  private readonly previewPolicy: PreviewPolicy;
  private readonly previewIsolation: PreviewIsolationAttestation;
  private readonly workspaceContextProvider: CodexWorkspaceContextProvider;
  private readonly capabilityCeiling: CapabilityScope[];
  private readonly semanticRisk: NonNullable<CodexAppServerAdapterOptions["semanticRisk"]>;
  private readonly now: () => string;
  private readonly retainPermitTtlMs: number;
  private readonly nonce: (requestId: string) => string;
  private readonly seenEventIds = new Set<string>();
  private readonly turns = new Map<string, TurnRecord>();
  private readonly items = new Map<string, ItemRecord>();
  private readonly approvals = new Map<string, ApprovalRecord>();
  private readonly ownedJournalIds = new Set<string>();
  private serialTail: Promise<void> = Promise.resolve();
  private sessionCompromisedReason?: string;

  constructor(options: CodexAppServerAdapterOptions) {
    this.attestation = AppServerSessionAttestationSchema.parse(options.sessionAttestation);
    const trustedPreviewer = getTrustedPreviewerAttestation(options.previewer);
    const previewIsolation = PreviewIsolationAttestationSchema.parse(options.previewIsolation);
    this.mode = resolveAuthorizationMode(
      this.attestation,
      options.allowTestProfiles ?? false,
      trustedPreviewer,
      previewIsolation
    );
    this.transport = options.transport;
    this.journalStore = options.journalStore;
    this.previewer = options.previewer;
    this.previewPolicy = PreviewPolicySchema.parse(options.previewPolicy);
    this.previewIsolation = previewIsolation;
    this.workspaceContextProvider = options.workspaceContextProvider;
    this.capabilityCeiling = options.capabilityCeiling.map((scope) => (
      CapabilityScopeSchema.parse(scope)
    ));
    this.semanticRisk = options.semanticRisk
      ?? ((_changeSet, context) => classifySemanticRiskSignal(context ?? "structured file change"));
    this.now = options.now ?? (() => new Date().toISOString());
    this.retainPermitTtlMs = options.retainPermitTtlMs ?? 5 * 60 * 1000;
    this.nonce = options.nonce ?? ((requestId) => (
      hashKernelObject({
        schemaVersion: "codex-adapter-retain-nonce.v1",
        sessionId: this.attestation.sessionId,
        requestId,
        now: this.now()
      })
    ));
  }

  get authorizationMode(): CodexAppServerAuthorizationMode {
    return this.mode;
  }

  async ingest(input: unknown): Promise<CodexAdapterOutcome> {
    return this.serialize(() => this.ingestSerialized(input));
  }

  private async ingestSerialized(input: unknown): Promise<CodexAdapterOutcome> {
    await this.ensureJournalContinuity();
    if (this.sessionCompromisedReason !== undefined) {
      return this.quarantinedOutcome();
    }
    const parsed = CodexAppServerNormalizedEventSchema.safeParse(input);
    if (!parsed.success) {
      await this.quarantineSession("app_server_schema_drift");
      return this.quarantinedOutcome();
    }
    const event = parsed.data;
    if (event.schemaProfileId !== this.attestation.schemaProfileId) {
      await this.quarantineSession("app_server_schema_profile_mismatch");
      return this.quarantinedOutcome();
    }
    if (this.seenEventIds.has(event.eventId)) {
      await this.quarantineSession("app_server_event_replay");
      return this.quarantinedOutcome();
    }
    this.seenEventIds.add(event.eventId);

    if (event.eventType === "transport_disconnected") {
      await this.quarantineSession("app_server_transport_disconnected");
      return this.quarantinedOutcome();
    }

    const sequenceReason = this.acceptSequence(event.threadId, event.turnId, event.sequence);
    if (sequenceReason !== undefined) {
      await this.markTurnForReconciliation(event.threadId, event.turnId, sequenceReason);
      return this.outcome("reconciliation_required", [sequenceReason], {
        itemId: event.eventType === "item_started" ? event.item.itemId : event.itemId
      });
    }

    switch (event.eventType) {
      case "item_started":
        return this.handleItemStarted(event);
      case "approval_requested":
        return this.handleApprovalRequested(event);
      case "request_resolved":
        return this.handleRequestResolved(event);
      case "item_completed":
        return this.handleItemCompleted(event);
    }
  }

  async resolveHumanApproval(input: HumanApprovalInput): Promise<CodexAdapterOutcome> {
    return this.serialize(async () => {
      const parsed = HumanApprovalInputSchema.safeParse(input);
      if (!parsed.success) {
        return this.outcome("blocked", ["human_approval_input_invalid"]);
      }
      return this.resolveHumanApprovalSerialized(parsed.data);
    });
  }

  private async resolveHumanApprovalSerialized(
    input: HumanApprovalInput
  ): Promise<CodexAdapterOutcome> {
    await this.ensureJournalContinuity();
    if (this.sessionCompromisedReason !== undefined) {
      return this.quarantinedOutcome({ requestId: input.requestId });
    }
    const approval = this.approvals.get(input.requestId);
    if (
      approval === undefined
      || approval.resolved
      || approval.sentDecision !== undefined
      || this.turn(approval.threadId, approval.turnId).blocked
    ) {
      return this.outcome("blocked", ["human_approval_request_unavailable"], {
        requestId: input.requestId
      });
    }

    if (input.decision === "decline") {
      const sent = await this.sendDecision(approval, "decline", "operator_declined");
      const item = this.items.get(itemKey(approval.threadId, approval.turnId, approval.itemId));
      if (item !== undefined) {
        transitionItem(item, "blocked");
      }
      return this.outcome(sent ? "blocked" : "reconciliation_required", [
        sent ? "operator_declined" : "approval_response_send_failed"
      ], {
        requestId: input.requestId,
        itemId: approval.itemId,
        ...(item === undefined ? {} : { lifecycleState: item.state })
      });
    }

    if (approval.proposal.kind !== "file_change") {
      const sent = await this.sendDecision(approval, "accept", "operator_approved");
      return this.outcome(sent ? "accepted" : "reconciliation_required", [
        sent ? `human_${approval.proposal.kind}_approval` : "approval_response_send_failed"
      ], {
        requestId: input.requestId,
        itemId: approval.itemId,
        approvalProposal: approval.proposal
      });
    }

    const item = this.items.get(itemKey(approval.threadId, approval.turnId, approval.itemId));
    if (item === undefined) {
      await this.sendDecision(approval, "decline", "missing_governance_context");
      return this.outcome("blocked", ["missing_governance_context"], {
        requestId: input.requestId,
        itemId: approval.itemId
      });
    }
    if (this.mode !== "authorization_enforced") {
      const sent = await this.sendDecision(approval, "accept", "operator_approved_observe_only");
      return this.outcome(sent ? "observed" : "reconciliation_required", [
        "session_observe_only_no_governed_retain_claim"
      ], { requestId: input.requestId, itemId: approval.itemId });
    }
    if (item.authorizationDecision === undefined || item.repoRoot === undefined) {
      await this.sendDecision(approval, "decline", "missing_governance_context");
      transitionItem(item, "blocked");
      return this.outcome("blocked", ["missing_governance_context"], {
        requestId: input.requestId,
        itemId: approval.itemId,
        lifecycleState: item.state
      });
    }
    if (item.authorizationDecision.disposition === "blocked") {
      await this.sendDecision(approval, "decline", "authorization_blocked");
      transitionItem(item, "blocked");
      return this.outcome("blocked", ["authorization_blocked"], {
        requestId: input.requestId,
        itemId: approval.itemId,
        lifecycleState: item.state,
        authorizationDecision: item.authorizationDecision
      });
    }
    const humanAuthorization = AuthorizationDecisionSchema.parse({
      ...item.authorizationDecision,
      approvalMode: "human_required",
      disposition: "approval_required",
      approvalRequired: true,
      reasons: uniqueStrings([
        ...item.authorizationDecision.reasons,
        `operator_approval:${input.operatorId}`
      ])
    });
    item.authorizationDecision = humanAuthorization;
    const accepted = await this.persistAndAccept({
      item,
      approval,
      authorization: humanAuthorization,
      nonce: input.nonce ?? this.nonce(input.requestId),
      reasonCode: "operator_approved"
    });
    return accepted;
  }

  getItemSnapshot(threadId: string, turnId: string, itemId: string): Readonly<{
    state: FileChangeLifecycleState;
    changeSetHash: string;
    requestId?: string;
  }> | undefined {
    const item = this.items.get(itemKey(threadId, turnId, itemId));
    return item === undefined
      ? undefined
      : {
          state: item.state,
          changeSetHash: item.changeSet.canonicalHash,
          ...(item.approvalRequestId === undefined ? {} : { requestId: item.approvalRequestId })
        };
  }

  private handleItemStarted(
    event: Extract<CodexAppServerNormalizedEvent, { eventType: "item_started" }>
  ): CodexAdapterOutcome {
    const key = itemKey(event.threadId, event.turnId, event.item.itemId);
    if (this.items.has(key)) {
      this.turn(event.threadId, event.turnId).blocked = true;
      return this.outcome("blocked", ["duplicate_item_started"], {
        itemId: event.item.itemId
      });
    }
    try {
      const changeSet = canonicalizeGovernedFileChangeSet({
        changeSetId: `${event.threadId}:${event.turnId}:${event.item.itemId}`,
        threadId: event.threadId,
        turnId: event.turnId,
        itemId: event.item.itemId,
        baseHead: event.item.baseHead,
        proposedAt: event.item.proposedAt,
        sourceSchemaProfile: event.schemaProfileId,
        changes: event.item.changes.map((change) => ({
          path: change.path,
          kind: change.kind,
          ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
          unifiedDiff: change.unifiedDiff,
          ...(change.beforeHash === undefined ? {} : { beforeHash: change.beforeHash }),
          ...(change.afterHash === undefined ? {} : { afterHash: change.afterHash })
        }))
      });
      this.items.set(key, {
        key,
        threadId: event.threadId,
        turnId: event.turnId,
        itemId: event.item.itemId,
        changeSet,
        state: "proposed"
      });
      return this.outcome("proposed", [], {
        itemId: event.item.itemId,
        lifecycleState: "proposed"
      });
    } catch {
      this.turn(event.threadId, event.turnId).blocked = true;
      return this.outcome("blocked", ["file_change_canonicalization_failed"], {
        itemId: event.item.itemId
      });
    }
  }

  private async handleApprovalRequested(
    event: Extract<CodexAppServerNormalizedEvent, { eventType: "approval_requested" }>
  ): Promise<CodexAdapterOutcome> {
    if (this.approvals.has(event.requestId)) {
      return this.declineInvalidRequest(event, "duplicate_approval_request_id");
    }
    const approval: ApprovalRecord = {
      requestId: event.requestId,
      threadId: event.threadId,
      turnId: event.turnId,
      itemId: event.itemId,
      proposal: event.proposal,
      resolved: false
    };
    this.approvals.set(event.requestId, approval);

    if (event.proposal.kind === "command" || event.proposal.kind === "permission") {
      return this.outcome("manual_required", [
        `${event.proposal.kind}_policy_auto_forbidden`
      ], {
        requestId: event.requestId,
        itemId: event.itemId,
        approvalProposal: event.proposal
      });
    }

    const item = this.items.get(itemKey(event.threadId, event.turnId, event.itemId));
    if (
      item === undefined
      || item.approvalRequestId !== undefined
      || this.turn(event.threadId, event.turnId).blocked
      || this.turn(event.threadId, event.turnId).completedItems.has(event.itemId)
    ) {
      return this.declineInvalidRequest(event, "file_approval_correlation_failed");
    }
    item.approvalRequestId = event.requestId;

    if (item.changeSet.changes.some((change) => (
      change.kind === "delete" || change.kind === "rename"
    ))) {
      transitionItem(item, "blocked");
      await this.sendDecision(approval, "decline", "destructive_file_change_unsupported");
      return this.outcome("blocked", ["destructive_file_change_unsupported"], {
        requestId: event.requestId,
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }
    if (item.changeSet.changes.some((change) => (
      change.afterHash === undefined
      || change.afterHash === null
      || (change.kind === "update" && (change.beforeHash === undefined || change.beforeHash === null))
    ))) {
      transitionItem(item, "blocked");
      await this.sendDecision(approval, "decline", "file_change_expected_hash_missing");
      return this.outcome("blocked", ["file_change_expected_hash_missing"], {
        requestId: event.requestId,
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }

    if (this.mode !== "authorization_enforced") {
      transitionItem(item, "awaiting_approval");
      return this.outcome("manual_required", ["session_observe_only"], {
        requestId: event.requestId,
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }

    let context: CodexWorkspaceContext;
    try {
      context = await this.workspaceContextProvider.getContext(item.changeSet);
    } catch {
      transitionItem(item, "blocked");
      await this.sendDecision(approval, "decline", "workspace_context_unavailable");
      return this.outcome("blocked", ["workspace_context_unavailable"], {
        requestId: event.requestId,
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }
    item.repoRoot = context.repoRoot;
    const facts = deriveCapabilityFactsFromChangeSet(item.changeSet, {
      repository: context.repository,
      ...(context.networkAccess === undefined ? {} : { networkAccess: context.networkAccess }),
      ...(context.credentialAccess === undefined
        ? {}
        : { credentialAccess: context.credentialAccess }),
      ...(context.externalTargets === undefined
        ? {}
        : { externalTargets: context.externalTargets }),
      ...(context.releaseAction === undefined ? {} : { releaseAction: context.releaseAction }),
      ...(context.exactTargets === undefined ? {} : { exactTargets: context.exactTargets }),
      ...(context.ambiguous === undefined ? {} : { ambiguous: context.ambiguous }),
      ...(context.unknowns === undefined ? {} : { unknowns: context.unknowns })
    });
    const requestedCapabilities = item.changeSet.changes.map((change) => (
      CapabilityScopeSchema.parse({
        kind: "file",
        resource: change.path,
        access: "write",
        constraints: {}
      })
    ));
    const authorization = authorizeCapabilityFacts({
      surface: "codex_app_server",
      facts,
      semanticRisk: this.semanticRisk(item.changeSet, event.semanticContext),
      requestedCapabilities,
      capabilityCeiling: this.capabilityCeiling,
      createdAt: this.now()
    });
    item.authorizationDecision = authorization;
    transitionItem(item, "policy_checked");
    if (authorization.disposition === "blocked") {
      transitionItem(item, "blocked");
      await this.sendDecision(approval, "decline", "authorization_blocked");
      return this.outcome("blocked", authorization.reasons, {
        requestId: event.requestId,
        itemId: event.itemId,
        lifecycleState: item.state,
        authorizationDecision: authorization
      });
    }
    if (authorization.approvalMode !== "policy_auto") {
      transitionItem(item, "awaiting_approval");
      return this.outcome("manual_required", authorization.reasons, {
        requestId: event.requestId,
        itemId: event.itemId,
        lifecycleState: item.state,
        authorizationDecision: authorization
      });
    }

    transitionItem(item, "previewing");
    const preview = await this.previewer.preview({
      repoRoot: context.repoRoot,
      changeSet: item.changeSet,
      facts,
      policy: this.previewPolicy,
      isolation: this.previewIsolation,
      now: this.now
    });
    item.previewReceipt = preview;
    if (preview.status !== "preview_passed") {
      transitionItem(item, "awaiting_approval");
      return this.outcome("manual_required", preview.reasons, {
        requestId: event.requestId,
        itemId: event.itemId,
        lifecycleState: item.state,
        authorizationDecision: authorization,
        previewReceipt: preview
      });
    }
    transitionItem(item, "preview_passed");
    transitionItem(item, "auto_approved");
    return this.persistAndAccept({
      item,
      approval,
      authorization,
      preview,
      nonce: this.nonce(event.requestId),
      reasonCode: "policy_auto_preview_passed"
    });
  }

  private async handleRequestResolved(
    event: Extract<CodexAppServerNormalizedEvent, { eventType: "request_resolved" }>
  ): Promise<CodexAdapterOutcome> {
    const approval = this.approvals.get(event.requestId);
    const correlates = approval !== undefined
      && approval.itemId === event.itemId
      && approval.threadId === event.threadId
      && approval.turnId === event.turnId;
    if (
      correlates
      && approval !== undefined
      && approval.sentDecision === undefined
      && !approval.resolved
      && event.resolution === "cancelled"
    ) {
      approval.resolved = true;
      await this.markTurnForReconciliation(
        event.threadId,
        event.turnId,
        "approval_request_cancelled"
      );
      return this.outcome("blocked", ["approval_request_cancelled"], {
        requestId: event.requestId,
        itemId: event.itemId
      });
    }
    if (
      correlates
      && approval !== undefined
      && approval.sentDecision !== undefined
      && !approval.resolved
      && event.resolution === "cancelled"
    ) {
      approval.resolved = true;
      await this.markTurnForReconciliation(
        event.threadId,
        event.turnId,
        "approval_cancelled_after_decision"
      );
      return this.outcome("reconciliation_required", [
        "approval_cancelled_after_decision"
      ], { requestId: event.requestId, itemId: event.itemId });
    }
    if (
      approval === undefined
      || approval.itemId !== event.itemId
      || approval.threadId !== event.threadId
      || approval.turnId !== event.turnId
      || approval.sentDecision === undefined
      || approval.resolved
      || (event.resolution !== approval.sentDecision && event.resolution !== "cancelled")
    ) {
      if (correlates && approval !== undefined) {
        approval.resolved = true;
      }
      await this.markTurnForReconciliation(
        event.threadId,
        event.turnId,
        "approval_resolution_correlation_failed"
      );
      return this.outcome("reconciliation_required", [
        "approval_resolution_correlation_failed"
      ], { requestId: event.requestId, itemId: event.itemId });
    }
    approval.resolved = true;
    return this.outcome(
      approval.sentDecision === "accept" ? "accepted" : "blocked",
      [],
      { requestId: event.requestId, itemId: event.itemId }
    );
  }

  private async handleItemCompleted(
    event: Extract<CodexAppServerNormalizedEvent, { eventType: "item_completed" }>
  ): Promise<CodexAdapterOutcome> {
    const turn = this.turn(event.threadId, event.turnId);
    if (turn.completedItems.has(event.itemId)) {
      await this.markTurnForReconciliation(
        event.threadId,
        event.turnId,
        "duplicate_item_completion"
      );
      return this.outcome("reconciliation_required", ["duplicate_item_completion"], {
        itemId: event.itemId
      });
    }
    turn.completedItems.add(event.itemId);
    const item = this.items.get(itemKey(event.threadId, event.turnId, event.itemId));
    if (item === undefined) {
      return this.outcome("reconciliation_required", ["item_completion_without_proposal"], {
        itemId: event.itemId
      });
    }
    if (event.outcome === "unknown") {
      await this.markItemReconciliation(item, "app_server_apply_outcome_unknown");
      return this.outcome("reconciliation_required", ["app_server_apply_outcome_unknown"], {
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }
    if (event.outcome === "not_applied") {
      transitionItem(item, "blocked");
      await this.updateJournalState(item, "blocked", "app_server_change_not_applied");
      return this.outcome("blocked", ["app_server_change_not_applied"], {
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }
    if (this.mode !== "authorization_enforced") {
      return this.outcome("observed", ["session_observe_only_no_governed_retain_claim"], {
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }
    if (
      item.state !== "accepted_by_app_server"
      || item.retainPermit === undefined
      || item.repoRoot === undefined
      || item.journalId === undefined
    ) {
      await this.markItemReconciliation(item, "applied_without_governed_acceptance");
      return this.outcome("reconciliation_required", ["applied_without_governed_acceptance"], {
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }

    const retained = await verifyRetainedChange({
      cwd: item.repoRoot,
      changeSet: item.changeSet,
      permit: item.retainPermit,
      now: this.now()
    });
    if (retained.status !== "retained") {
      await this.markItemReconciliation(item, ...retained.reasons);
      return this.outcome("reconciliation_required", retained.reasons, {
        itemId: event.itemId,
        lifecycleState: item.state
      });
    }
    item.retainReceipt = retained.receipt;
    transitionItem(item, "retained");
    await this.updateJournalState(item, "retained");
    transitionItem(item, "post_checked");
    await this.updateJournalState(item, "post_checked");
    return this.outcome("retained", [], {
      itemId: event.itemId,
      lifecycleState: item.state,
      retainReceipt: retained.receipt
    });
  }

  private async persistAndAccept(input: {
    item: ItemRecord;
    approval: ApprovalRecord;
    authorization: AuthorizationDecision;
    preview?: PreviewReceipt;
    nonce: string;
    reasonCode: string;
  }): Promise<CodexAdapterOutcome> {
    if (this.sessionCompromisedReason !== undefined) {
      await this.markItemReconciliation(input.item, this.sessionCompromisedReason);
      return this.quarantinedOutcome({
        requestId: input.approval.requestId,
        itemId: input.item.itemId,
        lifecycleState: input.item.state
      });
    }
    const issuedAt = this.now();
    const expiresAt = new Date(
      Date.parse(issuedAt) + this.retainPermitTtlMs
    ).toISOString();
    let permit: RetainPermit;
    let journal: PendingApprovalJournalEntry;
    try {
      permit = issueRetainPermit({
        changeSet: input.item.changeSet,
        authorizationDecision: input.authorization,
        ...(input.preview === undefined ? {} : { previewReceipt: input.preview }),
        issuedAt,
        expiresAt,
        nonce: input.nonce
      });
      journal = createPendingApprovalJournalEntry({
        journalId: `journal_${input.approval.requestId}`,
        requestId: input.approval.requestId,
        changeSet: input.item.changeSet,
        authorizationDecision: input.authorization,
        retainPermit: permit,
        ...(input.preview === undefined ? {} : { previewReceipt: input.preview }),
        now: issuedAt
      });
      await this.journalStore.put(journal);
      this.ownedJournalIds.add(journal.journalId);
    } catch {
      transitionItem(input.item, "blocked");
      await this.sendDecision(input.approval, "decline", "pending_journal_persist_failed");
      return this.outcome("blocked", ["pending_journal_persist_failed"], {
        requestId: input.approval.requestId,
        itemId: input.item.itemId,
        lifecycleState: input.item.state,
        authorizationDecision: input.authorization,
        ...(input.preview === undefined ? {} : { previewReceipt: input.preview })
      });
    }
    input.item.retainPermit = permit;
    input.item.journalId = journal.journalId;
    if (this.sessionCompromisedReason !== undefined) {
      await this.markItemReconciliation(input.item, this.sessionCompromisedReason);
      return this.quarantinedOutcome({
        requestId: input.approval.requestId,
        itemId: input.item.itemId,
        lifecycleState: input.item.state
      });
    }
    const sent = await this.sendDecision(input.approval, "accept", input.reasonCode);
    if (!sent) {
      await this.markItemReconciliation(input.item, "approval_response_send_failed");
      return this.outcome("reconciliation_required", ["approval_response_send_failed"], {
        requestId: input.approval.requestId,
        itemId: input.item.itemId,
        lifecycleState: input.item.state,
        authorizationDecision: input.authorization,
        ...(input.preview === undefined ? {} : { previewReceipt: input.preview })
      });
    }
    try {
      await this.updateJournalState(input.item, "accepted");
    } catch {
      await this.markItemReconciliation(input.item, "pending_journal_accept_update_failed");
      return this.outcome("reconciliation_required", [
        "pending_journal_accept_update_failed"
      ], {
        requestId: input.approval.requestId,
        itemId: input.item.itemId,
        lifecycleState: input.item.state
      });
    }
    transitionItem(input.item, "accepted_by_app_server");
    return this.outcome("accepted", [], {
      requestId: input.approval.requestId,
      itemId: input.item.itemId,
      lifecycleState: input.item.state,
      authorizationDecision: input.authorization,
      ...(input.preview === undefined ? {} : { previewReceipt: input.preview })
    });
  }

  private async declineInvalidRequest(
    event: Extract<CodexAppServerNormalizedEvent, { eventType: "approval_requested" }>,
    reason: string
  ): Promise<CodexAdapterOutcome> {
    const record = this.approvals.get(event.requestId) ?? {
      requestId: event.requestId,
      threadId: event.threadId,
      turnId: event.turnId,
      itemId: event.itemId,
      proposal: event.proposal,
      resolved: false
    };
    this.approvals.set(event.requestId, record);
    const sent = await this.sendDecision(record, "decline", reason);
    return this.outcome(sent ? "blocked" : "reconciliation_required", [reason], {
      requestId: event.requestId,
      itemId: event.itemId
    });
  }

  private async sendDecision(
    approval: ApprovalRecord,
    decision: "accept" | "decline",
    reasonCode: string
  ): Promise<boolean> {
    if (
      approval.sentDecision !== undefined
      || approval.resolved
      || (
        decision === "accept"
        && (
          this.sessionCompromisedReason !== undefined
          || this.turn(approval.threadId, approval.turnId).blocked
        )
      )
    ) {
      return false;
    }
    const response = CodexAppServerApprovalResponseSchema.parse({
      schemaVersion: "codex-app-server-normalized-response.v1",
      schemaProfileId: this.attestation.schemaProfileId,
      requestId: approval.requestId,
      decision,
      reasonCode
    });
    try {
      await this.transport.send(response);
      approval.sentDecision = decision;
      return true;
    } catch {
      return false;
    }
  }

  private acceptSequence(threadId: string, turnId: string, sequence: number): string | undefined {
    const turn = this.turn(threadId, turnId);
    if (turn.blocked) {
      return "turn_already_blocked";
    }
    if (sequence !== turn.lastSequence + 1) {
      turn.blocked = true;
      return sequence <= turn.lastSequence
        ? "app_server_event_out_of_order"
        : "app_server_event_gap";
    }
    turn.lastSequence = sequence;
    return undefined;
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.serialTail.then(operation);
    this.serialTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private turn(threadId: string, turnId: string): TurnRecord {
    const key = turnKey(threadId, turnId);
    let turn = this.turns.get(key);
    if (turn === undefined) {
      turn = { lastSequence: 0, blocked: false, completedItems: new Set() };
      this.turns.set(key, turn);
    }
    return turn;
  }

  private async quarantineSession(reason: string): Promise<void> {
    this.sessionCompromisedReason ??= reason;
    for (const turn of this.turns.values()) {
      turn.blocked = true;
    }
    await this.markAllOpenForReconciliation(this.sessionCompromisedReason);
  }

  private async markAllOpenForReconciliation(reason: string): Promise<number> {
    let affected = 0;
    for (const item of this.items.values()) {
      if (
        item.state !== "post_checked"
        && item.state !== "blocked"
        && item.state !== "reconciliation_required"
      ) {
        affected += 1;
        await this.markItemReconciliation(item, reason);
      }
    }
    return affected;
  }

  private async ensureJournalContinuity(): Promise<void> {
    if (this.sessionCompromisedReason !== undefined) {
      return;
    }
    try {
      const unresolved = (await this.journalStore.list()).filter((entry) => (
        !this.ownedJournalIds.has(entry.journalId)
        && (
          entry.state === "pending_accept"
          || entry.state === "accepted"
          || entry.state === "retained"
          || entry.state === "reconciliation_required"
        )
      ));
      if (unresolved.length > 0) {
        await this.quarantineSession("adapter_restart_with_unresolved_journal");
      }
    } catch {
      await this.quarantineSession("pending_journal_continuity_check_failed");
    }
  }

  private quarantinedOutcome(
    details: Omit<CodexAdapterOutcome, "status" | "mode" | "reasons"> = {}
  ): CodexAdapterOutcome {
    return this.outcome("reconciliation_required", [
      "app_server_session_quarantined",
      this.sessionCompromisedReason ?? "app_server_session_quarantined"
    ], details);
  }

  private async markTurnForReconciliation(
    threadId: string,
    turnId: string,
    reason: string
  ): Promise<void> {
    this.turn(threadId, turnId).blocked = true;
    for (const item of this.items.values()) {
      if (item.threadId === threadId && item.turnId === turnId) {
        await this.markItemReconciliation(item, reason);
      }
    }
  }

  private async markItemReconciliation(item: ItemRecord, ...reasons: string[]): Promise<void> {
    if (item.state !== "post_checked" && item.state !== "blocked") {
      transitionItem(item, "reconciliation_required");
    }
    await this.updateJournalState(
      item,
      "reconciliation_required",
      ...reasons
    ).catch(() => undefined);
  }

  private async updateJournalState(
    item: ItemRecord,
    state: PendingApprovalJournalEntry["state"],
    ...reasons: string[]
  ): Promise<void> {
    if (item.journalId === undefined) {
      return;
    }
    const now = this.now();
    await this.journalStore.update(item.journalId, (current) => ({
      ...current,
      state,
      ...(item.retainReceipt === undefined ? {} : { retainReceipt: item.retainReceipt }),
      reasons: uniqueStrings([...current.reasons, ...reasons]),
      updatedAt: now
    }));
  }

  private outcome(
    status: CodexAdapterOutcomeStatus,
    reasons: string[],
    details: Omit<CodexAdapterOutcome, "status" | "mode" | "reasons"> = {}
  ): CodexAdapterOutcome {
    return {
      status,
      mode: this.mode,
      reasons: uniqueStrings(reasons),
      ...details
    };
  }
}

export interface CodexSdkAdapterOptions {
  capabilityCeiling: CapabilityScope[];
  now?: () => string;
}

export class CodexSdkAdapter {
  private readonly capabilityCeiling: CapabilityScope[];
  private readonly now: () => string;

  constructor(options: CodexSdkAdapterOptions) {
    this.capabilityCeiling = options.capabilityCeiling.map((scope) => (
      CapabilityScopeSchema.parse(scope)
    ));
    this.now = options.now ?? (() => new Date().toISOString());
  }

  authorizeReadOnly(input: {
    facts: CapabilityFacts;
    semanticContext: string;
    requestedCapabilities: CapabilityScope[];
  }): AuthorizationDecision {
    return authorizeCapabilityFacts({
      surface: "codex_sdk",
      facts: input.facts,
      semanticRisk: classifySemanticRiskSignal(input.semanticContext),
      requestedCapabilities: input.requestedCapabilities,
      capabilityCeiling: this.capabilityCeiling.filter((scope) => scope.access === "read"),
      createdAt: this.now()
    });
  }
}

function resolveAuthorizationMode(
  attestation: AppServerSessionAttestation,
  allowTestProfiles: boolean,
  trustedPreviewer: PreviewIsolationAttestation | undefined,
  requestedIsolation: PreviewIsolationAttestation
): CodexAppServerAuthorizationMode {
  const baseProven = attestation.effectiveApprovalPolicy === "on-request"
    && attestation.effectiveSandboxPolicy === "workspace-write"
    && attestation.fileChangeApprovalInterceptionProven;
  // No live OS isolation enforcer ships in 0.1. A live attestation therefore
  // remains observe-only until an in-module, live-scoped enforcer exists.
  const liveProven = attestation.scope === "live"
    && attestation.evidenceSource === "live_acceptance"
    && trustedPreviewer?.scope === "live";
  const testProven = allowTestProfiles
    && attestation.scope === "test_only"
    && attestation.evidenceSource === "fake_fixture"
    && trustedPreviewer?.scope === "test_only";
  const isolationBound = trustedPreviewer !== undefined
    && trustedPreviewer.networkIsolation === "enforced_none"
    && trustedPreviewer.filesystemIsolation === "clone_only_enforced"
    && trustedPreviewer.scope === requestedIsolation.scope
    && trustedPreviewer.enforcerId === requestedIsolation.enforcerId;
  return baseProven && isolationBound && (liveProven || testProven)
    ? "authorization_enforced"
    : "observe_only";
}

function transitionItem(item: ItemRecord, next: FileChangeLifecycleState): void {
  if (item.state === next) {
    return;
  }
  const allowed: Record<FileChangeLifecycleState, FileChangeLifecycleState[]> = {
    proposed: ["policy_checked", "awaiting_approval", "blocked", "reconciliation_required"],
    policy_checked: ["previewing", "awaiting_approval", "blocked", "reconciliation_required"],
    previewing: ["preview_passed", "awaiting_approval", "blocked", "reconciliation_required"],
    preview_passed: ["auto_approved", "awaiting_approval", "blocked", "reconciliation_required"],
    awaiting_approval: ["accepted_by_app_server", "blocked", "reconciliation_required"],
    auto_approved: ["accepted_by_app_server", "blocked", "reconciliation_required"],
    accepted_by_app_server: ["retained", "blocked", "reconciliation_required", "rollback_available"],
    retained: ["post_checked", "reconciliation_required", "rollback_available"],
    post_checked: ["rollback_available"],
    blocked: [],
    reconciliation_required: [],
    rollback_available: ["reconciliation_required"]
  };
  if (!allowed[item.state].includes(next)) {
    throw new Error(`file_change_invalid_transition:${item.state}:${next}`);
  }
  item.state = next;
}

function turnKey(threadId: string, turnId: string): string {
  return `${threadId}\0${turnId}`;
}

function itemKey(threadId: string, turnId: string, itemId: string): string {
  return `${threadId}\0${turnId}\0${itemId}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => (
    left < right ? -1 : left > right ? 1 : 0
  ));
}
