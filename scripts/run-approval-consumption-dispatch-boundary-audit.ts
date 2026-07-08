#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const MATRIX_DOC =
  "docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md";
const MATRIX_TEST = "tests/approval-consumption-dispatch-matrix-audit.test.ts";

const REQUIRED_MATRIX_MARKERS = [
  "APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX_RECORDED",
  "approval consumption, provider dispatch preconditions, and sanitized audit\nsurfaces",
  "does not authorize real provider execution",
  "real Codex CLI invocation",
  "workspace-write execution",
  "local command execution",
  "push, release, tag",
  "external service write",
  "Approval consumption hardening closeout",
  "Provider dispatch precondition tests",
  "Sanitized audit surface tests",
  "provider dispatch rejects workspace-write before spawn",
  "invalid runner results are blocked before provider dispatch",
  "audit/event/artifact/tool/result/workspace-write surfaces are redacted",
  "read-only evidence remains separated from workspace-write and real execution",
  "provider execute calls during matrix",
  "real Codex CLI calls during matrix",
  "workspace-write execute calls during matrix",
  "does not run the real CLI"
] as const;

const REQUIRED_TEST_MARKERS = [
  "approval consumption dispatch matrix passes for local evidence",
  "approval consumption dispatch matrix blocks stale state",
  "approval consumption dispatch matrix blocks reopened coverage gaps",
  "approval consumption dispatch matrix output stays summarized"
] as const;

const FORBIDDEN_RUNTIME_MARKERS = [
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
  "spawn(",
  "execFile(",
  "exec(",
  "child_process",
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

export interface ApprovalConsumptionDispatchBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  matrixDocText: string;
  matrixTestText: string;
}

export interface ApprovalConsumptionDispatchBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    matrixMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    approvalConsumptionDispatchMode: "approval_consumption_dispatch_matrix_only";
    matrixIsProviderExecuteAuthorization: false;
    matrixIsRealCodexCliAuthorization: false;
    matrixIsWorkspaceWriteAuthorization: false;
    matrixIsLocalCommandAuthorization: false;
    matrixIsHostExecutorAuthorization: false;
    matrixIsSubAgentRuntimeAuthorization: false;
    matrixIsExternalWriteAuthorization: false;
    matrixIsReleaseAuthorization: false;
    approvalPermitConsumptionIsProviderExecutionAuthorization: false;
    hostDispatcherPreconditionIsProviderExecuteAuthorization: false;
    redactionCoverageIsRuntimeAuthorization: false;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ApprovalConsumptionDispatchBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectApprovalConsumptionDispatchBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ApprovalConsumptionDispatchBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    matrixDocText,
    matrixTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, MATRIX_DOC),
    read(cwd, MATRIX_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    matrixDocText,
    matrixTestText
  };
}

export function reviewApprovalConsumptionDispatchBoundaryAudit(
  input: ApprovalConsumptionDispatchBoundaryAuditInput
): ApprovalConsumptionDispatchBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit approval-consumption-dispatch-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "approval-consumption-dispatch-boundary"
    ),
    matrixMarkersPresent: REQUIRED_MATRIX_MARKERS.every((marker) =>
      input.matrixDocText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
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
      approvalConsumptionDispatchMode:
        "approval_consumption_dispatch_matrix_only",
      matrixIsProviderExecuteAuthorization: false,
      matrixIsRealCodexCliAuthorization: false,
      matrixIsWorkspaceWriteAuthorization: false,
      matrixIsLocalCommandAuthorization: false,
      matrixIsHostExecutorAuthorization: false,
      matrixIsSubAgentRuntimeAuthorization: false,
      matrixIsExternalWriteAuthorization: false,
      matrixIsReleaseAuthorization: false,
      approvalPermitConsumptionIsProviderExecutionAuthorization: false,
      hostDispatcherPreconditionIsProviderExecuteAuthorization: false,
      redactionCoverageIsRuntimeAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatApprovalConsumptionDispatchBoundaryAuditResult(
  review: ApprovalConsumptionDispatchBoundaryAuditResult,
  format: ApprovalConsumptionDispatchBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Approval consumption dispatch boundary audit",
    `status: ${review.status}`,
    `approval consumption dispatch mode: ${review.summary.approvalConsumptionDispatchMode}`,
    `matrix is provider execute authorization: ${review.summary.matrixIsProviderExecuteAuthorization}`,
    `matrix is real Codex CLI authorization: ${review.summary.matrixIsRealCodexCliAuthorization}`,
    `matrix is workspace-write authorization: ${review.summary.matrixIsWorkspaceWriteAuthorization}`,
    `matrix is local command authorization: ${review.summary.matrixIsLocalCommandAuthorization}`,
    `matrix is host executor authorization: ${review.summary.matrixIsHostExecutorAuthorization}`,
    `matrix is sub-agent runtime authorization: ${review.summary.matrixIsSubAgentRuntimeAuthorization}`,
    `matrix is external-write authorization: ${review.summary.matrixIsExternalWriteAuthorization}`,
    `matrix is release authorization: ${review.summary.matrixIsReleaseAuthorization}`,
    `approval permit consumption is provider execution authorization: ${review.summary.approvalPermitConsumptionIsProviderExecutionAuthorization}`,
    `host dispatcher precondition is provider execute authorization: ${review.summary.hostDispatcherPreconditionIsProviderExecuteAuthorization}`,
    `redaction coverage is runtime authorization: ${review.summary.redactionCoverageIsRuntimeAuthorization}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Approval consumption dispatch boundary")
    && text.includes("approval consumption dispatch matrix only")
    && text.includes("matrix is not provider execute authorization")
    && text.includes("matrix is not real Codex CLI authorization")
    && text.includes("matrix is not workspace-write authorization")
    && text.includes("matrix is not local command authorization")
    && text.includes("matrix is not host executor authorization")
    && text.includes("matrix is not sub-agent runtime authorization")
    && text.includes("matrix is not external-write authorization")
    && text.includes("matrix is not release authorization")
    && text.includes("approval permit consumption is not provider execution authorization")
    && text.includes("host dispatcher precondition is not provider execute authorization")
    && text.includes("redaction coverage is not runtime authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(): boolean {
  const output = formatApprovalConsumptionDispatchBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      matrixMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      approvalConsumptionDispatchMode:
        "approval_consumption_dispatch_matrix_only",
      matrixIsProviderExecuteAuthorization: false,
      matrixIsRealCodexCliAuthorization: false,
      matrixIsWorkspaceWriteAuthorization: false,
      matrixIsLocalCommandAuthorization: false,
      matrixIsHostExecutorAuthorization: false,
      matrixIsSubAgentRuntimeAuthorization: false,
      matrixIsExternalWriteAuthorization: false,
      matrixIsReleaseAuthorization: false,
      approvalPermitConsumptionIsProviderExecutionAuthorization: false,
      hostDispatcherPreconditionIsProviderExecuteAuthorization: false,
      redactionCoverageIsRuntimeAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `approval_consumption_dispatch_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectApprovalConsumptionDispatchBoundaryAuditInput();
  const review = reviewApprovalConsumptionDispatchBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatApprovalConsumptionDispatchBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Approval consumption dispatch boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
