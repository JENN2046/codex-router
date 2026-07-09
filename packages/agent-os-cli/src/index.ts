import { z } from "zod";
import {
  AgentOsMcpToolNameSchema,
  createAgentOsMcpLocalRuntime,
  type AgentOsMcpLocalRuntimeOptions,
  type AgentOsMcpLocalRuntimeResult,
  type AgentOsMcpLocalToolCall,
  type AgentOsMcpToolName
} from "../../protocol-mcp/src/index.js";

export const AgentOsCliCommandSchema = z.enum([
  "create-task",
  "get-run",
  "list-runs",
  "cancel-run",
  "approve-run",
  "dispatch-workspace-write",
  "list-artifacts",
  "get-artifact",
  "search-events"
]);

export type AgentOsCliCommand = z.infer<typeof AgentOsCliCommandSchema>;

export type RunAgentOsCliCommandInput = Omit<
  AgentOsMcpLocalRuntimeOptions,
  "publicSurface"
> & {
  argv: string[];
};

export type AgentOsCliParsedCommand = {
  command: AgentOsCliCommand;
  toolName: AgentOsMcpToolName;
  toolInput: Record<string, unknown>;
  grantedCapabilities: string[];
  approvedMutatingTools: AgentOsMcpToolName[];
  allowLocalMutations?: boolean;
  preferredProviderId?: string;
};

export type AgentOsCliCommandResult = AgentOsMcpLocalRuntimeResult & {
  surface: "cli";
  command: AgentOsCliCommand;
  sanitizedArgv: string[];
};

type ArgCursor = {
  args: string[];
  index: number;
};

export function runAgentOsCliCommand(
  input: RunAgentOsCliCommandInput
): AgentOsCliCommandResult {
  const { runtime, parsed, call, argv } = createCliRuntimeAndCall(input);
  const result = runtime.handleToolCall(call);
  return {
    ...result,
    surface: "cli",
    command: parsed.command,
    sanitizedArgv: sanitizeAgentOsCliArgv(argv)
  };
}

export async function runAgentOsCliCommandAsync(
  input: RunAgentOsCliCommandInput
): Promise<AgentOsCliCommandResult> {
  const { runtime, parsed, call, argv } = createCliRuntimeAndCall(input);
  const result = await runtime.handleToolCallAsync(call);
  return {
    ...result,
    surface: "cli",
    command: parsed.command,
    sanitizedArgv: sanitizeAgentOsCliArgv(argv)
  };
}

function createCliRuntimeAndCall(input: RunAgentOsCliCommandInput): {
  runtime: ReturnType<typeof createAgentOsMcpLocalRuntime>;
  parsed: AgentOsCliParsedCommand;
  call: AgentOsMcpLocalToolCall;
  argv: string[];
} {
  const { argv, ...runtimeOptions } = input;
  const parsed = parseAgentOsCliArgv(argv);
  const runtime = createAgentOsMcpLocalRuntime({
    ...runtimeOptions,
    publicSurface: "cli",
    ...(parsed.preferredProviderId !== undefined
      ? { preferredProviderId: parsed.preferredProviderId }
      : {})
  });
  const call: AgentOsMcpLocalToolCall = {
    toolName: parsed.toolName,
    input: parsed.toolInput
  };

  if (parsed.grantedCapabilities.length > 0) {
    call.grantedCapabilities = parsed.grantedCapabilities;
  }
  if (parsed.approvedMutatingTools.length > 0) {
    call.approvedMutatingTools = parsed.approvedMutatingTools;
  }
  if (parsed.allowLocalMutations !== undefined) {
    call.allowLocalMutations = parsed.allowLocalMutations;
  }
  if (parsed.preferredProviderId !== undefined) {
    call.preferredProviderId = parsed.preferredProviderId;
  }

  return {
    runtime,
    parsed,
    call,
    argv
  };
}

