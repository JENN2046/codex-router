#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const MATRIX_DOC =
  "docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md";
const MATRIX_AUDIT = "scripts/run-approval-consumption-dispatch-matrix-audit.ts";
const MATRIX_TEST = "tests/approval-consumption-dispatch-matrix-audit.test.ts";

const REQUIRED_MATRIX_AUDIT_MARKERS = [
  "Approval consumption dispatch audit matrix",
  "git([\"status\", \"--short\"], cwd)",
  "git([\"branch\", \"--show-current\"], cwd)",
  "git([\"rev-list\", \"--left-right\", \"--count\", \"HEAD...origin/main\"], cwd)",
  "worktreeClean: input.gitStatusShort.trim() === \"\"",
  "branchMain: input.branch === \"main\"",
  "notBehindOrigin: behind === 0",
  "matrixNonAuthorizing",
  "approvalPermitCoveragePresent",
  "providerDispatchPreconditionsCovered",
  "workspaceWriteRejectBeforeSpawnCovered",
  "invalidRunnerStateBlockedCovered",
  "providerExecuteCallsDuringMatrix: 0",
  "realCodexCliCallsDuringMatrix: 0",
  "workspaceWriteExecuteCallsDuringMatrix: 0"
] as const;

const REQUIRED_MATRIX_DOC_MARKERS = [
  "APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX_RECORDED",
  "It does not authorize real provider execution",
  "real Codex CLI invocation",
  "workspace-write execution",
  "local command execution",
  "push, release, tag",
  "external service write",
  "This matrix is a local review artifact",
  "it does not run the real CLI"
] as const;

const REQUIRED_MATRIX_TEST_MARKERS = [
  "approval consumption dispatch matrix passes for local evidence",
  "approval consumption dispatch matrix blocks stale state",
  "approval consumption dispatch matrix blocks reopened coverage gaps",
  "approval consumption dispatch matrix output stays summarized"
] as const;

const FORBIDDEN_DOC_RUNTIME_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "dispatchGovernanceOperatorActionHostExecutor",
  "dispatchToHost(",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "invokeSubAgent",
  "spawnSubAgent",
  "hostExecutor(",
  "new Worker(",
  "fetch(",
  "writeFile(",
  "mkdir(",
  "rm(",
  "rename(",
  "copyFile(",
  "apply_patch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ApprovalConsumptionDispatchMatrixBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  matrixDocText: string;
  matrixAuditText: string;
  matrixTestText: string;
}

export interface ApprovalConsumptionDispatchMatrixBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    matrixAuditRegistered: boolean;
    matrixAuditGateRecorded: boolean;
    matrixDocNonAuthorizationRecorded: boolean;
    matrixCoverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    matrixBoundaryMode: "git_state_and_artifact_matrix_gate_only";
    matrixAuditIsProviderExecuteAuthorization: false;
    matrixAuditIsRealCodexCliAuthorization: false;
    matrixAuditIsWorkspaceWriteAuthorization: false;
    matrixAuditIsLocalCommandAuthorization: false;
    matrixAuditIsHostExecutorAuthorization: false;
    matrixAuditIsSubAgentRuntimeAuthorization: false;
    matrixAuditIsToolRuntimeAuthorization: false;
    matrixAuditIsExternalWriteAuthorization: false;
    matrixAuditIsReleaseAuthorization: false;
    matrixAuditGitStateIsExecutionAuthorization: false;
    matrixAuditWorktreeCleanIsProviderExecutionAuthorization: false;
    providerExecuteCallsDuringBoundaryAudit: 0;
    codexCliCallsDuringBoundaryAudit: 0;
    workspaceWriteCallsDuringBoundaryAudit: 0;
    hostExecutorCallsDuringBoundaryAudit: 0;
    subAgentRuntimeCallsDuringBoundaryAudit: 0;
    toolRuntimeCallsDuringBoundaryAudit: 0;
    shellProcessCallsDuringBoundaryAudit: 0;
    externalWriteCallsDuringBoundaryAudit: 0;
  };
  reasons: string[];
}

export type ApprovalConsumptionDispatchMatrixBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectApprovalConsumptionDispatchMatrixBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ApprovalConsumptionDispatchMatrixBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    matrixDocText,
    matrixAuditText,
    matrixTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, MATRIX_DOC),
    read(cwd, MATRIX_AUDIT),
    read(cwd, MATRIX_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    matrixDocText,
    matrixAuditText,
    matrixTestText
  };
}

export function reviewApprovalConsumptionDispatchMatrixBoundaryAudit(
  input: ApprovalConsumptionDispatchMatrixBoundaryAuditInput
): ApprovalConsumptionDispatchMatrixBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit approval-consumption-dispatch-matrix-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "approval-consumption-dispatch-matrix-boundary"
    ),
    matrixAuditRegistered: input.governanceRunnerText.includes(
      "approval-consumption-dispatch-matrix"
    ),
    matrixAuditGateRecorded: REQUIRED_MATRIX_AUDIT_MARKERS.every((marker) =>
      input.matrixAuditText.includes(marker)
    ),
    matrixDocNonAuthorizationRecorded: markersPresentNormalized(
      input.matrixDocText,
      REQUIRED_MATRIX_DOC_MARKERS
    ),
    matrixCoverageRecorded: REQUIRED_MATRIX_TEST_MARKERS.every((marker) =>
      input.matrixTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(input.matrixDocText),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      matrixBoundaryMode: "git_state_and_artifact_matrix_gate_only",
      matrixAuditIsProviderExecuteAuthorization: false,
      matrixAuditIsRealCodexCliAuthorization: false,
      matrixAuditIsWorkspaceWriteAuthorization: false,
      matrixAuditIsLocalCommandAuthorization: false,
      matrixAuditIsHostExecutorAuthorization: false,
      matrixAuditIsSubAgentRuntimeAuthorization: false,
      matrixAuditIsToolRuntimeAuthorization: false,
      matrixAuditIsExternalWriteAuthorization: false,
      matrixAuditIsReleaseAuthorization: false,
      matrixAuditGitStateIsExecutionAuthorization: false,
      matrixAuditWorktreeCleanIsProviderExecutionAuthorization: false,
      providerExecuteCallsDuringBoundaryAudit: 0,
      codexCliCallsDuringBoundaryAudit: 0,
      workspaceWriteCallsDuringBoundaryAudit: 0,
      hostExecutorCallsDuringBoundaryAudit: 0,
      subAgentRuntimeCallsDuringBoundaryAudit: 0,
      toolRuntimeCallsDuringBoundaryAudit: 0,
      shellProcessCallsDuringBoundaryAudit: 0,
      externalWriteCallsDuringBoundaryAudit: 0
    },
    reasons
  };
}

