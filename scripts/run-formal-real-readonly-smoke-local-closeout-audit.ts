#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "node --import tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_DOCS = {
  pr17aTaskbook:
    "docs/governance/PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK.md",
  pr17bPreExecution:
    "docs/governance/PR_17B_FORMAL_REAL_READONLY_SMOKE_PRE_EXECUTION.md",
  pr17cCloseout:
    "docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md"
} as const;

const REQUIRED_EVIDENCE = {
  taskbook:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json",
  preExecution:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json"
} as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_PR_17A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
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

export interface FormalRealReadonlySmokeLocalCloseoutAuditInput {
  gitStatusShort: string;
  branch: string;
  packageJsonText: string;
  realSmokeScriptText: string;
  pr17aTaskbookText: string;
  pr17bPreExecutionText: string;
  pr17cCloseoutText: string;
  taskbookEvidenceText: string;
  preExecutionEvidenceText: string;
}

export interface FormalRealReadonlySmokeLocalCloseoutAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    packageScriptsPresent: boolean;
    pr17aTaskbookRecorded: boolean;
    pr17bPreExecutionRecorded: boolean;
    pr17cCloseoutRecorded: boolean;
    taskbookEvidencePassed: boolean;
    preExecutionEvidencePassed: boolean;
    smokeScriptDefaultEvidencePath: boolean;
    smokeScriptBlocksWithoutOperatorFlag: boolean;
    exactFutureCommandRequired: boolean;
    defaultEvidencePathRequired: boolean;
    formalDispatchBoundaryRequired: boolean;
    providerExecuteStillSeparate: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    evidenceSanitized: boolean;
    closeoutNonAuthorizing: boolean;
  };
  summary: {
    branch: string;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    providerId: string;
    sideEffectClass: string;
    sandbox: string;
    approvalPolicy: string;
    evidencePathChoice: string;
    realSmokeDefaultEvidencePath: string;
    taskbookAcceptanceStatus: string;
    blockedSmokeStatus: string;
    blockedSmokeRunnerCalls: number;
    providerExecuteCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
  };
  reasons: string[];
}

export type FormalRealReadonlySmokeLocalCloseoutAuditOutputFormat =
  "text" | "json";

export async function collectFormalRealReadonlySmokeLocalCloseoutAuditInput(
  cwd = process.cwd()
): Promise<FormalRealReadonlySmokeLocalCloseoutAuditInput> {
  const [gitStatusShort, branch] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd)
  ]);
  const read = (path: string) => readFile(join(cwd, path), "utf8");
  const [
    packageJsonText,
    realSmokeScriptText,
    pr17aTaskbookText,
    pr17bPreExecutionText,
    pr17cCloseoutText,
    taskbookEvidenceText,
    preExecutionEvidenceText
  ] = await Promise.all([
    read("package.json"),
    read("scripts/run-codex-cli-real-readonly-smoke.ts"),
    read(REQUIRED_DOCS.pr17aTaskbook),
    read(REQUIRED_DOCS.pr17bPreExecution),
    read(REQUIRED_DOCS.pr17cCloseout),
    read(REQUIRED_EVIDENCE.taskbook),
    read(REQUIRED_EVIDENCE.preExecution)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    packageJsonText,
    realSmokeScriptText,
    pr17aTaskbookText,
    pr17bPreExecutionText,
    pr17cCloseoutText,
    taskbookEvidenceText,
    preExecutionEvidenceText
  };
}

