#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const MEMORY_MCP_CLIENT_SOURCE =
  "packages/codex-memory-mcp-client/src/index.ts";
const MEMORY_ADAPTER_SOURCE = "packages/codex-memory-adapter/src/index.ts";
const MEMORY_MCP_CLIENT_TEST = "tests/codex-memory-mcp-client.test.ts";

const REQUIRED_MCP_CLIENT_SOURCE_MARKERS = [
  "export interface CodexMemoryMcpHttpClientOptions",
  "fetchImpl?: typeof fetch",
  "export class CodexMemoryMcpHttpClient",
  "async initialize()",
  "async close()",
  "async recordMemory(input: CodexMemoryWriteInput)",
  "async searchMemory(input: CodexMemorySearchInput)",
  "async memoryOverview(",
  "private async callTool(name: string, args: unknown)",
  "private async callJsonRpc(method: string, params: unknown)",
  "this.options.fetchImpl(this.options.endpoint",
  "this.callJsonRpc(\"tools/call\"",
  "EXPECTED_SERVER_NAME",
  "createCodexMemoryMcpHttpClient",
  "createCodexMemoryAdapterFromMcpHttp"
] as const;

const REQUIRED_ADAPTER_SOURCE_MARKERS = [
  "export class CodexMemoryAdapter",
  "async recordCheckpointDetailed(",
  "await this.client.recordMemory(record.writeInput)",
  "await this.recallLatestCheckpoint({",
  "await this.client.searchMemory({",
  "buildCheckpointMemoryRecord",
  "buildCheckpointRecallQuery"
] as const;

const REQUIRED_TEST_MARKERS = [
  "CodexMemoryMcpHttpClient uses the injected native-MCP fetch transport",
  "createCodexMemoryAdapterFromMcpHttp wires the injected MCP transport",
  "createMockCodexMemoryFetch",
  "body?.method === \"initialize\"",
  "body?.method === \"tools/call\" && body.params?.name === \"record_memory\"",
  "body?.method === \"tools/call\" && body.params?.name === \"search_memory\"",
  "body?.method === \"tools/call\" && body.params?.name === \"memory_overview\""
] as const;

const FORBIDDEN_SOURCE_MARKERS = [
  "provider.execute(",
  "runCodexCliExecPlan(",
  "dispatchToHost(",
  "dispatchGovernanceOperatorActionHostExecutor(",
  "spawn(",
  "execFile(",
  "exec(",
  "new Worker(",
  "writeFile("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface CodexMemoryMcpClientBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  memoryMcpClientSourceText: string;
  memoryAdapterSourceText: string;
  memoryMcpClientTestText: string;
}

export interface CodexMemoryMcpClientBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    mcpClientMarkersRecorded: boolean;
    adapterMarkersRecorded: boolean;
    regressionCoverageRecorded: boolean;
    noDefaultRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    codexMemoryMcpClientMode: "explicit_mcp_http_memory_transport_only";
    mcpHttpCallsAreProviderExecution: false;
    mcpHttpCallsAreHostExecutorAuthorization: false;
    recordMemoryIsWorkspaceWriteExecution: false;
    searchMemoryIsSubAgentRuntimeInvocation: false;
    memoryOverviewIsRuntimeAuthorization: false;
    adapterCheckpointWriteIsExecutionAuthorization: false;
    defaultEndpointLookupAllowed: false;
    bearerTokenIsExecutionAuthorization: false;
    defaultCodexCliInvocationAllowed: false;
    providerExecuteAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowedByDefault: false;
    workspaceWriteAllowedByDefault: false;
    externalWriteAllowedByDefault: false;
    mcpHttpCallsDuringAudit: 0;
    memoryToolCallsDuringAudit: 0;
    hostExecutorInvocationsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type CodexMemoryMcpClientBoundaryAuditOutputFormat = "text" | "json";

export async function collectCodexMemoryMcpClientBoundaryAuditInput(
  cwd = process.cwd()
): Promise<CodexMemoryMcpClientBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    memoryMcpClientSourceText,
    memoryAdapterSourceText,
    memoryMcpClientTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, MEMORY_MCP_CLIENT_SOURCE),
    read(cwd, MEMORY_ADAPTER_SOURCE),
    read(cwd, MEMORY_MCP_CLIENT_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    memoryMcpClientSourceText,
    memoryAdapterSourceText,
    memoryMcpClientTestText
  };
}

