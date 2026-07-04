import { createHash } from "node:crypto";
import { z } from "zod";
import type { GovernanceState } from "../../state-manager/src/index.js";
import type { DelegationLevel } from "../../delegation-policy/src/index.js";
import { filterRecoveryActions } from "../../delegation-policy/src/index.js";
import type {
  ArtifactStore,
  ArtifactVerificationResult,
  StoredArtifact
} from "../../artifact-store/src/index.js";
import type {
  ExecutionObservation,
  ExecutionObservationStore
} from "../../execution-observation/src/index.js";
import {
  EXECUTION_OBSERVATION_REF_PREFIX,
  parseExecutionObservationRef,
  resolveExecutionObservationRef
} from "../../execution-observation/src/index.js";

// ── Recovery action ─────────────────────────────────────────────────────────

export const RecoveryActionSchema = z.enum([
  "resume",
  "rollback",
  "abort",
  "fork"
]);

// ── Recovery recommendation ────────────────────────────────────────────────

export const RecoveryRecommendationReasonSchema = z.enum([
  "first_anomaly_resume_with_monitoring",
  "second_anomaly_require_human_review",
  "third_anomaly_rollback_to_checkpoint",
  "third_anomaly_fork_for_investigation",
  "third_anomaly_abort_without_reversible_action",
  "manual_review_requested"
]);

export const RecoveryRecommendationEvidenceStatusSchema = z.enum([
  "referenced",
  "missing"
]);

export const RecoveryRecommendationSchema = z.object({
  schemaVersion: z.literal("recovery-recommendation.v1").default("recovery-recommendation.v1"),
  action: RecoveryActionSchema,
  reasonCode: RecoveryRecommendationReasonSchema,
  requiresHumanApproval: z.boolean(),
  evidenceStatus: RecoveryRecommendationEvidenceStatusSchema,
  evidenceRefs: z.array(z.string()).default([]),
  checkpointRef: z.string().min(1).optional(),
  summary: z.string().min(1)
}).superRefine((value, ctx) => {
  if (value.evidenceStatus === "missing" && value.evidenceRefs.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceRefs"],
      message: "missing_evidence_status_requires_no_refs"
    });
  }

  if (value.evidenceStatus === "referenced" && value.evidenceRefs.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceRefs"],
      message: "referenced_evidence_status_requires_refs"
    });
  }

  addRecommendationShapeIssues(ctx, value, { action: ["action"] });
});

// ── Arbitration trigger ─────────────────────────────────────────────────────

export const ArbitrationTriggerSchema = z.enum([
  "first_anomaly",
  "second_anomaly",
  "third_anomaly",
  "manual"
]);

// ── Operator action ─────────────────────────────────────────────────────────

export const RecoveryOperatorActionStatusSchema = z.enum([
  "requires_arbitration"
]);

export const RecoveryOperatorActionSchema = z.object({
  schemaVersion: z.literal("recovery-operator-action.v1").default("recovery-operator-action.v1"),
  taskId: z.string().min(1),
  status: RecoveryOperatorActionStatusSchema,
  trigger: ArbitrationTriggerSchema,
  recommendedAction: RecoveryActionSchema,
  reasonCode: RecoveryRecommendationReasonSchema,
  summary: z.string().min(1),
  requiresHumanApproval: z.boolean(),
  lockdown: z.boolean(),
  evidenceStatus: RecoveryRecommendationEvidenceStatusSchema,
  evidenceRefs: z.array(z.string()).default([]),
  checkpointRef: z.string().min(1).optional(),
  availableActions: z.array(RecoveryActionSchema),
  blockingReasons: z.array(z.string()).default([])
}).superRefine((value, ctx) => {
  if (!value.availableActions.includes(value.recommendedAction)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recommendedAction"],
      message: "operator_action_recommendation_unavailable"
    });
  }

  if (value.evidenceStatus === "missing" && value.evidenceRefs.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceRefs"],
      message: "missing_evidence_status_requires_no_refs"
    });
  }

  if (value.evidenceStatus === "referenced" && value.evidenceRefs.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceRefs"],
      message: "referenced_evidence_status_requires_refs"
    });
  }

  addRecommendationShapeIssues(ctx, value, { action: ["recommendedAction"] });

  if (!recommendationReasonMatchesTrigger(value.reasonCode, value.trigger)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonCode"],
      message: "recommendation_trigger_mismatch"
    });
  }

  if (value.trigger === "third_anomaly" && !value.lockdown) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lockdown"],
      message: "operator_action_lockdown_required"
    });
  }
});

// ── Host-consumable operator action envelope ───────────────────────────────

export const GovernanceOperatorActionEnvelopeSourceSchema = z.enum([
  "preflight_governance",
  "execution_governance",
  "desktop_live_governance",
  "host_dispatch_governance"
]);

export const GovernanceOperatorActionEnvelopeSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-envelope.v1")
    .default("governance-operator-action-envelope.v1"),
  source: GovernanceOperatorActionEnvelopeSourceSchema,
  taskId: z.string().min(1),
  status: RecoveryOperatorActionStatusSchema,
  trigger: ArbitrationTriggerSchema,
  recommendedAction: RecoveryActionSchema,
  requiresHumanApproval: z.boolean(),
  lockdown: z.boolean(),
  blockingReasons: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  artifactRefs: z.array(z.string()).default([])
}).superRefine((value, ctx) => {
  if (value.trigger === "third_anomaly" && !value.lockdown) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lockdown"],
      message: "operator_action_envelope_lockdown_required"
    });
  }

  if (
    (value.trigger === "second_anomaly" ||
      value.trigger === "third_anomaly" ||
      value.trigger === "manual") &&
    !value.requiresHumanApproval
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requiresHumanApproval"],
      message: "operator_action_envelope_approval_required"
    });
  }

  for (const ref of value.artifactRefs) {
    if (!isArtifactEvidenceRef(ref) || !value.evidenceRefs.includes(ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["artifactRefs"],
        message: "operator_action_envelope_artifact_refs_must_be_evidence_refs"
      });
    }
  }
});

export const GovernanceOperatorActionSummarySchema = z.object({
  schemaVersion: z.literal("governance-operator-action-summary.v1")
    .default("governance-operator-action-summary.v1"),
  present: z.boolean(),
  source: GovernanceOperatorActionEnvelopeSourceSchema.optional(),
  taskId: z.string().min(1).optional(),
  status: RecoveryOperatorActionStatusSchema.optional(),
  trigger: ArbitrationTriggerSchema.optional(),
  recommendedAction: RecoveryActionSchema.optional(),
  requiresHumanApproval: z.boolean().optional(),
  lockdown: z.boolean().optional(),
  blockingReasons: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  artifactRefs: z.array(z.string()).default([])
}).superRefine((value, ctx) => {
  if (value.present) {
    for (const field of [
      "source",
      "taskId",
      "status",
      "trigger",
      "recommendedAction",
      "requiresHumanApproval",
      "lockdown"
    ] as const) {
      if (value[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "operator_action_summary_present_requires_field"
        });
      }
    }
    return;
  }

  const forbiddenPresentFields = [
    "source",
    "taskId",
    "status",
    "trigger",
    "recommendedAction",
    "requiresHumanApproval",
    "lockdown"
  ] as const;
  for (const field of forbiddenPresentFields) {
    if (value[field] !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: "operator_action_summary_absent_forbids_field"
      });
    }
  }

  if (
    value.blockingReasons.length > 0 ||
    value.evidenceRefs.length > 0 ||
    value.artifactRefs.length > 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["present"],
      message: "operator_action_summary_absent_requires_empty_refs"
    });
  }
});

// ── Host-consumable operator action lifecycle ────────────────────────────────

const GOVERNANCE_OPERATOR_ACTION_REF_PREFIX = "governance-operator-action:";
const DEFAULT_OPERATOR_ACTION_RECEIPT_MAX_AGE_MS = 15 * 60 * 1000;

export const GovernanceOperatorActionReceiptDecisionSchema = z.enum([
  "acknowledged",
  "rejected",
  "deferred",
  "consumed"
]);

export const GovernanceOperatorActionReceiptSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-receipt.v1")
    .default("governance-operator-action-receipt.v1"),
  taskId: z.string().min(1),
  actionRef: z.string().min(1),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  decision: GovernanceOperatorActionReceiptDecisionSchema,
  operatorIdHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([])
});

export const GovernanceOperatorActionReceiptValidationStatusSchema = z.enum([
  "passed",
  "blocked"
]);

export const GovernanceOperatorActionReceiptValidationSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-receipt-validation.v1")
    .default("governance-operator-action-receipt-validation.v1"),
  status: GovernanceOperatorActionReceiptValidationStatusSchema,
  reasons: z.array(z.string()).default([]),
  taskId: z.string().min(1).optional(),
  actionRef: z.string().min(1).optional(),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  receipt: GovernanceOperatorActionReceiptSchema.optional()
}).superRefine((value, ctx) => {
  if (value.status === "passed" && value.reasons.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasons"],
      message: "operator_action_receipt_validation_pass_requires_no_reasons"
    });
  }

  if (value.status === "blocked" && value.reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasons"],
      message: "operator_action_receipt_validation_block_requires_reasons"
    });
  }
});

// ── Host-consumable operator evidence resolution ───────────────────────────

export const GovernanceOperatorEvidenceResolutionKindSchema = z.enum([
  "execution_observation",
  "artifact",
  "unsupported"
]);

export const GovernanceOperatorEvidenceResolutionStatusSchema = z.enum([
  "resolved",
  "missing",
  "malformed",
  "task_mismatch",
  "store_unavailable",
  "integrity_failed",
  "unsupported"
]);

export const GovernanceOperatorObservationEvidenceSummarySchema = z.object({
  observationId: z.string().min(1),
  taskId: z.string().min(1),
  primitiveId: z.string().min(1),
  stage: z.string().min(1),
  status: z.string().min(1),
  signalKeys: z.array(z.string()).default([]),
  evidenceRef: z.string().min(1).optional(),
  createdAt: z.string().min(1)
});

export const GovernanceOperatorArtifactEvidenceSummarySchema = z.object({
  artifactId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1).optional(),
  type: z.string().min(1),
  uri: z.string().min(1),
  sha256: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  contentType: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
  metadataKeys: z.array(z.string()).default([]),
  provenanceKeys: z.array(z.string()).default([]),
  verification: z.object({
    ok: z.boolean(),
    reason: z.string().min(1).optional()
  }).optional()
});

