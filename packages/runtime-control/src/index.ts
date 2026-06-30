import type {
  ModelId,
  RoutingDecision,
  RuntimeEventType,
  RuntimeSignal
} from "../../contracts/src/index.js";
import { RuntimeSignalSchema } from "../../contracts/src/index.js";
import type { PolicySnapshot } from "../../policy-config/src/index.js";

export interface EscalationOutcome {
  action: "none" | "upgrade_model" | "open_circuit";
  nextModel?: ModelId;
  reasons: string[];
}

export interface GovernanceStateRuntimeSignalSource {
  taskId: string;
  risk: {
    contextPressure: number;
    finalRiskLevel: "low" | "medium" | "high" | "critical";
  };
  anomalies: ReadonlyArray<{
    kind: string;
  }>;
}

export interface CreateRuntimeSignalFromGovernanceStateInput {
  state: GovernanceStateRuntimeSignalSource;
  eventType?: RuntimeEventType;
  details?: string[];
}

const MODEL_LADDER: ModelId[] = [
  "gpt-5.3-codex-spark",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.4",
  "gpt-5.1-codex-max"
];

export function createRuntimeSignalFromGovernanceState(
  input: CreateRuntimeSignalFromGovernanceStateInput
): RuntimeSignal {
  const failureCount = countExecutionFailures(input.state);
  const eventType =
    input.eventType ?? inferRuntimeEventType(input.state, failureCount);
  const details = [...(input.details ?? [])];

  if (failureCount > 0) {
    details.push(`execution_failures:${failureCount}`);
  }

  if (
    input.state.risk.finalRiskLevel === "high" ||
    input.state.risk.finalRiskLevel === "critical"
  ) {
    details.push(`risk:${input.state.risk.finalRiskLevel}`);
  }

  return RuntimeSignalSchema.parse({
    taskId: input.state.taskId,
    eventType,
    failureCount,
    contextPressure: input.state.risk.contextPressure,
    details
  });
}

export function evaluateRuntimeSignals(
  decision: RoutingDecision,
  signal: RuntimeSignal,
  policy: PolicySnapshot
): EscalationOutcome {
  const reasons: string[] = [];

  if (signal.failureCount >= policy.escalationRules.failureThreshold) {
    reasons.push("failure_threshold_reached");
  }

  if (signal.eventType === "scope_expanded") {
    reasons.push("scope_expanded");
  }

  if (
    signal.contextPressure !== undefined &&
    signal.contextPressure >= policy.escalationRules.contextPressureThreshold
  ) {
    reasons.push("context_pressure");
  }

  if (signal.eventType === "risk_detected" && policy.escalationRules.highRiskSticky) {
    reasons.push("high_risk_signal");
  }

  if (signal.eventType === "validation_failed") {
    reasons.push("validation_failed");
  }

  if (reasons.length === 0) {
    return { action: "none", reasons: [] };
  }

  const nextModel = upgradeModel(decision.execution.selectedModel);
  if (nextModel === decision.execution.selectedModel && reasons.includes("high_risk_signal")) {
    return { action: "open_circuit", reasons };
  }

  if (nextModel === decision.execution.selectedModel) {
    return {
      action: "open_circuit",
      reasons
    };
  }

  return {
    action: "upgrade_model",
    nextModel,
    reasons
  };
}

export function upgradeModel(current: ModelId): ModelId {
  const index = MODEL_LADDER.indexOf(current);
  if (index === -1 || index === MODEL_LADDER.length - 1) {
    return current;
  }

  return MODEL_LADDER[index + 1] ?? current;
}

function countExecutionFailures(state: GovernanceStateRuntimeSignalSource): number {
  return state.anomalies.filter((anomaly) => anomaly.kind === "execution_failure").length;
}

function inferRuntimeEventType(
  state: GovernanceStateRuntimeSignalSource,
  failureCount: number
): RuntimeEventType {
  if (
    state.risk.finalRiskLevel === "high" ||
    state.risk.finalRiskLevel === "critical"
  ) {
    return "risk_detected";
  }

  if (failureCount > 0) {
    return "attempt_failed";
  }

  return "attempt_succeeded";
}
