import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { parseExecutionObservation } from "../packages/governance-internal-execution-observation/src/index.js";
import {
  scoreEntanglement,
  scoreFailureCost,
  scoreEntropy,
  scoreContextPressure,
  scoreGovernanceRisk
} from "../packages/governance-internal-entropy-risk/src/index.js";

// ── Entanglement tests ──────────────────────────────────────────────────────

test("entropy risk scores multi-file work as more entangled", () => {
  const task = parseTaskEnvelope({
    taskId: "risk-task",
    source: "desktop-thread",
    intent: {
      summary: "implement feature",
      requestedAction: "change several modules",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: {
      branches: [],
      files: ["a.ts", "b.ts", "c.ts"],
      modules: ["contracts", "runner"]
    },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  assert.ok(scoreEntanglement(task) > 0.2);
});

test("entropy risk scores single-file work with low entanglement", () => {
  const task = parseTaskEnvelope({
    taskId: "simple-task",
    source: "desktop-thread",
    intent: {
      summary: "read config",
      requestedAction: "inspect config file",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: {
      branches: [],
      files: ["config.yaml"],
      modules: []
    },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  assert.ok(scoreEntanglement(task) <= 0.15);
});

// ── Failure cost tests ──────────────────────────────────────────────────────

test("entropy risk treats deploy work as higher failure cost", () => {
  const task = parseTaskEnvelope({
    taskId: "deploy-task",
    source: "desktop-thread",
    intent: {
      summary: "deploy release",
      requestedAction: "deploy production release",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { protectedBranch: true },
    target: { branches: ["main"], files: [], modules: [] },
    constraints: { requiresNetwork: true },
    hints: { riskHints: [], tags: [] }
  });

  assert.ok(scoreFailureCost(task) >= 0.8);
});

test("entropy risk scores read-only inspection with low failure cost", () => {
  const task = parseTaskEnvelope({
    taskId: "read-task",
    source: "desktop-thread",
    intent: {
      summary: "review logs",
      requestedAction: "inspect recent logs",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: ["app.log"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  assert.ok(scoreFailureCost(task) <= 0.2);
});

// ── Entropy tests ───────────────────────────────────────────────────────────

test("entropy risk returns baseline entropy with no observations", () => {
  assert.equal(scoreEntropy([]), 0.1);
});

test("entropy risk increases with failed and blocked observations", () => {
  const observations = [
    parseExecutionObservation({
      observationId: "obs-1",
      taskId: "task-1",
      primitiveId: "step-1",
      stage: "execution",
      status: "failed",
      signals: {},
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    parseExecutionObservation({
      observationId: "obs-2",
      taskId: "task-1",
      primitiveId: "step-2",
      stage: "execution",
      status: "blocked",
      signals: {},
      createdAt: "2026-04-27T00:01:00.000Z"
    })
  ];

  const entropy = scoreEntropy(observations);
  assert.ok(entropy > 0.2);
});

// ── Context pressure tests ──────────────────────────────────────────────────

test("entropy risk context pressure is baseline with no observations", () => {
  assert.equal(scoreContextPressure([]), 0.1);
});

test("entropy risk context pressure rises with blocked observations", () => {
  const observations = [
    parseExecutionObservation({
      observationId: "obs-1",
      taskId: "task-1",
      primitiveId: "step-1",
      stage: "execution",
      status: "blocked",
      signals: {},
      createdAt: "2026-04-27T00:00:00.000Z"
    }),
    parseExecutionObservation({
      observationId: "obs-2",
      taskId: "task-1",
      primitiveId: "step-2",
      stage: "execution",
      status: "blocked",
      signals: {},
      createdAt: "2026-04-27T00:01:00.000Z"
    })
  ];

  assert.ok(scoreContextPressure(observations) > 0.2);
});

// ── Composite risk tests ────────────────────────────────────────────────────

test("entropy risk raises risk when observations conflict", () => {
  const task = parseTaskEnvelope({
    taskId: "observe-risk-task",
    source: "desktop-thread",
    intent: {
      summary: "edit package",
      requestedAction: "apply small patch",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: ["package.json"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const risk = scoreGovernanceRisk({
    task,
    observations: [
      parseExecutionObservation({
        observationId: "obs-1",
        taskId: "observe-risk-task",
        primitiveId: "step-1",
        stage: "execution",
        status: "failed",
        signals: {
          contextConflict: true,
          outputDrift: true,
          latencyPressure: 0.5
        },
        createdAt: "2026-04-27T00:00:00.000Z"
      })
    ]
  });

  assert.ok(["medium", "high", "critical"].includes(risk.finalRiskLevel));
});

test("entropy risk scores low for simple read-only task with no observations", () => {
  const task = parseTaskEnvelope({
    taskId: "safe-task",
    source: "desktop-thread",
    intent: {
      summary: "review file",
      requestedAction: "inspect config",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {},
    target: { branches: [], files: ["config.yaml"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const risk = scoreGovernanceRisk({ task });

  assert.equal(risk.finalRiskLevel, "low");
});
