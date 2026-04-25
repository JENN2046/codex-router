import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import type { TaskEnvelopeInput } from "../packages/contracts/src/index.js";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import {
  createCodexDesktopTargetHostLayerSkeleton
} from "../packages/host-client-example/src/target-host-layer-skeleton.js";
import {
  createCodexDesktopTargetHostObjectContract
} from "../packages/host-client-example/src/target-host-object-contract.js";

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
    target: { branches: [], files: ["packages/host-client-example/src/target-host-layer-skeleton.ts"], modules: [] },
    constraints: {},
    hints: { taskClassHint: "engineering", riskHints: [], tags: [] }
  };
}

test("target host layer skeleton wires a real current host object through the live host starter", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const shellCalls: unknown[] = [];
  const patchCalls: string[] = [];
  const telemetryStore = createRecordingTelemetrySink();
  const host = createCodexDesktopTargetHostObjectContract({
    read_thread_terminal() {
      return "terminal snapshot";
    },
    spawn_agent() {
      return { agentId: "agent-1" };
    },
    send_input() {
      return { id: "message-1" };
    },
    wait_agent() {
      return { status: "completed" };
    },
    close_agent() {
      return { status: "completed" };
    },
    automation_update() {
      return { status: "ACTIVE" };
    },
    shell_command(input) {
      shellCalls.push(input);
      return {
        exitCode: 0,
        stdout: "ok",
        stderr: ""
      };
    },
    apply_patch(input) {
      patchCalls.push(input);
      return {
        changedFiles: 1,
        summary: "patched"
      };
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
  const bundle = createCodexDesktopTargetHostLayerSkeleton({
    policy,
    anchor: "codex-router@target-host-layer-skeleton",
    host,
    directiveBuilders: {
      shellCommand() {
        return {
          command: "npm test -- target-host-layer-skeleton"
        };
      },
      applyPatch() {
        return "*** Begin Patch\n*** Add File: target-host-layer-skeleton.txt\n+ready\n*** End Patch\n";
      }
    },
    telemetryStore,
    now: () => "2026-04-23T17:30:00.000Z"
  });

  const result = await bundle.hostClient.run(createEngineeringTask("target-host-layer-skeleton"));

  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(shellCalls, [{
    command: "npm test -- target-host-layer-skeleton"
  }]);
  assert.equal(patchCalls[0], "*** Begin Patch\n*** Add File: target-host-layer-skeleton.txt\n+ready\n*** End Patch\n");
});

test("target host layer skeleton fails fast when contract placeholders are still unwired", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const host = createCodexDesktopTargetHostObjectContract({
    read_thread_terminal() {
      return "terminal snapshot";
    }
  });

  assert.throws(
    () => createCodexDesktopTargetHostLayerSkeleton({
      policy,
      anchor: "codex-router@target-host-layer-skeleton-unwired",
      host
    }),
    /codex_desktop_target_host_contract_unwired_methods:spawn_agent,wait_agent,send_input,close_agent,shell_command,apply_patch,automation_update,record_memory,search_memory/
  );
});
