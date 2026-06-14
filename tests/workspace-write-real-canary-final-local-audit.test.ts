import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS,
  formatWorkspaceWriteRealCanaryFinalLocalAuditResult,
  runWorkspaceWriteRealCanaryFinalLocalAudit,
  type WorkspaceWriteRealCanaryFinalLocalAuditCommand
} from "../scripts/run-workspace-write-real-canary-final-local-audit.js";

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

function passed(
  command: WorkspaceWriteRealCanaryFinalLocalAuditCommand
) {
  return {
    id: command.id,
    status: "passed" as const,
    exitCode: 0
  };
}
