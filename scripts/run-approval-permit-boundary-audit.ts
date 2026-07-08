#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const APPROVAL_PERMIT_SOURCE =
  "packages/governance-internal-approval-permit/src/index.ts";
const APPROVAL_PERMIT_TEST = "tests/approval-permit.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "export function createApprovalPermit",
  "export function validateApprovalPermit",
  "export function revokeApprovalPermit",
  "export function hashApprovalScope",
  "export class InMemoryApprovalPermitStore",
  "ApprovalPermitSchema.parse",
  "task_id_mismatch",
  "run_id_mismatch",
  "principal_id_mismatch",
  "policy_decision_hash_mismatch",
  "plan_hash_mismatch",
  "permit_expired",
  "permit_revoked",
  "missing_capability_scope",
  "capabilityImplies",
  "capabilityScopeToKernelScope",
  "family === \"shell\" || family === \"mcp\"",
  "family === \"external\"",
  "cloneApprovalPermit"
] as const;

const REQUIRED_TEST_MARKERS = [
  "approval permit validates a permit bound to task, run, principal, plan, policy, and scopes",
  "approval permit rejects expired permits",
  "approval permit rejects revoked permits",
  "in-memory approval permit store saves, filters, clones, and revokes permits",
  "approval permit rejects planHash mismatches",
  "approval permit rejects policyDecisionHash mismatches",
  "approval permit rejects missing requested capability scopes",
  "approval permit accepts external capability scopes",
  "approval permit maps typed scopes to canonical capability strings",
  "approval permit scope hash is stable across object key order"
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

export interface ApprovalPermitBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  approvalPermitSourceText: string;
  approvalPermitTestText: string;
}

export interface ApprovalPermitBoundaryAuditResult {
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
    approvalPermitMode: "permit_creation_validation_revocation_and_store_only";
    validPermitIsProviderExecutionAuthorization: false;
    validPermitIsCodexCliAuthorization: false;
    validPermitIsSubAgentRuntimeAuthorization: false;
    validPermitIsHostExecutorAuthorization: false;
    validPermitIsToolRuntimeAuthorization: false;
    shellCapabilityScopeIsShellExecution: false;
    externalCapabilityScopeIsExternalWriteExecution: false;
    storePersistenceIsWorkspaceWriteExecution: false;
    approvalPermitCallsDuringAudit: 0;
    permitValidationCallsDuringAudit: 0;
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

export type ApprovalPermitBoundaryAuditOutputFormat = "text" | "json";

export async function collectApprovalPermitBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ApprovalPermitBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    approvalPermitSourceText,
    approvalPermitTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, APPROVAL_PERMIT_SOURCE),
    read(cwd, APPROVAL_PERMIT_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    approvalPermitSourceText,
    approvalPermitTestText
  };
}

export function reviewApprovalPermitBoundaryAudit(
  input: ApprovalPermitBoundaryAuditInput
): ApprovalPermitBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit approval-permit-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "approval-permit-boundary"
    ),
    sourceMarkersRecorded: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.approvalPermitSourceText.includes(marker)
    ),
    regressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.approvalPermitTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      approvalPermitMode: "permit_creation_validation_revocation_and_store_only",
      validPermitIsProviderExecutionAuthorization: false,
      validPermitIsCodexCliAuthorization: false,
      validPermitIsSubAgentRuntimeAuthorization: false,
      validPermitIsHostExecutorAuthorization: false,
      validPermitIsToolRuntimeAuthorization: false,
      shellCapabilityScopeIsShellExecution: false,
      externalCapabilityScopeIsExternalWriteExecution: false,
      storePersistenceIsWorkspaceWriteExecution: false,
      approvalPermitCallsDuringAudit: 0,
      permitValidationCallsDuringAudit: 0,
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

export function formatApprovalPermitBoundaryAuditResult(
  review: ApprovalPermitBoundaryAuditResult,
  format: ApprovalPermitBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Approval permit boundary audit",
    `status: ${review.status}`,
    `approval permit mode: ${review.summary.approvalPermitMode}`,
    `valid permit is provider execution authorization: ${review.summary.validPermitIsProviderExecutionAuthorization}`,
    `valid permit is Codex CLI authorization: ${review.summary.validPermitIsCodexCliAuthorization}`,
    `valid permit is sub-agent runtime authorization: ${review.summary.validPermitIsSubAgentRuntimeAuthorization}`,
    `valid permit is host executor authorization: ${review.summary.validPermitIsHostExecutorAuthorization}`,
    `valid permit is tool runtime authorization: ${review.summary.validPermitIsToolRuntimeAuthorization}`,
    `shell capability scope is shell execution: ${review.summary.shellCapabilityScopeIsShellExecution}`,
    `external capability scope is external write execution: ${review.summary.externalCapabilityScopeIsExternalWriteExecution}`,
    `store persistence is workspace-write execution: ${review.summary.storePersistenceIsWorkspaceWriteExecution}`,
    `approval permit calls during audit: ${review.summary.approvalPermitCallsDuringAudit}`,
    `permit validation calls during audit: ${review.summary.permitValidationCallsDuringAudit}`,
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
  return text.includes("Approval permit boundary")
    && text.includes("permit creation, validation, revocation, and store only")
    && text.includes("valid permits are not provider execution authorization")
    && text.includes("valid permits are not Codex CLI authorization")
    && text.includes("valid permits are not sub-agent runtime authorization")
    && text.includes("valid permits are not host executor authorization")
    && text.includes("shell capability scopes are not shell execution")
    && text.includes("external capability scopes are not external-write execution")
    && text.includes("approval permit store persistence is not workspace-write execution");
}

function noRuntimeInvocationSurface(
  input: ApprovalPermitBoundaryAuditInput
): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) =>
    !input.approvalPermitSourceText.includes(marker)
  );
}

function outputSanitized(): boolean {
  const output = formatApprovalPermitBoundaryAuditResult({
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
      approvalPermitMode: "permit_creation_validation_revocation_and_store_only",
      validPermitIsProviderExecutionAuthorization: false,
      validPermitIsCodexCliAuthorization: false,
      validPermitIsSubAgentRuntimeAuthorization: false,
      validPermitIsHostExecutorAuthorization: false,
      validPermitIsToolRuntimeAuthorization: false,
      shellCapabilityScopeIsShellExecution: false,
      externalCapabilityScopeIsExternalWriteExecution: false,
      storePersistenceIsWorkspaceWriteExecution: false,
      approvalPermitCallsDuringAudit: 0,
      permitValidationCallsDuringAudit: 0,
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
  checks: ApprovalPermitBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `approval_permit_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectApprovalPermitBoundaryAuditInput();
  const review = reviewApprovalPermitBoundaryAudit(input);

  console.log(formatApprovalPermitBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Approval permit boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
