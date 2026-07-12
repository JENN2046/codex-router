#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const EXECUTION_ELIGIBILITY = "packages/execution-eligibility/src/index.ts";
const EXECUTION_ELIGIBILITY_TEST = "tests/execution-eligibility.test.ts";

const REQUIRED_ELIGIBILITY_MARKERS = [
  "ExecutionEligibilityStatus",
  "\"eligible\"",
  "\"blocked\"",
  "\"waiting_approval\"",
  "evaluateExecutionEligibility",
  "evaluateExecutionEligibilityWithPermitStore",
  "evaluateTaskAdmission",
  "explainCapabilityDecision",
  "validateApprovalPermit",
  "hashApprovalScope",
  "terminalRunStatuses",
  "admission_rejected",
  "admission_needs_clarification",
  "policy_blocked",
  "capability_deny",
  "missing_capability",
  "capability_grant_required",
  "approval_permit_cannot_expand_capability",
  "approval_required",
  "valid_approval_permit",
  "capability_grants_satisfied"
] as const;

const REQUIRED_PERMIT_STORE_MARKERS = [
  "approvalPermitStore.listPermits",
  "taskId: input.task.taskId",
  "runId: input.run.runId",
  "principalId: input.principal.principalId",
  "policyDecisionHash",
  "planHash: input.planHash",
  "requestedCapabilityScopes"
] as const;

const REQUIRED_TEST_MARKERS = [
  "execution eligibility accepts read-only work when capability is granted",
  "execution eligibility blocks terminal runs before capability checks",
  "execution eligibility blocks when policy is blocked",
  "execution eligibility blocks when policy requires clarification",
  "execution eligibility waits for approval when capability is missing",
  "execution eligibility accepts external capabilities when granted",
  "execution eligibility blocks explicit deny capability decisions",
  "execution eligibility does not let approval permits expand missing capabilities",
  "execution eligibility does not let stored permits expand missing capabilities",
  "execution eligibility rejects revoked permits loaded from store",
  "execution eligibility only loads permits for the matching task run and principal",
  "execution eligibility checks policy-required scopes when caller underreports requested scopes",
  "execution eligibility waits for approval when permit is expired",
  "execution eligibility waits for approval when permit plan hash mismatches",
  "execution eligibility waits for approval for destructive tasks without permit"
] as const;

const FORBIDDEN_RUNTIME_MARKERS = [
  "dispatchGovernanceOperatorActionHostExecutor",
  "dispatchToHost",
  "runDesktopTask",
  "createDesktopHostClient",
  "runCodexCli",
  "CodexCliExecutorProvider",
  "provider.execute",
  ".execute(",
  ".planExecution(",
  ".validateExecutionPlan(",
  "spawnSubAgent",
  "spawn(",
  "execFile(",
  "child_process",
  "invokePrimitive",
  "shell_command(",
  "apply_patch(",
  "writeFile",
  "mkdir",
  "rm(",
  "rename",
  "copyFile",
  "evaluateWorkspaceWritePatchGuard"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ExecutionEligibilityBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  executionEligibilityText: string;
  executionEligibilityTestText: string;
}

export interface ExecutionEligibilityBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    eligibilityMarkersPresent: boolean;
    permitStoreScopeBound: boolean;
    coverageRecorded: boolean;
    noBroadRuntimeAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    eligibilityMode: "admission_capability_permit_decision_only";
    eligibleStatusIsExecutionAuthorization: false;
    validApprovalPermitIsProviderExecutionAuthorization: false;
    capabilityGrantIsRuntimeInvocation: false;
    permitStoreReadIsRuntimeInvocation: false;
    providerPlanCreationAllowed: false;
    providerExecuteAllowed: false;
    codexCliInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    hostDispatchAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteExecutionAllowed: false;
    externalWriteAllowed: false;
    executionEligibilityCallsDuringAudit: 0;
    permitStoreReadsDuringAudit: 0;
    providerPlanCreationCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ExecutionEligibilityBoundaryAuditOutputFormat = "text" | "json";

export async function collectExecutionEligibilityBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ExecutionEligibilityBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    executionEligibilityText,
    executionEligibilityTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, EXECUTION_ELIGIBILITY),
    read(cwd, EXECUTION_ELIGIBILITY_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    executionEligibilityText,
    executionEligibilityTestText
  };
}

