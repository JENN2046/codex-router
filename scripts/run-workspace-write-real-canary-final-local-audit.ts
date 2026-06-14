#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE } from "../packages/workspace-write-guard/src/index.js";

const execFileAsync = promisify(execFile);

export interface WorkspaceWriteRealCanaryFinalLocalAuditCommand {
  id: string;
  command: string;
  args: string[];
}

export interface WorkspaceWriteRealCanaryFinalLocalAuditCommandResult {
  id: string;
  status: "passed" | "failed";
  exitCode: number;
}

interface WorkspaceWriteRealCanaryFinalLocalAuditRunnerResult
  extends WorkspaceWriteRealCanaryFinalLocalAuditCommandResult {
  stdout?: string;
}

export interface WorkspaceWriteRealCanaryFinalLocalAuditResult {
  status: "passed" | "failed";
  checks: {
    allCommandsPassed: boolean;
    noForbiddenCommands: boolean;
    sensitiveScanJsonContractValid: boolean;
    canaryFileAbsent: boolean;
    noWorkspaceWriteExecute: boolean;
    noRealCodexCli: boolean;
    noProviderExecute: boolean;
  };
  commands: WorkspaceWriteRealCanaryFinalLocalAuditCommandResult[];
  summary: {
    commandCount: number;
    failedCommandCount: number;
    sensitiveScanTargetCount: number;
    sensitiveScanMarkerHitCount: number;
    canaryTargetFile: string;
    workspaceWriteExecuteCalls: 0;
    realCodexCliCalls: 0;
    providerExecuteCalls: 0;
  };
  reasons: string[];
}

export type WorkspaceWriteRealCanaryFinalLocalAuditRunner = (
  command: WorkspaceWriteRealCanaryFinalLocalAuditCommand
) => Promise<WorkspaceWriteRealCanaryFinalLocalAuditRunnerResult>;

export type WorkspaceWriteRealCanaryFinalLocalAuditOutputFormat = "text" | "json";

export const WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_FORBIDDEN_COMMAND_MARKERS = [
  "model:check",
  "smoke:",
  "smoke:readonly:real",
  "smoke:workspace-write:telemetry",
  "canary:write",
  "canary:external",
  "run-codex-cli-real-readonly-smoke",
  "run-codex-cli-workspace-write-smoke",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE"
] as const;

export const WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS: readonly WorkspaceWriteRealCanaryFinalLocalAuditCommand[] = [
  {
    id: "typecheck",
    command: npmExecutable(),
    args: ["run", "typecheck"]
  },
  {
    id: "workspace-write-guard-tests",
    command: npxExecutable(),
    args: ["tsx", "--test", "tests\\workspace-write-guard.test.ts"]
  },
  {
    id: "real-canary-authorization-acceptance-tests",
    command: npxExecutable(),
    args: ["tsx", "--test", "tests\\workspace-write-real-canary-authorization-acceptance.test.ts"]
  },
  {
    id: "real-canary-pre-execution-acceptance-tests",
    command: npxExecutable(),
    args: ["tsx", "--test", "tests\\workspace-write-real-canary-pre-execution-acceptance.test.ts"]
  },
  {
    id: "real-canary-candidate-consistency-tests",
    command: npxExecutable(),
    args: ["tsx", "--test", "tests\\workspace-write-real-canary-local-candidate-consistency.test.ts"]
  },
  {
    id: "real-canary-sensitive-scan-tests",
    command: npxExecutable(),
    args: ["tsx", "--test", "tests\\workspace-write-real-canary-sensitive-scan.test.ts"]
  },
  {
    id: "real-canary-authorization-acceptance",
    command: npmExecutable(),
    args: ["run", "acceptance:workspace-write-real-canary-auth"]
  },
  {
    id: "real-canary-pre-execution-acceptance",
    command: npmExecutable(),
    args: ["run", "acceptance:workspace-write-real-canary-pre-execution"]
  },
  {
    id: "real-canary-candidate-audit-json",
    command: npmExecutable(),
    args: ["run", "audit:workspace-write-real-canary-candidate", "--", "--json"]
  },
  {
    id: "real-canary-sensitive-scan-json",
    command: npmExecutable(),
    args: ["run", "audit:workspace-write-real-canary-sensitive-scan", "--", "--json"]
  }
];

