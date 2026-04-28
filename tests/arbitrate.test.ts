import test from "node:test";
import assert from "node:assert/strict";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SCRIPT_PATH = join(__dirname, "..", "scripts", "arbitrate.ts");

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

function runCli(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = exec(`npx tsx ${SCRIPT_PATH} ${args.join(" ")}`, {
      cwd: join(__dirname, "..")
    });
    let output = "";
    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });
    proc.on("exit", () => resolve(output));
  });
}
