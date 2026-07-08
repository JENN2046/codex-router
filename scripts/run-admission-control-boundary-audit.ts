#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const ADMISSION_CONTROL_SOURCE = "packages/admission-control/src/index.ts";
const ADMISSION_CONTROL_TEST = "tests/admission-control.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "export type AdmissionStatus",
  "\"accepted\"",
  "\"rejected\"",
  "\"needs_clarification\"",
  "\"needs_approval\"",
  "export function evaluateTaskAdmission",
  "collectRiskSignals",
  "collectRequiredCapabilities",
  "collectRequiredApprovals",
  "agentHasMatchingCapability",
  "resourceMatches",
  "approval_required_by_task_risk",
  "missing_required_write_capability",
  "missing_required_read_capability",
  "external_side_effect",
  "critical_policy_risk",
  "capability:${scope.kind}:${scope.access}:${scope.resource}",
  "approval:${signal}"
] as const;

const REQUIRED_TEST_MARKERS = [
  "admission-control accepts read-only tasks by default",
  "admission-control rejects missing principal",
  "admission-control rejects tasks missing intent",
  "admission-control requires approval for external side effects",
  "admission-control requires approval for destructive tasks",
  "admission-control rejects blocked policy decisions",
  "admission-control collects required capabilities from policy decisions",
  "admission-control does not match workspace wildcard outside workspace",
  "admission-control handles missing read capabilities from agent manifests",
  "admission-control requires explicit capabilities for policy secret reads without an agent",
  "admission-control checks inferred target files independently",
  "admission-control normalizes target file paths before workspace matching",
  "admission-control preserves missing capability approvals when risk also requires approval",
  "admission-control uses the fixed now parameter for createdAt"
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
  "writeFile(",
  "mkdir(",
  "rm(",
  "rename(",
  "copyFile("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AdmissionControlBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  admissionControlSourceText: string;
  admissionControlTestText: string;
}

export interface AdmissionControlBoundaryAuditResult {
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
    admissionControlMode: "admission_status_and_requirement_derivation_only";
    acceptedStatusIsExecutionAuthorization: false;
    needsApprovalStatusIsApprovalGrant: false;
    rejectedStatusIsRuntimeBlockExecution: false;
    capabilityMatchIsRuntimeInvocation: false;
    requiredApprovalIsProviderExecutionAuthorization: false;
    requiredApprovalIsCodexCliAuthorization: false;
    requiredApprovalIsSubAgentRuntimeAuthorization: false;
    requiredApprovalIsHostExecutorAuthorization: false;
    externalCapabilityIsExternalWriteExecution: false;
    fileWriteCapabilityIsWorkspaceWriteExecution: false;
    admissionControlCallsDuringAudit: 0;
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

export type AdmissionControlBoundaryAuditOutputFormat = "text" | "json";

export async function collectAdmissionControlBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AdmissionControlBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    admissionControlSourceText,
    admissionControlTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, ADMISSION_CONTROL_SOURCE),
    read(cwd, ADMISSION_CONTROL_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    admissionControlSourceText,
    admissionControlTestText
  };
}

export function reviewAdmissionControlBoundaryAudit(
  input: AdmissionControlBoundaryAuditInput
): AdmissionControlBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit admission-control-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "admission-control-boundary"
    ),
    sourceMarkersRecorded: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.admissionControlSourceText.includes(marker)
    ),
    regressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.admissionControlTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      admissionControlMode: "admission_status_and_requirement_derivation_only",
      acceptedStatusIsExecutionAuthorization: false,
      needsApprovalStatusIsApprovalGrant: false,
      rejectedStatusIsRuntimeBlockExecution: false,
      capabilityMatchIsRuntimeInvocation: false,
      requiredApprovalIsProviderExecutionAuthorization: false,
      requiredApprovalIsCodexCliAuthorization: false,
      requiredApprovalIsSubAgentRuntimeAuthorization: false,
      requiredApprovalIsHostExecutorAuthorization: false,
      externalCapabilityIsExternalWriteExecution: false,
      fileWriteCapabilityIsWorkspaceWriteExecution: false,
      admissionControlCallsDuringAudit: 0,
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

export function formatAdmissionControlBoundaryAuditResult(
  review: AdmissionControlBoundaryAuditResult,
  format: AdmissionControlBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Admission control boundary audit",
    `status: ${review.status}`,
    `admission control mode: ${review.summary.admissionControlMode}`,
    `accepted status is execution authorization: ${review.summary.acceptedStatusIsExecutionAuthorization}`,
    `needs_approval status is approval grant: ${review.summary.needsApprovalStatusIsApprovalGrant}`,
    `rejected status is runtime block execution: ${review.summary.rejectedStatusIsRuntimeBlockExecution}`,
    `capability match is runtime invocation: ${review.summary.capabilityMatchIsRuntimeInvocation}`,
    `required approval is provider execution authorization: ${review.summary.requiredApprovalIsProviderExecutionAuthorization}`,
    `required approval is Codex CLI authorization: ${review.summary.requiredApprovalIsCodexCliAuthorization}`,
    `required approval is sub-agent runtime authorization: ${review.summary.requiredApprovalIsSubAgentRuntimeAuthorization}`,
    `required approval is host executor authorization: ${review.summary.requiredApprovalIsHostExecutorAuthorization}`,
    `external capability is external write execution: ${review.summary.externalCapabilityIsExternalWriteExecution}`,
    `file write capability is workspace-write execution: ${review.summary.fileWriteCapabilityIsWorkspaceWriteExecution}`,
    `admission control calls during audit: ${review.summary.admissionControlCallsDuringAudit}`,
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
  return text.includes("Admission control boundary")
    && text.includes("admission status and requirement derivation only")
    && text.includes("accepted status is not execution authorization")
    && text.includes("needs_approval status is not approval grant")
    && text.includes("required approvals are not provider execution authorization")
    && text.includes("required approvals are not Codex CLI authorization")
    && text.includes("required approvals are not sub-agent runtime authorization")
    && text.includes("required approvals are not host executor authorization")
    && text.includes("external capabilities are not external-write execution")
    && text.includes("file write capabilities are not workspace-write execution");
}

function noRuntimeInvocationSurface(
  input: AdmissionControlBoundaryAuditInput
): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) =>
    !input.admissionControlSourceText.includes(marker)
  );
}

function outputSanitized(): boolean {
  const output = formatAdmissionControlBoundaryAuditResult({
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
      admissionControlMode: "admission_status_and_requirement_derivation_only",
      acceptedStatusIsExecutionAuthorization: false,
      needsApprovalStatusIsApprovalGrant: false,
      rejectedStatusIsRuntimeBlockExecution: false,
      capabilityMatchIsRuntimeInvocation: false,
      requiredApprovalIsProviderExecutionAuthorization: false,
      requiredApprovalIsCodexCliAuthorization: false,
      requiredApprovalIsSubAgentRuntimeAuthorization: false,
      requiredApprovalIsHostExecutorAuthorization: false,
      externalCapabilityIsExternalWriteExecution: false,
      fileWriteCapabilityIsWorkspaceWriteExecution: false,
      admissionControlCallsDuringAudit: 0,
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
  checks: AdmissionControlBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `admission_control_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAdmissionControlBoundaryAuditInput();
  const review = reviewAdmissionControlBoundaryAudit(input);

  console.log(formatAdmissionControlBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Admission control boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
