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

const DESIGN_DOC = "docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md";
const REAL_READONLY_SMOKE_RECEIPT = "docs/evidence/codex-cli-real-readonly-smoke.json";
const PR_12B_AUTH_EVIDENCE =
  "docs/evidence/workspace-write-real-canary-authorization-acceptance.json";
const PR_12B_PRE_EXECUTION_EVIDENCE =
  "docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json";

const REQUIRED_PACKAGE_SCRIPTS = {
  "audit:controlled-execution-gate-design":
    "tsx scripts/run-controlled-execution-gate-design-audit.ts",
  "audit:readonly-real-smoke-chain-local-closeout":
    "tsx scripts/run-readonly-real-smoke-chain-local-closeout-audit.ts",
  "acceptance:workspace-write-real-canary-auth":
    "tsx scripts/run-workspace-write-real-canary-authorization-acceptance.ts",
  "acceptance:workspace-write-real-canary-pre-execution":
    "tsx scripts/run-workspace-write-real-canary-pre-execution-acceptance.ts",
  "audit:workspace-write-real-canary-sensitive-scan":
    "tsx scripts/run-workspace-write-real-canary-sensitive-scan.ts",
  "audit:workspace-write-real-canary-final-local":
    "tsx scripts/run-workspace-write-real-canary-final-local-audit.ts"
} as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "requestedAction",
  "prompt",
  "stdout",
  "stderr",
  "raw command",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
] as const;

export interface ControlledExecutionGateDesignAuditInput {
  gitStatusShort: string;
  branch: string;
  packageJsonText: string;
  designDocText: string;
  realReadonlySmokeReceiptText: string;
  workspaceWriteAuthorizationEvidenceText: string;
  workspaceWritePreExecutionEvidenceText: string;
  canaryFileExists: boolean;
}

export interface ControlledExecutionGateDesignAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    packageScriptsPresent: boolean;
    designRecorded: boolean;
    designNonAuthorizing: boolean;
    realReadonlySmokePassed: boolean;
    canaryAuthorizationEvidenceReady: boolean;
    canaryPreExecutionEvidenceReady: boolean;
    canaryFileAbsent: boolean;
    futurePacketFieldsExact: boolean;
    countersStayZero: boolean;
    outputSanitized: boolean;
  };
  summary: {
    branch: string;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    canaryTargetFile: string;
    providerExecuteCallsDuringDesign: 0;
    realCodexCliCallsDuringDesign: 0;
    workspaceWriteExecuteCallsDuringDesign: 0;
    canaryFileWritesDuringDesign: 0;
  };
  reasons: string[];
}

export type ControlledExecutionGateDesignAuditOutputFormat = "text" | "json";

export async function collectControlledExecutionGateDesignAuditInput(
  cwd = process.cwd()
): Promise<ControlledExecutionGateDesignAuditInput> {
  const [gitStatusShort, branch] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    packageJsonText: await read(cwd, "package.json"),
    designDocText: await read(cwd, DESIGN_DOC),
    realReadonlySmokeReceiptText: await read(cwd, REAL_READONLY_SMOKE_RECEIPT),
    workspaceWriteAuthorizationEvidenceText: await read(cwd, PR_12B_AUTH_EVIDENCE),
    workspaceWritePreExecutionEvidenceText: await read(cwd, PR_12B_PRE_EXECUTION_EVIDENCE),
    canaryFileExists: existsSync(join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE))
  };
}

export function reviewControlledExecutionGateDesignAudit(
  input: ControlledExecutionGateDesignAuditInput
): ControlledExecutionGateDesignAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const realReadonlySmokeReceipt = parseObject(input.realReadonlySmokeReceiptText);
  const authEvidence = parseObject(input.workspaceWriteAuthorizationEvidenceText);
  const preExecutionEvidence = parseObject(input.workspaceWritePreExecutionEvidenceText);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    designRecorded:
      input.designDocText.includes("CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP_RECORDED"),
    designNonAuthorizing: designIsNonAuthorizing(input.designDocText),
    realReadonlySmokePassed: realReadonlySmokePassed(realReadonlySmokeReceipt),
    canaryAuthorizationEvidenceReady: canaryAuthorizationEvidenceReady(authEvidence),
    canaryPreExecutionEvidenceReady: canaryPreExecutionEvidenceReady(preExecutionEvidence),
    canaryFileAbsent: !input.canaryFileExists,
    futurePacketFieldsExact: futurePacketFieldsExact(input.designDocText),
    countersStayZero: countersStayZero(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      canaryTargetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
      providerExecuteCallsDuringDesign: 0,
      realCodexCliCallsDuringDesign: 0,
      workspaceWriteExecuteCallsDuringDesign: 0,
      canaryFileWritesDuringDesign: 0
    },
    reasons
  };
}

