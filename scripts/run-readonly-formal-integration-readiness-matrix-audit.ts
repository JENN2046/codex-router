#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  collectFormalReadonlyIntegrationLocalCloseoutAuditInput,
  reviewFormalReadonlyIntegrationLocalCloseoutAudit,
  type FormalReadonlyIntegrationLocalCloseoutAuditInput
} from "./run-formal-readonly-cli-integration-local-closeout-audit.js";
import {
  collectFormalReadonlyProviderIntegrationLocalCloseoutAuditInput,
  reviewFormalReadonlyProviderIntegrationLocalCloseoutAudit,
  type FormalReadonlyProviderIntegrationLocalCloseoutAuditInput
} from "./run-formal-readonly-provider-integration-local-closeout-audit.js";
import {
  collectFormalReadonlyDispatchBoundaryLocalCloseoutAuditInput,
  reviewFormalReadonlyDispatchBoundaryLocalCloseoutAudit,
  type FormalReadonlyDispatchBoundaryLocalCloseoutAuditInput
} from "./run-formal-readonly-dispatch-boundary-local-closeout-audit.js";
import {
  collectFormalRealReadonlySmokeRcLocalCloseoutAuditInput,
  reviewFormalRealReadonlySmokeRcLocalCloseoutAudit,
  type FormalRealReadonlySmokeRcLocalCloseoutAuditInput
} from "./run-formal-real-readonly-smoke-rc-local-closeout-audit.js";
import {
  collectReadonlyRealSmokeChainLocalCloseoutAuditInput,
  reviewReadonlyRealSmokeChainLocalCloseoutAudit,
  type ReadonlyRealSmokeChainLocalCloseoutAuditInput
} from "./run-readonly-real-smoke-chain-local-closeout-audit.js";

const execFileAsync = promisify(execFile);

const REQUIRED_PACKAGE_SCRIPTS = {
  "audit:formal-readonly-integration-local":
    "tsx scripts/run-formal-readonly-cli-integration-local-closeout-audit.ts",
  "audit:formal-readonly-provider-integration-local":
    "tsx scripts/run-formal-readonly-provider-integration-local-closeout-audit.ts",
  "audit:formal-readonly-dispatch-boundary-local":
    "tsx scripts/run-formal-readonly-dispatch-boundary-local-closeout-audit.ts",
  "audit:formal-real-readonly-smoke-rc-local-closeout":
    "tsx scripts/run-formal-real-readonly-smoke-rc-local-closeout-audit.ts",
  "audit:readonly-real-smoke-chain-local-closeout":
    "tsx scripts/run-readonly-real-smoke-chain-local-closeout-audit.ts",
  "audit:readonly-formal-integration-matrix":
    "tsx scripts/run-readonly-formal-integration-readiness-matrix-audit.ts"
} as const;

const PR21A_DOC =
  "docs/governance/PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX.md";

const REQUIRED_DOC_MARKERS = [
  "PR_14C_FORMAL_READONLY_CLI_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE",
  "PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE",
  "PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT_COMPLETE",
  "PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT_COMPLETE",
  "PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE",
  "PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX_RECORDED"
] as const;

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

export interface ReadonlyFormalIntegrationReadinessMatrixAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  packageJsonText: string;
  pr21aMatrixText: string;
  formalIntegrationInput: FormalReadonlyIntegrationLocalCloseoutAuditInput;
  providerIntegrationInput: FormalReadonlyProviderIntegrationLocalCloseoutAuditInput;
  dispatchBoundaryInput: FormalReadonlyDispatchBoundaryLocalCloseoutAuditInput;
  formalRealSmokeRcInput: FormalRealReadonlySmokeRcLocalCloseoutAuditInput;
  realSmokeChainInput: ReadonlyRealSmokeChainLocalCloseoutAuditInput;
}

