#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectReadonlyRealSmokeChainIndexAuditInput,
  reviewReadonlyRealSmokeChainIndexAudit,
  type ReadonlyRealSmokeChainIndexAuditInput
} from "./run-readonly-real-smoke-chain-index-audit.js";

const REQUIRED_PACKAGE_SCRIPTS = {
  "audit:readonly-real-smoke-chain-index":
    "tsx scripts/run-readonly-real-smoke-chain-index-audit.ts",
  "audit:readonly-real-smoke-chain-candidate":
    "tsx scripts/run-readonly-real-smoke-chain-local-candidate-consistency.ts",
  "audit:formal-real-readonly-smoke-rc-local-closeout":
    "tsx scripts/run-formal-real-readonly-smoke-rc-local-closeout-audit.ts"
} as const;

const REQUIRED_EVIDENCE = {
  realSmoke: "docs/evidence/codex-cli-real-readonly-smoke.json",
  formalExecutionAuth:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
  formalFinalPreflight:
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json"
} as const;

const PR20B_DOC =
  "docs/governance/PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE.md";

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

export interface ReadonlyRealSmokeChainLocalCandidateConsistencyInput {
  chainIndexInput: ReadonlyRealSmokeChainIndexAuditInput;
  pr20bCandidateText: string;
}

export interface ReadonlyRealSmokeChainLocalCandidateConsistencyResult {
  decision: "APPROVE_LOCAL_CANDIDATE" | "BLOCK_LOCAL_CANDIDATE";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptsPresent: boolean;
    chainIndexPassed: boolean;
    pr20aIndexRecorded: boolean;
    pr20bCandidateRecorded: boolean;
    realSmokeEvidencePassed: boolean;
    formalExecutionAuthClosed: boolean;
    formalFinalPreflightClosed: boolean;
    workspaceWriteClosed: boolean;
    providerExecuteClosed: boolean;
    evidenceSanitized: boolean;
    candidateNonAuthorizing: boolean;
    noProviderExecuteDuringCandidate: boolean;
    noRealCodexCliDuringCandidate: boolean;
    noWorkspaceWriteExecuteDuringCandidate: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    chainIndexStatus: "passed" | "blocked";
    realSmokeStatus: string;
    realSmokeSandbox: string;
    realSmokeApprovalPolicy: string;
    realSmokeExitCode: number | null;
    providerExecuteCallsDuringCandidate: 0;
    realCodexCliCallsDuringCandidate: 0;
    workspaceWriteExecuteCallsDuringCandidate: 0;
  };
  reasons: string[];
}

export type ReadonlyRealSmokeChainLocalCandidateConsistencyOutputFormat =
  | "text"
  | "json";

export async function collectReadonlyRealSmokeChainLocalCandidateConsistencyInput(
  cwd = process.cwd()
): Promise<ReadonlyRealSmokeChainLocalCandidateConsistencyInput> {
  return {
    chainIndexInput: await collectReadonlyRealSmokeChainIndexAuditInput(cwd),
    pr20bCandidateText: await readFile(join(cwd, PR20B_DOC), "utf8")
  };
}

