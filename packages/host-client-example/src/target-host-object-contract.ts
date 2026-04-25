import {
  assertCodexDesktopLiveHostObject,
  inspectCodexDesktopLiveHostObject,
  type CodexDesktopLiveHostInspection,
  type CodexDesktopLiveHostObject
} from "../../codex-desktop-live-host/src/index.js";

export const CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS = [
  "read_thread_terminal",
  "spawn_agent",
  "wait_agent",
  "send_input",
  "close_agent",
  "shell_command",
  "apply_patch",
  "automation_update"
] as const;

export const CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS = [
  "record_memory",
  "search_memory"
] as const;

export const CODEX_DESKTOP_TARGET_HOST_OPTIONAL_MEMORY_METHODS = [
  "memory_overview"
] as const;

const CODEX_DESKTOP_TARGET_HOST_PLACEHOLDER_TAG =
  "__codexDesktopTargetHostPlaceholderMethod";

type CodexDesktopTargetHostRequiredMethod =
  | typeof CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS[number]
  | typeof CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS[number];

type CodexDesktopTargetHostMethod =
  | CodexDesktopTargetHostRequiredMethod
  | typeof CODEX_DESKTOP_TARGET_HOST_OPTIONAL_MEMORY_METHODS[number];

type PlaceholderHostMethod = ((...args: unknown[]) => never) & {
  [CODEX_DESKTOP_TARGET_HOST_PLACEHOLDER_TAG]: string;
};

export interface CodexDesktopTargetHostContractInspection
  extends CodexDesktopLiveHostInspection {
  placeholderMethods: string[];
}

export type CodexDesktopTargetHostOverrides = Partial<CodexDesktopLiveHostObject>;

export function createCodexDesktopTargetHostObjectContract(
  overrides: CodexDesktopTargetHostOverrides = {}
): CodexDesktopLiveHostObject {
  return {
    read_thread_terminal: resolveRequiredMethod(
      "read_thread_terminal",
      overrides.read_thread_terminal
    ),
    spawn_agent: resolveRequiredMethod("spawn_agent", overrides.spawn_agent),
    wait_agent: resolveRequiredMethod("wait_agent", overrides.wait_agent),
    send_input: resolveRequiredMethod("send_input", overrides.send_input),
    close_agent: resolveRequiredMethod("close_agent", overrides.close_agent),
    shell_command: resolveRequiredMethod(
      "shell_command",
      overrides.shell_command
    ),
    apply_patch: resolveRequiredMethod("apply_patch", overrides.apply_patch),
    automation_update: resolveRequiredMethod(
      "automation_update",
      overrides.automation_update
    ),
    record_memory: resolveRequiredMethod(
      "record_memory",
      overrides.record_memory
    ),
    search_memory: resolveRequiredMethod(
      "search_memory",
      overrides.search_memory
    ),
    ...(typeof overrides.memory_overview === "function"
      ? { memory_overview: overrides.memory_overview }
      : {})
  };
}

export function inspectCodexDesktopTargetHostObjectContract(
  host: Partial<CodexDesktopLiveHostObject>
): CodexDesktopTargetHostContractInspection {
  const inspection = inspectCodexDesktopLiveHostObject(host);
  const placeholderMethods = getCodexDesktopTargetHostPlaceholderMethods(host);

  return {
    ...inspection,
    ready: inspection.ready && placeholderMethods.length === 0,
    placeholderMethods
  };
}

export function getCodexDesktopTargetHostPlaceholderMethods(
  host: Partial<CodexDesktopLiveHostObject>
): string[] {
  return [
    ...CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS,
    ...CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS,
    ...CODEX_DESKTOP_TARGET_HOST_OPTIONAL_MEMORY_METHODS
  ].filter((method) => isPlaceholderMethod(host[method]));
}

export function assertCodexDesktopTargetHostObjectContract(
  host: Partial<CodexDesktopLiveHostObject>
): asserts host is CodexDesktopLiveHostObject {
  assertCodexDesktopLiveHostObject(host);

  const placeholderMethods = getCodexDesktopTargetHostPlaceholderMethods(host);
  if (placeholderMethods.length === 0) {
    return;
  }

  throw new Error(
    `codex_desktop_target_host_contract_unwired_methods:${placeholderMethods.join(",")}`
  );
}

function resolveRequiredMethod<T extends CodexDesktopTargetHostRequiredMethod>(
  method: T,
  value: CodexDesktopTargetHostOverrides[T]
): CodexDesktopLiveHostObject[T] {
  return (
    typeof value === "function" ? value : createPlaceholderMethod(method)
  ) as CodexDesktopLiveHostObject[T];
}

function createPlaceholderMethod(
  method: CodexDesktopTargetHostMethod
): PlaceholderHostMethod {
  const placeholder = (() => {
    throw new Error(
      `codex_desktop_target_host_contract_method_not_wired:${method}`
    );
  }) as PlaceholderHostMethod;

  placeholder[CODEX_DESKTOP_TARGET_HOST_PLACEHOLDER_TAG] = method;
  return placeholder;
}

function isPlaceholderMethod(value: unknown): value is PlaceholderHostMethod {
  return (
    typeof value === "function"
    && CODEX_DESKTOP_TARGET_HOST_PLACEHOLDER_TAG in (value as unknown as object)
  );
}
