import test from "node:test";
import assert from "node:assert/strict";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { runDesktopDecisionWithGovernance } from "../packages/desktop-decision-runner/src/index.js";
import { createFileCheckpointLedgerStore } from "../packages/checkpoint-ledger-v2/src/index.js";
import { createFileExecutionObservationStore } from "../packages/execution-observation/src/index.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEST_BASE_PATH = join(__dirname, "..", ".test-host-integration");

// ── Governance integration tests ─────────────────────────────────────────────

test("host-integration: governance state is created for low risk task", async () => {
  const policy = await loadPolicyFromFile("./routing-policy.yaml");
  const task = parseTaskEnvelope({
    taskId: "integration-low-risk",
    source: "cli",
    intent: {
      summary: "Test low risk task",
      requestedAction: "Read only inspection",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: process.cwd() },
    target: { branches: [], files: ["package.json"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const result = await runDesktopDecisionWithGovernance({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    now: () => "2026-04-28T00:00:00.000Z"
  });

  assert.equal(result.base.status, "ready");
  assert.equal(result.governanceState.taskId, task.taskId);
  assert.equal(result.strategyDecision.taskId, task.taskId);
});

test("host-integration: governance state reflects risk level from routing", async () => {
  const policy = await loadPolicyFromFile("./routing-policy.yaml");
  const task = parseTaskEnvelope({
    taskId: "integration-risk-test",
    source: "cli",
    intent: {
      summary: "Test risk propagation",
      requestedAction: "Read files",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: process.cwd() },
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const result = await runDesktopDecisionWithGovernance({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    now: () => "2026-04-28T00:00:00.000Z"
  });

  // Low risk task should have low risk level
  assert.equal(result.governanceState.risk.finalRiskLevel, "low");
});

// ── Persistence integration tests ───────────────────────────────────────────

test("host-integration: checkpoint persisted to file store", async () => {
  const policy = await loadPolicyFromFile("./routing-policy.yaml");
  const checkpointStore = createFileCheckpointLedgerStore({ basePath: join(TEST_BASE_PATH, "checkpoints") });

  const task = parseTaskEnvelope({
    taskId: "integration-persist-test",
    source: "cli",
    intent: {
      summary: "Test persistence",
      requestedAction: "Read only",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: process.cwd() },
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const result = await runDesktopDecisionWithGovernance({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    now: () => "2026-04-28T00:00:00.000Z"
  });

  // Record checkpoint
  await checkpointStore.record({
    checkpointId: `${task.taskId}:test`,
    taskId: task.taskId,
    branchId: "main",
    stage: result.governanceState.phase,
    governanceStateRef: result.governanceState.taskId,
    createdAt: "2026-04-28T00:00:00.000Z"
  });

  // Verify persistence
  const latest = await checkpointStore.findLatestForTask(task.taskId);
  assert.ok(latest);
  assert.equal(latest?.taskId, task.taskId);

  // Cleanup
  await rm(TEST_BASE_PATH, { recursive: true, force: true }).catch(() => {});
});

test("host-integration: observation persisted to file store", async () => {
  const observationStore = createFileExecutionObservationStore({ basePath: join(TEST_BASE_PATH, "observations") });

  await observationStore.emit({
    observationId: "obs-test-1",
    taskId: "integration-obs-test",
    primitiveId: "test_primitive",
    stage: "test",
    status: "succeeded",
    signals: {},
    createdAt: "2026-04-28T00:00:00.000Z"
  });

  const observations = await observationStore.findByTaskId("integration-obs-test");
  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.observationId, "obs-test-1");

  // Cleanup
  await rm(TEST_BASE_PATH, { recursive: true, force: true }).catch(() => {});
});

// ── Strategy decision tests ─────────────────────────────────────────────────

test("host-integration: strategy decision matches risk level", async () => {
  const policy = await loadPolicyFromFile("./routing-policy.yaml");
  const task = parseTaskEnvelope({
    taskId: "integration-strategy-test",
    source: "cli",
    intent: {
      summary: "Test strategy",
      requestedAction: "Read only",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: process.cwd() },
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const result = await runDesktopDecisionWithGovernance({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal"]
    },
    now: () => "2026-04-28T00:00:00.000Z"
  });

  // Low risk should execute
  assert.equal(result.strategyDecision.actionFamily, "execute");
  assert.equal(result.strategyDecision.verificationIntensity, "light");
});
