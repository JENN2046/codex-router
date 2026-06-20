#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
} from "../packages/workspace-write-guard/src/index.js";

const execFileAsync = promisify(execFile);

const EXECUTION_GATE_DOC =
  "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE.md";
const AUTHORIZATION_PACKET_DOC =
  "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET.md";
const CHECKLIST_DOC =
  "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md";
const CONTROLLED_GATE_DOC =
  "docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md";
const WORKSPACE_WRITE_AUTH_EVIDENCE =
  "docs/evidence/workspace-write-real-canary-authorization-acceptance.json";
const WORKSPACE_WRITE_PRE_EXECUTION_EVIDENCE =
  "docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_GATE_FIELDS = [
  `authorization phrase: \`${PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE}\``,
  "provider id: `codex-cli`",
  "workspace: `A:\\AGENTS_OS_Workspace\\governance\\codex-router`",
  "branch: `main`",
  `target file: \`${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}\``,
  `allowed action: ${PR_12B_REAL_CANARY_ALLOWED_ACTION}`,
  "side effect class: `workspace_write`",
  "sandbox: `workspace-write`",
  "max changed files: `1`",
  "max diff lines: `2`",
  "rollback required: `true`",
  "canary file absent before execution: `true`",
  "push authorized: `false`",
  "release authorized: `false`",
  "tag authorized: `false`"
] as const;

const REQUIRED_PRECONDITIONS = [
  "clean `main` worktree",
  "local `main` aligned with `origin/main`",
  "canary target file absent",
  "controlled execution gate audit passed",
  "future canary packet checklist audit passed",
  "future canary authorization packet audit passed",
  "workspace-write real canary final local audit passed",
  "authorization evidence remains local-only and sanitized",
  "pre-execution evidence remains local-only and sanitized",
  "rollback evidence ready"
] as const;

const REQUIRED_STOP_CONDITIONS = [
  "current branch is not `main`",
  "local `main` is behind `origin/main`",
  "worktree is dirty",
  "canary target file already exists",
  "authorization packet is missing or stale",
  "rollback evidence is missing",
  "changed file limit would exceed `1`",
  "diff line limit would exceed `2`",
  "push, release, tag, deployment, or external service write is bundled",
  "secret-like or raw execution material would be emitted"
] as const;

const FORBIDDEN_MARKERS = [
  "requestedAction",
  "prompt",
  "stdout",
  "stderr",
  "raw command",
  "raw environment",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
] as const;

const FORBIDDEN_GATE_AUTHORIZATION_MARKERS = [
  "run the canary now",
  "execute the canary now",
  "workspace-write is authorized",
  "push authorized: `true`",
  "release authorized: `true`",
  "tag authorized: `true`",
  "target file: any file",
  "target file: `*`",
  "This gate provides a future execution command"
] as const;

export interface FutureCodexCliCanaryExecutionGateAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  packageJsonText: string;
  executionGateDocText: string;
  authorizationPacketDocText: string;
  checklistDocText: string;
  controlledGateDocText: string;
  workspaceWriteAuthorizationEvidenceText: string;
  workspaceWritePreExecutionEvidenceText: string;
  canaryFileExists: boolean;
}

export interface FutureCodexCliCanaryExecutionGateAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptsPresent: boolean;
    executionGateRecorded: boolean;
    gateNonExecuting: boolean;
    priorAuthorizationPacketRecorded: boolean;
    priorChecklistRecorded: boolean;
    priorControlledGateRecorded: boolean;
    exactGateFieldsRecorded: boolean;
    freshPreconditionsRecorded: boolean;
    stopConditionsRecorded: boolean;
    workspaceWriteAuthorizationEvidenceValid: boolean;
    workspaceWritePreExecutionEvidenceValid: boolean;
    canaryFileAbsent: boolean;
    countersStayZero: boolean;
    evidenceSanitized: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    canaryTargetFile: string;
    providerExecuteCallsDuringGateDesign: 0;
    realCodexCliCallsDuringGateDesign: 0;
    workspaceWriteExecuteCallsDuringGateDesign: 0;
    canaryFileWritesDuringGateDesign: 0;
  };
  reasons: string[];
}

export type FutureCodexCliCanaryExecutionGateAuditOutputFormat =
  | "text"
  | "json";

