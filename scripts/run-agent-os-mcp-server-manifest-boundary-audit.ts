#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const SERVER_MANIFEST_SOURCE = "packages/protocol-mcp/src/agent-os-server-manifest.ts";
const SERVER_MANIFEST_TEST = "tests/agent-os-mcp-server-manifest.test.ts";
const PUBLIC_SURFACES_TEST = "tests/agent-os-public-surfaces-boundary-audit.test.ts";
const LOCAL_RUNTIME_TEST = "tests/agent-os-local-runtime-boundary-audit.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "AgentOsMcpToolNameSchema",
  "requiredCapabilitiesByToolName",
  "AgentOsMcpToolManifestSchema",
  "AgentOsMcpServerManifestSchema",
  "runtimeImplemented: z.literal(false)",
  "agentOsMcpServerManifest",
  "runtimeImplemented: false",
  "No server runtime or handlers are implemented",
  "sideEffectClass: \"local_write\"",
  "sideEffectClass: \"read\"",
  "approvalRequired: true",
  "approvalRequired: false",
  "policyGated: true",
  "listAgentOsMcpToolManifests",
  "cloneToolManifest"
] as const;

const REQUIRED_TEST_MARKERS = [
  "Agent OS MCP server manifest declares all tools and no runtime",
  "Agent OS MCP mutating tools have required capabilities and approval gates",
  "Agent OS MCP create_task output schema declares provider planning fields",
  "Agent OS MCP approve_run cannot be declared without approval.issue",
  "Agent OS MCP approve_run output schema declares permit and blocked result shapes",
  "Agent OS MCP list, get, and search tools are read side effect",
  "Agent OS MCP toolIds are unique and stable",
  "Agent OS public surfaces boundary audit passes for current evidence",
  "Agent OS local runtime boundary audit passes for current evidence"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  "createAgentOsMcpLocalRuntime(",
  ".handleToolCall(",
  "provider.execute(",
  ".executeProvider(",
  "dispatchReadOnlyRunnerResultToProvider",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "dispatchToHost(",
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

export interface AgentOsMcpServerManifestBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  serverManifestSourceText: string;
  serverManifestTestText: string;
  publicSurfacesTestText: string;
  localRuntimeTestText: string;
}

export interface AgentOsMcpServerManifestBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    agentOsMcpServerManifestMode: "manifest_only_no_runtime";
    runtimeImplementedMeansLiveServer: false;
    toolManifestIsToolRuntimeAuthorization: false;
    requiredCapabilityIsCapabilityGrant: false;
    approvalRequiredIsApprovalGrant: false;
    localWriteSideEffectIsWorkspaceWriteExecution: false;
    providerPlanningOutputIsProviderExecutionAuthorization: false;
    approvalPermitOutputIsProviderExecutionAuthorization: false;
    listedToolIsMcpToolInvocation: false;
    manifestExportIsPublicExecutionSurface: false;
    agentOsMcpServerManifestCallsDuringAudit: 0;
    liveMcpServerStartsDuringAudit: 0;
    localRuntimeCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    desktopPrimitiveCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    networkCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentOsMcpServerManifestBoundaryAuditOutputFormat = "text" | "json";

export async function collectAgentOsMcpServerManifestBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentOsMcpServerManifestBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    serverManifestSourceText,
    serverManifestTestText,
    publicSurfacesTestText,
    localRuntimeTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, SERVER_MANIFEST_SOURCE),
    read(cwd, SERVER_MANIFEST_TEST),
    read(cwd, PUBLIC_SURFACES_TEST),
    read(cwd, LOCAL_RUNTIME_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    serverManifestSourceText,
    serverManifestTestText,
    publicSurfacesTestText,
    localRuntimeTestText
  };
}

