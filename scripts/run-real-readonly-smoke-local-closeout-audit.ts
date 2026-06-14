#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REQUIRED_PACKAGE_SCRIPTS = {
  "acceptance:real-readonly-smoke-auth":
    "tsx scripts/run-real-readonly-smoke-authorization-acceptance.ts",
  "smoke:readonly:real": "tsx scripts/run-codex-cli-real-readonly-smoke.ts",
  "audit:real-readonly-smoke-local":
    "tsx scripts/run-real-readonly-smoke-local-closeout-audit.ts"
} as const;

const REQUIRED_DOCS = {
  auditIndex: "docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX.md",
  closeout: "docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md",
  receipt: "docs/governance/PR_13A_REAL_READONLY_SMOKE_RECEIPT.md",
  taskbook: "docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md",
  authCompatibility:
    "docs/governance/PR_13A_READONLY_REAL_CLI_AUTHORIZATION_PACKET_COMPATIBILITY.md"
} as const;

const REAL_SMOKE_EVIDENCE_PATH = "docs/evidence/codex-cli-real-readonly-smoke.json";
const AUTH_EVIDENCE_PATH =
  "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json";

const SENSITIVE_EVIDENCE_MARKERS = [
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
  "Bearer",
  "workspace-write"
] as const;

export interface RealReadonlySmokeLocalCloseoutAuditInput {
  gitStatusShort: string;
  branch: string;
  packageJsonText: string;
  auditIndexText: string;
  closeoutText: string;
  receiptText: string;
  taskbookText: string;
  authCompatibilityText: string;
  smokeEvidenceText: string;
  authEvidenceText: string;
}

export interface RealReadonlySmokeLocalCloseoutAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    packageScriptsPresent: boolean;
    auditIndexRecorded: boolean;
    closeoutRecorded: boolean;
    receiptRecorded: boolean;
    taskbookStillGated: boolean;
    authCompatibilityRecorded: boolean;
    smokeEvidencePassed: boolean;
    authEvidenceLocalOnly: boolean;
    evidenceSanitized: boolean;
    boundariesClosed: boolean;
  };
  summary: {
    branch: string;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    smokeStatus: string;
    smokeSandbox: string;
    smokeApprovalPolicy: string;
    smokeExitCode: number | null;
    providerExecuteCalls: number;
    realCodexCliCallsDuringAudit: number;
    workspaceWriteExecuteCalls: number;
  };
  reasons: string[];
}

export type RealReadonlySmokeLocalCloseoutAuditOutputFormat = "text" | "json";

export async function collectRealReadonlySmokeLocalCloseoutAuditInput(
  cwd = process.cwd()
): Promise<RealReadonlySmokeLocalCloseoutAuditInput> {
  const [gitStatusShort, branch] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    packageJsonText: await readFile(join(cwd, "package.json"), "utf8"),
    auditIndexText: await readFile(join(cwd, REQUIRED_DOCS.auditIndex), "utf8"),
    closeoutText: await readFile(join(cwd, REQUIRED_DOCS.closeout), "utf8"),
    receiptText: await readFile(join(cwd, REQUIRED_DOCS.receipt), "utf8"),
    taskbookText: await readFile(join(cwd, REQUIRED_DOCS.taskbook), "utf8"),
    authCompatibilityText: await readFile(
      join(cwd, REQUIRED_DOCS.authCompatibility),
      "utf8"
    ),
    smokeEvidenceText: await readFile(join(cwd, REAL_SMOKE_EVIDENCE_PATH), "utf8"),
    authEvidenceText: await readFile(join(cwd, AUTH_EVIDENCE_PATH), "utf8")
  };
}

