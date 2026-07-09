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
  pr17cCloseout:
    "docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md",
  pr18aAuthorization:
    "docs/governance/PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET.md",
  pr18bFinalPreflight:
    "docs/governance/PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT.md",
  pr18cCloseout:
    "docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md"
} as const;

const REQUIRED_EVIDENCE = {
  executionAuthorization:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
  finalPreflight:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json"
} as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
  "smoke:readonly:real",
  "workspace-write",
  "on-request",
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

export interface FormalRealReadonlySmokeExecutionLocalCloseoutAuditInput {
  gitStatusShort: string;
  branch: string;
  packageJsonText: string;
  pr17cCloseoutText: string;
  pr18aAuthorizationText: string;
  pr18bFinalPreflightText: string;
  pr18cCloseoutText: string;
  executionAuthorizationEvidenceText: string;
  finalPreflightEvidenceText: string;
}

export interface FormalRealReadonlySmokeExecutionLocalCloseoutAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    packageScriptsPresent: boolean;
    priorLocalCloseoutRecorded: boolean;
    pr18aAuthorizationRecorded: boolean;
    pr18bFinalPreflightRecorded: boolean;
    pr18cCloseoutRecorded: boolean;
    executionAuthorizationEvidencePassed: boolean;
    finalPreflightEvidencePassed: boolean;
    requiredValidationChainDeclared: boolean;
    priorCloseoutRequired: boolean;
    formalBoundaryRequired: boolean;
    defaultEvidencePathRequired: boolean;
    operatorFlagNotSetByPreflight: boolean;
    currentExecutionBlocked: boolean;
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
    requiredValidationCommandCount: number;
    currentExecutionMustRemainClosed: boolean;
    operatorFlagMustNotBeSetByPreflight: boolean;
    providerExecuteCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
  };
  reasons: string[];
}

export type FormalRealReadonlySmokeExecutionLocalCloseoutAuditOutputFormat =
  "text" | "json";

export async function collectFormalRealReadonlySmokeExecutionLocalCloseoutAuditInput(
  cwd = process.cwd()
): Promise<FormalRealReadonlySmokeExecutionLocalCloseoutAuditInput> {
  const [gitStatusShort, branch] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd)
  ]);
  const read = (path: string) => readFile(join(cwd, path), "utf8");
  const [
    packageJsonText,
    pr17cCloseoutText,
    pr18aAuthorizationText,
    pr18bFinalPreflightText,
    pr18cCloseoutText,
    executionAuthorizationEvidenceText,
    finalPreflightEvidenceText
  ] = await Promise.all([
    read("package.json"),
    read(REQUIRED_DOCS.pr17cCloseout),
    read(REQUIRED_DOCS.pr18aAuthorization),
    read(REQUIRED_DOCS.pr18bFinalPreflight),
    read(REQUIRED_DOCS.pr18cCloseout),
    read(REQUIRED_EVIDENCE.executionAuthorization),
    read(REQUIRED_EVIDENCE.finalPreflight)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    packageJsonText,
    pr17cCloseoutText,
    pr18aAuthorizationText,
    pr18bFinalPreflightText,
    pr18cCloseoutText,
    executionAuthorizationEvidenceText,
    finalPreflightEvidenceText
  };
}

