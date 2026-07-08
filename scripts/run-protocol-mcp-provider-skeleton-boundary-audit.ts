#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const PROTOCOL_MCP_SOURCE = "packages/protocol-mcp/src/index.ts";
const PROTOCOL_MCP_TEST = "tests/protocol-mcp.test.ts";
const PROVIDER_REGISTRY_TEST = "tests/provider-registry.test.ts";
const EXECUTION_PLANNER_TEST = "tests/execution-planner.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "MCP_TOOL_PROVIDER_INVOKE_DISABLED",
  "McpServerRefSchema",
  "commandRef must be an opaque reference, not a shell command",
  "endpointRef must be an opaque reference, not a raw URL",
  "mcpToolToToolManifest",
  "toolManifestToMcpToolDescriptor",
  "createMcpToolProviderSkeleton",
  "createFakeMcpToolProvider",
  "liveServerConnection: false",
  "invokeDefault: \"disabled\"",
  "throw new McpToolProviderInvokeDisabledError()",
  "assertMcpToolAllowed",
  "mcp_tool_not_allowlisted",
  "mcp_tool_disabled",
  "approvalRequiredByDefault: sideEffectClass === \"unknown\"",
  "networkAccess: serverRef.transport === \"stdio\" ? \"none\" : \"restricted\"",
  "filesystemAccess: \"none\"",
  "secretAccess: \"brokered\""
] as const;

const REQUIRED_TEST_MARKERS = [
  "protocol-mcp maps an MCP tool descriptor to a ToolManifest",
  "protocol-mcp defaults missing sideEffectClass to unknown and requires approval",
  "protocol-mcp provider skeleton enforces allowedTools allowlist",
  "protocol-mcp provider skeleton rejects unsupported invocation sandboxes",
  "protocol-mcp provider skeleton enforces disabledTools blocklist",
  "protocol-mcp rejects raw stdio commands and treats commandRef as a reference",
  "protocol-mcp provider skeleton invoke is disabled",
  "protocol-mcp fake server exposes descriptors for local integration without invocation",
  "MCP_TOOL_PROVIDER_INVOKE_DISABLED",
  "createMcpToolProviderSkeleton"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
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

export interface ProtocolMcpProviderSkeletonBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  protocolMcpSourceText: string;
  protocolMcpTestText: string;
  providerRegistryTestText: string;
  executionPlannerTestText: string;
}

export interface ProtocolMcpProviderSkeletonBoundaryAuditResult {
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
    protocolMcpProviderSkeletonMode: "protocol_mapping_and_disabled_provider_skeleton_only";
    serverRefIsLiveServerConnection: false;
    commandRefIsShellCommand: false;
    endpointRefIsNetworkCall: false;
    toolManifestIsToolRuntimeAuthorization: false;
    invocationPlanIsToolExecutionAuthorization: false;
    fakeProviderIsLiveMcpServer: false;
    invokeMethodIsEnabled: false;
    unknownSideEffectIsAutoApproved: false;
    allowedToolIsMcpInvocationAuthorization: false;
    protocolMcpCallsDuringAudit: 0;
    liveMcpServerConnectionsDuringAudit: 0;
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

export type ProtocolMcpProviderSkeletonBoundaryAuditOutputFormat = "text" | "json";

export async function collectProtocolMcpProviderSkeletonBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ProtocolMcpProviderSkeletonBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    protocolMcpSourceText,
    protocolMcpTestText,
    providerRegistryTestText,
    executionPlannerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, PROTOCOL_MCP_SOURCE),
    read(cwd, PROTOCOL_MCP_TEST),
    read(cwd, PROVIDER_REGISTRY_TEST),
    read(cwd, EXECUTION_PLANNER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    protocolMcpSourceText,
    protocolMcpTestText,
    providerRegistryTestText,
    executionPlannerTestText
  };
}