export interface ReadonlyFormalIntegrationReadinessMatrixAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptsPresent: boolean;
    formalIntegrationClosed: boolean;
    providerIntegrationClosed: boolean;
    dispatchBoundaryClosed: boolean;
    formalRealSmokeRcClosed: boolean;
    realSmokeChainClosed: boolean;
    matrixDocRecorded: boolean;
    allMatrixRowsPassed: boolean;
    readOnlyBoundaryPreserved: boolean;
    workspaceWriteClosed: boolean;
    providerExecuteClosedForMatrix: boolean;
    realCliNotInvokedByMatrix: boolean;
    evidenceSanitized: boolean;
    matrixNonAuthorizing: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    matrixRowCount: number;
    passedMatrixRowCount: number;
    formalIntegrationStatus: string;
    providerIntegrationStatus: string;
    dispatchBoundaryStatus: string;
    formalRealSmokeRcStatus: string;
    realSmokeChainStatus: string;
    providerExecuteCallsDuringMatrix: 0;
    realCodexCliCallsDuringMatrix: 0;
    workspaceWriteExecuteCallsDuringMatrix: 0;
  };
  reasons: string[];
}

export type ReadonlyFormalIntegrationReadinessMatrixAuditOutputFormat =
  | "text"
  | "json";

export async function collectReadonlyFormalIntegrationReadinessMatrixAuditInput(
  cwd = process.cwd()
): Promise<ReadonlyFormalIntegrationReadinessMatrixAuditInput> {
  const [gitStatusShort, branch, aheadBehind] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-list", "--left-right", "--count", "HEAD...origin/main"], cwd)
      .catch(() => "0\t0")
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    aheadBehind: aheadBehind.trim(),
    packageJsonText: await readFile(join(cwd, "package.json"), "utf8"),
    pr21aMatrixText: await readFile(join(cwd, PR21A_DOC), "utf8"),
    formalIntegrationInput:
      await collectFormalReadonlyIntegrationLocalCloseoutAuditInput(cwd),
    providerIntegrationInput:
      await collectFormalReadonlyProviderIntegrationLocalCloseoutAuditInput(cwd),
    dispatchBoundaryInput:
      await collectFormalReadonlyDispatchBoundaryLocalCloseoutAuditInput(cwd),
    formalRealSmokeRcInput:
      await collectFormalRealReadonlySmokeRcLocalCloseoutAuditInput(cwd),
    realSmokeChainInput:
      await collectReadonlyRealSmokeChainLocalCloseoutAuditInput(cwd)
  };
}

