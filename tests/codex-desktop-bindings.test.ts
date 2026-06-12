import test from "node:test";
import assert from "node:assert/strict";
import {
  createCodexDesktopBindings,
  createCodexDesktopBridge,
  createToolStyleCodexDesktopRuntime,
  type CodexDesktopRuntime
} from "../packages/codex-desktop-bindings/src/index.js";
import type { DesktopPrimitiveInvocation } from "../packages/desktop-live-adapter/src/index.js";

function createInvocation(
  primitive: DesktopPrimitiveInvocation["primitive"],
  overrides: Partial<DesktopPrimitiveInvocation> = {}
): DesktopPrimitiveInvocation {
  return {
    primitive,
    taskId: "codex-desktop-task",
    reason: `reason for ${primitive}`,
    task: {
      schemaVersion: "task-envelope.v1",
      taskId: "codex-desktop-task",
      source: "desktop-thread",
      intent: {
        summary: "review current config",
        requestedAction: "inspect and summarize the current config state",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: {
        repoRoot: "A:/codex-router"
      },
      target: {
        branches: [],
        files: ["routing-policy.yaml"],
        modules: []
      },
      constraints: {},
      hints: {
        riskHints: [],
        tags: [],
        provenance: []
      }
    },
    decision: {
      schemaVersion: "routing-decision.v1",
      decisionId: "decision-1",
      taskId: "codex-desktop-task",
      policyVersion: "test-policy",
      classification: {
        taskClass: "read_only",
        riskLevel: "low",
        ambiguityScore: 0,
        clarificationRequired: false,
        riskFactors: []
      },
      execution: {
        selectedModel: "gpt-5.4",
        toolAccess: "read_only",
        executionProfile: "recon-only",
        reasoningEffort: "medium"
      },
      approval: {
        required: false,
        reasons: []
      },
      parallelism: {
        allowed: true,
        maxAgents: 2,
        mode: "read_only"
      },
      hostRoute: "desktop"
    },
    executionPlan: {
      executionProfile: "recon-only",
      primitives: [{ primitive, reason: `reason for ${primitive}` }],
      notes: []
    },
    agentStrategy: {
      parallel: true,
      maxAgents: 2,
      assignments: [
        { role: "analyst", mode: "read_only" },
        { role: "reviewer", mode: "read_only" }
      ],
      reasons: ["read_only_parallelism_allowed"]
    },
    operation: {
      primitive,
      reason: `reason for ${primitive}`
    },
    stepIndex: 0,
    ...overrides
  };
}

test("codex desktop bindings spawn, wait, and close tracked agents through the runtime", async () => {
  const spawnRequests: unknown[] = [];
  const waitRequests: unknown[] = [];
  const closeRequests: unknown[] = [];
  let spawnCount = 0;
  const runtime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent(input) {
      spawnRequests.push(input);
      spawnCount += 1;
      return {
        agentId: `agent-${spawnCount}`,
        nickname: `Agent${spawnCount}`
      };
    },
    sendInput() {
      return {
        id: "message-1"
      };
    },
    waitAgent(input) {
      waitRequests.push(input);
      return {
        status: "completed",
        message: "all agents done"
      };
    },
    closeAgent(input) {
      closeRequests.push(input);
      return {
        status: "completed"
      };
    },
    automationUpdate() {
      return {
        status: "ACTIVE"
      };
    },
    shellCommand() {
      return {
        exitCode: 0
      };
    },
    applyPatch() {
      return {
        changedFiles: 1
      };
    }
  };

  const bindings = createCodexDesktopBindings(runtime);
  const spawnResult = await bindings.spawn_agent?.(createInvocation("spawn_agent"));
  const waitResult = await bindings.wait_agent?.(createInvocation("wait_agent"));
  const closeResult = await bindings.close_agent?.(createInvocation("close_agent"));

  assert.equal(spawnRequests.length, 2);
  assert.equal((spawnRequests[0] as { agentType?: string }).agentType, "explorer");
  assert.equal((spawnResult as { ok?: boolean; agentId?: string }).ok, true);
  assert.equal((spawnResult as { agentId?: string }).agentId, "agent-1");
  assert.deepEqual(waitRequests, [{
    targets: ["agent-1", "agent-2"]
  }]);
  assert.equal((waitResult as { agentStatus?: string }).agentStatus, "completed");
  assert.deepEqual(closeRequests, [
    { target: "agent-1" },
    { target: "agent-2" }
  ]);
  assert.equal((closeResult as { closed?: boolean }).closed, true);
});

