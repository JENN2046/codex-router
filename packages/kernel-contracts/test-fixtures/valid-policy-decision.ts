import type { PolicyDecision } from "../src/index.js";
import { validCapabilityScope, validToolExecuteScope } from "./valid-capability-scope.js";
import { validSandboxProfile } from "./valid-sandbox-profile.js";
import { validTask } from "./valid-task.js";

export const validPolicyDecision = {
  schemaVersion: "policy-decision.v1",
  decisionId: "decision_phase_1_fixture_001",
  taskId: validTask.taskId,
  policyVersion: "phase-1-fixture-policy",
  risk: {
    level: "medium",
    factors: ["contracts_change"],
    ambiguityScore: 0.1,
    clarificationRequired: false
  },
  execution: {
    executor: "codex-cli",
    model: "gpt-5.4-mini",
    profile: "engineering",
    reasoningEffort: "medium",
    sandbox: validSandboxProfile
  },
  capabilities: [validCapabilityScope, validToolExecuteScope],
  approval: {
    required: false,
    reasons: []
  },
  parallelism: {
    allowed: false,
    maxAgents: 1,
    mode: "disabled"
  },
  createdAt: "2026-06-04T00:05:00.000Z",
  legacy: {}
} as const satisfies PolicyDecision;
