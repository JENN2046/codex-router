import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve as resolvePath } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { GovernanceState } from "../../governance-internal-state-manager/src/index.js";
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
} from "../../governance-internal-execution-observation/src/index.js";
import {
  EXECUTION_OBSERVATION_REF_PREFIX,
  parseExecutionObservationRef,
  resolveExecutionObservationRef
} from "../../governance-internal-execution-observation/src/index.js";

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
  checkpointRef: z.string().min(1).optional(),
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

  if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_envelope_checkpoint_required"
    });
  }

  if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_envelope_checkpoint_not_allowed"
    });
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
  checkpointRef: z.string().min(1).optional(),
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
    "lockdown",
    "checkpointRef"
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
    value.artifactRefs.length > 0 ||
    value.checkpointRef !== undefined
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
const GOVERNANCE_OPERATOR_ACTION_RECEIPT_ID_PREFIX =
  "governance-operator-action-receipt:";
const DEFAULT_OPERATOR_ACTION_MAX_AGE_MS = 15 * 60 * 1000;
const GovernanceOperatorSanitizedRefSchema = z.string().min(1).max(256).refine(
  (value) =>
    !/[\r\n]/.test(value) &&
    !/(?:-----BEGIN|PRIVATE KEY|secret|token|password|api[_-]?key)/i.test(value),
  { message: "operator_action_ref_unsafe" }
);

export const GovernanceOperatorActionReceiptDecisionSchema = z.enum([
  "acknowledged",
  "rejected",
  "deferred",
  "consumed"
]);

export const GovernanceOperatorActionReceiptSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-receipt.v1")
    .default("governance-operator-action-receipt.v1"),
  receiptId: z.string().min(1),
  taskId: z.string().min(1),
  actionRef: z.string().min(1),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  actionIssuedAt: z.string().min(1),
  decision: GovernanceOperatorActionReceiptDecisionSchema,
  operatorIdHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([])
});

const GovernanceOperatorActionReceiptIdPayloadSchema =
  GovernanceOperatorActionReceiptSchema.omit({
    receiptId: true,
    schemaVersion: true
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

export const GovernanceOperatorActionReceiptStoreConsumeStatusSchema = z.enum([
  "stored",
  "replay"
]);

export const GovernanceOperatorActionReceiptStoreConsumeResultSchema = z.object({
  status: GovernanceOperatorActionReceiptStoreConsumeStatusSchema,
  receipt: GovernanceOperatorActionReceiptSchema,
  existingReceiptIds: z.array(z.string()).default([]),
  existingActionRefs: z.array(z.string()).default([])
}).superRefine((value, ctx) => {
  if (
    value.status === "stored" &&
    (value.existingReceiptIds.length > 0 || value.existingActionRefs.length > 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "operator_action_receipt_store_stored_result_requires_empty_replay_evidence"
    });
  }
});

export const GovernanceOperatorActionReceiptConsumptionStatusSchema = z.enum([
  "passed",
  "blocked"
]);

const governanceOperatorActionReceiptConsumptionStoreProofs = new WeakMap<object, string>();

export const GovernanceOperatorActionReceiptConsumptionSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-receipt-consumption.v1")
    .default("governance-operator-action-receipt-consumption.v1"),
  status: GovernanceOperatorActionReceiptConsumptionStatusSchema,
  durable: z.boolean().default(false),
  reasons: z.array(z.string()).default([]),
  validation: GovernanceOperatorActionReceiptValidationSchema,
  taskId: z.string().min(1).optional(),
  actionRef: z.string().min(1).optional(),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  receipt: GovernanceOperatorActionReceiptSchema.optional()
}).superRefine((value, ctx) => {
  if (value.status === "passed" && value.reasons.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasons"],
      message: "operator_action_receipt_consumption_pass_requires_no_reasons"
    });
  }

  if (value.status === "blocked" && value.reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasons"],
      message: "operator_action_receipt_consumption_block_requires_reasons"
    });
  }
});

// ── Gated operator action planning ─────────────────────────────────────────

export const GovernanceOperatorActionExecutionModeSchema = z.enum([
  "plan_only"
]);

export const GovernanceOperatorActionExecutorReceiptConsumptionSchema = z.object({
  schemaVersion: z.string().min(1),
  status: z.enum(["passed", "blocked", "not_consumed"]),
  durable: z.boolean().default(false),
  reasons: z.array(z.string()).default([]),
  validation: GovernanceOperatorActionReceiptValidationSchema,
  taskId: z.string().min(1).optional(),
  actionRef: z.string().min(1).optional(),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  receipt: GovernanceOperatorActionReceiptSchema.optional()
}).passthrough();

export const GovernanceOperatorActionExecutorLifecycleStateSchema = z.object({
  schemaVersion: z.string().min(1),
  status: z.enum([
    "idle",
    "action_available",
    "receipt_created",
    "receipt_consumed",
    "receipt_not_consumed",
    "receipt_blocked"
  ]),
  operatorActionPresent: z.boolean(),
  actionIssuedAt: z.string().min(1).optional(),
  envelope: GovernanceOperatorActionEnvelopeSchema.optional(),
  lastReceiptConsumption: GovernanceOperatorActionExecutorReceiptConsumptionSchema.optional()
}).passthrough();

export const GovernanceOperatorActionExecutionPlanSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-execution-plan.v1")
    .default("governance-operator-action-execution-plan.v1"),
  taskId: z.string().min(1),
  actionRef: z.string().min(1),
  receiptId: z.string().min(1),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
  recommendedAction: RecoveryActionSchema,
  executionMode: GovernanceOperatorActionExecutionModeSchema,
  requiresHumanApproval: z.boolean(),
  lockdown: z.boolean(),
  checkpointRef: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string()).default([]),
  artifactRefs: z.array(z.string()).default([]),
  blockingReasons: z.array(z.string()).default([]),
  operatorInstruction: z.string().min(1)
}).superRefine((value, ctx) => {
  if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_execution_plan_checkpoint_required"
    });
  }

  if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_execution_plan_checkpoint_not_allowed"
    });
  }
});

export const GovernanceOperatorActionExecutionGateResultSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-execution-gate.v1")
    .default("governance-operator-action-execution-gate.v1"),
  status: z.enum(["planned", "blocked"]),
  reasons: z.array(z.string()).default([]),
  taskId: z.string().min(1).optional(),
  actionRef: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  recommendedAction: RecoveryActionSchema.optional(),
  executionMode: GovernanceOperatorActionExecutionModeSchema.optional(),
  checkpointRef: z.string().min(1).optional(),
  plan: GovernanceOperatorActionExecutionPlanSchema.optional()
}).superRefine((value, ctx) => {
  if (value.status === "planned") {
    if (value.reasons.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasons"],
        message: "operator_action_execution_gate_planned_requires_no_reasons"
      });
    }
    if (value.plan === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plan"],
        message: "operator_action_execution_gate_planned_requires_plan"
      });
    }

    if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_execution_gate_checkpoint_required"
      });
    }

    if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_execution_gate_checkpoint_not_allowed"
      });
    }

    if (value.plan !== undefined) {
      const planBindings = [
        {
          field: "taskId",
          message: "operator_action_execution_gate_task_plan_mismatch"
        },
        {
          field: "actionRef",
          message: "operator_action_execution_gate_action_ref_plan_mismatch"
        },
        {
          field: "receiptId",
          message: "operator_action_execution_gate_receipt_plan_mismatch"
        },
        {
          field: "envelopeHash",
          message: "operator_action_execution_gate_envelope_hash_plan_mismatch"
        },
        {
          field: "recommendedAction",
          message: "operator_action_execution_gate_recommended_action_plan_mismatch"
        },
        {
          field: "executionMode",
          message: "operator_action_execution_gate_execution_mode_plan_mismatch"
        },
        {
          field: "checkpointRef",
          message: "operator_action_execution_gate_checkpoint_plan_mismatch"
        }
      ] as const;
      for (const binding of planBindings) {
        if (value[binding.field] !== value.plan[binding.field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [binding.field],
            message: binding.message
          });
        }
      }
    }
    return;
  }

  if (value.reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasons"],
      message: "operator_action_execution_gate_block_requires_reasons"
    });
  }
  if (value.plan !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["plan"],
      message: "operator_action_execution_gate_block_forbids_plan"
    });
  }
});

// ── Non-executing host executor authorization boundary ─────────────────────

export const GovernanceOperatorActionHostExecutorDescriptorSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-host-executor-descriptor.v1")
    .default("governance-operator-action-host-executor-descriptor.v1"),
  descriptorId: z.string().min(1),
  descriptorKind: z.literal("injected_host_executor").default("injected_host_executor"),
  executionMode: z.literal("review_only").default("review_only"),
  sideEffectBoundary: z.literal("recovery_action_review")
    .default("recovery_action_review"),
  dispatchSupported: z.literal(false).default(false),
  supportedActions: z.array(RecoveryActionSchema).min(1),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
}).superRefine((value, ctx) => {
  if (new Set(value.supportedActions).size !== value.supportedActions.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supportedActions"],
      message: "operator_action_host_executor_descriptor_duplicate_actions"
    });
  }
});

export const GovernanceOperatorActionHostExecutorAuthorizationPacketSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-host-executor-authorization-packet.v1")
    .default("governance-operator-action-host-executor-authorization-packet.v1"),
  taskId: z.string().min(1),
  actionRef: z.string().min(1),
  receiptId: z.string().min(1),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
  recommendedAction: RecoveryActionSchema,
  executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
  checkpointRef: z.string().min(1).optional(),
  hostExecutorDescriptorId: z.string().min(1),
  hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
  authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
}).superRefine((value, ctx) => {
  if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_host_executor_authorization_checkpoint_required"
    });
  }

  if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_host_executor_authorization_checkpoint_not_allowed"
    });
  }
});

export const GovernanceOperatorActionHostExecutorAuthorizationResultSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-host-executor-authorization.v1")
    .default("governance-operator-action-host-executor-authorization.v1"),
  status: z.enum(["ready_for_host_executor_review", "blocked"]),
  reasons: z.array(z.string()).default([]),
  taskId: z.string().min(1).optional(),
  actionRef: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  recommendedAction: RecoveryActionSchema.optional(),
  executionMode: GovernanceOperatorActionExecutionModeSchema.optional(),
  executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  checkpointRef: z.string().min(1).optional(),
  hostExecutorDescriptorId: z.string().min(1).optional(),
  hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([]),
  operatorInstruction: z.string().min(1).optional()
}).superRefine((value, ctx) => {
  if (value.status === "ready_for_host_executor_review") {
    if (value.reasons.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasons"],
        message: "operator_action_host_executor_ready_requires_no_reasons"
      });
    }

    for (const field of [
      "taskId",
      "actionRef",
      "receiptId",
      "envelopeHash",
      "recommendedAction",
      "executionMode",
      "executionPlanHash",
      "hostExecutorDescriptorId",
      "hostExecutorDescriptorHash",
      "authorizationIdentityHash",
      "operatorInstruction"
    ] as const) {
      if (value[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "operator_action_host_executor_ready_requires_field"
        });
      }
    }

    if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_host_executor_ready_checkpoint_required"
      });
    }

    if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_host_executor_ready_checkpoint_not_allowed"
      });
    }
    return;
  }

  if (value.reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasons"],
      message: "operator_action_host_executor_block_requires_reasons"
    });
  }
});

// ── Review-only agent executor adapter boundary ────────────────────────────

export const GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL =
  "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_IMPLEMENTATION" as const;
export const GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL =
  "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_RUN" as const;
export const GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL =
  "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION" as const;

export const GovernanceOperatorActionAgentExecutorAdapterKindSchema = z.enum([
  "codex_cli_adapter",
  "sub_agent_adapter",
  "host_runtime_adapter",
  "sandbox_reference_adapter"
]);

export const GovernanceOperatorActionAgentExecutorAdapterDescriptorSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-agent-executor-adapter-descriptor.v1")
    .default("governance-operator-action-agent-executor-adapter-descriptor.v1"),
  adapterId: z.string().min(1),
  adapterKind: GovernanceOperatorActionAgentExecutorAdapterKindSchema,
  hostExecutorDescriptorId: z.string().min(1),
  executionBoundary: z.literal("review_only").default("review_only"),
  invocationSupported: z.literal(false).default(false),
  sideEffectBoundary: z.literal("none").default("none"),
  supportedActions: z.array(RecoveryActionSchema).min(1),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
}).superRefine((value, ctx) => {
  if (new Set(value.supportedActions).size !== value.supportedActions.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supportedActions"],
      message: "operator_action_agent_executor_adapter_descriptor_duplicate_actions"
    });
  }
});

export const GovernanceOperatorActionAgentExecutorAdapterReviewPacketSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-agent-executor-adapter-review-packet.v1")
    .default("governance-operator-action-agent-executor-adapter-review-packet.v1"),
  approvalString: z.literal(
    GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL
  ),
  taskId: z.string().min(1),
  actionRef: z.string().min(1),
  receiptId: z.string().min(1),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
  recommendedAction: RecoveryActionSchema,
  executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
  checkpointRef: z.string().min(1).optional(),
  hostExecutorDescriptorId: z.string().min(1),
  hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
  authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/),
  adapterId: z.string().min(1),
  adapterKind: GovernanceOperatorActionAgentExecutorAdapterKindSchema,
  adapterDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
  executionBoundary: z.literal("review_only").default("review_only"),
  invocationSupported: z.literal(false).default(false),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
}).superRefine((value, ctx) => {
  if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_agent_executor_adapter_review_checkpoint_required"
    });
  }

  if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_agent_executor_adapter_review_checkpoint_not_allowed"
    });
  }
});

export const GovernanceOperatorActionAgentExecutorAdapterReviewResultSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-agent-executor-adapter-review.v1")
    .default("governance-operator-action-agent-executor-adapter-review.v1"),
  status: z.enum(["ready_for_agent_executor_adapter_review", "blocked"]),
  reasons: z.array(z.string()).default([]),
  approvalString: z.literal(
    GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL
  ).optional(),
  taskId: z.string().min(1).optional(),
  actionRef: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  recommendedAction: RecoveryActionSchema.optional(),
  executionMode: GovernanceOperatorActionExecutionModeSchema.optional(),
  executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  checkpointRef: z.string().min(1).optional(),
  hostExecutorDescriptorId: z.string().min(1).optional(),
  hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  adapterId: z.string().min(1).optional(),
  adapterKind: GovernanceOperatorActionAgentExecutorAdapterKindSchema.optional(),
  adapterDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  executionBoundary: z.literal("review_only").optional(),
  invocationSupported: z.literal(false).optional(),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([]),
  operatorInstruction: z.string().min(1).optional()
}).superRefine((value, ctx) => {
  if (value.status === "ready_for_agent_executor_adapter_review") {
    if (value.reasons.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasons"],
        message: "operator_action_agent_executor_adapter_ready_requires_no_reasons"
      });
    }

    for (const field of [
      "approvalString",
      "taskId",
      "actionRef",
      "receiptId",
      "envelopeHash",
      "recommendedAction",
      "executionMode",
      "executionPlanHash",
      "hostExecutorDescriptorId",
      "hostExecutorDescriptorHash",
      "authorizationIdentityHash",
      "adapterId",
      "adapterKind",
      "adapterDescriptorHash",
      "executionBoundary",
      "invocationSupported",
      "operatorInstruction"
    ] as const) {
      if (value[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "operator_action_agent_executor_adapter_ready_requires_field"
        });
      }
    }

    if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_agent_executor_adapter_ready_checkpoint_required"
      });
    }

    if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_agent_executor_adapter_ready_checkpoint_not_allowed"
      });
    }
    return;
  }

  if (value.reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasons"],
      message: "operator_action_agent_executor_adapter_block_requires_reasons"
    });
  }
});

// ── Explicit host executor dispatch boundary ───────────────────────────────

export const GovernanceOperatorActionHostExecutorDispatchModeSchema = z.enum([
  "dry_run",
  "execute_injected"
]);

export const GovernanceOperatorActionHostExecutorDispatchInvocationSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-host-executor-dispatch-invocation.v1")
    .default("governance-operator-action-host-executor-dispatch-invocation.v1"),
  dispatchMode: GovernanceOperatorActionHostExecutorDispatchModeSchema,
  taskId: z.string().min(1),
  actionRef: z.string().min(1),
  receiptId: z.string().min(1),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
  recommendedAction: RecoveryActionSchema,
  executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
  checkpointRef: z.string().min(1).optional(),
  hostExecutorDescriptorId: z.string().min(1),
  hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
  authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([]),
  operatorInstruction: z.string().min(1)
}).superRefine((value, ctx) => {
  if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_host_executor_dispatch_checkpoint_required"
    });
  }

  if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointRef"],
      message: "operator_action_host_executor_dispatch_checkpoint_not_allowed"
    });
  }
});

export const GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema = z.enum([
  "accepted",
  "running",
  "completed",
  "failed",
  "refused",
  "aborted"
]);

export const GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema =
  z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9_.:-]*$/).refine(
    (value) =>
      !/(?:-----BEGIN|PRIVATE KEY|secret|token|password|api[_-]?key)/i.test(value),
    { message: "operator_action_host_executor_dispatch_executor_reason_code_unsafe" }
  );

export const GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-host-executor-dispatch-executor-result.v1")
    .default("governance-operator-action-host-executor-dispatch-executor-result.v1"),
  status: GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema,
  reasonCode: GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema.optional(),
  resultRef: GovernanceOperatorSanitizedRefSchema.optional(),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
}).superRefine((value, ctx) => {
  if (
    ["failed", "refused", "aborted"].includes(value.status) &&
    value.reasonCode === undefined
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonCode"],
      message: "operator_action_host_executor_dispatch_executor_terminal_status_requires_reason_code"
    });
  }
});

export const GovernanceOperatorActionHostExecutorDispatchAuditEventSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-host-executor-dispatch-audit.v1")
    .default("governance-operator-action-host-executor-dispatch-audit.v1"),
  status: z.enum(["attempting", "dispatched", "failed"]),
  dispatchMode: GovernanceOperatorActionHostExecutorDispatchModeSchema,
  taskId: z.string().min(1),
  actionRef: z.string().min(1),
  receiptId: z.string().min(1),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
  recommendedAction: RecoveryActionSchema,
  executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
  checkpointRef: z.string().min(1).optional(),
  hostExecutorDescriptorId: z.string().min(1),
  hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
  authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/),
  executorStatus: GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema.optional(),
  executorReasonCode:
    GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema.optional(),
  resultRef: GovernanceOperatorSanitizedRefSchema.optional(),
  errorClass: z.string().min(1).optional(),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
});

export const GovernanceOperatorActionHostExecutorDispatchResultSchema = z.object({
  schemaVersion: z.literal("governance-operator-action-host-executor-dispatch.v1")
    .default("governance-operator-action-host-executor-dispatch.v1"),
  status: z.enum(["dry_run_ready", "dispatched", "blocked", "failed"]),
  reasons: z.array(z.string()).default([]),
  dispatchMode: GovernanceOperatorActionHostExecutorDispatchModeSchema.optional(),
  taskId: z.string().min(1).optional(),
  actionRef: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  recommendedAction: RecoveryActionSchema.optional(),
  executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  checkpointRef: z.string().min(1).optional(),
  hostExecutorDescriptorId: z.string().min(1).optional(),
  hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  executorStatus: GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema.optional(),
  executorReasonCode:
    GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema.optional(),
  executorResultRef: GovernanceOperatorSanitizedRefSchema.optional(),
  errorClass: z.string().min(1).optional(),
  evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([]),
  operatorInstruction: z.string().min(1).optional()
}).superRefine((value, ctx) => {
  if (value.status === "dry_run_ready" || value.status === "dispatched") {
    if (value.reasons.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasons"],
        message: "operator_action_host_executor_dispatch_success_requires_no_reasons"
      });
    }

    for (const field of [
      "dispatchMode",
      "taskId",
      "actionRef",
      "receiptId",
      "envelopeHash",
      "recommendedAction",
      "executionPlanHash",
      "hostExecutorDescriptorId",
      "hostExecutorDescriptorHash",
      "authorizationIdentityHash",
      "operatorInstruction"
    ] as const) {
      if (value[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "operator_action_host_executor_dispatch_success_requires_field"
        });
      }
    }

    if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_host_executor_dispatch_success_checkpoint_required"
      });
    }

    if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_host_executor_dispatch_success_checkpoint_not_allowed"
      });
    }

    if (value.status === "dispatched" && value.executorStatus === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["executorStatus"],
        message: "operator_action_host_executor_dispatch_success_requires_executor_status"
      });
    }
    return;
  }

  if (value.reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasons"],
      message: "operator_action_host_executor_dispatch_block_requires_reasons"
    });
  }
});

// ── Sandbox-only agent executor adapter contract run boundary ──────────────

