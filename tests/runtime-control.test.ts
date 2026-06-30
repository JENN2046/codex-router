import test from "node:test";
import assert from "node:assert/strict";
import {
  createRuntimeSignalFromGovernanceState,
  evaluateRuntimeSignals,
  upgradeModel,
  type GovernanceStateRuntimeSignalSource
} from "../packages/runtime-control/src/index.js";
import { parseRoutingDecision, type ModelId, type RuntimeSignal } from "../packages/contracts/src/index.js";
import type { PolicySnapshot } from "../packages/policy-config/src/index.js";

const TEST_POLICY = {
  escalationRules: {
    failureThreshold: 2,
    contextPressureThreshold: 0.75,
    highRiskSticky: true
  }
} as PolicySnapshot;

function createDecision(model: ModelId = "gpt-5.3-codex-spark") {
  return parseRoutingDecision({
    decisionId: "runtime-control-task:test-policy",
    taskId: "runtime-control-task",
    policyVersion: "test-policy",
    classification: {
      taskClass: "engineering",
      riskLevel: "medium",
      ambiguityScore: 0.1,
      clarificationRequired: false,
      riskFactors: ["task_class:engineering"]
    },
    execution: {
      selectedModel: model,
      toolAccess: "engineering_write",
      executionProfile: "engineering",
      reasoningEffort: "medium"
    },
    approval: {
      required: false,
      reasons: []
    },
    parallelism: {
      allowed: true,
      maxAgents: 2,
      mode: "owned_write"
    },
    hostRoute: "desktop"
  });
}

function createSignal(overrides: Partial<RuntimeSignal> = {}): RuntimeSignal {
  return {
    taskId: "runtime-control-task",
    eventType: "attempt_succeeded",
    failureCount: 0,
    details: [],
    ...overrides
  };
}

function createGovernanceState(
  overrides: Partial<GovernanceStateRuntimeSignalSource> = {}
): GovernanceStateRuntimeSignalSource {
  return {
    taskId: "runtime-control-task",
    risk: {
      contextPressure: 0.2,
      finalRiskLevel: "low"
    },
    anomalies: [],
    ...overrides
  };
}

test("runtime control upgrades codex spark to gpt-5.4-mini before larger models", () => {
  assert.equal(upgradeModel("gpt-5.3-codex-spark"), "gpt-5.4-mini");
  assert.equal(upgradeModel("gpt-5.4-mini"), "gpt-5.3-codex");
  assert.equal(upgradeModel("gpt-5.3-codex"), "gpt-5.4");
  assert.equal(upgradeModel("gpt-5.4"), "gpt-5.1-codex-max");
  assert.equal(upgradeModel("gpt-5.1-codex-max"), "gpt-5.1-codex-max");
});

test("runtime control returns no action when signal stays below escalation thresholds", () => {
  const outcome = evaluateRuntimeSignals(
    createDecision(),
    createSignal({
      failureCount: 1,
      contextPressure: 0.4
    }),
    TEST_POLICY
  );

  assert.deepEqual(outcome, {
    action: "none",
    reasons: []
  });
});

test("runtime control upgrades model when failure threshold is reached", () => {
  const outcome = evaluateRuntimeSignals(
    createDecision("gpt-5.3-codex-spark"),
    createSignal({
      eventType: "attempt_failed",
      failureCount: 2
    }),
    TEST_POLICY
  );

  assert.equal(outcome.action, "upgrade_model");
  assert.equal(outcome.nextModel, "gpt-5.4-mini");
  assert.deepEqual(outcome.reasons, ["failure_threshold_reached"]);
});

test("runtime control upgrades model on scope expansion and validation failure", () => {
  const scopeOutcome = evaluateRuntimeSignals(
    createDecision("gpt-5.4-mini"),
    createSignal({
      eventType: "scope_expanded"
    }),
    TEST_POLICY
  );
  const validationOutcome = evaluateRuntimeSignals(
    createDecision("gpt-5.4-mini"),
    createSignal({
      eventType: "validation_failed"
    }),
    TEST_POLICY
  );

  assert.equal(scopeOutcome.action, "upgrade_model");
  assert.equal(scopeOutcome.nextModel, "gpt-5.3-codex");
  assert.deepEqual(scopeOutcome.reasons, ["scope_expanded"]);
  assert.equal(validationOutcome.action, "upgrade_model");
  assert.equal(validationOutcome.nextModel, "gpt-5.3-codex");
  assert.deepEqual(validationOutcome.reasons, ["validation_failed"]);
});

test("runtime control upgrades model when context pressure reaches policy threshold", () => {
  const outcome = evaluateRuntimeSignals(
    createDecision("gpt-5.3-codex"),
    createSignal({
      eventType: "context_pressure",
      contextPressure: 0.75
    }),
    TEST_POLICY
  );

  assert.equal(outcome.action, "upgrade_model");
  assert.equal(outcome.nextModel, "gpt-5.4");
  assert.deepEqual(outcome.reasons, ["context_pressure"]);
});

test("runtime control opens circuit for sticky high-risk signal at max model", () => {
  const outcome = evaluateRuntimeSignals(
    createDecision("gpt-5.1-codex-max"),
    createSignal({
      eventType: "risk_detected"
    }),
    TEST_POLICY
  );

  assert.equal(outcome.action, "open_circuit");
  assert.deepEqual(outcome.reasons, ["high_risk_signal"]);
});

test("runtime control derives attempt failure signal from governance execution anomalies", () => {
  const signal = createRuntimeSignalFromGovernanceState({
    state: createGovernanceState({
      risk: {
        contextPressure: 0.6,
        finalRiskLevel: "medium"
      },
      anomalies: [
        { kind: "execution_failure" },
        { kind: "output_drift" },
        { kind: "execution_failure" }
      ]
    })
  });

  assert.equal(signal.taskId, "runtime-control-task");
  assert.equal(signal.eventType, "attempt_failed");
  assert.equal(signal.failureCount, 2);
  assert.equal(signal.contextPressure, 0.6);
  assert.deepEqual(signal.details, ["execution_failures:2"]);
});

test("runtime control derives sticky risk signal from high-risk governance state", () => {
  const signal = createRuntimeSignalFromGovernanceState({
    state: createGovernanceState({
      risk: {
        contextPressure: 0.8,
        finalRiskLevel: "critical"
      },
      anomalies: [
        { kind: "execution_failure" }
      ]
    }),
    details: ["operator_review_required"]
  });

  assert.equal(signal.eventType, "risk_detected");
  assert.equal(signal.failureCount, 1);
  assert.equal(signal.contextPressure, 0.8);
  assert.deepEqual(signal.details, [
    "operator_review_required",
    "execution_failures:1",
    "risk:critical"
  ]);
});