export function parseAgentOsCliArgv(argv: string[]): AgentOsCliParsedCommand {
  const cursor: ArgCursor = {
    args: [...argv],
    index: 0
  };
  const rawCommand = nextArg(cursor, "command");
  const command = AgentOsCliCommandSchema.parse(rawCommand);
  const common = createCommonCliOptions();
  const parsed = parseCommandOptions(command, cursor, common);

  if (cursor.index < cursor.args.length) {
    throw new Error(`agent_os_cli_unparsed_args:${cursor.args.slice(cursor.index).join(",")}`);
  }

  return {
    command,
    toolName: commandToToolName(command),
    toolInput: parsed,
    grantedCapabilities: common.grantedCapabilities,
    approvedMutatingTools: common.approvedMutatingTools,
    ...(common.allowLocalMutations !== undefined
      ? { allowLocalMutations: common.allowLocalMutations }
      : {}),
    ...(common.preferredProviderId !== undefined
      ? { preferredProviderId: common.preferredProviderId }
      : {})
  };
}

export function sanitizeAgentOsCliArgv(argv: string[]): string[] {
  const sanitized: string[] = [];
  let redactNext = false;

  for (const arg of argv) {
    if (redactNext) {
      sanitized.push("<REDACTED>");
      redactNext = false;
      continue;
    }

    const inlineRedacted = redactInlineSecretLikeArg(arg);
    if (inlineRedacted !== undefined) {
      sanitized.push(inlineRedacted);
      continue;
    }

    sanitized.push(arg);
    if (shouldRedactNextArg(arg)) {
      redactNext = true;
    }
  }

  return sanitized;
}

function parseCommandOptions(
  command: AgentOsCliCommand,
  cursor: ArgCursor,
  common: CommonCliOptions
): Record<string, unknown> {
  switch (command) {
    case "create-task":
      return parseCreateTaskOptions(cursor, common);
    case "get-run":
      return parseGetRunOptions(cursor, common);
    case "list-runs":
      return parseListRunsOptions(cursor, common);
    case "cancel-run":
      return parseCancelRunOptions(cursor, common);
    case "approve-run":
      return parseApproveRunOptions(cursor, common);
    case "dispatch-workspace-write":
      return parseDispatchWorkspaceWriteOptions(cursor, common);
    case "list-artifacts":
      return parseListArtifactsOptions(cursor, common);
    case "get-artifact":
      return parseGetArtifactOptions(cursor, common);
    case "search-events":
      return parseSearchEventsOptions(cursor, common);
  }
}

function parseCreateTaskOptions(
  cursor: ArgCursor,
  common: CommonCliOptions
): Record<string, unknown> {
  const input: {
    title?: string;
    requestedAction?: string;
    successCriteria: string[];
    outOfScope: string[];
    repoRoot?: string;
    branch?: string;
    targetFiles: string[];
    metadata: Record<string, unknown>;
  } = {
    successCriteria: [],
    outOfScope: [],
    targetFiles: [],
    metadata: {}
  };

  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }

    switch (arg) {
      case "--title":
        input.title = nextArg(cursor, arg);
        break;
      case "--requested-action":
      case "--action":
        input.requestedAction = nextArg(cursor, arg);
        break;
      case "--success-criteria":
        input.successCriteria.push(nextArg(cursor, arg));
        break;
      case "--out-of-scope":
        input.outOfScope.push(nextArg(cursor, arg));
        break;
      case "--repo-root":
        input.repoRoot = nextArg(cursor, arg);
        break;
      case "--branch":
        input.branch = nextArg(cursor, arg);
        break;
      case "--target-file":
        input.targetFiles.push(nextArg(cursor, arg));
        break;
      case "--metadata-json":
        input.metadata = parseJsonObjectOption(nextArg(cursor, arg), arg);
        break;
      default:
        throw new Error(`agent_os_cli_unknown_option:${arg}`);
    }
  }

  if (input.title === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--title");
  }
  if (input.requestedAction === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--requested-action");
  }

  return {
    title: input.title,
    requestedAction: input.requestedAction,
    successCriteria: input.successCriteria,
    outOfScope: input.outOfScope,
    ...(input.repoRoot !== undefined ? { repoRoot: input.repoRoot } : {}),
    ...(input.branch !== undefined ? { branch: input.branch } : {}),
    targetFiles: input.targetFiles,
    metadata: input.metadata
  };
}

function parseGetRunOptions(cursor: ArgCursor, common: CommonCliOptions): Record<string, unknown> {
  const input: { runId?: string } = {};
  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }
    if (arg === "--run-id") {
      input.runId = nextArg(cursor, arg);
      continue;
    }
    throw new Error(`agent_os_cli_unknown_option:${arg}`);
  }

  if (input.runId === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--run-id");
  }
  return { runId: input.runId };
}