export function reviewRealReadonlySmokeLocalCloseoutAudit(
  input: RealReadonlySmokeLocalCloseoutAuditInput
): RealReadonlySmokeLocalCloseoutAuditResult {
  const reasons: string[] = [];
  const packageJson = parseObject(input.packageJsonText);
  const smokeEvidence = parseObject(input.smokeEvidenceText);
  const authEvidence = parseObject(input.authEvidenceText);
  const packageScriptReview = reviewPackageScripts(packageJson);

  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    auditIndexRecorded: auditIndexIsRecorded(input.auditIndexText),
    closeoutRecorded: closeoutIsRecorded(input.closeoutText),
    receiptRecorded: receiptIsRecorded(input.receiptText),
    taskbookStillGated: taskbookIsStillGated(input.taskbookText),
    authCompatibilityRecorded: authCompatibilityIsRecorded(input.authCompatibilityText),
    smokeEvidencePassed: smokeEvidencePassed(smokeEvidence),
    authEvidenceLocalOnly: authEvidenceIsLocalOnly(authEvidence),
    evidenceSanitized: evidenceIsSanitized(input.smokeEvidenceText, input.authEvidenceText),
    boundariesClosed: boundariesAreClosed(input.closeoutText, input.receiptText)
  };

  addReasonIfFalse(reasons, checks.worktreeClean, "real_readonly_smoke_audit_worktree_dirty");
  addReasonIfFalse(reasons, checks.branchMain, "real_readonly_smoke_audit_branch_not_main");
  addReasonIfFalse(
    reasons,
    checks.packageScriptsPresent,
    "real_readonly_smoke_audit_package_scripts_missing"
  );
  addReasonIfFalse(
    reasons,
    checks.auditIndexRecorded,
    "real_readonly_smoke_audit_index_missing"
  );
  addReasonIfFalse(
    reasons,
    checks.closeoutRecorded,
    "real_readonly_smoke_audit_closeout_missing"
  );
  addReasonIfFalse(
    reasons,
    checks.receiptRecorded,
    "real_readonly_smoke_audit_receipt_missing"
  );
  addReasonIfFalse(
    reasons,
    checks.taskbookStillGated,
    "real_readonly_smoke_audit_taskbook_not_gated"
  );
  addReasonIfFalse(
    reasons,
    checks.authCompatibilityRecorded,
    "real_readonly_smoke_audit_auth_compatibility_missing"
  );
  addReasonIfFalse(
    reasons,
    checks.smokeEvidencePassed,
    "real_readonly_smoke_audit_smoke_evidence_not_passed"
  );
  addReasonIfFalse(
    reasons,
    checks.authEvidenceLocalOnly,
    "real_readonly_smoke_audit_auth_evidence_not_local_only"
  );
  addReasonIfFalse(
    reasons,
    checks.evidenceSanitized,
    "real_readonly_smoke_audit_evidence_leak_marker"
  );
  addReasonIfFalse(
    reasons,
    checks.boundariesClosed,
    "real_readonly_smoke_audit_boundaries_not_closed"
  );

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      smokeStatus: getString(smokeEvidence, ["status"]) ?? "unknown",
      smokeSandbox: getString(smokeEvidence, ["plan", "sandbox"]) ?? "unknown",
      smokeApprovalPolicy: getString(smokeEvidence, ["plan", "approvalPolicy"]) ?? "unknown",
      smokeExitCode: getNumber(smokeEvidence, ["run", "exitCode"]) ?? null,
      providerExecuteCalls: 0,
      realCodexCliCallsDuringAudit: 0,
      workspaceWriteExecuteCalls: 0
    },
    reasons
  };
}