export function formatControlledExecutionGateDesignAuditResult(
  review: ControlledExecutionGateDesignAuditResult,
  format: ControlledExecutionGateDesignAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Controlled execution gate design audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `canary target file: ${review.summary.canaryTargetFile}`,
    `provider execute calls during design: ${review.summary.providerExecuteCallsDuringDesign}`,
    `real CLI calls during design: ${review.summary.realCodexCliCallsDuringDesign}`,
    `workspace-write execute calls during design: ${review.summary.workspaceWriteExecuteCallsDuringDesign}`,
    `canary file writes during design: ${review.summary.canaryFileWritesDuringDesign}`,
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

function designIsNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");

  return normalized.includes("does not implement, enable, or run workspace-write execution")
    && normalized.includes("general provider execution")
    && normalized.includes("real Codex CLI workspace-write smoke")
    && normalized.includes("push, release, tag")
    && normalized.includes("external service write")
    && normalized.includes("It is not to run workspace-write execution");
}

function realReadonlySmokePassed(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["status"]) === "passed"
    && getString(evidence, ["plan", "sandbox"]) === "read-only"
    && getString(evidence, ["plan", "approvalPolicy"]) === "never"
    && getBoolean(evidence, ["checks", "noWorkspaceWrite"]) === true
    && getBoolean(evidence, ["summary", "passed"]) === true;
}

function canaryAuthorizationEvidenceReady(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["mode"]) === "workspace-write-real-canary-authorization-local-only"
    && getBoolean(evidence, ["checks", "exactAuthorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "pushAuthorizationRejected"]) === true
    && getNumber(evidence, ["counters", "workspaceWriteExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "realCodexCliCalls"]) === 0
    && getNumber(evidence, ["counters", "providerExecuteCalls"]) === 0;
}

function canaryPreExecutionEvidenceReady(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["mode"]) === "workspace-write-real-canary-pre-execution-local-only"
    && getBoolean(evidence, ["checks", "authorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "preExecutionGateReady"]) === true
    && getString(evidence, ["summary", "targetFile"]) === DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
    && getString(evidence, ["summary", "sideEffectClass"]) === "workspace_write"
    && getString(evidence, ["summary", "sandbox"]) === "workspace-write"
    && getBoolean(evidence, ["summary", "pushDisallowed"]) === true
    && getBoolean(evidence, ["summary", "rollbackReady"]) === true
    && getNumber(evidence, ["counters", "workspaceWriteExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "realCodexCliCalls"]) === 0
    && getNumber(evidence, ["counters", "providerExecuteCalls"]) === 0;
}

function futurePacketFieldsExact(text: string): boolean {
  return text.includes(`authorization phrase: \`${PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE}\``)
    && text.includes("workspace: the current `codex-router` workspace")
    && text.includes("branch: `main`")
    && text.includes(`target file: \`${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}\``)
    && text.includes(`allowed action: ${PR_12B_REAL_CANARY_ALLOWED_ACTION}`)
    && text.includes("sandbox: `workspace-write`")
    && text.includes("rollback required: `true`")
    && text.includes("push authorized: `false`")
    && text.includes("Any missing, broadened, or mismatched field blocks the gate.");
}

function countersStayZero(input: ControlledExecutionGateDesignAuditInput): boolean {
  return input.designDocText.includes("provider execute calls during design")
    && input.designDocText.includes("real Codex CLI calls during design")
    && input.designDocText.includes("workspace-write execute calls during design")
    && input.designDocText.includes("canary file writes during design");
}

function outputSanitized(input: ControlledExecutionGateDesignAuditInput): boolean {
  return [
    input.realReadonlySmokeReceiptText,
    input.workspaceWriteAuthorizationEvidenceText,
    input.workspaceWritePreExecutionEvidenceText
  ].every((text) => !containsForbiddenOutputMarker(text));
}

function containsForbiddenOutputMarker(text: string): boolean {
  return FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `controlled_execution_gate_design_${name}`);
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
  const input = await collectControlledExecutionGateDesignAuditInput();
  const review = reviewControlledExecutionGateDesignAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatControlledExecutionGateDesignAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Controlled execution gate design audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
