#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MATRIX_DOC =
  "docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md";
const APPROVAL_CLOSEOUT_DOC =
  "docs/governance/APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT.md";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "node --import tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_MATRIX_MARKERS = [
  "APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX_RECORDED",
  "npm run governance -- audit approval-consumption-dispatch-matrix",
  "APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT_COMPLETE",
  "tests/approval-permit.test.ts",
  "tests/execution-eligibility.test.ts",
  "tests/agent-os-mcp-local-runtime.test.ts",
  "tests/host-dispatcher.test.ts",
  "tests/redaction.test.ts",
  "tests/jsonl-event-log.test.ts",
  "tests/artifact-store.test.ts",
  "tests/tool-invocation-planner.test.ts",
  "tests/workspace-write-guard.test.ts"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
  "ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE",
  "requestedAction",
  "prompt",
  "stdout",
  "stderr",
  "raw command",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
] as const;

export interface ApprovalConsumptionDispatchMatrixAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  packageJsonText: string;
  matrixDocText: string;
  approvalCloseoutText: string;
  approvalPermitTestText: string;
  executionEligibilityTestText: string;
  mcpRuntimeTestText: string;
  sdkTestText: string;
  cliTestText: string;
  appServerTestText: string;
  hostDispatcherTestText: string;
  redactionTestText: string;
  jsonlEventLogTestText: string;
  artifactStoreTestText: string;
  toolInvocationPlannerTestText: string;
  resultEnvelopeText: string;
  workspaceWriteGuardTestText: string;
}

export interface ApprovalConsumptionDispatchMatrixAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptPresent: boolean;
    matrixDocRecorded: boolean;
    matrixNonAuthorizing: boolean;
    approvalConsumptionCloseoutRecorded: boolean;
    approvalPermitCoveragePresent: boolean;
    executionEligibilityPermitStoreCoveragePresent: boolean;
    mcpConsumptionCoveragePresent: boolean;
    publicWrapperConsumptionCoveragePresent: boolean;
    providerDispatchPreconditionsCovered: boolean;
    workspaceWriteRejectBeforeSpawnCovered: boolean;
    invalidRunnerStateBlockedCovered: boolean;
    auditRedactionCoveragePresent: boolean;
    evidenceSanitized: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    approvalCoverageRows: number;
    dispatchCoverageRows: number;
    redactionCoverageRows: number;
    providerExecuteCallsDuringMatrix: 0;
    realCodexCliCallsDuringMatrix: 0;
    workspaceWriteExecuteCallsDuringMatrix: 0;
  };
  reasons: string[];
}

export type ApprovalConsumptionDispatchMatrixAuditOutputFormat =
  | "text"
  | "json";

export async function collectApprovalConsumptionDispatchMatrixAuditInput(
  cwd = process.cwd()
): Promise<ApprovalConsumptionDispatchMatrixAuditInput> {
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
    matrixDocText: await read(cwd, MATRIX_DOC),
    approvalCloseoutText: await read(cwd, APPROVAL_CLOSEOUT_DOC),
    approvalPermitTestText: await read(cwd, "tests/approval-permit.test.ts"),
    executionEligibilityTestText:
      await read(cwd, "tests/execution-eligibility.test.ts"),
    mcpRuntimeTestText: await read(cwd, "tests/agent-os-mcp-local-runtime.test.ts"),
    sdkTestText: await read(cwd, "tests/agent-os-sdk.test.ts"),
    cliTestText: await read(cwd, "tests/agent-os-cli.test.ts"),
    appServerTestText: await read(cwd, "tests/agent-os-app-server.test.ts"),
    hostDispatcherTestText: await read(cwd, "tests/host-dispatcher.test.ts"),
    redactionTestText: await read(cwd, "tests/redaction.test.ts"),
    jsonlEventLogTestText: await read(cwd, "tests/jsonl-event-log.test.ts"),
    artifactStoreTestText: await read(cwd, "tests/artifact-store.test.ts"),
    toolInvocationPlannerTestText:
      await read(cwd, "tests/tool-invocation-planner.test.ts"),
    resultEnvelopeText:
      await read(cwd, "packages/desktop-live-adapter/src/result-envelope.ts"),
    workspaceWriteGuardTestText: await read(cwd, "tests/workspace-write-guard.test.ts")
  };
}

