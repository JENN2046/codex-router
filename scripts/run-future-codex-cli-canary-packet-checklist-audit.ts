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

const CHECKLIST_DOC =
  "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md";
const CONTROLLED_GATE_DOC =
  "docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md";
const READONLY_SMOKE_RECEIPT = "docs/evidence/codex-cli-real-readonly-smoke.json";
const WORKSPACE_WRITE_AUTH_EVIDENCE =
  "docs/evidence/workspace-write-real-canary-authorization-acceptance.json";
const WORKSPACE_WRITE_PRE_EXECUTION_EVIDENCE =
  "docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json";

const REQUIRED_PACKAGE_SCRIPTS = {
  "audit:future-codex-cli-canary-packet-checklist":
    "tsx scripts/run-future-codex-cli-canary-packet-checklist-audit.ts",
  "audit:controlled-execution-gate-design":
    "tsx scripts/run-controlled-execution-gate-design-audit.ts",
  "audit:readonly-real-smoke-chain-local-closeout":
    "tsx scripts/run-readonly-real-smoke-chain-local-closeout-audit.ts",
  "audit:workspace-write-real-canary-final-local":
    "tsx scripts/run-workspace-write-real-canary-final-local-audit.ts"
} as const;

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

export interface FutureCodexCliCanaryPacketChecklistAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  packageJsonText: string;
  checklistDocText: string;
  controlledGateDocText: string;
  readonlySmokeReceiptText: string;
  workspaceWriteAuthorizationEvidenceText: string;
  workspaceWritePreExecutionEvidenceText: string;
  canaryFileExists: boolean;
}

export interface FutureCodexCliCanaryPacketChecklistAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptsPresent: boolean;
    checklistRecorded: boolean;
    checklistNonAuthorizing: boolean;
    priorControlledGateRecorded: boolean;
    readonlySmokeReceiptValid: boolean;
    workspaceWriteAuthorizationEvidenceValid: boolean;
    workspaceWritePreExecutionEvidenceValid: boolean;
    exactPacketFieldsRecorded: boolean;
    preExecutionInvariantsRecorded: boolean;
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
    providerExecuteCallsDuringChecklist: 0;
    realCodexCliCallsDuringChecklist: 0;
    workspaceWriteExecuteCallsDuringChecklist: 0;
    canaryFileWritesDuringChecklist: 0;
  };
  reasons: string[];
}

export type FutureCodexCliCanaryPacketChecklistAuditOutputFormat =
  | "text"
  | "json";

export async function collectFutureCodexCliCanaryPacketChecklistAuditInput(
  cwd = process.cwd()
): Promise<FutureCodexCliCanaryPacketChecklistAuditInput> {
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
    checklistDocText: await read(cwd, CHECKLIST_DOC),
    controlledGateDocText: await read(cwd, CONTROLLED_GATE_DOC),
    readonlySmokeReceiptText: await read(cwd, READONLY_SMOKE_RECEIPT),
    workspaceWriteAuthorizationEvidenceText: await read(cwd, WORKSPACE_WRITE_AUTH_EVIDENCE),
    workspaceWritePreExecutionEvidenceText:
      await read(cwd, WORKSPACE_WRITE_PRE_EXECUTION_EVIDENCE),
    canaryFileExists: existsSync(join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE))
  };
}

export function reviewFutureCodexCliCanaryPacketChecklistAudit(
  input: FutureCodexCliCanaryPacketChecklistAuditInput
): FutureCodexCliCanaryPacketChecklistAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const readonlySmokeReceipt = parseObject(input.readonlySmokeReceiptText);
  const authorizationEvidence = parseObject(input.workspaceWriteAuthorizationEvidenceText);
  const preExecutionEvidence = parseObject(input.workspaceWritePreExecutionEvidenceText);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    checklistRecorded:
      input.checklistDocText.includes(
        "FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST_RECORDED"
      ),
    checklistNonAuthorizing: checklistIsNonAuthorizing(input.checklistDocText),
    priorControlledGateRecorded:
      input.controlledGateDocText.includes(
        "CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP_RECORDED"
      ),
    readonlySmokeReceiptValid: readonlySmokeReceiptIsValid(readonlySmokeReceipt),
    workspaceWriteAuthorizationEvidenceValid:
      authorizationEvidenceIsValid(authorizationEvidence),
    workspaceWritePreExecutionEvidenceValid:
      preExecutionEvidenceIsValid(preExecutionEvidence),
    exactPacketFieldsRecorded: exactPacketFieldsRecorded(input.checklistDocText),
    preExecutionInvariantsRecorded:
      preExecutionInvariantsRecorded(input.checklistDocText),
    canaryFileAbsent: !input.canaryFileExists,
    countersStayZero: countersStayZero(input.checklistDocText),
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
      providerExecuteCallsDuringChecklist: 0,
      realCodexCliCallsDuringChecklist: 0,
      workspaceWriteExecuteCallsDuringChecklist: 0,
      canaryFileWritesDuringChecklist: 0
    },
    reasons
  };
}

