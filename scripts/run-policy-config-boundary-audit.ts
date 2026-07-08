#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const POLICY_CONFIG_SOURCE = "packages/policy-config/src/index.ts";
const POLICY_CONFIG_TEST = "tests/policy-config.test.ts";
const ROUTING_POLICY = "routing-policy.yaml";

const REQUIRED_SOURCE_MARKERS = [
  "PolicySnapshotSchema",
  "REQUIRED_TASK_CLASSES",
  "loadPolicyFromFile",
  "loadPolicyFromString",
  "resolveMemoryHealthPolicyPack",
  "resolveTelemetryAlertThresholdPreset",
  "resolveTelemetryAlertDeliveryThresholdPreset",
  "resolveTelemetryAlertDeliveryWindowPolicy",
  "hostRoutes",
  "toolPolicies",
  "approvalRules",
  "protectedToolAccess",
  "memoryHealth",
  "telemetryAlerts",
  "Missing host route for task class"
] as const;

const REQUIRED_POLICY_MARKERS = [
  "hostRoutes:",
  "read_only: \"codex-cli\"",
  "engineering: \"desktop\"",
  "protected_remote",
  "protectedBranches:",
  "protectedKeywords:",
  "memoryHealth:",
  "overviewUnavailableSeverity: \"block\"",
  "telemetryAlerts:",
  "telemetryAlertDeliveryWindow:"
] as const;

const REQUIRED_TEST_MARKERS = [
  "policy config exposes execution-oriented memory health policy packs",
  "policy config exposes telemetry alert threshold presets aligned to tool access",
  "policy config exposes telemetry alert delivery threshold presets aligned to tool access",
  "policy config exposes telemetry alert delivery window presets aligned to tool access",
  "policy config requires explicit host routes for every task class",
  "policy config rejects policies without hostRoutes"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "dispatchGovernanceOperatorActionHostExecutor",
  "dispatchToHost(",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "invokePrimitive",
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

export interface PolicyConfigBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  policyConfigSourceText: string;
  policyConfigTestText: string;
  routingPolicyText: string;
}

export interface PolicyConfigBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    routingPolicyMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    policyConfigMode: "policy_schema_and_signal_resolution_only";
    hostRouteIsHostDispatchAuthorization: false;
    codexCliHostRouteIsCodexCliInvocation: false;
    desktopHostRouteIsDesktopRuntimeInvocation: false;
    toolPolicyIsToolRuntimeAuthorization: false;
    protectedRemoteToolPolicyIsExternalWriteAuthorization: false;
    approvalRuleIsApprovalGrant: false;
    memoryHealthBlockIsRuntimeBlockExecution: false;
    memoryGuidanceIsSubAgentRuntimeAuthorization: false;
    telemetryThresholdIsRuntimeAuthorization: false;
    telemetryDeliveryWindowIsHostExecutorAuthorization: false;
    policyLoadCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    desktopPrimitiveCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type PolicyConfigBoundaryAuditOutputFormat = "text" | "json";

export async function collectPolicyConfigBoundaryAuditInput(
  cwd = process.cwd()
): Promise<PolicyConfigBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    policyConfigSourceText,
    policyConfigTestText,
    routingPolicyText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, POLICY_CONFIG_SOURCE),
    read(cwd, POLICY_CONFIG_TEST),
    read(cwd, ROUTING_POLICY)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    policyConfigSourceText,
    policyConfigTestText,
    routingPolicyText
  };
}

