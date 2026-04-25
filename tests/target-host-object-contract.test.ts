import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCodexDesktopTargetHostObjectContract,
  createCodexDesktopTargetHostObjectContract,
  inspectCodexDesktopTargetHostObjectContract
} from "../packages/host-client-example/src/target-host-object-contract.js";

test("target host object contract template reports unwired placeholder methods", () => {
  const host = createCodexDesktopTargetHostObjectContract();
  const inspection = inspectCodexDesktopTargetHostObjectContract(host);

  assert.equal(inspection.ready, false);
  assert.deepEqual(inspection.missingMethods, []);
  assert.deepEqual(inspection.placeholderMethods, [
    "read_thread_terminal",
    "spawn_agent",
    "wait_agent",
    "send_input",
    "close_agent",
    "shell_command",
    "apply_patch",
    "automation_update",
    "record_memory",
    "search_memory"
  ]);
  assert.equal(inspection.supportsMemoryOverview, false);
  assert.throws(
    () => assertCodexDesktopTargetHostObjectContract(host),
    /codex_desktop_target_host_contract_unwired_methods:read_thread_terminal,spawn_agent,wait_agent,send_input,close_agent,shell_command,apply_patch,automation_update,record_memory,search_memory/
  );
});

test("target host object contract template becomes ready after required methods are wired", () => {
  const host = createCodexDesktopTargetHostObjectContract({
    read_thread_terminal() {
      return "terminal snapshot";
    },
    spawn_agent() {
      return { agentId: "agent-1" };
    },
    wait_agent() {
      return { status: "completed" };
    },
    send_input() {
      return { id: "message-1" };
    },
    close_agent() {
      return { status: "completed" };
    },
    shell_command() {
      return { exitCode: 0 };
    },
    apply_patch() {
      return { changedFiles: 1 };
    },
    automation_update() {
      return { status: "ACTIVE" };
    },
    record_memory() {
      return {
        success: true,
        memoryId: "memory-1",
        filePath: "memory://memory-1"
      };
    },
    search_memory() {
      return {
        results: []
      };
    }
  });
  const inspection = inspectCodexDesktopTargetHostObjectContract(host);

  assert.equal(inspection.ready, true);
  assert.deepEqual(inspection.placeholderMethods, []);
  assert.deepEqual(inspection.missingMethods, []);
  assert.doesNotThrow(() => assertCodexDesktopTargetHostObjectContract(host));
});