export function reviewFormalRealReadonlySmokeExecutionLocalCloseoutAudit(
  input: FormalRealReadonlySmokeExecutionLocalCloseoutAuditInput
): FormalRealReadonlySmokeExecutionLocalCloseoutAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const executionAuthorizationEvidence = parseObject(
    input.executionAuthorizationEvidenceText
  );
  const finalPreflightEvidence = parseObject(input.finalPreflightEvidenceText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    priorLocalCloseoutRecorded:
      priorLocalCloseoutRecorded(input.pr17cCloseoutText),
    pr18aAuthorizationRecorded:
      pr18aAuthorizationRecorded(input.pr18aAuthorizationText),
    pr18bFinalPreflightRecorded:
      pr18bFinalPreflightRecorded(input.pr18bFinalPreflightText),
    pr18cCloseoutRecorded: pr18cCloseoutRecorded(input.pr18cCloseoutText),
    executionAuthorizationEvidencePassed:
      executionAuthorizationEvidencePassed(executionAuthorizationEvidence),
    finalPreflightEvidencePassed:
      finalPreflightEvidencePassed(finalPreflightEvidence),
    requiredValidationChainDeclared:
      getBoolean(finalPreflightEvidence, [
        "checks",
        "requiredValidationChainDeclared"
      ]) === true,
    priorCloseoutRequired:
      getBoolean(executionAuthorizationEvidence, [
        "checks",
        "priorCloseoutRequired"
      ]) === true,
    formalBoundaryRequired:
      getBoolean(executionAuthorizationEvidence, [
        "checks",
        "formalBoundaryRequired"
      ]) === true
      && getBoolean(finalPreflightEvidence, [
        "checks",
        "formalBoundaryRequired"
      ]) === true,
    defaultEvidencePathRequired:
      getString(executionAuthorizationEvidence, [
        "summary",
        "requiredEvidencePathChoice"
      ]) === "default"
      && getString(finalPreflightEvidence, [
        "summary",
        "requiredEvidencePathChoice"
      ]) === "default",
    operatorFlagNotSetByPreflight:
      getBoolean(finalPreflightEvidence, [
        "summary",
        "operatorFlagMustNotBeSetByPreflight"
      ]) === true,
    currentExecutionBlocked:
      getBoolean(executionAuthorizationEvidence, [
        "summary",
        "currentExecutionMustRemainClosed"
      ]) === true
      && getBoolean(finalPreflightEvidence, [
        "summary",
        "currentExecutionMustRemainClosed"
      ]) === true,
    noProviderExecute:
      getNumber(executionAuthorizationEvidence, [
        "counters",
        "providerExecuteCalls"
      ]) === 0
      && getNumber(finalPreflightEvidence, [
        "counters",
        "providerExecuteCalls"
      ]) === 0,
    noRealCodexCli:
      getNumber(executionAuthorizationEvidence, [
        "counters",
        "realCodexCliCalls"
      ]) === 0
      && getNumber(finalPreflightEvidence, [
        "counters",
        "realCodexCliCalls"
      ]) === 0,
    noWorkspaceWriteExecute:
      getNumber(executionAuthorizationEvidence, [
        "counters",
        "workspaceWriteExecuteCalls"
      ]) === 0
      && getNumber(finalPreflightEvidence, [
        "counters",
        "workspaceWriteExecuteCalls"
      ]) === 0,
    evidenceSanitized: evidenceIsSanitized(
      input.executionAuthorizationEvidenceText,
      input.finalPreflightEvidenceText
    ),
    closeoutNonAuthorizing: closeoutNonAuthorizing(input.pr18cCloseoutText)
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
        getString(finalPreflightEvidence, ["summary", "requiredProviderId"])
          ?? "unknown",
      sideEffectClass:
        getString(finalPreflightEvidence, [
          "summary",
          "requiredSideEffectClass"
        ]) ?? "unknown",
      sandbox:
        getString(finalPreflightEvidence, ["summary", "requiredSandbox"])
          ?? "unknown",
      approvalPolicy:
        getString(finalPreflightEvidence, [
          "summary",
          "requiredApprovalPolicy"
        ]) ?? "unknown",
      evidencePathChoice:
        getString(finalPreflightEvidence, [
          "summary",
          "requiredEvidencePathChoice"
        ]) ?? "unknown",
      requiredValidationCommandCount:
        getNumber(finalPreflightEvidence, [
          "summary",
          "requiredValidationCommandCount"
        ]) ?? 0,
      currentExecutionMustRemainClosed:
        getBoolean(finalPreflightEvidence, [
          "summary",
          "currentExecutionMustRemainClosed"
        ]) === true,
      operatorFlagMustNotBeSetByPreflight:
        getBoolean(finalPreflightEvidence, [
          "summary",
          "operatorFlagMustNotBeSetByPreflight"
        ]) === true,
      providerExecuteCalls:
        getNumber(finalPreflightEvidence, [
          "counters",
          "providerExecuteCalls"
        ]) ?? 0,
      realCodexCliCalls:
        getNumber(finalPreflightEvidence, [
          "counters",
          "realCodexCliCalls"
        ]) ?? 0,
      workspaceWriteExecuteCalls:
        getNumber(finalPreflightEvidence, [
          "counters",
          "workspaceWriteExecuteCalls"
        ]) ?? 0
    },
    reasons
  };
}