export function formatApprovalConsumptionDispatchMatrixBoundaryAuditResult(
  review: ApprovalConsumptionDispatchMatrixBoundaryAuditResult,
  format: ApprovalConsumptionDispatchMatrixBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Approval consumption dispatch matrix boundary audit",
    `status: ${review.status}`,
    `matrix boundary mode: ${review.summary.matrixBoundaryMode}`,
    `matrix audit is provider execute authorization: ${review.summary.matrixAuditIsProviderExecuteAuthorization}`,
    `matrix audit is real Codex CLI authorization: ${review.summary.matrixAuditIsRealCodexCliAuthorization}`,
    `matrix audit is workspace-write authorization: ${review.summary.matrixAuditIsWorkspaceWriteAuthorization}`,
    `matrix audit is local command authorization: ${review.summary.matrixAuditIsLocalCommandAuthorization}`,
    `matrix audit is host executor authorization: ${review.summary.matrixAuditIsHostExecutorAuthorization}`,
    `matrix audit is sub-agent runtime authorization: ${review.summary.matrixAuditIsSubAgentRuntimeAuthorization}`,
    `matrix audit is tool runtime authorization: ${review.summary.matrixAuditIsToolRuntimeAuthorization}`,
    `matrix audit is external-write authorization: ${review.summary.matrixAuditIsExternalWriteAuthorization}`,
    `matrix audit is release authorization: ${review.summary.matrixAuditIsReleaseAuthorization}`,
    `matrix audit git state is execution authorization: ${review.summary.matrixAuditGitStateIsExecutionAuthorization}`,
    `matrix audit worktree clean is provider execution authorization: ${review.summary.matrixAuditWorktreeCleanIsProviderExecutionAuthorization}`,
    `provider execute calls during boundary audit: ${review.summary.providerExecuteCallsDuringBoundaryAudit}`,
    `Codex CLI calls during boundary audit: ${review.summary.codexCliCallsDuringBoundaryAudit}`,
    `workspace-write calls during boundary audit: ${review.summary.workspaceWriteCallsDuringBoundaryAudit}`,
    `host executor calls during boundary audit: ${review.summary.hostExecutorCallsDuringBoundaryAudit}`,
    `sub-agent runtime calls during boundary audit: ${review.summary.subAgentRuntimeCallsDuringBoundaryAudit}`,
    `tool runtime calls during boundary audit: ${review.summary.toolRuntimeCallsDuringBoundaryAudit}`,
    `shell/process calls during boundary audit: ${review.summary.shellProcessCallsDuringBoundaryAudit}`,
    `external write calls during boundary audit: ${review.summary.externalWriteCallsDuringBoundaryAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Approval consumption dispatch matrix boundary")
    && text.includes("git-state and artifact matrix gate only")
    && text.includes("matrix audit is not provider execute authorization")
    && text.includes("matrix audit is not real Codex CLI authorization")
    && text.includes("matrix audit is not workspace-write authorization")
    && text.includes("matrix audit is not local command authorization")
    && text.includes("matrix audit is not host executor authorization")
    && text.includes("matrix audit is not sub-agent runtime authorization")
    && text.includes("matrix audit is not tool runtime authorization")
    && text.includes("matrix audit is not external-write authorization")
    && text.includes("matrix audit is not release authorization")
    && text.includes("matrix audit git state is not execution authorization")
    && text.includes("worktree clean is not provider execution authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_DOC_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function markersPresentNormalized(
  text: string,
  markers: readonly string[]
): boolean {
  const normalizedText = normalizeWhitespace(text);

  return markers.every((marker) =>
    normalizedText.includes(normalizeWhitespace(marker))
  );
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function outputSanitized(): boolean {
  const review: ApprovalConsumptionDispatchMatrixBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      matrixAuditRegistered: true,
      matrixAuditGateRecorded: true,
      matrixDocNonAuthorizationRecorded: true,
      matrixCoverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      matrixBoundaryMode: "git_state_and_artifact_matrix_gate_only",
      matrixAuditIsProviderExecuteAuthorization: false,
      matrixAuditIsRealCodexCliAuthorization: false,
      matrixAuditIsWorkspaceWriteAuthorization: false,
      matrixAuditIsLocalCommandAuthorization: false,
      matrixAuditIsHostExecutorAuthorization: false,
      matrixAuditIsSubAgentRuntimeAuthorization: false,
      matrixAuditIsToolRuntimeAuthorization: false,
      matrixAuditIsExternalWriteAuthorization: false,
      matrixAuditIsReleaseAuthorization: false,
      matrixAuditGitStateIsExecutionAuthorization: false,
      matrixAuditWorktreeCleanIsProviderExecutionAuthorization: false,
      providerExecuteCallsDuringBoundaryAudit: 0,
      codexCliCallsDuringBoundaryAudit: 0,
      workspaceWriteCallsDuringBoundaryAudit: 0,
      hostExecutorCallsDuringBoundaryAudit: 0,
      subAgentRuntimeCallsDuringBoundaryAudit: 0,
      toolRuntimeCallsDuringBoundaryAudit: 0,
      shellProcessCallsDuringBoundaryAudit: 0,
      externalWriteCallsDuringBoundaryAudit: 0
    },
    reasons: []
  };
  const text = formatApprovalConsumptionDispatchMatrixBoundaryAuditResult(review);
  const json = formatApprovalConsumptionDispatchMatrixBoundaryAuditResult(
    review,
    "json"
  );

  return FORBIDDEN_OUTPUT_MARKERS.every(
    (marker) => !text.includes(marker) && !json.includes(marker)
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `approval_consumption_dispatch_matrix_boundary_${name}`);
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

async function main(): Promise<void> {
  const input = await collectApprovalConsumptionDispatchMatrixBoundaryAuditInput();
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(
    formatApprovalConsumptionDispatchMatrixBoundaryAuditResult(review, format)
  );

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Approval consumption dispatch matrix boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