function parseListRunsOptions(cursor: ArgCursor, common: CommonCliOptions): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }
    switch (arg) {
      case "--task-id":
        input.taskId = nextArg(cursor, arg);
        break;
      case "--status":
        input.status = nextArg(cursor, arg);
        break;
      case "--limit":
        input.limit = parseIntegerOption(nextArg(cursor, arg), arg);
        break;
      case "--cursor":
        input.cursor = nextArg(cursor, arg);
        break;
      default:
        throw new Error(`agent_os_cli_unknown_option:${arg}`);
    }
  }
  return input;
}

function parseCancelRunOptions(cursor: ArgCursor, common: CommonCliOptions): Record<string, unknown> {
  const input: { runId?: string; reason?: string } = {};
  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }
    switch (arg) {
      case "--run-id":
        input.runId = nextArg(cursor, arg);
        break;
      case "--reason":
        input.reason = nextArg(cursor, arg);
        break;
      default:
        throw new Error(`agent_os_cli_unknown_option:${arg}`);
    }
  }

  if (input.runId === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--run-id");
  }
  if (input.reason === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--reason");
  }
  return {
    runId: input.runId,
    reason: input.reason
  };
}

function parseApproveRunOptions(
  cursor: ArgCursor,
  common: CommonCliOptions
): Record<string, unknown> {
  const input: {
    runId?: string;
    capabilityScopes: string[];
    expiresAt?: string;
    reason?: string;
  } = {
    capabilityScopes: []
  };

  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }
    switch (arg) {
      case "--run-id":
        input.runId = nextArg(cursor, arg);
        break;
      case "--capability-scope":
        input.capabilityScopes.push(nextArg(cursor, arg));
        break;
      case "--expires-at":
        input.expiresAt = nextArg(cursor, arg);
        break;
      case "--reason":
        input.reason = nextArg(cursor, arg);
        break;
      default:
        throw new Error(`agent_os_cli_unknown_option:${arg}`);
    }
  }

  if (input.runId === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--run-id");
  }
  if (input.capabilityScopes.length === 0) {
    throw new Error("agent_os_cli_missing_required_option:--capability-scope");
  }
  if (input.reason === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--reason");
  }
  return {
    runId: input.runId,
    capabilityScopes: input.capabilityScopes,
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    reason: input.reason
  };
}

function parseDispatchWorkspaceWriteOptions(
  cursor: ArgCursor,
  common: CommonCliOptions
): Record<string, unknown> {
  const input: {
    dispatchInput?: Record<string, unknown>;
  } = {};

  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }
    switch (arg) {
      case "--dispatch-input-json":
        input.dispatchInput = parseJsonObjectOption(nextArg(cursor, arg), arg);
        break;
      default:
        throw new Error(`agent_os_cli_unknown_option:${arg}`);
    }
  }

  if (input.dispatchInput === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--dispatch-input-json");
  }

  return {
    dispatchInput: input.dispatchInput
  };
}

function parseListArtifactsOptions(
  cursor: ArgCursor,
  common: CommonCliOptions
): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }
    switch (arg) {
      case "--task-id":
        input.taskId = nextArg(cursor, arg);
        break;
      case "--run-id":
        input.runId = nextArg(cursor, arg);
        break;
      case "--kind":
        input.kind = nextArg(cursor, arg);
        break;
      case "--limit":
        input.limit = parseIntegerOption(nextArg(cursor, arg), arg);
        break;
      case "--cursor":
        input.cursor = nextArg(cursor, arg);
        break;
      default:
        throw new Error(`agent_os_cli_unknown_option:${arg}`);
    }
  }
  return input;
}

function parseGetArtifactOptions(
  cursor: ArgCursor,
  common: CommonCliOptions
): Record<string, unknown> {
  const input: { artifactId?: string } = {};
  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }
    if (arg === "--artifact-id") {
      input.artifactId = nextArg(cursor, arg);
      continue;
    }
    throw new Error(`agent_os_cli_unknown_option:${arg}`);
  }

  if (input.artifactId === undefined) {
    throw new Error("agent_os_cli_missing_required_option:--artifact-id");
  }
  return { artifactId: input.artifactId };
}