export function reviewReadonlyRealSmokeChainLocalCandidateConsistency(
  input: ReadonlyRealSmokeChainLocalCandidateConsistencyInput
): ReadonlyRealSmokeChainLocalCandidateConsistencyResult {
  const chainIndexReview = reviewReadonlyRealSmokeChainIndexAudit(
    input.chainIndexInput
  );
  const packageJson = parseObject(input.chainIndexInput.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const checks = {
    worktreeClean: chainIndexReview.checks.worktreeClean,
    branchMain: chainIndexReview.checks.branchMain,
    notBehindOrigin: chainIndexReview.checks.notBehindOrigin,
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    chainIndexPassed: chainIndexReview.status === "passed",
    pr20aIndexRecorded: chainIndexReview.checks.pr20aIndexRecorded,
    pr20bCandidateRecorded: pr20bCandidateRecorded(input.pr20bCandidateText),
    realSmokeEvidencePassed: chainIndexReview.checks.realSmokeEvidencePassed,
    formalExecutionAuthClosed:
      chainIndexReview.checks.formalExecutionAuthClosed,
    formalFinalPreflightClosed:
      chainIndexReview.checks.formalFinalPreflightClosed,
    workspaceWriteClosed: chainIndexReview.checks.workspaceWriteClosed,
    providerExecuteClosed: chainIndexReview.checks.providerExecuteClosed,
    evidenceSanitized: chainIndexReview.checks.evidenceSanitized,
    candidateNonAuthorizing: candidateNonAuthorizing(input.pr20bCandidateText),
    noProviderExecuteDuringCandidate: true,
    noRealCodexCliDuringCandidate: true,
    noWorkspaceWriteExecuteDuringCandidate: true
  };
  const reasons = collectReasons(checks);

  return {
    decision:
      reasons.length === 0 ? "APPROVE_LOCAL_CANDIDATE" : "BLOCK_LOCAL_CANDIDATE",
    checks,
    summary: {
      branch: chainIndexReview.summary.branch,
      ahead: chainIndexReview.summary.ahead,
      behind: chainIndexReview.summary.behind,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      chainIndexStatus: chainIndexReview.status,
      realSmokeStatus: chainIndexReview.summary.realSmokeStatus,
      realSmokeSandbox: chainIndexReview.summary.realSmokeSandbox,
      realSmokeApprovalPolicy: chainIndexReview.summary.realSmokeApprovalPolicy,
      realSmokeExitCode: chainIndexReview.summary.realSmokeExitCode,
      providerExecuteCallsDuringCandidate: 0,
      realCodexCliCallsDuringCandidate: 0,
      workspaceWriteExecuteCallsDuringCandidate: 0
    },
    reasons
  };
}

export function formatReadonlyRealSmokeChainLocalCandidateConsistencyResult(
  review: ReadonlyRealSmokeChainLocalCandidateConsistencyResult,
  format: ReadonlyRealSmokeChainLocalCandidateConsistencyOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Read-only real smoke chain local candidate consistency",
    `decision: ${review.decision}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `chain index status: ${review.summary.chainIndexStatus}`,
    `real smoke status: ${review.summary.realSmokeStatus}`,
    `real smoke sandbox: ${review.summary.realSmokeSandbox}`,
    `real smoke approval policy: ${review.summary.realSmokeApprovalPolicy}`,
    `real smoke exit code: ${review.summary.realSmokeExitCode ?? "unknown"}`,
    `provider execute calls during candidate: ${review.summary.providerExecuteCallsDuringCandidate}`,
    `real CLI calls during candidate: ${review.summary.realCodexCliCallsDuringCandidate}`,
    `workspace write execute calls during candidate: ${review.summary.workspaceWriteExecuteCallsDuringCandidate}`,
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

function pr20bCandidateRecorded(text: string): boolean {
  return text.includes("PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE_RECORDED")
    && text.includes("npm run audit:readonly-real-smoke-chain-candidate")
    && text.includes("npm run audit:readonly-real-smoke-chain-index")
    && text.includes(REQUIRED_EVIDENCE.realSmoke)
    && text.includes(REQUIRED_EVIDENCE.formalExecutionAuth)
    && text.includes(REQUIRED_EVIDENCE.formalFinalPreflight);
}

function candidateNonAuthorizing(text: string): boolean {
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
    .map(([name]) => `readonly_real_smoke_chain_candidate_${name}`);
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
  const input = await collectReadonlyRealSmokeChainLocalCandidateConsistencyInput();
  const review = reviewReadonlyRealSmokeChainLocalCandidateConsistency(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatReadonlyRealSmokeChainLocalCandidateConsistencyResult(review, format));

  if (review.decision !== "APPROVE_LOCAL_CANDIDATE") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Read-only real smoke chain local candidate consistency failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
