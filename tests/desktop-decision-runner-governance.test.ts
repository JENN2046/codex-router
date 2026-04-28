import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import {
  runDesktopDecisionWithGovernance
} from "../packages/desktop-decision-runner/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

test("desktop decision runner with governance returns base + governance state + strategy decision", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const result = await runDesktopDecisionWithGovernance({
    task: parseTaskEnvelope({
      taskId: "governance-runner-task",
      source: "desktop-thread",
      intent: {
        summary: "review current config",
        requestedAction: "inspect and summarize routing policy",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(result.base.status, "ready");
  assert.equal(result.governanceState.taskId, result.base.task.taskId);
  assert.equal(result.strategyDecision.taskId, result.base.task.taskId);
});

test("desktop decision runner with governance assigns governance state from routing decision", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const result = await runDesktopDecisionWithGovernance({
    task: parseTaskEnvelope({
      taskId: "governance-read-only-task",
      source: "desktop-thread",
      intent: {
        summary: "inspect logs",
        requestedAction: "read recent log entries",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["app.log"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal"]
    },
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(result.governanceState.risk.finalRiskLevel, "low");
  assert.equal(result.governanceState.phase, "planning");
  assert.equal(result.strategyDecision.actionFamily, "execute");
});

test("desktop decision runner with governance uses light verification for low risk", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const result = await runDesktopDecisionWithGovernance({
    task: parseTaskEnvelope({
      taskId: "governance-low-risk-task",
      source: "desktop-thread",
      intent: {
        summary: "check status",
        requestedAction: "verify system health",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["status.txt"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal"]
    },
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(result.strategyDecision.verificationIntensity, "light");
  assert.equal(result.strategyDecision.checkpointCadence, "stage");
});