export const GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacketSchema =
  z.object({
    schemaVersion:
      z.literal("governance-operator-action-agent-executor-adapter-sandbox-contract-packet.v1")
        .default("governance-operator-action-agent-executor-adapter-sandbox-contract-packet.v1"),
    approvalString: z.literal(
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL
    ),
    reviewApprovalString: z.literal(
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL
    ),
    taskId: z.string().min(1),
    actionRef: z.string().min(1),
    receiptId: z.string().min(1),
    envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
    recommendedAction: RecoveryActionSchema,
    executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
    checkpointRef: z.string().min(1).optional(),
    hostExecutorDescriptorId: z.string().min(1),
    hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/),
    adapterId: z.string().min(1),
    adapterKind: z.literal("sandbox_reference_adapter"),
    adapterDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    sandboxScopeRef: GovernanceOperatorSanitizedRefSchema,
    sideEffectBoundary: z.literal("sandbox_only").default("sandbox_only"),
    evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
  }).superRefine((value, ctx) => {
    if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_agent_executor_adapter_sandbox_contract_checkpoint_required"
      });
    }

    if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_agent_executor_adapter_sandbox_contract_checkpoint_not_allowed"
      });
    }
  });

export const GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocationSchema =
  z.object({
    schemaVersion:
      z.literal("governance-operator-action-agent-executor-adapter-sandbox-contract-invocation.v1")
        .default("governance-operator-action-agent-executor-adapter-sandbox-contract-invocation.v1"),
    contractMode: z.literal("sandbox_contract").default("sandbox_contract"),
    taskId: z.string().min(1),
    actionRef: z.string().min(1),
    receiptId: z.string().min(1),
    envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
    recommendedAction: RecoveryActionSchema,
    executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
    checkpointRef: z.string().min(1).optional(),
    hostExecutorDescriptorId: z.string().min(1),
    hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/),
    adapterId: z.string().min(1),
    adapterKind: z.literal("sandbox_reference_adapter"),
    adapterDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    sandboxScopeRef: GovernanceOperatorSanitizedRefSchema,
    sideEffectBoundary: z.literal("sandbox_only"),
    evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([]),
    operatorInstruction: z.string().min(1)
  }).superRefine((value, ctx) => {
    if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_agent_executor_adapter_sandbox_invocation_checkpoint_required"
      });
    }

    if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRef"],
        message: "operator_action_agent_executor_adapter_sandbox_invocation_checkpoint_not_allowed"
      });
    }
  });

export const GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResultSchema =
  z.object({
    schemaVersion:
      z.literal("governance-operator-action-agent-executor-adapter-sandbox-contract-adapter-result.v1")
        .default("governance-operator-action-agent-executor-adapter-sandbox-contract-adapter-result.v1"),
    status: GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema,
    reasonCode:
      GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema.optional(),
    resultRef: GovernanceOperatorSanitizedRefSchema.optional(),
    evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
  }).superRefine((value, ctx) => {
    if (
      ["failed", "refused", "aborted"].includes(value.status) &&
      value.reasonCode === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonCode"],
        message:
          "operator_action_agent_executor_adapter_sandbox_contract_terminal_status_requires_reason_code"
      });
    }
  });

export const GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEventSchema =
  z.object({
    schemaVersion:
      z.literal("governance-operator-action-agent-executor-adapter-sandbox-contract-audit.v1")
        .default("governance-operator-action-agent-executor-adapter-sandbox-contract-audit.v1"),
    status: z.enum(["attempting", "completed", "failed"]),
    taskId: z.string().min(1),
    actionRef: z.string().min(1),
    receiptId: z.string().min(1),
    envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
    recommendedAction: RecoveryActionSchema,
    executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
    checkpointRef: z.string().min(1).optional(),
    hostExecutorDescriptorId: z.string().min(1),
    hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/),
    adapterId: z.string().min(1),
    adapterKind: z.literal("sandbox_reference_adapter"),
    adapterDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    sandboxScopeRef: GovernanceOperatorSanitizedRefSchema,
    sideEffectBoundary: z.literal("sandbox_only"),
    adapterStatus: GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema.optional(),
    adapterReasonCode:
      GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema.optional(),
    resultRef: GovernanceOperatorSanitizedRefSchema.optional(),
    errorClass: z.string().min(1).optional(),
    evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
  });

export const GovernanceOperatorActionAgentExecutorAdapterSandboxContractResultSchema =
  z.object({
    schemaVersion:
      z.literal("governance-operator-action-agent-executor-adapter-sandbox-contract.v1")
        .default("governance-operator-action-agent-executor-adapter-sandbox-contract.v1"),
    status: z.enum(["completed", "blocked", "failed"]),
    reasons: z.array(z.string()).default([]),
    approvalString: z.literal(
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL
    ).optional(),
    reviewApprovalString: z.literal(
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL
    ).optional(),
    taskId: z.string().min(1).optional(),
    actionRef: z.string().min(1).optional(),
    receiptId: z.string().min(1).optional(),
    envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    recommendedAction: RecoveryActionSchema.optional(),
    executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    checkpointRef: z.string().min(1).optional(),
    hostExecutorDescriptorId: z.string().min(1).optional(),
    hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    adapterId: z.string().min(1).optional(),
    adapterKind: GovernanceOperatorActionAgentExecutorAdapterKindSchema.optional(),
    adapterDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    sandboxScopeRef: GovernanceOperatorSanitizedRefSchema.optional(),
    sideEffectBoundary: z.literal("sandbox_only").optional(),
    adapterStatus: GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema.optional(),
    adapterReasonCode:
      GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema.optional(),
    adapterResultRef: GovernanceOperatorSanitizedRefSchema.optional(),
    errorClass: z.string().min(1).optional(),
    evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([]),
    operatorInstruction: z.string().min(1).optional()
  }).superRefine((value, ctx) => {
    if (value.status === "completed") {
      if (value.reasons.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasons"],
          message: "operator_action_agent_executor_adapter_sandbox_contract_success_requires_no_reasons"
        });
      }

      for (const field of [
        "approvalString",
        "reviewApprovalString",
        "taskId",
        "actionRef",
        "receiptId",
        "envelopeHash",
        "recommendedAction",
        "executionPlanHash",
        "hostExecutorDescriptorId",
        "hostExecutorDescriptorHash",
        "authorizationIdentityHash",
        "adapterId",
        "adapterKind",
        "adapterDescriptorHash",
        "sandboxScopeRef",
        "sideEffectBoundary",
        "adapterStatus",
        "operatorInstruction"
      ] as const) {
        if (value[field] === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: "operator_action_agent_executor_adapter_sandbox_contract_success_requires_field"
          });
        }
      }

      if (value.adapterKind !== "sandbox_reference_adapter") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["adapterKind"],
          message:
            "operator_action_agent_executor_adapter_sandbox_contract_success_requires_sandbox_reference"
        });
      }

      if (value.recommendedAction === "rollback" && value.checkpointRef === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["checkpointRef"],
          message:
            "operator_action_agent_executor_adapter_sandbox_contract_success_checkpoint_required"
        });
      }

      if (value.recommendedAction !== "rollback" && value.checkpointRef !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["checkpointRef"],
          message:
            "operator_action_agent_executor_adapter_sandbox_contract_success_checkpoint_not_allowed"
        });
      }
      return;
    }

    if (value.reasons.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasons"],
        message: "operator_action_agent_executor_adapter_sandbox_contract_block_requires_reasons"
      });
    }

    if (value.status === "failed" && value.errorClass === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["errorClass"],
        message: "operator_action_agent_executor_adapter_sandbox_contract_failed_requires_error_class"
      });
    }
  });

// ── Review-only agent executor adapter dispatch authorization ─────────────

export const GovernanceOperatorActionAgentExecutorAdapterDispatchClassSchema = z.enum([
  "review_only",
  "sandbox_contract",
  "agent_task_control",
  "provider_backed",
  "workspace_write",
  "shell_process"
]);

export const GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClassSchema =
  z.enum([
    "none",
    "sandbox_only",
    "agent_context_only",
    "workspace_write",
    "external_write",
    "production"
  ]);

export const GovernanceOperatorActionAgentExecutorAdapterDispatchReceiptContractVersionSchema =
  z.literal("governance-operator-action-host-executor-dispatch-executor-result.v1");

export const GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacketSchema =
  z.object({
    schemaVersion:
      z.literal("governance-operator-action-agent-executor-adapter-dispatch-authorization-packet.v1")
        .default("governance-operator-action-agent-executor-adapter-dispatch-authorization-packet.v1"),
    approvalString: z.literal(
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL
    ),
    reviewApprovalString: z.literal(
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL
    ),
    taskId: z.string().min(1),
    actionRef: z.string().min(1),
    receiptId: z.string().min(1),
    envelopeHash: z.string().regex(/^[a-f0-9]{64}$/),
    recommendedAction: RecoveryActionSchema,
    executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
    checkpointRefHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    hostExecutorDescriptorId: z.string().min(1),
    hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/),
    adapterId: z.string().min(1),
    adapterKind: GovernanceOperatorActionAgentExecutorAdapterKindSchema,
    adapterDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    adapterReadinessHash: z.string().regex(/^[a-f0-9]{64}$/),
    sandboxContractProofRef: GovernanceOperatorSanitizedRefSchema.optional(),
    requestedDispatchClass:
      GovernanceOperatorActionAgentExecutorAdapterDispatchClassSchema,
    requestedSideEffectClass:
      GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClassSchema,
    authorizedScopeRef: GovernanceOperatorSanitizedRefSchema,
    rollbackExpectationRef: GovernanceOperatorSanitizedRefSchema.optional(),
    abortExpectationRef: GovernanceOperatorSanitizedRefSchema,
    timeoutPolicyRef: GovernanceOperatorSanitizedRefSchema,
    auditSinkIdentityRef: GovernanceOperatorSanitizedRefSchema,
    evidenceSinkIdentityRef: GovernanceOperatorSanitizedRefSchema,
    receiptContractVersion:
      GovernanceOperatorActionAgentExecutorAdapterDispatchReceiptContractVersionSchema,
    validationCommandRefs: z.array(GovernanceOperatorSanitizedRefSchema).min(1),
    nonAuthorizationDeclaration:
      z.literal("phase16_review_only_no_adapter_invocation"),
    evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([])
  }).superRefine((value, ctx) => {
    if (value.recommendedAction === "rollback" && value.checkpointRefHash === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRefHash"],
        message:
          "operator_action_agent_executor_adapter_dispatch_authorization_checkpoint_hash_required"
      });
    }

    if (value.recommendedAction !== "rollback" && value.checkpointRefHash !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRefHash"],
        message:
          "operator_action_agent_executor_adapter_dispatch_authorization_checkpoint_hash_not_allowed"
      });
    }

    if (value.recommendedAction === "rollback" && value.rollbackExpectationRef === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rollbackExpectationRef"],
        message:
          "operator_action_agent_executor_adapter_dispatch_authorization_rollback_expectation_required"
      });
    }

    if (value.recommendedAction !== "rollback" && value.rollbackExpectationRef !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rollbackExpectationRef"],
        message:
          "operator_action_agent_executor_adapter_dispatch_authorization_rollback_expectation_not_allowed"
      });
    }
  });

export const GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResultSchema =
  z.object({
    schemaVersion:
      z.literal("governance-operator-action-agent-executor-adapter-dispatch-authorization-review.v1")
        .default("governance-operator-action-agent-executor-adapter-dispatch-authorization-review.v1"),
    status: z.enum([
      "ready_for_agent_executor_adapter_dispatch_authorization_review",
      "blocked"
    ]),
    reasons: z.array(z.string()).default([]),
    approvalString: z.literal(
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL
    ).optional(),
    reviewApprovalString: z.literal(
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL
    ).optional(),
    taskId: z.string().min(1).optional(),
    actionRef: z.string().min(1).optional(),
    receiptId: z.string().min(1).optional(),
    envelopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    recommendedAction: RecoveryActionSchema.optional(),
    executionPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    checkpointRefHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    hostExecutorDescriptorId: z.string().min(1).optional(),
    hostExecutorDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    authorizationIdentityHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    adapterId: z.string().min(1).optional(),
    adapterKind: GovernanceOperatorActionAgentExecutorAdapterKindSchema.optional(),
    adapterDescriptorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    adapterReadinessHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    sandboxContractProofRef: GovernanceOperatorSanitizedRefSchema.optional(),
    requestedDispatchClass:
      GovernanceOperatorActionAgentExecutorAdapterDispatchClassSchema.optional(),
    requestedSideEffectClass:
      GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClassSchema.optional(),
    authorizedScopeRef: GovernanceOperatorSanitizedRefSchema.optional(),
    rollbackExpectationRef: GovernanceOperatorSanitizedRefSchema.optional(),
    abortExpectationRef: GovernanceOperatorSanitizedRefSchema.optional(),
    timeoutPolicyRef: GovernanceOperatorSanitizedRefSchema.optional(),
    auditSinkIdentityRef: GovernanceOperatorSanitizedRefSchema.optional(),
    evidenceSinkIdentityRef: GovernanceOperatorSanitizedRefSchema.optional(),
    receiptContractVersion:
      GovernanceOperatorActionAgentExecutorAdapterDispatchReceiptContractVersionSchema.optional(),
    validationCommandRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([]),
    nonAuthorizationDeclaration:
      z.literal("phase16_review_only_no_adapter_invocation").optional(),
    evidenceRefs: z.array(GovernanceOperatorSanitizedRefSchema).default([]),
    operatorInstruction: z.string().min(1).optional()
  }).superRefine((value, ctx) => {
    if (value.status === "ready_for_agent_executor_adapter_dispatch_authorization_review") {
      if (value.reasons.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasons"],
          message:
            "operator_action_agent_executor_adapter_dispatch_authorization_ready_requires_no_reasons"
        });
      }

      for (const field of [
        "approvalString",
        "reviewApprovalString",
        "taskId",
        "actionRef",
        "receiptId",
        "envelopeHash",
        "recommendedAction",
        "executionPlanHash",
        "hostExecutorDescriptorId",
        "hostExecutorDescriptorHash",
        "authorizationIdentityHash",
        "adapterId",
        "adapterKind",
        "adapterDescriptorHash",
        "adapterReadinessHash",
        "requestedDispatchClass",
        "requestedSideEffectClass",
        "authorizedScopeRef",
        "abortExpectationRef",
        "timeoutPolicyRef",
        "auditSinkIdentityRef",
        "evidenceSinkIdentityRef",
        "receiptContractVersion",
        "nonAuthorizationDeclaration",
        "operatorInstruction"
      ] as const) {
        if (value[field] === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message:
              "operator_action_agent_executor_adapter_dispatch_authorization_ready_requires_field"
          });
        }
      }

      if (value.validationCommandRefs.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["validationCommandRefs"],
          message:
            "operator_action_agent_executor_adapter_dispatch_authorization_ready_requires_validation_refs"
        });
      }

      if (value.requestedDispatchClass !== "review_only") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requestedDispatchClass"],
          message:
            "operator_action_agent_executor_adapter_dispatch_authorization_ready_requires_review_only"
        });
      }

      if (value.requestedSideEffectClass !== "none") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requestedSideEffectClass"],
          message:
            "operator_action_agent_executor_adapter_dispatch_authorization_ready_requires_no_side_effect"
        });
      }

      if (value.recommendedAction === "rollback") {
        if (value.checkpointRefHash === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["checkpointRefHash"],
            message:
              "operator_action_agent_executor_adapter_dispatch_authorization_ready_checkpoint_hash_required"
          });
        }
        if (value.rollbackExpectationRef === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rollbackExpectationRef"],
            message:
              "operator_action_agent_executor_adapter_dispatch_authorization_ready_rollback_expectation_required"
          });
        }
      } else {
        if (value.checkpointRefHash !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["checkpointRefHash"],
            message:
              "operator_action_agent_executor_adapter_dispatch_authorization_ready_checkpoint_hash_not_allowed"
          });
        }
        if (value.rollbackExpectationRef !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rollbackExpectationRef"],
            message:
              "operator_action_agent_executor_adapter_dispatch_authorization_ready_rollback_expectation_not_allowed"
          });
        }
      }
      return;
    }

    if (value.reasons.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasons"],
        message:
          "operator_action_agent_executor_adapter_dispatch_authorization_block_requires_reasons"
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
export type GovernanceOperatorActionReceiptStoreConsumeStatus = z.infer<typeof GovernanceOperatorActionReceiptStoreConsumeStatusSchema>;
export type GovernanceOperatorActionReceiptStoreConsumeResultInput = z.input<typeof GovernanceOperatorActionReceiptStoreConsumeResultSchema>;
export type GovernanceOperatorActionReceiptStoreConsumeResult = z.infer<typeof GovernanceOperatorActionReceiptStoreConsumeResultSchema>;
export type GovernanceOperatorActionReceiptConsumptionStatus = z.infer<typeof GovernanceOperatorActionReceiptConsumptionStatusSchema>;
export type GovernanceOperatorActionReceiptConsumptionInput = z.input<typeof GovernanceOperatorActionReceiptConsumptionSchema>;
export type GovernanceOperatorActionReceiptConsumption = z.infer<typeof GovernanceOperatorActionReceiptConsumptionSchema>;
export type GovernanceOperatorActionExecutionMode = z.infer<typeof GovernanceOperatorActionExecutionModeSchema>;
export type GovernanceOperatorActionExecutorReceiptConsumptionInput = z.input<typeof GovernanceOperatorActionExecutorReceiptConsumptionSchema>;
export type GovernanceOperatorActionExecutorReceiptConsumption = z.infer<typeof GovernanceOperatorActionExecutorReceiptConsumptionSchema>;
export type GovernanceOperatorActionExecutorLifecycleStateInput = z.input<typeof GovernanceOperatorActionExecutorLifecycleStateSchema>;
export type GovernanceOperatorActionExecutorLifecycleState = z.infer<typeof GovernanceOperatorActionExecutorLifecycleStateSchema>;
export type GovernanceOperatorActionExecutionPlanInput = z.input<typeof GovernanceOperatorActionExecutionPlanSchema>;
export type GovernanceOperatorActionExecutionPlan = z.infer<typeof GovernanceOperatorActionExecutionPlanSchema>;
export type GovernanceOperatorActionExecutionGateResultInput = z.input<typeof GovernanceOperatorActionExecutionGateResultSchema>;
export type GovernanceOperatorActionExecutionGateResult = z.infer<typeof GovernanceOperatorActionExecutionGateResultSchema>;
export type GovernanceOperatorActionHostExecutorDescriptorInput = z.input<typeof GovernanceOperatorActionHostExecutorDescriptorSchema>;
export type GovernanceOperatorActionHostExecutorDescriptor = z.infer<typeof GovernanceOperatorActionHostExecutorDescriptorSchema>;
export type GovernanceOperatorActionHostExecutorAuthorizationPacketInput = z.input<typeof GovernanceOperatorActionHostExecutorAuthorizationPacketSchema>;
export type GovernanceOperatorActionHostExecutorAuthorizationPacket = z.infer<typeof GovernanceOperatorActionHostExecutorAuthorizationPacketSchema>;
export type GovernanceOperatorActionHostExecutorAuthorizationResultInput = z.input<typeof GovernanceOperatorActionHostExecutorAuthorizationResultSchema>;
export type GovernanceOperatorActionHostExecutorAuthorizationResult = z.infer<typeof GovernanceOperatorActionHostExecutorAuthorizationResultSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterKind = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterKindSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterDescriptorInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterDescriptorSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterDescriptor = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterDescriptorSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterReviewPacketInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterReviewPacketSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterReviewPacket = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterReviewPacketSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterReviewResultInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterReviewResultSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterReviewResult = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterReviewResultSchema>;
export type GovernanceOperatorActionHostExecutorDispatchMode = z.infer<typeof GovernanceOperatorActionHostExecutorDispatchModeSchema>;
export type GovernanceOperatorActionHostExecutorDispatchInvocationInput = z.input<typeof GovernanceOperatorActionHostExecutorDispatchInvocationSchema>;
export type GovernanceOperatorActionHostExecutorDispatchInvocation = z.infer<typeof GovernanceOperatorActionHostExecutorDispatchInvocationSchema>;
export type GovernanceOperatorActionHostExecutorDispatchExecutorStatus = z.infer<typeof GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema>;
export type GovernanceOperatorActionHostExecutorDispatchExecutorReasonCode = z.infer<typeof GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema>;
export type GovernanceOperatorActionHostExecutorDispatchExecutorResultInput = z.input<typeof GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema>;
export type GovernanceOperatorActionHostExecutorDispatchExecutorResult = z.infer<typeof GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema>;
export type GovernanceOperatorActionHostExecutorDispatchAuditEventInput = z.input<typeof GovernanceOperatorActionHostExecutorDispatchAuditEventSchema>;
export type GovernanceOperatorActionHostExecutorDispatchAuditEvent = z.infer<typeof GovernanceOperatorActionHostExecutorDispatchAuditEventSchema>;
export type GovernanceOperatorActionHostExecutorDispatchResultInput = z.input<typeof GovernanceOperatorActionHostExecutorDispatchResultSchema>;
export type GovernanceOperatorActionHostExecutorDispatchResult = z.infer<typeof GovernanceOperatorActionHostExecutorDispatchResultSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacketInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacketSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacketSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocationInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocationSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocationSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResultInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResultSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResult = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResultSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEventInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEventSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEvent = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEventSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractResultInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractResultSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterSandboxContractResult = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterSandboxContractResultSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterDispatchClass = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterDispatchClassSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClass = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterDispatchSideEffectClassSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacketInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacketSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacketSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResultInput = z.input<typeof GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResultSchema>;
export type GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult = z.infer<typeof GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResultSchema>;
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

export interface GovernanceOperatorActionReceiptStore {
  consume(receipt: GovernanceOperatorActionReceiptInput): Promise<GovernanceOperatorActionReceiptStoreConsumeResult>;
  getReceipt(receiptId: string): Promise<GovernanceOperatorActionReceipt | undefined>;
  findByTaskId(taskId: string): Promise<GovernanceOperatorActionReceipt[]>;
  findByActionRef(actionRef: string): Promise<GovernanceOperatorActionReceipt[]>;
  loadAll(): Promise<GovernanceOperatorActionReceipt[]>;
}

// ── Create input ────────────────────────────────────────────────────────────

export interface CreateGovernanceOperatorActionReceiptInput {
  envelope: GovernanceOperatorActionEnvelopeInput;
  decision: GovernanceOperatorActionReceiptDecision;
  operatorIdHash: string;
  actionIssuedAt: string | (() => string);
  createdAt: string | (() => string);
  evidenceRefs?: string[];
}

export interface PlanGovernanceOperatorActionExecutionInput {
  envelope: unknown;
  receiptConsumption?: unknown;
  lifecycleState?: unknown;
  allowedActions?: unknown;
  executionMode?: unknown;
}

export interface AuthorizeGovernanceOperatorActionHostExecutorReviewInput {
  executionGate: unknown;
  lifecycleState?: unknown;
  authorizationPacket?: unknown;
  hostExecutorDescriptor?: unknown;
}

export interface ReviewGovernanceOperatorActionAgentExecutorAdapterReadinessInput {
  executionGate: unknown;
  lifecycleState?: unknown;
  authorizationPacket?: unknown;
  hostExecutorDescriptor?: unknown;
  hostExecutorAuthorization?: unknown;
  adapterDescriptor?: unknown;
  adapterReviewPacket?: unknown;
}

export interface GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapter {
  runSandboxContract(
    invocation: GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation
  ): Promise<unknown> | unknown;
}

export interface GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditSink {
  record(
    event: GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEvent
  ): Promise<void> | void;
}

export interface RunGovernanceOperatorActionAgentExecutorAdapterSandboxContractInput {
  executionGate: unknown;
  lifecycleState?: unknown;
  authorizationPacket?: unknown;
  hostExecutorDescriptor?: unknown;
  hostExecutorAuthorization?: unknown;
  adapterDescriptor?: unknown;
  adapterReviewPacket?: unknown;
  adapterReadiness?: unknown;
  sandboxContractPacket?: unknown;
  adapter?: GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapter;
  auditSink?: GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditSink;
}

export interface ReviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationInput {
  executionGate: unknown;
  lifecycleState?: unknown;
  authorizationPacket?: unknown;
  hostExecutorDescriptor?: unknown;
  hostExecutorAuthorization?: unknown;
  adapterDescriptor?: unknown;
  adapterReviewPacket?: unknown;
  adapterReadiness?: unknown;
  dispatchAuthorizationPacket?: unknown;
}

export interface GovernanceOperatorActionHostExecutorDispatchExecutor {
  dispatch(
    invocation: GovernanceOperatorActionHostExecutorDispatchInvocation
  ): Promise<unknown> | unknown;
}

export interface GovernanceOperatorActionHostExecutorDispatchAuditSink {
  record(
    event: GovernanceOperatorActionHostExecutorDispatchAuditEvent
  ): Promise<void> | void;
}

export interface DispatchGovernanceOperatorActionHostExecutorInput {
  executionGate: unknown;
  lifecycleState?: unknown;
  authorizationPacket?: unknown;
  hostExecutorDescriptor?: unknown;
  authorization?: unknown;
  dispatchMode?: unknown;
  executor?: GovernanceOperatorActionHostExecutorDispatchExecutor;
  auditSink?: GovernanceOperatorActionHostExecutorDispatchAuditSink;
}

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
    ...(input.operatorAction.checkpointRef !== undefined
      ? { checkpointRef: input.operatorAction.checkpointRef }
      : {}),
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
    ...(envelope.checkpointRef !== undefined ? { checkpointRef: envelope.checkpointRef } : {}),
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
  envelope: GovernanceOperatorActionEnvelopeInput,
  options: { actionIssuedAt?: string } = {}
): string {
  const envelopeHash = hashGovernanceOperatorActionEnvelope(envelope);
  if (options.actionIssuedAt === undefined) {
    return `${GOVERNANCE_OPERATOR_ACTION_REF_PREFIX}${envelopeHash}`;
  }

  return `${GOVERNANCE_OPERATOR_ACTION_REF_PREFIX}${stableSha256({
    envelopeHash,
    actionIssuedAt: options.actionIssuedAt
  })}`;
}