export const GovernanceOperatorEvidenceResolutionEntrySchema = z.object({
  schemaVersion: z.literal("governance-operator-evidence-resolution-entry.v1")
    .default("governance-operator-evidence-resolution-entry.v1"),
  ref: z.string(),
  kind: GovernanceOperatorEvidenceResolutionKindSchema,
  status: GovernanceOperatorEvidenceResolutionStatusSchema,
  reason: z.string().min(1).optional(),
  observation: GovernanceOperatorObservationEvidenceSummarySchema.optional(),
  artifact: GovernanceOperatorArtifactEvidenceSummarySchema.optional()
}).superRefine((value, ctx) => {
  if (value.kind !== "execution_observation" && value.observation !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["observation"],
      message: "operator_evidence_resolution_observation_kind_mismatch"
    });
  }

  if (value.kind !== "artifact" && value.artifact !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["artifact"],
      message: "operator_evidence_resolution_artifact_kind_mismatch"
    });
  }

  if (
    value.status === "resolved" &&
    value.kind === "execution_observation" &&
    value.observation === undefined
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["observation"],
      message: "operator_evidence_resolution_observation_required"
    });
  }

  if (
    (value.status === "resolved" || value.status === "integrity_failed") &&
    value.kind === "artifact" &&
    value.artifact === undefined
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["artifact"],
      message: "operator_evidence_resolution_artifact_required"
    });
  }

  if (value.status === "integrity_failed" && value.kind !== "artifact") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "operator_evidence_resolution_integrity_requires_artifact"
    });
  }

  if (value.kind === "unsupported" && value.status !== "unsupported") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "operator_evidence_resolution_unsupported_requires_unsupported_status"
    });
  }

  if (value.status === "unsupported" && value.kind !== "unsupported") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kind"],
      message: "operator_evidence_resolution_unsupported_status_kind_mismatch"
    });
  }

  if (value.status === "task_mismatch" && value.kind !== "artifact") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "operator_evidence_resolution_task_mismatch_requires_artifact"
    });
  }

  if (
    value.status !== "resolved" &&
    value.status !== "integrity_failed" &&
    (value.observation !== undefined || value.artifact !== undefined)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "operator_evidence_resolution_unresolved_forbids_summary"
    });
  }
});

export const GovernanceOperatorEvidenceResolutionSchema = z.object({
  schemaVersion: z.literal("governance-operator-evidence-resolution.v1")
    .default("governance-operator-evidence-resolution.v1"),
  taskId: z.string().min(1),
  source: GovernanceOperatorActionEnvelopeSourceSchema,
  refs: z.array(GovernanceOperatorEvidenceResolutionEntrySchema),
  resolvedCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative()
}).superRefine((value, ctx) => {
  const resolvedCount = value.refs.filter((entry) => entry.status === "resolved").length;
  if (value.resolvedCount !== resolvedCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolvedCount"],
      message: "operator_evidence_resolution_count_mismatch"
    });
  }

  const unresolvedCount = value.refs.length - resolvedCount;
  if (value.unresolvedCount !== unresolvedCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unresolvedCount"],
      message: "operator_evidence_resolution_count_mismatch"
    });
  }
});

// ── Arbitration packet ─────────────────────────────────────────────────────