export async function runWorkspaceWriteRealCanaryFinalLocalAudit(options: {
  runner?: WorkspaceWriteRealCanaryFinalLocalAuditRunner;
  canaryFileExists?: () => boolean;
  commands?: readonly WorkspaceWriteRealCanaryFinalLocalAuditCommand[];
} = {}): Promise<WorkspaceWriteRealCanaryFinalLocalAuditResult> {
  const runner = options.runner ?? runCommand;
  const commands = options.commands ?? WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS;
  const commandResults: WorkspaceWriteRealCanaryFinalLocalAuditCommandResult[] = [];
  let sensitiveScanStdout: string | undefined;
  const noForbiddenCommands = commandsDoNotContainForbiddenMarkers(commands);

  if (noForbiddenCommands) {
    for (const command of commands) {
      const result = await runner(command);
      commandResults.push(toCommandResult(result));

      if (command.id === "real-canary-sensitive-scan-json") {
        sensitiveScanStdout = result.stdout;
      }

      if (result.status !== "passed") {
        break;
      }
    }
  }

  const canaryFileAbsent = !(options.canaryFileExists ?? defaultCanaryFileExists)();
  const allCommandsPassed = noForbiddenCommands
    && commandResults.length === commands.length
    && commandResults.every((result) => result.status === "passed");
  const sensitiveScanSummary = parseSensitiveScanSummary(sensitiveScanStdout);
  const sensitiveScanCommandRequired = commands.some(
    (command) => command.id === "real-canary-sensitive-scan-json"
  );
  const sensitiveScanCommandPassed = commandResults.some(
    (result) => result.id === "real-canary-sensitive-scan-json" && result.status === "passed"
  );
  const sensitiveScanJsonContractValid = !sensitiveScanCommandRequired
    || (sensitiveScanCommandPassed
      && sensitiveScanSummary.targetCount > 0
      && sensitiveScanSummary.markerHitCount === 0);
  const reasons: string[] = [];

  if (!noForbiddenCommands) {
    reasons.push("workspace_write_real_canary_final_local_audit_forbidden_command");
  }
  if (!allCommandsPassed) {
    reasons.push("workspace_write_real_canary_final_local_audit_command_failed");
  }
  if (!sensitiveScanJsonContractValid) {
    reasons.push("workspace_write_real_canary_final_local_audit_sensitive_scan_json_invalid");
  }
  if (!canaryFileAbsent) {
    reasons.push("workspace_write_real_canary_final_local_audit_canary_file_exists");
  }

  return {
    status: reasons.length === 0 ? "passed" : "failed",
    checks: {
      allCommandsPassed,
      noForbiddenCommands,
      sensitiveScanJsonContractValid,
      canaryFileAbsent,
      noWorkspaceWriteExecute: true,
      noRealCodexCli: true,
      noProviderExecute: true
    },
    commands: commandResults,
    summary: {
      commandCount: commandResults.length,
      failedCommandCount: commandResults.filter((result) => result.status !== "passed").length,
      sensitiveScanTargetCount: sensitiveScanSummary.targetCount,
      sensitiveScanMarkerHitCount: sensitiveScanSummary.markerHitCount,
      canaryTargetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
      workspaceWriteExecuteCalls: 0,
      realCodexCliCalls: 0,
      providerExecuteCalls: 0
    },
    reasons
  };
}