export function createGovernanceOperatorActionReceiptId(
  receipt: Omit<GovernanceOperatorActionReceiptInput, "receiptId" | "schemaVersion">
): string {
  const canonicalReceipt =
    GovernanceOperatorActionReceiptIdPayloadSchema.parse(receipt);
  return `${GOVERNANCE_OPERATOR_ACTION_RECEIPT_ID_PREFIX}${stableSha256(canonicalReceipt)}`;
}

export function createGovernanceOperatorActionReceipt(
  input: CreateGovernanceOperatorActionReceiptInput
): GovernanceOperatorActionReceipt {
  const envelope = GovernanceOperatorActionEnvelopeSchema.parse(input.envelope);
  const actionIssuedAt = typeof input.actionIssuedAt === "function"
    ? input.actionIssuedAt()
    : input.actionIssuedAt;
  const createdAt = typeof input.createdAt === "function"
    ? input.createdAt()
    : input.createdAt;
  const envelopeHash = hashGovernanceOperatorActionEnvelope(envelope);
  const receiptWithoutId = {
    taskId: envelope.taskId,
    actionRef: createGovernanceOperatorActionRef(envelope, { actionIssuedAt }),
    envelopeHash,
    actionIssuedAt,
    decision: input.decision,
    operatorIdHash: input.operatorIdHash,
    createdAt,
    evidenceRefs: input.evidenceRefs ?? [...envelope.evidenceRefs]
  };

  return GovernanceOperatorActionReceiptSchema.parse({
    receiptId: createGovernanceOperatorActionReceiptId(receiptWithoutId),
    ...receiptWithoutId
  });
}

export function validateGovernanceOperatorActionReceipt(input: {
  envelope: GovernanceOperatorActionEnvelopeInput;
  receipt: unknown;
  actionIssuedAt?: string | (() => string);
  now: string | (() => string);
  maxActionAgeMs?: number;
  consumedActionRefs?: string[];
  consumedReceiptIds?: string[];
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
  const actionIssuedAt = typeof input.actionIssuedAt === "function"
    ? input.actionIssuedAt()
    : input.actionIssuedAt;
  const actionRef = actionIssuedAt === undefined
    ? `${GOVERNANCE_OPERATOR_ACTION_REF_PREFIX}${envelopeHash}`
    : createGovernanceOperatorActionRef(envelope, { actionIssuedAt });
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

  if (actionIssuedAt === undefined) {
    reasons.push("operator_action_receipt_action_issued_at_required");
  }

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

  if (
    actionIssuedAt !== undefined &&
    receipt.actionIssuedAt !== actionIssuedAt
  ) {
    reasons.push("operator_action_receipt_action_issued_at_mismatch");
  }

  const expectedReceiptId = createGovernanceOperatorActionReceiptId({
    taskId: receipt.taskId,
    actionRef: receipt.actionRef,
    ...(receipt.envelopeHash !== undefined ? { envelopeHash: receipt.envelopeHash } : {}),
    actionIssuedAt: receipt.actionIssuedAt,
    decision: receipt.decision,
    operatorIdHash: receipt.operatorIdHash,
    createdAt: receipt.createdAt,
    evidenceRefs: receipt.evidenceRefs
  });

  if (receipt.receiptId !== expectedReceiptId) {
    reasons.push("operator_action_receipt_id_mismatch");
  }

  const createdAtMs = Date.parse(receipt.createdAt);
  const actionIssuedAtMs = actionIssuedAt === undefined
    ? Number.NaN
    : Date.parse(actionIssuedAt);
  const nowValue = typeof input.now === "function" ? input.now() : input.now;
  const nowMs = Date.parse(nowValue);

  if (!Number.isFinite(createdAtMs)) {
    reasons.push("operator_action_receipt_created_at_invalid");
  }

  if (!Number.isFinite(nowMs)) {
    reasons.push("operator_action_receipt_now_invalid");
  }

  if (actionIssuedAt !== undefined && !Number.isFinite(actionIssuedAtMs)) {
    reasons.push("operator_action_receipt_action_issued_at_invalid");
  }

  if (Number.isFinite(createdAtMs) && Number.isFinite(nowMs) && createdAtMs > nowMs) {
    reasons.push("operator_action_receipt_created_at_after_now");
  }

  if (
    Number.isFinite(createdAtMs) &&
    Number.isFinite(actionIssuedAtMs) &&
    createdAtMs < actionIssuedAtMs
  ) {
    reasons.push("operator_action_receipt_created_at_before_action_issued_at");
  }

  if (Number.isFinite(actionIssuedAtMs) && Number.isFinite(nowMs)) {
    if (actionIssuedAtMs > nowMs) {
      reasons.push("operator_action_receipt_action_issued_at_after_now");
    }

    const maxActionAgeMs =
      input.maxActionAgeMs ?? DEFAULT_OPERATOR_ACTION_MAX_AGE_MS;
    if (!Number.isFinite(maxActionAgeMs) || maxActionAgeMs < 0) {
      reasons.push("operator_action_receipt_max_action_age_invalid");
    } else if (nowMs - actionIssuedAtMs > maxActionAgeMs) {
      reasons.push("operator_action_receipt_action_expired");
    }
  }

  const consumedActionRefs = input.consumedActionRefs ?? [];
  const consumedReceiptIds = input.consumedReceiptIds ?? [];
  if (
    consumedActionRefs.includes(actionRef) ||
    consumedActionRefs.includes(receipt.actionRef)
  ) {
    reasons.push("operator_action_receipt_replay");
  }
  if (consumedReceiptIds.includes(receipt.receiptId)) {
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

export class InMemoryGovernanceOperatorActionReceiptStore
  implements GovernanceOperatorActionReceiptStore {
  private readonly receiptsById = new Map<string, GovernanceOperatorActionReceipt>();

  async consume(
    receiptInput: GovernanceOperatorActionReceiptInput
  ): Promise<GovernanceOperatorActionReceiptStoreConsumeResult> {
    const receipt = parseReceiptForStore(receiptInput);
    const replay = this.findReplay(receipt);
    if (replay.existingReceiptIds.length > 0 || replay.existingActionRefs.length > 0) {
      return GovernanceOperatorActionReceiptStoreConsumeResultSchema.parse({
        status: "replay",
        receipt,
        ...replay
      });
    }

    this.receiptsById.set(receipt.receiptId, cloneReceipt(receipt));
    return GovernanceOperatorActionReceiptStoreConsumeResultSchema.parse({
      status: "stored",
      receipt,
      existingReceiptIds: [],
      existingActionRefs: []
    });
  }

  async getReceipt(receiptId: string): Promise<GovernanceOperatorActionReceipt | undefined> {
    const receipt = this.receiptsById.get(receiptId);
    return receipt === undefined ? undefined : cloneReceipt(receipt);
  }

  async findByTaskId(taskId: string): Promise<GovernanceOperatorActionReceipt[]> {
    return [...this.receiptsById.values()]
      .filter((receipt) => receipt.taskId === taskId)
      .map(cloneReceipt);
  }

  async findByActionRef(actionRef: string): Promise<GovernanceOperatorActionReceipt[]> {
    return [...this.receiptsById.values()]
      .filter((receipt) => receipt.actionRef === actionRef)
      .map(cloneReceipt);
  }

  async loadAll(): Promise<GovernanceOperatorActionReceipt[]> {
    return [...this.receiptsById.values()].map(cloneReceipt);
  }

  private findReplay(receipt: GovernanceOperatorActionReceipt): {
    existingReceiptIds: string[];
    existingActionRefs: string[];
  } {
    const existingReceipt = this.receiptsById.get(receipt.receiptId);
    const existingActionRefs = [...this.receiptsById.values()]
      .filter((item) => item.actionRef === receipt.actionRef)
      .map((item) => item.actionRef);

    return {
      existingReceiptIds: existingReceipt === undefined ? [] : [existingReceipt.receiptId],
      existingActionRefs: uniqueStrings(existingActionRefs)
    };
  }
}

export interface FileGovernanceOperatorActionReceiptStoreOptions {
  basePath: string;
}

const fileReceiptConsumeQueues = new Map<string, Promise<void>>();
const FILE_RECEIPT_CONSUME_LOCK_DIR = ".consume.lock";
const FILE_RECEIPT_CONSUME_LOCK_OWNER_FILE = "owner.json";
const FILE_RECEIPT_CONSUME_LOCK_RETRY_MS = 10;
const FILE_RECEIPT_CONSUME_LOCK_TIMEOUT_MS = 5_000;
const FILE_RECEIPT_CONSUME_LOCK_STALE_MS = 30_000;

type FileReceiptConsumeClaim = {
  lockPath: string;
  ownerToken: string;
};

async function withFileReceiptConsumeLock<T>(
  lockKey: string,
  lockPath: string,
  operation: () => Promise<T>
): Promise<T> {
  const previous = fileReceiptConsumeQueues.get(lockKey) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = previous.catch(() => undefined).then(() => current);
  fileReceiptConsumeQueues.set(lockKey, next);

  await previous.catch(() => undefined);
  try {
    const claim = await acquireFileReceiptConsumeClaim(lockPath);
    try {
      return await operation();
    } finally {
      await releaseFileReceiptConsumeClaim(claim);
    }
  } finally {
    release();
    if (fileReceiptConsumeQueues.get(lockKey) === next) {
      fileReceiptConsumeQueues.delete(lockKey);
    }
  }
}

async function acquireFileReceiptConsumeClaim(lockPath: string): Promise<FileReceiptConsumeClaim> {
  const startedAt = Date.now();
  for (;;) {
    try {
      await mkdir(lockPath);
    } catch (error: unknown) {
      if (!isNodeError(error) || error.code !== "EEXIST") {
        throw error;
      }

      await reclaimStaleFileReceiptConsumeClaim(lockPath);

      if (Date.now() - startedAt >= FILE_RECEIPT_CONSUME_LOCK_TIMEOUT_MS) {
        throw new Error("operator_action_receipt_store_lock_timeout");
      }

      await delay(FILE_RECEIPT_CONSUME_LOCK_RETRY_MS);
      continue;
    }

    const ownerToken = `${process.pid}:${Date.now()}:${randomUUID()}`;
    try {
      await writeFile(
        join(lockPath, FILE_RECEIPT_CONSUME_LOCK_OWNER_FILE),
        `${JSON.stringify({
          ownerToken,
          pid: process.pid,
          createdAt: new Date().toISOString()
        })}\n`,
        { encoding: "utf8", flag: "wx" }
      );
      return { lockPath, ownerToken };
    } catch (error: unknown) {
      await rm(lockPath, { recursive: true, force: true });
      throw error;
    }
  }
}

async function reclaimStaleFileReceiptConsumeClaim(lockPath: string): Promise<void> {
  const lockStat = await stat(lockPath).catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  });

  if (lockStat === undefined) {
    return;
  }

  if (Date.now() - lockStat.mtimeMs < FILE_RECEIPT_CONSUME_LOCK_STALE_MS) {
    return;
  }

  await rm(lockPath, { recursive: true, force: true });
}

async function releaseFileReceiptConsumeClaim(
  claim: FileReceiptConsumeClaim
): Promise<void> {
  const ownerText = await readFile(
    join(claim.lockPath, FILE_RECEIPT_CONSUME_LOCK_OWNER_FILE),
    "utf8"
  ).catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  });

  if (ownerText === undefined) {
    return;
  }

  let owner: { ownerToken?: unknown };
  try {
    owner = JSON.parse(ownerText) as { ownerToken?: unknown };
  } catch {
    return;
  }

  if (owner.ownerToken !== claim.ownerToken) {
    return;
  }

  await rm(claim.lockPath, { recursive: true, force: true });
}

export class FileGovernanceOperatorActionReceiptStore
  implements GovernanceOperatorActionReceiptStore {
  private readonly basePath: string;
  private readonly lockKey: string;
  private readonly lockPath: string;

  constructor(options: FileGovernanceOperatorActionReceiptStoreOptions) {
    this.basePath = resolvePath(options.basePath);
    this.lockKey = this.basePath;
    this.lockPath = join(this.basePath, FILE_RECEIPT_CONSUME_LOCK_DIR);
  }

  async consume(
    receiptInput: GovernanceOperatorActionReceiptInput
  ): Promise<GovernanceOperatorActionReceiptStoreConsumeResult> {
    await mkdir(this.basePath, { recursive: true });
    return withFileReceiptConsumeLock(this.lockKey, this.lockPath, () =>
      this.consumeExclusive(receiptInput)
    );
  }

  private async consumeExclusive(
    receiptInput: GovernanceOperatorActionReceiptInput
  ): Promise<GovernanceOperatorActionReceiptStoreConsumeResult> {
    const receipt = parseReceiptForStore(receiptInput);
    const existingReceipt = await this.getReceipt(receipt.receiptId);
    const existingActionRefs = (await this.findByActionRef(receipt.actionRef))
      .map((item) => item.actionRef);
    if (existingReceipt !== undefined || existingActionRefs.length > 0) {
      return GovernanceOperatorActionReceiptStoreConsumeResultSchema.parse({
        status: "replay",
        receipt,
        existingReceiptIds: existingReceipt === undefined ? [] : [existingReceipt.receiptId],
        existingActionRefs: uniqueStrings(existingActionRefs)
      });
    }

    await mkdir(this.basePath, { recursive: true });
    await writeFile(
      this.taskPath(receipt.taskId),
      `${JSON.stringify(receipt)}\n`,
      { encoding: "utf8", flag: "a" }
    );

    return GovernanceOperatorActionReceiptStoreConsumeResultSchema.parse({
      status: "stored",
      receipt,
      existingReceiptIds: [],
      existingActionRefs: []
    });
  }

  async getReceipt(receiptId: string): Promise<GovernanceOperatorActionReceipt | undefined> {
    const receipts = await this.loadAll();
    const receipt = receipts.find((item) => item.receiptId === receiptId);
    return receipt === undefined ? undefined : cloneReceipt(receipt);
  }

  async findByTaskId(taskId: string): Promise<GovernanceOperatorActionReceipt[]> {
    const receipts = await this.readTaskReceipts(taskId);
    return receipts
      .filter((receipt) => receipt.taskId === taskId)
      .map(cloneReceipt);
  }

  async findByActionRef(actionRef: string): Promise<GovernanceOperatorActionReceipt[]> {
    const receipts = await this.loadAll();
    return receipts
      .filter((receipt) => receipt.actionRef === actionRef)
      .map(cloneReceipt);
  }

  async loadAll(): Promise<GovernanceOperatorActionReceipt[]> {
    await mkdir(this.basePath, { recursive: true });
    const fileNames = await readdir(this.basePath);
    const receipts: GovernanceOperatorActionReceipt[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".jsonl")) {
        continue;
      }
      receipts.push(...await this.readReceiptFile(join(this.basePath, fileName)));
    }
    return receipts.map(cloneReceipt);
  }

  private taskPath(taskId: string): string {
    return join(this.basePath, `task-${stableSha256(taskId)}.jsonl`);
  }

  private async readTaskReceipts(taskId: string): Promise<GovernanceOperatorActionReceipt[]> {
    const taskPath = this.taskPath(taskId);
    const content = await readFile(taskPath, "utf8").catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return "";
      }

      throw error;
    });
    if (content === "") {
      return [];
    }

    return parseReceiptLines(content, taskPath);
  }

  private async readReceiptFile(filePath: string): Promise<GovernanceOperatorActionReceipt[]> {
    const content = await readFile(filePath, "utf8");
    return parseReceiptLines(content, filePath);
  }
}

export function createInMemoryGovernanceOperatorActionReceiptStore(): InMemoryGovernanceOperatorActionReceiptStore {
  return new InMemoryGovernanceOperatorActionReceiptStore();
}

export function createFileGovernanceOperatorActionReceiptStore(
  options: FileGovernanceOperatorActionReceiptStoreOptions
): FileGovernanceOperatorActionReceiptStore {
  return new FileGovernanceOperatorActionReceiptStore(options);
}