export function reviewFormalRealReadonlySmokeLocalCloseoutAudit(
  input: FormalRealReadonlySmokeLocalCloseoutAuditInput
): FormalRealReadonlySmokeLocalCloseoutAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const taskbookEvidence = parseObject(input.taskbookEvidenceText);
  const preExecutionEvidence = parseObject(input.preExecutionEvidenceText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    pr17aTaskbookRecorded: pr17aTaskbookRecorded(input.pr17aTaskbookText),
    pr17bPreExecutionRecorded:
      pr17bPreExecutionRecorded(input.pr17bPreExecutionText),
    pr17cCloseoutRecorded: pr17cCloseoutRecorded(input.pr17cCloseoutText),
    taskbookEvidencePassed: taskbookEvidencePassed(taskbookEvidence),
    preExecutionEvidencePassed: preExecutionEvidencePassed(preExecutionEvidence),
    smokeScriptDefaultEvidencePath:
      smokeScriptDefaultEvidencePath(input.realSmokeScriptText, preExecutionEvidence),
    smokeScriptBlocksWithoutOperatorFlag:
      getBoolean(preExecutionEvidence, ["checks", "smokeScriptBlocksWithoutOperatorFlag"]) === true,
    exactFutureCommandRequired:
      getBoolean(preExecutionEvidence, ["checks", "exactFutureCommandRequired"]) === true,
    defaultEvidencePathRequired:
      getBoolean(preExecutionEvidence, ["checks", "defaultEvidencePathRequired"]) === true,
    formalDispatchBoundaryRequired:
      getBoolean(preExecutionEvidence, ["checks", "formalDispatchBoundaryRequired"]) === true,
    providerExecuteStillSeparate:
      getBoolean(preExecutionEvidence, ["checks", "providerExecuteStillSeparate"]) === true,
    noProviderExecute:
      getNumber(preExecutionEvidence, ["counters", "providerExecuteCalls"]) === 0,
    noRealCodexCli:
      getNumber(preExecutionEvidence, ["counters", "realCodexCliCalls"]) === 0,
    noWorkspaceWriteExecute:
      getNumber(preExecutionEvidence, ["counters", "workspaceWriteExecuteCalls"]) === 0,
    evidenceSanitized:
      evidenceIsSanitized(input.taskbookEvidenceText, input.preExecutionEvidenceText),
    closeoutNonAuthorizing: closeoutNonAuthorizing(input.pr17cCloseoutText)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      providerId:
        getString(preExecutionEvidence, ["summary", "requiredProviderId"]) ?? "unknown",
      sideEffectClass:
        getString(preExecutionEvidence, ["summary", "requiredSideEffectClass"])
          ?? "unknown",
      sandbox:
        getString(preExecutionEvidence, ["summary", "requiredSandbox"]) ?? "unknown",
      approvalPolicy:
        getString(preExecutionEvidence, ["summary", "requiredApprovalPolicy"])
          ?? "unknown",
      evidencePathChoice:
        getString(preExecutionEvidence, ["summary", "requiredEvidencePathChoice"])
          ?? "unknown",
      realSmokeDefaultEvidencePath:
        getString(preExecutionEvidence, ["summary", "realSmokeDefaultEvidencePath"])
          ?? "unknown",
      taskbookAcceptanceStatus:
        getString(preExecutionEvidence, ["summary", "taskbookAcceptanceStatus"])
          ?? "unknown",
      blockedSmokeStatus:
        getString(preExecutionEvidence, ["summary", "blockedSmokeStatus"])
          ?? "unknown",
      blockedSmokeRunnerCalls:
        getNumber(preExecutionEvidence, ["counters", "blockedSmokeRunnerCalls"]) ?? 0,
      providerExecuteCalls:
        getNumber(preExecutionEvidence, ["counters", "providerExecuteCalls"]) ?? 0,
      realCodexCliCalls:
        getNumber(preExecutionEvidence, ["counters", "realCodexCliCalls"]) ?? 0,
      workspaceWriteExecuteCalls:
        getNumber(preExecutionEvidence, ["counters", "workspaceWriteExecuteCalls"])
          ?? 0
    },
    reasons
  };
}

export function formatFormalRealReadonlySmokeLocalCloseoutAuditResult(
  review: FormalRealReadonlySmokeLocalCloseoutAuditResult,
  format: FormalRealReadonlySmokeLocalCloseoutAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Formal real read-only smoke local closeout audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `provider: ${review.summary.providerId}`,
    `side effect: ${review.summary.sideEffectClass}`,
    `sandbox: ${review.summary.sandbox}`,
    `approval policy: ${review.summary.approvalPolicy}`,
    `evidence path choice: ${review.summary.evidencePathChoice}`,
    `real smoke default evidence path: ${review.summary.realSmokeDefaultEvidencePath}`,
    `taskbook status: ${review.summary.taskbookAcceptanceStatus}`,
    `blocked smoke status: ${review.summary.blockedSmokeStatus}`,
    `blocked smoke runner calls: ${review.summary.blockedSmokeRunnerCalls}`,
    `provider execute calls: ${review.summary.providerExecuteCalls}`,
    `real CLI calls: ${review.summary.realCodexCliCalls}`,
    `workspace-write execute calls: ${review.summary.workspaceWriteExecuteCalls}`,
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

function pr17aTaskbookRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes("PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK_RECORDED")
    && text.includes("npm run governance -- acceptance formal-real-readonly-smoke-taskbook")
    && text.includes(REQUIRED_EVIDENCE.taskbook)
    && normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize workspace-write");
}

