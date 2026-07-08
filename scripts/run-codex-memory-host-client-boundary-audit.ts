#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const MEMORY_HOST_CLIENT_SOURCE =
  "packages/codex-memory-host-client/src/index.ts";
const MEMORY_ADAPTER_SOURCE = "packages/codex-memory-adapter/src/index.ts";
const MEMORY_HOST_CLIENT_TEST = "tests/codex-memory-host-client.test.ts";

const REQUIRED_HOST_CLIENT_SOURCE_MARKERS = [
  "export interface CodexMemoryHostOperations",
  "record_memory(input: CodexMemoryWriteInput)",
  "search_memory(input: CodexMemorySearchInput)",
  "memory_overview?(input?: CodexMemoryOverviewInput)",
  "export class CodexMemoryHostClient",
  "const response = await this.operations.record_memory(input)",
  "const response = await this.operations.search_memory(input)",
  "throw new Error(\"codex_memory_host_client_memory_overview_unavailable\")",
  "createCodexMemoryHostClient",
  "createCodexMemoryAdapterFromHost",
  "createMcpToolStyleCodexMemoryOperations"
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
  "CodexMemoryHostClient maps record_memory and search_memory operations",
  "CodexMemoryHostClient exposes memoryOverview when the host supports it",
  "createCodexMemoryAdapterFromHost wires a real host client into CodexMemoryAdapter",
  "createMcpToolStyleCodexMemoryOperations adapts direct tool functions",
  "codex-memory-host-client keeps recording helpers out of the public surface"
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
  "fetch(",
  "writeFile("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface CodexMemoryHostClientBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  memoryHostClientSourceText: string;
  memoryAdapterSourceText: string;
  memoryHostClientTestText: string;
}

export interface CodexMemoryHostClientBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    hostClientMarkersRecorded: boolean;
    adapterMarkersRecorded: boolean;
    regressionCoverageRecorded: boolean;
    noDefaultRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    codexMemoryHostClientMode: "explicit_injected_memory_operations_only";
    memoryOperationCallsAreHostExecutorAuthorization: false;
    recordMemoryIsWorkspaceWriteExecution: false;
    searchMemoryIsSubAgentRuntimeInvocation: false;
    memoryOverviewIsRuntimeAuthorization: false;
    adapterCheckpointWriteIsExecutionAuthorization: false;
    mcpToolStyleAdapterIsDefaultHostLookup: false;
    defaultRealHostExecutionAllowed: false;
    defaultHostExecutorLookupAllowed: false;
    defaultCodexCliInvocationAllowed: false;
    providerExecuteAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowedByDefault: false;
    workspaceWriteAllowedByDefault: false;
    externalWriteAllowed: false;
    memoryHostClientCallsDuringAudit: 0;
    memoryOperationCallsDuringAudit: 0;
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

export type CodexMemoryHostClientBoundaryAuditOutputFormat = "text" | "json";

export async function collectCodexMemoryHostClientBoundaryAuditInput(
  cwd = process.cwd()
): Promise<CodexMemoryHostClientBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    memoryHostClientSourceText,
    memoryAdapterSourceText,
    memoryHostClientTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, MEMORY_HOST_CLIENT_SOURCE),
    read(cwd, MEMORY_ADAPTER_SOURCE),
    read(cwd, MEMORY_HOST_CLIENT_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    memoryHostClientSourceText,
    memoryAdapterSourceText,
    memoryHostClientTestText
  };
}

