import type { AgentRole } from "../../contracts/src/index.js";
import {
  createHostBridgeFromBindings,
  createPrimitiveFailureEnvelope,
  createPrimitiveSuccessEnvelope,
  type DesktopHostBinding,
  type DesktopHostBindings,
  type DesktopHostBridge,
  type DesktopPrimitiveInvocation
} from "../../desktop-live-adapter/src/index.js";

export type CodexDesktopAgentType = "default" | "explorer" | "worker";

export interface CodexDesktopSpawnAgentRequest {
  message: string;
  agentType?: CodexDesktopAgentType;
  forkContext?: boolean;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
}

export interface CodexDesktopSendInputRequest {
  target: string;
  message: string;
  interrupt?: boolean;
}

export interface CodexDesktopWaitAgentRequest {
  targets: string[];
  timeoutMs?: number;
}

export interface CodexDesktopCloseAgentRequest {
  target: string;
}

export interface CodexDesktopShellCommandRequest {
  command: string;
  justification?: string;
  timeoutMs?: number;
  workdir?: string;
  login?: boolean;
}

export type CodexDesktopAutomationUpdateRequest = Record<string, unknown>;

export interface CodexDesktopRuntime {
  readThreadTerminal(): Promise<unknown> | unknown;
  spawnAgent(input: CodexDesktopSpawnAgentRequest): Promise<unknown> | unknown;
  sendInput(input: CodexDesktopSendInputRequest): Promise<unknown> | unknown;
  waitAgent(input: CodexDesktopWaitAgentRequest): Promise<unknown> | unknown;
  closeAgent(input: CodexDesktopCloseAgentRequest): Promise<unknown> | unknown;
  automationUpdate(input: CodexDesktopAutomationUpdateRequest): Promise<unknown> | unknown;
  shellCommand(input: CodexDesktopShellCommandRequest): Promise<unknown> | unknown;
  applyPatch(patch: string): Promise<unknown> | unknown;
}

export interface CodexDesktopToolRuntimeOperations {
  read_thread_terminal(): Promise<unknown> | unknown;
  spawn_agent(input: {
    message: string;
    agent_type?: CodexDesktopAgentType;
    fork_context?: boolean;
    model?: string;
    reasoning_effort?: "low" | "medium" | "high";
  }): Promise<unknown> | unknown;
  send_input(input: {
    target: string;
    message: string;
    interrupt?: boolean;
  }): Promise<unknown> | unknown;
  wait_agent(input: {
    targets: string[];
    timeout_ms?: number;
  }): Promise<unknown> | unknown;
  close_agent(input: {
    target: string;
  }): Promise<unknown> | unknown;
  automation_update(input: CodexDesktopAutomationUpdateRequest): Promise<unknown> | unknown;
  shell_command(input: {
    command: string;
    justification?: string;
    timeout_ms?: number;
    workdir?: string;
    login?: boolean;
  }): Promise<unknown> | unknown;
  apply_patch(patch: string): Promise<unknown> | unknown;
}

export interface CodexDesktopTrackedAgent {
  agentId: string;
  role?: AgentRole;
  mode?: "read_only" | "write";
  ownership?: string[];
}

export interface CodexDesktopTaskSession {
  activeAgents: CodexDesktopTrackedAgent[];
}

export interface CodexDesktopBindingSession {
  read(taskId: string): CodexDesktopTaskSession;
  write(taskId: string, session: CodexDesktopTaskSession): void;
  clear(taskId: string): void;
}

export interface CodexDesktopSpawnDirective {
  requests: CodexDesktopSpawnAgentRequest[];
}

export interface CodexDesktopSendInputDirective {
  requests: CodexDesktopSendInputRequest[];
}

export interface CodexDesktopWaitDirective {
  targets: string[];
  timeoutMs?: number;
}

export interface CodexDesktopCloseDirective {
  targets: string[];
}

export interface CodexDesktopDirectiveResolvers {
  spawnAgent?: (
    invocation: DesktopPrimitiveInvocation
  ) => CodexDesktopSpawnDirective | undefined;
  sendInput?: (
    invocation: DesktopPrimitiveInvocation,
    session: CodexDesktopTaskSession
  ) => CodexDesktopSendInputDirective | undefined;
  waitAgent?: (
    invocation: DesktopPrimitiveInvocation,
    session: CodexDesktopTaskSession
  ) => CodexDesktopWaitDirective | undefined;
  closeAgent?: (
    invocation: DesktopPrimitiveInvocation,
    session: CodexDesktopTaskSession
  ) => CodexDesktopCloseDirective | undefined;
  automationUpdate?: (
    invocation: DesktopPrimitiveInvocation
  ) => CodexDesktopAutomationUpdateRequest | undefined;
  shellCommand?: (
    invocation: DesktopPrimitiveInvocation
  ) => CodexDesktopShellCommandRequest | undefined;
  applyPatch?: (
    invocation: DesktopPrimitiveInvocation
  ) => string | undefined;
}