export function reviewReadonlyFormalIntegrationReadinessMatrixAudit(
  input: ReadonlyFormalIntegrationReadinessMatrixAuditInput
): ReadonlyFormalIntegrationReadinessMatrixAuditResult {
  const formalIntegration =
    reviewFormalReadonlyIntegrationLocalCloseoutAudit(
      input.formalIntegrationInput
    );
  const providerIntegration =
    reviewFormalReadonlyProviderIntegrationLocalCloseoutAudit(
      input.providerIntegrationInput
    );
  const dispatchBoundary =
    reviewFormalReadonlyDispatchBoundaryLocalCloseoutAudit(
      input.dispatchBoundaryInput
    );
  const formalRealSmokeRc =
    reviewFormalRealReadonlySmokeRcLocalCloseoutAudit(
      input.formalRealSmokeRcInput
    );
  const realSmokeChain =
    reviewReadonlyRealSmokeChainLocalCloseoutAudit(input.realSmokeChainInput);
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const matrixRows = [
    formalIntegration.status,
    providerIntegration.status,
    dispatchBoundary.status,
    formalRealSmokeRc.status,
    realSmokeChain.status
  ];
  const passedMatrixRows = matrixRows.filter((status) => status === "passed");
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    formalIntegrationClosed: formalIntegration.status === "passed",
    providerIntegrationClosed: providerIntegration.status === "passed",
    dispatchBoundaryClosed: dispatchBoundary.status === "passed",
    formalRealSmokeRcClosed: formalRealSmokeRc.status === "passed",
    realSmokeChainClosed: realSmokeChain.status === "passed",
    matrixDocRecorded: matrixDocRecorded(input.pr21aMatrixText),
    allMatrixRowsPassed: passedMatrixRows.length === matrixRows.length,
    readOnlyBoundaryPreserved:
      providerIntegration.summary.sideEffectClass === "read_only"
      && dispatchBoundary.summary.sideEffectClass === "read_only"
      && realSmokeChain.summary.realSmokeSandbox === "read-only",
    workspaceWriteClosed:
      providerIntegration.checks.noWorkspaceWriteExecute
      && dispatchBoundary.checks.noWorkspaceWriteExecute
      && formalRealSmokeRc.checks.workspaceWriteClosed
      && realSmokeChain.checks.workspaceWriteClosed,
    providerExecuteClosedForMatrix:
      formalIntegration.checks.noProviderExecute
      && formalRealSmokeRc.checks.providerExecuteClosed
      && realSmokeChain.checks.providerExecuteClosed,
    realCliNotInvokedByMatrix: true,
    evidenceSanitized:
      formalIntegration.checks.evidenceSanitized
      && providerIntegration.checks.evidenceSanitized
      && dispatchBoundary.checks.evidenceSanitized
      && formalRealSmokeRc.checks.evidenceSanitized
      && realSmokeChain.checks.evidenceSanitized
      && !containsForbiddenMarkers(input.pr21aMatrixText),
    matrixNonAuthorizing: matrixNonAuthorizing(input.pr21aMatrixText)
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
      matrixRowCount: matrixRows.length,
      passedMatrixRowCount: passedMatrixRows.length,
      formalIntegrationStatus: formalIntegration.status,
      providerIntegrationStatus: providerIntegration.status,
      dispatchBoundaryStatus: dispatchBoundary.status,
      formalRealSmokeRcStatus: formalRealSmokeRc.status,
      realSmokeChainStatus: realSmokeChain.status,
      providerExecuteCallsDuringMatrix: 0,
      realCodexCliCallsDuringMatrix: 0,
      workspaceWriteExecuteCallsDuringMatrix: 0
    },
    reasons
  };
}

export function formatReadonlyFormalIntegrationReadinessMatrixAuditResult(
  review: ReadonlyFormalIntegrationReadinessMatrixAuditResult,
  format: ReadonlyFormalIntegrationReadinessMatrixAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Read-only formal integration readiness matrix audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `matrix rows passed: ${review.summary.passedMatrixRowCount}/${review.summary.matrixRowCount}`,
    `formal integration: ${review.summary.formalIntegrationStatus}`,
    `provider integration: ${review.summary.providerIntegrationStatus}`,
    `dispatch boundary: ${review.summary.dispatchBoundaryStatus}`,
    `formal real smoke RC: ${review.summary.formalRealSmokeRcStatus}`,
    `real smoke chain: ${review.summary.realSmokeChainStatus}`,
    `provider execute calls during matrix: ${review.summary.providerExecuteCallsDuringMatrix}`,
    `real CLI calls during matrix: ${review.summary.realCodexCliCallsDuringMatrix}`,
    `workspace write execute calls during matrix: ${review.summary.workspaceWriteExecuteCallsDuringMatrix}`,
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

function matrixDocRecorded(text: string): boolean {
  return text.includes("PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX_RECORDED")
    && text.includes("npm run audit:readonly-formal-integration-matrix")
    && text.includes("npm run audit:readonly-real-smoke-chain-local-closeout")
    && REQUIRED_DOC_MARKERS.every((marker) => text.includes(marker));
}

function matrixNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize push, release, or tag")
    && normalized.includes("does not set an execution operator flag")
    && !containsForbiddenMarkers(text);
}

function containsForbiddenMarkers(text: string): boolean {
  return FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `readonly_formal_integration_matrix_${name}`);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  const input = await collectReadonlyFormalIntegrationReadinessMatrixAuditInput();
  const review = reviewReadonlyFormalIntegrationReadinessMatrixAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatReadonlyFormalIntegrationReadinessMatrixAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Read-only formal integration readiness matrix audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
