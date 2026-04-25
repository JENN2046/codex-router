import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import type { TaskEnvelopeInput } from "../packages/contracts/src/index.js";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { createCodexDesktopTargetHostEmbeddingStarter } from "../packages/host-client-example/src/target-host-embedding-starter.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

function createEngineeringTask(taskId: string): TaskEnvelopeInput {
  return {
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "implement feature",
      requestedAction: "make multi-file engineering changes and validate them",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/host-client-example/src/target-host-embedding-starter.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "engineering", riskHints: [], tags: [] }
  };
}

test("target host embedding starter exposes a scaffold with live readiness inspection", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const starter = createCodexDesktopTargetHostEmbeddingStarter({
    policy,
    anchor: "codex-router@target-host-embedding-starter"
  });

  const inspection = starter.inspect();
  const status = starter.getStatus();

  assert.equal(inspection.ready, false);
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
  assert.equal(status.ready, false);
  assert.deepEqual(status.wiredRuntimeMethods, []);
  assert.deepEqual(status.wiredMemoryMethods, []);
  assert.deepEqual(status.pendingRequiredMethods, [
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
  assert.deepEqual(status.pendingOptionalMethods, [
    "memory_overview"
  ]);
  assert.equal(status.nextAction, "wire_required_methods");
  assert.throws(
    () => starter.createBundle(),
    /codex_desktop_target_host_contract_unwired_methods:read_thread_terminal,spawn_agent,wait_agent,send_input,close_agent,shell_command,apply_patch,automation_update,record_memory,search_memory/
  );
});

test("target host embedding starter can create a bundle after the scaffold is wired", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const shellCalls: unknown[] = [];
  const patchCalls: string[] = [];
  const telemetryStore = createRecordingTelemetrySink();
  const starter = createCodexDesktopTargetHostEmbeddingStarter({
    policy,
    anchor: "codex-router@target-host-embedding-starter-wired",
    directiveBuilders: {
      shellCommand() {
        return {
          command: "npm test -- target-host-embedding-starter"
        };
      },
      applyPatch() {
        return "*** Begin Patch\n*** Add File: target-host-embedding-starter.txt\n+ready\n*** End Patch\n";
      }
    },
    telemetryStore,
    now: () => "2026-04-23T17:55:00.000Z"
  });

  starter.host.read_thread_terminal = () => "terminal snapshot";
  starter.host.spawn_agent = () => ({ agentId: "agent-1" });
  starter.host.wait_agent = () => ({ status: "completed" });
  starter.host.send_input = () => ({ id: "message-1" });
  starter.host.close_agent = () => ({ status: "completed" });
  starter.host.automation_update = () => ({ status: "ACTIVE" });
  starter.host.shell_command = (input) => {
    shellCalls.push(input);
    return {
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    };
  };
  starter.host.apply_patch = (input) => {
    patchCalls.push(input);
    return {
      changedFiles: 1,
      summary: "patched"
    };
  };
  starter.host.record_memory = () => ({
    success: true,
    memoryId: "memory-1",
    filePath: "memory://memory-1"
  });
  starter.host.search_memory = () => ({
    results: []
  });

  assert.equal(starter.inspect().ready, true);
  assert.deepEqual(starter.getStatus(), {
    ready: true,
    wiredRuntimeMethods: [
      "read_thread_terminal",
      "spawn_agent",
      "wait_agent",
      "send_input",
      "close_agent",
      "shell_command",
      "apply_patch",
      "automation_update"
    ],
    wiredMemoryMethods: [
      "record_memory",
      "search_memory"
    ],
    pendingRequiredMethods: [],
    pendingOptionalMethods: [
      "memory_overview"
    ],
    placeholderMethods: [],
    nextAction: "create_bundle"
  });
  assert.doesNotThrow(() => starter.assertReady());

  const bundle = starter.createBundle();
  const result = await bundle.hostClient.run(
    createEngineeringTask("target-host-embedding-starter")
  );

  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(shellCalls, [{
    command: "npm test -- target-host-embedding-starter"
  }]);
  assert.equal(
    patchCalls[0],
    "*** Begin Patch\n*** Add File: target-host-embedding-starter.txt\n+ready\n*** End Patch\n"
  );
});