export interface CodexDesktopBindingOptions {
  session?: CodexDesktopBindingSession;
  sendInputWithoutAgentMode?: "fail" | "noop";
}

export function createCodexDesktopBindings(
  runtime: CodexDesktopRuntime,
  resolvers: CodexDesktopDirectiveResolvers = {},
  options: CodexDesktopBindingOptions = {}
): DesktopHostBindings {
  const session = options.session ?? createCodexDesktopBindingSession();
  const sendInputWithoutAgentMode = options.sendInputWithoutAgentMode ?? "noop";

  const bindings: DesktopHostBindings = {
    async read_thread_terminal() {
      const output = await runtime.readThreadTerminal();
      return createPrimitiveSuccessEnvelope("read_thread_terminal", {
        ...(typeof output === "string" ? { terminalOutput: output } : {}),
        payload: output
      });
    },

    async spawn_agent(invocation) {
      const directive = resolvers.spawnAgent?.(invocation)
        ?? {
          requests: buildDefaultSpawnRequests(invocation)
        };

      if (directive.requests.length === 0) {
        return createPrimitiveFailureEnvelope("spawn_agent", "codex_desktop_spawn_agent_requests_missing");
      }

      const results = [];
      const trackedAgents: CodexDesktopTrackedAgent[] = [];

      for (const [index, request] of directive.requests.entries()) {
        const output = await runtime.spawnAgent(request);
        const normalized = asRecord(output);
        const agentId = asString(normalized?.agentId) ?? asString(normalized?.id);

        if (!agentId) {
          return createPrimitiveFailureEnvelope("spawn_agent", "codex_desktop_spawn_agent_missing_agent_id", {
            payload: {
              request,
              output
            }
          });
        }

        trackedAgents.push({
          agentId,
          ...(invocation.agentStrategy.assignments[index]?.role !== undefined
            ? { role: invocation.agentStrategy.assignments[index]?.role }
            : {}),
          ...(invocation.agentStrategy.assignments[index]?.mode !== undefined
            ? { mode: invocation.agentStrategy.assignments[index]?.mode }
            : {}),
          ...(invocation.agentStrategy.assignments[index]?.ownership !== undefined
            ? { ownership: invocation.agentStrategy.assignments[index]?.ownership }
            : {})
        });
        results.push(output);
      }

      session.write(invocation.taskId, {
        activeAgents: trackedAgents
      });

      const firstAgentId = trackedAgents[0]?.agentId;
      const firstNickname = asString(asRecord(results[0])?.nickname) ?? asString(asRecord(results[0])?.name);
      return createPrimitiveSuccessEnvelope("spawn_agent", {
        ...(firstAgentId !== undefined ? { agentId: firstAgentId } : {}),
        ...(firstNickname !== undefined ? { nickname: firstNickname } : {}),
        summary: `spawned ${trackedAgents.length} Codex Desktop agent(s)`,
        payload: {
          results,
          trackedAgents
        }
      });
    },

    async send_input(invocation) {
      const taskSession = session.read(invocation.taskId);
      const directive = resolvers.sendInput?.(invocation, taskSession);
      const requests = directive?.requests ?? buildDefaultSendInputRequests(taskSession, invocation.reason);

      if (requests.length === 0) {
        if (sendInputWithoutAgentMode === "noop") {
          return createPrimitiveSuccessEnvelope("send_input", {
            queued: false,
            interrupted: false,
            summary: "no target agent; treated as current-thread continuation no-op"
          });
        }

        return createPrimitiveFailureEnvelope("send_input", "codex_desktop_send_input_requires_target");
      }

      const results = [];
      for (const request of requests) {
        results.push(await runtime.sendInput(request));
      }

      const first = asRecord(results[0]);
      const firstMessageId = asString(first?.messageId) ?? asString(first?.id);
      return createPrimitiveSuccessEnvelope("send_input", {
        queued: true,
        interrupted: directive?.requests.some((request) => request.interrupt === true) ?? false,
        ...(firstMessageId !== undefined ? { messageId: firstMessageId } : {}),
        summary: `sent input to ${requests.length} Codex Desktop target(s)`,
        payload: {
          requests,
          results
        }
      });
    },

    async wait_agent(invocation) {
      const taskSession = session.read(invocation.taskId);
      const directive = resolvers.waitAgent?.(invocation, taskSession)
        ?? buildDefaultWaitDirective(taskSession);

      if (!directive || directive.targets.length === 0) {
        return createPrimitiveFailureEnvelope("wait_agent", "codex_desktop_wait_agent_targets_missing");
      }

      const output = await runtime.waitAgent(directive);
      const firstTarget = directive.targets[0];
      const normalized = asRecord(output);
      const agentStatus = asString(normalized?.status);
      const agentMessage = asString(normalized?.message);

      return createPrimitiveSuccessEnvelope("wait_agent", {
        ...(firstTarget !== undefined ? { agentId: firstTarget } : {}),
        ...(agentStatus !== undefined ? { agentStatus } : {}),
        ...(agentMessage !== undefined ? { agentMessage } : {}),
        summary: `waited on ${directive.targets.length} Codex Desktop agent(s)`,
        payload: {
          targets: directive.targets,
          output
        }
      });
    },

    async close_agent(invocation) {
      const taskSession = session.read(invocation.taskId);
      const directive = resolvers.closeAgent?.(invocation, taskSession)
        ?? buildDefaultCloseDirective(taskSession);

      if (!directive || directive.targets.length === 0) {
        return createPrimitiveFailureEnvelope("close_agent", "codex_desktop_close_agent_targets_missing");
      }

      const results = [];
      for (const target of directive.targets) {
        results.push(await runtime.closeAgent({ target }));
      }
      session.clear(invocation.taskId);

      return createPrimitiveSuccessEnvelope("close_agent", {
        closed: true,
        summary: `closed ${directive.targets.length} Codex Desktop agent(s)`,
        payload: {
          targets: directive.targets,
          results
        }
      });
    },

    async automation_update(invocation) {
      const request = resolvers.automationUpdate?.(invocation);
      if (!request) {
        return createPrimitiveFailureEnvelope("automation_update", "codex_desktop_automation_update_requires_payload");
      }

      const output = await runtime.automationUpdate(request);
      const normalized = asRecord(output);
      const automationId = asString(normalized?.automationId) ?? asString(normalized?.id);
      const automationStatus = asString(normalized?.automationStatus) ?? asString(normalized?.status);
      return createPrimitiveSuccessEnvelope("automation_update", {
        ...(automationId !== undefined ? { automationId } : {}),
        ...(automationStatus !== undefined ? { automationStatus } : {}),
        payload: output
      });
    },

    async shell_command(invocation) {
      const request = resolvers.shellCommand?.(invocation);
      if (!request) {
        return createPrimitiveFailureEnvelope("shell_command", "codex_desktop_shell_command_requires_command");
      }

      const output = await runtime.shellCommand(request);
      const normalized = asRecord(output);
      const exitCode = asNumber(normalized?.exitCode) ?? asNumber(normalized?.code);
      const stdout = typeof output === "string" ? output : asString(normalized?.stdout);
      const stderr = asString(normalized?.stderr);
      return createPrimitiveSuccessEnvelope("shell_command", {
        ...(exitCode !== undefined ? { exitCode } : {}),
        ...(stdout !== undefined ? { stdout } : {}),
        ...(stderr !== undefined ? { stderr } : {}),
        payload: output
      });
    },

    async apply_patch(invocation) {
      const patch = resolvers.applyPatch?.(invocation);
      if (!patch) {
        return createPrimitiveFailureEnvelope("apply_patch", "codex_desktop_apply_patch_requires_patch");
      }

      const output = await runtime.applyPatch(patch);
      const normalized = asRecord(output);
      const changedFiles = asNumber(normalized?.changedFiles);
      const summary = typeof output === "string" ? output : asString(normalized?.summary);
      return createPrimitiveSuccessEnvelope("apply_patch", {
        ...(changedFiles !== undefined ? { changedFiles } : {}),
        ...(summary !== undefined ? { summary } : {}),
        payload: {
          patch,
          output
        }
      });
    }
  };

  return bindings;
}