function parseSearchEventsOptions(
  cursor: ArgCursor,
  common: CommonCliOptions
): Record<string, unknown> {
  const input: {
    query?: string;
    taskId?: string;
    runId?: string;
    eventTypes: string[];
    limit?: number;
    cursor?: string;
  } = {
    eventTypes: []
  };

  while (cursor.index < cursor.args.length) {
    const arg = nextArg(cursor, "option");
    if (parseCommonOption(arg, cursor, common)) {
      continue;
    }
    switch (arg) {
      case "--query":
        input.query = nextArg(cursor, arg);
        break;
      case "--task-id":
        input.taskId = nextArg(cursor, arg);
        break;
      case "--run-id":
        input.runId = nextArg(cursor, arg);
        break;
      case "--event-type":
        input.eventTypes.push(nextArg(cursor, arg));
        break;
      case "--limit":
        input.limit = parseIntegerOption(nextArg(cursor, arg), arg);
        break;
      case "--cursor":
        input.cursor = nextArg(cursor, arg);
        break;
      default:
        throw new Error(`agent_os_cli_unknown_option:${arg}`);
    }
  }

  return {
    ...(input.query !== undefined ? { query: input.query } : {}),
    ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    eventTypes: input.eventTypes,
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.cursor !== undefined ? { cursor: input.cursor } : {})
  };
}

type CommonCliOptions = {
  grantedCapabilities: string[];
  approvedMutatingTools: AgentOsMcpToolName[];
  allowLocalMutations?: boolean;
  preferredProviderId?: string;
};

function createCommonCliOptions(): CommonCliOptions {
  return {
    grantedCapabilities: [],
    approvedMutatingTools: []
  };
}

function parseCommonOption(
  arg: string,
  cursor: ArgCursor,
  common: CommonCliOptions
): boolean {
  switch (arg) {
    case "--grant":
      common.grantedCapabilities.push(nextArg(cursor, arg));
      return true;
    case "--approve-tool":
      common.approvedMutatingTools.push(
        AgentOsMcpToolNameSchema.parse(nextArg(cursor, arg))
      );
      return true;
    case "--allow-local-mutation":
      common.allowLocalMutations = true;
      return true;
    case "--preferred-provider":
      common.preferredProviderId = nextArg(cursor, arg);
      return true;
    default:
      return false;
  }
}

function commandToToolName(command: AgentOsCliCommand): AgentOsMcpToolName {
  switch (command) {
    case "create-task":
      return "agentos.create_task";
    case "get-run":
      return "agentos.get_run";
    case "list-runs":
      return "agentos.list_runs";
    case "cancel-run":
      return "agentos.cancel_run";
    case "approve-run":
      return "agentos.approve_run";
    case "dispatch-workspace-write":
      return "agentos.dispatch_workspace_write";
    case "list-artifacts":
      return "agentos.list_artifacts";
    case "get-artifact":
      return "agentos.get_artifact";
    case "search-events":
      return "agentos.search_events";
  }
}

function nextArg(cursor: ArgCursor, label: string): string {
  const value = cursor.args[cursor.index];
  if (value === undefined) {
    throw new Error(`agent_os_cli_missing_arg:${label}`);
  }
  cursor.index += 1;
  return value;
}

function parseJsonObjectOption(value: string, option: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`agent_os_cli_option_must_be_json_object:${option}`);
  }
  return parsed as Record<string, unknown>;
}

function parseIntegerOption(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`agent_os_cli_option_must_be_integer:${option}`);
  }
  return parsed;
}

function redactInlineSecretLikeArg(arg: string): string | undefined {
  const separatorIndex = arg.indexOf("=");
  if (separatorIndex <= 0) {
    return undefined;
  }

  const flag = arg.slice(0, separatorIndex);
  if (!shouldRedactNextArg(flag)) {
    return undefined;
  }
  return `${flag}=<REDACTED>`;
}

function shouldRedactNextArg(arg: string): boolean {
  return isSecretLikeFlag(arg)
    || arg === "--metadata-json"
    || arg === "--dispatch-input-json";
}

function isSecretLikeFlag(arg: string): boolean {
  return /secret|token|password|credential|authorization|api[-_]?key/i.test(arg);
}
