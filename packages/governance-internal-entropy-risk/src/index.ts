import type { TaskEnvelope } from "../../contracts/src/index.js";
import type { ExecutionObservation } from "../../governance-internal-execution-observation/src/index.js";
import type { GovernanceRiskScore } from "../../governance-internal-state-manager/src/index.js";
import type { DelegationLevel } from "../../delegation-policy/src/index.js";
import { delegationLevelToHistoricalTrust } from "../../delegation-policy/src/index.js";

// ── Input type ──────────────────────────────────────────────────────────────

export interface ScoreGovernanceRiskInput {
  task: TaskEnvelope;
  observations?: ExecutionObservation[];
  /** Optional delegation level — if provided, dynamically adjusts historicalTrust */
  delegationLevel?: DelegationLevel;
}

// ── Composite scorer ────────────────────────────────────────────────────────

export function scoreGovernanceRisk(input: ScoreGovernanceRiskInput): GovernanceRiskScore {
  const observations = input.observations ?? [];
  const entanglement = scoreEntanglement(input.task);
  const entropy = scoreEntropy(observations);
  const failureCost = scoreFailureCost(input.task);
  const reversibility = 1 - failureCost;
  const contextPressure = scoreContextPressure(observations);
  const historicalTrust = input.delegationLevel !== undefined
    ? delegationLevelToHistoricalTrust(input.delegationLevel)
    : 0.5;
  const globalCoherence = observations.some((item) => item.signals.contextConflict === true)
    ? 0.4
    : 0.8;

  const raw =
    entanglement * 0.2 +
    entropy * 0.25 +
    failureCost * 0.25 +
    contextPressure * 0.2 +
    (1 - globalCoherence) * 0.1;

  return {
    entanglement,
    entropy,
    failureCost,
    reversibility,
    contextPressure,
    historicalTrust,
    globalCoherence,
    finalRiskLevel: toRiskLevel(raw)
  };
}

// ── Entanglement: target breadth ────────────────────────────────────────────

export function scoreEntanglement(task: TaskEnvelope): number {
  const fileCount = task.target.files.length;
  const moduleCount = task.target.modules.length;
  const branchCount = task.target.branches.length;
  return clamp01(fileCount * 0.08 + moduleCount * 0.12 + branchCount * 0.1);
}

// ── Entropy: observation instability ────────────────────────────────────────

export function scoreEntropy(observations: ExecutionObservation[]): number {
  if (observations.length === 0) {
    return 0.1;
  }

  const failed = observations.filter((item) => item.status === "failed").length;
  const blocked = observations.filter((item) => item.status === "blocked").length;
  const conflicted = observations.filter((item) => item.signals.contextConflict === true).length;
  const drifted = observations.filter((item) => item.signals.outputDrift === true).length;

  return clamp01(failed * 0.18 + blocked * 0.2 + conflicted * 0.25 + drifted * 0.2);
}

// ── Failure cost: keyword + context heuristics ──────────────────────────────

export function scoreFailureCost(task: TaskEnvelope): number {
  const haystack = `${task.intent.summary} ${task.intent.requestedAction}`.toLowerCase();
  let score = 0.1;

  if (task.repoContext.protectedBranch === true) {
    score += 0.35;
  }
  if (task.constraints.requiresNetwork === true) {
    score += 0.2;
  }
  if (haystack.includes("delete") || haystack.includes("remove")) {
    score += 0.25;
  }
  if (haystack.includes("deploy") || haystack.includes("release")) {
    score += 0.35;
  }
  if (haystack.includes("migration")) {
    score += 0.25;
  }

  return clamp01(score);
}

// ── Context pressure: latency + blocking ────────────────────────────────────

export function scoreContextPressure(observations: ExecutionObservation[]): number {
  if (observations.length === 0) {
    return 0.1;
  }

  const maxLatencyPressure = Math.max(
    ...observations.map((item) => item.signals.latencyPressure ?? 0)
  );
  const blockedCount = observations.filter((item) => item.status === "blocked").length;

  return clamp01(maxLatencyPressure + blockedCount * 0.15);
}

// ── Risk level threshold ────────────────────────────────────────────────────

function toRiskLevel(score: number): GovernanceRiskScore["finalRiskLevel"] {
  if (score >= 0.75) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.3) return "medium";
  return "low";
}

// ── Shared utility ──────────────────────────────────────────────────────────

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}
