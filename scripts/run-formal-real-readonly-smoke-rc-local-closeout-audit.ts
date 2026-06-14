#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REQUIRED_PACKAGE_SCRIPTS = {
  "audit:formal-real-readonly-smoke-execution-local":
    "tsx scripts/run-formal-real-readonly-smoke-execution-local-closeout-audit.ts",
  "audit:formal-real-readonly-smoke-receipt-local":
    "tsx scripts/run-formal-real-readonly-smoke-receipt-local-audit.ts",
  "audit:formal-real-readonly-smoke-local-rc":
    "tsx scripts/run-formal-real-readonly-smoke-local-rc-review.ts",
  "audit:formal-real-readonly-smoke-rc-local-closeout":
    "tsx scripts/run-formal-real-readonly-smoke-rc-local-closeout-audit.ts"
} as const;

const REQUIRED_DOCS = {
  pr18cCloseout:
    "docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md",
  pr19aReceiptAudit:
    "docs/governance/PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT.md",
  pr19bLocalRc:
    "docs/governance/PR_19B_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_REVIEW.md",
  pr19cCloseout:
    "docs/governance/PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT.md"
} as const;

const REQUIRED_EVIDENCE = {
  finalPreflight:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
  defaultReceipt: "docs/evidence/codex-cli-real-readonly-smoke.json"
} as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
  "smoke:readonly:real",
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

export interface FormalRealReadonlySmokeRcLocalCloseoutAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  packageJsonText: string;
  pr18cCloseoutText: string;
  pr19aReceiptAuditText: string;
  pr19bLocalRcText: string;
  pr19cCloseoutText: string;
  finalPreflightEvidenceText: string;
  defaultReceiptEvidenceText: string;
}

export interface FormalRealReadonlySmokeRcLocalCloseoutAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptsPresent: boolean;
    pr18cCloseoutRecorded: boolean;
    pr19aReceiptAuditRecorded: boolean;
    pr19bLocalRcRecorded: boolean;
    pr19cCloseoutRecorded: boolean;
    finalPreflightClosed: boolean;
    defaultReceiptReadOnlyPassed: boolean;
    workspaceWriteClosed: boolean;
    providerExecuteClosed: boolean;
    evidenceSanitized: boolean;
    closeoutNonAuthorizing: boolean;
    noProviderExecuteDuringCloseout: boolean;
    noRealCodexCliDuringCloseout: boolean;
    noWorkspaceWriteExecuteDuringCloseout: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    receiptStatus: string;
    receiptSandbox: string;
    receiptApprovalPolicy: string;
    receiptExitCode: number | null;
    finalPreflightTaskId: string;
    providerExecuteCallsDuringCloseout: 0;
    realCodexCliCallsDuringCloseout: 0;
    workspaceWriteExecuteCallsDuringCloseout: 0;
  };
  reasons: string[];
}

export type FormalRealReadonlySmokeRcLocalCloseoutAuditOutputFormat =
  "text" | "json";

export async function collectFormalRealReadonlySmokeRcLocalCloseoutAuditInput(
  cwd = process.cwd()
): Promise<FormalRealReadonlySmokeRcLocalCloseoutAuditInput> {
  const [gitStatusShort, branch, aheadBehind] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-list", "--left-right", "--count", "HEAD...origin/main"], cwd)
  ]);
  const read = (path: string) => readFile(join(cwd, path), "utf8");
  const [
    packageJsonText,
    pr18cCloseoutText,
    pr19aReceiptAuditText,
    pr19bLocalRcText,
    pr19cCloseoutText,
    finalPreflightEvidenceText,
    defaultReceiptEvidenceText
  ] = await Promise.all([
    read("package.json"),
    read(REQUIRED_DOCS.pr18cCloseout),
    read(REQUIRED_DOCS.pr19aReceiptAudit),
    read(REQUIRED_DOCS.pr19bLocalRc),
    read(REQUIRED_DOCS.pr19cCloseout),
    read(REQUIRED_EVIDENCE.finalPreflight),
    read(REQUIRED_EVIDENCE.defaultReceipt)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    aheadBehind: aheadBehind.trim(),
    packageJsonText,
    pr18cCloseoutText,
    pr19aReceiptAuditText,
    pr19bLocalRcText,
    pr19cCloseoutText,
    finalPreflightEvidenceText,
    defaultReceiptEvidenceText
  };
}