export function reviewCodexMemoryHostClientBoundaryAudit(
  input: CodexMemoryHostClientBoundaryAuditInput
): CodexMemoryHostClientBoundaryAuditResult {
  const combinedSourceText = [
    input.memoryHostClientSourceText,
    input.memoryAdapterSourceText
  ].join("\n");
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit codex-memory-host-client-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "codex-memory-host-client-boundary"
    ),
    hostClientMarkersRecorded: REQUIRED_HOST_CLIENT_SOURCE_MARKERS.every(
      (marker) => input.memoryHostClientSourceText.includes(marker)
    ),
    adapterMarkersRecorded: REQUIRED_ADAPTER_SOURCE_MARKERS.every((marker) =>
      input.memoryAdapterSourceText.includes(marker)
    ),
    regressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.memoryHostClientTestText.includes(marker)
    ),
    noDefaultRuntimeInvocationSurface: FORBIDDEN_SOURCE_MARKERS.every(
      (marker) => !combinedSourceText.includes(marker)
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      codexMemoryHostClientMode: "explicit_injected_memory_operations_only",
      memoryOperationCallsAreHostExecutorAuthorization: false,
      recordMemoryIsWorkspaceWriteExecution: false,
      searchMemoryIsSubAgentRuntimeInvocation: false,
      memoryOverviewIsRuntimeAuthorization: false,
      adapterCheckpointWriteIsExecutionAuthorization: false,
      mcpToolStyleAdapterIsDefaultHostLookup: false,
      defaultRealHostExecutionAllowed: false,
      defaultHostExecutorLookupAllowed: false,
      defaultCodexCliInvocationAllowed: false,
      providerExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowedByDefault: false,
      workspaceWriteAllowedByDefault: false,
      externalWriteAllowed: false,
      memoryHostClientCallsDuringAudit: 0,
      memoryOperationCallsDuringAudit: 0,
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

export function formatCodexMemoryHostClientBoundaryAuditResult(
  review: CodexMemoryHostClientBoundaryAuditResult,
  format: CodexMemoryHostClientBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Codex memory host client boundary audit",
    `status: ${review.status}`,
    `Codex memory host client mode: ${review.summary.codexMemoryHostClientMode}`,
    `memory operation calls are host executor authorization: ${review.summary.memoryOperationCallsAreHostExecutorAuthorization}`,
    `recordMemory is workspace-write execution: ${review.summary.recordMemoryIsWorkspaceWriteExecution}`,
    `searchMemory is sub-agent runtime invocation: ${review.summary.searchMemoryIsSubAgentRuntimeInvocation}`,
    `memoryOverview is runtime authorization: ${review.summary.memoryOverviewIsRuntimeAuthorization}`,
    `adapter checkpoint write is execution authorization: ${review.summary.adapterCheckpointWriteIsExecutionAuthorization}`,
    `MCP tool-style adapter is default host lookup: ${review.summary.mcpToolStyleAdapterIsDefaultHostLookup}`,
    `default real host execution allowed: ${review.summary.defaultRealHostExecutionAllowed}`,
    `default host executor lookup allowed: ${review.summary.defaultHostExecutorLookupAllowed}`,
    `default Codex CLI invocation allowed: ${review.summary.defaultCodexCliInvocationAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed by default: ${review.summary.shellProcessAllowedByDefault}`,
    `workspace-write allowed by default: ${review.summary.workspaceWriteAllowedByDefault}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `memory host client calls during audit: ${review.summary.memoryHostClientCallsDuringAudit}`,
    `memory operation calls during audit: ${review.summary.memoryOperationCallsDuringAudit}`,
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
  return text.includes("Codex memory host client boundary")
    && text.includes("explicit injected memory operations only")
    && text.includes("memory operation calls are not host executor authorization")
    && text.includes("recordMemory is not workspace-write execution")
    && text.includes("searchMemory is not sub-agent runtime invocation")
    && text.includes("memoryOverview is not runtime authorization")
    && text.includes("MCP tool-style adapter is not default host lookup");
}

function outputSanitized(input: CodexMemoryHostClientBoundaryAuditInput): boolean {
  const output = formatCodexMemoryHostClientBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      hostClientMarkersRecorded: true,
      adapterMarkersRecorded: true,
      regressionCoverageRecorded: true,
      noDefaultRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      codexMemoryHostClientMode: "explicit_injected_memory_operations_only",
      memoryOperationCallsAreHostExecutorAuthorization: false,
      recordMemoryIsWorkspaceWriteExecution: false,
      searchMemoryIsSubAgentRuntimeInvocation: false,
      memoryOverviewIsRuntimeAuthorization: false,
      adapterCheckpointWriteIsExecutionAuthorization: false,
      mcpToolStyleAdapterIsDefaultHostLookup: false,
      defaultRealHostExecutionAllowed: false,
      defaultHostExecutorLookupAllowed: false,
      defaultCodexCliInvocationAllowed: false,
      providerExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowedByDefault: false,
      workspaceWriteAllowedByDefault: false,
      externalWriteAllowed: false,
      memoryHostClientCallsDuringAudit: 0,
      memoryOperationCallsDuringAudit: 0,
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
  const aggregateText = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    input.memoryHostClientSourceText,
    input.memoryAdapterSourceText,
    input.memoryHostClientTestText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: CodexMemoryHostClientBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `codex_memory_host_client_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectCodexMemoryHostClientBoundaryAuditInput();
  const review = reviewCodexMemoryHostClientBoundaryAudit(input);
  console.log(formatCodexMemoryHostClientBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Codex memory host client boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
