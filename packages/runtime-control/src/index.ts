import type {
  ModelId,
  RoutingDecision,
  RuntimeSignal
} from "../../contracts/src/index.js";
import type { PolicySnapshot } from "../../policy-config/src/index.js";

export interface EscalationOutcome {
  action: "none" | "upgrade_model" | "open_circuit";
  nextModel?: ModelId;
  reasons: string[];
}

const MODEL_LADDER: ModelId[] = [
  "gpt-5.3-codex-spark",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.4",
  "gpt-5.1-codex-max"
];

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