export function reviewProtocolMcpProviderSkeletonBoundaryAudit(
  input: ProtocolMcpProviderSkeletonBoundaryAuditInput
): ProtocolMcpProviderSkeletonBoundaryAuditResult {
  const testText = [
    input.protocolMcpTestText,
    input.providerRegistryTestText,
    input.executionPlannerTestText
  ].join("\n");
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit protocol-mcp-provider-skeleton-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "protocol-mcp-provider-skeleton-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.protocolMcpSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      testText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.protocolMcpSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      protocolMcpProviderSkeletonMode: "protocol_mapping_and_disabled_provider_skeleton_only",
      serverRefIsLiveServerConnection: false,
      commandRefIsShellCommand: false,
      endpointRefIsNetworkCall: false,
      toolManifestIsToolRuntimeAuthorization: false,
      invocationPlanIsToolExecutionAuthorization: false,
      fakeProviderIsLiveMcpServer: false,
      invokeMethodIsEnabled: false,
      unknownSideEffectIsAutoApproved: false,
      allowedToolIsMcpInvocationAuthorization: false,
      protocolMcpCallsDuringAudit: 0,
      liveMcpServerConnectionsDuringAudit: 0,
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

export function formatProtocolMcpProviderSkeletonBoundaryAuditResult(
  review: ProtocolMcpProviderSkeletonBoundaryAuditResult,
  format: ProtocolMcpProviderSkeletonBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Protocol MCP provider skeleton boundary audit",
    `status: ${review.status}`,
    `protocol MCP provider skeleton mode: ${review.summary.protocolMcpProviderSkeletonMode}`,
    `serverRef is live server connection: ${review.summary.serverRefIsLiveServerConnection}`,
    `commandRef is shell command: ${review.summary.commandRefIsShellCommand}`,
    `endpointRef is network call: ${review.summary.endpointRefIsNetworkCall}`,
    `tool manifest is tool runtime authorization: ${review.summary.toolManifestIsToolRuntimeAuthorization}`,
    `invocation plan is tool execution authorization: ${review.summary.invocationPlanIsToolExecutionAuthorization}`,
    `fake provider is live MCP server: ${review.summary.fakeProviderIsLiveMcpServer}`,
    `invoke method is enabled: ${review.summary.invokeMethodIsEnabled}`,
    `unknown side effect is auto-approved: ${review.summary.unknownSideEffectIsAutoApproved}`,
    `allowed tool is MCP invocation authorization: ${review.summary.allowedToolIsMcpInvocationAuthorization}`,
    `protocol MCP calls during audit: ${review.summary.protocolMcpCallsDuringAudit}`,
    `live MCP server connections during audit: ${review.summary.liveMcpServerConnectionsDuringAudit}`,
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
  return text.includes("Protocol MCP provider skeleton boundary")
    && text.includes("protocol mapping and disabled provider skeleton only")
    && text.includes("server refs are not live MCP server connections")
    && text.includes("commandRef is not a shell command")
    && text.includes("endpointRef is not a network call")
    && text.includes("tool manifests are not tool runtime authorization")
    && text.includes("invocation plans are not tool execution authorization")
    && text.includes("fake providers are not live MCP servers")
    && text.includes("invoke remains disabled");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: ProtocolMcpProviderSkeletonBoundaryAuditInput): boolean {
  const output = formatProtocolMcpProviderSkeletonBoundaryAuditResult({
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
      protocolMcpProviderSkeletonMode: "protocol_mapping_and_disabled_provider_skeleton_only",
      serverRefIsLiveServerConnection: false,
      commandRefIsShellCommand: false,
      endpointRefIsNetworkCall: false,
      toolManifestIsToolRuntimeAuthorization: false,
      invocationPlanIsToolExecutionAuthorization: false,
      fakeProviderIsLiveMcpServer: false,
      invokeMethodIsEnabled: false,
      unknownSideEffectIsAutoApproved: false,
      allowedToolIsMcpInvocationAuthorization: false,
      protocolMcpCallsDuringAudit: 0,
      liveMcpServerConnectionsDuringAudit: 0,
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
    input.protocolMcpSourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !scannedText.includes(marker));
}

function collectReasons(
  checks: ProtocolMcpProviderSkeletonBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `protocol_mcp_provider_skeleton_boundary_${check}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectProtocolMcpProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolMcpProviderSkeletonBoundaryAudit(input);
  console.log(formatProtocolMcpProviderSkeletonBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}
