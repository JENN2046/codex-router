import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import {
  runCodexCliReadOnlySmoke,
  runCodexCliWorkspaceWriteSmoke,
  DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL
} from "../packages/codex-cli-host/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { runDesktopDecisionWithGovernance } from "../packages/desktop-decision-runner/src/index.js";
import { fileURLToPath as _fileURLToPath } from "node:url";

const __dirname = dirname(_fileURLToPath(import.meta.url));

const evidencePath = process.env.CODEX_CLI_GOVERNANCE_EVIDENCE_PATH
  ?? "docs/evidence/codex-cli-governance-integration-latest.json";

const model = process.env.CODEX_CLI_MODEL ?? DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL;

async function main(): Promise<void> {
  console.log("=== Codex CLI Governance Integration Test ===");
  console.log(`Model: ${model}`);
  console.log(`Evidence: ${evidencePath}`);

  const policy = await loadPolicyFromFile("./routing-policy.yaml");

  // Test 1: Low risk task with governance
  console.log("\n--- Test 1: Low risk task ---");
  const lowRiskTask = parseTaskEnvelope({
    taskId: "governance-integration-low-risk",
    source: "cli",
    intent: {
      summary: "List files in current directory",
      requestedAction: "run ls command to list files",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: process.cwd() },
    target: { branches: [], files: [], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const lowRiskResult = await runDesktopDecisionWithGovernance({
    task: lowRiskTask,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal"]
    },
    now: () => new Date().toISOString()
  });

  console.log(`Low risk task status: ${lowRiskResult.base.status}`);
  console.log(`Governance phase: ${lowRiskResult.governanceState.phase}`);
  console.log(`Risk level: ${lowRiskResult.governanceState.risk.finalRiskLevel}`);
  console.log(`Strategy: ${lowRiskResult.strategyDecision.actionFamily}`);

  // Test 2: Verify governance state is consistent
  console.log("\n--- Test 2: Governance consistency ---");
  const state = lowRiskResult.governanceState;
  const strategy = lowRiskResult.strategyDecision;

  const consistency = {
    taskIdMatch: state.taskId === lowRiskResult.base.task.taskId,
    strategyTaskIdMatch: strategy.taskId === lowRiskResult.base.task.taskId,
    lowRiskExecution: strategy.actionFamily === "execute",
    lightVerification: strategy.verificationIntensity === "light"
  };

  console.log(`Task ID match: ${consistency.taskIdMatch}`);
  console.log(`Strategy task ID match: ${consistency.strategyTaskIdMatch}`);
  console.log(`Low risk execution: ${consistency.lowRiskExecution}`);
  console.log(`Light verification: ${consistency.lightVerification}`);

  // Evidence
  const evidence = {
    schemaVersion: "codex-cli-governance-integration.v1",
    generatedAt: new Date().toISOString(),
    model,
    tests: {
      lowRiskTask: {
        status: lowRiskResult.base.status,
        governancePhase: state.phase,
        riskLevel: state.risk.finalRiskLevel,
        strategyAction: strategy.actionFamily,
        consistency
      }
    },
    summary: {
      allTestsPassed:
        consistency.taskIdMatch &&
        consistency.strategyTaskIdMatch &&
        consistency.lowRiskExecution &&
        consistency.lightVerification
    }
  };

  console.log("\n=== Summary ===");
  console.log(`All tests passed: ${evidence.summary.allTestsPassed}`);

  // Write evidence
  try {
    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
    console.log(`Evidence written to: ${evidencePath}`);
  } catch (err) {
    console.error("Failed to write evidence:", err);
  }

  // Exit code
  const passed = evidence.summary.allTestsPassed;
  process.exitCode = passed ? 0 : 1;
}

main().catch((err) => {
  console.error("Integration test failed:", err);
  process.exitCode = 1;
});
