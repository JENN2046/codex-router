import test from "node:test";
import assert from "node:assert/strict";
import { classifyIntent } from "../packages/intent-gate/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import type { TaskClass, TaskHintProvenance } from "../packages/contracts/src/index.js";

function classifyNeutralHintTask(options: {
  taskId: string;
  taskClassHint: TaskClass;
  source?: TaskHintProvenance["source"];
  repoRoot?: string;
  files?: string[];
}) {
  const provenance = options.source === undefined
    ? {}
    : {
      provenance: [{
        field: "taskClassHint" as const,
        value: options.taskClassHint,
        source: options.source
      }]
    };

  return classifyIntent(parseTaskEnvelope({
    taskId: options.taskId,
    source: "desktop-thread",
    intent: {
      summary: "Status update",
      requestedAction: "Show current state",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: options.repoRoot === undefined ? {} : { repoRoot: options.repoRoot },
    target: { branches: [], files: options.files ?? [], modules: [] },
    constraints: {},
    hints: {
      taskClassHint: options.taskClassHint,
      riskHints: [],
      tags: [],
      ...provenance
    }
  }));
}

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

test("intent gate treats low-risk hints without provenance as untrusted", () => {
  const readOnlyResult = classifyNeutralHintTask({
    taskId: "t-neutral-read-only-hint-without-provenance",
    taskClassHint: "read_only"
  });

  assert.equal(readOnlyResult.taskClass, "engineering");
  assert.ok(readOnlyResult.ambiguityReasons.includes(
    "task_class_hint_untrusted:unspecified:read_only"
  ));

  const smallEditResult = classifyNeutralHintTask({
    taskId: "t-neutral-small-edit-hint-without-provenance",
    taskClassHint: "small_edit",
    repoRoot: "A:/codex-router",
    files: ["README.md"]
  });

  assert.equal(smallEditResult.taskClass, "engineering");
  assert.ok(smallEditResult.ambiguityReasons.includes(
    "task_class_hint_untrusted:unspecified:small_edit"
  ));
});

test("intent gate trusts system policy and operator provenance for low-risk hints", () => {
  for (const source of ["system", "policy", "operator"] as const) {
    const result = classifyNeutralHintTask({
      taskId: `t-neutral-${source}-read-only-hint`,
      taskClassHint: "read_only",
      source
    });

    assert.equal(result.taskClass, "read_only");
    assert.equal(result.recommendedProfile, "recon-only");
    assert.equal(result.clarificationRequired, false);
    assert.deepEqual(result.ambiguityReasons, []);
  }
});

test("intent gate treats user memory agent legacy and unknown provenance as advisory for low-risk hints", () => {
  for (const source of ["user", "memory", "agent", "legacy", "unknown"] as const) {
    const result = classifyNeutralHintTask({
      taskId: `t-neutral-${source}-read-only-hint`,
      taskClassHint: "read_only",
      source
    });

    assert.equal(result.taskClass, "engineering");
    assert.ok(result.ambiguityReasons.includes(
      `task_class_hint_untrusted:${source}:read_only`
    ));
  }
});

test("intent gate still allows any provenance to raise risk", () => {
  for (const source of ["user", "agent", "system", "policy", "operator", "memory", "legacy", "unknown"] as const) {
    const result = classifyNeutralHintTask({
      taskId: `t-neutral-${source}-high-risk-hint`,
      taskClassHint: "high_risk",
      source
    });

    assert.equal(result.taskClass, "high_risk");
    assert.equal(result.ambiguityReasons.includes(`task_class_hint_untrusted:${source}:high_risk`), false);
  }
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
    target: { branches: [], files: ["packages/governance-internal-approval-gate/src/index.ts"], modules: [] },
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
