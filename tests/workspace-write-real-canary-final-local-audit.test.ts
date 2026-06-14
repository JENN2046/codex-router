import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS,
  formatWorkspaceWriteRealCanaryFinalLocalAuditResult,
  runWorkspaceWriteRealCanaryFinalLocalAudit,
  type WorkspaceWriteRealCanaryFinalLocalAuditCommand
} from "../scripts/run-workspace-write-real-canary-final-local-audit.js";

const expectedFinalLocalAuditCommands = [
  {
    id: "typecheck",
    args: ["run", "typecheck"]
  },
  {
    id: "workspace-write-guard-tests",
    args: ["tsx", "--test", "tests\\workspace-write-guard.test.ts"]
  },
  {
    id: "real-canary-authorization-acceptance-tests",
    args: ["tsx", "--test", "tests\\workspace-write-real-canary-authorization-acceptance.test.ts"]
  },
  {
    id: "real-canary-pre-execution-acceptance-tests",
    args: ["tsx", "--test", "tests\\workspace-write-real-canary-pre-execution-acceptance.test.ts"]
  },
  {
    id: "real-canary-candidate-consistency-tests",
    args: ["tsx", "--test", "tests\\workspace-write-real-canary-local-candidate-consistency.test.ts"]
  },
  {
    id: "real-canary-authorization-acceptance",
    args: ["run", "acceptance:workspace-write-real-canary-auth"]
  },
  {
    id: "real-canary-pre-execution-acceptance",
    args: ["run", "acceptance:workspace-write-real-canary-pre-execution"]
  },
  {
    id: "real-canary-candidate-audit-json",
    args: ["run", "audit:workspace-write-real-canary-candidate", "--", "--json"]
  }
] as const;

const requiredPackageScripts = [
  "typecheck",
  "acceptance:workspace-write-real-canary-auth",
  "acceptance:workspace-write-real-canary-pre-execution",
  "audit:workspace-write-real-canary-candidate",
  "audit:workspace-write-real-canary-final-local"
] as const;

test("workspace-write real canary final local audit runs the fixed local validation set", async () => {
  const seen: string[] = [];
  const result = await runWorkspaceWriteRealCanaryFinalLocalAudit({
    runner: async (command) => {
      seen.push(command.id);
      return passed(command);
    },
    canaryFileExists: () => false
  });

  assert.equal(result.status, "passed");
  assert.equal(result.checks.allCommandsPassed, true);
  assert.equal(result.checks.canaryFileAbsent, true);
  assert.equal(result.checks.noProviderExecute, true);
  assert.equal(result.checks.noRealCodexCli, true);
  assert.equal(result.checks.noWorkspaceWriteExecute, true);
  assert.deepEqual(
    seen,
    WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS.map((command) => command.id)
  );
  assert.equal(result.summary.providerExecuteCalls, 0);
  assert.equal(result.summary.realCodexCliCalls, 0);
  assert.equal(result.summary.workspaceWriteExecuteCalls, 0);
  assert.deepEqual(result.reasons, []);
});

test("workspace-write real canary final local audit command contract is explicit", async () => {
  assert.deepEqual(
    WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS.map((command) => ({
      id: command.id,
      args: command.args
    })),
    expectedFinalLocalAuditCommands
  );

  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, unknown>;
  };

  for (const scriptName of requiredPackageScripts) {
    assert.equal(
      typeof packageJson.scripts?.[scriptName],
      "string",
      `${scriptName} must remain available for the final local audit chain`
    );
  }
});

test("workspace-write real canary final local audit stops on first failed command", async () => {
  const seen: string[] = [];
  const result = await runWorkspaceWriteRealCanaryFinalLocalAudit({
    runner: async (command) => {
      seen.push(command.id);
      if (command.id === "workspace-write-guard-tests") {
        return {
          id: command.id,
          status: "failed",
          exitCode: 1
        };
      }
      return passed(command);
    },
    canaryFileExists: () => false
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(seen, ["typecheck", "workspace-write-guard-tests"]);
  assert.equal(result.summary.failedCommandCount, 1);
  assert.ok(result.reasons.includes(
    "workspace_write_real_canary_final_local_audit_command_failed"
  ));
});

test("workspace-write real canary final local audit blocks if canary file exists", async () => {
  const result = await runWorkspaceWriteRealCanaryFinalLocalAudit({
    runner: async (command) => passed(command),
    canaryFileExists: () => true
  });

  assert.equal(result.status, "failed");
  assert.equal(result.checks.canaryFileAbsent, false);
  assert.ok(result.reasons.includes(
    "workspace_write_real_canary_final_local_audit_canary_file_exists"
  ));
});

test("workspace-write real canary final local audit output is summarized", async () => {
  const result = await runWorkspaceWriteRealCanaryFinalLocalAudit({
    runner: async (command) => passed(command),
    canaryFileExists: () => false
  });
  const output = formatWorkspaceWriteRealCanaryFinalLocalAuditResult(result);

  assert.match(output, /status: passed/);
  assert.match(output, /provider execute calls: 0/);
  assert.equal(output.includes("stdout"), false);
  assert.equal(output.includes("stderr"), false);
  assert.equal(output.includes("prompt"), false);
  assert.equal(output.includes("args"), false);
});

test("workspace-write real canary final local audit json output is sanitized", async () => {
  const result = await runWorkspaceWriteRealCanaryFinalLocalAudit({
    runner: async (command) => passed(command),
    canaryFileExists: () => false
  });
  const output = formatWorkspaceWriteRealCanaryFinalLocalAuditResult(result, "json");
  const parsed = JSON.parse(output) as typeof result;

  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.commandCount, WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS.length);
  assert.equal(parsed.summary.failedCommandCount, 0);
  assert.equal(parsed.summary.providerExecuteCalls, 0);
  assert.equal(parsed.summary.realCodexCliCalls, 0);
  assert.equal(parsed.summary.workspaceWriteExecuteCalls, 0);
  assert.deepEqual(
    parsed.commands.map((command) => Object.keys(command).sort()),
    parsed.commands.map(() => ["exitCode", "id", "status"])
  );

  for (const marker of [
    "prompt",
    "args",
    "stdout",
    "stderr",
    "raw command",
    "raw task envelope",
    "raw env",
    "raw token",
    "raw patch",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer"
  ]) {
    assert.equal(output.includes(marker), false, `json output must omit ${marker}`);
  }
});

function passed(
  command: WorkspaceWriteRealCanaryFinalLocalAuditCommand
) {
  return {
    id: command.id,
    status: "passed" as const,
    exitCode: 0
  };
}
