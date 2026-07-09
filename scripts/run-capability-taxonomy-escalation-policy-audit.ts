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

const TAXONOMY_DOC =
  "docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md";
const POST_CANARY_RECEIPT_DOC =
  "docs/governance/POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE.md";
const REAL_CANARY_EVIDENCE =
  "docs/evidence/codex-cli-workspace-write-real-canary-latest.json";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "node --import tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_CAPABILITY_CLASSES = [
  "`read_only`",
  "`bounded_workspace_write_canary`",
  "`bounded_workspace_write_receipt`",
  "`scoped_workspace_write`",
  "`general_workspace_write`",
  "`general_provider_execution`",
  "`external_write`",
  "`release_or_deploy`",
  "`secret_or_credential_change`"
] as const;

const REQUIRED_ESCALATION_FIELDS = [
  "exact operator authorization for the named canary",
  "clean `main`",
  "local `main` aligned with `origin/main`",
  `fixed target file: \`${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}\``,
  "sandbox: `workspace-write`",
  "approval policy: `on-request`",
  "rollback required: `true`",
  "push authorized: `false`",
  "release authorized: `false`",
  "tag authorized: `false`",
  "deployment authorized: `false`",
  "external service write authorized: `false`",
  "requested capability class: `scoped_workspace_write`",
  "exact repository scope",
  "operator authorization phrase",
  "`general_workspace_write` and `general_provider_execution` remain closed"
] as const;

const REQUIRED_STOP_CONDITIONS = [
  "requested target is broader than the named class and scope",
  "requested target is not fixed or scoped",
  "current branch or alignment is unsafe for execution review",
  "worktree is dirty before execution review",
  "canary target file exists",
  "rollback plan is missing",
  "validation plan is missing",
  "sensitive value scan is missing",
  "push, release, tag, deployment, or external write is bundled with local write",
  "secret or credential change is bundled with local write",
  "general provider execution is implied by canary success",
  "general workspace-write is implied by canary success",
  "unsanitized execution transcript, provider input, shell invocation, patch"
] as const;

const FORBIDDEN_AUTHORIZATION_MARKERS = [
  "push authorized: `true`",
  "release authorized: `true`",
  "tag authorized: `true`",
  "deployment authorized: `true`",
  "external service write authorized: `true`",
  "general provider execution authorized: `true`",
  "general workspace-write authorized: `true`",
  "run workspace-write execution and general provider execution",
  "execute general provider execution now"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
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

export interface CapabilityTaxonomyEscalationPolicyAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  packageJsonText: string;
  taxonomyDocText: string;
  postCanaryReceiptDocText: string;
  evidenceText: string;
  canaryFileExists: boolean;
}

export interface CapabilityTaxonomyEscalationPolicyAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    packageScriptsPresent: boolean;
    taxonomyRecorded: boolean;
    taxonomyNonExecuting: boolean;
    capabilityClassesRecorded: boolean;
    escalationPolicyRecorded: boolean;
    stopConditionsRecorded: boolean;
    receiptBaselineRecorded: boolean;
    priorCanaryEvidenceValid: boolean;
    canaryFileAbsent: boolean;
    sensitiveOutputSanitized: boolean;
    countersStayZero: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    capabilityClassCount: number;
    canaryTargetFile: string;
    evidenceStatus: string;
    executionStatus: string;
    exitCode: number;
    providerExecuteCallsDuringTaxonomyReview: 0;
    realCodexCliCallsDuringTaxonomyReview: 0;
    workspaceWriteExecuteCallsDuringTaxonomyReview: 0;
    canaryFileWritesDuringTaxonomyReview: 0;
    generalProviderExecutionCallsDuringTaxonomyReview: 0;
    externalWriteCallsDuringTaxonomyReview: 0;
  };
  reasons: string[];
}

export type CapabilityTaxonomyEscalationPolicyAuditOutputFormat =
  | "text"
  | "json";

export async function collectCapabilityTaxonomyEscalationPolicyAuditInput(
  cwd = process.cwd()
): Promise<CapabilityTaxonomyEscalationPolicyAuditInput> {
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
    taxonomyDocText: await read(cwd, TAXONOMY_DOC),
    postCanaryReceiptDocText: await read(cwd, POST_CANARY_RECEIPT_DOC),
    evidenceText: await read(cwd, REAL_CANARY_EVIDENCE),
    canaryFileExists: existsSync(join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE))
  };
}