export function createCodexDesktopBridge(
  runtime: CodexDesktopRuntime,
  resolvers: CodexDesktopDirectiveResolvers = {},
  options: CodexDesktopBindingOptions = {}
): DesktopHostBridge {
  return createHostBridgeFromBindings(
    createCodexDesktopBindings(runtime, resolvers, options)
  );
}

export function createToolStyleCodexDesktopRuntime(
  operations: CodexDesktopToolRuntimeOperations
): CodexDesktopRuntime {
  return {
    readThreadTerminal() {
      return operations.read_thread_terminal();
    },
    spawnAgent(input) {
      return operations.spawn_agent({
        message: input.message,
        ...(input.agentType !== undefined ? { agent_type: input.agentType } : {}),
        ...(input.forkContext !== undefined ? { fork_context: input.forkContext } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.reasoningEffort !== undefined
          ? { reasoning_effort: input.reasoningEffort }
          : {})
      });
    },
    sendInput(input) {
      return operations.send_input({
        target: input.target,
        message: input.message,
        ...(input.interrupt !== undefined ? { interrupt: input.interrupt } : {})
      });
    },
    waitAgent(input) {
      return operations.wait_agent({
        targets: input.targets,
        ...(input.timeoutMs !== undefined ? { timeout_ms: input.timeoutMs } : {})
      });
    },
    closeAgent(input) {
      return operations.close_agent({
        target: input.target
      });
    },
    automationUpdate(input) {
      return operations.automation_update(input);
    },
    shellCommand(input) {
      return operations.shell_command({
        command: input.command,
        ...(input.justification !== undefined
          ? { justification: input.justification }
          : {}),
        ...(input.timeoutMs !== undefined ? { timeout_ms: input.timeoutMs } : {}),
        ...(input.workdir !== undefined ? { workdir: input.workdir } : {}),
        ...(input.login !== undefined ? { login: input.login } : {})
      });
    },
    applyPatch(patch) {
      return operations.apply_patch(patch);
    }
  };
}

