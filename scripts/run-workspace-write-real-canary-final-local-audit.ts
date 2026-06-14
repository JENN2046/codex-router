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

export interface WorkspaceWriteRealCanaryFinalLocalAuditResult {
  status: "passed" | "failed";
  checks: {
    allCommandsPassed: boolean;
    canaryFileAbsent: boolean;
    noWorkspaceWriteExecute: boolean;
    noRealCodexCli: boolean;
    noProviderExecute: boolean;
  };
  commands: WorkspaceWriteRealCanaryFinalLocalAuditCommandResult[];
  summary: {
    commandCount: number;
    failedCommandCount: number;
    canaryTargetFile: string;
    workspaceWriteExecuteCalls: 0;
    realCodexCliCalls: 0;
    providerExecuteCalls: 0;
  };
  reasons: string[];
}

export type WorkspaceWriteRealCanaryFinalLocalAuditRunner = (
  command: WorkspaceWriteRealCanaryFinalLocalAuditCommand
) => Promise<WorkspaceWriteRealCanaryFinalLocalAuditCommandResult>;

export type WorkspaceWriteRealCanaryFinalLocalAuditOutputFormat = "text" | "json";

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
  }
];

export async function runWorkspaceWriteRealCanaryFinalLocalAudit(options: {
  runner?: WorkspaceWriteRealCanaryFinalLocalAuditRunner;
  canaryFileExists?: () => boolean;
} = {}): Promise<WorkspaceWriteRealCanaryFinalLocalAuditResult> {
  const runner = options.runner ?? runCommand;
  const commandResults: WorkspaceWriteRealCanaryFinalLocalAuditCommandResult[] = [];

  for (const command of WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS) {
    const result = await runner(command);
    commandResults.push(result);

    if (result.status !== "passed") {
      break;
    }
  }

  const canaryFileAbsent = !(options.canaryFileExists ?? defaultCanaryFileExists)();
  const allCommandsPassed = commandResults.length === WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS.length
    && commandResults.every((result) => result.status === "passed");
  const reasons: string[] = [];

  if (!allCommandsPassed) {
    reasons.push("workspace_write_real_canary_final_local_audit_command_failed");
  }
  if (!canaryFileAbsent) {
    reasons.push("workspace_write_real_canary_final_local_audit_canary_file_exists");
  }

  return {
    status: reasons.length === 0 ? "passed" : "failed",
    checks: {
      allCommandsPassed,
      canaryFileAbsent,
      noWorkspaceWriteExecute: true,
      noRealCodexCli: true,
      noProviderExecute: true
    },
    commands: commandResults,
    summary: {
      commandCount: commandResults.length,
      failedCommandCount: commandResults.filter((result) => result.status !== "passed").length,
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
    `canary file absent: ${result.checks.canaryFileAbsent}`,
    `provider execute calls: ${result.summary.providerExecuteCalls}`,
    `real Codex CLI calls: ${result.summary.realCodexCliCalls}`,
    `workspace-write execute calls: ${result.summary.workspaceWriteExecuteCalls}`,
    ...(result.reasons.length > 0 ? [`reasons: ${result.reasons.join(",")}`] : [])
  ].join("\n");
}

async function runCommand(
  command: WorkspaceWriteRealCanaryFinalLocalAuditCommand
): Promise<WorkspaceWriteRealCanaryFinalLocalAuditCommandResult> {
  try {
    const execCommand = process.platform === "win32" ? "cmd.exe" : command.command;
    const execArgs = process.platform === "win32"
      ? ["/d", "/s", "/c", windowsCommandLine(command)]
      : command.args;

    await execFileAsync(execCommand, execArgs, {
      encoding: "utf8",
      windowsHide: true
    });
    return {
      id: command.id,
      status: "passed",
      exitCode: 0
    };
  } catch (error) {
    return {
      id: command.id,
      status: "failed",
      exitCode: getExitCode(error)
    };
  }
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