export function reviewExecutionEligibilityBoundaryAudit(
  input: ExecutionEligibilityBoundaryAuditInput
): ExecutionEligibilityBoundaryAuditResult {
  const checks = {
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit execution-eligibility-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "execution-eligibility-boundary"
    ),
    eligibilityMarkersPresent: REQUIRED_ELIGIBILITY_MARKERS.every((marker) =>
      input.executionEligibilityText.includes(marker)
    ),
    permitStoreScopeBound: REQUIRED_PERMIT_STORE_MARKERS.every((marker) =>
      input.executionEligibilityText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.executionEligibilityTestText.includes(marker)
    ),
    noBroadRuntimeAuthorization: noBroadRuntimeAuthorization(
      input.executionEligibilityText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      eligibilityMode: "admission_capability_permit_decision_only",
      eligibleStatusIsExecutionAuthorization: false,
      validApprovalPermitIsProviderExecutionAuthorization: false,
      capabilityGrantIsRuntimeInvocation: false,
      permitStoreReadIsRuntimeInvocation: false,
      providerPlanCreationAllowed: false,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      hostDispatchAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      externalWriteAllowed: false,
      executionEligibilityCallsDuringAudit: 0,
      permitStoreReadsDuringAudit: 0,
      providerPlanCreationCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatExecutionEligibilityBoundaryAuditResult(
  review: ExecutionEligibilityBoundaryAuditResult,
  format: ExecutionEligibilityBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Execution eligibility boundary audit",
    `status: ${review.status}`,
    `eligibility mode: ${review.summary.eligibilityMode}`,
    `eligible status is execution authorization: ${review.summary.eligibleStatusIsExecutionAuthorization}`,
    `valid approval permit is provider execution authorization: ${review.summary.validApprovalPermitIsProviderExecutionAuthorization}`,
    `capability grant is runtime invocation: ${review.summary.capabilityGrantIsRuntimeInvocation}`,
    `permit store read is runtime invocation: ${review.summary.permitStoreReadIsRuntimeInvocation}`,
    `provider plan creation allowed: ${review.summary.providerPlanCreationAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `host dispatch allowed: ${review.summary.hostDispatchAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write execution allowed: ${review.summary.workspaceWriteExecutionAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `execution eligibility calls during audit: ${review.summary.executionEligibilityCallsDuringAudit}`,
    `permit store reads during audit: ${review.summary.permitStoreReadsDuringAudit}`,
    `provider plan creation calls during audit: ${review.summary.providerPlanCreationCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Execution eligibility boundary")
    && text.includes("admission/capability/permit decision only")
    && text.includes("eligible status is not execution authorization")
    && text.includes("npm run governance -- audit execution-eligibility-boundary");
}

function noBroadRuntimeAuthorization(text: string): boolean {
  return FORBIDDEN_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: ExecutionEligibilityBoundaryAuditInput): boolean {
  const review: ExecutionEligibilityBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      eligibilityMarkersPresent: true,
      permitStoreScopeBound: true,
      coverageRecorded: true,
      noBroadRuntimeAuthorization: true,
      outputSanitized: true
    },
    summary: {
      eligibilityMode: "admission_capability_permit_decision_only",
      eligibleStatusIsExecutionAuthorization: false,
      validApprovalPermitIsProviderExecutionAuthorization: false,
      capabilityGrantIsRuntimeInvocation: false,
      permitStoreReadIsRuntimeInvocation: false,
      providerPlanCreationAllowed: false,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      hostDispatchAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      externalWriteAllowed: false,
      executionEligibilityCallsDuringAudit: 0,
      permitStoreReadsDuringAudit: 0,
      providerPlanCreationCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatExecutionEligibilityBoundaryAuditResult(review);
  const json = formatExecutionEligibilityBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
    !text.includes(marker)
      && !json.includes(marker)
      && !input.governanceControlPlaneText.includes(marker)
      && !input.governanceReadmeText.includes(marker)
  );
}

function collectReasons(
  checks: ExecutionEligibilityBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `execution_eligibility_boundary_${name}`);
}

async function read(cwd: string, relativePath: string): Promise<string> {
  return readFile(join(cwd, relativePath), "utf8");
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectExecutionEligibilityBoundaryAuditInput();
  const review = reviewExecutionEligibilityBoundaryAudit(input);

  console.log(formatExecutionEligibilityBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Execution eligibility boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