export async function validateAndConsumeGovernanceOperatorActionReceipt(input: {
  store: GovernanceOperatorActionReceiptStore;
  envelope: GovernanceOperatorActionEnvelopeInput;
  receipt: unknown;
  actionIssuedAt?: string | (() => string);
  now: string | (() => string);
  maxActionAgeMs?: number;
}): Promise<GovernanceOperatorActionReceiptConsumption> {
  const validation = validateGovernanceOperatorActionReceipt({
    envelope: input.envelope,
    receipt: input.receipt,
    ...(input.actionIssuedAt !== undefined ? { actionIssuedAt: input.actionIssuedAt } : {}),
    now: input.now,
    ...(input.maxActionAgeMs !== undefined ? { maxActionAgeMs: input.maxActionAgeMs } : {})
  });

  if (validation.status === "blocked" || validation.receipt === undefined) {
    return GovernanceOperatorActionReceiptConsumptionSchema.parse({
      status: "blocked",
      durable: false,
      reasons: validation.reasons,
      validation,
      ...(validation.taskId !== undefined ? { taskId: validation.taskId } : {}),
      ...(validation.actionRef !== undefined ? { actionRef: validation.actionRef } : {}),
      ...(validation.envelopeHash !== undefined ? { envelopeHash: validation.envelopeHash } : {})
    });
  }

  let storeResult: GovernanceOperatorActionReceiptStoreConsumeResult;
  try {
    storeResult = GovernanceOperatorActionReceiptStoreConsumeResultSchema.parse(
      await input.store.consume(validation.receipt)
    );
  } catch {
    return GovernanceOperatorActionReceiptConsumptionSchema.parse({
      status: "blocked",
      durable: false,
      reasons: ["operator_action_receipt_store_failed"],
      validation,
      taskId: validation.taskId,
      actionRef: validation.actionRef,
      envelopeHash: validation.envelopeHash,
      receipt: validation.receipt
    });
  }

  let storedReceipt: GovernanceOperatorActionReceipt;
  try {
    storedReceipt = parseReceiptForStore(storeResult.receipt);
  } catch {
    return GovernanceOperatorActionReceiptConsumptionSchema.parse({
      status: "blocked",
      durable: false,
      reasons: ["operator_action_receipt_store_failed"],
      validation,
      taskId: validation.taskId,
      actionRef: validation.actionRef,
      envelopeHash: validation.envelopeHash,
      receipt: validation.receipt
    });
  }

  if (
    stableStringify(storedReceipt) !== stableStringify(validation.receipt)
  ) {
    return GovernanceOperatorActionReceiptConsumptionSchema.parse({
      status: "blocked",
      durable: false,
      reasons: ["operator_action_receipt_store_failed"],
      validation,
      taskId: validation.taskId,
      actionRef: validation.actionRef,
      envelopeHash: validation.envelopeHash,
      receipt: validation.receipt
    });
  }

  if (storeResult.status === "replay") {
    return GovernanceOperatorActionReceiptConsumptionSchema.parse({
      status: "blocked",
      durable: false,
      reasons: ["operator_action_receipt_replay"],
      validation: GovernanceOperatorActionReceiptValidationSchema.parse({
        ...validation,
        status: "blocked",
        reasons: ["operator_action_receipt_replay"]
      }),
      taskId: validation.taskId,
      actionRef: validation.actionRef,
      envelopeHash: validation.envelopeHash,
      receipt: validation.receipt
    });
  }

  return markGovernanceOperatorActionReceiptConsumptionStoreProduced(
    GovernanceOperatorActionReceiptConsumptionSchema.parse({
      status: "passed",
      durable: true,
      reasons: [],
      validation,
      taskId: validation.taskId,
      actionRef: validation.actionRef,
      envelopeHash: validation.envelopeHash,
      receipt: validation.receipt
    })
  );
}

export function planGovernanceOperatorActionExecution(
  input: PlanGovernanceOperatorActionExecutionInput
): GovernanceOperatorActionExecutionGateResult {
  let envelope: GovernanceOperatorActionEnvelope;
  try {
    envelope = GovernanceOperatorActionEnvelopeSchema.parse(input.envelope);
  } catch {
    return createBlockedOperatorActionExecutionGateResult([
      "operator_action_executor_envelope_invalid"
    ]);
  }

  const reasons: string[] = [];
  const envelopeHash = hashGovernanceOperatorActionEnvelope(envelope);

  if (input.executionMode !== "plan_only") {
    addUniqueReason(
      reasons,
      input.executionMode === undefined
        ? "operator_action_executor_mode_required"
        : "operator_action_executor_mode_not_plan_only"
    );
  }

  let allowedActions: RecoveryAction[] | undefined;
  try {
    allowedActions = z.array(RecoveryActionSchema).min(1).parse(input.allowedActions);
    if (!allowedActions.includes(envelope.recommendedAction)) {
      addUniqueReason(reasons, "operator_action_executor_action_not_allowed");
    }
  } catch {
    addUniqueReason(reasons, "operator_action_executor_allowed_actions_invalid");
  }

  let consumption: GovernanceOperatorActionExecutorReceiptConsumption | undefined;
  if (input.receiptConsumption === undefined) {
    addUniqueReason(reasons, "operator_action_executor_receipt_consumption_required");
  } else {
    try {
      consumption = GovernanceOperatorActionExecutorReceiptConsumptionSchema.parse(
        input.receiptConsumption
      );
      if (
        consumption.status === "passed" &&
        consumption.durable === true &&
        !hasGovernanceOperatorActionReceiptConsumptionStoreProof(
          input.receiptConsumption,
          consumption
        )
      ) {
        addUniqueReason(
          reasons,
          "operator_action_executor_receipt_consumption_store_proof_missing"
        );
      }
      addOperatorActionReceiptConsumptionReasons(reasons, consumption, envelope, envelopeHash);
    } catch {
      addUniqueReason(reasons, "operator_action_executor_receipt_consumption_invalid");
    }
  }

  addOperatorActionLifecycleReasons(reasons, {
    input: input.lifecycleState,
    envelope,
    ...(consumption !== undefined ? { consumption } : {})
  });

  const receipt = consumption?.receipt;
  if (reasons.length > 0 || consumption === undefined || receipt === undefined) {
    return createBlockedOperatorActionExecutionGateResult(reasons, {
      envelope,
      ...(consumption !== undefined ? { consumption } : {})
    });
  }

  const plan = GovernanceOperatorActionExecutionPlanSchema.parse({
    taskId: envelope.taskId,
    actionRef: receipt.actionRef,
    receiptId: receipt.receiptId,
    envelopeHash,
    recommendedAction: envelope.recommendedAction,
    executionMode: "plan_only",
    requiresHumanApproval: envelope.requiresHumanApproval,
    lockdown: envelope.lockdown,
    ...(envelope.checkpointRef !== undefined ? { checkpointRef: envelope.checkpointRef } : {}),
    evidenceRefs: [...envelope.evidenceRefs],
    artifactRefs: [...envelope.artifactRefs],
    blockingReasons: [...envelope.blockingReasons],
    operatorInstruction:
      `Plan-only gate accepted ${envelope.recommendedAction}; a separate explicit executor is required for any side effect.`
  });

  return GovernanceOperatorActionExecutionGateResultSchema.parse({
    status: "planned",
    reasons: [],
    taskId: envelope.taskId,
    actionRef: receipt.actionRef,
    receiptId: receipt.receiptId,
    envelopeHash,
    recommendedAction: envelope.recommendedAction,
    executionMode: "plan_only",
    ...(envelope.checkpointRef !== undefined ? { checkpointRef: envelope.checkpointRef } : {}),
    plan
  });
}

export function hashGovernanceOperatorActionExecutionPlan(
  plan: GovernanceOperatorActionExecutionPlanInput
): string {
  return stableSha256(GovernanceOperatorActionExecutionPlanSchema.parse(plan));
}

export function hashGovernanceOperatorActionHostExecutorDescriptor(
  descriptor: GovernanceOperatorActionHostExecutorDescriptorInput
): string {
  return stableSha256(
    GovernanceOperatorActionHostExecutorDescriptorSchema.parse(descriptor)
  );
}

export function hashGovernanceOperatorActionAgentExecutorAdapterDescriptor(
  descriptor: GovernanceOperatorActionAgentExecutorAdapterDescriptorInput
): string {
  return stableSha256(
    GovernanceOperatorActionAgentExecutorAdapterDescriptorSchema.parse(descriptor)
  );
}

export function hashGovernanceOperatorActionAgentExecutorAdapterReviewResult(
  reviewResult: GovernanceOperatorActionAgentExecutorAdapterReviewResultInput
): string {
  return stableSha256(
    GovernanceOperatorActionAgentExecutorAdapterReviewResultSchema.parse(reviewResult)
  );
}

export function authorizeGovernanceOperatorActionHostExecutorReview(
  input: AuthorizeGovernanceOperatorActionHostExecutorReviewInput
): GovernanceOperatorActionHostExecutorAuthorizationResult {
  let gate: GovernanceOperatorActionExecutionGateResult;
  try {
    gate = GovernanceOperatorActionExecutionGateResultSchema.parse(input.executionGate);
  } catch {
    return createBlockedOperatorActionHostExecutorAuthorizationResult([
      "operator_action_host_executor_gate_invalid"
    ]);
  }

  const reasons: string[] = [];
  if (gate.status !== "planned") {
    addUniqueReason(reasons, "operator_action_host_executor_gate_not_planned");
  }

  if (gate.executionMode !== "plan_only") {
    addUniqueReason(reasons, "operator_action_host_executor_gate_not_plan_only");
  }

  const plan = gate.plan;
  let executionPlanHash: string | undefined;
  if (plan === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_plan_required");
  } else {
    executionPlanHash = hashGovernanceOperatorActionExecutionPlan(plan);
  }

  addHostExecutorLifecycleReasons(reasons, {
    lifecycleState: input.lifecycleState,
    gate
  });

  let packet: GovernanceOperatorActionHostExecutorAuthorizationPacket | undefined;
  if (input.authorizationPacket === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_authorization_packet_required");
  } else {
    try {
      packet = GovernanceOperatorActionHostExecutorAuthorizationPacketSchema.parse(
        input.authorizationPacket
      );
    } catch {
      addUniqueReason(reasons, "operator_action_host_executor_authorization_packet_invalid");
    }
  }

  let descriptor: GovernanceOperatorActionHostExecutorDescriptor | undefined;
  let descriptorHash: string | undefined;
  if (input.hostExecutorDescriptor === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_descriptor_required");
  } else {
    try {
      descriptor = GovernanceOperatorActionHostExecutorDescriptorSchema.parse(
        input.hostExecutorDescriptor
      );
      descriptorHash = hashGovernanceOperatorActionHostExecutorDescriptor(descriptor);
      if (
        gate.recommendedAction !== undefined &&
        !descriptor.supportedActions.includes(gate.recommendedAction)
      ) {
        addUniqueReason(reasons, "operator_action_host_executor_action_not_supported");
      }
    } catch {
      addUniqueReason(reasons, "operator_action_host_executor_descriptor_invalid");
    }
  }

  if (packet !== undefined) {
    addHostExecutorAuthorizationPacketReasons(reasons, {
      packet,
      gate,
      ...(executionPlanHash !== undefined ? { executionPlanHash } : {}),
      ...(descriptor !== undefined ? { descriptor } : {}),
      ...(descriptorHash !== undefined ? { descriptorHash } : {})
    });
  }

  if (
    reasons.length > 0 ||
    packet === undefined ||
    descriptor === undefined ||
    descriptorHash === undefined ||
    executionPlanHash === undefined
  ) {
    return createBlockedOperatorActionHostExecutorAuthorizationResult(reasons, {
      gate,
      ...(packet !== undefined ? { packet } : {}),
      ...(descriptor !== undefined ? { descriptor } : {}),
      ...(descriptorHash !== undefined ? { descriptorHash } : {}),
      ...(executionPlanHash !== undefined ? { executionPlanHash } : {})
    });
  }

  return GovernanceOperatorActionHostExecutorAuthorizationResultSchema.parse({
    status: "ready_for_host_executor_review",
    reasons: [],
    taskId: gate.taskId,
    actionRef: gate.actionRef,
    receiptId: gate.receiptId,
    envelopeHash: gate.envelopeHash,
    recommendedAction: gate.recommendedAction,
    executionMode: "plan_only",
    executionPlanHash,
    ...(gate.checkpointRef !== undefined ? { checkpointRef: gate.checkpointRef } : {}),
    hostExecutorDescriptorId: descriptor.descriptorId,
    hostExecutorDescriptorHash: descriptorHash,
    authorizationIdentityHash: packet.authorizationIdentityHash,
    evidenceRefs: uniqueStrings([...packet.evidenceRefs, ...descriptor.evidenceRefs]),
    operatorInstruction:
      `Non-executing host executor review accepted ${gate.recommendedAction}; a separate explicit dispatch authorization is required for any side effect.`
  });
}

export function reviewGovernanceOperatorActionAgentExecutorAdapterReadiness(
  input: ReviewGovernanceOperatorActionAgentExecutorAdapterReadinessInput
): GovernanceOperatorActionAgentExecutorAdapterReviewResult {
  const review = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: input.executionGate,
    lifecycleState: input.lifecycleState,
    ...(input.authorizationPacket !== undefined
      ? { authorizationPacket: input.authorizationPacket }
      : {}),
    ...(input.hostExecutorDescriptor !== undefined
      ? { hostExecutorDescriptor: input.hostExecutorDescriptor }
      : {})
  });
  const reasons: string[] = [];

  let authorization: GovernanceOperatorActionHostExecutorAuthorizationResult | undefined;
  if (input.hostExecutorAuthorization === undefined) {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_authorization_required");
  } else {
    const parsedAuthorization =
      GovernanceOperatorActionHostExecutorAuthorizationResultSchema.safeParse(
        input.hostExecutorAuthorization
      );
    if (parsedAuthorization.success) {
      authorization = parsedAuthorization.data;
      if (authorization.status !== "ready_for_host_executor_review") {
        addUniqueReason(reasons, "operator_action_agent_executor_adapter_authorization_not_ready");
      }
    } else {
      addUniqueReason(reasons, "operator_action_agent_executor_adapter_authorization_invalid");
    }
  }

  let adapterDescriptor: GovernanceOperatorActionAgentExecutorAdapterDescriptor | undefined;
  let adapterDescriptorHash: string | undefined;
  if (input.adapterDescriptor === undefined) {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_descriptor_required");
  } else {
    const parsedDescriptor =
      GovernanceOperatorActionAgentExecutorAdapterDescriptorSchema.safeParse(
        input.adapterDescriptor
      );
    if (parsedDescriptor.success) {
      adapterDescriptor = parsedDescriptor.data;
      adapterDescriptorHash =
        hashGovernanceOperatorActionAgentExecutorAdapterDescriptor(adapterDescriptor);
      if (
        review.recommendedAction !== undefined &&
        !adapterDescriptor.supportedActions.includes(review.recommendedAction)
      ) {
        addUniqueReason(reasons, "operator_action_agent_executor_adapter_action_not_supported");
      }
      if (
        review.hostExecutorDescriptorId !== undefined &&
        adapterDescriptor.hostExecutorDescriptorId !== review.hostExecutorDescriptorId
      ) {
        addUniqueReason(
          reasons,
          "operator_action_agent_executor_adapter_host_descriptor_id_mismatch"
        );
      }
    } else {
      addUniqueReason(reasons, "operator_action_agent_executor_adapter_descriptor_invalid");
    }
  }

  let adapterReviewPacket: GovernanceOperatorActionAgentExecutorAdapterReviewPacket | undefined;
  if (input.adapterReviewPacket === undefined) {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_review_packet_required");
  } else {
    const parsedPacket =
      GovernanceOperatorActionAgentExecutorAdapterReviewPacketSchema.safeParse(
        input.adapterReviewPacket
      );
    if (parsedPacket.success) {
      adapterReviewPacket = parsedPacket.data;
    } else {
      addUniqueReason(reasons, "operator_action_agent_executor_adapter_review_packet_invalid");
    }
  }

  if (review.status !== "ready_for_host_executor_review") {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_review_not_ready");
    for (const reason of review.reasons) {
      addUniqueReason(reasons, reason);
    }
  }

  if (authorization !== undefined && review.status === "ready_for_host_executor_review") {
    addAgentExecutorAdapterAuthorizationReasons(reasons, {
      authorization,
      review
    });
  }

  if (
    adapterReviewPacket !== undefined &&
    review.status === "ready_for_host_executor_review"
  ) {
    addAgentExecutorAdapterReviewPacketReasons(reasons, {
      packet: adapterReviewPacket,
      review,
      ...(adapterDescriptor !== undefined ? { adapterDescriptor } : {}),
      ...(adapterDescriptorHash !== undefined ? { adapterDescriptorHash } : {})
    });
  }

  if (
    reasons.length > 0 ||
    authorization === undefined ||
    authorization.status !== "ready_for_host_executor_review" ||
    review.status !== "ready_for_host_executor_review" ||
    adapterDescriptor === undefined ||
    adapterDescriptorHash === undefined ||
    adapterReviewPacket === undefined
  ) {
    return createBlockedOperatorActionAgentExecutorAdapterReviewResult(reasons, {
      review,
      ...(authorization !== undefined ? { authorization } : {}),
      ...(adapterDescriptor !== undefined ? { adapterDescriptor } : {}),
      ...(adapterDescriptorHash !== undefined ? { adapterDescriptorHash } : {}),
      ...(adapterReviewPacket !== undefined ? { adapterReviewPacket } : {})
    });
  }

  const evidenceRefs = uniqueStrings([
    ...review.evidenceRefs,
    ...adapterDescriptor.evidenceRefs,
    ...adapterReviewPacket.evidenceRefs
  ]);

  return GovernanceOperatorActionAgentExecutorAdapterReviewResultSchema.parse({
    status: "ready_for_agent_executor_adapter_review",
    reasons: [],
    approvalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
    taskId: review.taskId,
    actionRef: review.actionRef,
    receiptId: review.receiptId,
    envelopeHash: review.envelopeHash,
    recommendedAction: review.recommendedAction,
    executionMode: review.executionMode,
    executionPlanHash: review.executionPlanHash,
    ...(review.checkpointRef !== undefined ? { checkpointRef: review.checkpointRef } : {}),
    hostExecutorDescriptorId: review.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: review.hostExecutorDescriptorHash,
    authorizationIdentityHash: review.authorizationIdentityHash,
    adapterId: adapterDescriptor.adapterId,
    adapterKind: adapterDescriptor.adapterKind,
    adapterDescriptorHash,
    executionBoundary: "review_only",
    invocationSupported: false,
    evidenceRefs,
    operatorInstruction:
      `Review-only agent executor adapter readiness accepted ${review.recommendedAction}; no Codex CLI, sub-agent runtime, provider, shell, workspace-write, or recovery action was invoked.`
  });
}

