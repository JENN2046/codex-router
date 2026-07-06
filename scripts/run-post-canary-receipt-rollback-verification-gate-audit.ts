#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
} from "../packages/governance-internal-workspace-write-guard/src/index.js";

const execFileAsync = promisify(execFile);

const RECEIPT_DOC =
  "docs/governance/POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE.md";
const REAL_CANARY_EVIDENCE =
  "docs/evidence/codex-cli-workspace-write-real-canary-latest.json";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_RECEIPT_FIELDS = [
  `evidence path: \`${REAL_CANARY_EVIDENCE}\``,
  "evidence status: `passed`",
  `target file: \`${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}\``,
  "sandbox: `workspace-write`",
  "approval policy: `on-request`",
  "execution status: `completed`",
  "exit code: `0`",
  "parse error count: `0`",
  "blocking reasons: `[]`",
  "rollback verification: canary file absent",
  "push authorized: `false`",
  "release authorized: `false`",
  "tag authorized: `false`",
  "deployment authorized: `false`",
  "general provider execution authorized: `false`",
  "general workspace-write authorized: `false`"
] as const;

const REQUIRED_STOP_CONDITIONS = [
  "current branch is not `main`",
  "local `main` is not aligned with `origin/main`",
  "worktree is dirty",
  "canary target file exists",
  "evidence file is missing",
  "evidence status is not `passed`",
  `evidence target file is not \`${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}\``,
  "evidence sandbox is not `workspace-write`",
  "evidence approval policy is not `on-request`",
  "evidence execution status is not `completed`",
  "evidence exit code is not `0`",
  "evidence parse error count is not `0`",
  "evidence blocking reasons are not `[]`",
  "receipt text authorizes push, release, tag, deployment, general provider",
  "receipt or evidence emits raw execution material or secret-like markers"
] as const;

const FORBIDDEN_MARKERS = [
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

const FORBIDDEN_AUTHORIZATION_MARKERS = [
  "push authorized: `true`",
  "release authorized: `true`",
  "tag authorized: `true`",
  "deployment authorized: `true`",
  "general provider execution authorized: `true`",
  "general workspace-write authorized: `true`",
  "run another workspace-write canary now",
  "execute another workspace-write canary now"
] as const;

export interface PostCanaryReceiptRollbackVerificationGateAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  packageJsonText: string;
  receiptDocText: string;
  evidenceText: string;
  canaryFileExists: boolean;
}

export interface PostCanaryReceiptRollbackVerificationGateAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    mainAlignedWithOrigin: boolean;
    packageScriptsPresent: boolean;
    receiptRecorded: boolean;
    receiptNonExecuting: boolean;
    requiredReceiptFieldsRecorded: boolean;
    stopConditionsRecorded: boolean;
    realCanaryEvidenceValid: boolean;
    rollbackVerified: boolean;
    canaryFileAbsent: boolean;
    evidenceSanitized: boolean;
    countersStayZero: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    canaryTargetFile: string;
    evidenceStatus: string;
    executionStatus: string;
    exitCode: number;
    parseErrorCount: number;
    providerExecuteCallsDuringReview: 0;
    realCodexCliCallsDuringReview: 0;
    workspaceWriteExecuteCallsDuringReview: 0;
    canaryFileWritesDuringReview: 0;
    additionalCanaryRunsDuringReview: 0;
  };
  reasons: string[];
}

export type PostCanaryReceiptRollbackVerificationGateAuditOutputFormat =
  | "text"
  | "json";

export async function collectPostCanaryReceiptRollbackVerificationGateAuditInput(
  cwd = process.cwd()
): Promise<PostCanaryReceiptRollbackVerificationGateAuditInput> {
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
    receiptDocText: await read(cwd, RECEIPT_DOC),
    evidenceText: await read(cwd, REAL_CANARY_EVIDENCE),
    canaryFileExists: existsSync(join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE))
  };
}

export function reviewPostCanaryReceiptRollbackVerificationGateAudit(
  input: PostCanaryReceiptRollbackVerificationGateAuditInput
): PostCanaryReceiptRollbackVerificationGateAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const evidence = parseObject(input.evidenceText);
  const evidenceStatus = getString(evidence, ["status"]) ?? "";
  const executionStatus = getString(evidence, ["run", "executionStatus"]) ?? "";
  const exitCode = getNumber(evidence, ["run", "exitCode"]) ?? -1;
  const parseErrorCount = getNumber(evidence, ["run", "parseErrorCount"]) ?? -1;

  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    mainAlignedWithOrigin: ahead === 0 && behind === 0,
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    receiptRecorded:
      input.receiptDocText.includes(
        "POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE_RECORDED"
      ),
    receiptNonExecuting: receiptIsNonExecuting(input.receiptDocText),
    requiredReceiptFieldsRecorded: REQUIRED_RECEIPT_FIELDS.every((field) =>
      input.receiptDocText.includes(field)
    ),
    stopConditionsRecorded: REQUIRED_STOP_CONDITIONS.every((field) =>
      input.receiptDocText.includes(field)
    ),
    realCanaryEvidenceValid: realCanaryEvidenceIsValid(evidence),
    rollbackVerified: rollbackIsVerified(input, evidence),
    canaryFileAbsent: !input.canaryFileExists,
    evidenceSanitized: evidenceIsSanitized(input.evidenceText),
    countersStayZero: countersStayZero(input.receiptDocText)
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
      evidenceStatus,
      executionStatus,
      exitCode,
      parseErrorCount,
      providerExecuteCallsDuringReview: 0,
      realCodexCliCallsDuringReview: 0,
      workspaceWriteExecuteCallsDuringReview: 0,
      canaryFileWritesDuringReview: 0,
      additionalCanaryRunsDuringReview: 0
    },
    reasons
  };
}

