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
  "audit:formal-real-readonly-smoke-rc-local-closeout":
    "tsx scripts/run-formal-real-readonly-smoke-rc-local-closeout-audit.ts",
  "audit:readonly-real-smoke-chain-index":
    "tsx scripts/run-readonly-real-smoke-chain-index-audit.ts"
} as const;

const REQUIRED_DOCS = {
  pr13aIndex: "docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX.md",
  pr18cCloseout:
    "docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md",
  pr19cCloseout:
    "docs/governance/PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT.md",
  pr20aIndex:
    "docs/governance/PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX.md"
} as const;

const REQUIRED_EVIDENCE = {
  realSmoke: "docs/evidence/codex-cli-real-readonly-smoke.json",
  formalExecutionAuth:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
  formalFinalPreflight:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json"
} as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A",
  "APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A",
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

export interface ReadonlyRealSmokeChainIndexAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  packageJsonText: string;
  pr13aIndexText: string;
  pr18cCloseoutText: string;
  pr19cCloseoutText: string;
  pr20aIndexText: string;
  realSmokeEvidenceText: string;
  formalExecutionAuthEvidenceText: string;
  formalFinalPreflightEvidenceText: string;
}

export interface ReadonlyRealSmokeChainIndexAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptsPresent: boolean;
    pr13aIndexRecorded: boolean;
    pr18cCloseoutRecorded: boolean;
    pr19cCloseoutRecorded: boolean;
    pr20aIndexRecorded: boolean;
    realSmokeEvidencePassed: boolean;
    formalExecutionAuthClosed: boolean;
    formalFinalPreflightClosed: boolean;
    workspaceWriteClosed: boolean;
    providerExecuteClosed: boolean;
    evidenceSanitized: boolean;
    indexNonAuthorizing: boolean;
    noProviderExecuteDuringIndex: boolean;
    noRealCodexCliDuringIndex: boolean;
    noWorkspaceWriteExecuteDuringIndex: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    realSmokeStatus: string;
    realSmokeSandbox: string;
    realSmokeApprovalPolicy: string;
    realSmokeExitCode: number | null;
    formalAuthTaskId: string;
    formalPreflightTaskId: string;
    providerExecuteCallsDuringIndex: 0;
    realCodexCliCallsDuringIndex: 0;
    workspaceWriteExecuteCallsDuringIndex: 0;
  };
  reasons: string[];
}

export type ReadonlyRealSmokeChainIndexAuditOutputFormat = "text" | "json";

export async function collectReadonlyRealSmokeChainIndexAuditInput(
  cwd = process.cwd()
): Promise<ReadonlyRealSmokeChainIndexAuditInput> {
  const [gitStatusShort, branch, aheadBehind] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-list", "--left-right", "--count", "HEAD...origin/main"], cwd)
  ]);
  const read = (path: string) => readFile(join(cwd, path), "utf8");
  const [
    packageJsonText,
    pr13aIndexText,
    pr18cCloseoutText,
    pr19cCloseoutText,
    pr20aIndexText,
    realSmokeEvidenceText,
    formalExecutionAuthEvidenceText,
    formalFinalPreflightEvidenceText
  ] = await Promise.all([
    read("package.json"),
    read(REQUIRED_DOCS.pr13aIndex),
    read(REQUIRED_DOCS.pr18cCloseout),
    read(REQUIRED_DOCS.pr19cCloseout),
    read(REQUIRED_DOCS.pr20aIndex),
    read(REQUIRED_EVIDENCE.realSmoke),
    read(REQUIRED_EVIDENCE.formalExecutionAuth),
    read(REQUIRED_EVIDENCE.formalFinalPreflight)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    aheadBehind: aheadBehind.trim(),
    packageJsonText,
    pr13aIndexText,
    pr18cCloseoutText,
    pr19cCloseoutText,
    pr20aIndexText,
    realSmokeEvidenceText,
    formalExecutionAuthEvidenceText,
    formalFinalPreflightEvidenceText
  };
}