export function formatFormalRealReadonlySmokeExecutionLocalCloseoutAuditResult(
  review: FormalRealReadonlySmokeExecutionLocalCloseoutAuditResult,
  format: FormalRealReadonlySmokeExecutionLocalCloseoutAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Formal real read-only smoke execution local closeout audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `provider: ${review.summary.providerId}`,
    `side effect: ${review.summary.sideEffectClass}`,
    `sandbox: ${review.summary.sandbox}`,
    `approval policy: ${review.summary.approvalPolicy}`,
    `evidence path choice: ${review.summary.evidencePathChoice}`,
    `required validation commands: ${review.summary.requiredValidationCommandCount}`,
    `current execution closed: ${review.summary.currentExecutionMustRemainClosed}`,
    `operator flag set by preflight: ${!review.summary.operatorFlagMustNotBeSetByPreflight}`,
    `provider execute calls: ${review.summary.providerExecuteCalls}`,
    `real CLI calls: ${review.summary.realCodexCliCalls}`,
    `workspace write execute calls: ${review.summary.workspaceWriteExecuteCalls}`,
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

function priorLocalCloseoutRecorded(text: string): boolean {
  return text.includes("PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes("npm run governance -- audit formal-real-readonly-smoke-local")
    && text.includes(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json"
    )
    && text.includes(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json"
    );
}

function pr18aAuthorizationRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes(
    "PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET_RECORDED"
  )
    && text.includes("npm run governance -- acceptance formal-real-readonly-smoke-execution-auth")
    && text.includes(REQUIRED_EVIDENCE.executionAuthorization)
    && normalized.includes("does not execute the real Codex CLI")
    && normalized.includes("does not authorize this PR to run provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("Immediate execution remains blocked");
}

function pr18bFinalPreflightRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes("PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_RECORDED")
    && text.includes("npm run governance -- acceptance formal-real-readonly-smoke-final-preflight")
    && text.includes(REQUIRED_EVIDENCE.finalPreflight)
    && normalized.includes("does not set the future execution operator flag")
    && normalized.includes("does not run the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("workspace-write execute calls remain `0`");
}

function pr18cCloseoutRecorded(text: string): boolean {
  return text.includes(
    "PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT_COMPLETE"
  )
    && text.includes("npm run governance -- audit formal-real-readonly-smoke-execution-local")
    && text.includes("npm run governance -- audit formal-real-readonly-smoke-execution-local -- --json")
    && text.includes(REQUIRED_EVIDENCE.executionAuthorization)
    && text.includes(REQUIRED_EVIDENCE.finalPreflight);
}

function executionAuthorizationEvidencePassed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.v1"
    && getString(evidence, ["mode"])
      === "formal-real-readonly-smoke-execution-authorization-local-only"
    && getBoolean(evidence, ["checks", "exactAuthorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "missingAuthorizationBlocked"]) === true
    && getBoolean(evidence, ["checks", "broadenedAuthorizationBlocked"]) === true
    && getBoolean(evidence, ["checks", "immediateExecutionBlocked"]) === true
    && getBoolean(evidence, ["checks", "pushReleaseTagRejected"]) === true
    && getBoolean(evidence, ["checks", "priorCloseoutRequired"]) === true
    && getBoolean(evidence, ["checks", "formalBoundaryRequired"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getBoolean(evidence, ["summary", "authorizationPacketOnly"]) === true
    && getBoolean(evidence, ["summary", "currentExecutionMustRemainClosed"])
      === true
    && getNumber(evidence, ["counters", "providerExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "realCodexCliCalls"]) === 0
    && getNumber(evidence, ["counters", "workspaceWriteExecuteCalls"]) === 0;
}

function finalPreflightEvidencePassed(
  evidence: Record<string, unknown> | undefined
): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.v1"
    && getString(evidence, ["mode"])
      === "formal-real-readonly-smoke-final-preflight-local-only"
    && getBoolean(evidence, ["checks", "exactPreflightAccepted"]) === true
    && getBoolean(evidence, ["checks", "missingPreflightBlocked"]) === true
    && getBoolean(evidence, ["checks", "broadenedPreflightBlocked"]) === true
    && getBoolean(evidence, ["checks", "immediateExecutionBlocked"]) === true
    && getBoolean(evidence, ["checks", "pushReleaseTagRejected"]) === true
    && getBoolean(evidence, ["checks", "requiredValidationChainDeclared"]) === true
    && getBoolean(evidence, ["checks", "formalBoundaryRequired"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getNumber(evidence, ["summary", "requiredValidationCommandCount"]) === 7
    && getBoolean(evidence, ["summary", "operatorFlagMustNotBeSetByPreflight"])
      === true
    && getBoolean(evidence, ["summary", "currentExecutionMustRemainClosed"])
      === true
    && getNumber(evidence, ["counters", "providerExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "realCodexCliCalls"]) === 0
    && getNumber(evidence, ["counters", "workspaceWriteExecuteCalls"]) === 0;
}

function closeoutNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize local command")
    && normalized.includes("does not authorize protected remote")
    && normalized.includes("does not authorize push, release, or tag")
    && normalized.includes("does not set the future execution operator flag");
}

function evidenceIsSanitized(...texts: string[]): boolean {
  return !texts.some((text) =>
    FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker))
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) =>
      `formal_real_readonly_smoke_execution_local_closeout_${name}`
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
    await collectFormalRealReadonlySmokeExecutionLocalCloseoutAuditInput();
  const review = reviewFormalRealReadonlySmokeExecutionLocalCloseoutAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(
    formatFormalRealReadonlySmokeExecutionLocalCloseoutAuditResult(
      review,
      format
    )
  );

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Formal real read-only smoke execution local closeout audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