function pr17bPreExecutionRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes("PR_17B_FORMAL_REAL_READONLY_SMOKE_PRE_EXECUTION_RECORDED")
    && text.includes("npm run governance -- acceptance formal-real-readonly-smoke-pre-execution")
    && text.includes(REQUIRED_EVIDENCE.preExecution)
    && normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("workspace-write execute calls are `0`");
}

function pr17cCloseoutRecorded(text: string): boolean {
  return text.includes("PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes("npm run governance -- audit formal-real-readonly-smoke-local")
    && text.includes("npm run governance -- audit formal-real-readonly-smoke-local -- --json")
    && text.includes(REQUIRED_EVIDENCE.taskbook)
    && text.includes(REQUIRED_EVIDENCE.preExecution);
}

function taskbookEvidencePassed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-real-readonly-smoke-taskbook-acceptance.v1"
    && getString(evidence, ["mode"])
      === "formal-real-readonly-smoke-taskbook-local-only"
    && getBoolean(evidence, ["checks", "exactTaskbookAccepted"]) === true
    && getBoolean(evidence, ["checks", "priorEvidenceRequired"]) === true
    && getBoolean(evidence, ["checks", "defaultEvidencePathRequired"]) === true
    && getBoolean(evidence, ["checks", "formalDispatchRequired"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true;
}

function preExecutionEvidencePassed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.v1"
    && getString(evidence, ["mode"])
      === "formal-real-readonly-smoke-pre-execution-local-only"
    && getBoolean(evidence, ["checks", "taskbookGateAccepted"]) === true
    && getBoolean(evidence, ["checks", "taskbookEvidencePresent"]) === true
    && getBoolean(evidence, ["checks", "smokeScriptBlocksWithoutOperatorFlag"]) === true
    && getBoolean(evidence, ["checks", "blockedSmokeDoesNotInvokeRunner"]) === true
    && getBoolean(evidence, ["checks", "blockedSmokeWritesSanitizedEvidence"]) === true
    && getBoolean(evidence, ["checks", "defaultEvidencePathRequired"]) === true
    && getBoolean(evidence, ["checks", "formalDispatchBoundaryRequired"]) === true
    && getBoolean(evidence, ["checks", "providerExecuteStillSeparate"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getNumber(evidence, ["counters", "blockedSmokeRunnerCalls"]) === 0;
}

function smokeScriptDefaultEvidencePath(
  scriptText: string,
  preExecutionEvidence: Record<string, unknown> | undefined
): boolean {
  return scriptText.includes("DEFAULT_REAL_CODEX_CLI_READONLY_SMOKE_EVIDENCE_PATH")
    && scriptText.includes("docs/evidence/codex-cli-real-readonly-smoke.json")
    && getString(preExecutionEvidence, ["summary", "realSmokeDefaultEvidencePath"])
      === "docs/evidence/codex-cli-real-readonly-smoke.json";
}

function closeoutNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize local command")
    && normalized.includes("does not authorize protected remote")
    && normalized.includes("does not authorize push, release, or tag");
}

function evidenceIsSanitized(...texts: string[]): boolean {
  return !texts.some((text) =>
    FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker))
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `formal_real_readonly_smoke_local_closeout_${name}`);
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
  const input = await collectFormalRealReadonlySmokeLocalCloseoutAuditInput();
  const review = reviewFormalRealReadonlySmokeLocalCloseoutAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatFormalRealReadonlySmokeLocalCloseoutAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Formal real read-only smoke local closeout audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