test("codex desktop bindings use explicit shell and patch directives for concrete runtime calls", async () => {
  const shellRequests: unknown[] = [];
  const patches: string[] = [];
  const runtime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent() {
      return { agentId: "agent-1" };
    },
    sendInput() {
      return { id: "message-1" };
    },
    waitAgent() {
      return { status: "completed" };
    },
    closeAgent() {
      return { status: "completed" };
    },
    automationUpdate() {
      return { status: "ACTIVE" };
    },
    shellCommand(input) {
      shellRequests.push(input);
      return {
        exitCode: 0,
        stdout: "ok",
        stderr: ""
      };
    },
    applyPatch(patch) {
      patches.push(patch);
      return {
        changedFiles: 2,
        summary: "patched files"
      };
    }
  };

  const bindings = createCodexDesktopBindings(runtime, {
    shellCommand(invocation) {
      return {
        command: `echo ${invocation.task.taskId}`,
        ...(invocation.task.repoContext.repoRoot !== undefined
          ? { workdir: invocation.task.repoContext.repoRoot }
          : {})
      };
    },
    applyPatch() {
      return "*** Begin Patch\n*** Add File: demo.txt\n+hello\n*** End Patch\n";
    }
  });

  const shellResult = await bindings.shell_command?.(createInvocation("shell_command", {
    decision: {
      ...createInvocation("shell_command").decision,
      execution: {
        ...createInvocation("shell_command").decision.execution,
        toolAccess: "engineering_write",
        executionProfile: "engineering"
      }
    }
  }));
  const patchResult = await bindings.apply_patch?.(createInvocation("apply_patch", {
    decision: {
      ...createInvocation("apply_patch").decision,
      execution: {
        ...createInvocation("apply_patch").decision.execution,
        toolAccess: "engineering_write",
        executionProfile: "engineering"
      }
    }
  }));

  assert.deepEqual(shellRequests, [{
    command: "echo codex-desktop-task",
    workdir: "A:/codex-router"
  }]);
  assert.equal(patches[0], "*** Begin Patch\n*** Add File: demo.txt\n+hello\n*** End Patch\n");
  assert.equal((shellResult as { exitCode?: number }).exitCode, 0);
  assert.equal((patchResult as { changedFiles?: number }).changedFiles, 2);
});