export function reviewPolicyConfigBoundaryAudit(
  input: PolicyConfigBoundaryAuditInput
): PolicyConfigBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit policy-config-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "policy-config-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.policyConfigSourceText.includes(marker)
    ),
    routingPolicyMarkersPresent: REQUIRED_POLICY_MARKERS.every((marker) =>
      input.routingPolicyText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.policyConfigTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.policyConfigSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      policyConfigMode: "policy_schema_and_signal_resolution_only",
      hostRouteIsHostDispatchAuthorization: false,
      codexCliHostRouteIsCodexCliInvocation: false,
      desktopHostRouteIsDesktopRuntimeInvocation: false,
      toolPolicyIsToolRuntimeAuthorization: false,
      protectedRemoteToolPolicyIsExternalWriteAuthorization: false,
      approvalRuleIsApprovalGrant: false,
      memoryHealthBlockIsRuntimeBlockExecution: false,
      memoryGuidanceIsSubAgentRuntimeAuthorization: false,
      telemetryThresholdIsRuntimeAuthorization: false,
      telemetryDeliveryWindowIsHostExecutorAuthorization: false,
      policyLoadCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatPolicyConfigBoundaryAuditResult(
  review: PolicyConfigBoundaryAuditResult,
  format: PolicyConfigBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Policy config boundary audit",
    `status: ${review.status}`,
    `policy config mode: ${review.summary.policyConfigMode}`,
    `hostRoute is host dispatch authorization: ${review.summary.hostRouteIsHostDispatchAuthorization}`,
    `codex-cli host route is Codex CLI invocation: ${review.summary.codexCliHostRouteIsCodexCliInvocation}`,
    `desktop host route is desktop runtime invocation: ${review.summary.desktopHostRouteIsDesktopRuntimeInvocation}`,
    `toolPolicy is tool runtime authorization: ${review.summary.toolPolicyIsToolRuntimeAuthorization}`,
    `protected_remote tool policy is external-write authorization: ${review.summary.protectedRemoteToolPolicyIsExternalWriteAuthorization}`,
    `approval rule is approval grant: ${review.summary.approvalRuleIsApprovalGrant}`,
    `memory health block is runtime block execution: ${review.summary.memoryHealthBlockIsRuntimeBlockExecution}`,
    `memory guidance is sub-agent runtime authorization: ${review.summary.memoryGuidanceIsSubAgentRuntimeAuthorization}`,
    `telemetry threshold is runtime authorization: ${review.summary.telemetryThresholdIsRuntimeAuthorization}`,
    `telemetry delivery window is host executor authorization: ${review.summary.telemetryDeliveryWindowIsHostExecutorAuthorization}`,
    `policy load calls during audit: ${review.summary.policyLoadCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `desktop primitive calls during audit: ${review.summary.desktopPrimitiveCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
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
  return text.includes("Policy config boundary")
    && text.includes("policy schema and signal resolution only")
    && text.includes("hostRoutes are not host dispatch authorization")
    && text.includes("codex-cli host routes are not Codex CLI invocation")
    && text.includes("desktop host routes are not desktop runtime invocation")
    && text.includes("toolPolicies are not tool runtime authorization")
    && text.includes("protected_remote is not external-write authorization")
    && text.includes("approval rules are not approval grants")
    && text.includes("memory health block severity is not runtime block execution")
    && text.includes("memory guidance is not sub-agent runtime authorization")
    && text.includes("telemetry thresholds are not runtime authorization")
    && text.includes("telemetry delivery windows are not host executor authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: PolicyConfigBoundaryAuditInput): boolean {
  const output = formatPolicyConfigBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      routingPolicyMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      policyConfigMode: "policy_schema_and_signal_resolution_only",
      hostRouteIsHostDispatchAuthorization: false,
      codexCliHostRouteIsCodexCliInvocation: false,
      desktopHostRouteIsDesktopRuntimeInvocation: false,
      toolPolicyIsToolRuntimeAuthorization: false,
      protectedRemoteToolPolicyIsExternalWriteAuthorization: false,
      approvalRuleIsApprovalGrant: false,
      memoryHealthBlockIsRuntimeBlockExecution: false,
      memoryGuidanceIsSubAgentRuntimeAuthorization: false,
      telemetryThresholdIsRuntimeAuthorization: false,
      telemetryDeliveryWindowIsHostExecutorAuthorization: false,
      policyLoadCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });
  const aggregateText = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    input.policyConfigSourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: PolicyConfigBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `policy_config_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectPolicyConfigBoundaryAuditInput();
  const review = reviewPolicyConfigBoundaryAudit(input);
  console.log(formatPolicyConfigBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Policy config boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
