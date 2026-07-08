#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const EXECUTION_PLANNER = "packages/execution-planner/src/index.ts";
const EXECUTION_PLANNER_TEST = "tests/execution-planner.test.ts";

const REQUIRED_PLANNER_MARKERS = [
  "ProviderExecutionPlanStatusSchema",
  "\"planned\"",
  "\"blocked\"",
  "\"waiting_approval\"",
  "ProviderExecutionPlanSchema",
  "planProviderExecution",
  "resolveProviderSideEffectClass",
  "resolveProvider",
  "collectKernelIntegrityReasons",
  "hashProviderManifest",
  "hashApprovalScope",
  "provider_planned",
  "eligibility_blocked",
  "eligibility_waiting_approval",
  "eligibility_missing_policy_approval_permit",
  "provider_not_found",
  "provider_disabled",
  "unsupported_side_effect_class",
  "unsupported_sandbox_profile"
] as const;

const REQUIRED_PLAN_STORE_MARKERS = [
  "ProviderExecutionPlanStore",
  "InMemoryProviderExecutionPlanStore",
  "FileSystemProviderExecutionPlanStore",
  "ProviderExecutionPlanStoreStateSchema",
  "provider-execution-plans.json",
  ".provider-execution-plan-store.lock",
  "savePlan(plan",
  "writeFileSync(fd",
  "writeFileSync(tempPath",
  "renameSync(tempPath, this.statePath)",
  "unlinkSync(this.lockPath)",
  "mkdirSync(this.baseDir, { recursive: true })"
] as const;

const REQUIRED_TEST_MARKERS = [
  "execution planner creates a planned plan with codex-cli provider",
  "execution planner includes provider manifest hash in plan identity",
  "provider execution plan store saves and filters stable snapshots",
  "file provider execution plan store persists plans across instances",
  "file provider execution plan store refuses state mutation while another lock is present",
  "execution planner emits canonical required capability scopes",
  "execution planner preserves local command side effects before write sandbox",
  "execution planner blocks when execution eligibility is blocked",
  "execution planner waits when execution eligibility waits for approval",
  "execution planner blocks forged eligible decisions when policy requires approval",
  "execution planner blocks eligibility decisions bound to another policy hash",
  "execution planner blocks eligible decisions with unresolved approvals or capabilities",
  "execution planner blocks when preferred provider is missing",
  "execution planner blocks when preferred provider is disabled",
  "execution planner blocks unsupported side effect classes",
  "execution planner blocks unsupported sandbox profiles",
  "fake_provider_plan_execution_should_not_be_called",
  "fake_provider_validate_should_not_be_called",
  "fake_provider_execute_should_not_be_called"
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
  "evaluateWorkspaceWritePatchGuard"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ExecutionPlannerBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  executionPlannerText: string;
  executionPlannerTestText: string;
}

export interface ExecutionPlannerBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    plannerMarkersPresent: boolean;
    planStoreWritesLimitedToPlanState: boolean;
    coverageRecorded: boolean;
    noBroadRuntimeAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    plannerMode: "provider_execution_plan_only";
    plannedStatusIsProviderExecutionAuthorization: false;
    codexCliProviderSelectionIsCodexCliInvocation: false;
    remoteAgentProviderSelectionIsSubAgentRuntimeInvocation: false;
    workspaceWriteSideEffectClassIsWorkspaceWriteExecution: false;
    localPlanStoreWritesAllowed: true;
    planStoreWritesLimitedToPlanState: true;
    providerPlanExecutionAllowed: false;
    providerValidateExecutionPlanAllowed: false;
    providerExecuteAllowed: false;
    codexCliInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    hostDispatchAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteExecutionAllowed: false;
    externalWriteAllowed: false;
    executionPlannerCallsDuringAudit: 0;
    localPlanStoreWritesDuringAudit: 0;
    providerPlanExecutionCallsDuringAudit: 0;
    providerValidateExecutionPlanCallsDuringAudit: 0;
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

export type ExecutionPlannerBoundaryAuditOutputFormat = "text" | "json";

export async function collectExecutionPlannerBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ExecutionPlannerBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    executionPlannerText,
    executionPlannerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, EXECUTION_PLANNER),
    read(cwd, EXECUTION_PLANNER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    executionPlannerText,
    executionPlannerTestText
  };
}

