import type { DesktopPrimitive } from "../../contracts/src/index.js";
import { redactSecretLikeFields } from "../../redaction/src/index.js";

interface PrimitiveSuccessEnvelopeBase<P extends DesktopPrimitive> {
  primitive: P;
  ok: true;
  summary?: string;
  payload?: unknown;
}

export interface SpawnAgentSuccessEnvelope extends PrimitiveSuccessEnvelopeBase<"spawn_agent"> {
  agentId?: string;
  nickname?: string;
}

export interface SendInputSuccessEnvelope extends PrimitiveSuccessEnvelopeBase<"send_input"> {
  queued?: boolean;
  interrupted?: boolean;
  messageId?: string;
}

export interface WaitAgentSuccessEnvelope extends PrimitiveSuccessEnvelopeBase<"wait_agent"> {
  agentId?: string;
  agentStatus?: string;
  agentMessage?: string;
}

export interface CloseAgentSuccessEnvelope extends PrimitiveSuccessEnvelopeBase<"close_agent"> {
  closed?: boolean;
  previousStatus?: string;
}

export interface AutomationUpdateSuccessEnvelope extends PrimitiveSuccessEnvelopeBase<"automation_update"> {
  automationId?: string;
  automationStatus?: string;
}

export interface ShellCommandSuccessEnvelope extends PrimitiveSuccessEnvelopeBase<"shell_command"> {
  structuredCommand?: StructuredShellCommand;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface StructuredShellCommand {
  executable: string;
  args?: string[];
  shell?: boolean;
}

export interface ApplyPatchSuccessEnvelope extends PrimitiveSuccessEnvelopeBase<"apply_patch"> {
  changedFiles?: number;
}

export interface ReadThreadTerminalSuccessEnvelope extends PrimitiveSuccessEnvelopeBase<"read_thread_terminal"> {
  terminalOutput?: string;
}

export interface PrimitiveFailureEnvelope<P extends DesktopPrimitive = DesktopPrimitive> {
  primitive: P;
  ok: false;
  error: string;
  retryable?: boolean;
  summary?: string;
  payload?: unknown;
}

export interface PrimitiveSuccessDetailsMap {
  spawn_agent: Omit<SpawnAgentSuccessEnvelope, "primitive" | "ok">;
  send_input: Omit<SendInputSuccessEnvelope, "primitive" | "ok">;
  wait_agent: Omit<WaitAgentSuccessEnvelope, "primitive" | "ok">;
  close_agent: Omit<CloseAgentSuccessEnvelope, "primitive" | "ok">;
  automation_update: Omit<AutomationUpdateSuccessEnvelope, "primitive" | "ok">;
  shell_command: Omit<ShellCommandSuccessEnvelope, "primitive" | "ok">;
  apply_patch: Omit<ApplyPatchSuccessEnvelope, "primitive" | "ok">;
  read_thread_terminal: Omit<ReadThreadTerminalSuccessEnvelope, "primitive" | "ok">;
}

export interface PrimitiveSuccessEnvelopeMap {
  spawn_agent: SpawnAgentSuccessEnvelope;
  send_input: SendInputSuccessEnvelope;
  wait_agent: WaitAgentSuccessEnvelope;
  close_agent: CloseAgentSuccessEnvelope;
  automation_update: AutomationUpdateSuccessEnvelope;
  shell_command: ShellCommandSuccessEnvelope;
  apply_patch: ApplyPatchSuccessEnvelope;
  read_thread_terminal: ReadThreadTerminalSuccessEnvelope;
}

export type DesktopPrimitiveSuccessEnvelope<P extends DesktopPrimitive = DesktopPrimitive> =
  PrimitiveSuccessEnvelopeMap[P];

export type DesktopPrimitiveResultEnvelope<P extends DesktopPrimitive = DesktopPrimitive> =
  | PrimitiveSuccessEnvelopeMap[P]
  | PrimitiveFailureEnvelope<P>;

export type DesktopPrimitiveHandlerOutput<P extends DesktopPrimitive = DesktopPrimitive> =
  | DesktopPrimitiveResultEnvelope<P>
  | unknown;

export function createPrimitiveSuccessEnvelope<P extends DesktopPrimitive>(
  primitive: P,
  details: PrimitiveSuccessDetailsMap[P]
): PrimitiveSuccessEnvelopeMap[P] {
  return {
    primitive,
    ok: true,
    ...redactSuccessDetails(primitive, details)
  } as PrimitiveSuccessEnvelopeMap[P];
}

export function createPrimitiveFailureEnvelope<P extends DesktopPrimitive>(
  primitive: P,
  error: string,
  details: Omit<PrimitiveFailureEnvelope<P>, "primitive" | "ok" | "error"> = {}
): PrimitiveFailureEnvelope<P> {
  return {
    primitive,
    ok: false,
    error,
    ...details
  };
}

export function normalizePrimitiveHandlerOutput<P extends DesktopPrimitive>(
  primitive: P,
  output: DesktopPrimitiveHandlerOutput<P>
): DesktopPrimitiveResultEnvelope<P> {
  if (isPrimitiveResultEnvelope(output)) {
    if (output.primitive !== primitive) {
      return createPrimitiveFailureEnvelope(
        primitive,
        `primitive_result_mismatch:${primitive}:${output.primitive}`,
        { payload: redactPrimitiveResultEnvelope(output) }
      );
    }

    return redactPrimitiveResultEnvelope(output) as DesktopPrimitiveResultEnvelope<P>;
  }

  return inferPrimitiveSuccessEnvelope(primitive, output);
}

export function isPrimitiveResultEnvelope(
  value: unknown
): value is DesktopPrimitiveResultEnvelope {
  return isRecord(value)
    && typeof value.primitive === "string"
    && typeof value.ok === "boolean";
}

function inferPrimitiveSuccessEnvelope<P extends DesktopPrimitive>(
  primitive: P,
  output: unknown
): DesktopPrimitiveResultEnvelope<P> {
  const record = asRecord(output);

  switch (primitive) {
    case "spawn_agent": {
      const agentId = asString(record?.agentId) ?? asString(record?.id);
      const nickname = asString(record?.nickname) ?? asString(record?.name);
      return createPrimitiveSuccessEnvelope("spawn_agent", {
        ...(agentId !== undefined ? { agentId } : {}),
        ...(nickname !== undefined ? { nickname } : {}),
        payload: output
      }) as DesktopPrimitiveResultEnvelope<P>;
    }
    case "send_input": {
      const queued = asBoolean(record?.queued);
      const interrupted = asBoolean(record?.interrupted);
      const messageId = asString(record?.messageId) ?? asString(record?.id);
      return createPrimitiveSuccessEnvelope("send_input", {
        ...(queued !== undefined ? { queued } : {}),
        ...(interrupted !== undefined ? { interrupted } : {}),
        ...(messageId !== undefined ? { messageId } : {}),
        payload: output
      }) as DesktopPrimitiveResultEnvelope<P>;
    }
    case "wait_agent": {
      const agentId = asString(record?.agentId) ?? asString(record?.id);
      const agentStatus = asString(record?.status);
      const agentMessage = asString(record?.message);
      return createPrimitiveSuccessEnvelope("wait_agent", {
        ...(agentId !== undefined ? { agentId } : {}),
        ...(agentStatus !== undefined ? { agentStatus } : {}),
        ...(agentMessage !== undefined ? { agentMessage } : {}),
        payload: output
      }) as DesktopPrimitiveResultEnvelope<P>;
    }
    case "close_agent": {
      const closed = asBoolean(record?.closed) ?? true;
      const previousStatus = asString(record?.previousStatus) ?? asString(record?.status);
      return createPrimitiveSuccessEnvelope("close_agent", {
        closed,
        ...(previousStatus !== undefined ? { previousStatus } : {}),
        payload: output
      }) as DesktopPrimitiveResultEnvelope<P>;
    }
    case "automation_update": {
      const automationId = asString(record?.automationId) ?? asString(record?.id);
      const automationStatus = asString(record?.automationStatus) ?? asString(record?.status);
      return createPrimitiveSuccessEnvelope("automation_update", {
        ...(automationId !== undefined ? { automationId } : {}),
        ...(automationStatus !== undefined ? { automationStatus } : {}),
        payload: output
      }) as DesktopPrimitiveResultEnvelope<P>;
    }
    case "shell_command": {
      const exitCode = asNumber(record?.exitCode) ?? asNumber(record?.code);
      const stdout = typeof output === "string" ? output : asString(record?.stdout);
      const stderr = asString(record?.stderr);
      const structuredCommand = parseStructuredShellCommand(record?.structuredCommand)
        ?? parseStructuredShellCommand(record?.structured_command);
      return createPrimitiveSuccessEnvelope("shell_command", {
        ...(structuredCommand !== undefined ? { structuredCommand } : {}),
        ...(exitCode !== undefined ? { exitCode } : {}),
        ...(stdout !== undefined ? { stdout } : {}),
        ...(stderr !== undefined ? { stderr } : {}),
        payload: output
      }) as DesktopPrimitiveResultEnvelope<P>;
    }
    case "apply_patch": {
      const changedFiles = asNumber(record?.changedFiles);
      const summary = typeof output === "string" ? output : asString(record?.summary);
      return createPrimitiveSuccessEnvelope("apply_patch", {
        ...(changedFiles !== undefined ? { changedFiles } : {}),
        ...(summary !== undefined ? { summary } : {}),
        payload: output
      }) as DesktopPrimitiveResultEnvelope<P>;
    }
    case "read_thread_terminal": {
      const terminalOutput = typeof output === "string"
        ? output
        : asString(record?.terminalOutput) ?? asString(record?.output);
      return createPrimitiveSuccessEnvelope("read_thread_terminal", {
        ...(terminalOutput !== undefined ? { terminalOutput } : {}),
        payload: output
      }) as DesktopPrimitiveResultEnvelope<P>;
    }
    default:
      return assertNever(primitive);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function redactSuccessDetails<P extends DesktopPrimitive>(
  primitive: P,
  details: PrimitiveSuccessDetailsMap[P]
): PrimitiveSuccessDetailsMap[P] {
  if (primitive !== "shell_command") {
    return details;
  }

  return redactSecretLikeFields(details, {
    redactStrings: true
  }) as PrimitiveSuccessDetailsMap[P];
}

function redactPrimitiveResultEnvelope<P extends DesktopPrimitive>(
  envelope: DesktopPrimitiveResultEnvelope<P>
): DesktopPrimitiveResultEnvelope<P> {
  if (envelope.primitive !== "shell_command") {
    return envelope;
  }

  return redactSecretLikeFields(envelope, {
    redactStrings: true
  }) as DesktopPrimitiveResultEnvelope<P>;
}

function parseStructuredShellCommand(input: unknown): StructuredShellCommand | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const executable = asString(input.executable);
  if (!executable) {
    return undefined;
  }

  const rawArgs = Array.isArray(input.args) ? input.args : [];
  if (!rawArgs.every((arg): arg is string => typeof arg === "string")) {
    return undefined;
  }

  const shell = asBoolean(input.shell);
  return {
    executable,
    ...(rawArgs.length > 0 ? { args: [...rawArgs] } : {}),
    ...(shell !== undefined ? { shell } : {})
  };
}

function assertNever(value: never): never {
  throw new Error(`unsupported_desktop_primitive:${value}`);
}