export const ArbitrationPacketSchema = z.object({
  schemaVersion: z.literal("arbitration-packet.v1").default("arbitration-packet.v1"),
  packetId: z.string().min(1),
  taskId: z.string().min(1),
  trigger: ArbitrationTriggerSchema,
  currentState: z.unknown(),
  rawEvidenceRefs: z.array(z.string()).default([]),
  conflictingSignals: z.array(z.string()).default([]),
  availableActions: z.array(RecoveryActionSchema),
  recoveryRecommendation: RecoveryRecommendationSchema.optional(),
  recommendation: z.string().optional(),
  probabilityPredictionAllowed: z.literal(false),
  createdAt: z.string().min(1)
}).superRefine((value, ctx) => {
  if (value.recoveryRecommendation === undefined) {
    return;
  }

  if (!value.availableActions.includes(value.recoveryRecommendation.action)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recoveryRecommendation", "action"],
      message: "recommendation_action_unavailable"
    });
  }

  if (!sameStringArray(value.recoveryRecommendation.evidenceRefs, value.rawEvidenceRefs)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recoveryRecommendation", "evidenceRefs"],
      message: "recommendation_evidence_refs_mismatch"
    });
  }

  if (!recommendationReasonMatchesTrigger(
    value.recoveryRecommendation.reasonCode,
    value.trigger
  )) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recoveryRecommendation", "reasonCode"],
      message: "recommendation_trigger_mismatch"
    });
  }
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type RecoveryAction = z.infer<typeof RecoveryActionSchema>;
export type RecoveryRecommendationReason = z.infer<typeof RecoveryRecommendationReasonSchema>;
export type RecoveryRecommendationEvidenceStatus = z.infer<typeof RecoveryRecommendationEvidenceStatusSchema>;
export type RecoveryRecommendationInput = z.input<typeof RecoveryRecommendationSchema>;
export type RecoveryRecommendation = z.infer<typeof RecoveryRecommendationSchema>;
export type RecoveryOperatorActionStatus = z.infer<typeof RecoveryOperatorActionStatusSchema>;
export type RecoveryOperatorActionInput = z.input<typeof RecoveryOperatorActionSchema>;
export type RecoveryOperatorAction = z.infer<typeof RecoveryOperatorActionSchema>;
export type OperatorActionEnvelope = RecoveryOperatorAction;
export type GovernanceOperatorActionEnvelopeSource = z.infer<typeof GovernanceOperatorActionEnvelopeSourceSchema>;
export type GovernanceOperatorActionEnvelopeInput = z.input<typeof GovernanceOperatorActionEnvelopeSchema>;
export type GovernanceOperatorActionEnvelope = z.infer<typeof GovernanceOperatorActionEnvelopeSchema>;
export type GovernanceOperatorActionSummaryInput = z.input<typeof GovernanceOperatorActionSummarySchema>;
export type GovernanceOperatorActionSummary = z.infer<typeof GovernanceOperatorActionSummarySchema>;
export type GovernanceOperatorActionReceiptDecision = z.infer<typeof GovernanceOperatorActionReceiptDecisionSchema>;
export type GovernanceOperatorActionReceiptInput = z.input<typeof GovernanceOperatorActionReceiptSchema>;
export type GovernanceOperatorActionReceipt = z.infer<typeof GovernanceOperatorActionReceiptSchema>;
export type GovernanceOperatorActionReceiptValidationStatus = z.infer<typeof GovernanceOperatorActionReceiptValidationStatusSchema>;
export type GovernanceOperatorActionReceiptValidationInput = z.input<typeof GovernanceOperatorActionReceiptValidationSchema>;
export type GovernanceOperatorActionReceiptValidation = z.infer<typeof GovernanceOperatorActionReceiptValidationSchema>;
export type GovernanceOperatorEvidenceResolutionKind = z.infer<typeof GovernanceOperatorEvidenceResolutionKindSchema>;
export type GovernanceOperatorEvidenceResolutionStatus = z.infer<typeof GovernanceOperatorEvidenceResolutionStatusSchema>;
export type GovernanceOperatorObservationEvidenceSummary = z.infer<typeof GovernanceOperatorObservationEvidenceSummarySchema>;
export type GovernanceOperatorArtifactEvidenceSummary = z.infer<typeof GovernanceOperatorArtifactEvidenceSummarySchema>;
export type GovernanceOperatorEvidenceResolutionEntryInput = z.input<typeof GovernanceOperatorEvidenceResolutionEntrySchema>;
export type GovernanceOperatorEvidenceResolutionEntry = z.infer<typeof GovernanceOperatorEvidenceResolutionEntrySchema>;
export type GovernanceOperatorEvidenceResolutionInput = z.input<typeof GovernanceOperatorEvidenceResolutionSchema>;
export type GovernanceOperatorEvidenceResolution = z.infer<typeof GovernanceOperatorEvidenceResolutionSchema>;
export type ArbitrationTrigger = z.infer<typeof ArbitrationTriggerSchema>;
export type ArbitrationPacketInput = z.input<typeof ArbitrationPacketSchema>;
export type ArbitrationPacket = z.infer<typeof ArbitrationPacketSchema>;

// ── Create input ────────────────────────────────────────────────────────────

export interface CreateArbitrationPacketInput {
  state: GovernanceState;
  trigger?: ArbitrationTrigger;
  rawEvidenceRefs?: string[];
  conflictingSignals?: string[];
  recommendation?: string;
  /** If provided, available actions are filtered based on delegation level */
  delegationLevel?: DelegationLevel;
  now?: () => string;
}

// ── Parse helper ────────────────────────────────────────────────────────────

export function parseArbitrationPacket(input: ArbitrationPacketInput): ArbitrationPacket {
  return ArbitrationPacketSchema.parse(input);
}

export function createRecoveryOperatorAction(input: {
  arbitrationPacket: ArbitrationPacket;
  recoveryRecommendation: RecoveryRecommendation;
  lockdown: boolean;
  blockingReasons?: string[];
}): RecoveryOperatorAction {
  return RecoveryOperatorActionSchema.parse({
    taskId: input.arbitrationPacket.taskId,
    status: "requires_arbitration",
    trigger: input.arbitrationPacket.trigger,
    recommendedAction: input.recoveryRecommendation.action,
    reasonCode: input.recoveryRecommendation.reasonCode,
    summary: input.recoveryRecommendation.summary,
    requiresHumanApproval: input.recoveryRecommendation.requiresHumanApproval,
    lockdown: input.lockdown,
    evidenceStatus: input.recoveryRecommendation.evidenceStatus,
    evidenceRefs: input.recoveryRecommendation.evidenceRefs,
    ...(input.recoveryRecommendation.checkpointRef !== undefined
      ? { checkpointRef: input.recoveryRecommendation.checkpointRef }
      : {}),
    availableActions: input.arbitrationPacket.availableActions,
    blockingReasons: input.blockingReasons ?? []
  });
}

export function createGovernanceOperatorActionEnvelope(input: {
  source: GovernanceOperatorActionEnvelopeSource;
  operatorAction: RecoveryOperatorAction | undefined;
}): GovernanceOperatorActionEnvelope | undefined {
  if (input.operatorAction === undefined) {
    return undefined;
  }

  return GovernanceOperatorActionEnvelopeSchema.parse({
    source: input.source,
    taskId: input.operatorAction.taskId,
    status: input.operatorAction.status,
    trigger: input.operatorAction.trigger,
    recommendedAction: input.operatorAction.recommendedAction,
    requiresHumanApproval: input.operatorAction.requiresHumanApproval,
    lockdown: input.operatorAction.lockdown,
    blockingReasons: [...input.operatorAction.blockingReasons],
    evidenceRefs: [...input.operatorAction.evidenceRefs],
    artifactRefs: input.operatorAction.evidenceRefs.filter(isArtifactEvidenceRef)
  });
}

