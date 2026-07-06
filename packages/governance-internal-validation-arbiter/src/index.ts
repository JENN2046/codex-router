import { z } from "zod";
import type { ExecutionObservation } from "../../governance-internal-execution-observation/src/index.js";
import type { GovernanceState } from "../../governance-internal-state-manager/src/index.js";

// ── Agent role ──────────────────────────────────────────────────────────────

export const AgentRoleSchema = z.enum([
  "executor",
  "planner",
  "verifier",
  "conjugate",
  "context_keeper",
  "arbiter"
]);

export type AgentRole = z.infer<typeof AgentRoleSchema>;

// ── Evidence record ────────────────────────────────────────────────────────

export const EvidenceRecordSchema = z.object({
  evidenceId: z.string().min(1),
  taskId: z.string().min(1),
  agentRole: AgentRoleSchema,
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
  createdAt: z.string().min(1)
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type EvidenceRecordInput = z.input<typeof EvidenceRecordSchema>;

// ── Conflict score result ──────────────────────────────────────────────────

export interface ConflictScoreResult {
  score: number;
  level: "none" | "low" | "medium" | "high";
  reasons: string[];
}

// ── Arbiter input ──────────────────────────────────────────────────────────

export interface ArbitrateConflictInput {
  taskId: string;
  evidence: EvidenceRecord[];
  state: GovernanceState;
  now?: () => string;
}

export interface ArbitrationResult {
  arbitrationId: string;
  taskId: string;
  winnerEvidenceId?: string;
  action: "accept_executor" | "accept_verifier" | "accept_conjugate" | "manual_review";
  confidence: number;
  reasons: string[];
  createdAt: string;
}

// ── Parse helper ───────────────────────────────────────────────────────────

export function parseEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord {
  return EvidenceRecordSchema.parse(input);
}

// ── Evidence factory ───────────────────────────────────────────────────────

export function createEvidenceRecord(input: Omit<EvidenceRecord, "evidenceId">): EvidenceRecord {
  return {
    ...input,
    evidenceId: `${input.taskId}:${input.agentRole}:${input.createdAt}`
  };
}

// ── Conflict scorer ────────────────────────────────────────────────────────

export function scoreConflict(observations: ExecutionObservation[]): ConflictScoreResult {
  if (observations.length === 0) {
    return { score: 0, level: "none", reasons: [] };
  }

  const failed = observations.filter((o) => o.status === "failed").length;
  const blocked = observations.filter((o) => o.status === "blocked").length;
  const conflicted = observations.filter((o) => o.signals.contextConflict === true).length;
  const drifted = observations.filter((o) => o.signals.outputDrift === true).length;

  const score = Math.min(1, failed * 0.25 + blocked * 0.25 + conflicted * 0.25 + drifted * 0.25);

  const reasons: string[] = [];
  if (failed > 0) reasons.push(`failed:${failed}`);
  if (blocked > 0) reasons.push(`blocked:${blocked}`);
  if (conflicted > 0) reasons.push(`context_conflict:${conflicted}`);
  if (drifted > 0) reasons.push(`output_drift:${drifted}`);

  let level: ConflictScoreResult["level"] = "none";
  if (score > 0.75) level = "high";
  else if (score > 0.5) level = "medium";
  else if (score > 0.25) level = "low";

  return { score, level, reasons };
}

// ── Arbiter: decide action based on evidence comparison ───────────────────

export function arbitrateConflict(input: ArbitrateConflictInput): ArbitrationResult {
  const now = input.now ?? (() => new Date().toISOString());
  const createdAt = now();

  // Sort evidence by confidence descending
  const sortedEvidence = [...input.evidence].sort((a, b) => b.confidence - a.confidence);

  // If conjugate has high confidence and conflicts with executor, prefer conjugate
  const conjugateEvidence = input.evidence.filter((e) => e.agentRole === "conjugate");
  const verifierEvidence = input.evidence.filter((e) => e.agentRole === "verifier");
  const executorEvidence = input.evidence.filter((e) => e.agentRole === "executor");

  const maxConjugateConfidence = Math.max(0, ...conjugateEvidence.map((e) => e.confidence));
  const maxVerifierConfidence = Math.max(0, ...verifierEvidence.map((e) => e.confidence));
  const maxExecutorConfidence = Math.max(0, ...executorEvidence.map((e) => e.confidence));

  // High risk state: prefer verifier/conjugate over executor
  const isHighRisk = input.state.risk.finalRiskLevel === "high" || input.state.risk.finalRiskLevel === "critical";

  let action: ArbitrationResult["action"] = "accept_executor";
  let winnerEvidenceId: string | undefined;
  let confidence = maxExecutorConfidence;

  if (isHighRisk && (maxConjugateConfidence > 0.7 || maxVerifierConfidence > 0.7)) {
    if (maxConjugateConfidence >= maxVerifierConfidence) {
      action = "accept_conjugate";
      confidence = maxConjugateConfidence;
      winnerEvidenceId = conjugateEvidence.find((e) => e.confidence === maxConjugateConfidence)?.evidenceId;
    } else {
      action = "accept_verifier";
      confidence = maxVerifierConfidence;
      winnerEvidenceId = verifierEvidence.find((e) => e.confidence === maxVerifierConfidence)?.evidenceId;
    }
  } else if (maxConjugateConfidence > 0.8 && maxConjugateConfidence > maxExecutorConfidence) {
    action = "accept_conjugate";
    confidence = maxConjugateConfidence;
    winnerEvidenceId = conjugateEvidence.find((e) => e.confidence === maxConjugateConfidence)?.evidenceId;
  } else if (sortedEvidence.length > 0) {
    // Fallback: use top-ranked evidence, derive action from its agent role
    const top = sortedEvidence[0]!;
    winnerEvidenceId = top.evidenceId;
    switch (top.agentRole) {
      case "conjugate":
        action = "accept_conjugate";
        break;
      case "verifier":
        action = "accept_verifier";
        break;
      default:
        action = "accept_executor";
    }
    confidence = top.confidence;
  }

  const reasons: string[] = [];
  if (isHighRisk) reasons.push("high_risk_state");
  if (maxConjugateConfidence > 0.7) reasons.push(`conjugate_confidence:${maxConjugateConfidence.toFixed(2)}`);
  if (maxVerifierConfidence > 0.7) reasons.push(`verifier_confidence:${maxVerifierConfidence.toFixed(2)}`);

  return {
    arbitrationId: `${input.taskId}:arbitration:${createdAt}`,
    taskId: input.taskId,
    ...(winnerEvidenceId !== undefined ? { winnerEvidenceId } : {}),
    action,
    confidence,
    reasons,
    createdAt
  };
}

// ── Trigger conditions for conjugate agent ────────────────────────────────

export interface ConjugateTriggerInput {
  state: GovernanceState;
  observations: ExecutionObservation[];
}

export function shouldTriggerConjugateAgent(input: ConjugateTriggerInput): boolean {
  const { state, observations } = input;

  // High entropy triggers conjugate
  if (state.risk.entropy >= 0.6) return true;

  // High failure cost triggers conjugate
  if (state.risk.failureCost >= 0.7) return true;

  // Context conflict triggers conjugate
  if (observations.some((o) => o.signals.contextConflict === true)) return true;

  // Multiple failures trigger conjugate
  const failureCount = observations.filter((o) => o.status === "failed").length;
  if (failureCount >= 2) return true;

  return false;
}
