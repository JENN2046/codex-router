import { z } from "zod";
import type { GovernanceState } from "../../state-manager/src/index.js";

// ── Action family ───────────────────────────────────────────────────────────

export const StrategyActionFamilySchema = z.enum([
  "execute",
  "verify",
  "simulate",
  "step_back",
  "fork",
  "abort"
]);

// ── Verification intensity ──────────────────────────────────────────────────

export const VerificationIntensitySchema = z.enum([
  "none",
  "light",
  "standard",
  "strict"
]);

// ── Checkpoint cadence ─────────────────────────────────────────────────────

export const CheckpointCadenceSchema = z.enum([
  "stage",
  "primitive",
  "risk_boundary"
]);

// ── Strategy decision V2 ────────────────────────────────────────────────────

export const StrategyDecisionV2Schema = z.object({
  schemaVersion: z.literal("strategy-decision.v2").default("strategy-decision.v2"),
  taskId: z.string().min(1),
  actionFamily: StrategyActionFamilySchema,
  verificationIntensity: VerificationIntensitySchema,
  checkpointCadence: CheckpointCadenceSchema,
  agentBudget: z.object({
    executor: z.number().int().min(0),
    verifier: z.number().int().min(0),
    shadow: z.number().int().min(0).optional()
  }),
  reasons: z.array(z.string()).default([]),
  createdAt: z.string().min(1)
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type StrategyActionFamily = z.infer<typeof StrategyActionFamilySchema>;
export type VerificationIntensity = z.infer<typeof VerificationIntensitySchema>;
export type CheckpointCadence = z.infer<typeof CheckpointCadenceSchema>;
export type StrategyDecisionV2Input = z.input<typeof StrategyDecisionV2Schema>;
export type StrategyDecisionV2 = z.infer<typeof StrategyDecisionV2Schema>;

// ── Route input ─────────────────────────────────────────────────────────────

export interface RouteStrategyV2Input {
  state: GovernanceState;
  now?: () => string;
}

// ── Parse helper ────────────────────────────────────────────────────────────

export function parseStrategyDecisionV2(input: StrategyDecisionV2Input): StrategyDecisionV2 {
  return StrategyDecisionV2Schema.parse(input);
}

// ── Core routing logic ─────────────────────────────────────────────────────

export function routeStrategyV2(input: RouteStrategyV2Input): StrategyDecisionV2 {
  const now = input.now ?? (() => new Date().toISOString());
  const risk = input.state.risk;
  const maxStrike = Math.max(0, ...input.state.anomalies.map((item) => item.strikeNumber));

  // Three strikes → step_back
  if (maxStrike >= 3) {
    return parseStrategyDecisionV2({
      taskId: input.state.taskId,
      actionFamily: "step_back",
      verificationIntensity: "strict",
      checkpointCadence: "risk_boundary",
      agentBudget: {
        executor: 0,
        verifier: 1,
        shadow: 1
      },
      reasons: ["three_strikes_step_back"],
      createdAt: now()
    });
  }

  // Critical risk → simulate (shadow only, prevent real execution)
  if (risk.finalRiskLevel === "critical") {
    return parseStrategyDecisionV2({
      taskId: input.state.taskId,
      actionFamily: "simulate",
      verificationIntensity: "strict",
      checkpointCadence: "risk_boundary",
      agentBudget: {
        executor: 0,
        verifier: 1,
        shadow: 1
      },
      reasons: ["risk_level:critical"],
      createdAt: now()
    });
  }

  // High risk or high entropy/pressure → verify
  if (
    risk.finalRiskLevel === "high" ||
    risk.entropy >= 0.6 ||
    risk.contextPressure >= 0.6
  ) {
    return parseStrategyDecisionV2({
      taskId: input.state.taskId,
      actionFamily: "verify",
      verificationIntensity: "standard",
      checkpointCadence: "primitive",
      agentBudget: {
        executor: 1,
        verifier: 1
      },
      reasons: ["risk_requires_verification"],
      createdAt: now()
    });
  }

  // Low / medium risk → execute
  return parseStrategyDecisionV2({
    taskId: input.state.taskId,
    actionFamily: "execute",
    verificationIntensity: "light",
    checkpointCadence: "stage",
    agentBudget: {
      executor: 1,
      verifier: 0
    },
    reasons: ["risk_within_execution_bounds"],
    createdAt: now()
  });
}

// ── Safety predicates ──────────────────────────────────────────────────────

export function requiresHumanStepBack(decision: StrategyDecisionV2): boolean {
  return decision.actionFamily === "step_back" || decision.actionFamily === "abort";
}

export function isWriteExecutionAllowed(decision: StrategyDecisionV2): boolean {
  return decision.actionFamily === "execute" || decision.actionFamily === "verify";
}
