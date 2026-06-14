#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REQUIRED_PACKAGE_SCRIPTS = {
  "audit:real-readonly-smoke-local":
    "tsx scripts/run-real-readonly-smoke-local-closeout-audit.ts",
  "audit:formal-real-readonly-smoke-execution-local":
    "tsx scripts/run-formal-real-readonly-smoke-execution-local-closeout-audit.ts",
  "audit:formal-real-readonly-smoke-receipt-local":
    "tsx scripts/run-formal-real-readonly-smoke-receipt-local-audit.ts",
  "smoke:readonly:real": "tsx scripts/run-codex-cli-real-readonly-smoke.ts"
} as const;

const REQUIRED_DOCS = {
  pr13aCloseout: "docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md",
  pr18cCloseout:
    "docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md",
  pr19aAudit:
    "docs/governance/PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT.md"
} as const;

const REQUIRED_EVIDENCE = {
  defaultReceipt: "docs/evidence/codex-cli-real-readonly-smoke.json",
  finalPreflight:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json"
} as const;

const FORBIDDEN_RECEIPT_MARKERS = [
  "requestedAction",
  "prompt",
  "args",
  "stdout",
  "stderr",
  "raw command",
  "raw task envelope",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
] as const;

export interface FormalRealReadonlySmokeReceiptLocalAuditInput {
  gitStatusShort: string;
  branch: string;
  packageJsonText: string;
  smokeScriptText: string;
  pr13aCloseoutText: string;
  pr18cCloseoutText: string;
  pr19aAuditText: string;
  defaultReceiptEvidenceText: string;
  finalPreflightEvidenceText: string;
}

export interface FormalRealReadonlySmokeReceiptLocalAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    packageScriptsPresent: boolean;
    smokeScriptDefaultEvidencePath: boolean;
    pr13aReceiptClosedOut: boolean;
    pr18cExecutionPreflightClosed: boolean;
    pr19aAuditRecorded: boolean;
    defaultReceiptPassed: boolean;
    defaultReceiptReadOnly: boolean;
    defaultReceiptCompleted: boolean;
    defaultReceiptSanitized: boolean;
    finalPreflightStillClosed: boolean;
    noProviderExecuteDuringAudit: boolean;
    noRealCodexCliDuringAudit: boolean;
    noWorkspaceWriteExecuteDuringAudit: boolean;
    auditNonAuthorizing: boolean;
  };
  summary: {
    branch: string;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    receiptStatus: string;
    receiptSandbox: string;
    receiptApprovalPolicy: string;
    receiptExitCode: number | null;
    receiptRunStatus: string;
    receiptEventCount: number;
    receiptParseErrorCount: number;
    receiptWarningCount: number;
    finalPreflightCurrentExecutionClosed: boolean;
    providerExecuteCallsDuringAudit: 0;
    realCodexCliCallsDuringAudit: 0;
    workspaceWriteExecuteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type FormalRealReadonlySmokeReceiptLocalAuditOutputFormat =
  "text" | "json";

export async function collectFormalRealReadonlySmokeReceiptLocalAuditInput(
  cwd = process.cwd()
): Promise<FormalRealReadonlySmokeReceiptLocalAuditInput> {
  const [gitStatusShort, branch] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd)
  ]);
  const read = (path: string) => readFile(join(cwd, path), "utf8");
  const [
    packageJsonText,
    smokeScriptText,
    pr13aCloseoutText,
    pr18cCloseoutText,
    pr19aAuditText,
    defaultReceiptEvidenceText,
    finalPreflightEvidenceText
  ] = await Promise.all([
    read("package.json"),
    read("scripts/run-codex-cli-real-readonly-smoke.ts"),
    read(REQUIRED_DOCS.pr13aCloseout),
    read(REQUIRED_DOCS.pr18cCloseout),
    read(REQUIRED_DOCS.pr19aAudit),
    read(REQUIRED_EVIDENCE.defaultReceipt),
    read(REQUIRED_EVIDENCE.finalPreflight)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    packageJsonText,
    smokeScriptText,
    pr13aCloseoutText,
    pr18cCloseoutText,
    pr19aAuditText,
    defaultReceiptEvidenceText,
    finalPreflightEvidenceText
  };
}