export function reviewAgentOsMcpServerManifestBoundaryAudit(
  input: AgentOsMcpServerManifestBoundaryAuditInput
): AgentOsMcpServerManifestBoundaryAuditResult {
  const testText = [
    input.serverManifestTestText,
    input.publicSurfacesTestText,
    input.localRuntimeTestText
  ].join("\n");
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit agent-os-mcp-server-manifest-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-os-mcp-server-manifest-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.serverManifestSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      testText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.serverManifestSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      agentOsMcpServerManifestMode: "manifest_only_no_runtime",
      runtimeImplementedMeansLiveServer: false,
      toolManifestIsToolRuntimeAuthorization: false,
      requiredCapabilityIsCapabilityGrant: false,
      approvalRequiredIsApprovalGrant: false,
      localWriteSideEffectIsWorkspaceWriteExecution: false,
      providerPlanningOutputIsProviderExecutionAuthorization: false,
      approvalPermitOutputIsProviderExecutionAuthorization: false,
      listedToolIsMcpToolInvocation: false,
      manifestExportIsPublicExecutionSurface: false,
      agentOsMcpServerManifestCallsDuringAudit: 0,
      liveMcpServerStartsDuringAudit: 0,
      localRuntimeCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      networkCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatAgentOsMcpServerManifestBoundaryAuditResult(
  review: AgentOsMcpServerManifestBoundaryAuditResult,
  format: AgentOsMcpServerManifestBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent OS MCP server manifest boundary audit",
    `status: ${review.status}`,
    `Agent OS MCP server manifest mode: ${review.summary.agentOsMcpServerManifestMode}`,
    `runtimeImplemented means live server: ${review.summary.runtimeImplementedMeansLiveServer}`,
    `tool manifest is tool runtime authorization: ${review.summary.toolManifestIsToolRuntimeAuthorization}`,
    `required capability is capability grant: ${review.summary.requiredCapabilityIsCapabilityGrant}`,
    `approvalRequired is approval grant: ${review.summary.approvalRequiredIsApprovalGrant}`,
    `local_write side effect is workspace-write execution: ${review.summary.localWriteSideEffectIsWorkspaceWriteExecution}`,
    `provider planning output is provider execution authorization: ${review.summary.providerPlanningOutputIsProviderExecutionAuthorization}`,
    `approval permit output is provider execution authorization: ${review.summary.approvalPermitOutputIsProviderExecutionAuthorization}`,
    `listed tool is MCP tool invocation: ${review.summary.listedToolIsMcpToolInvocation}`,
    `manifest export is public execution surface: ${review.summary.manifestExportIsPublicExecutionSurface}`,
    `Agent OS MCP server manifest calls during audit: ${review.summary.agentOsMcpServerManifestCallsDuringAudit}`,
    `live MCP server starts during audit: ${review.summary.liveMcpServerStartsDuringAudit}`,
    `local runtime calls during audit: ${review.summary.localRuntimeCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `desktop primitive calls during audit: ${review.summary.desktopPrimitiveCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
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
  return text.includes("Agent OS MCP server manifest boundary")
    && text.includes("manifest only; no runtime")
    && text.includes("runtimeImplemented false is not a live MCP server")
    && text.includes("tool manifests are not tool runtime authorization")
    && text.includes("requiredCapabilities are not capability grants")
    && text.includes("approvalRequired is not approval grant")
    && text.includes("local_write side effects are not workspace-write execution")
    && text.includes("provider planning and approval permit output schemas are not provider execution authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: AgentOsMcpServerManifestBoundaryAuditInput): boolean {
  const output = formatAgentOsMcpServerManifestBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      agentOsMcpServerManifestMode: "manifest_only_no_runtime",
      runtimeImplementedMeansLiveServer: false,
      toolManifestIsToolRuntimeAuthorization: false,
      requiredCapabilityIsCapabilityGrant: false,
      approvalRequiredIsApprovalGrant: false,
      localWriteSideEffectIsWorkspaceWriteExecution: false,
      providerPlanningOutputIsProviderExecutionAuthorization: false,
      approvalPermitOutputIsProviderExecutionAuthorization: false,
      listedToolIsMcpToolInvocation: false,
      manifestExportIsPublicExecutionSurface: false,
      agentOsMcpServerManifestCallsDuringAudit: 0,
      liveMcpServerStartsDuringAudit: 0,
      localRuntimeCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      networkCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });
  const scannedText = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    input.serverManifestSourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !scannedText.includes(marker));
}

function collectReasons(
  checks: AgentOsMcpServerManifestBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `agent_os_mcp_server_manifest_boundary_${check}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAgentOsMcpServerManifestBoundaryAuditInput();
  const review = reviewAgentOsMcpServerManifestBoundaryAudit(input);
  console.log(formatAgentOsMcpServerManifestBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}
