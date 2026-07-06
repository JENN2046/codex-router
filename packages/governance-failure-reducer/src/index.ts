import type { TaskEnvelope } from "../../contracts/src/index.js";
import type {
  GovernanceState,
  AnomalyRecord,
  GovernanceRiskScore
} from "../../governance-internal-state-manager/src/index.js";
import type { StrategyDecisionV2 } from "../../governance-internal-strategy-router/src/index.js";
import { routeStrategyV2 } from "../../governance-internal-strategy-router/src/index.js";
import type { ArbitrationPacket } from "../../governance-internal-recovery-control/src/index.js";
import { createArbitrationPacket } from "../../governance-internal-recovery-control/src/index.js";
import {
  scoreGovernanceRisk,
  type ScoreGovernanceRiskInput
} from "../../governance-internal-entropy-risk/src/index.js";
import {
  parseExecutionObservation,
  createObservationId,
  EXECUTION_OBSERVATION_REF_PREFIX,
  type ExecutionObservation
} from "../../governance-internal-execution-observation/src/index.js";

// ── Input / Output ────────────────────────────────────────────────────────

export interface ApplyExecutionFailureInput {
  /** Current governance state (mutated copy returned) */
  state: GovernanceState;
  /** The task envelope for risk scoring */
  task: TaskEnvelope;
  /** Combined primitive identifier (e.g. "spawn_agent:0") */
  primitiveId: string;
  /** Error class string (e.g. "missing_handler:spawn_agent", "agent_capacity_exceeded") */
  errorClass: string;
  /** Machine evidence references associated with this failure */
  evidenceRefs?: string[];
  /** Step index within the execution plan (used in anomalyId) */
  stepIndex: number;
  /** Optional clock (defaults to Date.now ISO) */
  now?: () => string;
}

export interface ApplyExecutionFailureOutput {
  /** Updated governance state with new anomaly, risk score */
  state: GovernanceState;
  /** Re-scored risk */
  risk: GovernanceRiskScore;
  /** Re-routed strategy decision */
  strategyDecision: StrategyDecisionV2;
  /** The newly created anomaly record */
  anomaly: AnomalyRecord;
  /** Arbitration packet (always computed; caller decides whether to lock down) */
  arbitrationPacket: ArbitrationPacket;
}

// ── Reducer ────────────────────────────────────────────────────────────────

/**
 * Applies a single execution failure to the governance state.
 *
 * Pure reducer: does not mutate input state, does not call callbacks,
 * does not persist. The caller is responsible for onGovernanceUpdate
 * notifications and lockdown decisions.
 *
 * Replaces the duplicated anomaly/risk/strategy blocks that previously
 * lived in desktop-live-adapter's missing-handler and ok:false branches.
 */
export function applyExecutionFailureToGovernanceState(
  input: ApplyExecutionFailureInput
): ApplyExecutionFailureOutput {
  const now = input.now ?? (() => new Date().toISOString());
  const timestamp = now();

  // 1. Create observation for risk scoring
  const observationForRisk: ExecutionObservation = parseExecutionObservation({
    observationId: createObservationId({
      taskId: input.task.taskId,
      primitiveId: input.primitiveId,
      status: "failed",
      createdAt: timestamp
    }),
    taskId: input.task.taskId,
    primitiveId: input.primitiveId,
    stage: "execution",
    status: "failed",
    signals: { errorClass: input.errorClass },
    createdAt: timestamp
  });

  // 2. Count same-kind anomalies for strike escalation
  const sameKindCount = input.state.anomalies.filter(
    (a) => a.kind === "execution_failure"
  ).length;
  const strikeNumber = Math.min(sameKindCount + 1, 3) as 1 | 2 | 3;

  // 3. Create anomaly record
  const anomaly: AnomalyRecord = {
    anomalyId: `anomaly:${input.task.taskId}:${input.primitiveId}:${timestamp}`,
    taskId: input.task.taskId,
    kind: "execution_failure",
    message: input.errorClass,
    strikeNumber,
    createdAt: timestamp,
    evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs)
  };

  // 4. Append anomaly to state
  let state: GovernanceState = {
    ...input.state,
    anomalies: [...input.state.anomalies, anomaly],
    updatedAt: timestamp
  };

  // 5. Re-score risk
  const riskInput: ScoreGovernanceRiskInput = {
    task: input.task,
    observations: state.anomalies.length > 0
      ? [observationForRisk]
      : []
  };
  const risk = scoreGovernanceRisk(riskInput);
  state = {
    ...state,
    risk
  };

  // 6. Re-route strategy
  const strategyDecision = routeStrategyV2({
    state,
    now: () => timestamp
  });

  // 7. Create arbitration packet (always; cheap and deterministic)
  const arbitrationPacket = createArbitrationPacket({
    state,
    now: () => timestamp
  });

  return {
    state,
    risk,
    strategyDecision,
    anomaly,
    arbitrationPacket
  };
}

function normalizeEvidenceRefs(values: string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  const normalized: string[] = [];
  for (const value of values) {
    const normalizedValue = normalizeEvidenceRef(value);
    if (
      normalizedValue === undefined
      || normalized.includes(normalizedValue)
    ) {
      continue;
    }
    normalized.push(normalizedValue);
  }

  return normalized;
}

function normalizeEvidenceRef(value: string): string | undefined {
  if (value.length === 0 || value.trim().length === 0) {
    return undefined;
  }

  if (value.startsWith(EXECUTION_OBSERVATION_REF_PREFIX)) {
    return value;
  }

  return value.trim();
}
