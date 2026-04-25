import test from "node:test";
import assert from "node:assert/strict";
import { classifyIntent } from "../packages/intent-gate/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";

test("intent gate asks for clarification on ambiguous continuation tasks", () => {
  const result = classifyIntent(parseTaskEnvelope({
    taskId: "t-1",
    source: "desktop-thread",
    intent: {
      summary: "continue",
      requestedAction: "do it",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  }));

  assert.equal(result.clarificationRequired, true);
  assert.equal(result.recommendedProfile, "clarify-then-plan");
});

test("intent gate keeps explicit read-only requests out of clarification", () => {
  const result = classifyIntent(parseTaskEnvelope({
    taskId: "t-2",
    source: "desktop-thread",
    intent: {
      summary: "review plugin loader behavior",
      requestedAction: "inspect Plugin.js and summarize the discovery flow",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/VCP/VCPToolBox", branch: "main" },
    target: { branches: [], files: ["Plugin.js"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  }));

  assert.equal(result.taskClass, "read_only");
  assert.equal(result.clarificationRequired, false);
  assert.equal(result.recommendedProfile, "recon-only");
});