export async function collectFutureCodexCliCanaryExecutionGateAuditInput(
  cwd = process.cwd()
): Promise<FutureCodexCliCanaryExecutionGateAuditInput> {
  const [gitStatusShort, branch, aheadBehind] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-list", "--left-right", "--count", "HEAD...origin/main"], cwd)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    aheadBehind: aheadBehind.trim(),
    packageJsonText: await read(cwd, "package.json"),
    executionGateDocText: await read(cwd, EXECUTION_GATE_DOC),
    authorizationPacketDocText: await read(cwd, AUTHORIZATION_PACKET_DOC),
    checklistDocText: await read(cwd, CHECKLIST_DOC),
    controlledGateDocText: await read(cwd, CONTROLLED_GATE_DOC),
    workspaceWriteAuthorizationEvidenceText: await read(cwd, WORKSPACE_WRITE_AUTH_EVIDENCE),
    workspaceWritePreExecutionEvidenceText:
      await read(cwd, WORKSPACE_WRITE_PRE_EXECUTION_EVIDENCE),
    canaryFileExists: existsSync(join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE))
  };
}

export function reviewFutureCodexCliCanaryExecutionGateAudit(
  input: FutureCodexCliCanaryExecutionGateAuditInput
): FutureCodexCliCanaryExecutionGateAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const authorizationEvidence = parseObject(input.workspaceWriteAuthorizationEvidenceText);
  const preExecutionEvidence = parseObject(input.workspaceWritePreExecutionEvidenceText);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    executionGateRecorded:
      input.executionGateDocText.includes(
        "FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE_RECORDED"
      ),
    gateNonExecuting: gateIsNonExecuting(input.executionGateDocText),
    priorAuthorizationPacketRecorded:
      input.authorizationPacketDocText.includes(
        "FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET_DRAFTED"
      ),
    priorChecklistRecorded:
      input.checklistDocText.includes(
        "FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST_RECORDED"
      ),
    priorControlledGateRecorded:
      input.controlledGateDocText.includes(
        "CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP_RECORDED"
      ),
    exactGateFieldsRecorded: REQUIRED_GATE_FIELDS.every((field) =>
      input.executionGateDocText.includes(field)
    ),
    freshPreconditionsRecorded: REQUIRED_PRECONDITIONS.every((field) =>
      input.executionGateDocText.includes(field)
    ),
    stopConditionsRecorded: REQUIRED_STOP_CONDITIONS.every((field) =>
      input.executionGateDocText.includes(field)
    ),
    workspaceWriteAuthorizationEvidenceValid:
      authorizationEvidenceIsValid(authorizationEvidence),
    workspaceWritePreExecutionEvidenceValid:
      preExecutionEvidenceIsValid(preExecutionEvidence),
    canaryFileAbsent: !input.canaryFileExists,
    countersStayZero: countersStayZero(input.executionGateDocText),
    evidenceSanitized: evidenceSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      ahead,
      behind,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      canaryTargetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
      providerExecuteCallsDuringGateDesign: 0,
      realCodexCliCallsDuringGateDesign: 0,
      workspaceWriteExecuteCallsDuringGateDesign: 0,
      canaryFileWritesDuringGateDesign: 0
    },
    reasons
  };
}

