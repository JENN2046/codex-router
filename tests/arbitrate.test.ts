import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runArbitrateCli } from "../scripts/arbitrate.js";

test("arbitrate CLI shows help with no arguments", async () => {
  const result = await runCli([]);
  assert.ok(result.includes("Usage:"));
  assert.ok(result.includes("Commands:"));
});

test("arbitrate CLI list command runs", async () => {
  const result = await runCli(["list"]);
  // Should either show tasks or "No tasks" message
  assert.ok(result.includes("Tasks") || result.includes("No tasks"));
});

test("arbitrate CLI show command handles missing task", async () => {
  const result = await runCli(["show"]);
  assert.ok(result.includes("Missing") || result.includes("Usage:"));
});

async function runCli(args: string[]): Promise<string> {
  const output: string[] = [];
  const previousLog = console.log;
  const previousError = console.error;
  const previousExitCode = process.exitCode;
  console.log = (...values: unknown[]) => output.push(values.map(String).join(" "));
  console.error = (...values: unknown[]) => output.push(values.map(String).join(" "));
  try {
    await runArbitrateCli(args, join(tmpdir(), "codex-router-arbitrate-test-missing"));
  } finally {
    console.log = previousLog;
    console.error = previousError;
    process.exitCode = previousExitCode;
  }
  return output.join("\n");
}
