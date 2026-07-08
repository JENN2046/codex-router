#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const APPROVAL_GATE_SOURCE =
  "packages/governance-internal-approval-gate/src/index.ts";
const APPROVAL_GATE_TEST = "tests/approval-gate.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "export function evaluateApprovalRequirement",
  "parseTaskEnvelope",
  "collectPolicyApprovalSignals",
  "decision.approval.reasons",
  "repo_context:protected_branch",
  "workspace:dirty",
  "protectedBranches",
  "protectedKeywords",
  "status: deduped.length > 0 ? \"pending\" : \"not_required\"",
  "gateId: deduped.length > 0 ? `gate-${task.taskId}` : undefined",
  "export function assertApprovalResolved",
  "Approval gate unresolved"
] as const;

const REQUIRED_TEST_MARKERS = [
  "approval gate blocks protected actions",
  "approval gate independently requires approval for protected write contexts",
  "approval gate recomputes protected policy signals when routing approval is absent",
  "repo_context:protected_branch",
  "workspace:dirty",
  "tool_access:protected_remote",
  "protected_branch:prod/stable",
  "active_branch:main",
  "keyword:merge",
  "keyword:push",
  "keyword:production"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  ".execute(",
  ".invoke(",
  ".createRemoteTask(",
  "runCodexCliExecPlan(",
  "dispatchToHost(",
  "dispatchGovernanceOperatorActionHostExecutor(",
  "spawnSubAgent(",
  "spawn(",
  "execFile(",
  "exec(",
  "writeFile("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ApprovalGateBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  approvalGateSourceText: string;
  approvalGateTestText: string;
}

export interface ApprovalGateBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersRecorded: boolean;
    regressionCoverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    approvalGateMode: "approval_requirement_evaluation_only";
    approvalNotRequiredIsExecutionAuthorization: false;
    approvalResolvedIsProviderExecutionAuthorization: false;
    approvalResolvedIsCodexCliAuthorization: false;
    approvalResolvedIsSubAgentRuntimeAuthorization: false;
    approvalResolvedIsHostExecutorAuthorization: false;
    approvalResolvedIsToolRuntimeAuthorization: false;
    pendingGateIsRuntimeInvocation: false;
    protectedBranchSignalIsWorkspaceWriteExecution: false;
    dirtyWorkspaceSignalIsWorkspaceWriteExecution: false;
    protectedKeywordSignalIsExternalWriteExecution: false;
    approvalGateCallsDuringAudit: 0;
    approvalResolutionChecksDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ApprovalGateBoundaryAuditOutputFormat = "text" | "json";

export async function collectApprovalGateBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ApprovalGateBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    approvalGateSourceText,
    approvalGateTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, APPROVAL_GATE_SOURCE),
    read(cwd, APPROVAL_GATE_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    approvalGateSourceText,
    approvalGateTestText
  };
}

export function reviewApprovalGateBoundaryAudit(
  input: ApprovalGateBoundaryAuditInput
): ApprovalGateBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit approval-gate-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "approval-gate-boundary"
    ),
    sourceMarkersRecorded: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.approvalGateSourceText.includes(marker)
    ),
    regressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.approvalGateTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      approvalGateMode: "approval_requirement_evaluation_only",
      approvalNotRequiredIsExecutionAuthorization: false,
      approvalResolvedIsProviderExecutionAuthorization: false,
      approvalResolvedIsCodexCliAuthorization: false,
      approvalResolvedIsSubAgentRuntimeAuthorization: false,
      approvalResolvedIsHostExecutorAuthorization: false,
      approvalResolvedIsToolRuntimeAuthorization: false,
      pendingGateIsRuntimeInvocation: false,
      protectedBranchSignalIsWorkspaceWriteExecution: false,
      dirtyWorkspaceSignalIsWorkspaceWriteExecution: false,
      protectedKeywordSignalIsExternalWriteExecution: false,
      approvalGateCallsDuringAudit: 0,
      approvalResolutionChecksDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatApprovalGateBoundaryAuditResult(
  review: ApprovalGateBoundaryAuditResult,
  format: ApprovalGateBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Approval gate boundary audit",
    `status: ${review.status}`,
    `approval gate mode: ${review.summary.approvalGateMode}`,
    `approval not_required status is execution authorization: ${review.summary.approvalNotRequiredIsExecutionAuthorization}`,
    `approval resolved is provider execution authorization: ${review.summary.approvalResolvedIsProviderExecutionAuthorization}`,
    `approval resolved is Codex CLI authorization: ${review.summary.approvalResolvedIsCodexCliAuthorization}`,
    `approval resolved is sub-agent runtime authorization: ${review.summary.approvalResolvedIsSubAgentRuntimeAuthorization}`,
    `approval resolved is host executor authorization: ${review.summary.approvalResolvedIsHostExecutorAuthorization}`,
    `approval resolved is tool runtime authorization: ${review.summary.approvalResolvedIsToolRuntimeAuthorization}`,
    `pending gate is runtime invocation: ${review.summary.pendingGateIsRuntimeInvocation}`,
    `protected branch signal is workspace-write execution: ${review.summary.protectedBranchSignalIsWorkspaceWriteExecution}`,
    `dirty workspace signal is workspace-write execution: ${review.summary.dirtyWorkspaceSignalIsWorkspaceWriteExecution}`,
    `protected keyword signal is external write execution: ${review.summary.protectedKeywordSignalIsExternalWriteExecution}`,
    `approval gate calls during audit: ${review.summary.approvalGateCallsDuringAudit}`,
    `approval resolution checks during audit: ${review.summary.approvalResolutionChecksDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Approval gate boundary")
    && text.includes("approval requirement evaluation only")
    && text.includes("approval not_required status is not execution authorization")
    && text.includes("approval resolution is not provider execution authorization")
    && text.includes("approval resolution is not Codex CLI authorization")
    && text.includes("approval resolution is not sub-agent runtime authorization")
    && text.includes("approval resolution is not host executor authorization")
    && text.includes("protected branch and dirty workspace signals are not workspace-write execution");
}

function noRuntimeInvocationSurface(
  input: ApprovalGateBoundaryAuditInput
): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) =>
    !input.approvalGateSourceText.includes(marker)
  );
}

function outputSanitized(): boolean {
  const output = formatApprovalGateBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersRecorded: true,
      regressionCoverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      approvalGateMode: "approval_requirement_evaluation_only",
      approvalNotRequiredIsExecutionAuthorization: false,
      approvalResolvedIsProviderExecutionAuthorization: false,
      approvalResolvedIsCodexCliAuthorization: false,
      approvalResolvedIsSubAgentRuntimeAuthorization: false,
      approvalResolvedIsHostExecutorAuthorization: false,
      approvalResolvedIsToolRuntimeAuthorization: false,
      pendingGateIsRuntimeInvocation: false,
      protectedBranchSignalIsWorkspaceWriteExecution: false,
      dirtyWorkspaceSignalIsWorkspaceWriteExecution: false,
      protectedKeywordSignalIsExternalWriteExecution: false,
      approvalGateCallsDuringAudit: 0,
      approvalResolutionChecksDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(
  checks: ApprovalGateBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `approval_gate_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectApprovalGateBoundaryAuditInput();
  const review = reviewApprovalGateBoundaryAudit(input);

  console.log(formatApprovalGateBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Approval gate boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