test("codex desktop bindings pass structured shell commands and redact shell secrets", async () => {
  const shellRequests: unknown[] = [];
  const runtime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent() {
      return { agentId: "agent-1" };
    },
    sendInput() {
      return { id: "message-1" };
    },
    waitAgent() {
      return { status: "completed" };
    },
    closeAgent() {
      return { status: "completed" };
    },
    automationUpdate() {
      return { status: "ACTIVE" };
    },
    shellCommand(input) {
      shellRequests.push(input);
      return {
        exitCode: 0,
        stdout: `token=super-secret-token\n{"token":"json-token","apiKey":"json-api-key","safe":"ok"}`,
        stderr: `Authorization: Bearer abc.def.ghi\n{"authorization":"Bearer json-auth","password":"json-password"}`,
        nested: {
          apiKey: "raw-api-key"
        }
      };
    },
    applyPatch() {
      return { changedFiles: 1 };
    }
  };

  const bindings = createCodexDesktopBindings(runtime, {
    shellCommand() {
      return {
        structuredCommand: {
          executable: "npm",
          args: [
            "test",
            "--token",
            "-argv-token",
            "--password",
            "-argv-password",
            "--api-key=inline-api-key",
            "--safe",
            "ok"
          ],
          shell: false
        },
        justification: "validate changes"
      };
    }
  });

  const result = await bindings.shell_command?.(createInvocation("shell_command"));

  assert.deepEqual(shellRequests, [{
    structuredCommand: {
      executable: "npm",
      args: [
        "test",
        "--token",
        "-argv-token",
        "--password",
        "-argv-password",
        "--api-key=inline-api-key",
        "--safe",
        "ok"
      ],
      shell: false
    },
    justification: "validate changes"
  }]);
  assert.equal(
    (result as { stdout?: string }).stdout,
    `token=<REDACTED_SECRET>\n{"token":"<REDACTED_SECRET>","apiKey":"<REDACTED_SECRET>","safe":"ok"}`
  );
  assert.equal(
    (result as { stderr?: string }).stderr,
    `Authorization: <REDACTED_SECRET>\n{"authorization":"<REDACTED_SECRET>","password":"<REDACTED_SECRET>"}`
  );
  assert.equal(
    ((result as { payload?: { nested?: { apiKey?: string } } }).payload?.nested?.apiKey),
    "<REDACTED_SECRET>"
  );
  const envelopeText = JSON.stringify(result);
  assert.equal(envelopeText.includes("super-secret-token"), false);
  assert.equal(envelopeText.includes("json-token"), false);
  assert.equal(envelopeText.includes("json-api-key"), false);
  assert.equal(envelopeText.includes("Bearer abc.def.ghi"), false);
  assert.equal(envelopeText.includes("Bearer json-auth"), false);
  assert.equal(envelopeText.includes("json-password"), false);
  assert.equal(envelopeText.includes("raw-api-key"), false);
  assert.equal(envelopeText.includes("argv-token"), false);
  assert.equal(envelopeText.includes("-argv-token"), false);
  assert.equal(envelopeText.includes("argv-password"), false);
  assert.equal(envelopeText.includes("-argv-password"), false);
  assert.equal(envelopeText.includes("inline-api-key"), false);
  assert.deepEqual((result as { structuredCommand?: unknown }).structuredCommand, {
    executable: "npm",
    args: [
      "test",
      "--token",
      "<REDACTED_SECRET>",
      "--password",
      "<REDACTED_SECRET>",
      "--api-key=<REDACTED_SECRET>",
      "--safe",
      "ok"
    ],
    shell: false
  });
});

test("tool-style runtime forwards structured shell commands", async () => {
  const shellCalls: unknown[] = [];
  const runtime = createToolStyleCodexDesktopRuntime({
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
      return { exitCode: 0 };
    },
    apply_patch() {
      return { changedFiles: 1 };
    }
  });

  await runtime.shellCommand({
    structuredCommand: {
      executable: "node",
      args: ["--test"],
      shell: false
    }
  });

  assert.deepEqual(shellCalls, [{
    structured_command: {
      executable: "node",
      args: ["--test"],
      shell: false
    }
  }]);
});

test("codex desktop bindings fail clearly when send_input has no agent target in strict mode", async () => {
  const runtime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent() {
      return { agentId: "agent-1" };
    },
    sendInput() {
      return { id: "message-1" };
    },
    waitAgent() {
      return { status: "completed" };
    },
    closeAgent() {
      return { status: "completed" };
    },
    automationUpdate() {
      return { status: "ACTIVE" };
    },
    shellCommand() {
      return { exitCode: 0 };
    },
    applyPatch() {
      return { changedFiles: 1 };
    }
  };

  const bindings = createCodexDesktopBindings(runtime, {}, {
    sendInputWithoutAgentMode: "fail"
  });

  const result = await bindings.send_input?.(createInvocation("send_input", {
    decision: {
      ...createInvocation("send_input").decision,
      parallelism: {
        allowed: false,
        maxAgents: 1,
        mode: "disabled"
      }
    },
    agentStrategy: {
      parallel: false,
      maxAgents: 1,
      assignments: [{ role: "worker", mode: "write" }],
      reasons: ["profile_disallows_parallel"]
    }
  }));

  assert.equal((result as { ok?: boolean }).ok, false);
  assert.equal((result as { error?: string }).error, "codex_desktop_send_input_requires_target");
});