export function formatFutureCodexCliCanaryPacketChecklistAuditResult(
  review: FutureCodexCliCanaryPacketChecklistAuditResult,
  format: FutureCodexCliCanaryPacketChecklistAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Future Codex CLI canary packet checklist audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `canary target file: ${review.summary.canaryTargetFile}`,
    `provider execute calls during checklist: ${review.summary.providerExecuteCallsDuringChecklist}`,
    `real CLI calls during checklist: ${review.summary.realCodexCliCallsDuringChecklist}`,
    `workspace-write execute calls during checklist: ${review.summary.workspaceWriteExecuteCallsDuringChecklist}`,
    `canary file writes during checklist: ${review.summary.canaryFileWritesDuringChecklist}`,
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

function checklistIsNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");

  return normalized.includes("does not authorize, run, or simulate provider execute")
    && normalized.includes("real Codex CLI workspace-write execution")
    && normalized.includes("workspace-write execute")
    && normalized.includes("canary file write")
    && normalized.includes("push, release, tag")
    && normalized.includes("It is not the canary execution itself");
}

function readonlySmokeReceiptIsValid(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["status"]) === "passed"
    && getString(evidence, ["plan", "sandbox"]) === "read-only"
    && getString(evidence, ["plan", "approvalPolicy"]) === "never"
    && getBoolean(evidence, ["checks", "noWorkspaceWrite"]) === true
    && getBoolean(evidence, ["summary", "passed"]) === true;
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

function exactPacketFieldsRecorded(text: string): boolean {
  return text.includes(`authorization phrase: \`${PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE}\``)
    && text.includes("provider id: `codex-cli`")
    && text.includes("workspace: current `codex-router` workspace")
    && text.includes("branch: `main`")
    && text.includes(`target file: \`${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}\``)
    && text.includes(`allowed action: ${PR_12B_REAL_CANARY_ALLOWED_ACTION}`)
    && text.includes("side effect class: `workspace_write`")
    && text.includes("sandbox: `workspace-write`")
    && text.includes("max changed files: `1`")
    && text.includes("max diff lines: `2`")
    && text.includes("rollback required: `true`")
    && text.includes("canary file absent before execution: `true`")
    && text.includes("push authorized: `false`")
    && text.includes("release authorized: `false`")
    && text.includes("tag authorized: `false`")
    && text.includes("Any missing, broadened, mismatched, or bundled field blocks the packet.");
}

function preExecutionInvariantsRecorded(text: string): boolean {
  return [
    "clean `main` worktree",
    "local branch is not behind `origin/main`",
    "controlled execution gate audit passed",
    "read-only real smoke chain local closeout passed",
    "workspace-write real canary final local audit passed",
    "PR-12B authorization evidence remains local-only and sanitized",
    "PR-12B pre-execution evidence remains local-only and sanitized",
    "canary target file does not already exist",
    "rollback evidence is ready"
  ].every((marker) => text.includes(marker));
}

function countersStayZero(text: string): boolean {
  return text.includes("provider execute calls during checklist")
    && text.includes("real Codex CLI calls during checklist")
    && text.includes("workspace-write execute calls during checklist")
    && text.includes("canary file writes during checklist");
}

function evidenceSanitized(input: FutureCodexCliCanaryPacketChecklistAuditInput): boolean {
  return [
    input.readonlySmokeReceiptText,
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
    .map(([name]) => `future_codex_cli_canary_packet_checklist_${name}`);
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
  const input = await collectFutureCodexCliCanaryPacketChecklistAuditInput();
  const review = reviewFutureCodexCliCanaryPacketChecklistAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatFutureCodexCliCanaryPacketChecklistAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Future Codex CLI canary packet checklist audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
