import { z } from "zod";
import type {
  CheckpointRef,
  RoutingDecision,
  TaskEnvelope,
  TaskEnvelopeInput,
  RoutingDecisionInput
} from "../../contracts/src/index.js";
import {
  parseTaskEnvelope,
  parseRoutingDecision
} from "../../contracts/src/index.js";

// ── Phase enum ──────────────────────────────────────────────────────────────

export const GovernancePhaseSchema = z.enum([
  "planning",
  "preflight",
  "execution",
  "verification",
  "recovery",
  "closed"
]);

// ── Risk level (extends contracts RiskLevel with "critical") ─────────────────

export const DgpRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical"
]);

// ── Trust balance (55-开天平) ──────────────────────────────────────────────

export const TrustBalanceSchema = z.object({
  centralOrder: z.number().min(0).max(1),
  distributedVitality: z.number().min(0).max(1)
}).superRefine((value, ctx) => {
  const total = value.centralOrder + value.distributedVitality;

  if (Math.abs(total - 1) > 0.001) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "trust_balance_must_sum_to_1"
    });
  }
});

// ── Risk score (7 dimensions, aligned with existing governance-v2.ts) ────────

export const GovernanceRiskScoreSchema = z.object({
  entanglement: z.number().min(0).max(1),
  entropy: z.number().min(0).max(1),
  failureCost: z.number().min(0).max(1),
  reversibility: z.number().min(0).max(1),
  contextPressure: z.number().min(0).max(1),
  historicalTrust: z.number().min(0).max(1),
  globalCoherence: z.number().min(0).max(1),
  finalRiskLevel: DgpRiskLevelSchema
});

// ── Anomaly record ──────────────────────────────────────────────────────────

export const AnomalyRecordSchema = z.object({
  anomalyId: z.string().min(1),
  taskId: z.string().min(1),
  kind: z.string().min(1),
  message: z.string().min(1),
  strikeNumber: z.number().int().min(1).max(3),
  createdAt: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([])
});

// ── Approval history record ─────────────────────────────────────────────────

export const ApprovalHistoryRecordSchema = z.object({
  approvalId: z.string().min(1),
  taskId: z.string().min(1),
  action: z.enum(["resume", "rollback", "abort", "approve", "reject"]),
  actor: z.string().min(1).default("human"),
  createdAt: z.string().min(1),
  reason: z.string().optional()
});

// ── Governance state (master type) ──────────────────────────────────────────

export const GovernanceStateSchema = z.object({
  schemaVersion: z.literal("governance-state.v1").default("governance-state.v1"),
  taskId: z.string().min(1),
  branchId: z.string().min(1),
  phase: GovernancePhaseSchema,
  trustBalance: TrustBalanceSchema,
  risk: GovernanceRiskScoreSchema,
  anomalies: z.array(AnomalyRecordSchema).default([]),
  approvals: z.array(ApprovalHistoryRecordSchema).default([]),
  taskGraphRef: z.string().min(1),
  latestCheckpointId: z.string().min(1).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type GovernancePhase = z.infer<typeof GovernancePhaseSchema>;
export type DgpRiskLevel = z.infer<typeof DgpRiskLevelSchema>;
export type TrustBalance = z.infer<typeof TrustBalanceSchema>;
export type GovernanceRiskScore = z.infer<typeof GovernanceRiskScoreSchema>;
export type AnomalyRecord = z.infer<typeof AnomalyRecordSchema>;
export type ApprovalHistoryRecord = z.infer<typeof ApprovalHistoryRecordSchema>;
export type GovernanceStateInput = z.input<typeof GovernanceStateSchema>;
export type GovernanceState = z.infer<typeof GovernanceStateSchema>;

// ── Input types ─────────────────────────────────────────────────────────────

export interface CreateInitialGovernanceStateInput {
  task: TaskEnvelopeInput;
  decision: RoutingDecisionInput;
  checkpoint?: CheckpointRef;
  now?: () => string;
}

// ── Parse helper ────────────────────────────────────────────────────────────

export function parseGovernanceState(input: GovernanceStateInput): GovernanceState {
  return GovernanceStateSchema.parse(input);
}

// ── Factory: initial governance state ───────────────────────────────────────

export function createInitialGovernanceState(
  input: CreateInitialGovernanceStateInput
): GovernanceState {
  const task: TaskEnvelope = parseTaskEnvelope(input.task);
  const decision: RoutingDecision = parseRoutingDecision(input.decision);
  const now = input.now ?? (() => new Date().toISOString());
  const timestamp = now();

  return parseGovernanceState({
    taskId: task.taskId,
    branchId: "main",
    phase: decision.approval.required ? "preflight" : "planning",
    trustBalance: {
      centralOrder: 0.5,
      distributedVitality: 0.5
    },
    risk: createDefaultRiskScore(decision),
    anomalies: [],
    approvals: [],
    taskGraphRef: `task-graph:${task.taskId}`,
    ...(input.checkpoint !== undefined
      ? { latestCheckpointId: input.checkpoint.checkpointId }
      : {}),
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

// ── Default risk score from routing decision ────────────────────────────────

export function createDefaultRiskScore(decision: RoutingDecision): GovernanceRiskScore {
  const riskLevel = decision.classification.riskLevel;

  if (riskLevel === "high") {
    return {
      entanglement: 0.6,
      entropy: 0.4,
      failureCost: 0.7,
      reversibility: 0.3,
      contextPressure: 0.4,
      historicalTrust: 0.5,
      globalCoherence: 0.7,
      finalRiskLevel: "high"
    };
  }

  if (riskLevel === "medium") {
    return {
      entanglement: 0.4,
      entropy: 0.3,
      failureCost: 0.4,
      reversibility: 0.6,
      contextPressure: 0.3,
      historicalTrust: 0.5,
      globalCoherence: 0.8,
      finalRiskLevel: "medium"
    };
  }

  return {
    entanglement: 0.2,
    entropy: 0.2,
    failureCost: 0.2,
    reversibility: 0.8,
    contextPressure: 0.2,
    historicalTrust: 0.5,
    globalCoherence: 0.9,
    finalRiskLevel: "low"
  };
}

// ── Anomaly recording with strike counting ──────────────────────────────────

export function recordAnomaly(
  stateInput: GovernanceStateInput,
  anomaly: Omit<AnomalyRecord, "strikeNumber">
): GovernanceState {
  const state = parseGovernanceState(stateInput);
  const sameKindCount = state.anomalies.filter((item) => item.kind === anomaly.kind).length;
  const strikeNumber = Math.min(sameKindCount + 1, 3) as 1 | 2 | 3;

  return parseGovernanceState({
    ...state,
    anomalies: [
      ...state.anomalies,
      {
        ...anomaly,
        strikeNumber
      }
    ],
    phase: strikeNumber >= 3 ? "recovery" : state.phase,
    updatedAt: anomaly.createdAt
  });
}