export async function runGovernanceOperatorActionAgentExecutorAdapterSandboxContract(
  input: RunGovernanceOperatorActionAgentExecutorAdapterSandboxContractInput
): Promise<GovernanceOperatorActionAgentExecutorAdapterSandboxContractResult> {
  const readiness = reviewGovernanceOperatorActionAgentExecutorAdapterReadiness({
    executionGate: input.executionGate,
    lifecycleState: input.lifecycleState,
    ...(input.authorizationPacket !== undefined
      ? { authorizationPacket: input.authorizationPacket }
      : {}),
    ...(input.hostExecutorDescriptor !== undefined
      ? { hostExecutorDescriptor: input.hostExecutorDescriptor }
      : {}),
    ...(input.hostExecutorAuthorization !== undefined
      ? { hostExecutorAuthorization: input.hostExecutorAuthorization }
      : {}),
    ...(input.adapterDescriptor !== undefined
      ? { adapterDescriptor: input.adapterDescriptor }
      : {}),
    ...(input.adapterReviewPacket !== undefined
      ? { adapterReviewPacket: input.adapterReviewPacket }
      : {})
  });
  const reasons: string[] = [];

  let suppliedReadiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult | undefined;
  if (input.adapterReadiness === undefined) {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_sandbox_contract_readiness_required");
  } else {
    const parsedReadiness =
      GovernanceOperatorActionAgentExecutorAdapterReviewResultSchema.safeParse(
        input.adapterReadiness
      );
    if (parsedReadiness.success) {
      suppliedReadiness = parsedReadiness.data;
      if (suppliedReadiness.status !== "ready_for_agent_executor_adapter_review") {
        addUniqueReason(
          reasons,
          "operator_action_agent_executor_adapter_sandbox_contract_readiness_not_ready"
        );
      }
    } else {
      addUniqueReason(reasons, "operator_action_agent_executor_adapter_sandbox_contract_readiness_invalid");
    }
  }

  let sandboxContractPacket:
    | GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket
    | undefined;
  if (input.sandboxContractPacket === undefined) {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_sandbox_contract_packet_required");
  } else {
    const parsedPacket =
      GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacketSchema.safeParse(
        input.sandboxContractPacket
      );
    if (parsedPacket.success) {
      sandboxContractPacket = parsedPacket.data;
    } else {
      addUniqueReason(reasons, "operator_action_agent_executor_adapter_sandbox_contract_packet_invalid");
    }
  }

  if (readiness.status !== "ready_for_agent_executor_adapter_review") {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_sandbox_contract_review_not_ready");
    for (const reason of readiness.reasons) {
      addUniqueReason(reasons, reason);
    }
  }

  if (
    suppliedReadiness !== undefined &&
    readiness.status === "ready_for_agent_executor_adapter_review"
  ) {
    addAgentExecutorAdapterSandboxContractReadinessReasons(reasons, {
      suppliedReadiness,
      readiness
    });
  }

  if (
    sandboxContractPacket !== undefined &&
    readiness.status === "ready_for_agent_executor_adapter_review"
  ) {
    addAgentExecutorAdapterSandboxContractPacketReasons(reasons, {
      packet: sandboxContractPacket,
      readiness
    });
  }

  if (input.adapter === undefined) {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_sandbox_contract_adapter_required");
  }

  if (input.auditSink === undefined) {
    addUniqueReason(reasons, "operator_action_agent_executor_adapter_sandbox_contract_audit_sink_required");
  }

  if (
    reasons.length > 0 ||
    suppliedReadiness === undefined ||
    suppliedReadiness.status !== "ready_for_agent_executor_adapter_review" ||
    readiness.status !== "ready_for_agent_executor_adapter_review" ||
    sandboxContractPacket === undefined
  ) {
    return createBlockedOperatorActionAgentExecutorAdapterSandboxContractResult(reasons, {
      readiness,
      ...(suppliedReadiness !== undefined ? { suppliedReadiness } : {}),
      ...(sandboxContractPacket !== undefined ? { sandboxContractPacket } : {})
    });
  }

  const invocation = createOperatorActionAgentExecutorAdapterSandboxContractInvocation({
    readiness,
    sandboxContractPacket
  });

  if (input.adapter === undefined || input.auditSink === undefined) {
    return createBlockedOperatorActionAgentExecutorAdapterSandboxContractResult([
      "operator_action_agent_executor_adapter_sandbox_contract_adapter_required",
      "operator_action_agent_executor_adapter_sandbox_contract_audit_sink_required"
    ], {
      readiness,
      suppliedReadiness,
      sandboxContractPacket
    });
  }

  try {
    await input.auditSink.record(createAgentExecutorAdapterSandboxContractAuditEvent({
      status: "attempting",
      invocation,
      evidenceRefs: invocation.evidenceRefs
    }));
  } catch {
    return createBlockedOperatorActionAgentExecutorAdapterSandboxContractResult([
      "operator_action_agent_executor_adapter_sandbox_contract_audit_sink_failed"
    ], {
      readiness,
      suppliedReadiness,
      sandboxContractPacket
    });
  }

  let adapterResult: GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResult;
  try {
    adapterResult =
      GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapterResultSchema.parse(
        await input.adapter.runSandboxContract(invocation)
      );
  } catch (error) {
    const errorClass = normalizeAgentExecutorAdapterSandboxContractErrorClass(error);
    const failedResult = createFailedOperatorActionAgentExecutorAdapterSandboxContractResult({
      invocation,
      reasons: ["operator_action_agent_executor_adapter_sandbox_contract_adapter_failed"],
      errorClass,
      evidenceRefs: invocation.evidenceRefs
    });
    await recordAgentExecutorAdapterSandboxContractFailure(
      input.auditSink,
      invocation,
      failedResult
    );
    return failedResult;
  }

  const evidenceRefs = uniqueStrings([
    ...invocation.evidenceRefs,
    ...adapterResult.evidenceRefs
  ]);
  const completed = createReadyOperatorActionAgentExecutorAdapterSandboxContractResult({
    invocation,
    adapterStatus: adapterResult.status,
    ...(adapterResult.reasonCode !== undefined
      ? { adapterReasonCode: adapterResult.reasonCode }
      : {}),
    ...(adapterResult.resultRef !== undefined
      ? { adapterResultRef: adapterResult.resultRef }
      : {}),
    evidenceRefs,
    operatorInstruction:
      `Sandbox-only agent executor adapter contract returned ${adapterResult.status} for ${invocation.recommendedAction}; no Codex CLI, sub-agent runtime, provider, shell, workspace-write, or recovery action was invoked by codex-router.`
  });

  try {
    await input.auditSink.record(createAgentExecutorAdapterSandboxContractAuditEvent({
      status: "completed",
      invocation,
      adapterStatus: adapterResult.status,
      ...(adapterResult.reasonCode !== undefined
        ? { adapterReasonCode: adapterResult.reasonCode }
        : {}),
      ...(adapterResult.resultRef !== undefined ? { resultRef: adapterResult.resultRef } : {}),
      evidenceRefs
    }));
  } catch {
    return createFailedOperatorActionAgentExecutorAdapterSandboxContractResult({
      invocation,
      reasons: ["operator_action_agent_executor_adapter_sandbox_contract_audit_sink_failed"],
      errorClass: "operator_action_agent_executor_adapter_sandbox_contract_audit_sink_failed",
      evidenceRefs
    });
  }

  return completed;
}

export function reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization(
  input: ReviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationInput
): GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult {
  const readiness = reviewGovernanceOperatorActionAgentExecutorAdapterReadiness({
    executionGate: input.executionGate,
    lifecycleState: input.lifecycleState,
    ...(input.authorizationPacket !== undefined
      ? { authorizationPacket: input.authorizationPacket }
      : {}),
    ...(input.hostExecutorDescriptor !== undefined
      ? { hostExecutorDescriptor: input.hostExecutorDescriptor }
      : {}),
    ...(input.hostExecutorAuthorization !== undefined
      ? { hostExecutorAuthorization: input.hostExecutorAuthorization }
      : {}),
    ...(input.adapterDescriptor !== undefined
      ? { adapterDescriptor: input.adapterDescriptor }
      : {}),
    ...(input.adapterReviewPacket !== undefined
      ? { adapterReviewPacket: input.adapterReviewPacket }
      : {})
  });
  const reasons: string[] = [];

  let suppliedReadiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult | undefined;
  if (input.adapterReadiness === undefined) {
    addUniqueReason(
      reasons,
      "operator_action_agent_executor_adapter_dispatch_authorization_readiness_required"
    );
  } else {
    const parsedReadiness =
      GovernanceOperatorActionAgentExecutorAdapterReviewResultSchema.safeParse(
        input.adapterReadiness
      );
    if (parsedReadiness.success) {
      suppliedReadiness = parsedReadiness.data;
      if (suppliedReadiness.status !== "ready_for_agent_executor_adapter_review") {
        addUniqueReason(
          reasons,
          "operator_action_agent_executor_adapter_dispatch_authorization_readiness_not_ready"
        );
      }
    } else {
      addUniqueReason(
        reasons,
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_invalid"
      );
    }
  }

  let dispatchAuthorizationPacket:
    | GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket
    | undefined;
  if (input.dispatchAuthorizationPacket === undefined) {
    addUniqueReason(
      reasons,
      "operator_action_agent_executor_adapter_dispatch_authorization_packet_required"
    );
  } else {
    const parsedPacket =
      GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacketSchema.safeParse(
        input.dispatchAuthorizationPacket
      );
    if (parsedPacket.success) {
      dispatchAuthorizationPacket = parsedPacket.data;
    } else {
      addUniqueReason(
        reasons,
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_invalid"
      );
    }
  }

  if (readiness.status !== "ready_for_agent_executor_adapter_review") {
    addUniqueReason(
      reasons,
      "operator_action_agent_executor_adapter_dispatch_authorization_review_not_ready"
    );
    for (const reason of readiness.reasons) {
      addUniqueReason(reasons, reason);
    }
  }

  if (
    suppliedReadiness !== undefined &&
    readiness.status === "ready_for_agent_executor_adapter_review"
  ) {
    addAgentExecutorAdapterDispatchAuthorizationReadinessReasons(reasons, {
      suppliedReadiness,
      readiness
    });
  }

  if (
    dispatchAuthorizationPacket !== undefined &&
    readiness.status === "ready_for_agent_executor_adapter_review"
  ) {
    addAgentExecutorAdapterDispatchAuthorizationPacketReasons(reasons, {
      packet: dispatchAuthorizationPacket,
      readiness,
      adapterReadinessHash:
        hashGovernanceOperatorActionAgentExecutorAdapterReviewResult(readiness)
    });

    if (dispatchAuthorizationPacket.requestedDispatchClass !== "review_only") {
      addUniqueReason(
        reasons,
        "operator_action_agent_executor_adapter_dispatch_authorization_dispatch_class_not_review_only"
      );
    }

    if (dispatchAuthorizationPacket.requestedSideEffectClass !== "none") {
      addUniqueReason(
        reasons,
        "operator_action_agent_executor_adapter_dispatch_authorization_side_effect_class_not_none"
      );
    }

    if (
      dispatchAuthorizationPacket.requestedDispatchClass === "sandbox_contract" &&
      dispatchAuthorizationPacket.sandboxContractProofRef === undefined
    ) {
      addUniqueReason(
        reasons,
        "operator_action_agent_executor_adapter_dispatch_authorization_sandbox_proof_required"
      );
    }

    if (
      dispatchAuthorizationPacket.requestedDispatchClass === "review_only" &&
      dispatchAuthorizationPacket.sandboxContractProofRef !== undefined
    ) {
      addUniqueReason(
        reasons,
        "operator_action_agent_executor_adapter_dispatch_authorization_sandbox_proof_not_allowed_for_review_only"
      );
    }
  }

  if (
    reasons.length > 0 ||
    suppliedReadiness === undefined ||
    suppliedReadiness.status !== "ready_for_agent_executor_adapter_review" ||
    readiness.status !== "ready_for_agent_executor_adapter_review" ||
    dispatchAuthorizationPacket === undefined
  ) {
    return createBlockedOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult(
      reasons,
      {
        readiness,
        ...(suppliedReadiness !== undefined ? { suppliedReadiness } : {}),
        ...(dispatchAuthorizationPacket !== undefined ? { dispatchAuthorizationPacket } : {})
      }
    );
  }

  const adapterReadinessHash =
    hashGovernanceOperatorActionAgentExecutorAdapterReviewResult(readiness);
  const checkpointRefHash = getAgentExecutorAdapterReadinessCheckpointRefHash(readiness);
  const evidenceRefs = uniqueStrings([
    ...readiness.evidenceRefs,
    ...dispatchAuthorizationPacket.evidenceRefs
  ]);

  return GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResultSchema.parse({
    status: "ready_for_agent_executor_adapter_dispatch_authorization_review",
    reasons: [],
    approvalString:
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
    reviewApprovalString:
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
    taskId: readiness.taskId,
    actionRef: readiness.actionRef,
    receiptId: readiness.receiptId,
    envelopeHash: readiness.envelopeHash,
    recommendedAction: readiness.recommendedAction,
    executionPlanHash: readiness.executionPlanHash,
    ...(checkpointRefHash !== undefined ? { checkpointRefHash } : {}),
    hostExecutorDescriptorId: readiness.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: readiness.hostExecutorDescriptorHash,
    authorizationIdentityHash: readiness.authorizationIdentityHash,
    adapterId: readiness.adapterId,
    adapterKind: readiness.adapterKind,
    adapterDescriptorHash: readiness.adapterDescriptorHash,
    adapterReadinessHash,
    requestedDispatchClass: "review_only",
    requestedSideEffectClass: "none",
    authorizedScopeRef: dispatchAuthorizationPacket.authorizedScopeRef,
    ...(dispatchAuthorizationPacket.rollbackExpectationRef !== undefined
      ? { rollbackExpectationRef: dispatchAuthorizationPacket.rollbackExpectationRef }
      : {}),
    abortExpectationRef: dispatchAuthorizationPacket.abortExpectationRef,
    timeoutPolicyRef: dispatchAuthorizationPacket.timeoutPolicyRef,
    auditSinkIdentityRef: dispatchAuthorizationPacket.auditSinkIdentityRef,
    evidenceSinkIdentityRef: dispatchAuthorizationPacket.evidenceSinkIdentityRef,
    receiptContractVersion: dispatchAuthorizationPacket.receiptContractVersion,
    validationCommandRefs: [...dispatchAuthorizationPacket.validationCommandRefs],
    nonAuthorizationDeclaration: "phase16_review_only_no_adapter_invocation",
    evidenceRefs,
    operatorInstruction:
      `Review-only agent executor adapter dispatch authorization accepted ${readiness.recommendedAction}; no adapter, no Codex CLI, no sub-agent runtime, no provider, no shell, no workspace-write, no external write, and no recovery action was invoked.`
  });
}

export async function dispatchGovernanceOperatorActionHostExecutor(
  input: DispatchGovernanceOperatorActionHostExecutorInput
): Promise<GovernanceOperatorActionHostExecutorDispatchResult> {
  const review = authorizeGovernanceOperatorActionHostExecutorReview({
    executionGate: input.executionGate,
    lifecycleState: input.lifecycleState,
    ...(input.authorizationPacket !== undefined
      ? { authorizationPacket: input.authorizationPacket }
      : {}),
    ...(input.hostExecutorDescriptor !== undefined
      ? { hostExecutorDescriptor: input.hostExecutorDescriptor }
      : {})
  });
  const reasons: string[] = [];

  let dispatchMode: GovernanceOperatorActionHostExecutorDispatchMode | undefined;
  if (input.dispatchMode === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_dispatch_mode_required");
  } else {
    const parsedDispatchMode =
      GovernanceOperatorActionHostExecutorDispatchModeSchema.safeParse(input.dispatchMode);
    if (parsedDispatchMode.success) {
      dispatchMode = parsedDispatchMode.data;
    } else {
      addUniqueReason(reasons, "operator_action_host_executor_dispatch_mode_invalid");
    }
  }

  let authorization: GovernanceOperatorActionHostExecutorAuthorizationResult | undefined;
  if (input.authorization === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_dispatch_authorization_required");
  } else {
    const parsedAuthorization =
      GovernanceOperatorActionHostExecutorAuthorizationResultSchema.safeParse(input.authorization);
    if (parsedAuthorization.success) {
      authorization = parsedAuthorization.data;
      if (authorization.status !== "ready_for_host_executor_review") {
        addUniqueReason(reasons, "operator_action_host_executor_dispatch_authorization_not_ready");
      }
    } else {
      addUniqueReason(reasons, "operator_action_host_executor_dispatch_authorization_invalid");
    }
  }

  if (review.status !== "ready_for_host_executor_review") {
    addUniqueReason(reasons, "operator_action_host_executor_dispatch_review_not_ready");
    for (const reason of review.reasons) {
      addUniqueReason(reasons, reason);
    }
  }

  if (authorization !== undefined) {
    addHostExecutorDispatchAuthorizationReasons(reasons, {
      authorization,
      review
    });
  }

  if (dispatchMode === "execute_injected") {
    if (input.executor === undefined) {
      addUniqueReason(reasons, "operator_action_host_executor_dispatch_executor_required");
    }
    if (input.auditSink === undefined) {
      addUniqueReason(reasons, "operator_action_host_executor_dispatch_audit_sink_required");
    }
  }

  if (
    reasons.length > 0 ||
    authorization === undefined ||
    authorization.status !== "ready_for_host_executor_review" ||
    review.status !== "ready_for_host_executor_review" ||
    dispatchMode === undefined
  ) {
    return createBlockedOperatorActionHostExecutorDispatchResult(reasons, {
      review,
      ...(authorization !== undefined ? { authorization } : {}),
      ...(dispatchMode !== undefined ? { dispatchMode } : {})
    });
  }

  const invocation = createOperatorActionHostExecutorDispatchInvocation({
    review,
    dispatchMode
  });

  if (dispatchMode === "dry_run") {
    return createReadyOperatorActionHostExecutorDispatchResult({
      status: "dry_run_ready",
      invocation,
      evidenceRefs: invocation.evidenceRefs,
      operatorInstruction:
        `Dry-run host executor dispatch accepted ${invocation.recommendedAction}; no executor was called.`
    });
  }

  if (input.executor === undefined || input.auditSink === undefined) {
    return createBlockedOperatorActionHostExecutorDispatchResult([
      "operator_action_host_executor_dispatch_executor_required",
      "operator_action_host_executor_dispatch_audit_sink_required"
    ], {
      review,
      authorization,
      dispatchMode
    });
  }

  try {
    await input.auditSink.record(createHostExecutorDispatchAuditEvent({
      status: "attempting",
      invocation,
      evidenceRefs: invocation.evidenceRefs
    }));
  } catch {
    return createBlockedOperatorActionHostExecutorDispatchResult([
      "operator_action_host_executor_dispatch_audit_sink_failed"
    ], {
      review,
      authorization,
      dispatchMode
    });
  }

  let executorResult: GovernanceOperatorActionHostExecutorDispatchExecutorResult;
  try {
    executorResult = GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema.parse(
      await input.executor.dispatch(invocation)
    );
  } catch (error) {
    const errorClass = normalizeHostExecutorDispatchErrorClass(error);
    const failedResult = createFailedOperatorActionHostExecutorDispatchResult({
      invocation,
      reasons: ["operator_action_host_executor_dispatch_executor_failed"],
      errorClass,
      evidenceRefs: invocation.evidenceRefs
    });
    await recordHostExecutorDispatchFailure(input.auditSink, invocation, failedResult);
    return failedResult;
  }

  const evidenceRefs = uniqueStrings([
    ...invocation.evidenceRefs,
    ...executorResult.evidenceRefs
  ]);
  const dispatched = createReadyOperatorActionHostExecutorDispatchResult({
    status: "dispatched",
    invocation,
    executorStatus: executorResult.status,
    ...(executorResult.reasonCode !== undefined
      ? { executorReasonCode: executorResult.reasonCode }
      : {}),
    ...(executorResult.resultRef !== undefined
      ? { executorResultRef: executorResult.resultRef }
      : {}),
    evidenceRefs,
    operatorInstruction:
      `Injected host executor dispatch returned ${executorResult.status} for ${invocation.recommendedAction}; no global host lookup was used.`
  });

  try {
    await input.auditSink.record(createHostExecutorDispatchAuditEvent({
      status: "dispatched",
      invocation,
      executorStatus: executorResult.status,
      ...(executorResult.reasonCode !== undefined
        ? { executorReasonCode: executorResult.reasonCode }
        : {}),
      ...(executorResult.resultRef !== undefined
        ? { resultRef: executorResult.resultRef }
        : {}),
      evidenceRefs
    }));
  } catch {
    return createFailedOperatorActionHostExecutorDispatchResult({
      invocation,
      reasons: ["operator_action_host_executor_dispatch_audit_sink_failed"],
      errorClass: "operator_action_host_executor_dispatch_audit_sink_failed",
      evidenceRefs
    });
  }

  return dispatched;
}

export function preserveGovernanceOperatorActionReceiptConsumptionStoreProof<T extends object>(
  target: T,
  source: unknown
): T {
  let sourceConsumption: GovernanceOperatorActionExecutorReceiptConsumption;
  let targetConsumption: GovernanceOperatorActionExecutorReceiptConsumption;
  try {
    sourceConsumption = GovernanceOperatorActionExecutorReceiptConsumptionSchema.parse(source);
    targetConsumption = GovernanceOperatorActionExecutorReceiptConsumptionSchema.parse(target);
  } catch {
    return target;
  }

  if (!hasGovernanceOperatorActionReceiptConsumptionStoreProof(source, sourceConsumption)) {
    return target;
  }

  if (!operatorActionReceiptConsumptionsMatch(sourceConsumption, targetConsumption)) {
    return target;
  }

  return markGovernanceOperatorActionReceiptConsumptionStoreProduced(
    target,
    targetConsumption
  );
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

function markGovernanceOperatorActionReceiptConsumptionStoreProduced<T extends object>(
  consumption: T,
  parsedConsumption = GovernanceOperatorActionExecutorReceiptConsumptionSchema.parse(consumption)
): T {
  governanceOperatorActionReceiptConsumptionStoreProofs.set(
    consumption,
    governanceOperatorActionReceiptConsumptionStoreProofDigest(parsedConsumption)
  );
  return consumption;
}

function hasGovernanceOperatorActionReceiptConsumptionStoreProof(
  value: unknown,
  consumption: GovernanceOperatorActionExecutorReceiptConsumption
): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return governanceOperatorActionReceiptConsumptionStoreProofs.get(value) ===
    governanceOperatorActionReceiptConsumptionStoreProofDigest(consumption);
}

function governanceOperatorActionReceiptConsumptionStoreProofDigest(
  consumption: GovernanceOperatorActionExecutorReceiptConsumption
): string {
  return stableSha256(stableStringify(consumption));
}

function createBlockedOperatorActionExecutionGateResult(
  reasons: string[],
  context: {
    envelope?: GovernanceOperatorActionEnvelope;
    consumption?: GovernanceOperatorActionExecutorReceiptConsumption;
  } = {}
): GovernanceOperatorActionExecutionGateResult {
  const receipt = context.consumption?.receipt;
  return GovernanceOperatorActionExecutionGateResultSchema.parse({
    status: "blocked",
    reasons: reasons.length > 0
      ? [...new Set(reasons)]
      : ["operator_action_executor_blocked"],
    ...(context.envelope !== undefined ? { taskId: context.envelope.taskId } : {}),
    ...(receipt !== undefined ? { actionRef: receipt.actionRef } : {}),
    ...(receipt !== undefined ? { receiptId: receipt.receiptId } : {}),
    ...(context.envelope !== undefined
      ? { envelopeHash: hashGovernanceOperatorActionEnvelope(context.envelope) }
      : {}),
    ...(context.envelope !== undefined
      ? { recommendedAction: context.envelope.recommendedAction }
      : {}),
    ...(context.envelope?.checkpointRef !== undefined
      ? { checkpointRef: context.envelope.checkpointRef }
      : {})
  });
}

