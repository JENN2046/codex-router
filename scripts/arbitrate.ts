#!/usr/bin/env node
/**
 * CLI Arbitration Tool - codex-router arbitrate
 *
 * Usage:
 *   npx tsx scripts/arbitrate.ts <taskId> [options]
 *
 * Options:
 *   --list          List all tasks with pending arbitration
 *   --show          Show full arbitration packet for a task
 *   --decide        Make a decision (resume|rollback|abort|fork)
 *   --help          Show help
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_BASE_PATH = join(__dirname, "..", ".checkpoint-ledger");

// ── Types ────────────────────────────────────────────────────────────────────

interface ArbitrationPacket {
  packetId: string;
  taskId: string;
  trigger: "first_anomaly" | "second_anomaly" | "third_anomaly" | "manual";
  currentState: unknown;
  rawEvidenceRefs: string[];
  conflictingSignals: string[];
  availableActions: Array<"resume" | "rollback" | "abort" | "fork">;
  recommendation?: string;
  probabilityPredictionAllowed: false;
  createdAt: string;
}

interface CheckpointLedgerEntry {
  checkpointId: string;
  taskId: string;
  branchId: string;
  stage: string;
  governanceStateRef: string;
  reversibleActions: unknown[];
  irreversibleActions: unknown[];
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function listTasks(basePath: string): Promise<string[]> {
  try {
    const files = await readdir(basePath);
    return files
      .filter(f => f.endsWith(".jsonl"))
      .map(f => f.replace(".jsonl", ""));
  } catch {
    return [];
  }
}

async function loadTaskEntries(basePath: string, taskId: string): Promise<CheckpointLedgerEntry[]> {
  const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filePath = join(basePath, `${safeTaskId}.jsonl`);
  try {
    const content = await readFile(filePath, "utf-8");
    return content
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line)) as CheckpointLedgerEntry[];
  } catch {
    return [];
  }
}

function formatArbitrationPacket(packet: ArbitrationPacket): string {
  const lines = [
    "",
    "╔═══════════════════════════════════════════════════════════╗",
    "║           ARBITRATION PACKET                              ║",
    "╠═══════════════════════════════════════════════════════════╣",
    `║ Packet ID: ${packet.packetId.slice(0, 50).padEnd(49)}║`,
    `║ Task ID:   ${packet.taskId.padEnd(49)}║`,
    `║ Trigger:   ${packet.trigger.padEnd(49)}║`,
    `║ Created:   ${packet.createdAt.padEnd(49)}║`,
    "╠═══════════════════════════════════════════════════════════╣",
    "║ Available Actions: " + packet.availableActions.join(", ") + " ".repeat(Math.max(0, 28 - packet.availableActions.join(", ").length)) + "║",
    packet.recommendation ? `║ Recommendation: ${packet.recommendation.slice(0, 45).padEnd(45)}║` : "║ Recommendation: (none)".padEnd(52) + "║",
    "╠═══════════════════════════════════════════════════════════╣",
    "║ Evidence References:                                      ║",
    ...packet.rawEvidenceRefs.slice(0, 5).map(ref => `║   - ${ref.slice(0, 45).padEnd(45)}║`),
    "╚═══════════════════════════════════════════════════════════╝",
    "",
    "Usage:",
    "  npx tsx scripts/arbitrate.ts <task-id> --decide <action>",
    "",
    "Actions:",
    "  resume   - Continue execution from current state",
    "  rollback - Rollback to previous checkpoint",
    "  abort    - Terminate execution completely",
    "  fork     - Create new branch for parallel exploration",
    ""
  ];
  return lines.join("\n");
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdList(basePath: string): Promise<void> {
  const tasks = await listTasks(basePath);
  if (tasks.length === 0) {
    console.log("No tasks with checkpoints found.");
    return;
  }
  console.log("\nTasks with checkpoints:");
  for (const task of tasks) {
    console.log(`  - ${task}`);
  }
  console.log("");
}

async function cmdShow(basePath: string, taskId: string): Promise<void> {
  const entries = await loadTaskEntries(basePath, taskId);
  if (entries.length === 0) {
    console.log(`No checkpoints found for task: ${taskId}`);
    return;
  }

  const latest = entries[entries.length - 1]!;
  console.log(`\nLatest checkpoint for ${taskId}:`);
  console.log(`  Checkpoint ID: ${latest.checkpointId}`);
  console.log(`  Stage: ${latest.stage}`);
  console.log(`  Branch: ${latest.branchId}`);
  console.log(`  Created: ${latest.createdAt}`);
  console.log(`  Reversible actions: ${latest.reversibleActions.length}`);
  console.log(`  Irreversible actions: ${latest.irreversibleActions.length}`);
  console.log("");
}

async function cmdDecide(
  basePath: string,
  taskId: string,
  action: "resume" | "rollback" | "abort" | "fork"
): Promise<void> {
  const entries = await loadTaskEntries(basePath, taskId);
  if (entries.length === 0) {
    console.log(`No checkpoints found for task: ${taskId}`);
    process.exitCode = 1;
    return;
  }

  // Write decision to a decision file
  const decisionPath = join(basePath, `${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}.decision.json`);
  const decision = {
    taskId,
    action,
    decidedAt: new Date().toISOString(),
    status: "pending_review"
  };

  await writeFile(decisionPath, JSON.stringify(decision, null, 2), "utf-8");
  console.log(`\nDecision recorded: ${action}`);
  console.log(`Task: ${taskId}`);
  console.log(`Status: pending_review`);
  console.log(`Decision file: ${decisionPath}`);
  console.log("");
}

function cmdHelp(): void {
  console.log(`
codex-router arbitrate - CLI Arbitration Tool

Usage:
  npx tsx scripts/arbitrate.ts <command> [options]

Commands:
  list                List all tasks with checkpoints
  show <task-id>      Show latest checkpoint for a task
  decide <task-id>    Make a decision for a task
  help                Show this help message

Options:
  --decide <action>   Decision action (resume|rollback|abort|fork)
  --path <path>       Custom base path for checkpoint storage

Examples:
  npx tsx scripts/arbitrate.ts list
  npx tsx scripts/arbitrate.ts show my-task-123
  npx tsx scripts/arbitrate.ts decide my-task-123 --decide resume
  npx tsx scripts/arbitrate.ts decide my-task-123 --decide rollback
`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function runArbitrateCli(
  args: string[],
  basePath = process.env.CODEX_ROUTER_CHECKPOINT_PATH ?? DEFAULT_BASE_PATH
): Promise<void> {

  if (args.length === 0 || args.includes("help") || args.includes("--help")) {
    cmdHelp();
    return;
  }

  const command = args[0];

  if (command === "list") {
    await cmdList(basePath);
    return;
  }

  if (command === "show") {
    const taskId = args[1];
    if (!taskId) {
      console.error("Error: Missing task ID");
      console.error("Usage: npx tsx scripts/arbitrate.ts show <task-id>");
      process.exitCode = 1;
      return;
    }
    await cmdShow(basePath, taskId);
    return;
  }

  if (command === "decide") {
    const taskId = args[1];
    const decideIndex = args.indexOf("--decide");
    const action = decideIndex >= 0 ? args[decideIndex + 1] : args[2];

    if (!taskId || !action) {
      console.error("Error: Missing task ID or action");
      console.error("Usage: npx tsx scripts/arbitrate.ts decide <task-id> --decide <action>");
      process.exitCode = 1;
      return;
    }

    const validActions = ["resume", "rollback", "abort", "fork"];
    if (!validActions.includes(action)) {
      console.error(`Error: Invalid action "${action}"`);
      console.error(`Valid actions: ${validActions.join(", ")}`);
      process.exitCode = 1;
      return;
    }

    await cmdDecide(basePath, taskId, action as any);
    return;
  }

  // Legacy: direct task ID as first argument
  const taskId = args[0]!;
  const showDecision = args.includes("--show");
  const decideMatch = args.indexOf("--decide");
  const action = decideMatch >= 0 ? args[decideMatch + 1] : null;

  if (action) {
    await cmdDecide(basePath, taskId, action as any);
    return;
  }

  if (showDecision) {
    await cmdShow(basePath, taskId);
    return;
  }

  cmdHelp();
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  runArbitrateCli(process.argv.slice(2)).catch((err) => {
    console.error("Error:", err);
    process.exitCode = 1;
  });
}