export function summarizeGovernanceOperatorActionEnvelope(
  envelope: GovernanceOperatorActionEnvelope | undefined
): GovernanceOperatorActionSummary {
  if (envelope === undefined) {
    return GovernanceOperatorActionSummarySchema.parse({
      present: false,
      blockingReasons: [],
      evidenceRefs: [],
      artifactRefs: []
    });
  }

  return GovernanceOperatorActionSummarySchema.parse({
    present: true,
    source: envelope.source,
    taskId: envelope.taskId,
    status: envelope.status,
    trigger: envelope.trigger,
    recommendedAction: envelope.recommendedAction,
    requiresHumanApproval: envelope.requiresHumanApproval,
    lockdown: envelope.lockdown,
    blockingReasons: [...envelope.blockingReasons],
    evidenceRefs: [...envelope.evidenceRefs],
    artifactRefs: [...envelope.artifactRefs]
  });
}

export function hashGovernanceOperatorActionEnvelope(
  envelope: GovernanceOperatorActionEnvelopeInput
): string {
  return createHash("sha256")
    .update(stableStringify(GovernanceOperatorActionEnvelopeSchema.parse(envelope)))
    .digest("hex");
}

export function createGovernanceOperatorActionRef(
  envelope: GovernanceOperatorActionEnvelopeInput
): string {
  return `${GOVERNANCE_OPERATOR_ACTION_REF_PREFIX}${hashGovernanceOperatorActionEnvelope(envelope)}`;
}

export function validateGovernanceOperatorActionReceipt(input: {
  envelope: GovernanceOperatorActionEnvelopeInput;
  receipt: unknown;
  now: string | (() => string);
  maxAgeMs?: number;
  consumedActionRefs?: string[];
}): GovernanceOperatorActionReceiptValidation {
  let envelope: GovernanceOperatorActionEnvelope;
  try {
    envelope = GovernanceOperatorActionEnvelopeSchema.parse(input.envelope);
  } catch {
    return GovernanceOperatorActionReceiptValidationSchema.parse({
      status: "blocked",
      reasons: ["operator_action_receipt_envelope_invalid"]
    });
  }

  const envelopeHash = hashGovernanceOperatorActionEnvelope(envelope);
  const actionRef = `${GOVERNANCE_OPERATOR_ACTION_REF_PREFIX}${envelopeHash}`;
  let receipt: GovernanceOperatorActionReceipt;
  try {
    receipt = GovernanceOperatorActionReceiptSchema.parse(input.receipt);
  } catch {
    return GovernanceOperatorActionReceiptValidationSchema.parse({
      status: "blocked",
      reasons: ["operator_action_receipt_invalid"],
      taskId: envelope.taskId,
      actionRef,
      envelopeHash
    });
  }

  const reasons: string[] = [];

  if (receipt.taskId !== envelope.taskId) {
    reasons.push("operator_action_receipt_task_mismatch");
  }

  if (receipt.actionRef !== actionRef) {
    reasons.push("operator_action_receipt_action_ref_mismatch");
  }

  if (
    receipt.envelopeHash !== undefined &&
    receipt.envelopeHash !== envelopeHash
  ) {
    reasons.push("operator_action_receipt_envelope_hash_mismatch");
  }

  const createdAtMs = Date.parse(receipt.createdAt);
  const nowValue = typeof input.now === "function" ? input.now() : input.now;
  const nowMs = Date.parse(nowValue);

  if (!Number.isFinite(createdAtMs)) {
    reasons.push("operator_action_receipt_created_at_invalid");
  }

  if (!Number.isFinite(nowMs)) {
    reasons.push("operator_action_receipt_now_invalid");
  }

  if (Number.isFinite(createdAtMs) && Number.isFinite(nowMs)) {
    if (createdAtMs > nowMs) {
      reasons.push("operator_action_receipt_created_at_after_now");
    }

    const maxAgeMs =
      input.maxAgeMs ?? DEFAULT_OPERATOR_ACTION_RECEIPT_MAX_AGE_MS;
    if (nowMs - createdAtMs > maxAgeMs) {
      reasons.push("operator_action_receipt_expired");
    }
  }

  const consumedActionRefs = input.consumedActionRefs ?? [];
  if (
    consumedActionRefs.includes(actionRef) ||
    consumedActionRefs.includes(receipt.actionRef)
  ) {
    reasons.push("operator_action_receipt_replay");
  }

  if (
    envelope.lockdown &&
    receipt.decision !== "consumed" &&
    receipt.decision !== "rejected"
  ) {
    reasons.push("operator_action_receipt_lockdown_requires_resolution");
  }

  return GovernanceOperatorActionReceiptValidationSchema.parse({
    status: reasons.length === 0 ? "passed" : "blocked",
    reasons,
    taskId: envelope.taskId,
    actionRef,
    envelopeHash,
    receipt
  });
}