export function reviewReadonlyRealSmokeChainIndexAudit(
  input: ReadonlyRealSmokeChainIndexAuditInput
): ReadonlyRealSmokeChainIndexAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const realSmokeEvidence = parseObject(input.realSmokeEvidenceText);
  const formalExecutionAuthEvidence = parseObject(
    input.formalExecutionAuthEvidenceText
  );
  const formalFinalPreflightEvidence = parseObject(
    input.formalFinalPreflightEvidenceText
  );
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    pr13aIndexRecorded: pr13aIndexRecorded(input.pr13aIndexText),
    pr18cCloseoutRecorded: pr18cCloseoutRecorded(input.pr18cCloseoutText),
    pr19cCloseoutRecorded: pr19cCloseoutRecorded(input.pr19cCloseoutText),
    pr20aIndexRecorded: pr20aIndexRecorded(input.pr20aIndexText),
    realSmokeEvidencePassed: realSmokeEvidencePassed(realSmokeEvidence),
    formalExecutionAuthClosed:
      formalExecutionAuthClosed(formalExecutionAuthEvidence),
    formalFinalPreflightClosed:
      formalFinalPreflightClosed(formalFinalPreflightEvidence),
    workspaceWriteClosed:
      getBoolean(realSmokeEvidence, ["checks", "noWorkspaceWrite"]) === true
      && getBoolean(formalExecutionAuthEvidence, [
        "checks",
        "noWorkspaceWriteExecute"
      ]) === true
      && getBoolean(formalFinalPreflightEvidence, [
        "checks",
        "noWorkspaceWriteExecute"
      ]) === true,
    providerExecuteClosed:
      getBoolean(formalExecutionAuthEvidence, ["checks", "noProviderExecute"])
        === true
      && getBoolean(formalFinalPreflightEvidence, [
        "checks",
        "noProviderExecute"
      ]) === true,
    evidenceSanitized:
      !containsForbiddenMarkers(input.realSmokeEvidenceText)
      && !containsForbiddenMarkers(input.formalExecutionAuthEvidenceText)
      && !containsForbiddenMarkers(input.formalFinalPreflightEvidenceText),
    indexNonAuthorizing: indexNonAuthorizing(input.pr20aIndexText),
    noProviderExecuteDuringIndex: true,
    noRealCodexCliDuringIndex: true,
    noWorkspaceWriteExecuteDuringIndex: true
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
      realSmokeStatus: getString(realSmokeEvidence, ["status"]) ?? "unknown",
      realSmokeSandbox:
        getString(realSmokeEvidence, ["plan", "sandbox"]) ?? "unknown",
      realSmokeApprovalPolicy:
        getString(realSmokeEvidence, ["plan", "approvalPolicy"]) ?? "unknown",
      realSmokeExitCode: getNumber(realSmokeEvidence, ["run", "exitCode"]) ?? null,
      formalAuthTaskId:
        getString(formalExecutionAuthEvidence, ["taskId"]) ?? "unknown",
      formalPreflightTaskId:
        getString(formalFinalPreflightEvidence, ["taskId"]) ?? "unknown",
      providerExecuteCallsDuringIndex: 0,
      realCodexCliCallsDuringIndex: 0,
      workspaceWriteExecuteCallsDuringIndex: 0
    },
    reasons
  };
}

export function formatReadonlyRealSmokeChainIndexAuditResult(
  review: ReadonlyRealSmokeChainIndexAuditResult,
  format: ReadonlyRealSmokeChainIndexAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Read-only real smoke chain index audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `real smoke status: ${review.summary.realSmokeStatus}`,
    `real smoke sandbox: ${review.summary.realSmokeSandbox}`,
    `real smoke approval policy: ${review.summary.realSmokeApprovalPolicy}`,
    `real smoke exit code: ${review.summary.realSmokeExitCode ?? "unknown"}`,
    `formal auth: ${review.summary.formalAuthTaskId}`,
    `formal preflight: ${review.summary.formalPreflightTaskId}`,
    `provider execute calls during index: ${review.summary.providerExecuteCallsDuringIndex}`,
    `real CLI calls during index: ${review.summary.realCodexCliCallsDuringIndex}`,
    `workspace write execute calls during index: ${review.summary.workspaceWriteExecuteCallsDuringIndex}`,
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

function pr13aIndexRecorded(text: string): boolean {
  return text.includes("PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX_RECORDED")
    && text.includes("npm run audit:real-readonly-smoke-local")
    && text.includes(REQUIRED_EVIDENCE.realSmoke)
    && text.includes("workspace-write execute")
    && text.includes("broader real provider execution remain closed");
}

function pr18cCloseoutRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes(
    "PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT_COMPLETE"
  )
    && normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize workspace-write");
}

function pr19cCloseoutRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes("PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT_COMPLETE")
    && text.includes("npm run audit:formal-real-readonly-smoke-rc-local-closeout")
    && normalized.includes("without re-running the real CLI");
}

function pr20aIndexRecorded(text: string): boolean {
  return text.includes("PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX_RECORDED")
    && text.includes("npm run audit:readonly-real-smoke-chain-index")
    && text.includes("npm run audit:readonly-real-smoke-chain-index -- --json")
    && text.includes(REQUIRED_EVIDENCE.realSmoke)
    && text.includes(REQUIRED_EVIDENCE.formalExecutionAuth)
    && text.includes(REQUIRED_EVIDENCE.formalFinalPreflight);
}

function realSmokeEvidencePassed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-real-readonly-smoke-gate.v1"
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
    && getNumber(evidence, ["run", "parseErrorCount"]) === 0;
}

function formalExecutionAuthClosed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.v1"
    && getBoolean(evidence, ["checks", "exactAuthorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "immediateExecutionBlocked"]) === true
    && getBoolean(evidence, ["checks", "formalBoundaryRequired"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true;
}

function formalFinalPreflightClosed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.v1"
    && getBoolean(evidence, ["checks", "exactPreflightAccepted"]) === true
    && getBoolean(evidence, ["checks", "immediateExecutionBlocked"]) === true
    && getBoolean(evidence, ["checks", "requiredValidationChainDeclared"]) === true
    && getBoolean(evidence, ["checks", "formalBoundaryRequired"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getBoolean(evidence, ["summary", "currentExecutionMustRemainClosed"]) === true;
}

function indexNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize push, release, or tag")
    && normalized.includes("does not set an execution operator flag");
}

function containsForbiddenMarkers(text: string): boolean {
  return FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `readonly_real_smoke_chain_index_${name}`);
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
  const input = await collectReadonlyRealSmokeChainIndexAuditInput();
  const review = reviewReadonlyRealSmokeChainIndexAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatReadonlyRealSmokeChainIndexAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Read-only real smoke chain index audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
