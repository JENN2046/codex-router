#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const DELEGATION_POLICY_SOURCE = "packages/delegation-policy/src/index.ts";
const DELEGATION_POLICY_TEST = "tests/delegation-policy.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "DelegationLevelSchema",
  "\"full_control\"",
  "\"supervised\"",
  "\"trusted\"",
  "\"autonomous\"",
  "\"full_delegation\"",
  "createDelegationHistory",
  "recordResume",
  "recordApproval",
  "recordRejection",
  "calculateDelegationLevel",
  "generateAdjustmentProposal",
  "export function requiresApproval",
  "getRequiredApprovers",
  "deriveDelegationFromApprovals",
  "delegationLevelToHistoricalTrust",
  "approveProposal",
  "rejectProposal",
  "applyApprovedProposal",
  "filterRecoveryActions",
  "RecordingDelegationHistoryStore",
  "FileDelegationHistoryStore",
  "writeFile(filePath, JSON.stringify(history, null, 2), \"utf-8\")"
] as const;

const REQUIRED_TEST_MARKERS = [
  "delegation-policy: calculateDelegationLevel returns full_delegation for 5 resumes",
  "delegation-policy: calculateDelegationLevel resets to full_control on rejection",
  "delegation-policy: requiresApproval returns false for full_delegation low risk",
  "delegation-policy: getRequiredApprovers returns empty for full_delegation",
  "delegation-policy: deriveDelegationFromApprovals counts resume/approve/reject",
  "delegation-policy: delegationLevelToHistoricalTrust returns ascending trust",
  "delegation-policy: approveProposal sets status to approved",
  "delegation-policy: applyApprovedProposal returns new level when approved",
  "delegation-policy: applyApprovedProposal returns current level when pending",
  "delegation-policy: filterRecoveryActions allows all at full_delegation",
  "delegation-policy: RecordingDelegationHistoryStore saves and loads",
  "delegation-policy: FileDelegationHistoryStore persists to disk"
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
  "exec("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface DelegationPolicyBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  delegationPolicySourceText: string;
  delegationPolicyTestText: string;
}

export interface DelegationPolicyBoundaryAuditResult {
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
    delegationPolicyMode: "delegation_level_approval_requirement_and_recovery_filter_only";
    fullDelegationIsExecutionAuthorization: false;
    requiresApprovalFalseIsExecutionAuthorization: false;
    approvedProposalIsRuntimeAuthorization: false;
    appliedProposalIsProviderExecutionAuthorization: false;
    filteredRecoveryActionIsHostExecutorAuthorization: false;
    recoveryActionListIsRecoveryExecution: false;
    historicalTrustIsRuntimeAuthorization: false;
    recordedResumeIsRuntimeInvocation: false;
    fileStorePersistenceIsWorkspaceWriteExecution: false;
    delegationPolicyCallsDuringAudit: 0;
    proposalLifecycleCallsDuringAudit: 0;
    fileStoreWritesDuringAudit: 0;
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

export type DelegationPolicyBoundaryAuditOutputFormat = "text" | "json";

export async function collectDelegationPolicyBoundaryAuditInput(
  cwd = process.cwd()
): Promise<DelegationPolicyBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    delegationPolicySourceText,
    delegationPolicyTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, DELEGATION_POLICY_SOURCE),
    read(cwd, DELEGATION_POLICY_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    delegationPolicySourceText,
    delegationPolicyTestText
  };
}

export function reviewDelegationPolicyBoundaryAudit(
  input: DelegationPolicyBoundaryAuditInput
): DelegationPolicyBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit delegation-policy-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "delegation-policy-boundary"
    ),
    sourceMarkersRecorded: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.delegationPolicySourceText.includes(marker)
    ),
    regressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.delegationPolicyTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      delegationPolicyMode: "delegation_level_approval_requirement_and_recovery_filter_only",
      fullDelegationIsExecutionAuthorization: false,
      requiresApprovalFalseIsExecutionAuthorization: false,
      approvedProposalIsRuntimeAuthorization: false,
      appliedProposalIsProviderExecutionAuthorization: false,
      filteredRecoveryActionIsHostExecutorAuthorization: false,
      recoveryActionListIsRecoveryExecution: false,
      historicalTrustIsRuntimeAuthorization: false,
      recordedResumeIsRuntimeInvocation: false,
      fileStorePersistenceIsWorkspaceWriteExecution: false,
      delegationPolicyCallsDuringAudit: 0,
      proposalLifecycleCallsDuringAudit: 0,
      fileStoreWritesDuringAudit: 0,
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