test("codex desktop bridge wraps bindings into a DesktopHostBridge", async () => {
  const runtime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent() {
      return { agentId: "agent-1" };
    },
    sendInput() {
      return { id: "message-1" };
    },
    waitAgent() {
      return { status: "completed" };
    },
    closeAgent() {
      return { status: "completed" };
    },
    automationUpdate() {
      return { status: "ACTIVE" };
    },
    shellCommand() {
      return { exitCode: 0, stdout: "ok", stderr: "" };
    },
    applyPatch() {
      return { changedFiles: 1, summary: "patched" };
    }
  };

  const bridge = createCodexDesktopBridge(runtime, {
    shellCommand() {
      return {
        command: "echo bridge"
      };
    }
  });

  const result = await bridge.invokePrimitive(createInvocation("shell_command", {
    decision: {
      ...createInvocation("shell_command").decision,
      execution: {
        ...createInvocation("shell_command").decision.execution,
        toolAccess: "engineering_write",
        executionProfile: "engineering"
      }
    }
  }));

  assert.equal((result as { ok?: boolean }).ok, true);
  assert.equal((result as { primitive?: string }).primitive, "shell_command");
});

test("tool-style codex desktop runtime maps camelCase runtime requests into host tool shapes", async () => {
  const calls = {
    spawn_agent: [] as unknown[],
    send_input: [] as unknown[],
    wait_agent: [] as unknown[],
    close_agent: [] as unknown[],
    shell_command: [] as unknown[],
    automation_update: [] as unknown[],
    apply_patch: [] as unknown[]
  };
  const runtime = createToolStyleCodexDesktopRuntime({
    read_thread_terminal() {
      return "terminal snapshot";
    },
    spawn_agent(input) {
      calls.spawn_agent.push(input);
      return { agentId: "agent-1" };
    },
    send_input(input) {
      calls.send_input.push(input);
      return { id: "message-1" };
    },
    wait_agent(input) {
      calls.wait_agent.push(input);
      return { status: "completed" };
    },
    close_agent(input) {
      calls.close_agent.push(input);
      return { status: "completed" };
    },
    automation_update(input) {
      calls.automation_update.push(input);
      return { status: "ACTIVE" };
    },
    shell_command(input) {
      calls.shell_command.push(input);
      return { exitCode: 0 };
    },
    apply_patch(input) {
      calls.apply_patch.push(input);
      return { changedFiles: 1 };
    }
  });

  await runtime.spawnAgent({
    message: "hello",
    agentType: "worker",
    forkContext: true,
    model: "gpt-5.3-codex",
    reasoningEffort: "high"
  });
  await runtime.sendInput({
    target: "agent-1",
    message: "continue",
    interrupt: true
  });
  await runtime.waitAgent({
    targets: ["agent-1"],
    timeoutMs: 30_000
  });
  await runtime.closeAgent({
    target: "agent-1"
  });
  await runtime.shellCommand({
    command: "npm test",
    justification: "validate changes",
    timeoutMs: 60_000,
    workdir: "A:/codex-router",
    login: false
  });
  await runtime.automationUpdate({
    mode: "create",
    kind: "heartbeat"
  });
  await runtime.applyPatch("*** Begin Patch\n*** End Patch\n");

  assert.deepEqual(calls.spawn_agent, [{
    message: "hello",
    agent_type: "worker",
    fork_context: true,
    model: "gpt-5.3-codex",
    reasoning_effort: "high"
  }]);
  assert.deepEqual(calls.send_input, [{
    target: "agent-1",
    message: "continue",
    interrupt: true
  }]);
  assert.deepEqual(calls.wait_agent, [{
    targets: ["agent-1"],
    timeout_ms: 30_000
  }]);
  assert.deepEqual(calls.close_agent, [{
    target: "agent-1"
  }]);
  assert.deepEqual(calls.shell_command, [{
    command: "npm test",
    justification: "validate changes",
    timeout_ms: 60_000,
    workdir: "A:/codex-router",
    login: false
  }]);
  assert.deepEqual(calls.automation_update, [{
    mode: "create",
    kind: "heartbeat"
  }]);
  assert.deepEqual(calls.apply_patch, ["*** Begin Patch\n*** End Patch\n"]);
});
