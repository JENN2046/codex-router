import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { routeTask } from "../packages/routing-engine/src/index.js";
import { classifyIntent } from "../packages/intent-gate/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

test("routing engine covers read-only and small edit tasks", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const readOnlyTask = parseTaskEnvelope({
    taskId: "read-only",
    source: "desktop-thread",
    intent: {
      summary: "review the task",
      requestedAction: "inspect and summarize the current config",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const smallEditTask = parseTaskEnvelope({
    taskId: "small-edit",
    source: "desktop-thread",
    intent: {
      summary: "small fix",
      requestedAction: "single file typo fix in config docs",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["README.md"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const readOnlyDecision = routeTask(readOnlyTask, classifyIntent(readOnlyTask), policy);
  const smallEditDecision = routeTask(smallEditTask, classifyIntent(smallEditTask), policy);

  assert.equal(readOnlyDecision.execution.selectedModel, "gpt-5.4-mini");
  assert.equal(readOnlyDecision.execution.toolAccess, "read_only");
  assert.equal(readOnlyDecision.parallelism.mode, "read_only");

  assert.equal(smallEditDecision.execution.selectedModel, "gpt-5.3-codex-spark");
  assert.equal(smallEditDecision.execution.toolAccess, "local_write");
});

test("routing engine respects low-risk taskClassHint when text is neutral", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const readOnlyTask = parseTaskEnvelope({
    taskId: "neutral-read-only-hint",
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
  });

  const smallEditTask = parseTaskEnvelope({
    taskId: "neutral-small-edit-hint",
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
  });

  const readOnlyDecision = routeTask(readOnlyTask, classifyIntent(readOnlyTask), policy);
  const smallEditDecision = routeTask(smallEditTask, classifyIntent(smallEditTask), policy);

  assert.equal(readOnlyDecision.classification.taskClass, "read_only");
  assert.equal(readOnlyDecision.execution.toolAccess, "read_only");
  assert.equal(readOnlyDecision.hostRoute, "codex-cli");

  assert.equal(smallEditDecision.classification.taskClass, "small_edit");
  assert.equal(smallEditDecision.execution.toolAccess, "local_write");
  assert.equal(smallEditDecision.hostRoute, "codex-cli");
});

test("routing engine covers engineering, high-risk, and release tasks", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const engineeringTask = parseTaskEnvelope({
    taskId: "engineering",
    source: "desktop-thread",
    intent: {
      summary: "implement new package",
      requestedAction: "add multi-file TypeScript modules and tests",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: {
      branches: [],
      files: ["packages/contracts/src/index.ts", "packages/routing-engine/src/index.ts"],
      modules: []
    },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const highRiskTask = parseTaskEnvelope({
    taskId: "high-risk",
    source: "desktop-thread",
    intent: {
      summary: "update auth permission checks",
      requestedAction: "change secret and permission handling in production path",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/approval-gate/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const releaseTask = parseTaskEnvelope({
    taskId: "release",
    source: "desktop-thread",
    intent: {
      summary: "prepare release",
      requestedAction: "merge to prod/stable and push production config",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router", branch: "main" },
    target: { branches: ["prod/stable"], files: [], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const engineeringDecision = routeTask(engineeringTask, classifyIntent(engineeringTask), policy);
  const highRiskDecision = routeTask(highRiskTask, classifyIntent(highRiskTask), policy);
  const releaseDecision = routeTask(releaseTask, classifyIntent(releaseTask), policy);

  assert.equal(engineeringDecision.execution.selectedModel, "gpt-5.3-codex");
  assert.equal(engineeringDecision.classification.riskLevel, "medium");

  assert.equal(highRiskDecision.execution.selectedModel, "gpt-5.1-codex-max");
  assert.equal(highRiskDecision.approval.required, true);

  assert.equal(releaseDecision.execution.executionProfile, "release-governance");
  assert.equal(releaseDecision.approval.required, true);
});

test("routing engine fails closed when a task class host route is missing", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const hostRoutes = { ...policy.hostRoutes } as Partial<typeof policy.hostRoutes>;
  delete hostRoutes.high_risk;
  const incompletePolicy = { ...policy, hostRoutes } as typeof policy;
  const highRiskTask = parseTaskEnvelope({
    taskId: "high-risk-missing-route",
    source: "desktop-thread",
    intent: {
      summary: "update auth permission checks",
      requestedAction: "change secret and permission handling",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/approval-gate/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  assert.throws(
    () => routeTask(highRiskTask, classifyIntent(highRiskTask), incompletePolicy),
    /Missing host route for task class: high_risk/
  );
});