export function formatRealReadonlySmokeLocalCloseoutAuditResult(
  review: RealReadonlySmokeLocalCloseoutAuditResult,
  format: RealReadonlySmokeLocalCloseoutAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Real read-only smoke local closeout audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `smoke status: ${review.summary.smokeStatus}`,
    `smoke sandbox: ${review.summary.smokeSandbox}`,
    `smoke approval policy: ${review.summary.smokeApprovalPolicy}`,
    `smoke exit code: ${review.summary.smokeExitCode ?? "unknown"}`,
    `provider execute calls: ${review.summary.providerExecuteCalls}`,
    `real CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `write execute calls: ${review.summary.workspaceWriteExecuteCalls}`,
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

function auditIndexIsRecorded(text: string): boolean {
  return text.includes("PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX_RECORDED")
    && text.includes("npm run audit:real-readonly-smoke-local -- --json")
    && text.includes("packageScriptTargetCount is `3`")
    && /This index does not authorize:[\s\S]*real Codex CLI invocation/.test(text)
    && /This index does not authorize:[\s\S]*workspace-write execute/.test(text)
    && /This index does not authorize:[\s\S]*remote push/.test(text)
    && /Still closed:[\s\S]*workspace-write execute/.test(text)
    && /Still closed:[\s\S]*broad real provider execution/.test(text);
}

function closeoutIsRecorded(text: string): boolean {
  return text.includes("PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes(REAL_SMOKE_EVIDENCE_PATH)
    && /WORKSPACE_WRITE_READY: no/.test(text)
    && /PUSH_READY: not evaluated by this closeout/.test(text);
}

function receiptIsRecorded(text: string): boolean {
  return text.includes("PR_13A_REAL_READONLY_SMOKE_PASSED")
    && text.includes(REAL_SMOKE_EVIDENCE_PATH)
    && /Operator selected evidence path:\s+- `default`/.test(text);
}

function taskbookIsStillGated(text: string): boolean {
  return text.includes("APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A")
    && text.includes("ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real")
    && text.includes("`npm run acceptance:real-readonly-smoke-auth`")
    && text.includes("This taskbook does not authorize:");
}

function authCompatibilityIsRecorded(text: string): boolean {
  return text.includes("PR_13A_READONLY_REAL_CLI_AUTHORIZATION_PACKET_COMPATIBILITY_RECORDED")
    && text.includes("future real read-only Codex CLI smoke")
    && /does not\s+authorize or run the real smoke/.test(text);
}

function smokeEvidencePassed(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"]) === "codex-cli-real-readonly-smoke-gate.v1"
    && getString(evidence, ["mode"]) === "real-readonly-smoke"
    && getString(evidence, ["status"]) === "passed"
    && getBoolean(evidence, ["checks", "operatorFlagPresent"]) === true
    && getBoolean(evidence, ["checks", "runnerInvoked"]) === true
    && getBoolean(evidence, ["checks", "readOnlySandbox"]) === true
    && getBoolean(evidence, ["checks", "approvalPolicyNever"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWrite"]) === true
    && getBoolean(evidence, ["checks", "noFileWrite"]) === true
    && getBoolean(evidence, ["checks", "sanitizedEvidence"]) === true
    && getString(evidence, ["plan", "sandbox"]) === "read-only"
    && getString(evidence, ["plan", "approvalPolicy"]) === "never"
    && getNumber(evidence, ["run", "exitCode"]) === 0
    && getString(evidence, ["run", "status"]) === "completed"
    && getBoolean(evidence, ["run", "timedOut"]) === false
    && getBoolean(evidence, ["run", "killed"]) === false;
}

function authEvidenceIsLocalOnly(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-real-readonly-smoke-authorization-acceptance.v1"
    && getString(evidence, ["mode"]) === "real-readonly-smoke-authorization-local-only"
    && getBoolean(evidence, ["checks", "exactAuthorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "broadenedAuthorizationBlocked"]) === true
    && getBoolean(evidence, ["checks", "pushReleaseTagRejected"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getNumber(evidence, ["counters", "providerExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "realCodexCliCalls"]) === 0
    && getNumber(evidence, ["counters", "workspaceWriteExecuteCalls"]) === 0;
}

function evidenceIsSanitized(smokeEvidenceText: string, authEvidenceText: string): boolean {
  return !containsSensitiveEvidenceMarker(smokeEvidenceText)
    && !containsSensitiveEvidenceMarker(authEvidenceText);
}

function boundariesAreClosed(closeoutText: string, receiptText: string): boolean {
  return /Still not authorized:[\s\S]*workspace-write execute/.test(closeoutText)
    && /Still not authorized:[\s\S]*broad real provider execution/.test(closeoutText)
    && /Still not authorized:[\s\S]*push/.test(closeoutText)
    && /Still not authorized:[\s\S]*release/.test(closeoutText)
    && /Still not authorized:[\s\S]*tag/.test(closeoutText)
    && /This does not authorize workspace-write, broader real provider execution, push,\s+release, or tag\./
      .test(receiptText);
}

function containsSensitiveEvidenceMarker(value: string): boolean {
  return SENSITIVE_EVIDENCE_MARKERS.some((marker) => value.includes(marker));
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

function addReasonIfFalse(reasons: string[], condition: boolean, reason: string): void {
  if (!condition) {
    reasons.push(reason);
  }
}

async function main(): Promise<void> {
  const input = await collectRealReadonlySmokeLocalCloseoutAuditInput();
  const review = reviewRealReadonlySmokeLocalCloseoutAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatRealReadonlySmokeLocalCloseoutAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Real read-only smoke local closeout audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
