#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectReadonlyRealSmokeChainLocalCandidateConsistencyInput,
  reviewReadonlyRealSmokeChainLocalCandidateConsistency,
  type ReadonlyRealSmokeChainLocalCandidateConsistencyInput
} from "./run-readonly-real-smoke-chain-local-candidate-consistency.js";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "node --import tsx scripts/run-governance-check.ts"
} as const;

const PR20C_DOC =
  "docs/governance/PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT.md";

const REQUIRED_FILES = [
  "docs/governance/PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX.md",
  "docs/governance/PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE.md",
  PR20C_DOC,
  "docs/evidence/codex-cli-real-readonly-smoke.json",
  "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
  "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json"
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

export interface ReadonlyRealSmokeChainLocalCloseoutAuditInput {
  candidateInput: ReadonlyRealSmokeChainLocalCandidateConsistencyInput;
  pr20cCloseoutText: string;
}

export interface ReadonlyRealSmokeChainLocalCloseoutAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptsPresent: boolean;
    candidateApproved: boolean;
    pr20aIndexRecorded: boolean;
    pr20bCandidateRecorded: boolean;
    pr20cCloseoutRecorded: boolean;
    realSmokeEvidencePassed: boolean;
    formalGatesClosed: boolean;
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
    candidateDecision: "APPROVE_LOCAL_CANDIDATE" | "BLOCK_LOCAL_CANDIDATE";
    realSmokeStatus: string;
    realSmokeSandbox: string;
    realSmokeApprovalPolicy: string;
    realSmokeExitCode: number | null;
    providerExecuteCallsDuringCloseout: 0;
    realCodexCliCallsDuringCloseout: 0;
    workspaceWriteExecuteCallsDuringCloseout: 0;
  };
  reasons: string[];
}

export type ReadonlyRealSmokeChainLocalCloseoutAuditOutputFormat =
  | "text"
  | "json";

export async function collectReadonlyRealSmokeChainLocalCloseoutAuditInput(
  cwd = process.cwd()
): Promise<ReadonlyRealSmokeChainLocalCloseoutAuditInput> {
  return {
    candidateInput:
      await collectReadonlyRealSmokeChainLocalCandidateConsistencyInput(cwd),
    pr20cCloseoutText: await readFile(join(cwd, PR20C_DOC), "utf8")
  };
}

export function reviewReadonlyRealSmokeChainLocalCloseoutAudit(
  input: ReadonlyRealSmokeChainLocalCloseoutAuditInput
): ReadonlyRealSmokeChainLocalCloseoutAuditResult {
  const candidate = reviewReadonlyRealSmokeChainLocalCandidateConsistency(
    input.candidateInput
  );
  const packageJson = parseObject(
    input.candidateInput.chainIndexInput.packageJsonText
  );
  const packageScriptReview = reviewPackageScripts(packageJson);
  const checks = {
    worktreeClean: candidate.checks.worktreeClean,
    branchMain: candidate.checks.branchMain,
    notBehindOrigin: candidate.checks.notBehindOrigin,
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    candidateApproved: candidate.decision === "APPROVE_LOCAL_CANDIDATE",
    pr20aIndexRecorded: candidate.checks.pr20aIndexRecorded,
    pr20bCandidateRecorded: candidate.checks.pr20bCandidateRecorded,
    pr20cCloseoutRecorded: pr20cCloseoutRecorded(input.pr20cCloseoutText),
    realSmokeEvidencePassed: candidate.checks.realSmokeEvidencePassed,
    formalGatesClosed:
      candidate.checks.formalExecutionAuthClosed
      && candidate.checks.formalFinalPreflightClosed,
    workspaceWriteClosed: candidate.checks.workspaceWriteClosed,
    providerExecuteClosed: candidate.checks.providerExecuteClosed,
    evidenceSanitized: candidate.checks.evidenceSanitized,
    closeoutNonAuthorizing: closeoutNonAuthorizing(input.pr20cCloseoutText),
    noProviderExecuteDuringCloseout: true,
    noRealCodexCliDuringCloseout: true,
    noWorkspaceWriteExecuteDuringCloseout: true
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: candidate.summary.branch,
      ahead: candidate.summary.ahead,
      behind: candidate.summary.behind,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      candidateDecision: candidate.decision,
      realSmokeStatus: candidate.summary.realSmokeStatus,
      realSmokeSandbox: candidate.summary.realSmokeSandbox,
      realSmokeApprovalPolicy: candidate.summary.realSmokeApprovalPolicy,
      realSmokeExitCode: candidate.summary.realSmokeExitCode,
      providerExecuteCallsDuringCloseout: 0,
      realCodexCliCallsDuringCloseout: 0,
      workspaceWriteExecuteCallsDuringCloseout: 0
    },
    reasons
  };
}

export function formatReadonlyRealSmokeChainLocalCloseoutAuditResult(
  review: ReadonlyRealSmokeChainLocalCloseoutAuditResult,
  format: ReadonlyRealSmokeChainLocalCloseoutAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Read-only real smoke chain local closeout audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `candidate decision: ${review.summary.candidateDecision}`,
    `real smoke status: ${review.summary.realSmokeStatus}`,
    `real smoke sandbox: ${review.summary.realSmokeSandbox}`,
    `real smoke approval policy: ${review.summary.realSmokeApprovalPolicy}`,
    `real smoke exit code: ${review.summary.realSmokeExitCode ?? "unknown"}`,
    `provider execute calls during closeout: ${review.summary.providerExecuteCallsDuringCloseout}`,
    `real CLI calls during closeout: ${review.summary.realCodexCliCallsDuringCloseout}`,
    `workspace write execute calls during closeout: ${review.summary.workspaceWriteExecuteCallsDuringCloseout}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
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

function pr20cCloseoutRecorded(text: string): boolean {
  return text.includes("PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes("npm run governance -- audit readonly-real-smoke-chain-local-closeout")
    && text.includes("npm run governance -- audit readonly-real-smoke-chain-candidate")
    && text.includes("npm run governance -- audit readonly-real-smoke-chain-index")
    && REQUIRED_FILES.every((file) => text.includes(file));
}

function closeoutNonAuthorizing(text: string): boolean {
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
    .map(([name]) => `readonly_real_smoke_chain_local_closeout_${name}`);
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
  const input = await collectReadonlyRealSmokeChainLocalCloseoutAuditInput();
  const review = reviewReadonlyRealSmokeChainLocalCloseoutAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatReadonlyRealSmokeChainLocalCloseoutAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Read-only real smoke chain local closeout audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
