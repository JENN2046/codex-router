import test from "node:test";
import assert from "node:assert/strict";
import { planAgentStrategy } from "../packages/desktop-agent-strategy/src/index.js";

test("desktop agent strategy allows bounded read-only parallelism", () => {
  const plan = planAgentStrategy(
    {
      schemaVersion: "routing-decision.v1",
      decisionId: "read-only:test",
      taskId: "read-only",
      policyVersion: "test",
      classification: {
        taskClass: "read_only",
        riskLevel: "low",
        ambiguityScore: 0,
        clarificationRequired: false,
        riskFactors: []
      },
      execution: {
        selectedModel: "gpt-5.4-mini",
        toolAccess: "read_only",
        executionProfile: "recon-only",
        reasoningEffort: "low"
      },
      approval: {
        required: false,
        reasons: []
      },
      parallelism: {
        allowed: true,
        maxAgents: 3,
        mode: "read_only"
      },
      hostRoute: "desktop"
    },
    {
      availableAgents: 4,
      explicitOwnership: false
    }
  );

  assert.equal(plan.parallel, true);
  assert.equal(plan.maxAgents, 3);
  assert.equal(plan.assignments[0]?.mode, "read_only");
});

test("desktop agent strategy disables write parallelism without ownership", () => {
  const plan = planAgentStrategy(
    {
      schemaVersion: "routing-decision.v1",
      decisionId: "engineering:test",
      taskId: "engineering",
      policyVersion: "test",
      classification: {
        taskClass: "engineering",
        riskLevel: "medium",
        ambiguityScore: 0,
        clarificationRequired: false,
        riskFactors: []
      },
      execution: {
        selectedModel: "gpt-5.3-codex",
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
    },
    {
      availableAgents: 3,
      explicitOwnership: false,
      fileTargets: ["packages/contracts/src/index.ts", "packages/routing-engine/src/index.ts"]
    }
  );

  assert.equal(plan.parallel, false);
  assert.ok(plan.reasons.includes("write_scope_needs_explicit_ownership"));
});