export function reviewExecutionPlannerBoundaryAudit(
  input: ExecutionPlannerBoundaryAuditInput
): ExecutionPlannerBoundaryAuditResult {
  const checks = {
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit execution-planner-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "execution-planner-boundary"
    ),
    plannerMarkersPresent: REQUIRED_PLANNER_MARKERS.every((marker) =>
      input.executionPlannerText.includes(marker)
    ),
    planStoreWritesLimitedToPlanState: planStoreWritesLimitedToPlanState(
      input.executionPlannerText
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.executionPlannerTestText.includes(marker)
    ),
    noBroadRuntimeAuthorization: noBroadRuntimeAuthorization(
      input.executionPlannerText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      plannerMode: "provider_execution_plan_only",
      plannedStatusIsProviderExecutionAuthorization: false,
      codexCliProviderSelectionIsCodexCliInvocation: false,
      remoteAgentProviderSelectionIsSubAgentRuntimeInvocation: false,
      workspaceWriteSideEffectClassIsWorkspaceWriteExecution: false,
      localPlanStoreWritesAllowed: true,
      planStoreWritesLimitedToPlanState: true,
      providerPlanExecutionAllowed: false,
      providerValidateExecutionPlanAllowed: false,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      hostDispatchAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      externalWriteAllowed: false,
      executionPlannerCallsDuringAudit: 0,
      localPlanStoreWritesDuringAudit: 0,
      providerPlanExecutionCallsDuringAudit: 0,
      providerValidateExecutionPlanCallsDuringAudit: 0,
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

export function formatExecutionPlannerBoundaryAuditResult(
  review: ExecutionPlannerBoundaryAuditResult,
  format: ExecutionPlannerBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Execution planner boundary audit",
    `status: ${review.status}`,
    `planner mode: ${review.summary.plannerMode}`,
    `planned status is provider execution authorization: ${review.summary.plannedStatusIsProviderExecutionAuthorization}`,
    `codex-cli provider selection is Codex CLI invocation: ${review.summary.codexCliProviderSelectionIsCodexCliInvocation}`,
    `remote-agent provider selection is sub-agent runtime invocation: ${review.summary.remoteAgentProviderSelectionIsSubAgentRuntimeInvocation}`,
    `workspace-write side effect class is workspace-write execution: ${review.summary.workspaceWriteSideEffectClassIsWorkspaceWriteExecution}`,
    `local plan store writes allowed: ${review.summary.localPlanStoreWritesAllowed}`,
    `plan store writes limited to plan state: ${review.summary.planStoreWritesLimitedToPlanState}`,
    `provider planExecution allowed: ${review.summary.providerPlanExecutionAllowed}`,
    `provider validateExecutionPlan allowed: ${review.summary.providerValidateExecutionPlanAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `host dispatch allowed: ${review.summary.hostDispatchAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write execution allowed: ${review.summary.workspaceWriteExecutionAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `execution planner calls during audit: ${review.summary.executionPlannerCallsDuringAudit}`,
    `local plan store writes during audit: ${review.summary.localPlanStoreWritesDuringAudit}`,
    `provider planExecution calls during audit: ${review.summary.providerPlanExecutionCallsDuringAudit}`,
    `provider validateExecutionPlan calls during audit: ${review.summary.providerValidateExecutionPlanCallsDuringAudit}`,
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
  return text.includes("Execution planner boundary")
    && text.includes("provider execution plan only")
    && text.includes("planned status is not provider execution authorization")
    && text.includes("npm run governance -- audit execution-planner-boundary");
}

function planStoreWritesLimitedToPlanState(text: string): boolean {
  return REQUIRED_PLAN_STORE_MARKERS.every((marker) => text.includes(marker))
    && countOccurrences(text, "writeFileSync(") === 2
    && countOccurrences(text, "renameSync(") === 1
    && countOccurrences(text, "mkdirSync(") === 1
    && countOccurrences(text, "unlinkSync(") === 2;
}

function noBroadRuntimeAuthorization(text: string): boolean {
  return FORBIDDEN_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: ExecutionPlannerBoundaryAuditInput): boolean {
  const review: ExecutionPlannerBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      plannerMarkersPresent: true,
      planStoreWritesLimitedToPlanState: true,
      coverageRecorded: true,
      noBroadRuntimeAuthorization: true,
      outputSanitized: true
    },
    summary: {
      plannerMode: "provider_execution_plan_only",
      plannedStatusIsProviderExecutionAuthorization: false,
      codexCliProviderSelectionIsCodexCliInvocation: false,
      remoteAgentProviderSelectionIsSubAgentRuntimeInvocation: false,
      workspaceWriteSideEffectClassIsWorkspaceWriteExecution: false,
      localPlanStoreWritesAllowed: true,
      planStoreWritesLimitedToPlanState: true,
      providerPlanExecutionAllowed: false,
      providerValidateExecutionPlanAllowed: false,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      hostDispatchAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      externalWriteAllowed: false,
      executionPlannerCallsDuringAudit: 0,
      localPlanStoreWritesDuringAudit: 0,
      providerPlanExecutionCallsDuringAudit: 0,
      providerValidateExecutionPlanCallsDuringAudit: 0,
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
  const text = formatExecutionPlannerBoundaryAuditResult(review);
  const json = formatExecutionPlannerBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
    !text.includes(marker)
      && !json.includes(marker)
      && !input.governanceControlPlaneText.includes(marker)
      && !input.governanceReadmeText.includes(marker)
  );
}

function countOccurrences(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

function collectReasons(
  checks: ExecutionPlannerBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `execution_planner_boundary_${name}`);
}

async function read(cwd: string, relativePath: string): Promise<string> {
  return readFile(join(cwd, relativePath), "utf8");
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectExecutionPlannerBoundaryAuditInput();
  const review = reviewExecutionPlannerBoundaryAudit(input);

  console.log(formatExecutionPlannerBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Execution planner boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
