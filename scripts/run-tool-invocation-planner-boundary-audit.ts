#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const TOOL_REGISTRY_SOURCE = "packages/tool-registry/src/index.ts";
const TOOL_INVOCATION_PLANNER_SOURCE =
  "packages/tool-invocation-planner/src/index.ts";
const TOOL_REGISTRY_TEST = "tests/tool-registry.test.ts";
const TOOL_INVOCATION_PLANNER_TEST = "tests/tool-invocation-planner.test.ts";

const REQUIRED_REGISTRY_SOURCE_MARKERS = [
  "RegisteredToolManifestSchema",
  "isDangerousSideEffectClass(manifest.sideEffectClass)",
  "dangerous tools must declare requiredCapabilities",
  "remoteAgentInvokeToolManifest",
  "toolId: \"remote.agent.invoke\"",
  "provider: \"remote\"",
  "sideEffectClass: \"external_write\"",
  "requiredCapabilities: [\"network.egress:agent-runtime\", \"mcp.call:remote.agent.invoke\"]",
  "endpointRef: \"agent-runtime\"",
  "defaultToolManifests"
] as const;

const REQUIRED_PLANNER_SOURCE_MARKERS = [
  "export function planToolInvocation(input: PlanToolInvocationInput): ToolInvocationPlan",
  "status: \"blocked\"",
  "status: \"waiting_approval\"",
  "status: \"planned\"",
  "explainCapabilityDecision",
  "validateApprovalPermit",
  "tool_invocation_sandbox_exceeds_policy",
  "tool_invocation_run_terminal",
  "tool_invocation_step_terminal",
  "redactToolInvocationInput",
  "redactSecretLikeFields",
  "deriveSandboxProfile(toolManifest.sideEffectClass)",
  "sideEffectClass === \"external_write\"",
  "networkAccess: \"restricted\"",
  "sideEffectClass === \"local_write\"",
  "mode: \"workspace-write\""
] as const;

const REQUIRED_REGISTRY_TEST_MARKERS = [
  "tool registry rejects dangerous tools without capabilities",
  "tool registry requires remote provider metadata",
  "tool registry remote agent required capabilities are canonical",
  "remote.agent.invoke"
] as const;

const REQUIRED_PLANNER_TEST_MARKERS = [
  "tool invocation planner plans read-only tools when capability is granted",
  "tool invocation planner waits for approval when capability is missing",
  "tool invocation planner requires approval for dangerous side effects",
  "tool invocation planner plans dangerous tools with a valid approval permit",
  "tool invocation planner blocks tool sandboxes that exceed policy",
  "tool invocation planner blocks terminal runs and steps before planning",
  "tool invocation planner redacts proposed input preview"
] as const;

const FORBIDDEN_RUNTIME_MARKERS = [
  "provider.execute(",
  "runCodexCliExecPlan(",
  "dispatchToHost(",
  "dispatchGovernanceOperatorActionHostExecutor(",
  "spawnSubAgent(",
  "createRemoteTask(",
  "invokePrimitive(",
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

export interface ToolInvocationPlannerBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  toolRegistrySourceText: string;
  toolInvocationPlannerSourceText: string;
  toolRegistryTestText: string;
  toolInvocationPlannerTestText: string;
}

export interface ToolInvocationPlannerBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    registryMarkersRecorded: boolean;
    plannerMarkersRecorded: boolean;
    registryRegressionCoverageRecorded: boolean;
    plannerRegressionCoverageRecorded: boolean;
    noDefaultRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    toolInvocationPlannerMode: "tool_manifest_and_invocation_plan_only";
    plannedStatusIsRuntimeInvocation: false;
    remoteAgentToolManifestIsSubAgentRuntimeAuthorization: false;
    externalWriteToolManifestIsExternalWriteAuthorization: false;
    approvalPermitIsToolRuntimeAuthorization: false;
    localWriteToolPlanIsWorkspaceWriteExecution: false;
    inputPreviewStoresRawSecrets: false;
    defaultCodexCliInvocationAllowed: false;
    providerExecuteAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    toolRuntimeInvocationAllowed: false;
    shellProcessAllowedByDefault: false;
    workspaceWriteAllowedByDefault: false;
    externalWriteAllowedByDefault: false;
    toolRegistryCallsDuringAudit: 0;
    toolInvocationPlansDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ToolInvocationPlannerBoundaryAuditOutputFormat = "text" | "json";

export async function collectToolInvocationPlannerBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ToolInvocationPlannerBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    toolRegistrySourceText,
    toolInvocationPlannerSourceText,
    toolRegistryTestText,
    toolInvocationPlannerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, TOOL_REGISTRY_SOURCE),
    read(cwd, TOOL_INVOCATION_PLANNER_SOURCE),
    read(cwd, TOOL_REGISTRY_TEST),
    read(cwd, TOOL_INVOCATION_PLANNER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    toolRegistrySourceText,
    toolInvocationPlannerSourceText,
    toolRegistryTestText,
    toolInvocationPlannerTestText
  };
}