export function formatDelegationPolicyBoundaryAuditResult(
  review: DelegationPolicyBoundaryAuditResult,
  format: DelegationPolicyBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Delegation policy boundary audit",
    `status: ${review.status}`,
    `delegation policy mode: ${review.summary.delegationPolicyMode}`,
    `full_delegation is execution authorization: ${review.summary.fullDelegationIsExecutionAuthorization}`,
    `requiresApproval false is execution authorization: ${review.summary.requiresApprovalFalseIsExecutionAuthorization}`,
    `approved proposal is runtime authorization: ${review.summary.approvedProposalIsRuntimeAuthorization}`,
    `applied proposal is provider execution authorization: ${review.summary.appliedProposalIsProviderExecutionAuthorization}`,
    `filtered recovery action is host executor authorization: ${review.summary.filteredRecoveryActionIsHostExecutorAuthorization}`,
    `recovery action list is recovery execution: ${review.summary.recoveryActionListIsRecoveryExecution}`,
    `historical trust is runtime authorization: ${review.summary.historicalTrustIsRuntimeAuthorization}`,
    `recorded resume is runtime invocation: ${review.summary.recordedResumeIsRuntimeInvocation}`,
    `file-store persistence is workspace-write execution: ${review.summary.fileStorePersistenceIsWorkspaceWriteExecution}`,
    `delegation policy calls during audit: ${review.summary.delegationPolicyCallsDuringAudit}`,
    `proposal lifecycle calls during audit: ${review.summary.proposalLifecycleCallsDuringAudit}`,
    `file-store writes during audit: ${review.summary.fileStoreWritesDuringAudit}`,
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
  return text.includes("Delegation policy boundary")
    && text.includes("delegation level, approval requirement, and recovery action filtering only")
    && text.includes("full_delegation is not execution authorization")
    && text.includes("requiresApproval false is not execution authorization")
    && text.includes("approved proposals are not runtime authorization")
    && text.includes("applied proposals are not provider execution authorization")
    && text.includes("filtered recovery actions are not host executor authorization")
    && text.includes("recovery action lists are not recovery execution")
    && text.includes("historical trust is not runtime authorization")
    && text.includes("recorded resumes are not runtime invocation")
    && text.includes("delegation file-store persistence is not workspace-write execution");
}

function noRuntimeInvocationSurface(
  input: DelegationPolicyBoundaryAuditInput
): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) =>
    !input.delegationPolicySourceText.includes(marker)
  );
}

function outputSanitized(): boolean {
  const output = formatDelegationPolicyBoundaryAuditResult({
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
      delegationPolicyMode: "delegation_level_approval_requirement_and_recovery_filter_only",
      fullDelegationIsExecutionAuthorization: false,
      requiresApprovalFalseIsExecutionAuthorization: false,
      approvedProposalIsRuntimeAuthorization: false,
      appliedProposalIsProviderExecutionAuthorization: false,
      filteredRecoveryActionIsHostExecutorAuthorization: false,
      recoveryActionListIsRecoveryExecution: false,
      historicalTrustIsRuntimeAuthorization: false,
      recordedResumeIsRuntimeInvocation: false,
      fileStorePersistenceIsWorkspaceWriteExecution: false,
      delegationPolicyCallsDuringAudit: 0,
      proposalLifecycleCallsDuringAudit: 0,
      fileStoreWritesDuringAudit: 0,
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
  checks: DelegationPolicyBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `delegation_policy_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectDelegationPolicyBoundaryAuditInput();
  const review = reviewDelegationPolicyBoundaryAudit(input);

  console.log(formatDelegationPolicyBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Delegation policy boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
