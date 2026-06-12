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

test("intent gate respects low-risk hints when text has no classification keywords", () => {
  const readOnlyResult = classifyIntent(parseTaskEnvelope({
    taskId: "t-neutral-read-only-hint",
    source: "desktop-thread",
    intent: {
      summary: "Status update",
      requestedAction: "Show current state",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: { taskClassHint: "read_only", riskHints: [], tags: [] }
  }));

  assert.equal(readOnlyResult.taskClass, "read_only");
  assert.equal(readOnlyResult.recommendedProfile, "recon-only");
  assert.equal(readOnlyResult.clarificationRequired, false);
  assert.deepEqual(readOnlyResult.ambiguityReasons, []);

  const smallEditResult = classifyIntent(parseTaskEnvelope({
    taskId: "t-neutral-small-edit-hint",
    source: "desktop-thread",
    intent: {
      summary: "Status update",
      requestedAction: "Show current state",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["README.md"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "small_edit", riskHints: [], tags: [] }
  }));

  assert.equal(smallEditResult.taskClass, "small_edit");
  assert.equal(smallEditResult.recommendedProfile, "engineering");
  assert.equal(smallEditResult.clarificationRequired, false);
  assert.deepEqual(smallEditResult.ambiguityReasons, []);
});

test("intent gate requires trusted provenance before low-risk hints classify neutral text", () => {
  const memoryHintResult = classifyIntent(parseTaskEnvelope({
    taskId: "t-neutral-memory-read-only-hint",
    source: "desktop-thread",
    intent: {
      summary: "Status update",
      requestedAction: "Show current state",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: [],
      provenance: [{
        field: "taskClassHint",
        value: "read_only",
        source: "memory",
        reason: "recalled previous low-risk posture"
      }]
    }
  }));

  assert.equal(memoryHintResult.taskClass, "engineering");
  assert.ok(memoryHintResult.ambiguityReasons.includes(
    "task_class_hint_untrusted:memory:read_only"
  ));

  const userHintResult = classifyIntent(parseTaskEnvelope({
    taskId: "t-neutral-user-read-only-hint",
    source: "desktop-thread",
    intent: {
      summary: "Status update",
      requestedAction: "Show current state",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: [],
      provenance: [{
        field: "taskClassHint",
        value: "read_only",
        source: "user",
        reason: "operator explicitly scoped read-only"
      }]
    }
  }));

  assert.equal(userHintResult.taskClass, "read_only");
  assert.equal(userHintResult.clarificationRequired, false);
});

test("intent gate still allows untrusted provenance to raise risk", () => {
  const result = classifyIntent(parseTaskEnvelope({
    taskId: "t-neutral-memory-high-risk-hint",
    source: "desktop-thread",
    intent: {
      summary: "Status update",
      requestedAction: "Show current state",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: {
      taskClassHint: "high_risk",
      riskHints: [],
      tags: [],
      provenance: [{
        field: "taskClassHint",
        value: "high_risk",
        source: "memory"
      }]
    }
  }));

  assert.equal(result.taskClass, "high_risk");
  assert.equal(result.ambiguityReasons.includes("task_class_hint_untrusted:memory:high_risk"), false);
});

test("intent gate does not allow taskClassHint to down-classify engineering text", () => {
  const result = classifyIntent(parseTaskEnvelope({
    taskId: "t-engineering-hint-conflict",
    source: "api",
    intent: {
      summary: "implement package module",
      requestedAction: "refactor multi-file TypeScript module behavior",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/intent-gate/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "read_only", riskHints: [], tags: [] }
  }));

  assert.equal(result.taskClass, "engineering");
  assert.ok(result.ambiguityReasons.includes("task_class_hint_conflict:read_only:engineering"));
});

test("intent gate does not allow taskClassHint to down-classify risky text", () => {
  const result = classifyIntent(parseTaskEnvelope({
    taskId: "t-malicious-hint",
    source: "api",
    intent: {
      summary: "review production secret handling",
      requestedAction: "delete production env secrets and update permission gates",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/approval-gate/src/index.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "read_only", riskHints: [], tags: [] }
  }));

  assert.equal(result.taskClass, "high_risk");
  assert.ok(result.ambiguityReasons.includes("task_class_hint_conflict:read_only:high_risk"));
});

test("intent gate allows taskClassHint to raise risk", () => {
  const result = classifyIntent(parseTaskEnvelope({
    taskId: "t-risk-raising-hint",
    source: "desktop-thread",
    intent: {
      summary: "small docs update",
      requestedAction: "single file typo fix in README",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["README.md"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "high_risk", riskHints: [], tags: [] }
  }));

  assert.equal(result.taskClass, "high_risk");
  assert.ok(result.ambiguityReasons.includes("task_class_hint_conflict:high_risk:small_edit"));
});

test("intent gate rechecks target surface after taskClassHint raises risk", () => {
  const result = classifyIntent(parseTaskEnvelope({
    taskId: "t-risk-hint-missing-target",
    source: "api",
    intent: {
      summary: "review current config",
      requestedAction: "inspect and summarize the config",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: { taskClassHint: "high_risk", riskHints: [], tags: [] }
  }));

  assert.equal(result.taskClass, "high_risk");
  assert.ok(result.ambiguityReasons.includes("task_class_hint_conflict:high_risk:read_only"));
  assert.ok(result.ambiguityReasons.includes("missing_target_surface"));
  assert.equal(result.clarificationRequired, true);
});