export function createCodexDesktopBindingSession(): CodexDesktopBindingSession {
  const sessions = new Map<string, CodexDesktopTaskSession>();

  return {
    read(taskId) {
      return sessions.get(taskId) ?? { activeAgents: [] };
    },
    write(taskId, session) {
      sessions.set(taskId, {
        activeAgents: [...session.activeAgents]
      });
    },
    clear(taskId) {
      sessions.delete(taskId);
    }
  };
}

function buildDefaultSpawnRequests(
  invocation: DesktopPrimitiveInvocation
): CodexDesktopSpawnAgentRequest[] {
  const assignments = invocation.agentStrategy.assignments;
  if (assignments.length === 0) {
    return [{
      message: invocation.reason,
      agentType: "default",
      forkContext: true,
      reasoningEffort: invocation.decision.execution.reasoningEffort
    }];
  }

  return assignments.map((assignment, index) => ({
    message: buildSpawnMessage(invocation, assignment, index),
    agentType: mapAssignmentToAgentType(assignment.role, assignment.mode),
    forkContext: true,
    reasoningEffort: invocation.decision.execution.reasoningEffort
  }));
}

function buildSpawnMessage(
  invocation: DesktopPrimitiveInvocation,
  assignment: {
    role: AgentRole;
    mode: "read_only" | "write";
    ownership?: string[];
  },
  index: number
): string {
  const lines = [
    `Task: ${invocation.task.intent.summary}`,
    `Requested action: ${invocation.task.intent.requestedAction}`,
    `Reason: ${invocation.reason}`,
    `Assigned role: ${assignment.role}`,
    `Mode: ${assignment.mode}`,
    `Slot: ${index + 1}`
  ];

  if (assignment.ownership && assignment.ownership.length > 0) {
    lines.push(`Owned scope: ${assignment.ownership.join(", ")}`);
  }

  if (assignment.mode === "write") {
    lines.push("You are not alone in the codebase. Keep edits inside your owned scope and do not revert unrelated changes.");
  }

  return lines.join("\n");
}

function buildDefaultSendInputRequests(
  session: CodexDesktopTaskSession,
  message: string
): CodexDesktopSendInputRequest[] {
  if (session.activeAgents.length === 0) {
    return [];
  }

  const target = session.activeAgents[session.activeAgents.length - 1]?.agentId;
  return target ? [{ target, message }] : [];
}

function buildDefaultWaitDirective(
  session: CodexDesktopTaskSession
): CodexDesktopWaitDirective | undefined {
  if (session.activeAgents.length === 0) {
    return undefined;
  }

  return {
    targets: session.activeAgents.map((agent) => agent.agentId)
  };
}

function buildDefaultCloseDirective(
  session: CodexDesktopTaskSession
): CodexDesktopCloseDirective | undefined {
  if (session.activeAgents.length === 0) {
    return undefined;
  }

  return {
    targets: session.activeAgents.map((agent) => agent.agentId)
  };
}

function mapAssignmentToAgentType(
  role: AgentRole,
  mode: "read_only" | "write"
): CodexDesktopAgentType {
  if (mode === "write") {
    return "worker";
  }

  if (role === "analyst" || role === "reviewer") {
    return "explorer";
  }

  return "default";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