function createBlockedOperatorActionHostExecutorAuthorizationResult(
  reasons: string[],
  context: {
    gate?: GovernanceOperatorActionExecutionGateResult;
    packet?: GovernanceOperatorActionHostExecutorAuthorizationPacket;
    descriptor?: GovernanceOperatorActionHostExecutorDescriptor;
    descriptorHash?: string;
    executionPlanHash?: string;
  } = {}
): GovernanceOperatorActionHostExecutorAuthorizationResult {
  return GovernanceOperatorActionHostExecutorAuthorizationResultSchema.parse({
    status: "blocked",
    reasons: reasons.length > 0
      ? [...new Set(reasons)]
      : ["operator_action_host_executor_blocked"],
    ...(context.gate?.taskId !== undefined ? { taskId: context.gate.taskId } : {}),
    ...(context.gate?.actionRef !== undefined ? { actionRef: context.gate.actionRef } : {}),
    ...(context.gate?.receiptId !== undefined ? { receiptId: context.gate.receiptId } : {}),
    ...(context.gate?.envelopeHash !== undefined
      ? { envelopeHash: context.gate.envelopeHash }
      : {}),
    ...(context.gate?.recommendedAction !== undefined
      ? { recommendedAction: context.gate.recommendedAction }
      : {}),
    ...(context.gate?.executionMode !== undefined
      ? { executionMode: context.gate.executionMode }
      : {}),
    ...(context.executionPlanHash !== undefined
      ? { executionPlanHash: context.executionPlanHash }
      : {}),
    ...(context.gate?.checkpointRef !== undefined
      ? { checkpointRef: context.gate.checkpointRef }
      : {}),
    ...(context.descriptor !== undefined
      ? { hostExecutorDescriptorId: context.descriptor.descriptorId }
      : {}),
    ...(context.descriptorHash !== undefined
      ? { hostExecutorDescriptorHash: context.descriptorHash }
      : {}),
    ...(context.packet !== undefined
      ? { authorizationIdentityHash: context.packet.authorizationIdentityHash }
      : {}),
    evidenceRefs: uniqueStrings([
      ...(context.packet?.evidenceRefs ?? []),
      ...(context.descriptor?.evidenceRefs ?? [])
    ])
  });
}

function createBlockedOperatorActionAgentExecutorAdapterReviewResult(
  reasons: string[],
  context: {
    review?: GovernanceOperatorActionHostExecutorAuthorizationResult;
    authorization?: GovernanceOperatorActionHostExecutorAuthorizationResult;
    adapterDescriptor?: GovernanceOperatorActionAgentExecutorAdapterDescriptor;
    adapterDescriptorHash?: string;
    adapterReviewPacket?: GovernanceOperatorActionAgentExecutorAdapterReviewPacket;
  } = {}
): GovernanceOperatorActionAgentExecutorAdapterReviewResult {
  const source = context.review ?? context.authorization;

  return GovernanceOperatorActionAgentExecutorAdapterReviewResultSchema.parse({
    status: "blocked",
    reasons: reasons.length > 0
      ? [...new Set(reasons)]
      : ["operator_action_agent_executor_adapter_blocked"],
    approvalString:
      context.adapterReviewPacket?.approvalString ??
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
    ...(source?.taskId !== undefined ? { taskId: source.taskId } : {}),
    ...(source?.actionRef !== undefined ? { actionRef: source.actionRef } : {}),
    ...(source?.receiptId !== undefined ? { receiptId: source.receiptId } : {}),
    ...(source?.envelopeHash !== undefined ? { envelopeHash: source.envelopeHash } : {}),
    ...(source?.recommendedAction !== undefined ? { recommendedAction: source.recommendedAction } : {}),
    ...(source?.executionMode !== undefined ? { executionMode: source.executionMode } : {}),
    ...(source?.executionPlanHash !== undefined ? { executionPlanHash: source.executionPlanHash } : {}),
    ...(source?.checkpointRef !== undefined ? { checkpointRef: source.checkpointRef } : {}),
    ...(source?.hostExecutorDescriptorId !== undefined
      ? { hostExecutorDescriptorId: source.hostExecutorDescriptorId }
      : {}),
    ...(source?.hostExecutorDescriptorHash !== undefined
      ? { hostExecutorDescriptorHash: source.hostExecutorDescriptorHash }
      : {}),
    ...(source?.authorizationIdentityHash !== undefined
      ? { authorizationIdentityHash: source.authorizationIdentityHash }
      : {}),
    ...(context.adapterDescriptor !== undefined
      ? { adapterId: context.adapterDescriptor.adapterId }
      : context.adapterReviewPacket !== undefined
        ? { adapterId: context.adapterReviewPacket.adapterId }
        : {}),
    ...(context.adapterDescriptor !== undefined
      ? { adapterKind: context.adapterDescriptor.adapterKind }
      : context.adapterReviewPacket !== undefined
        ? { adapterKind: context.adapterReviewPacket.adapterKind }
        : {}),
    ...(context.adapterDescriptorHash !== undefined
      ? { adapterDescriptorHash: context.adapterDescriptorHash }
      : context.adapterReviewPacket !== undefined
        ? { adapterDescriptorHash: context.adapterReviewPacket.adapterDescriptorHash }
        : {}),
    ...(context.adapterDescriptor !== undefined || context.adapterReviewPacket !== undefined
      ? { executionBoundary: "review_only" as const, invocationSupported: false as const }
      : {}),
    evidenceRefs: uniqueStrings([
      ...(context.review?.evidenceRefs ?? []),
      ...(context.authorization?.evidenceRefs ?? []),
      ...(context.adapterDescriptor?.evidenceRefs ?? []),
      ...(context.adapterReviewPacket?.evidenceRefs ?? [])
    ])
  });
}

function createBlockedOperatorActionAgentExecutorAdapterSandboxContractResult(
  reasons: string[],
  context: {
    readiness?: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    suppliedReadiness?: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    sandboxContractPacket?: GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket;
  } = {}
): GovernanceOperatorActionAgentExecutorAdapterSandboxContractResult {
  const source = context.readiness ?? context.suppliedReadiness;

  return GovernanceOperatorActionAgentExecutorAdapterSandboxContractResultSchema.parse({
    status: "blocked",
    reasons: reasons.length > 0
      ? [...new Set(reasons)]
      : ["operator_action_agent_executor_adapter_sandbox_contract_blocked"],
    approvalString:
      context.sandboxContractPacket?.approvalString ??
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL,
    reviewApprovalString:
      context.sandboxContractPacket?.reviewApprovalString ??
      context.suppliedReadiness?.approvalString ??
      context.readiness?.approvalString,
    ...(source?.taskId !== undefined ? { taskId: source.taskId } : {}),
    ...(source?.actionRef !== undefined ? { actionRef: source.actionRef } : {}),
    ...(source?.receiptId !== undefined ? { receiptId: source.receiptId } : {}),
    ...(source?.envelopeHash !== undefined ? { envelopeHash: source.envelopeHash } : {}),
    ...(source?.recommendedAction !== undefined ? { recommendedAction: source.recommendedAction } : {}),
    ...(source?.executionPlanHash !== undefined ? { executionPlanHash: source.executionPlanHash } : {}),
    ...(source?.checkpointRef !== undefined ? { checkpointRef: source.checkpointRef } : {}),
    ...(source?.hostExecutorDescriptorId !== undefined
      ? { hostExecutorDescriptorId: source.hostExecutorDescriptorId }
      : {}),
    ...(source?.hostExecutorDescriptorHash !== undefined
      ? { hostExecutorDescriptorHash: source.hostExecutorDescriptorHash }
      : {}),
    ...(source?.authorizationIdentityHash !== undefined
      ? { authorizationIdentityHash: source.authorizationIdentityHash }
      : {}),
    ...(context.sandboxContractPacket !== undefined
      ? { adapterId: context.sandboxContractPacket.adapterId }
      : source?.adapterId !== undefined
        ? { adapterId: source.adapterId }
        : {}),
    ...(context.sandboxContractPacket !== undefined
      ? { adapterKind: context.sandboxContractPacket.adapterKind }
      : source?.adapterKind !== undefined
        ? { adapterKind: source.adapterKind }
        : {}),
    ...(context.sandboxContractPacket !== undefined
      ? { adapterDescriptorHash: context.sandboxContractPacket.adapterDescriptorHash }
      : source?.adapterDescriptorHash !== undefined
        ? { adapterDescriptorHash: source.adapterDescriptorHash }
        : {}),
    ...(context.sandboxContractPacket?.sandboxScopeRef !== undefined
      ? { sandboxScopeRef: context.sandboxContractPacket.sandboxScopeRef }
      : {}),
    ...(context.sandboxContractPacket !== undefined
      ? { sideEffectBoundary: "sandbox_only" as const }
      : {}),
    evidenceRefs: uniqueStrings([
      ...(context.readiness?.evidenceRefs ?? []),
      ...(context.suppliedReadiness?.evidenceRefs ?? []),
      ...(context.sandboxContractPacket?.evidenceRefs ?? [])
    ])
  });
}

function createBlockedOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult(
  reasons: string[],
  context: {
    readiness?: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    suppliedReadiness?: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    dispatchAuthorizationPacket?:
      GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket;
  } = {}
): GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResult {
  const source = context.readiness ?? context.suppliedReadiness;
  const packet = context.dispatchAuthorizationPacket;
  const sourceCheckpointRefHash = source === undefined
    ? undefined
    : getAgentExecutorAdapterReadinessCheckpointRefHash(source);

  return GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResultSchema.parse({
    status: "blocked",
    reasons: reasons.length > 0
      ? [...new Set(reasons)]
      : ["operator_action_agent_executor_adapter_dispatch_authorization_blocked"],
    approvalString:
      packet?.approvalString ??
      GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL,
    reviewApprovalString:
      packet?.reviewApprovalString ??
      context.suppliedReadiness?.approvalString ??
      context.readiness?.approvalString,
    ...(source?.taskId !== undefined ? { taskId: source.taskId } : {}),
    ...(source?.actionRef !== undefined ? { actionRef: source.actionRef } : {}),
    ...(source?.receiptId !== undefined ? { receiptId: source.receiptId } : {}),
    ...(source?.envelopeHash !== undefined ? { envelopeHash: source.envelopeHash } : {}),
    ...(source?.recommendedAction !== undefined
      ? { recommendedAction: source.recommendedAction }
      : {}),
    ...(source?.executionPlanHash !== undefined
      ? { executionPlanHash: source.executionPlanHash }
      : {}),
    ...(packet?.checkpointRefHash !== undefined
      ? { checkpointRefHash: packet.checkpointRefHash }
      : sourceCheckpointRefHash !== undefined
        ? { checkpointRefHash: sourceCheckpointRefHash }
        : {}),
    ...(source?.hostExecutorDescriptorId !== undefined
      ? { hostExecutorDescriptorId: source.hostExecutorDescriptorId }
      : {}),
    ...(source?.hostExecutorDescriptorHash !== undefined
      ? { hostExecutorDescriptorHash: source.hostExecutorDescriptorHash }
      : {}),
    ...(source?.authorizationIdentityHash !== undefined
      ? { authorizationIdentityHash: source.authorizationIdentityHash }
      : {}),
    ...(source?.adapterId !== undefined
      ? { adapterId: source.adapterId }
      : packet?.adapterId !== undefined
        ? { adapterId: packet.adapterId }
        : {}),
    ...(source?.adapterKind !== undefined
      ? { adapterKind: source.adapterKind }
      : packet?.adapterKind !== undefined
        ? { adapterKind: packet.adapterKind }
        : {}),
    ...(source?.adapterDescriptorHash !== undefined
      ? { adapterDescriptorHash: source.adapterDescriptorHash }
      : packet?.adapterDescriptorHash !== undefined
        ? { adapterDescriptorHash: packet.adapterDescriptorHash }
        : {}),
    ...(packet?.adapterReadinessHash !== undefined
      ? { adapterReadinessHash: packet.adapterReadinessHash }
      : source !== undefined
        ? {
            adapterReadinessHash:
              hashGovernanceOperatorActionAgentExecutorAdapterReviewResult(source)
          }
        : {}),
    ...(packet?.sandboxContractProofRef !== undefined
      ? { sandboxContractProofRef: packet.sandboxContractProofRef }
      : {}),
    ...(packet?.requestedDispatchClass !== undefined
      ? { requestedDispatchClass: packet.requestedDispatchClass }
      : {}),
    ...(packet?.requestedSideEffectClass !== undefined
      ? { requestedSideEffectClass: packet.requestedSideEffectClass }
      : {}),
    ...(packet?.authorizedScopeRef !== undefined
      ? { authorizedScopeRef: packet.authorizedScopeRef }
      : {}),
    ...(packet?.rollbackExpectationRef !== undefined
      ? { rollbackExpectationRef: packet.rollbackExpectationRef }
      : {}),
    ...(packet?.abortExpectationRef !== undefined
      ? { abortExpectationRef: packet.abortExpectationRef }
      : {}),
    ...(packet?.timeoutPolicyRef !== undefined
      ? { timeoutPolicyRef: packet.timeoutPolicyRef }
      : {}),
    ...(packet?.auditSinkIdentityRef !== undefined
      ? { auditSinkIdentityRef: packet.auditSinkIdentityRef }
      : {}),
    ...(packet?.evidenceSinkIdentityRef !== undefined
      ? { evidenceSinkIdentityRef: packet.evidenceSinkIdentityRef }
      : {}),
    ...(packet?.receiptContractVersion !== undefined
      ? { receiptContractVersion: packet.receiptContractVersion }
      : {}),
    validationCommandRefs: packet?.validationCommandRefs ?? [],
    ...(packet?.nonAuthorizationDeclaration !== undefined
      ? { nonAuthorizationDeclaration: packet.nonAuthorizationDeclaration }
      : {}),
    evidenceRefs: uniqueStrings([
      ...(context.readiness?.evidenceRefs ?? []),
      ...(context.suppliedReadiness?.evidenceRefs ?? []),
      ...(packet?.evidenceRefs ?? [])
    ])
  });
}

function getAgentExecutorAdapterReadinessCheckpointRefHash(
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult
): string | undefined {
  if (readiness.recommendedAction !== "rollback" || readiness.checkpointRef === undefined) {
    return undefined;
  }
  return stableSha256(readiness.checkpointRef);
}

function createOperatorActionAgentExecutorAdapterSandboxContractInvocation(input: {
  readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  sandboxContractPacket: GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket;
}): GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation {
  return GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocationSchema.parse({
    contractMode: "sandbox_contract",
    taskId: input.readiness.taskId,
    actionRef: input.readiness.actionRef,
    receiptId: input.readiness.receiptId,
    envelopeHash: input.readiness.envelopeHash,
    recommendedAction: input.readiness.recommendedAction,
    executionPlanHash: input.readiness.executionPlanHash,
    ...(input.readiness.checkpointRef !== undefined
      ? { checkpointRef: input.readiness.checkpointRef }
      : {}),
    hostExecutorDescriptorId: input.readiness.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: input.readiness.hostExecutorDescriptorHash,
    authorizationIdentityHash: input.readiness.authorizationIdentityHash,
    adapterId: input.sandboxContractPacket.adapterId,
    adapterKind: input.sandboxContractPacket.adapterKind,
    adapterDescriptorHash: input.sandboxContractPacket.adapterDescriptorHash,
    sandboxScopeRef: input.sandboxContractPacket.sandboxScopeRef,
    sideEffectBoundary: "sandbox_only",
    evidenceRefs: uniqueStrings([
      ...input.readiness.evidenceRefs,
      ...input.sandboxContractPacket.evidenceRefs
    ]),
    operatorInstruction:
      `Sandbox-only agent executor adapter contract prepared for ${input.readiness.recommendedAction}.`
  });
}

function createReadyOperatorActionAgentExecutorAdapterSandboxContractResult(input: {
  invocation: GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation;
  adapterStatus: GovernanceOperatorActionHostExecutorDispatchExecutorStatus;
  adapterReasonCode?: GovernanceOperatorActionHostExecutorDispatchExecutorReasonCode;
  adapterResultRef?: string;
  evidenceRefs: string[];
  operatorInstruction: string;
}): GovernanceOperatorActionAgentExecutorAdapterSandboxContractResult {
  return GovernanceOperatorActionAgentExecutorAdapterSandboxContractResultSchema.parse({
    status: "completed",
    reasons: [],
    approvalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL,
    reviewApprovalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
    taskId: input.invocation.taskId,
    actionRef: input.invocation.actionRef,
    receiptId: input.invocation.receiptId,
    envelopeHash: input.invocation.envelopeHash,
    recommendedAction: input.invocation.recommendedAction,
    executionPlanHash: input.invocation.executionPlanHash,
    ...(input.invocation.checkpointRef !== undefined
      ? { checkpointRef: input.invocation.checkpointRef }
      : {}),
    hostExecutorDescriptorId: input.invocation.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: input.invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: input.invocation.authorizationIdentityHash,
    adapterId: input.invocation.adapterId,
    adapterKind: input.invocation.adapterKind,
    adapterDescriptorHash: input.invocation.adapterDescriptorHash,
    sandboxScopeRef: input.invocation.sandboxScopeRef,
    sideEffectBoundary: "sandbox_only",
    adapterStatus: input.adapterStatus,
    ...(input.adapterReasonCode !== undefined
      ? { adapterReasonCode: input.adapterReasonCode }
      : {}),
    ...(input.adapterResultRef !== undefined
      ? { adapterResultRef: input.adapterResultRef }
      : {}),
    evidenceRefs: [...input.evidenceRefs],
    operatorInstruction: input.operatorInstruction
  });
}

function createFailedOperatorActionAgentExecutorAdapterSandboxContractResult(input: {
  invocation: GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation;
  reasons: string[];
  errorClass: string;
  evidenceRefs: string[];
}): GovernanceOperatorActionAgentExecutorAdapterSandboxContractResult {
  return GovernanceOperatorActionAgentExecutorAdapterSandboxContractResultSchema.parse({
    status: "failed",
    reasons: [...new Set(input.reasons)],
    approvalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_APPROVAL,
    reviewApprovalString: GOVERNANCE_OPERATOR_ACTION_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_APPROVAL,
    taskId: input.invocation.taskId,
    actionRef: input.invocation.actionRef,
    receiptId: input.invocation.receiptId,
    envelopeHash: input.invocation.envelopeHash,
    recommendedAction: input.invocation.recommendedAction,
    executionPlanHash: input.invocation.executionPlanHash,
    ...(input.invocation.checkpointRef !== undefined
      ? { checkpointRef: input.invocation.checkpointRef }
      : {}),
    hostExecutorDescriptorId: input.invocation.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: input.invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: input.invocation.authorizationIdentityHash,
    adapterId: input.invocation.adapterId,
    adapterKind: input.invocation.adapterKind,
    adapterDescriptorHash: input.invocation.adapterDescriptorHash,
    sandboxScopeRef: input.invocation.sandboxScopeRef,
    sideEffectBoundary: "sandbox_only",
    errorClass: input.errorClass,
    evidenceRefs: [...input.evidenceRefs]
  });
}

function createAgentExecutorAdapterSandboxContractAuditEvent(input: {
  status: "attempting" | "completed" | "failed";
  invocation: GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation;
  adapterStatus?: GovernanceOperatorActionHostExecutorDispatchExecutorStatus;
  adapterReasonCode?: GovernanceOperatorActionHostExecutorDispatchExecutorReasonCode;
  resultRef?: string;
  errorClass?: string;
  evidenceRefs: string[];
}): GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEvent {
  return GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditEventSchema.parse({
    status: input.status,
    taskId: input.invocation.taskId,
    actionRef: input.invocation.actionRef,
    receiptId: input.invocation.receiptId,
    envelopeHash: input.invocation.envelopeHash,
    recommendedAction: input.invocation.recommendedAction,
    executionPlanHash: input.invocation.executionPlanHash,
    ...(input.invocation.checkpointRef !== undefined
      ? { checkpointRef: input.invocation.checkpointRef }
      : {}),
    hostExecutorDescriptorId: input.invocation.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: input.invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: input.invocation.authorizationIdentityHash,
    adapterId: input.invocation.adapterId,
    adapterKind: input.invocation.adapterKind,
    adapterDescriptorHash: input.invocation.adapterDescriptorHash,
    sandboxScopeRef: input.invocation.sandboxScopeRef,
    sideEffectBoundary: "sandbox_only",
    ...(input.adapterStatus !== undefined
      ? { adapterStatus: input.adapterStatus }
      : {}),
    ...(input.adapterReasonCode !== undefined
      ? { adapterReasonCode: input.adapterReasonCode }
      : {}),
    ...(input.resultRef !== undefined ? { resultRef: input.resultRef } : {}),
    ...(input.errorClass !== undefined ? { errorClass: input.errorClass } : {}),
    evidenceRefs: [...input.evidenceRefs]
  });
}

async function recordAgentExecutorAdapterSandboxContractFailure(
  auditSink: GovernanceOperatorActionAgentExecutorAdapterSandboxContractAuditSink,
  invocation: GovernanceOperatorActionAgentExecutorAdapterSandboxContractInvocation,
  result: GovernanceOperatorActionAgentExecutorAdapterSandboxContractResult
): Promise<void> {
  try {
    await auditSink.record(createAgentExecutorAdapterSandboxContractAuditEvent({
      status: "failed",
      invocation,
      ...(result.errorClass !== undefined ? { errorClass: result.errorClass } : {}),
      evidenceRefs: result.evidenceRefs
    }));
  } catch {
    // The sanitized failed result remains authoritative when final audit recording fails.
  }
}