export function reviewToolInvocationPlannerBoundaryAudit(
  input: ToolInvocationPlannerBoundaryAuditInput
): ToolInvocationPlannerBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit tool-invocation-planner-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "tool-invocation-planner-boundary"
    ),
    registryMarkersRecorded: REQUIRED_REGISTRY_SOURCE_MARKERS.every((marker) =>
      input.toolRegistrySourceText.includes(marker)
    ),
    plannerMarkersRecorded: REQUIRED_PLANNER_SOURCE_MARKERS.every((marker) =>
      input.toolInvocationPlannerSourceText.includes(marker)
    ),
    registryRegressionCoverageRecorded: REQUIRED_REGISTRY_TEST_MARKERS.every(
      (marker) => input.toolRegistryTestText.includes(marker)
    ),
    plannerRegressionCoverageRecorded: REQUIRED_PLANNER_TEST_MARKERS.every(
      (marker) => input.toolInvocationPlannerTestText.includes(marker)
    ),
    noDefaultRuntimeInvocationSurface: noDefaultRuntimeInvocationSurface(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      toolInvocationPlannerMode: "tool_manifest_and_invocation_plan_only",
      plannedStatusIsRuntimeInvocation: false,
      remoteAgentToolManifestIsSubAgentRuntimeAuthorization: false,
      externalWriteToolManifestIsExternalWriteAuthorization: false,
      approvalPermitIsToolRuntimeAuthorization: false,
      localWriteToolPlanIsWorkspaceWriteExecution: false,
      inputPreviewStoresRawSecrets: false,
      defaultCodexCliInvocationAllowed: false,
      providerExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      toolRuntimeInvocationAllowed: false,
      shellProcessAllowedByDefault: false,
      workspaceWriteAllowedByDefault: false,
      externalWriteAllowedByDefault: false,
      toolRegistryCallsDuringAudit: 0,
      toolInvocationPlansDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatToolInvocationPlannerBoundaryAuditResult(
  review: ToolInvocationPlannerBoundaryAuditResult,
  format: ToolInvocationPlannerBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Tool invocation planner boundary audit",
    `status: ${review.status}`,
    `tool invocation planner mode: ${review.summary.toolInvocationPlannerMode}`,
    `planned status is runtime invocation: ${review.summary.plannedStatusIsRuntimeInvocation}`,
    `remote agent tool manifest is sub-agent runtime authorization: ${review.summary.remoteAgentToolManifestIsSubAgentRuntimeAuthorization}`,
    `external-write tool manifest is external-write authorization: ${review.summary.externalWriteToolManifestIsExternalWriteAuthorization}`,
    `approval permit is tool runtime authorization: ${review.summary.approvalPermitIsToolRuntimeAuthorization}`,
    `local-write tool plan is workspace-write execution: ${review.summary.localWriteToolPlanIsWorkspaceWriteExecution}`,
    `input preview stores raw secrets: ${review.summary.inputPreviewStoresRawSecrets}`,
    `default Codex CLI invocation allowed: ${review.summary.defaultCodexCliInvocationAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `tool runtime invocation allowed: ${review.summary.toolRuntimeInvocationAllowed}`,
    `shell/process allowed by default: ${review.summary.shellProcessAllowedByDefault}`,
    `workspace-write allowed by default: ${review.summary.workspaceWriteAllowedByDefault}`,
    `external write allowed by default: ${review.summary.externalWriteAllowedByDefault}`,
    `tool registry calls during audit: ${review.summary.toolRegistryCallsDuringAudit}`,
    `tool invocation plans during audit: ${review.summary.toolInvocationPlansDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
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
  return text.includes("Tool invocation planner boundary")
    && text.includes("tool manifest and invocation plan only")
    && text.includes("planned tool invocation status is not runtime invocation")
    && text.includes("remote.agent.invoke is not sub-agent runtime authorization")
    && text.includes("approval permits are not tool runtime authorization");
}

function noDefaultRuntimeInvocationSurface(
  input: ToolInvocationPlannerBoundaryAuditInput
): boolean {
  return FORBIDDEN_RUNTIME_MARKERS.every((marker) =>
    !input.toolRegistrySourceText.includes(marker)
      && !input.toolInvocationPlannerSourceText.includes(marker)
  );
}

function outputSanitized(): boolean {
  const output = formatToolInvocationPlannerBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      registryMarkersRecorded: true,
      plannerMarkersRecorded: true,
      registryRegressionCoverageRecorded: true,
      plannerRegressionCoverageRecorded: true,
      noDefaultRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      toolInvocationPlannerMode: "tool_manifest_and_invocation_plan_only",
      plannedStatusIsRuntimeInvocation: false,
      remoteAgentToolManifestIsSubAgentRuntimeAuthorization: false,
      externalWriteToolManifestIsExternalWriteAuthorization: false,
      approvalPermitIsToolRuntimeAuthorization: false,
      localWriteToolPlanIsWorkspaceWriteExecution: false,
      inputPreviewStoresRawSecrets: false,
      defaultCodexCliInvocationAllowed: false,
      providerExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      toolRuntimeInvocationAllowed: false,
      shellProcessAllowedByDefault: false,
      workspaceWriteAllowedByDefault: false,
      externalWriteAllowedByDefault: false,
      toolRegistryCallsDuringAudit: 0,
      toolInvocationPlansDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(
  checks: ToolInvocationPlannerBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `tool_invocation_planner_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectToolInvocationPlannerBoundaryAuditInput();
  const review = reviewToolInvocationPlannerBoundaryAudit(input);

  console.log(formatToolInvocationPlannerBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Tool invocation planner boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