export function reviewFormalRealReadonlySmokeReceiptLocalAudit(
  input: FormalRealReadonlySmokeReceiptLocalAuditInput
): FormalRealReadonlySmokeReceiptLocalAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const receiptEvidence = parseObject(input.defaultReceiptEvidenceText);
  const finalPreflightEvidence = parseObject(input.finalPreflightEvidenceText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    smokeScriptDefaultEvidencePath:
      smokeScriptDefaultEvidencePath(input.smokeScriptText),
    pr13aReceiptClosedOut: pr13aReceiptClosedOut(input.pr13aCloseoutText),
    pr18cExecutionPreflightClosed:
      pr18cExecutionPreflightClosed(input.pr18cCloseoutText),
    pr19aAuditRecorded: pr19aAuditRecorded(input.pr19aAuditText),
    defaultReceiptPassed: defaultReceiptPassed(receiptEvidence),
    defaultReceiptReadOnly: defaultReceiptReadOnly(receiptEvidence),
    defaultReceiptCompleted: defaultReceiptCompleted(receiptEvidence),
    defaultReceiptSanitized:
      !containsForbiddenMarkers(input.defaultReceiptEvidenceText),
    finalPreflightStillClosed: finalPreflightStillClosed(finalPreflightEvidence),
    noProviderExecuteDuringAudit: true,
    noRealCodexCliDuringAudit: true,
    noWorkspaceWriteExecuteDuringAudit: true,
    auditNonAuthorizing: auditNonAuthorizing(input.pr19aAuditText)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      receiptStatus: getString(receiptEvidence, ["status"]) ?? "unknown",
      receiptSandbox: getString(receiptEvidence, ["plan", "sandbox"]) ?? "unknown",
      receiptApprovalPolicy:
        getString(receiptEvidence, ["plan", "approvalPolicy"]) ?? "unknown",
      receiptExitCode: getNumber(receiptEvidence, ["run", "exitCode"]) ?? null,
      receiptRunStatus: getString(receiptEvidence, ["run", "status"]) ?? "unknown",
      receiptEventCount: getNumber(receiptEvidence, ["run", "eventCount"]) ?? 0,
      receiptParseErrorCount:
        getNumber(receiptEvidence, ["run", "parseErrorCount"]) ?? 0,
      receiptWarningCount:
        getNumber(receiptEvidence, ["run", "warningCount"]) ?? 0,
      finalPreflightCurrentExecutionClosed:
        getBoolean(finalPreflightEvidence, [
          "summary",
          "currentExecutionMustRemainClosed"
        ]) === true,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      workspaceWriteExecuteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatFormalRealReadonlySmokeReceiptLocalAuditResult(
  review: FormalRealReadonlySmokeReceiptLocalAuditResult,
  format: FormalRealReadonlySmokeReceiptLocalAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Formal real read-only smoke receipt local audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `receipt status: ${review.summary.receiptStatus}`,
    `receipt sandbox: ${review.summary.receiptSandbox}`,
    `receipt approval policy: ${review.summary.receiptApprovalPolicy}`,
    `receipt exit code: ${review.summary.receiptExitCode ?? "unknown"}`,
    `receipt run status: ${review.summary.receiptRunStatus}`,
    `receipt events: ${review.summary.receiptEventCount}`,
    `receipt parse errors: ${review.summary.receiptParseErrorCount}`,
    `receipt warnings: ${review.summary.receiptWarningCount}`,
    `final preflight execution closed: ${review.summary.finalPreflightCurrentExecutionClosed}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `real CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `workspace write execute calls during audit: ${review.summary.workspaceWriteExecuteCallsDuringAudit}`,
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

function smokeScriptDefaultEvidencePath(text: string): boolean {
  return text.includes("DEFAULT_REAL_CODEX_CLI_READONLY_SMOKE_EVIDENCE_PATH")
    && text.includes(REQUIRED_EVIDENCE.defaultReceipt);
}

function pr13aReceiptClosedOut(text: string): boolean {
  return text.includes("PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes(REQUIRED_EVIDENCE.defaultReceipt)
    && text.includes("REAL_CODEX_CLI_READY: exact PR-13A read-only smoke path exercised once")
    && text.includes("WORKSPACE_WRITE_READY: no");
}

function pr18cExecutionPreflightClosed(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes(
    "PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT_COMPLETE"
  )
    && normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not set the future execution operator flag");
}

function pr19aAuditRecorded(text: string): boolean {
  return text.includes(
    "PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT_RECORDED"
  )
    && text.includes("npm run audit:formal-real-readonly-smoke-receipt-local")
    && text.includes("npm run audit:formal-real-readonly-smoke-receipt-local -- --json")
    && text.includes(REQUIRED_EVIDENCE.defaultReceipt)
    && text.includes(REQUIRED_EVIDENCE.finalPreflight);
}

function defaultReceiptPassed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-real-readonly-smoke-gate.v1"
    && getString(evidence, ["mode"]) === "real-readonly-smoke"
    && getString(evidence, ["status"]) === "passed"
    && getBoolean(evidence, ["summary", "passed"]) === true
    && getNumber(evidence, ["run", "exitCode"]) === 0;
}

function defaultReceiptReadOnly(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getBoolean(evidence, ["checks", "readOnlySandbox"]) === true
    && getBoolean(evidence, ["checks", "approvalPolicyNever"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWrite"]) === true
    && getBoolean(evidence, ["checks", "noFileWrite"]) === true
    && getBoolean(evidence, ["checks", "sanitizedEvidence"]) === true
    && getString(evidence, ["plan", "sandbox"]) === "read-only"
    && getString(evidence, ["plan", "approvalPolicy"]) === "never"
    && getBoolean(evidence, ["plan", "usesJson"]) === true
    && getBoolean(evidence, ["plan", "skipGitRepoCheck"]) === true
    && getBoolean(evidence, ["plan", "ephemeral"]) === true;
}

function defaultReceiptCompleted(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getBoolean(evidence, ["checks", "operatorFlagPresent"]) === true
    && getBoolean(evidence, ["checks", "runnerInvoked"]) === true
    && getString(evidence, ["run", "status"]) === "completed"
    && getBoolean(evidence, ["run", "timedOut"]) === false
    && getBoolean(evidence, ["run", "killed"]) === false
    && (getNumber(evidence, ["run", "eventCount"]) ?? 0) > 0
    && getNumber(evidence, ["run", "parseErrorCount"]) === 0
    && Array.isArray(getPath(evidence, ["summary", "blockingReasons"]))
    && (getPath(evidence, ["summary", "blockingReasons"]) as unknown[]).length === 0;
}

function finalPreflightStillClosed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.v1"
    && getBoolean(evidence, ["checks", "exactPreflightAccepted"]) === true
    && getBoolean(evidence, ["checks", "immediateExecutionBlocked"]) === true
    && getBoolean(evidence, ["checks", "formalBoundaryRequired"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["summary", "currentExecutionMustRemainClosed"]) === true
    && getBoolean(evidence, ["summary", "operatorFlagMustNotBeSetByPreflight"])
      === true;
}

function auditNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize push, release, or tag")
    && normalized.includes("does not set the future execution operator flag");
}

function containsForbiddenMarkers(text: string): boolean {
  return FORBIDDEN_RECEIPT_MARKERS.some((marker) => text.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `formal_real_readonly_smoke_receipt_local_audit_${name}`);
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
  const input = await collectFormalRealReadonlySmokeReceiptLocalAuditInput();
  const review = reviewFormalRealReadonlySmokeReceiptLocalAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatFormalRealReadonlySmokeReceiptLocalAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Formal real read-only smoke receipt local audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