export function reviewCapabilityTaxonomyEscalationPolicyAudit(
  input: CapabilityTaxonomyEscalationPolicyAuditInput
): CapabilityTaxonomyEscalationPolicyAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const evidence = parseObject(input.evidenceText);
  const evidenceStatus = getString(evidence, ["status"]) ?? "";
  const executionStatus = getString(evidence, ["run", "executionStatus"]) ?? "";
  const exitCode = getNumber(evidence, ["run", "exitCode"]) ?? -1;

  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    taxonomyRecorded:
      input.taxonomyDocText.includes("CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED"),
    taxonomyNonExecuting: taxonomyIsNonExecuting(input.taxonomyDocText),
    capabilityClassesRecorded: REQUIRED_CAPABILITY_CLASSES.every((field) =>
      input.taxonomyDocText.includes(field)
    ),
    escalationPolicyRecorded: REQUIRED_ESCALATION_FIELDS.every((field) =>
      input.taxonomyDocText.includes(field)
    ),
    stopConditionsRecorded: REQUIRED_STOP_CONDITIONS.every((field) =>
      input.taxonomyDocText.includes(field)
    ),
    receiptBaselineRecorded: input.postCanaryReceiptDocText.includes(
      "POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE_RECORDED"
    ),
    priorCanaryEvidenceValid: priorCanaryEvidenceIsValid(evidence),
    canaryFileAbsent: !input.canaryFileExists,
    sensitiveOutputSanitized: sensitiveOutputIsSanitized(input),
    countersStayZero: countersStayZero(input.taxonomyDocText)
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
      capabilityClassCount: REQUIRED_CAPABILITY_CLASSES.length,
      canaryTargetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
      evidenceStatus,
      executionStatus,
      exitCode,
      providerExecuteCallsDuringTaxonomyReview: 0,
      realCodexCliCallsDuringTaxonomyReview: 0,
      workspaceWriteExecuteCallsDuringTaxonomyReview: 0,
      canaryFileWritesDuringTaxonomyReview: 0,
      generalProviderExecutionCallsDuringTaxonomyReview: 0,
      externalWriteCallsDuringTaxonomyReview: 0
    },
    reasons
  };
}

export function formatCapabilityTaxonomyEscalationPolicyAuditResult(
  review: CapabilityTaxonomyEscalationPolicyAuditResult,
  format: CapabilityTaxonomyEscalationPolicyAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Capability taxonomy escalation policy audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `capability classes: ${review.summary.capabilityClassCount}`,
    `canary target file: ${review.summary.canaryTargetFile}`,
    `evidence status: ${review.summary.evidenceStatus}`,
    `execution status: ${review.summary.executionStatus}`,
    `exit code: ${review.summary.exitCode}`,
    `provider execute calls during taxonomy review: ${review.summary.providerExecuteCallsDuringTaxonomyReview}`,
    `real Codex CLI calls during taxonomy review: ${review.summary.realCodexCliCallsDuringTaxonomyReview}`,
    `workspace-write execute calls during taxonomy review: ${review.summary.workspaceWriteExecuteCallsDuringTaxonomyReview}`,
    `canary file writes during taxonomy review: ${review.summary.canaryFileWritesDuringTaxonomyReview}`,
    `general provider execution calls during taxonomy review: ${review.summary.generalProviderExecutionCallsDuringTaxonomyReview}`,
    `external write calls during taxonomy review: ${review.summary.externalWriteCallsDuringTaxonomyReview}`,
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

function taxonomyIsNonExecuting(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  return normalized.includes("It is a local review and audit artifact only")
    && normalized.includes("does not authorize, run, or simulate provider execute")
    && normalized.includes("real Codex CLI execution")
    && normalized.includes("workspace-write execution")
    && normalized.includes("canary file write")
    && normalized.includes("external service write")
    && normalized.includes("It is not to run workspace-write execution")
    && normalized.includes("general provider execution")
    && FORBIDDEN_AUTHORIZATION_MARKERS.every((marker) =>
      !lower.includes(marker.toLowerCase())
    );
}

function priorCanaryEvidenceIsValid(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"]) === "codex-cli-workspace-write-smoke-evidence.v1"
    && getString(evidence, ["status"]) === "passed"
    && getBoolean(evidence, ["summary", "passed"]) === true
    && getString(evidence, ["preflight", "status"]) === "ready"
    && arrayIsEmpty(getArray(evidence, ["preflight", "blockingReasons"]))
    && getString(evidence, ["plan", "sandbox"]) === "workspace-write"
    && getString(evidence, ["plan", "approvalPolicy"]) === "on-request"
    && getString(evidence, ["run", "executionStatus"]) === "completed"
    && getNumber(evidence, ["run", "exitCode"]) === 0
    && arrayIsEmpty(getArray(evidence, ["summary", "blockingReasons"]))
    && targetFilesMatch(evidence);
}

function targetFilesMatch(evidence: Record<string, unknown> | undefined): boolean {
  const targetFiles = getArray(evidence, ["approvalPacket", "targetFiles"]);

  return targetFiles.length === 1
    && targetFiles[0] === DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE;
}

function sensitiveOutputIsSanitized(
  input: CapabilityTaxonomyEscalationPolicyAuditInput
): boolean {
  return [
    input.taxonomyDocText,
    input.evidenceText
  ].every((text) =>
    FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
  );
}

function countersStayZero(text: string): boolean {
  return text.includes("provider execute calls during taxonomy review")
    && text.includes("real Codex CLI calls during taxonomy review")
    && text.includes("workspace-write execute calls during taxonomy review")
    && text.includes("canary file writes during taxonomy review")
    && text.includes("general provider execution calls during taxonomy review")
    && text.includes("external write calls during taxonomy review");
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `capability_taxonomy_escalation_policy_${name}`);
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
  const input = await collectCapabilityTaxonomyEscalationPolicyAuditInput();
  const review = reviewCapabilityTaxonomyEscalationPolicyAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatCapabilityTaxonomyEscalationPolicyAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Capability taxonomy escalation policy audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