export async function resolveGovernanceOperatorActionEvidence(input: {
  envelope: GovernanceOperatorActionEnvelopeInput;
  observationStore?: ExecutionObservationStore | undefined;
  artifactStore?: ArtifactStore | undefined;
}): Promise<GovernanceOperatorEvidenceResolution> {
  const envelope = GovernanceOperatorActionEnvelopeSchema.parse(input.envelope);
  const refs = [...new Set(envelope.evidenceRefs)];
  const entries: GovernanceOperatorEvidenceResolutionEntry[] = [];

  for (const ref of refs) {
    entries.push(await resolveGovernanceOperatorEvidenceRef({
      ref,
      taskId: envelope.taskId,
      observationStore: input.observationStore,
      artifactStore: input.artifactStore
    }));
  }

  return GovernanceOperatorEvidenceResolutionSchema.parse({
    taskId: envelope.taskId,
    source: envelope.source,
    refs: entries,
    resolvedCount: entries.filter((entry) => entry.status === "resolved").length,
    unresolvedCount: entries.filter((entry) => entry.status !== "resolved").length
  });
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createArbitrationPacket(input: CreateArbitrationPacketInput): ArbitrationPacket {
  const now = input.now ?? (() => new Date().toISOString());
  const createdAt = now();
  const trigger = input.trigger ?? inferTrigger(input.state);
  const rawEvidenceRefs = input.rawEvidenceRefs ?? collectEvidenceRefs(input.state);
  const availableActions = input.delegationLevel !== undefined
    ? filterRecoveryActions(input.delegationLevel) as RecoveryAction[]
    : ["resume", "rollback", "abort", "fork"] satisfies RecoveryAction[];
  const recoveryRecommendation = createRecoveryRecommendation({
    state: input.state,
    trigger,
    rawEvidenceRefs,
    availableActions,
    ...(input.delegationLevel !== undefined ? { delegationLevel: input.delegationLevel } : {})
  });

  return parseArbitrationPacket({
    packetId: `${input.state.taskId}:arbitration:${createdAt}`,
    taskId: input.state.taskId,
    trigger,
    currentState: input.state,
    rawEvidenceRefs,
    conflictingSignals: input.conflictingSignals ?? [],
    availableActions,
    recoveryRecommendation,
    ...(input.recommendation !== undefined ? { recommendation: input.recommendation } : {}),
    probabilityPredictionAllowed: false,
    createdAt
  });
}

// ── Safety predicates ──────────────────────────────────────────────────────

export function shouldLockdown(packet: ArbitrationPacket): boolean {
  return packet.trigger === "third_anomaly";
}

// ── Internal helpers ────────────────────────────────────────────────────────

function expectedRecommendationShape(reasonCode: RecoveryRecommendationReason): {
  action: RecoveryAction;
  requiresHumanApproval: boolean;
  checkpointRequired: boolean;
} {
  switch (reasonCode) {
    case "first_anomaly_resume_with_monitoring":
      return {
        action: "resume",
        requiresHumanApproval: false,
        checkpointRequired: false
      };
    case "second_anomaly_require_human_review":
      return {
        action: "resume",
        requiresHumanApproval: true,
        checkpointRequired: false
      };
    case "third_anomaly_rollback_to_checkpoint":
      return {
        action: "rollback",
        requiresHumanApproval: true,
        checkpointRequired: true
      };
    case "third_anomaly_fork_for_investigation":
      return {
        action: "fork",
        requiresHumanApproval: true,
        checkpointRequired: false
      };
    case "third_anomaly_abort_without_reversible_action":
      return {
        action: "abort",
        requiresHumanApproval: true,
        checkpointRequired: false
      };
    case "manual_review_requested":
      return {
        action: "resume",
        requiresHumanApproval: true,
        checkpointRequired: false
      };
  }
}

function addRecommendationShapeIssues(
  ctx: z.RefinementCtx,
  value: {
    reasonCode: RecoveryRecommendationReason;
    requiresHumanApproval: boolean;
    checkpointRef?: string | undefined;
  } & (
    | { action: RecoveryAction }
    | { recommendedAction: RecoveryAction }
  ),
  paths: {
    action: Array<string | number>;
    requiresHumanApproval?: Array<string | number>;
    checkpointRef?: Array<string | number>;
  }
): void {
  const expected = expectedRecommendationShape(value.reasonCode);
  const action = "action" in value ? value.action : value.recommendedAction;
  const requiresHumanApprovalPath =
    paths.requiresHumanApproval ?? ["requiresHumanApproval"];
  const checkpointRefPath = paths.checkpointRef ?? ["checkpointRef"];

  if (action !== expected.action) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: paths.action,
      message: "recommendation_action_mismatch"
    });
  }

  if (expected.requiresHumanApproval && !value.requiresHumanApproval) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: requiresHumanApprovalPath,
      message: "recommendation_approval_mismatch"
    });
  }

  if (expected.checkpointRequired && value.checkpointRef === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: checkpointRefPath,
      message: "recommendation_checkpoint_required"
    });
  }

  if (!expected.checkpointRequired && value.checkpointRef !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: checkpointRefPath,
      message: "recommendation_checkpoint_not_allowed"
    });
  }
}

