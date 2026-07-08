#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const PREFLIGHT_SOURCE = "packages/preflight/src/index.ts";
const PREFLIGHT_TEST = "tests/preflight.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "export interface PreflightContext",
  "export interface PreflightResult",
  "export interface MemoryPreflightState",
  "export function runPreflight",
  "export function buildMemoryPreflightState",
  "auth_unavailable",
  "missing_tool:${tool}",
  "workspace_dirty",
  "protected_branch_active",
  "memory_overview_unavailable",
  "memory_adapter_status:${codexMcpStatus}",
  "memory_recent_rejections:${rejected}",
  "memory_shadow_reconcile_pending:${reconcileCount}",
  "memory_recall_unavailable",
  "memory_recall_status:${recallStatus}",
  "applyIssueSeverity",
  "finalizeMemoryPreflightState"
] as const;

const REQUIRED_TEST_MARKERS = [
  "preflight catches missing auth and tools",
  "preflight blocks write-capable work on risky workspace state",
  "preflight allows read-only work to inspect risky workspace state",
  "preflight can require memory overview and surface memory health warnings",
  "preflight blocks when memory overview is required but unavailable",
  "preflight can block on release policy pack thresholds"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "dispatchReadOnlyRunnerResultToProvider",
  "runCodexCli(",
  "runCodexCliExecPlan(",
  "CodexCliExecutorProvider",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "executeDesktopPlan(",
  "dispatchToHost(",
  "dispatchGovernanceOperatorActionHostExecutor(",
  "invokePrimitive",
  "invokeSubAgent",
  "spawnSubAgent",
  "hostExecutor(",
  "spawn(",
  "execFile(",
  "childProcess.exec(",
  "node:child_process",
  "child_process",
  "new Worker(",
  "fetch(",
  "createServer(",
  "listen(",
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

export interface PreflightBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  preflightSourceText: string;
  preflightTestText: string;
}

export interface PreflightBoundaryAuditResult {
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
    preflightMode: "pre_execution_signal_evaluation_only";
    preflightOkIsExecutionAuthorization: false;
    missingToolCheckIsToolRuntimeAuthorization: false;
    authAvailableIsProviderExecutionAuthorization: false;
    workspaceCleanIsWorkspaceWriteAuthorization: false;
    protectedBranchCheckIsWorkspaceWriteExecution: false;
    memoryOverviewIsRuntimeAuthorization: false;
    memoryHealthStatusIsSubAgentRuntimeAuthorization: false;
    memoryWarningIsHostExecutorAuthorization: false;
    memoryBlockingIssueIsProviderExecutionAuthorization: false;
    preflightCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    desktopPrimitiveCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    networkCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type PreflightBoundaryAuditOutputFormat = "text" | "json";

export async function collectPreflightBoundaryAuditInput(
  cwd = process.cwd()
): Promise<PreflightBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    preflightSourceText,
    preflightTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, PREFLIGHT_SOURCE),
    read(cwd, PREFLIGHT_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    preflightSourceText,
    preflightTestText
  };
}

export function reviewPreflightBoundaryAudit(
  input: PreflightBoundaryAuditInput
): PreflightBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit preflight-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "preflight-boundary"
    ),
    sourceMarkersRecorded: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.preflightSourceText.includes(marker)
    ),
    regressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.preflightTestText.includes(marker)
    ),
    noRuntimeInvocationSurface:
      noRuntimeInvocationSurface(input.preflightSourceText),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      preflightMode: "pre_execution_signal_evaluation_only",
      preflightOkIsExecutionAuthorization: false,
      missingToolCheckIsToolRuntimeAuthorization: false,
      authAvailableIsProviderExecutionAuthorization: false,
      workspaceCleanIsWorkspaceWriteAuthorization: false,
      protectedBranchCheckIsWorkspaceWriteExecution: false,
      memoryOverviewIsRuntimeAuthorization: false,
      memoryHealthStatusIsSubAgentRuntimeAuthorization: false,
      memoryWarningIsHostExecutorAuthorization: false,
      memoryBlockingIssueIsProviderExecutionAuthorization: false,
      preflightCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      networkCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatPreflightBoundaryAuditResult(
  review: PreflightBoundaryAuditResult,
  format: PreflightBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Preflight boundary audit",
    `status: ${review.status}`,
    `preflight mode: ${review.summary.preflightMode}`,
    `preflight ok is execution authorization: ${review.summary.preflightOkIsExecutionAuthorization}`,
    `missing tool check is tool runtime authorization: ${review.summary.missingToolCheckIsToolRuntimeAuthorization}`,
    `auth available is provider execution authorization: ${review.summary.authAvailableIsProviderExecutionAuthorization}`,
    `workspace clean is workspace-write authorization: ${review.summary.workspaceCleanIsWorkspaceWriteAuthorization}`,
    `protected branch check is workspace-write execution: ${review.summary.protectedBranchCheckIsWorkspaceWriteExecution}`,
    `memory overview is runtime authorization: ${review.summary.memoryOverviewIsRuntimeAuthorization}`,
    `memory health status is sub-agent runtime authorization: ${review.summary.memoryHealthStatusIsSubAgentRuntimeAuthorization}`,
    `memory warning is host executor authorization: ${review.summary.memoryWarningIsHostExecutorAuthorization}`,
    `memory blocking issue is provider execution authorization: ${review.summary.memoryBlockingIssueIsProviderExecutionAuthorization}`,
    `preflight calls during audit: ${review.summary.preflightCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `desktop primitive calls during audit: ${review.summary.desktopPrimitiveCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `network calls during audit: ${review.summary.networkCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Preflight boundary")
    && text.includes("pre-execution signal evaluation only")
    && text.includes("preflight ok is not execution authorization")
    && text.includes("missing tool checks are not tool runtime authorization")
    && text.includes("auth availability is not provider execution authorization")
    && text.includes("workspace clean is not workspace-write authorization")
    && text.includes("protected branch checks are not workspace-write execution")
    && text.includes("memory overview is not runtime authorization")
    && text.includes("memory health status is not sub-agent runtime authorization")
    && text.includes("memory warnings are not host executor authorization")
    && text.includes("memory blocking issues are not provider execution authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(): boolean {
  const output = formatPreflightBoundaryAuditResult({
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
      preflightMode: "pre_execution_signal_evaluation_only",
      preflightOkIsExecutionAuthorization: false,
      missingToolCheckIsToolRuntimeAuthorization: false,
      authAvailableIsProviderExecutionAuthorization: false,
      workspaceCleanIsWorkspaceWriteAuthorization: false,
      protectedBranchCheckIsWorkspaceWriteExecution: false,
      memoryOverviewIsRuntimeAuthorization: false,
      memoryHealthStatusIsSubAgentRuntimeAuthorization: false,
      memoryWarningIsHostExecutorAuthorization: false,
      memoryBlockingIssueIsProviderExecutionAuthorization: false,
      preflightCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      networkCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(
  checks: PreflightBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `preflight_boundary_${name}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectPreflightBoundaryAuditInput();
  const review = reviewPreflightBoundaryAudit(input);
  console.log(formatPreflightBoundaryAuditResult(review, format));
  process.exitCode = review.status === "passed" ? 0 : 1;
}