export function formatFutureCodexCliCanaryExecutionGateAuditResult(
  review: FutureCodexCliCanaryExecutionGateAuditResult,
  format: FutureCodexCliCanaryExecutionGateAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Future Codex CLI canary execution gate audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `canary target file: ${review.summary.canaryTargetFile}`,
    `provider execute calls during gate design: ${review.summary.providerExecuteCallsDuringGateDesign}`,
    `real CLI calls during gate design: ${review.summary.realCodexCliCallsDuringGateDesign}`,
    `workspace-write execute calls during gate design: ${review.summary.workspaceWriteExecuteCallsDuringGateDesign}`,
    `canary file writes during gate design: ${review.summary.canaryFileWritesDuringGateDesign}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return stdout;
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function reviewPackageScripts(packageJson: Record<string, unknown> | undefined): {
  targetCount: number;
  mismatchCount: number;
} {
  const scripts = packageJson?.scripts;
  const entries = Object.entries(REQUIRED_PACKAGE_SCRIPTS);

  return {
    targetCount: entries.length,
    mismatchCount: entries.filter(
      ([scriptName, expectedCommand]) =>
        !isRecord(scripts) || scripts[scriptName] !== expectedCommand
    ).length
  };
}

function gateIsNonExecuting(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  return normalized.includes("does not authorize, run, or simulate provider execute")
    && normalized.includes("real Codex CLI workspace-write execution")
    && normalized.includes("workspace-write execute")
    && normalized.includes("canary file write")
    && normalized.includes("push, release, tag")
    && normalized.includes("This gate does not provide or run a future execution command")
    && normalized.includes("It is not the canary execution itself")
    && FORBIDDEN_GATE_AUTHORIZATION_MARKERS.every((marker) =>
      !lower.includes(marker.toLowerCase())
    );
}

function authorizationEvidenceIsValid(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["mode"]) === "workspace-write-real-canary-authorization-local-only"
    && getBoolean(evidence, ["checks", "exactAuthorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "broadenedAuthorizationBlocked"]) === true
    && getBoolean(evidence, ["checks", "pushAuthorizationRejected"]) === true
    && getString(evidence, ["summary", "targetFile"]) === DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
    && getString(evidence, ["summary", "branch"]) === "main"
    && getString(evidence, ["summary", "requiredSandbox"]) === "workspace-write"
    && getBoolean(evidence, ["summary", "requiredRollback"]) === true
    && getBoolean(evidence, ["summary", "pushMustBeSeparate"]) === true
    && evidenceCountersAreZero(evidence);
}

function preExecutionEvidenceIsValid(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["mode"]) === "workspace-write-real-canary-pre-execution-local-only"
    && getBoolean(evidence, ["checks", "authorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "preExecutionGateReady"]) === true
    && getBoolean(evidence, ["checks", "existingCanaryFileBlocksGate"]) === true
    && getString(evidence, ["summary", "providerId"]) === "codex-cli"
    && getString(evidence, ["summary", "targetFile"]) === DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
    && getString(evidence, ["summary", "sideEffectClass"]) === "workspace_write"
    && getString(evidence, ["summary", "sandbox"]) === "workspace-write"
    && getBoolean(evidence, ["summary", "pushDisallowed"]) === true
    && getBoolean(evidence, ["summary", "rollbackReady"]) === true
    && evidenceCountersAreZero(evidence);
}

function countersStayZero(text: string): boolean {
  return text.includes("provider execute calls during gate design")
    && text.includes("real Codex CLI calls during gate design")
    && text.includes("workspace-write execute calls during gate design")
    && text.includes("canary file writes during gate design");
}

function evidenceSanitized(input: FutureCodexCliCanaryExecutionGateAuditInput): boolean {
  return [
    input.workspaceWriteAuthorizationEvidenceText,
    input.workspaceWritePreExecutionEvidenceText
  ].every((text) => !containsForbiddenMarker(text));
}

function evidenceCountersAreZero(evidence: Record<string, unknown> | undefined): boolean {
  return getNumber(evidence, ["counters", "providerExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "realCodexCliCalls"]) === 0
    && getNumber(evidence, ["counters", "workspaceWriteExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "canaryFileWrites"]) === 0;
}

function containsForbiddenMarker(text: string): boolean {
  return FORBIDDEN_MARKERS.some((marker) => text.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `future_codex_cli_canary_execution_gate_${name}`);
}

function parseAheadBehind(value: string): { ahead: number; behind: number } {
  const [aheadText, behindText] = value.split(/\s+/);
  return {
    ahead: Number(aheadText ?? 0),
    behind: Number(behindText ?? 0)
  };
}

function parseObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function getBoolean(
  value: Record<string, unknown> | undefined,
  path: string[]
): boolean | undefined {
  const found = getPath(value, path);
  return typeof found === "boolean" ? found : undefined;
}

function getNumber(
  value: Record<string, unknown> | undefined,
  path: string[]
): number | undefined {
  const found = getPath(value, path);
  return typeof found === "number" ? found : undefined;
}

function getString(
  value: Record<string, unknown> | undefined,
  path: string[]
): string | undefined {
  const found = getPath(value, path);
  return typeof found === "string" ? found : undefined;
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

async function main(): Promise<void> {
  const input = await collectFutureCodexCliCanaryExecutionGateAuditInput();
  const review = reviewFutureCodexCliCanaryExecutionGateAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatFutureCodexCliCanaryExecutionGateAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Future Codex CLI canary execution gate audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