function recommendationReasonMatchesTrigger(
  reasonCode: RecoveryRecommendationReason,
  trigger: ArbitrationTrigger
): boolean {
  if (trigger === "first_anomaly") {
    return reasonCode === "first_anomaly_resume_with_monitoring";
  }
  if (trigger === "second_anomaly") {
    return reasonCode === "second_anomaly_require_human_review";
  }
  if (trigger === "third_anomaly") {
    return reasonCode.startsWith("third_anomaly_");
  }
  return reasonCode === "manual_review_requested";
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function createRecoveryRecommendation(input: {
  state: GovernanceState;
  trigger: ArbitrationTrigger;
  rawEvidenceRefs: string[];
  availableActions: RecoveryAction[];
  delegationLevel?: DelegationLevel;
}): RecoveryRecommendation {
  const evidenceStatus: RecoveryRecommendationEvidenceStatus =
    input.rawEvidenceRefs.length > 0 ? "referenced" : "missing";
  const firstAnomalyRequiresHumanApproval =
    input.delegationLevel === "full_control";

  if (input.trigger === "third_anomaly") {
    if (
      input.state.latestCheckpointId !== undefined &&
      input.availableActions.includes("rollback")
    ) {
      return RecoveryRecommendationSchema.parse({
        action: "rollback",
        reasonCode: "third_anomaly_rollback_to_checkpoint",
        requiresHumanApproval: true,
        evidenceStatus,
        evidenceRefs: input.rawEvidenceRefs,
        checkpointRef: input.state.latestCheckpointId,
        summary: "Rollback to the latest checkpoint before any resume attempt."
      });
    }

    if (input.availableActions.includes("fork")) {
      return RecoveryRecommendationSchema.parse({
        action: "fork",
        reasonCode: "third_anomaly_fork_for_investigation",
        requiresHumanApproval: true,
        evidenceStatus,
        evidenceRefs: input.rawEvidenceRefs,
        summary: "Fork an isolated recovery context and require human arbitration before continuing."
      });
    }

    return RecoveryRecommendationSchema.parse({
      action: input.availableActions.includes("abort") ? "abort" : "resume",
      reasonCode: "third_anomaly_abort_without_reversible_action",
      requiresHumanApproval: true,
      evidenceStatus,
      evidenceRefs: input.rawEvidenceRefs,
      summary: "Stop execution because no reversible recovery action is available."
    });
  }

  if (input.trigger === "second_anomaly") {
    return RecoveryRecommendationSchema.parse({
      action: "resume",
      reasonCode: "second_anomaly_require_human_review",
      requiresHumanApproval: true,
      evidenceStatus,
      evidenceRefs: input.rawEvidenceRefs,
      summary: "Require human review before resuming after a repeated anomaly."
    });
  }

  if (input.trigger === "first_anomaly") {
    return RecoveryRecommendationSchema.parse({
      action: "resume",
      reasonCode: "first_anomaly_resume_with_monitoring",
      requiresHumanApproval: firstAnomalyRequiresHumanApproval,
      evidenceStatus,
      evidenceRefs: input.rawEvidenceRefs,
      summary: firstAnomalyRequiresHumanApproval
        ? "Require human approval before resuming after the first anomaly."
        : "Resume with monitoring after the first anomaly."
    });
  }

  return RecoveryRecommendationSchema.parse({
    action: "resume",
    reasonCode: "manual_review_requested",
    requiresHumanApproval: true,
    evidenceStatus,
    evidenceRefs: input.rawEvidenceRefs,
    summary: "Wait for manual review before changing recovery state."
  });
}

function inferTrigger(state: GovernanceState): ArbitrationTrigger {
  const maxStrike = Math.max(0, ...state.anomalies.map((item) => item.strikeNumber));

  if (maxStrike >= 3) return "third_anomaly";
  if (maxStrike === 2) return "second_anomaly";
  if (maxStrike === 1) return "first_anomaly";
  return "manual";
}

function collectEvidenceRefs(state: GovernanceState): string[] {
  return [...new Set(state.anomalies.flatMap((item) => item.evidenceRefs))];
}

function isArtifactEvidenceRef(ref: string): boolean {
  return parseArtifactEvidenceRef(ref) !== undefined;
}

function parseArtifactEvidenceRef(
  ref: string
): { kind: "artifact"; artifactId: string; ref: string } | undefined {
  if (!ref.startsWith("artifact:")) {
    return undefined;
  }

  const artifactId = ref.slice("artifact:".length);
  if (!isSafeArtifactId(artifactId)) {
    return undefined;
  }

  return {
    kind: "artifact",
    artifactId,
    ref
  };
}

async function resolveGovernanceOperatorEvidenceRef(input: {
  ref: string;
  taskId: string;
  observationStore?: ExecutionObservationStore | undefined;
  artifactStore?: ArtifactStore | undefined;
}): Promise<GovernanceOperatorEvidenceResolutionEntry> {
  if (input.ref.startsWith(EXECUTION_OBSERVATION_REF_PREFIX)) {
    return resolveGovernanceOperatorObservationRef(input);
  }

  if (input.ref.startsWith("artifact:")) {
    return resolveGovernanceOperatorArtifactRef(input);
  }

  return evidenceResolutionEntry({
    ref: input.ref,
    kind: "unsupported",
    status: "unsupported",
    reason: "unsupported_evidence_ref"
  });
}

async function resolveGovernanceOperatorObservationRef(input: {
  ref: string;
  taskId: string;
  observationStore?: ExecutionObservationStore | undefined;
}): Promise<GovernanceOperatorEvidenceResolutionEntry> {
  const parsedRef = parseExecutionObservationRef(input.ref);
  if (parsedRef === undefined) {
    return evidenceResolutionEntry({
      ref: input.ref,
      kind: "execution_observation",
      status: "malformed",
      reason: "execution_observation_ref_malformed"
    });
  }

  if (input.observationStore === undefined) {
    return evidenceResolutionEntry({
      ref: input.ref,
      kind: "execution_observation",
      status: "store_unavailable",
      reason: "execution_observation_store_unavailable"
    });
  }

  try {
    const observation = await resolveExecutionObservationRef(
      input.observationStore,
      input.taskId,
      input.ref
    );
    if (observation === undefined) {
      return evidenceResolutionEntry({
        ref: input.ref,
        kind: "execution_observation",
        status: "missing",
        reason: "execution_observation_not_found"
      });
    }

    return evidenceResolutionEntry({
      ref: input.ref,
      kind: "execution_observation",
      status: "resolved",
      observation: summarizeExecutionObservationEvidence(observation)
    });
  } catch {
    return evidenceResolutionEntry({
      ref: input.ref,
      kind: "execution_observation",
      status: "store_unavailable",
      reason: "execution_observation_store_unavailable"
    });
  }
}

async function resolveGovernanceOperatorArtifactRef(input: {
  ref: string;
  taskId: string;
  artifactStore?: ArtifactStore | undefined;
}): Promise<GovernanceOperatorEvidenceResolutionEntry> {
  const parsedRef = parseArtifactEvidenceRef(input.ref);
  if (parsedRef === undefined) {
    return evidenceResolutionEntry({
      ref: input.ref,
      kind: "artifact",
      status: "malformed",
      reason: "artifact_ref_malformed"
    });
  }

  if (input.artifactStore === undefined) {
    return evidenceResolutionEntry({
      ref: input.ref,
      kind: "artifact",
      status: "store_unavailable",
      reason: "artifact_store_unavailable"
    });
  }

  try {
    const artifact = await input.artifactStore.getArtifact(parsedRef.artifactId);
    if (artifact === undefined) {
      return evidenceResolutionEntry({
        ref: input.ref,
        kind: "artifact",
        status: "missing",
        reason: "artifact_not_found"
      });
    }

    if (artifact.taskId !== input.taskId) {
      return evidenceResolutionEntry({
        ref: input.ref,
        kind: "artifact",
        status: "task_mismatch",
        reason: "artifact_task_mismatch"
      });
    }

    const verification = await input.artifactStore.verifyArtifact(parsedRef.artifactId);
    if (!verification.ok) {
      return evidenceResolutionEntry({
        ref: input.ref,
        kind: "artifact",
        status: "integrity_failed",
        reason: verification.reason ?? "artifact_integrity_failed",
        artifact: summarizeArtifactEvidence(artifact, verification)
      });
    }

    return evidenceResolutionEntry({
      ref: input.ref,
      kind: "artifact",
      status: "resolved",
      artifact: summarizeArtifactEvidence(artifact, verification)
    });
  } catch {
    return evidenceResolutionEntry({
      ref: input.ref,
      kind: "artifact",
      status: "store_unavailable",
      reason: "artifact_store_unavailable"
    });
  }
}

function evidenceResolutionEntry(
  input: GovernanceOperatorEvidenceResolutionEntryInput
): GovernanceOperatorEvidenceResolutionEntry {
  return GovernanceOperatorEvidenceResolutionEntrySchema.parse(input);
}

function summarizeExecutionObservationEvidence(
  observation: ExecutionObservation
): GovernanceOperatorObservationEvidenceSummary {
  return GovernanceOperatorObservationEvidenceSummarySchema.parse({
    observationId: observation.observationId,
    taskId: observation.taskId,
    primitiveId: observation.primitiveId,
    stage: observation.stage,
    status: observation.status,
    signalKeys: Object.keys(observation.signals).sort(),
    ...(observation.evidenceRef !== undefined ? { evidenceRef: observation.evidenceRef } : {}),
    createdAt: observation.createdAt
  });
}

function summarizeArtifactEvidence(
  artifact: StoredArtifact,
  verification: ArtifactVerificationResult
): GovernanceOperatorArtifactEvidenceSummary {
  return GovernanceOperatorArtifactEvidenceSummarySchema.parse({
    artifactId: artifact.artifactId,
    taskId: artifact.taskId,
    ...(artifact.runId !== undefined ? { runId: artifact.runId } : {}),
    type: artifact.type,
    uri: artifact.uri,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    createdAt: artifact.createdAt,
    ...(artifact.contentType !== undefined ? { contentType: artifact.contentType } : {}),
    ...(artifact.fileName !== undefined ? { fileName: artifact.fileName } : {}),
    metadataKeys: Object.keys(artifact.metadata).sort(),
    provenanceKeys: Object.keys(artifact.provenance).sort(),
    verification: {
      ok: verification.ok,
      ...(verification.reason !== undefined ? { reason: verification.reason } : {})
    }
  });
}

function isSafeArtifactId(artifactId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(artifactId)
    && !artifactId.includes("..")
    && !artifactId.includes("/")
    && !artifactId.includes("\\");
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
