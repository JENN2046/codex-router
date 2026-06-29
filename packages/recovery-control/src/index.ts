import { z } from "zod";
import type { GovernanceState } from "../../state-manager/src/index.js";
import type { DelegationLevel } from "../../delegation-policy/src/index.js";
import { filterRecoveryActions } from "../../delegation-policy/src/index.js";

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

  const expected = expectedRecommendationShape(value.reasonCode);
  if (value.action !== expected.action) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["action"],
      message: "recommendation_action_mismatch"
    });
  }

  if (expected.requiresHumanApproval && !value.requiresHumanApproval) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requiresHumanApproval"],
      message: "recommendation_approval_mismatch"
    });
  }

  if (expected.checkpointRequired && value.checkpointRef === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "recommendation_checkpoint_required"
    });
  }

  if (!expected.checkpointRequired && value.checkpointRef !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "recommendation_checkpoint_not_allowed"
    });
  }
});

// ── Arbitration trigger ─────────────────────────────────────────────────────

export const ArbitrationTriggerSchema = z.enum([
  "first_anomaly",
  "second_anomaly",
  "third_anomaly",
  "manual"
]);

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
