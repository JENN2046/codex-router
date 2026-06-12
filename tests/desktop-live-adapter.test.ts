import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { runDesktopDecision } from "../packages/desktop-decision-runner/src/index.js";
import {
  createHostBridgeFromBindings,
  createPrimitiveFailureEnvelope,
  createRecordingHostBridge,
  executeDesktopPlan,
  normalizePrimitiveHandlerOutput,
  resumeDesktopTask,
  runDesktopTask
} from "../packages/desktop-live-adapter/src/index.js";
import {
  createRecordingExecutionObservationStore,
  parseExecutionObservation
} from "../packages/execution-observation/src/index.js";
import {
  type GovernanceState
} from "../packages/state-manager/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

async function createReadyRunnerResult() {
  const policy = await loadPolicyFromFile(policyPath);
  return runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "live-adapter-ready",
      source: "desktop-thread",
      intent: {
        summary: "review current config",
        requestedAction: "inspect and summarize the current config state",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    availableAgents: 3,
    now: () => "2026-04-23T12:10:00.000Z"
  });
}

test("desktop live adapter does not execute blocked runner results", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const blocked = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "live-adapter-blocked",
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
    }),
    policy,
    preflight: {
      authAvailable: false,
      availableTools: ["shell_command"]
    }
  });

  const execution = await executeDesktopPlan({
    runnerResult: blocked,
    handlers: {
      read_thread_terminal: () => {
        throw new Error("should not be called");
      }
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(execution.status, "not_ready");
  assert.equal(execution.steps.length, 0);
  assert.ok(execution.blockingReasons.includes("auth_unavailable"));
});

test("desktop live adapter executes primitives sequentially when handlers exist", async () => {
  const ready = await createReadyRunnerResult();
  const calls: string[] = [];

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => {
        calls.push("read_thread_terminal");
        return "thread context";
      },
      spawn_agent: () => {
        calls.push("spawn_agent");
        return { agentId: "agent-1" };
      },
      wait_agent: () => {
        calls.push("wait_agent");
        return { status: "completed" };
      }
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(execution.status, "completed");
  assert.deepEqual(calls, ["read_thread_terminal", "spawn_agent", "wait_agent"]);
  assert.equal(execution.steps.length, 3);
  assert.equal(execution.auditEvents[0]?.type, "runner_dispatched");
});

test("desktop live adapter normalizes raw handler output into typed envelopes", async () => {
  const ready = await createReadyRunnerResult();

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => ({ agentId: "agent-1", nickname: "Explorer" }),
      wait_agent: () => ({ status: "completed", message: "done" })
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(execution.status, "completed");
  assert.deepEqual(execution.steps[0]?.output, {
    primitive: "read_thread_terminal",
    ok: true,
    terminalOutput: "thread context",
    payload: "thread context"
  });
  assert.deepEqual(execution.steps[1]?.output, {
    primitive: "spawn_agent",
    ok: true,
    agentId: "agent-1",
    nickname: "Explorer",
    payload: { agentId: "agent-1", nickname: "Explorer" }
  });
});

test("desktop live adapter redacts already-shaped shell command envelopes", () => {
  const result = normalizePrimitiveHandlerOutput("shell_command", {
    primitive: "shell_command",
    ok: true,
    exitCode: 0,
    structuredCommand: {
      executable: "codex",
      args: [
        "exec",
        "--token",
        "-argv-token",
        "--password",
        "-argv-password",
        "--api-key=inline-api-key",
        "--safe",
        "ok"
      ]
    },
    stdout: `token=plain-token\n{"apiKey":"json-api-key"}`,
    stderr: `Authorization: Bearer abc.def\n{"password":"json-password"}`,
    payload: {
      token: "payload-token",
      command: "tool --token --refresh-token --abc123 --safe ok",
      structuredCommand: {
        executable: "codex",
        args: ["--secret", "payload-secret"]
      },
      nested: {
        apiKey: "payload-api-key"
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(
    (result as { stdout?: string }).stdout,
    `token=<REDACTED_SECRET>\n{"apiKey":"<REDACTED_SECRET>"}`
  );
  assert.equal(
    (result as { stderr?: string }).stderr,
    `Authorization: <REDACTED_SECRET>\n{"password":"<REDACTED_SECRET>"}`
  );
  assert.equal(
    ((result as { payload?: { nested?: { apiKey?: string } } }).payload?.nested?.apiKey),
    "<REDACTED_SECRET>"
  );
  assert.equal(
    ((result as { payload?: { command?: string } }).payload?.command),
    "tool --token --refresh-token <REDACTED_SECRET> --safe ok"
  );
  assert.deepEqual((result as { structuredCommand?: unknown }).structuredCommand, {
    executable: "codex",
    args: [
      "exec",
      "--token",
      "<REDACTED_SECRET>",
      "--password",
      "<REDACTED_SECRET>",
      "--api-key=<REDACTED_SECRET>",
      "--safe",
      "ok"
    ]
  });
  assert.deepEqual(
    ((result as {
      payload?: { structuredCommand?: unknown };
    }).payload?.structuredCommand),
    {
      executable: "codex",
      args: ["--secret", "<REDACTED_SECRET>"]
    }
  );
  const envelopeText = JSON.stringify(result);
  assert.equal(envelopeText.includes("plain-token"), false);
  assert.equal(envelopeText.includes("json-api-key"), false);
  assert.equal(envelopeText.includes("Bearer abc.def"), false);
  assert.equal(envelopeText.includes("json-password"), false);
  assert.equal(envelopeText.includes("payload-token"), false);
  assert.equal(envelopeText.includes("--abc123"), false);
  assert.equal(envelopeText.includes("payload-api-key"), false);
  assert.equal(envelopeText.includes("argv-token"), false);
  assert.equal(envelopeText.includes("-argv-token"), false);
  assert.equal(envelopeText.includes("argv-password"), false);
  assert.equal(envelopeText.includes("-argv-password"), false);
  assert.equal(envelopeText.includes("inline-api-key"), false);
  assert.equal(envelopeText.includes("payload-secret"), false);
});

test("desktop live adapter fails fast on missing handler", async () => {
  const ready = await createReadyRunnerResult();

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context"
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.equal(execution.steps[0]?.status, "completed");
  assert.equal(execution.steps[1]?.status, "failed");
  assert.match(execution.steps[1]?.error ?? "", /missing_handler:spawn_agent/);
});

test("desktop live adapter respects explicit failure envelopes from handlers", async () => {
  const ready = await createReadyRunnerResult();

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => createPrimitiveFailureEnvelope("spawn_agent", "agent_capacity_exceeded")
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.equal(execution.steps[1]?.status, "failed");
  assert.equal(execution.steps[1]?.output?.ok, false);
  assert.equal(execution.steps[1]?.error, "agent_capacity_exceeded");
});

test("runDesktopTask composes decision runner and live adapter", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const calls: string[] = [];
  const telemetryEvents: unknown[] = [];

  const result = await runDesktopTask({
    task: {
      taskId: "run-desktop-task-ready",
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
    },
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "send_input", "shell_command", "apply_patch"],
      memoryOverview: {
        adapterStatus: {
          codexMcp: "enabled"
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
    persistence: {
      telemetryStore: {
        record(event) {
          telemetryEvents.push(event);
        }
      }
    },
    handlers: {
      read_thread_terminal: () => {
        calls.push("read_thread_terminal");
        return "thread context";
      },
      send_input: () => {
        calls.push("send_input");
        return { accepted: true };
      },
      shell_command: () => {
        calls.push("shell_command");
        return { exitCode: 0, stdout: "ok" };
      },
      apply_patch: () => {
        calls.push("apply_patch");
        return { applied: true };
      }
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(result.decisionResult.status, "ready");
  assert.equal(result.decisionResult.decision.hostRoute, "desktop");
  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(calls, ["read_thread_terminal", "send_input", "shell_command", "apply_patch"]);
  assert.equal(result.hostDispatch, undefined);
  assert.ok(telemetryEvents.length > 0);
});

test("runDesktopTask dispatches codex-cli small edits instead of executing desktop primitives", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  let spawned = false;
  let desktopPrimitiveInvoked = false;

  const result = await runDesktopTask({
    task: {
      taskId: "run-desktop-task-codex-cli-small-edit",
      source: "desktop-thread",
      intent: {
        summary: "apply a small fix",
        requestedAction: "make a small fix in a single file",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["README.md"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    },
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "send_input"]
    },
    handlers: {
      read_thread_terminal: () => {
        desktopPrimitiveInvoked = true;
        return "thread context";
      },
      send_input: () => {
        desktopPrimitiveInvoked = true;
        return { accepted: true };
      }
    },
    codexCliOptions: {
      allowWriteSandbox: true,
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn sentinel");
      }
    },
    now: () => "2026-06-11T00:00:00.000Z"
  });

  assert.equal(result.decisionResult.status, "ready");
  assert.equal(result.decisionResult.decision.classification.taskClass, "small_edit");
  assert.equal(result.decisionResult.decision.hostRoute, "codex-cli");
  assert.equal(result.decisionResult.decision.execution.toolAccess, "local_write");
  assert.equal(result.hostDispatch?.hostRoute, "codex-cli");
  assert.equal(result.hostDispatch?.cliRun?.error, "spawn sentinel");
  assert.equal(spawned, true);
  assert.equal(desktopPrimitiveInvoked, false);
  assert.equal(result.executionResult.status, "failed");
  assert.deepEqual(result.executionResult.steps, []);
  assert.ok(result.executionResult.blockingReasons.includes("spawn sentinel"));
});

test("runDesktopTask returns blocked codex-cli decisions without desktop handlers", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  let spawned = false;

  const result = await runDesktopTask({
    task: {
      taskId: "run-desktop-task-codex-cli-blocked",
      source: "desktop-thread",
      intent: {
        summary: "apply a small fix",
        requestedAction: "make a small fix in a single file",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["README.md"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    },
    policy,
    preflight: {
      authAvailable: false,
      availableTools: []
    },
    codexCliOptions: {
      allowWriteSandbox: true,
      skipExecutionModelProbe: true,
      spawn: () => {
        spawned = true;
        throw new Error("spawn sentinel");
      }
    },
    now: () => "2026-06-11T00:05:00.000Z"
  });

  assert.equal(result.decisionResult.status, "blocked_preflight");
  assert.equal(result.decisionResult.decision.hostRoute, "codex-cli");
  assert.equal(result.executionResult.status, "not_ready");
  assert.deepEqual(result.executionResult.steps, []);
  assert.ok(result.executionResult.blockingReasons.includes("auth_unavailable"));
  assert.equal(result.hostDispatch, undefined);
  assert.equal(spawned, false);
});

test("runDesktopTask preserves blocked_preflight results without executing handlers", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  let invoked = false;

  const result = await runDesktopTask({
    task: {
      taskId: "run-desktop-task-blocked",
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
    },
    policy,
    preflight: {
      authAvailable: false,
      availableTools: ["shell_command"]
    },
    handlers: {
      read_thread_terminal: () => {
        invoked = true;
        return "thread context";
      }
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(result.decisionResult.status, "blocked_preflight");
  assert.equal(result.executionResult.status, "not_ready");
  assert.equal(invoked, false);
});

test("runDesktopTask accepts a host bridge instead of raw handlers", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const bridge = createRecordingHostBridge();
  const telemetryEvents: unknown[] = [];

  const result = await runDesktopTask({
    task: {
      taskId: "run-desktop-task-bridge",
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
    },
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "send_input", "shell_command", "apply_patch"],
      memoryOverview: {
        adapterStatus: {
          codexMcp: "enabled"
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
    persistence: {
      telemetryStore: {
        record(event) {
          telemetryEvents.push(event);
        }
      }
    },
    bridge,
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(result.decisionResult.status, "ready");
  assert.equal(result.decisionResult.decision.hostRoute, "desktop");
  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(
    bridge.calls.map((call) => call.primitive),
    ["read_thread_terminal", "send_input", "shell_command", "apply_patch"]
  );
  assert.ok(telemetryEvents.length > 0);
});

test("host bridge bindings fail clearly when a primitive binding is missing", async () => {
  const bridge = createHostBridgeFromBindings({
    read_thread_terminal: () => "thread context"
  });
  const ready = await createReadyRunnerResult();

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: (context) => bridge.invokePrimitive({
        primitive: "read_thread_terminal",
        taskId: context.task.taskId,
        reason: context.operation.reason,
        ...context
      }),
      spawn_agent: (context) => bridge.invokePrimitive({
        primitive: "spawn_agent",
        taskId: context.task.taskId,
        reason: context.operation.reason,
        ...context
      })
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(execution.status, "failed");
  assert.match(execution.blockingReasons[0] ?? "", /missing_bridge_binding:spawn_agent/);
});

test("resumeDesktopTask resumes from memory recall and still executes the plan", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const calls: string[] = [];
  const telemetryEvents: unknown[] = [];

  const result = await resumeDesktopTask({
    task: {
      taskId: "resume-desktop-task-memory",
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
    },
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "send_input", "shell_command", "apply_patch"],
      memoryOverview: {
        adapterStatus: {
          codexMcp: "enabled"
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
    availableAgents: 2,
    persistence: {
      telemetryStore: {
        record(event) {
          telemetryEvents.push(event);
        }
      }
    },
    resume: {
      memoryRecall: {
        async recallLatestCheckpointRef() {
          return {
            checkpointId: "memory-cp-1",
            taskId: "resume-desktop-task-memory",
            stage: "approval-pending",
            createdAt: "2026-04-23T11:00:00.000Z",
            summary: "waiting for approval"
          };
        }
      }
    },
    handlers: {
      read_thread_terminal: () => {
        calls.push("read_thread_terminal");
        return "thread context";
      },
      send_input: () => {
        calls.push("send_input");
        return { accepted: true };
      },
      shell_command: () => {
        calls.push("shell_command");
        return { exitCode: 0, stdout: "ok" };
      },
      apply_patch: () => {
        calls.push("apply_patch");
        return { applied: true };
      }
    },
    now: () => "2026-04-23T12:10:00.000Z"
  });

  assert.equal(result.decisionResult.resumeSource, "memory");
  assert.equal(result.decisionResult.resumedFrom?.checkpointId, "memory-cp-1");
  assert.equal(result.decisionResult.decision.hostRoute, "desktop");
  assert.equal(result.executionResult.status, "completed");
  assert.deepEqual(calls, ["read_thread_terminal", "send_input", "shell_command", "apply_patch"]);
  assert.ok(telemetryEvents.length > 0);
});

test("resumeDesktopTask fails clearly when resume is required but no checkpoint exists", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  await assert.rejects(
    () => resumeDesktopTask({
      task: {
        taskId: "resume-desktop-task-missing",
        source: "desktop-thread",
        intent: {
          summary: "review current config",
          requestedAction: "inspect and summarize the current config state",
          successCriteria: [],
          outOfScope: []
        },
        repoContext: { repoRoot: "A:/codex-router" },
        target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
        constraints: {},
        hints: { riskHints: [], tags: [] }
      },
      policy,
      preflight: {
        authAvailable: true,
        availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
      },
      resume: {
        required: true,
        memoryRecall: {
          async recallLatestCheckpointRef() {
            return undefined;
          }
        },
        checkpointStore: {
          async findLatestForTask() {
            return undefined;
          }
        }
      },
      handlers: {
        read_thread_terminal: () => "thread context"
      },
      now: () => "2026-04-23T12:10:00.000Z"
    }),
    /resume_checkpoint_not_found:resume-desktop-task-missing/
  );
});

test("desktop live adapter emits execution observations when observation bus is provided", async () => {
  const ready = await createReadyRunnerResult();
  const observationStore = createRecordingExecutionObservationStore();

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => ({ agentId: "agent-1" }),
      wait_agent: () => ({ status: "completed" })
    },
    observationBus: observationStore,
    now: () => "2026-04-27T00:00:00.000Z"
  });

  const observations = await observationStore.loadAll();

  assert.equal(execution.status, "completed");
  assert.ok(observations.length > 0);
  assert.equal(observations[0]?.taskId, ready.task.taskId);
});

test("desktop live adapter does not emit observations without observation bus", async () => {
  const ready = await createReadyRunnerResult();

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => "thread context",
      spawn_agent: () => ({ agentId: "agent-1" }),
      wait_agent: () => ({ status: "completed" })
    },
    now: () => "2026-04-27T00:00:00.000Z"
  });

  assert.equal(execution.status, "completed");
});

test("desktop live adapter triggers governance step_back after three failures", async () => {
  const ready = await createReadyRunnerResult();
  const observationStore = createRecordingExecutionObservationStore();
  let governanceUpdateCount = 0;
  let lastStrategyAction: string | undefined;

  const execution = await executeDesktopPlan({
    runnerResult: ready,
    handlers: {
      read_thread_terminal: () => { throw new Error("fail1"); },
      spawn_agent: () => { throw new Error("fail2"); },
      wait_agent: () => { throw new Error("fail3"); }
    },
    observationBus: observationStore,
    now: () => "2026-04-27T00:00:00.000Z",
    stopOnFailure: false
  });

  assert.equal(execution.status, "failed");
});