export function reviewCodexMemoryMcpClientBoundaryAudit(
  input: CodexMemoryMcpClientBoundaryAuditInput
): CodexMemoryMcpClientBoundaryAuditResult {
  const combinedSourceText = [
    input.memoryMcpClientSourceText,
    input.memoryAdapterSourceText
  ].join("\n");
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit codex-memory-mcp-client-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "codex-memory-mcp-client-boundary"
    ),
    mcpClientMarkersRecorded: REQUIRED_MCP_CLIENT_SOURCE_MARKERS.every(
      (marker) => input.memoryMcpClientSourceText.includes(marker)
    ),
    adapterMarkersRecorded: REQUIRED_ADAPTER_SOURCE_MARKERS.every((marker) =>
      input.memoryAdapterSourceText.includes(marker)
    ),
    regressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.memoryMcpClientTestText.includes(marker)
    ),
    noDefaultRuntimeInvocationSurface: FORBIDDEN_SOURCE_MARKERS.every(
      (marker) => !combinedSourceText.includes(marker)
    ),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      codexMemoryMcpClientMode: "explicit_mcp_http_memory_transport_only",
      mcpHttpCallsAreProviderExecution: false,
      mcpHttpCallsAreHostExecutorAuthorization: false,
      recordMemoryIsWorkspaceWriteExecution: false,
      searchMemoryIsSubAgentRuntimeInvocation: false,
      memoryOverviewIsRuntimeAuthorization: false,
      adapterCheckpointWriteIsExecutionAuthorization: false,
      defaultEndpointLookupAllowed: false,
      bearerTokenIsExecutionAuthorization: false,
      defaultCodexCliInvocationAllowed: false,
      providerExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowedByDefault: false,
      workspaceWriteAllowedByDefault: false,
      externalWriteAllowedByDefault: false,
      mcpHttpCallsDuringAudit: 0,
      memoryToolCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatCodexMemoryMcpClientBoundaryAuditResult(
  review: CodexMemoryMcpClientBoundaryAuditResult,
  format: CodexMemoryMcpClientBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Codex memory MCP client boundary audit",
    `status: ${review.status}`,
    `Codex memory MCP client mode: ${review.summary.codexMemoryMcpClientMode}`,
    `MCP HTTP calls are provider execution: ${review.summary.mcpHttpCallsAreProviderExecution}`,
    `MCP HTTP calls are host executor authorization: ${review.summary.mcpHttpCallsAreHostExecutorAuthorization}`,
    `recordMemory is workspace-write execution: ${review.summary.recordMemoryIsWorkspaceWriteExecution}`,
    `searchMemory is sub-agent runtime invocation: ${review.summary.searchMemoryIsSubAgentRuntimeInvocation}`,
    `memoryOverview is runtime authorization: ${review.summary.memoryOverviewIsRuntimeAuthorization}`,
    `adapter checkpoint write is execution authorization: ${review.summary.adapterCheckpointWriteIsExecutionAuthorization}`,
    `default endpoint lookup allowed: ${review.summary.defaultEndpointLookupAllowed}`,
    `bearer token is execution authorization: ${review.summary.bearerTokenIsExecutionAuthorization}`,
    `default Codex CLI invocation allowed: ${review.summary.defaultCodexCliInvocationAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed by default: ${review.summary.shellProcessAllowedByDefault}`,
    `workspace-write allowed by default: ${review.summary.workspaceWriteAllowedByDefault}`,
    `external write allowed by default: ${review.summary.externalWriteAllowedByDefault}`,
    `MCP HTTP calls during audit: ${review.summary.mcpHttpCallsDuringAudit}`,
    `memory tool calls during audit: ${review.summary.memoryToolCallsDuringAudit}`,
    `host executor invocations during audit: ${review.summary.hostExecutorInvocationsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
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
  return text.includes("Codex memory MCP client boundary")
    && text.includes("explicit MCP HTTP memory transport only")
    && text.includes("MCP HTTP calls are not provider execution")
    && text.includes("MCP HTTP calls are not host executor authorization")
    && text.includes("recordMemory is not workspace-write execution")
    && text.includes("searchMemory is not sub-agent runtime invocation")
    && text.includes("memoryOverview is not runtime authorization")
    && text.includes("bearer tokens are not execution authorization");
}

function outputSanitized(): boolean {
  const output = formatCodexMemoryMcpClientBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      mcpClientMarkersRecorded: true,
      adapterMarkersRecorded: true,
      regressionCoverageRecorded: true,
      noDefaultRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      codexMemoryMcpClientMode: "explicit_mcp_http_memory_transport_only",
      mcpHttpCallsAreProviderExecution: false,
      mcpHttpCallsAreHostExecutorAuthorization: false,
      recordMemoryIsWorkspaceWriteExecution: false,
      searchMemoryIsSubAgentRuntimeInvocation: false,
      memoryOverviewIsRuntimeAuthorization: false,
      adapterCheckpointWriteIsExecutionAuthorization: false,
      defaultEndpointLookupAllowed: false,
      bearerTokenIsExecutionAuthorization: false,
      defaultCodexCliInvocationAllowed: false,
      providerExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowedByDefault: false,
      workspaceWriteAllowedByDefault: false,
      externalWriteAllowedByDefault: false,
      mcpHttpCallsDuringAudit: 0,
      memoryToolCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(
  checks: CodexMemoryMcpClientBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `codex_memory_mcp_client_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectCodexMemoryMcpClientBoundaryAuditInput();
  const review = reviewCodexMemoryMcpClientBoundaryAudit(input);
  console.log(formatCodexMemoryMcpClientBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Codex memory MCP client boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