export function reviewApprovalConsumptionDispatchMatrixAudit(
  input: ApprovalConsumptionDispatchMatrixAuditInput
): ApprovalConsumptionDispatchMatrixAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const approvalCoverageRows = countTrue([
    approvalPermitCoveragePresent(input),
    executionEligibilityPermitStoreCoveragePresent(input),
    mcpConsumptionCoveragePresent(input),
    publicWrapperConsumptionCoveragePresent(input)
  ]);
  const dispatchCoverageRows = countTrue([
    providerDispatchPreconditionsCovered(input),
    workspaceWriteRejectBeforeSpawnCovered(input),
    invalidRunnerStateBlockedCovered(input)
  ]);
  const redactionCoverageRows = countTrue([
    input.redactionTestText.includes("safe audit redaction helpers redact and cap payloads"),
    input.jsonlEventLogTestText.includes("redacts secret-like event payload fields"),
    input.artifactStoreTestText.includes("artifact metadata redaction removes nested secret-like fields"),
    input.toolInvocationPlannerTestText.includes("tool invocation planner redacts proposed input preview"),
    input.resultEnvelopeText.includes("redactPrimitiveResultEnvelope"),
    input.workspaceWriteGuardTestText.includes("detects secret-like diff content without returning raw diff")
  ]);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptPresent: packageScriptReview.mismatchCount === 0,
    matrixDocRecorded: matrixDocRecorded(input.matrixDocText),
    matrixNonAuthorizing: matrixNonAuthorizing(input.matrixDocText),
    approvalConsumptionCloseoutRecorded:
      input.approvalCloseoutText.includes("APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT_COMPLETE"),
    approvalPermitCoveragePresent: approvalPermitCoveragePresent(input),
    executionEligibilityPermitStoreCoveragePresent:
      executionEligibilityPermitStoreCoveragePresent(input),
    mcpConsumptionCoveragePresent: mcpConsumptionCoveragePresent(input),
    publicWrapperConsumptionCoveragePresent:
      publicWrapperConsumptionCoveragePresent(input),
    providerDispatchPreconditionsCovered:
      providerDispatchPreconditionsCovered(input),
    workspaceWriteRejectBeforeSpawnCovered:
      workspaceWriteRejectBeforeSpawnCovered(input),
    invalidRunnerStateBlockedCovered:
      invalidRunnerStateBlockedCovered(input),
    auditRedactionCoveragePresent: redactionCoverageRows === 6,
    evidenceSanitized:
      !containsForbiddenMarkers(input.matrixDocText)
      && !containsForbiddenMarkers(input.approvalCloseoutText)
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
      approvalCoverageRows,
      dispatchCoverageRows,
      redactionCoverageRows,
      providerExecuteCallsDuringMatrix: 0,
      realCodexCliCallsDuringMatrix: 0,
      workspaceWriteExecuteCallsDuringMatrix: 0
    },
    reasons
  };
}

export function formatApprovalConsumptionDispatchMatrixAuditResult(
  review: ApprovalConsumptionDispatchMatrixAuditResult,
  format: ApprovalConsumptionDispatchMatrixAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Approval consumption dispatch audit matrix",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `approval coverage rows: ${review.summary.approvalCoverageRows}/4`,
    `dispatch coverage rows: ${review.summary.dispatchCoverageRows}/3`,
    `redaction coverage rows: ${review.summary.redactionCoverageRows}/6`,
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

function matrixDocRecorded(text: string): boolean {
  return REQUIRED_MATRIX_MARKERS.every((marker) => text.includes(marker));
}

function matrixNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize")
    && normalized.includes("real provider execution")
    && normalized.includes("real Codex CLI invocation")
    && normalized.includes("workspace-write execution")
    && normalized.includes("local command execution")
    && normalized.includes("push, release, tag")
    && !containsForbiddenMarkers(text);
}

function approvalPermitCoveragePresent(
  input: ApprovalConsumptionDispatchMatrixAuditInput
): boolean {
  return input.approvalPermitTestText.includes("approval permit validates a permit")
    && input.approvalPermitTestText.includes("approval permit rejects revoked permits")
    && input.approvalPermitTestText.includes("approval permit rejects planHash mismatches");
}

function executionEligibilityPermitStoreCoveragePresent(
  input: ApprovalConsumptionDispatchMatrixAuditInput
): boolean {
  return input.executionEligibilityTestText.includes("loads valid approval permits from store")
    && input.executionEligibilityTestText.includes("rejects revoked permits loaded from store")
    && input.executionEligibilityTestText.includes("only loads permits for the matching task run and principal");
}

function mcpConsumptionCoveragePresent(
  input: ApprovalConsumptionDispatchMatrixAuditInput
): boolean {
  return input.mcpRuntimeTestText.includes("consumes approval permits into a planned provider plan")
    && input.mcpRuntimeTestText.includes("records revoked permits during approval consumption")
    && input.mcpRuntimeTestText.includes("rejects stale permits during approval consumption")
    && input.mcpRuntimeTestText.includes("does not consume permits without planning context");
}

function publicWrapperConsumptionCoveragePresent(
  input: ApprovalConsumptionDispatchMatrixAuditInput
): boolean {
  return input.sdkTestText.includes("SDK approval consumption")
    && input.cliTestText.includes("CLI approval consumption")
    && input.appServerTestText.includes("App Server approval consumption")
    && input.sdkTestText.includes("preserves rejected permit audit during approval consumption")
    && input.cliTestText.includes("preserves rejected permit audit without spawning CLI")
    && input.appServerTestText.includes("preserves rejected permit audit without network");
}

function providerDispatchPreconditionsCovered(
  input: ApprovalConsumptionDispatchMatrixAuditInput
): boolean {
  return input.hostDispatcherTestText.includes(
    "read-only provider dispatch creates permit and uses fake in-memory execution"
  )
    && input.hostDispatcherTestText.includes("dry-runs read-only runner provider dispatch without spawn");
}

function workspaceWriteRejectBeforeSpawnCovered(
  input: ApprovalConsumptionDispatchMatrixAuditInput
): boolean {
  return input.hostDispatcherTestText.includes("rejects workspace-write provider dispatch before spawn");
}

function invalidRunnerStateBlockedCovered(
  input: ApprovalConsumptionDispatchMatrixAuditInput
): boolean {
  return input.hostDispatcherTestText.includes("rejects invalid runner result states before provider dispatch");
}

function containsForbiddenMarkers(text: string): boolean {
  return FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `approval_consumption_dispatch_matrix_${name}`);
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

function countTrue(values: boolean[]): number {
  return values.filter(Boolean).length;
}

async function main(): Promise<void> {
  const input = await collectApprovalConsumptionDispatchMatrixAuditInput();
  const review = reviewApprovalConsumptionDispatchMatrixAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatApprovalConsumptionDispatchMatrixAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Approval consumption dispatch audit matrix failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