function createOperatorActionHostExecutorDispatchInvocation(input: {
  review: GovernanceOperatorActionHostExecutorAuthorizationResult;
  dispatchMode: GovernanceOperatorActionHostExecutorDispatchMode;
}): GovernanceOperatorActionHostExecutorDispatchInvocation {
  return GovernanceOperatorActionHostExecutorDispatchInvocationSchema.parse({
    dispatchMode: input.dispatchMode,
    taskId: input.review.taskId,
    actionRef: input.review.actionRef,
    receiptId: input.review.receiptId,
    envelopeHash: input.review.envelopeHash,
    recommendedAction: input.review.recommendedAction,
    executionPlanHash: input.review.executionPlanHash,
    ...(input.review.checkpointRef !== undefined
      ? { checkpointRef: input.review.checkpointRef }
      : {}),
    hostExecutorDescriptorId: input.review.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: input.review.hostExecutorDescriptorHash,
    authorizationIdentityHash: input.review.authorizationIdentityHash,
    evidenceRefs: [...input.review.evidenceRefs],
    operatorInstruction:
      `Explicit injected host executor dispatch prepared for ${input.review.recommendedAction}.`
  });
}

function createReadyOperatorActionHostExecutorDispatchResult(input: {
  status: "dry_run_ready" | "dispatched";
  invocation: GovernanceOperatorActionHostExecutorDispatchInvocation;
  executorStatus?: GovernanceOperatorActionHostExecutorDispatchExecutorStatus;
  executorReasonCode?: GovernanceOperatorActionHostExecutorDispatchExecutorReasonCode;
  executorResultRef?: string;
  evidenceRefs: string[];
  operatorInstruction: string;
}): GovernanceOperatorActionHostExecutorDispatchResult {
  return GovernanceOperatorActionHostExecutorDispatchResultSchema.parse({
    status: input.status,
    reasons: [],
    dispatchMode: input.invocation.dispatchMode,
    taskId: input.invocation.taskId,
    actionRef: input.invocation.actionRef,
    receiptId: input.invocation.receiptId,
    envelopeHash: input.invocation.envelopeHash,
    recommendedAction: input.invocation.recommendedAction,
    executionPlanHash: input.invocation.executionPlanHash,
    ...(input.invocation.checkpointRef !== undefined
      ? { checkpointRef: input.invocation.checkpointRef }
      : {}),
    hostExecutorDescriptorId: input.invocation.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: input.invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: input.invocation.authorizationIdentityHash,
    ...(input.executorStatus !== undefined
      ? { executorStatus: input.executorStatus }
      : {}),
    ...(input.executorReasonCode !== undefined
      ? { executorReasonCode: input.executorReasonCode }
      : {}),
    ...(input.executorResultRef !== undefined
      ? { executorResultRef: input.executorResultRef }
      : {}),
    evidenceRefs: [...input.evidenceRefs],
    operatorInstruction: input.operatorInstruction
  });
}

function createBlockedOperatorActionHostExecutorDispatchResult(
  reasons: string[],
  context: {
    review?: GovernanceOperatorActionHostExecutorAuthorizationResult;
    authorization?: GovernanceOperatorActionHostExecutorAuthorizationResult;
    dispatchMode?: GovernanceOperatorActionHostExecutorDispatchMode;
  } = {}
): GovernanceOperatorActionHostExecutorDispatchResult {
  const source = context.review ?? context.authorization;

  return GovernanceOperatorActionHostExecutorDispatchResultSchema.parse({
    status: "blocked",
    reasons: reasons.length > 0
      ? [...new Set(reasons)]
      : ["operator_action_host_executor_dispatch_blocked"],
    ...(context.dispatchMode !== undefined ? { dispatchMode: context.dispatchMode } : {}),
    ...(source?.taskId !== undefined ? { taskId: source.taskId } : {}),
    ...(source?.actionRef !== undefined ? { actionRef: source.actionRef } : {}),
    ...(source?.receiptId !== undefined ? { receiptId: source.receiptId } : {}),
    ...(source?.envelopeHash !== undefined ? { envelopeHash: source.envelopeHash } : {}),
    ...(source?.recommendedAction !== undefined ? { recommendedAction: source.recommendedAction } : {}),
    ...(source?.executionPlanHash !== undefined ? { executionPlanHash: source.executionPlanHash } : {}),
    ...(source?.checkpointRef !== undefined ? { checkpointRef: source.checkpointRef } : {}),
    ...(source?.hostExecutorDescriptorId !== undefined
      ? { hostExecutorDescriptorId: source.hostExecutorDescriptorId }
      : {}),
    ...(source?.hostExecutorDescriptorHash !== undefined
      ? { hostExecutorDescriptorHash: source.hostExecutorDescriptorHash }
      : {}),
    ...(source?.authorizationIdentityHash !== undefined
      ? { authorizationIdentityHash: source.authorizationIdentityHash }
      : {}),
    evidenceRefs: uniqueStrings([
      ...(context.review?.evidenceRefs ?? []),
      ...(context.authorization?.evidenceRefs ?? [])
    ])
  });
}

function createFailedOperatorActionHostExecutorDispatchResult(input: {
  invocation: GovernanceOperatorActionHostExecutorDispatchInvocation;
  reasons: string[];
  errorClass: string;
  evidenceRefs: string[];
}): GovernanceOperatorActionHostExecutorDispatchResult {
  return GovernanceOperatorActionHostExecutorDispatchResultSchema.parse({
    status: "failed",
    reasons: [...new Set(input.reasons)],
    dispatchMode: input.invocation.dispatchMode,
    taskId: input.invocation.taskId,
    actionRef: input.invocation.actionRef,
    receiptId: input.invocation.receiptId,
    envelopeHash: input.invocation.envelopeHash,
    recommendedAction: input.invocation.recommendedAction,
    executionPlanHash: input.invocation.executionPlanHash,
    ...(input.invocation.checkpointRef !== undefined
      ? { checkpointRef: input.invocation.checkpointRef }
      : {}),
    hostExecutorDescriptorId: input.invocation.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: input.invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: input.invocation.authorizationIdentityHash,
    errorClass: input.errorClass,
    evidenceRefs: [...input.evidenceRefs]
  });
}

function createHostExecutorDispatchAuditEvent(input: {
  status: "attempting" | "dispatched" | "failed";
  invocation: GovernanceOperatorActionHostExecutorDispatchInvocation;
  executorStatus?: GovernanceOperatorActionHostExecutorDispatchExecutorStatus;
  executorReasonCode?: GovernanceOperatorActionHostExecutorDispatchExecutorReasonCode;
  resultRef?: string;
  errorClass?: string;
  evidenceRefs: string[];
}): GovernanceOperatorActionHostExecutorDispatchAuditEvent {
  return GovernanceOperatorActionHostExecutorDispatchAuditEventSchema.parse({
    status: input.status,
    dispatchMode: input.invocation.dispatchMode,
    taskId: input.invocation.taskId,
    actionRef: input.invocation.actionRef,
    receiptId: input.invocation.receiptId,
    envelopeHash: input.invocation.envelopeHash,
    recommendedAction: input.invocation.recommendedAction,
    executionPlanHash: input.invocation.executionPlanHash,
    ...(input.invocation.checkpointRef !== undefined
      ? { checkpointRef: input.invocation.checkpointRef }
      : {}),
    hostExecutorDescriptorId: input.invocation.hostExecutorDescriptorId,
    hostExecutorDescriptorHash: input.invocation.hostExecutorDescriptorHash,
    authorizationIdentityHash: input.invocation.authorizationIdentityHash,
    ...(input.executorStatus !== undefined
      ? { executorStatus: input.executorStatus }
      : {}),
    ...(input.executorReasonCode !== undefined
      ? { executorReasonCode: input.executorReasonCode }
      : {}),
    ...(input.resultRef !== undefined ? { resultRef: input.resultRef } : {}),
    ...(input.errorClass !== undefined ? { errorClass: input.errorClass } : {}),
    evidenceRefs: [...input.evidenceRefs]
  });
}

async function recordHostExecutorDispatchFailure(
  auditSink: GovernanceOperatorActionHostExecutorDispatchAuditSink,
  invocation: GovernanceOperatorActionHostExecutorDispatchInvocation,
  result: GovernanceOperatorActionHostExecutorDispatchResult
): Promise<void> {
  try {
    await auditSink.record(createHostExecutorDispatchAuditEvent({
      status: "failed",
      invocation,
      ...(result.errorClass !== undefined ? { errorClass: result.errorClass } : {}),
      evidenceRefs: result.evidenceRefs
    }));
  } catch {
    // The dispatch result remains sanitized and fail-closed even when final audit recording fails.
  }
}

