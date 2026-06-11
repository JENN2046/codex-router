import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { dispatchToHost } from "../packages/host-dispatcher/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

test("host dispatcher blocks codex-cli routing without verified runner result", async () => {
  let spawned = false;

  const result = await dispatchToHost(({
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn should not be called");
      }
    }
  } as unknown) as Parameters<typeof dispatchToHost>[0]);

  assert.equal(result.hostRoute, "codex-cli");
  assert.equal(result.cliError, "host_dispatcher_requires_verified_runner_result");
  assert.equal(spawned, false);
});

test("host dispatcher allows codex-cli routing with ready runner result", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createReadOnlyTask("host-dispatcher-verified");
  const runnerResult = await runDesktopDecision({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    now: () => "2026-06-11T00:00:00.000Z"
  });
  let spawned = false;

  assert.equal(runnerResult.status, "ready");
  assert.equal(runnerResult.preflight.ok, true);

  const result = await dispatchToHost({
    runnerResult,
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn sentinel");
      }
    }
  });

  assert.equal(result.hostRoute, "codex-cli");
  assert.equal(spawned, true);
  assert.equal(result.cliRun?.error, "spawn sentinel");
});

test("host dispatcher builds codex-cli plan from verified runner result only", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createReadOnlyTask("host-dispatcher-runner-source");
  const runnerResult = await runDesktopDecision({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    now: () => "2026-06-11T00:00:00.000Z"
  });
  const untrustedTask = createReadOnlyTask("host-dispatcher-untrusted-task");
  let spawned = false;

  assert.equal(runnerResult.status, "ready");

  const result = await dispatchToHost({
    runnerResult,
    task: untrustedTask,
    decision: {
      ...runnerResult.decision,
      taskId: untrustedTask.taskId
    },
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn sentinel");
      }
    }
  } as Parameters<typeof dispatchToHost>[0] & {
    task: typeof untrustedTask;
    decision: typeof runnerResult.decision;
  });

  assert.equal(result.hostRoute, "codex-cli");
  assert.equal(spawned, true);
  assert.equal(result.cliPlan?.task.taskId, runnerResult.task.taskId);
  assert.equal(
    result.cliPlan?.task.intent.requestedAction,
    runnerResult.task.intent.requestedAction
  );
  assert.notEqual(result.cliPlan?.task.taskId, untrustedTask.taskId);
});

test("host dispatcher preserves ready desktop routing", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = createEngineeringTask("host-dispatcher-desktop");
  const runnerResult = await runDesktopDecision({
    task,
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "shell_command",
        "apply_patch",
        "read_thread_terminal",
        "send_input"
      ],
      memoryOverview: {
        adapterStatus: {
          codexMcp: "disabled"
        },
        summary: {
          rejected: 0
        },
        shadowSync: {
          reconcileCount: 0
        },
        recall: {
          available: true,
          status: "active"
        }
      }
    },
    now: () => "2026-06-11T00:00:00.000Z"
  });
  let spawned = false;

  assert.equal(runnerResult.status, "ready");
  assert.equal(runnerResult.decision.hostRoute, "desktop");

  const result = await dispatchToHost({
    runnerResult,
    codexCliOptions: {
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn should not be called");
      }
    }
  });

  assert.equal(result.hostRoute, "desktop");
  assert.equal(result.cliPlan, undefined);
  assert.equal(result.cliRun, undefined);
  assert.equal(result.cliError, undefined);
  assert.equal(spawned, false);
});

function createReadOnlyTask(taskId: string) {
  return parseTaskEnvelope({
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "review current config",
      requestedAction: "inspect and summarize routing policy",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });
}

function createEngineeringTask(taskId: string) {
  return parseTaskEnvelope({
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "implement package",
      requestedAction: "add multi-file TypeScript changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: { branches: [], files: ["packages/contracts/src/index.ts"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });
}
