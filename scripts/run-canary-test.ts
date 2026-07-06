#!/usr/bin/env node
/**
 * Codex CLI Canary Test
 *
 * Runs a DGP-governed canary test against the CLI host.
 *
 * Usage:
 *   npm run canary                        # low risk (default)
 *   npm run canary:write                  # medium risk (workspace write)
 *   npm run canary:external               # high risk (external write)
 *   npx tsx scripts/run-canary-test.ts --risk medium
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { runDesktopDecisionWithGovernance } from "../packages/desktop-decision-runner/src/index.js";
import { createFileCheckpointLedgerStore } from "../packages/governance-internal-checkpoint-ledger-v2/src/index.js";
import { createFileExecutionObservationStore } from "../packages/governance-internal-execution-observation/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const EVIDENCE_DIR = join(__dirname, "..", "docs", "evidence");
const LEGACY_EVIDENCE_FILENAME = "codex-cli-canary-latest.json";
const TEST_BASE_PATH = join(__dirname, "..", ".test-canary");

export type RiskLevel = "low" | "medium" | "high";

export const CANARY_EVIDENCE_FILENAMES: Record<RiskLevel, string> = {
  low: "codex-cli-canary-low-latest.json",
  medium: "codex-cli-canary-medium-latest.json",
  high: "codex-cli-canary-high-latest.json"
};

export interface CanaryResult {
  status: "passed" | "failed" | "blocked";
  taskId: string;
  governancePhase: string;
  riskLevel: string;
  actionFamily: string;
  verificationIntensity: string;
  checkpointPersisted: boolean;
  observationPersisted: boolean;
  requiresArbitration: boolean;
  blockingReasons?: string[];
  error?: string;
}

export interface CanaryEvidence {
  schemaVersion: "codex-router-evidence.v1";
  generatedAt: string;
  phase: "phase20";
  scenarioId: "CANARY-01" | "CANARY-02" | "CANARY-03";
  host: "cli";
  result: CanaryResult;
}

export function getCanaryEvidencePaths(
  risk: RiskLevel,
  evidenceDir = EVIDENCE_DIR
): string[] {
  return [
    join(evidenceDir, CANARY_EVIDENCE_FILENAMES[risk]),
    join(evidenceDir, LEGACY_EVIDENCE_FILENAME)
  ];
}

export function buildCanaryEvidence(
  risk: RiskLevel,
  result: CanaryResult,
  generatedAt = new Date().toISOString()
): CanaryEvidence {
  return {
    schemaVersion: "codex-router-evidence.v1",
    generatedAt,
    phase: "phase20",
    scenarioId: canaryScenarioId(risk),
    host: "cli",
    result
  };
}

export async function writeCanaryEvidence(
  risk: RiskLevel,
  result: CanaryResult,
  options: {
    evidenceDir?: string;
    generatedAt?: string;
  } = {}
): Promise<{ evidence: CanaryEvidence; paths: string[] }> {
  const evidenceDir = options.evidenceDir ?? EVIDENCE_DIR;
  const evidence = buildCanaryEvidence(risk, result, options.generatedAt);
  const paths = getCanaryEvidencePaths(risk, evidenceDir);

  await mkdir(evidenceDir, { recursive: true });
  for (const evidencePath of paths) {
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2), "utf-8");
  }

  return { evidence, paths };
}

function parseRiskArg(): RiskLevel {
  const riskIdx = process.argv.indexOf("--risk");
  if (riskIdx >= 0) {
    const val = process.argv[riskIdx + 1];
    if (val === "medium" || val === "high") return val;
  }
  return "low";
}

function canaryScenarioId(
  risk: RiskLevel
): "CANARY-01" | "CANARY-02" | "CANARY-03" {
  switch (risk) {
    case "high":
      return "CANARY-03";
    case "medium":
      return "CANARY-02";
    default:
      return "CANARY-01";
  }
}

function buildIntent(risk: RiskLevel) {
  switch (risk) {
    case "medium":
      return {
        summary: "Canary test: verify DGP governance for workspace write",
        requestedAction: "Modify a test file and verify governance gates",
        successCriteria: ["Complete without errors", "Strategy upgrade triggered", "Irreversible actions detected"],
        outOfScope: ["Production writes", "External API calls"]
      };
    case "high":
      return {
        summary: "Canary test: verify DGP governance for external write",
        requestedAction: "Simulate an external API call with governance gates",
        successCriteria: ["Complete with arbitration trigger", "Risk escalated to high/critical", "Step-back engaged"],
        outOfScope: ["Real production API calls"]
      };
    default:
      return {
        summary: "Canary test: verify DGP governance integration",
        requestedAction: "Run a simple read-only inspection to verify governance is working",
        successCriteria: ["Complete without errors", "Generate governance state", "Persist checkpoint", "Persist observation"],
        outOfScope: ["File writes", "External API calls"]
      };
  }
}

async function runCanaryTest(risk: RiskLevel): Promise<CanaryResult> {
  const policy = await loadPolicyFromFile("./routing-policy.yaml");
  const checkpointStore = createFileCheckpointLedgerStore({ basePath: join(TEST_BASE_PATH, "checkpoints") });
  const observationStore = createFileExecutionObservationStore({ basePath: join(TEST_BASE_PATH, "observations") });

  const task = parseTaskEnvelope({
    taskId: `canary-${risk}-${Date.now()}`,
    source: "cli",
    intent: buildIntent(risk),
    repoContext: { repoRoot: process.cwd() },
    target: {
      branches: [],
      files: risk === "low" ? ["package.json"] : [],
      modules: []
    },
    constraints: {},
    hints: {
      riskHints: risk === "high" ? ["external_api", "production"] : risk === "medium" ? ["file_write"] : [],
      tags: ["canary", risk]
    }
  });

  try {
    const result = await runDesktopDecisionWithGovernance({
      task,
      policy,
      preflight: {
        authAvailable: true,
        availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
      },
      now: () => new Date().toISOString()
    });

    const phase = result.governanceState.phase;
    const riskLevel = result.governanceState.risk.finalRiskLevel;
    const actionFamily = result.strategyDecision.actionFamily;
    const verificationIntensity = result.strategyDecision.verificationIntensity;

    // Persist checkpoint
    await checkpointStore.record({
      checkpointId: `${task.taskId}:canary`,
      taskId: task.taskId,
      branchId: "main",
      stage: phase,
      governanceStateRef: result.governanceState.taskId,
      createdAt: new Date().toISOString()
    });

    // Persist observation
    await observationStore.emit({
      observationId: `${task.taskId}:canary:obs`,
      taskId: task.taskId,
      primitiveId: "canary_test",
      stage: "canary",
      status: "succeeded",
      signals: {},
      createdAt: new Date().toISOString()
    });

    // Verify persistence
    const storedCheckpoint = await checkpointStore.findLatestForTask(task.taskId);
    const storedObservations = await observationStore.findByTaskId(task.taskId);

    return {
      status: "passed",
      taskId: task.taskId,
      governancePhase: phase,
      riskLevel,
      actionFamily,
      verificationIntensity,
      checkpointPersisted: storedCheckpoint != null,
      observationPersisted: storedObservations.length > 0,
      requiresArbitration: actionFamily === "step_back" || actionFamily === "abort"
    };
  } catch (err) {
    return {
      status: "failed",
      taskId: task.taskId,
      governancePhase: "unknown",
      riskLevel: "unknown",
      actionFamily: "unknown",
      verificationIntensity: "unknown",
      checkpointPersisted: false,
      observationPersisted: false,
      requiresArbitration: false,
      error: err instanceof Error ? err.message : String(err)
    };
  } finally {
    await rm(TEST_BASE_PATH, { recursive: true, force: true }).catch(() => {});
  }
}

async function main(): Promise<void> {
  const risk = parseRiskArg();
  console.log("=== Codex CLI Canary Test ===");
  console.log(`Risk Level: ${risk}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("");

  const result = await runCanaryTest(risk);

  console.log(`Task ID:              ${result.taskId}`);
  console.log(`Status:               ${result.status}`);
  console.log(`Governance Phase:     ${result.governancePhase}`);
  console.log(`Risk Level:           ${result.riskLevel}`);
  console.log(`Action Family:        ${result.actionFamily}`);
  console.log(`Verification:         ${result.verificationIntensity}`);
  console.log(`Checkpoint Persisted: ${result.checkpointPersisted}`);
  console.log(`Observation Persisted: ${result.observationPersisted}`);
  console.log(`Requires Arbitration: ${result.requiresArbitration}`);

  if (result.error) {
    console.log(`Error: ${result.error}`);
  }

  const write = await writeCanaryEvidence(risk, result);
  console.log("\nEvidence written to:");
  for (const evidencePath of write.paths) {
    console.log(`- ${evidencePath}`);
  }

  process.exitCode = result.status === "passed" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Canary test failed:", err);
    process.exitCode = 1;
  });
}