function addHostExecutorDispatchAuthorizationReasons(
  reasons: string[],
  input: {
    authorization: GovernanceOperatorActionHostExecutorAuthorizationResult;
    review: GovernanceOperatorActionHostExecutorAuthorizationResult;
  }
): void {
  const bindings = [
    {
      authorizationValue: input.authorization.taskId,
      expectedValue: input.review.taskId,
      reason: "operator_action_host_executor_dispatch_authorization_task_mismatch"
    },
    {
      authorizationValue: input.authorization.actionRef,
      expectedValue: input.review.actionRef,
      reason: "operator_action_host_executor_dispatch_authorization_action_ref_mismatch"
    },
    {
      authorizationValue: input.authorization.receiptId,
      expectedValue: input.review.receiptId,
      reason: "operator_action_host_executor_dispatch_authorization_receipt_mismatch"
    },
    {
      authorizationValue: input.authorization.envelopeHash,
      expectedValue: input.review.envelopeHash,
      reason: "operator_action_host_executor_dispatch_authorization_envelope_hash_mismatch"
    },
    {
      authorizationValue: input.authorization.recommendedAction,
      expectedValue: input.review.recommendedAction,
      reason: "operator_action_host_executor_dispatch_authorization_recommended_action_mismatch"
    },
    {
      authorizationValue: input.authorization.executionMode,
      expectedValue: input.review.executionMode,
      reason: "operator_action_host_executor_dispatch_authorization_execution_mode_mismatch"
    },
    {
      authorizationValue: input.authorization.executionPlanHash,
      expectedValue: input.review.executionPlanHash,
      reason: "operator_action_host_executor_dispatch_authorization_plan_hash_mismatch"
    },
    {
      authorizationValue: input.authorization.checkpointRef,
      expectedValue: input.review.checkpointRef,
      reason: "operator_action_host_executor_dispatch_authorization_checkpoint_mismatch"
    },
    {
      authorizationValue: input.authorization.hostExecutorDescriptorId,
      expectedValue: input.review.hostExecutorDescriptorId,
      reason: "operator_action_host_executor_dispatch_authorization_descriptor_id_mismatch"
    },
    {
      authorizationValue: input.authorization.hostExecutorDescriptorHash,
      expectedValue: input.review.hostExecutorDescriptorHash,
      reason: "operator_action_host_executor_dispatch_authorization_descriptor_hash_mismatch"
    },
    {
      authorizationValue: input.authorization.authorizationIdentityHash,
      expectedValue: input.review.authorizationIdentityHash,
      reason: "operator_action_host_executor_dispatch_authorization_identity_mismatch"
    }
  ];

  for (const binding of bindings) {
    if (binding.authorizationValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }
}

function addAgentExecutorAdapterAuthorizationReasons(
  reasons: string[],
  input: {
    authorization: GovernanceOperatorActionHostExecutorAuthorizationResult;
    review: GovernanceOperatorActionHostExecutorAuthorizationResult;
  }
): void {
  const bindings = [
    {
      authorizationValue: input.authorization.taskId,
      expectedValue: input.review.taskId,
      reason: "operator_action_agent_executor_adapter_authorization_task_mismatch"
    },
    {
      authorizationValue: input.authorization.actionRef,
      expectedValue: input.review.actionRef,
      reason: "operator_action_agent_executor_adapter_authorization_action_ref_mismatch"
    },
    {
      authorizationValue: input.authorization.receiptId,
      expectedValue: input.review.receiptId,
      reason: "operator_action_agent_executor_adapter_authorization_receipt_mismatch"
    },
    {
      authorizationValue: input.authorization.envelopeHash,
      expectedValue: input.review.envelopeHash,
      reason: "operator_action_agent_executor_adapter_authorization_envelope_hash_mismatch"
    },
    {
      authorizationValue: input.authorization.recommendedAction,
      expectedValue: input.review.recommendedAction,
      reason: "operator_action_agent_executor_adapter_authorization_recommended_action_mismatch"
    },
    {
      authorizationValue: input.authorization.executionMode,
      expectedValue: input.review.executionMode,
      reason: "operator_action_agent_executor_adapter_authorization_execution_mode_mismatch"
    },
    {
      authorizationValue: input.authorization.executionPlanHash,
      expectedValue: input.review.executionPlanHash,
      reason: "operator_action_agent_executor_adapter_authorization_plan_hash_mismatch"
    },
    {
      authorizationValue: input.authorization.checkpointRef,
      expectedValue: input.review.checkpointRef,
      reason: "operator_action_agent_executor_adapter_authorization_checkpoint_mismatch"
    },
    {
      authorizationValue: input.authorization.hostExecutorDescriptorId,
      expectedValue: input.review.hostExecutorDescriptorId,
      reason: "operator_action_agent_executor_adapter_authorization_descriptor_id_mismatch"
    },
    {
      authorizationValue: input.authorization.hostExecutorDescriptorHash,
      expectedValue: input.review.hostExecutorDescriptorHash,
      reason: "operator_action_agent_executor_adapter_authorization_descriptor_hash_mismatch"
    },
    {
      authorizationValue: input.authorization.authorizationIdentityHash,
      expectedValue: input.review.authorizationIdentityHash,
      reason: "operator_action_agent_executor_adapter_authorization_identity_mismatch"
    }
  ];

  for (const binding of bindings) {
    if (binding.authorizationValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }
}

function addAgentExecutorAdapterReviewPacketReasons(
  reasons: string[],
  input: {
    packet: GovernanceOperatorActionAgentExecutorAdapterReviewPacket;
    review: GovernanceOperatorActionHostExecutorAuthorizationResult;
    adapterDescriptor?: GovernanceOperatorActionAgentExecutorAdapterDescriptor;
    adapterDescriptorHash?: string;
  }
): void {
  const bindings = [
    {
      packetValue: input.packet.taskId,
      expectedValue: input.review.taskId,
      reason: "operator_action_agent_executor_adapter_packet_task_mismatch"
    },
    {
      packetValue: input.packet.actionRef,
      expectedValue: input.review.actionRef,
      reason: "operator_action_agent_executor_adapter_packet_action_ref_mismatch"
    },
    {
      packetValue: input.packet.receiptId,
      expectedValue: input.review.receiptId,
      reason: "operator_action_agent_executor_adapter_packet_receipt_mismatch"
    },
    {
      packetValue: input.packet.envelopeHash,
      expectedValue: input.review.envelopeHash,
      reason: "operator_action_agent_executor_adapter_packet_envelope_hash_mismatch"
    },
    {
      packetValue: input.packet.recommendedAction,
      expectedValue: input.review.recommendedAction,
      reason: "operator_action_agent_executor_adapter_packet_recommended_action_mismatch"
    },
    {
      packetValue: input.packet.executionPlanHash,
      expectedValue: input.review.executionPlanHash,
      reason: "operator_action_agent_executor_adapter_packet_plan_hash_mismatch"
    },
    {
      packetValue: input.packet.checkpointRef,
      expectedValue: input.review.checkpointRef,
      reason: "operator_action_agent_executor_adapter_packet_checkpoint_mismatch"
    },
    {
      packetValue: input.packet.hostExecutorDescriptorId,
      expectedValue: input.review.hostExecutorDescriptorId,
      reason: "operator_action_agent_executor_adapter_packet_host_descriptor_id_mismatch"
    },
    {
      packetValue: input.packet.hostExecutorDescriptorHash,
      expectedValue: input.review.hostExecutorDescriptorHash,
      reason: "operator_action_agent_executor_adapter_packet_host_descriptor_hash_mismatch"
    },
    {
      packetValue: input.packet.authorizationIdentityHash,
      expectedValue: input.review.authorizationIdentityHash,
      reason: "operator_action_agent_executor_adapter_packet_identity_mismatch"
    },
    {
      packetValue: input.packet.adapterId,
      expectedValue: input.adapterDescriptor?.adapterId,
      reason: "operator_action_agent_executor_adapter_packet_adapter_id_mismatch"
    },
    {
      packetValue: input.packet.adapterKind,
      expectedValue: input.adapterDescriptor?.adapterKind,
      reason: "operator_action_agent_executor_adapter_packet_adapter_kind_mismatch"
    },
    {
      packetValue: input.packet.adapterDescriptorHash,
      expectedValue: input.adapterDescriptorHash,
      reason: "operator_action_agent_executor_adapter_packet_descriptor_hash_mismatch"
    }
  ];

  for (const binding of bindings) {
    if (binding.packetValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }
}

function addAgentExecutorAdapterSandboxContractReadinessReasons(
  reasons: string[],
  input: {
    suppliedReadiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  }
): void {
  const bindings = [
    {
      suppliedValue: input.suppliedReadiness.approvalString,
      expectedValue: input.readiness.approvalString,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_approval_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.taskId,
      expectedValue: input.readiness.taskId,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_task_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.actionRef,
      expectedValue: input.readiness.actionRef,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_action_ref_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.receiptId,
      expectedValue: input.readiness.receiptId,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_receipt_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.envelopeHash,
      expectedValue: input.readiness.envelopeHash,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_envelope_hash_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.recommendedAction,
      expectedValue: input.readiness.recommendedAction,
      reason:
        "operator_action_agent_executor_adapter_sandbox_contract_readiness_recommended_action_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.executionPlanHash,
      expectedValue: input.readiness.executionPlanHash,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_plan_hash_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.checkpointRef,
      expectedValue: input.readiness.checkpointRef,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_checkpoint_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.hostExecutorDescriptorId,
      expectedValue: input.readiness.hostExecutorDescriptorId,
      reason:
        "operator_action_agent_executor_adapter_sandbox_contract_readiness_host_descriptor_id_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.hostExecutorDescriptorHash,
      expectedValue: input.readiness.hostExecutorDescriptorHash,
      reason:
        "operator_action_agent_executor_adapter_sandbox_contract_readiness_host_descriptor_hash_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.authorizationIdentityHash,
      expectedValue: input.readiness.authorizationIdentityHash,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_identity_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.adapterId,
      expectedValue: input.readiness.adapterId,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_adapter_id_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.adapterKind,
      expectedValue: input.readiness.adapterKind,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_readiness_adapter_kind_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.adapterDescriptorHash,
      expectedValue: input.readiness.adapterDescriptorHash,
      reason:
        "operator_action_agent_executor_adapter_sandbox_contract_readiness_adapter_descriptor_hash_mismatch"
    }
  ];

  for (const binding of bindings) {
    if (binding.suppliedValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }
}

function addAgentExecutorAdapterSandboxContractPacketReasons(
  reasons: string[],
  input: {
    packet: GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacket;
    readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  }
): void {
  const bindings = [
    {
      packetValue: input.packet.reviewApprovalString,
      expectedValue: input.readiness.approvalString,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_review_approval_mismatch"
    },
    {
      packetValue: input.packet.taskId,
      expectedValue: input.readiness.taskId,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_task_mismatch"
    },
    {
      packetValue: input.packet.actionRef,
      expectedValue: input.readiness.actionRef,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_action_ref_mismatch"
    },
    {
      packetValue: input.packet.receiptId,
      expectedValue: input.readiness.receiptId,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_receipt_mismatch"
    },
    {
      packetValue: input.packet.envelopeHash,
      expectedValue: input.readiness.envelopeHash,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_envelope_hash_mismatch"
    },
    {
      packetValue: input.packet.recommendedAction,
      expectedValue: input.readiness.recommendedAction,
      reason:
        "operator_action_agent_executor_adapter_sandbox_contract_packet_recommended_action_mismatch"
    },
    {
      packetValue: input.packet.executionPlanHash,
      expectedValue: input.readiness.executionPlanHash,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_plan_hash_mismatch"
    },
    {
      packetValue: input.packet.checkpointRef,
      expectedValue: input.readiness.checkpointRef,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_checkpoint_mismatch"
    },
    {
      packetValue: input.packet.hostExecutorDescriptorId,
      expectedValue: input.readiness.hostExecutorDescriptorId,
      reason:
        "operator_action_agent_executor_adapter_sandbox_contract_packet_host_descriptor_id_mismatch"
    },
    {
      packetValue: input.packet.hostExecutorDescriptorHash,
      expectedValue: input.readiness.hostExecutorDescriptorHash,
      reason:
        "operator_action_agent_executor_adapter_sandbox_contract_packet_host_descriptor_hash_mismatch"
    },
    {
      packetValue: input.packet.authorizationIdentityHash,
      expectedValue: input.readiness.authorizationIdentityHash,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_identity_mismatch"
    },
    {
      packetValue: input.packet.adapterId,
      expectedValue: input.readiness.adapterId,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_adapter_id_mismatch"
    },
    {
      packetValue: input.packet.adapterKind,
      expectedValue: input.readiness.adapterKind,
      reason: "operator_action_agent_executor_adapter_sandbox_contract_packet_adapter_kind_mismatch"
    },
    {
      packetValue: input.packet.adapterDescriptorHash,
      expectedValue: input.readiness.adapterDescriptorHash,
      reason:
        "operator_action_agent_executor_adapter_sandbox_contract_packet_descriptor_hash_mismatch"
    }
  ];

  for (const binding of bindings) {
    if (binding.packetValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }
}

function addAgentExecutorAdapterDispatchAuthorizationReadinessReasons(
  reasons: string[],
  input: {
    suppliedReadiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
  }
): void {
  const bindings = [
    {
      suppliedValue: input.suppliedReadiness.approvalString,
      expectedValue: input.readiness.approvalString,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_approval_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.taskId,
      expectedValue: input.readiness.taskId,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_task_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.actionRef,
      expectedValue: input.readiness.actionRef,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_action_ref_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.receiptId,
      expectedValue: input.readiness.receiptId,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_receipt_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.envelopeHash,
      expectedValue: input.readiness.envelopeHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_envelope_hash_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.recommendedAction,
      expectedValue: input.readiness.recommendedAction,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_recommended_action_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.executionPlanHash,
      expectedValue: input.readiness.executionPlanHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_plan_hash_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.checkpointRef,
      expectedValue: input.readiness.checkpointRef,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_checkpoint_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.hostExecutorDescriptorId,
      expectedValue: input.readiness.hostExecutorDescriptorId,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_host_descriptor_id_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.hostExecutorDescriptorHash,
      expectedValue: input.readiness.hostExecutorDescriptorHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_host_descriptor_hash_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.authorizationIdentityHash,
      expectedValue: input.readiness.authorizationIdentityHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_identity_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.adapterId,
      expectedValue: input.readiness.adapterId,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_adapter_id_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.adapterKind,
      expectedValue: input.readiness.adapterKind,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_adapter_kind_mismatch"
    },
    {
      suppliedValue: input.suppliedReadiness.adapterDescriptorHash,
      expectedValue: input.readiness.adapterDescriptorHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_readiness_adapter_descriptor_hash_mismatch"
    }
  ];

  for (const binding of bindings) {
    if (binding.suppliedValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }
}

function addAgentExecutorAdapterDispatchAuthorizationPacketReasons(
  reasons: string[],
  input: {
    packet: GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacket;
    readiness: GovernanceOperatorActionAgentExecutorAdapterReviewResult;
    adapterReadinessHash: string;
  }
): void {
  const checkpointRefHash =
    getAgentExecutorAdapterReadinessCheckpointRefHash(input.readiness);
  const bindings = [
    {
      packetValue: input.packet.reviewApprovalString,
      expectedValue: input.readiness.approvalString,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_review_approval_mismatch"
    },
    {
      packetValue: input.packet.taskId,
      expectedValue: input.readiness.taskId,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_task_mismatch"
    },
    {
      packetValue: input.packet.actionRef,
      expectedValue: input.readiness.actionRef,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_action_ref_mismatch"
    },
    {
      packetValue: input.packet.receiptId,
      expectedValue: input.readiness.receiptId,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_receipt_mismatch"
    },
    {
      packetValue: input.packet.envelopeHash,
      expectedValue: input.readiness.envelopeHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_envelope_hash_mismatch"
    },
    {
      packetValue: input.packet.recommendedAction,
      expectedValue: input.readiness.recommendedAction,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_recommended_action_mismatch"
    },
    {
      packetValue: input.packet.executionPlanHash,
      expectedValue: input.readiness.executionPlanHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_plan_hash_mismatch"
    },
    {
      packetValue: input.packet.checkpointRefHash,
      expectedValue: checkpointRefHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_checkpoint_hash_mismatch"
    },
    {
      packetValue: input.packet.hostExecutorDescriptorId,
      expectedValue: input.readiness.hostExecutorDescriptorId,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_host_descriptor_id_mismatch"
    },
    {
      packetValue: input.packet.hostExecutorDescriptorHash,
      expectedValue: input.readiness.hostExecutorDescriptorHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_host_descriptor_hash_mismatch"
    },
    {
      packetValue: input.packet.authorizationIdentityHash,
      expectedValue: input.readiness.authorizationIdentityHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_identity_mismatch"
    },
    {
      packetValue: input.packet.adapterId,
      expectedValue: input.readiness.adapterId,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_adapter_id_mismatch"
    },
    {
      packetValue: input.packet.adapterKind,
      expectedValue: input.readiness.adapterKind,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_adapter_kind_mismatch"
    },
    {
      packetValue: input.packet.adapterDescriptorHash,
      expectedValue: input.readiness.adapterDescriptorHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_adapter_descriptor_hash_mismatch"
    },
    {
      packetValue: input.packet.adapterReadinessHash,
      expectedValue: input.adapterReadinessHash,
      reason:
        "operator_action_agent_executor_adapter_dispatch_authorization_packet_readiness_hash_mismatch"
    }
  ];

  for (const binding of bindings) {
    if (binding.packetValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }
}

function addHostExecutorAuthorizationPacketReasons(
  reasons: string[],
  input: {
    packet: GovernanceOperatorActionHostExecutorAuthorizationPacket;
    gate: GovernanceOperatorActionExecutionGateResult;
    executionPlanHash?: string;
    descriptor?: GovernanceOperatorActionHostExecutorDescriptor;
    descriptorHash?: string;
  }
): void {
  const bindings = [
    {
      packetValue: input.packet.taskId,
      expectedValue: input.gate.taskId,
      reason: "operator_action_host_executor_packet_task_mismatch"
    },
    {
      packetValue: input.packet.actionRef,
      expectedValue: input.gate.actionRef,
      reason: "operator_action_host_executor_packet_action_ref_mismatch"
    },
    {
      packetValue: input.packet.receiptId,
      expectedValue: input.gate.receiptId,
      reason: "operator_action_host_executor_packet_receipt_mismatch"
    },
    {
      packetValue: input.packet.envelopeHash,
      expectedValue: input.gate.envelopeHash,
      reason: "operator_action_host_executor_packet_envelope_hash_mismatch"
    },
    {
      packetValue: input.packet.recommendedAction,
      expectedValue: input.gate.recommendedAction,
      reason: "operator_action_host_executor_packet_recommended_action_mismatch"
    },
    {
      packetValue: input.packet.executionPlanHash,
      expectedValue: input.executionPlanHash,
      reason: "operator_action_host_executor_packet_plan_hash_mismatch"
    },
    {
      packetValue: input.packet.checkpointRef,
      expectedValue: input.gate.checkpointRef,
      reason: "operator_action_host_executor_packet_checkpoint_mismatch"
    },
    {
      packetValue: input.packet.hostExecutorDescriptorId,
      expectedValue: input.descriptor?.descriptorId,
      reason: "operator_action_host_executor_packet_descriptor_id_mismatch"
    },
    {
      packetValue: input.packet.hostExecutorDescriptorHash,
      expectedValue: input.descriptorHash,
      reason: "operator_action_host_executor_packet_descriptor_hash_mismatch"
    }
  ];

  for (const binding of bindings) {
    if (binding.packetValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }
}

function addHostExecutorLifecycleReasons(
  reasons: string[],
  input: {
    lifecycleState: unknown;
    gate: GovernanceOperatorActionExecutionGateResult;
  }
): void {
  if (input.lifecycleState === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_lifecycle_required");
    return;
  }

  let lifecycle: GovernanceOperatorActionExecutorLifecycleState;
  try {
    lifecycle = GovernanceOperatorActionExecutorLifecycleStateSchema.parse(
      input.lifecycleState
    );
  } catch {
    addUniqueReason(reasons, "operator_action_host_executor_lifecycle_invalid");
    return;
  }

  if (lifecycle.status !== "receipt_consumed") {
    addUniqueReason(reasons, "operator_action_host_executor_lifecycle_not_consumed");
  }

  if (!lifecycle.operatorActionPresent) {
    addUniqueReason(reasons, "operator_action_host_executor_lifecycle_action_missing");
  }

  if (lifecycle.envelope === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_lifecycle_envelope_missing");
  } else if (
    input.gate.envelopeHash !== undefined &&
    hashGovernanceOperatorActionEnvelope(lifecycle.envelope) !== input.gate.envelopeHash
  ) {
    addUniqueReason(reasons, "operator_action_host_executor_lifecycle_envelope_mismatch");
  }

  if (lifecycle.lastReceiptConsumption === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_lifecycle_receipt_missing");
    return;
  }

  const rawConsumption =
    typeof input.lifecycleState === "object" && input.lifecycleState !== null
      ? (input.lifecycleState as { lastReceiptConsumption?: unknown }).lastReceiptConsumption
      : undefined;
  const consumption = lifecycle.lastReceiptConsumption;

  if (consumption.status === "blocked") {
    if (
      consumption.reasons.includes("operator_action_receipt_replay") ||
      consumption.validation.reasons.includes("operator_action_receipt_replay")
    ) {
      addUniqueReason(reasons, "operator_action_host_executor_receipt_replay");
    }
    if (
      consumption.reasons.includes("operator_action_receipt_action_expired") ||
      consumption.validation.reasons.includes("operator_action_receipt_action_expired")
    ) {
      addUniqueReason(reasons, "operator_action_host_executor_receipt_expired");
    }
    addUniqueReason(reasons, "operator_action_host_executor_receipt_blocked");
  }

  if (consumption.status !== "passed") {
    addUniqueReason(reasons, "operator_action_host_executor_receipt_not_consumed");
  }

  if (consumption.durable !== true) {
    addUniqueReason(reasons, "operator_action_host_executor_receipt_not_durable");
  }

  if (consumption.validation.status !== "passed") {
    addUniqueReason(reasons, "operator_action_host_executor_receipt_validation_blocked");
  }

  if (
    consumption.status === "passed" &&
    consumption.durable === true &&
    !hasGovernanceOperatorActionReceiptConsumptionStoreProof(
      rawConsumption,
      consumption
    )
  ) {
    addUniqueReason(
      reasons,
      "operator_action_host_executor_receipt_consumption_store_proof_missing"
    );
  }

  const receipt = consumption.receipt;
  if (receipt === undefined) {
    addUniqueReason(reasons, "operator_action_host_executor_receipt_missing");
    return;
  }

  if (receipt.decision !== "consumed") {
    addUniqueReason(reasons, "operator_action_host_executor_receipt_decision_not_consumed");
  }

  const receiptBindings = [
    {
      receiptValue: receipt.taskId,
      expectedValue: input.gate.taskId,
      reason: "operator_action_host_executor_receipt_task_mismatch"
    },
    {
      receiptValue: receipt.actionRef,
      expectedValue: input.gate.actionRef,
      reason: "operator_action_host_executor_receipt_action_ref_mismatch"
    },
    {
      receiptValue: receipt.receiptId,
      expectedValue: input.gate.receiptId,
      reason: "operator_action_host_executor_receipt_id_mismatch"
    },
    {
      receiptValue: receipt.envelopeHash,
      expectedValue: input.gate.envelopeHash,
      reason: "operator_action_host_executor_receipt_envelope_hash_mismatch"
    },
    {
      receiptValue: consumption.taskId,
      expectedValue: input.gate.taskId,
      reason: "operator_action_host_executor_consumption_task_mismatch"
    },
    {
      receiptValue: consumption.actionRef,
      expectedValue: input.gate.actionRef,
      reason: "operator_action_host_executor_consumption_action_ref_mismatch"
    },
    {
      receiptValue: consumption.envelopeHash,
      expectedValue: input.gate.envelopeHash,
      reason: "operator_action_host_executor_consumption_envelope_hash_mismatch"
    },
    {
      receiptValue: consumption.validation.taskId,
      expectedValue: input.gate.taskId,
      reason: "operator_action_host_executor_validation_task_mismatch"
    },
    {
      receiptValue: consumption.validation.actionRef,
      expectedValue: input.gate.actionRef,
      reason: "operator_action_host_executor_validation_action_ref_mismatch"
    },
    {
      receiptValue: consumption.validation.envelopeHash,
      expectedValue: input.gate.envelopeHash,
      reason: "operator_action_host_executor_validation_envelope_hash_mismatch"
    }
  ];

  for (const binding of receiptBindings) {
    if (binding.receiptValue !== binding.expectedValue) {
      addUniqueReason(reasons, binding.reason);
    }
  }

  if (
    lifecycle.actionIssuedAt !== undefined &&
    lifecycle.actionIssuedAt !== receipt.actionIssuedAt
  ) {
    addUniqueReason(
      reasons,
      "operator_action_host_executor_lifecycle_action_issued_at_mismatch"
    );
  }
}

function addOperatorActionReceiptConsumptionReasons(
  reasons: string[],
  consumption: GovernanceOperatorActionExecutorReceiptConsumption,
  envelope: GovernanceOperatorActionEnvelope,
  envelopeHash: string
): void {
  if (consumption.status === "not_consumed" || consumption.durable !== true) {
    addUniqueReason(reasons, "operator_action_executor_receipt_not_durable");
  }

  if (consumption.status === "blocked") {
    if (
      consumption.reasons.includes("operator_action_receipt_replay") ||
      consumption.validation.reasons.includes("operator_action_receipt_replay")
    ) {
      addUniqueReason(reasons, "operator_action_executor_receipt_replay");
    } else if (
      consumption.reasons.includes("operator_action_receipt_action_expired") ||
      consumption.validation.reasons.includes("operator_action_receipt_action_expired")
    ) {
      addUniqueReason(reasons, "operator_action_executor_receipt_expired");
    } else {
      addUniqueReason(reasons, "operator_action_executor_receipt_consumption_blocked");
    }
  }

  if (consumption.status !== "passed") {
    addUniqueReason(reasons, "operator_action_executor_receipt_not_consumed");
  }

  if (consumption.validation.status !== "passed") {
    if (consumption.validation.reasons.includes("operator_action_receipt_replay")) {
      addUniqueReason(reasons, "operator_action_executor_receipt_replay");
    }
    if (consumption.validation.reasons.includes("operator_action_receipt_action_expired")) {
      addUniqueReason(reasons, "operator_action_executor_receipt_expired");
    }
    addUniqueReason(reasons, "operator_action_executor_receipt_validation_blocked");
  }

  const receipt = consumption.receipt;
  const validationReceipt = consumption.validation.receipt;
  if (receipt === undefined || validationReceipt === undefined) {
    addUniqueReason(reasons, "operator_action_executor_receipt_missing");
    return;
  }

  if (stableStringify(receipt) !== stableStringify(validationReceipt)) {
    addUniqueReason(reasons, "operator_action_executor_receipt_validation_mismatch");
  }

  const expectedActionRef = createGovernanceOperatorActionRef(envelope, {
    actionIssuedAt: receipt.actionIssuedAt
  });

  if (consumption.taskId !== envelope.taskId) {
    addUniqueReason(reasons, "operator_action_executor_consumption_task_mismatch");
  }

  if (consumption.validation.taskId !== envelope.taskId) {
    addUniqueReason(reasons, "operator_action_executor_validation_task_mismatch");
  }

  if (receipt.taskId !== envelope.taskId) {
    addUniqueReason(reasons, "operator_action_executor_receipt_task_mismatch");
  }

  if (receipt.actionRef !== expectedActionRef) {
    addUniqueReason(reasons, "operator_action_executor_receipt_action_ref_mismatch");
  }

  if (consumption.actionRef !== expectedActionRef) {
    addUniqueReason(reasons, "operator_action_executor_consumption_action_ref_mismatch");
  }

  if (consumption.validation.actionRef !== expectedActionRef) {
    addUniqueReason(reasons, "operator_action_executor_validation_action_ref_mismatch");
  }

  if (receipt.envelopeHash !== envelopeHash) {
    addUniqueReason(reasons, "operator_action_executor_receipt_envelope_hash_mismatch");
  }

  if (consumption.envelopeHash !== envelopeHash) {
    addUniqueReason(reasons, "operator_action_executor_consumption_envelope_hash_mismatch");
  }

  if (consumption.validation.envelopeHash !== envelopeHash) {
    addUniqueReason(reasons, "operator_action_executor_validation_envelope_hash_mismatch");
  }

  try {
    parseReceiptForStore(receipt);
  } catch {
    addUniqueReason(reasons, "operator_action_executor_receipt_binding_mismatch");
  }

  if (receipt.decision !== "consumed") {
    addUniqueReason(reasons, "operator_action_executor_receipt_decision_not_consumed");
  }

  if (envelope.lockdown && receipt.decision !== "consumed") {
    addUniqueReason(reasons, "operator_action_executor_lockdown_resolution_required");
  }
}

function addOperatorActionLifecycleReasons(
  reasons: string[],
  input: {
    input: unknown;
    envelope: GovernanceOperatorActionEnvelope;
    consumption?: GovernanceOperatorActionExecutorReceiptConsumption;
  }
): void {
  if (input.input === undefined) {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_required");
    return;
  }

  let lifecycle: GovernanceOperatorActionExecutorLifecycleState;
  try {
    lifecycle = GovernanceOperatorActionExecutorLifecycleStateSchema.parse(input.input);
  } catch {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_invalid");
    return;
  }

  if (lifecycle.status !== "receipt_consumed") {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_not_consumed");
  }

  if (!lifecycle.operatorActionPresent) {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_action_missing");
  }

  if (lifecycle.envelope === undefined) {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_envelope_missing");
  } else if (
    stableStringify(lifecycle.envelope) !== stableStringify(input.envelope)
  ) {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_envelope_mismatch");
  }

  if (lifecycle.lastReceiptConsumption === undefined) {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_receipt_missing");
    return;
  }

  const lifecycleReceipt = lifecycle.lastReceiptConsumption.receipt;
  const consumedReceipt = input.consumption?.receipt;
  const expectedActionIssuedAt =
    consumedReceipt?.actionIssuedAt ?? lifecycleReceipt?.actionIssuedAt;
  if (
    expectedActionIssuedAt !== undefined &&
    lifecycle.actionIssuedAt !== expectedActionIssuedAt
  ) {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_action_issued_at_mismatch");
  }

  if (
    input.consumption !== undefined &&
    !operatorActionReceiptConsumptionsMatch(
      lifecycle.lastReceiptConsumption,
      input.consumption
    )
  ) {
    addUniqueReason(reasons, "operator_action_executor_lifecycle_receipt_mismatch");
  }
}

function operatorActionReceiptConsumptionsMatch(
  left: GovernanceOperatorActionExecutorReceiptConsumption,
  right: GovernanceOperatorActionExecutorReceiptConsumption
): boolean {
  return left.status === right.status &&
    left.durable === right.durable &&
    left.taskId === right.taskId &&
    left.actionRef === right.actionRef &&
    left.envelopeHash === right.envelopeHash &&
    stableStringify(left.reasons) === stableStringify(right.reasons) &&
    stableStringify(left.validation) === stableStringify(right.validation) &&
    stableStringify(left.receipt) === stableStringify(right.receipt);
}

function addUniqueReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

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

function cloneReceipt(
  receipt: GovernanceOperatorActionReceipt
): GovernanceOperatorActionReceipt {
  return GovernanceOperatorActionReceiptSchema.parse(JSON.parse(JSON.stringify(receipt)));
}

function parseReceiptForStore(
  receiptInput: GovernanceOperatorActionReceiptInput
): GovernanceOperatorActionReceipt {
  const receipt = GovernanceOperatorActionReceiptSchema.parse(receiptInput);
  const expectedReceiptId = createGovernanceOperatorActionReceiptId({
    taskId: receipt.taskId,
    actionRef: receipt.actionRef,
    ...(receipt.envelopeHash !== undefined ? { envelopeHash: receipt.envelopeHash } : {}),
    actionIssuedAt: receipt.actionIssuedAt,
    decision: receipt.decision,
    operatorIdHash: receipt.operatorIdHash,
    createdAt: receipt.createdAt,
    evidenceRefs: receipt.evidenceRefs
  });
  if (receipt.receiptId !== expectedReceiptId) {
    throw new Error("operator_action_receipt_store_receipt_id_mismatch");
  }

  return receipt;
}

function parseReceiptLines(
  content: string,
  filePath: string
): GovernanceOperatorActionReceipt[] {
  const receipts: GovernanceOperatorActionReceipt[] = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.trim() === "") {
      continue;
    }

    try {
      receipts.push(parseReceiptForStore(JSON.parse(line)));
    } catch {
      throw new Error(`operator_action_receipt_store_record_invalid:${filePath}:${index + 1}`);
    }
  }
  return receipts;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function normalizeHostExecutorDispatchErrorClass(error: unknown): string {
  const rawClass =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : error instanceof Error
        ? error.name
        : "unknown_host_executor_dispatch_error";
  const normalized = rawClass
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return normalized.length > 0
    ? normalized.slice(0, 80)
    : "unknown_host_executor_dispatch_error";
}

function normalizeAgentExecutorAdapterSandboxContractErrorClass(error: unknown): string {
  const rawClass =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : error instanceof Error
        ? error.name
        : "unknown_agent_executor_adapter_sandbox_contract_error";
  const normalized = rawClass
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return normalized.length > 0
    ? normalized.slice(0, 80)
    : "unknown_agent_executor_adapter_sandbox_contract_error";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function stableSha256(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
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