export function formatWorkspaceWriteRealCanaryFinalLocalAuditResult(
  result: WorkspaceWriteRealCanaryFinalLocalAuditResult,
  format: WorkspaceWriteRealCanaryFinalLocalAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  return [
    "Workspace-write real canary final local audit",
    `status: ${result.status}`,
    `commands: ${result.summary.commandCount}`,
    `failed commands: ${result.summary.failedCommandCount}`,
    `forbidden commands: ${!result.checks.noForbiddenCommands}`,
    `sensitive scan targets: ${result.summary.sensitiveScanTargetCount}`,
    `sensitive scan marker hits: ${result.summary.sensitiveScanMarkerHitCount}`,
    `canary file absent: ${result.checks.canaryFileAbsent}`,
    `provider execute calls: ${result.summary.providerExecuteCalls}`,
    `real Codex CLI calls: ${result.summary.realCodexCliCalls}`,
    `workspace-write execute calls: ${result.summary.workspaceWriteExecuteCalls}`,
    ...(result.reasons.length > 0 ? [`reasons: ${result.reasons.join(",")}`] : [])
  ].join("\n");
}

function toCommandResult(
  result: WorkspaceWriteRealCanaryFinalLocalAuditRunnerResult
): WorkspaceWriteRealCanaryFinalLocalAuditCommandResult {
  return {
    id: result.id,
    status: result.status,
    exitCode: result.exitCode
  };
}

function parseSensitiveScanSummary(stdout: string | undefined): {
  targetCount: number;
  markerHitCount: number;
} {
  const parsed = parseJsonObjectFromOutput(stdout);
  const targetCount = getNumber(parsed, ["summary", "targetCount"]);
  const markerHitCount = getNumber(parsed, ["summary", "markerHitCount"]);

  return {
    targetCount: targetCount ?? -1,
    markerHitCount: markerHitCount ?? -1
  };
}

function parseJsonObjectFromOutput(output: string | undefined): Record<string, unknown> | undefined {
  if (output === undefined) {
    return undefined;
  }
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(output.slice(start, end + 1)) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function commandsDoNotContainForbiddenMarkers(
  commands: readonly WorkspaceWriteRealCanaryFinalLocalAuditCommand[]
): boolean {
  const commandContractText = commands
    .map((command) => [command.id, command.command, ...command.args].join(" "))
    .join("\n");

  return WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_FORBIDDEN_COMMAND_MARKERS.every(
    (marker) => !commandContractText.includes(marker)
  );
}

async function runCommand(
  command: WorkspaceWriteRealCanaryFinalLocalAuditCommand
): Promise<WorkspaceWriteRealCanaryFinalLocalAuditRunnerResult> {
  try {
    const execCommand = process.platform === "win32" ? "cmd.exe" : command.command;
    const execArgs = process.platform === "win32"
      ? ["/d", "/s", "/c", windowsCommandLine(command)]
      : command.args;

    const { stdout } = await execFileAsync(execCommand, execArgs, {
      encoding: "utf8",
      windowsHide: true
    });
    return {
      id: command.id,
      status: "passed",
      exitCode: 0,
      stdout
    };
  } catch (error) {
    return {
      id: command.id,
      status: "failed",
      exitCode: getExitCode(error)
    };
  }
}

function getNumber(
  value: Record<string, unknown> | undefined,
  path: string[]
): number | undefined {
  const found = getPath(value, path);
  return typeof found === "number" ? found : undefined;
}

function getPath(
  value: Record<string, unknown> | undefined,
  path: string[]
): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function windowsCommandLine(command: WorkspaceWriteRealCanaryFinalLocalAuditCommand): string {
  return [command.command, ...command.args].map(windowsQuoteArg).join(" ");
}

function windowsQuoteArg(value: string): string {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function getExitCode(error: unknown): number {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "number" ? code : 1;
  }

  return 1;
}

function defaultCanaryFileExists(): boolean {
  return existsSync(DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
}

function npmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxExecutable(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

async function main(): Promise<void> {
  const result = await runWorkspaceWriteRealCanaryFinalLocalAudit();
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatWorkspaceWriteRealCanaryFinalLocalAuditResult(result, format));

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Workspace-write real canary final local audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