export function formatPostCanaryReceiptRollbackVerificationGateAuditResult(
  review: PostCanaryReceiptRollbackVerificationGateAuditResult,
  format: PostCanaryReceiptRollbackVerificationGateAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Post-canary receipt and rollback verification gate audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `canary target file: ${review.summary.canaryTargetFile}`,
    `evidence status: ${review.summary.evidenceStatus}`,
    `execution status: ${review.summary.executionStatus}`,
    `exit code: ${review.summary.exitCode}`,
    `parse error count: ${review.summary.parseErrorCount}`,
    `provider execute calls during review: ${review.summary.providerExecuteCallsDuringReview}`,
    `real Codex CLI calls during review: ${review.summary.realCodexCliCallsDuringReview}`,
    `workspace-write execute calls during review: ${review.summary.workspaceWriteExecuteCallsDuringReview}`,
    `canary file writes during review: ${review.summary.canaryFileWritesDuringReview}`,
    `additional canary runs during review: ${review.summary.additionalCanaryRunsDuringReview}`,
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

function receiptIsNonExecuting(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  return normalized.includes("does not authorize, run, or simulate provider execute")
    && normalized.includes("real Codex CLI execution")
    && normalized.includes("workspace-write execution")
    && normalized.includes("canary file write")
    && normalized.includes("It is not to run another workspace-write canary")
    && FORBIDDEN_AUTHORIZATION_MARKERS.every((marker) =>
      !lower.includes(marker.toLowerCase())
    );
}

function realCanaryEvidenceIsValid(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"]) === "codex-cli-workspace-write-smoke-evidence.v1"
    && getString(evidence, ["status"]) === "passed"
    && getBoolean(evidence, ["summary", "passed"]) === true
    && getString(evidence, ["preflight", "status"]) === "ready"
    && arrayIsEmpty(getArray(evidence, ["preflight", "blockingReasons"]))
    && getString(evidence, ["plan", "sandbox"]) === "workspace-write"
    && getString(evidence, ["plan", "approvalPolicy"]) === "on-request"
    && getString(evidence, ["run", "executionStatus"]) === "completed"
    && getNumber(evidence, ["run", "exitCode"]) === 0
    && getNumber(evidence, ["run", "parseErrorCount"]) === 0
    && arrayIsEmpty(getArray(evidence, ["summary", "blockingReasons"]))
    && targetFilesMatch(evidence);
}

function rollbackIsVerified(
  input: PostCanaryReceiptRollbackVerificationGateAuditInput,
  evidence: Record<string, unknown> | undefined
): boolean {
  return !input.canaryFileExists
    && targetFilesMatch(evidence)
    && input.receiptDocText.includes("rollback verification: canary file absent");
}

function targetFilesMatch(evidence: Record<string, unknown> | undefined): boolean {
  const targetFiles = getArray(evidence, ["approvalPacket", "targetFiles"]);

  return targetFiles.length === 1
    && targetFiles[0] === DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE;
}

function evidenceIsSanitized(text: string): boolean {
  return FORBIDDEN_MARKERS.every((marker) => !text.includes(marker));
}

function countersStayZero(text: string): boolean {
  return text.includes("provider execute calls during receipt review")
    && text.includes("real Codex CLI calls during receipt review")
    && text.includes("workspace-write execute calls during receipt review")
    && text.includes("canary file writes during receipt review")
    && text.includes("additional canary runs during receipt review");
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `post_canary_receipt_rollback_gate_${name}`);
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

function getArray(
  value: Record<string, unknown> | undefined,
  path: string[]
): unknown[] {
  const found = getPath(value, path);
  return Array.isArray(found) ? found : [];
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

function arrayIsEmpty(value: unknown[]): boolean {
  return value.length === 0;
}

async function main(): Promise<void> {
  const result = reviewPostCanaryReceiptRollbackVerificationGateAudit(
    await collectPostCanaryReceiptRollbackVerificationGateAuditInput()
  );
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatPostCanaryReceiptRollbackVerificationGateAuditResult(result, format));

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Post-canary receipt and rollback verification gate audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