export function reviewFormalRealReadonlySmokeRcLocalCloseoutAudit(
  input: FormalRealReadonlySmokeRcLocalCloseoutAuditInput
): FormalRealReadonlySmokeRcLocalCloseoutAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const finalPreflightEvidence = parseObject(input.finalPreflightEvidenceText);
  const receiptEvidence = parseObject(input.defaultReceiptEvidenceText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    pr18cCloseoutRecorded: pr18cCloseoutRecorded(input.pr18cCloseoutText),
    pr19aReceiptAuditRecorded:
      pr19aReceiptAuditRecorded(input.pr19aReceiptAuditText),
    pr19bLocalRcRecorded: pr19bLocalRcRecorded(input.pr19bLocalRcText),
    pr19cCloseoutRecorded: pr19cCloseoutRecorded(input.pr19cCloseoutText),
    finalPreflightClosed: finalPreflightClosed(finalPreflightEvidence),
    defaultReceiptReadOnlyPassed: defaultReceiptReadOnlyPassed(receiptEvidence),
    workspaceWriteClosed:
      getBoolean(finalPreflightEvidence, ["checks", "noWorkspaceWriteExecute"])
        === true
      && getBoolean(receiptEvidence, ["checks", "noWorkspaceWrite"]) === true,
    providerExecuteClosed:
      getBoolean(finalPreflightEvidence, ["checks", "noProviderExecute"]) === true,
    evidenceSanitized:
      !containsForbiddenMarkers(input.finalPreflightEvidenceText)
      && !containsForbiddenMarkers(input.defaultReceiptEvidenceText),
    closeoutNonAuthorizing: closeoutNonAuthorizing(input.pr19cCloseoutText),
    noProviderExecuteDuringCloseout: true,
    noRealCodexCliDuringCloseout: true,
    noWorkspaceWriteExecuteDuringCloseout: true
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
      receiptStatus: getString(receiptEvidence, ["status"]) ?? "unknown",
      receiptSandbox: getString(receiptEvidence, ["plan", "sandbox"]) ?? "unknown",
      receiptApprovalPolicy:
        getString(receiptEvidence, ["plan", "approvalPolicy"]) ?? "unknown",
      receiptExitCode: getNumber(receiptEvidence, ["run", "exitCode"]) ?? null,
      finalPreflightTaskId: getString(finalPreflightEvidence, ["taskId"]) ?? "unknown",
      providerExecuteCallsDuringCloseout: 0,
      realCodexCliCallsDuringCloseout: 0,
      workspaceWriteExecuteCallsDuringCloseout: 0
    },
    reasons
  };
}

export function formatFormalRealReadonlySmokeRcLocalCloseoutAuditResult(
  review: FormalRealReadonlySmokeRcLocalCloseoutAuditResult,
  format: FormalRealReadonlySmokeRcLocalCloseoutAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Formal real read-only smoke RC local closeout audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `receipt status: ${review.summary.receiptStatus}`,
    `receipt sandbox: ${review.summary.receiptSandbox}`,
    `receipt approval policy: ${review.summary.receiptApprovalPolicy}`,
    `receipt exit code: ${review.summary.receiptExitCode ?? "unknown"}`,
    `final preflight: ${review.summary.finalPreflightTaskId}`,
    `provider execute calls during closeout: ${review.summary.providerExecuteCallsDuringCloseout}`,
    `real CLI calls during closeout: ${review.summary.realCodexCliCallsDuringCloseout}`,
    `workspace write execute calls during closeout: ${review.summary.workspaceWriteExecuteCallsDuringCloseout}`,
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

function parseAheadBehind(value: string): { ahead: number; behind: number } {
  const [aheadText, behindText] = value.split(/\s+/);
  return {
    ahead: Number(aheadText ?? 0),
    behind: Number(behindText ?? 0)
  };
}

function pr18cCloseoutRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes(
    "PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT_COMPLETE"
  )
    && normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize workspace-write");
}

function pr19aReceiptAuditRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes(
    "PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT_RECORDED"
  )
    && text.includes("npm run audit:formal-real-readonly-smoke-receipt-local")
    && normalized.includes("without re-running the real CLI");
}

function pr19bLocalRcRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes("PR_19B_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_REVIEW_RECORDED")
    && text.includes("npm run audit:formal-real-readonly-smoke-local-rc")
    && normalized.includes("without re-running the real CLI");
}

function pr19cCloseoutRecorded(text: string): boolean {
  return text.includes("PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT_COMPLETE")
    && text.includes("npm run audit:formal-real-readonly-smoke-rc-local-closeout")
    && text.includes("npm run audit:formal-real-readonly-smoke-rc-local-closeout -- --json")
    && text.includes(REQUIRED_EVIDENCE.finalPreflight)
    && text.includes(REQUIRED_EVIDENCE.defaultReceipt);
}

function finalPreflightClosed(
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
    && getBoolean(evidence, ["summary", "currentExecutionMustRemainClosed"]) === true;
}

function defaultReceiptReadOnlyPassed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-real-readonly-smoke-gate.v1"
    && getString(evidence, ["status"]) === "passed"
    && getString(evidence, ["plan", "sandbox"]) === "read-only"
    && getString(evidence, ["plan", "approvalPolicy"]) === "never"
    && getBoolean(evidence, ["checks", "readOnlySandbox"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWrite"]) === true
    && getBoolean(evidence, ["checks", "noFileWrite"]) === true
    && getBoolean(evidence, ["checks", "sanitizedEvidence"]) === true
    && getNumber(evidence, ["run", "exitCode"]) === 0
    && getString(evidence, ["run", "status"]) === "completed";
}

function closeoutNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize push, release, or tag")
    && normalized.includes("does not set the future execution operator flag");
}

function containsForbiddenMarkers(text: string): boolean {
  return FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) =>
      `formal_real_readonly_smoke_rc_local_closeout_${name}`
    );
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
  const input =
    await collectFormalRealReadonlySmokeRcLocalCloseoutAuditInput();
  const review = reviewFormalRealReadonlySmokeRcLocalCloseoutAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatFormalRealReadonlySmokeRcLocalCloseoutAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Formal real read-only smoke RC local closeout audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
