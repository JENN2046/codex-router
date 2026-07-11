#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const SDK_SOURCE = "packages/agent-os-sdk/src/index.ts";
const CLI_SOURCE = "packages/agent-os-cli/src/index.ts";
const APP_SERVER_SOURCE = "packages/agent-os-app-server/src/index.ts";
const SDK_TEST = "tests/agent-os-sdk.test.ts";
const CLI_TEST = "tests/agent-os-cli.test.ts";
const APP_SERVER_TEST = "tests/agent-os-app-server.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "publicSurface: \"sdk\"",
  "publicSurface: \"cli\"",
  "publicSurface: \"app_server\"",
  "createAgentOsMcpLocalRuntime",
  "this.runtime.handleToolCall(call)",
  "this.runtime.handleToolCallAsync(call)",
  "runtime.handleToolCall(call)",
  "runtime.handleToolCallAsync(call)",
  "dispatchWorkspaceWrite",
  "dispatch-workspace-write",
  "--prepare-json",
  "/agent-os/workspace-write/dispatch",
  "agentos.dispatch_workspace_write",
  "sanitizeAgentOsCliArgv",
  "approvedMutatingTools",
  "allowLocalMutations",
  "preferredProviderId",
  "Capability grants and approvals belong in these trusted server-side options",
  "never in the client-controlled request envelope",
  "liveHttpServerStarted: false",
  "networkAccessed: false",
  "realProviderExecutionInvoked: false"
] as const;

const REQUIRED_TEST_MARKERS = [
  "Agent OS SDK blocks mutating task creation by default",
  "Agent OS SDK creates a local run and provider plan without real execution",
  "Agent OS SDK delegates controlled workspace-write dispatch through async wrapper",
  "Agent OS SDK prepares workspace-write dispatch through typed input",
  "Agent OS CLI parser maps create-task argv to a governed tool call",
  "Agent OS CLI wrapper creates a local run and provider plan without spawning CLI",
  "Agent OS CLI wrapper delegates controlled workspace-write dispatch asynchronously",
  "Agent OS CLI wrapper prepares controlled workspace-write dispatch asynchronously",
  "Agent OS CLI wrapper blocks local mutation by default",
  "Agent OS App Server router maps HTTP-like routes to governed tool calls",
  "Agent OS App Server wrapper delegates controlled workspace-write dispatch asynchronously without network",
  "Agent OS App Server wrapper prepares controlled workspace-write dispatch asynchronously without network",
  "Agent OS App Server wrapper ignores client-supplied gate fields",
  "Agent OS App Server wrapper blocks mutating requests by default"
] as const;

const FORBIDDEN_DIRECT_EXECUTION_SOURCE_MARKERS = [
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

export interface AgentOsPublicSurfacesBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  sdkSourceText: string;
  cliSourceText: string;
  appServerSourceText: string;
  sdkTestText: string;
  cliTestText: string;
  appServerTestText: string;
}

export interface AgentOsPublicSurfacesBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    coverageRecorded: boolean;
    noDirectExecutionSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    agentOsPublicSurfacesMode: "public_surface_to_local_mcp_runtime_only";
    sdkCallIsProviderExecutionAuthorization: false;
    cliGrantFlagIsProviderExecutionAuthorization: false;
    cliApproveToolFlagIsToolRuntimeAuthorization: false;
    cliAllowLocalMutationIsWorkspaceWriteExecution: false;
    preferredProviderIsCodexCliInvocation: false;
    appServerRequestEnvelopeIsCapabilityGrant: false;
    appServerRouteIsNetworkServer: false;
    appServerStatusCodeIsExecutionReceipt: false;
    approvalPermitIssueIsProviderExecutionAuthorization: false;
    controlledWorkspaceWritePrepareAllowed: true;
    controlledWorkspaceWriteDispatchAllowed: true;
    generalWorkspaceWriteExecutionAllowed: false;
    workspaceWriteProviderExecuteAllowed: false;
    agentOsPublicSurfaceCallsDuringAudit: 0;
    localRuntimeCallsDuringAudit: 0;
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

export type AgentOsPublicSurfacesBoundaryAuditOutputFormat = "text" | "json";

export async function collectAgentOsPublicSurfacesBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentOsPublicSurfacesBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    sdkSourceText,
    cliSourceText,
    appServerSourceText,
    sdkTestText,
    cliTestText,
    appServerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, SDK_SOURCE),
    read(cwd, CLI_SOURCE),
    read(cwd, APP_SERVER_SOURCE),
    read(cwd, SDK_TEST),
    read(cwd, CLI_TEST),
    read(cwd, APP_SERVER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    sdkSourceText,
    cliSourceText,
    appServerSourceText,
    sdkTestText,
    cliTestText,
    appServerTestText
  };
}

export function reviewAgentOsPublicSurfacesBoundaryAudit(
  input: AgentOsPublicSurfacesBoundaryAuditInput
): AgentOsPublicSurfacesBoundaryAuditResult {
  const sourceText = [
    input.sdkSourceText,
    input.cliSourceText,
    input.appServerSourceText
  ].join("\n");
  const testText = [
    input.sdkTestText,
    input.cliTestText,
    input.appServerTestText
  ].join("\n");
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit agent-os-public-surfaces-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-os-public-surfaces-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      sourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      testText.includes(marker)
    ),
    noDirectExecutionSurface: noDirectExecutionSurface(sourceText),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      agentOsPublicSurfacesMode: "public_surface_to_local_mcp_runtime_only",
      sdkCallIsProviderExecutionAuthorization: false,
      cliGrantFlagIsProviderExecutionAuthorization: false,
      cliApproveToolFlagIsToolRuntimeAuthorization: false,
      cliAllowLocalMutationIsWorkspaceWriteExecution: false,
      preferredProviderIsCodexCliInvocation: false,
      appServerRequestEnvelopeIsCapabilityGrant: false,
      appServerRouteIsNetworkServer: false,
      appServerStatusCodeIsExecutionReceipt: false,
      approvalPermitIssueIsProviderExecutionAuthorization: false,
      controlledWorkspaceWritePrepareAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      agentOsPublicSurfaceCallsDuringAudit: 0,
      localRuntimeCallsDuringAudit: 0,
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

export function formatAgentOsPublicSurfacesBoundaryAuditResult(
  review: AgentOsPublicSurfacesBoundaryAuditResult,
  format: AgentOsPublicSurfacesBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent OS public surfaces boundary audit",
    `status: ${review.status}`,
    `agent OS public surfaces mode: ${review.summary.agentOsPublicSurfacesMode}`,
    `SDK call is provider execution authorization: ${review.summary.sdkCallIsProviderExecutionAuthorization}`,
    `CLI grant flag is provider execution authorization: ${review.summary.cliGrantFlagIsProviderExecutionAuthorization}`,
    `CLI approve-tool flag is tool runtime authorization: ${review.summary.cliApproveToolFlagIsToolRuntimeAuthorization}`,
    `CLI allow-local-mutation is workspace-write execution: ${review.summary.cliAllowLocalMutationIsWorkspaceWriteExecution}`,
    `preferred provider is Codex CLI invocation: ${review.summary.preferredProviderIsCodexCliInvocation}`,
    `app server request envelope is capability grant: ${review.summary.appServerRequestEnvelopeIsCapabilityGrant}`,
    `app server route is network server: ${review.summary.appServerRouteIsNetworkServer}`,
    `app server status code is execution receipt: ${review.summary.appServerStatusCodeIsExecutionReceipt}`,
    `approval permit issue is provider execution authorization: ${review.summary.approvalPermitIssueIsProviderExecutionAuthorization}`,
    `controlled workspace-write prepare allowed: ${review.summary.controlledWorkspaceWritePrepareAllowed}`,
    `controlled workspace-write dispatch allowed: ${review.summary.controlledWorkspaceWriteDispatchAllowed}`,
    `general workspace-write execution allowed: ${review.summary.generalWorkspaceWriteExecutionAllowed}`,
    `workspace-write provider.execute allowed: ${review.summary.workspaceWriteProviderExecuteAllowed}`,
    `agent OS public surface calls during audit: ${review.summary.agentOsPublicSurfaceCallsDuringAudit}`,
    `local runtime calls during audit: ${review.summary.localRuntimeCallsDuringAudit}`,
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
  return text.includes("Agent OS public surfaces boundary")
    && text.includes("public surface to local MCP runtime only")
    && text.includes("SDK calls are not provider execution authorization")
    && text.includes("CLI grant and approve-tool flags are not provider, tool runtime, Codex CLI, or sub-agent runtime authorization")
    && text.includes("allow-local-mutation is not workspace-write execution")
    && text.includes("preferred provider is not Codex CLI invocation")
    && text.includes("app-server request envelopes are not capability grants")
    && text.includes("HTTP-like routes are not live network servers")
    && text.includes("status codes are not host executor receipts")
    && text.includes("controlled workspace-write dispatch")
    && text.includes("workspace-write through `provider.execute`");
}

function noDirectExecutionSurface(text: string): boolean {
  return FORBIDDEN_DIRECT_EXECUTION_SOURCE_MARKERS.every((marker) =>
    !text.includes(marker)
  );
}

function outputSanitized(input: AgentOsPublicSurfacesBoundaryAuditInput): boolean {
  const output = formatAgentOsPublicSurfacesBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      coverageRecorded: true,
      noDirectExecutionSurface: true,
      outputSanitized: true
    },
    summary: {
      agentOsPublicSurfacesMode: "public_surface_to_local_mcp_runtime_only",
      sdkCallIsProviderExecutionAuthorization: false,
      cliGrantFlagIsProviderExecutionAuthorization: false,
      cliApproveToolFlagIsToolRuntimeAuthorization: false,
      cliAllowLocalMutationIsWorkspaceWriteExecution: false,
      preferredProviderIsCodexCliInvocation: false,
      appServerRequestEnvelopeIsCapabilityGrant: false,
      appServerRouteIsNetworkServer: false,
      appServerStatusCodeIsExecutionReceipt: false,
      approvalPermitIssueIsProviderExecutionAuthorization: false,
      controlledWorkspaceWritePrepareAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      agentOsPublicSurfaceCallsDuringAudit: 0,
      localRuntimeCallsDuringAudit: 0,
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
    input.sdkSourceText,
    input.cliSourceText,
    input.appServerSourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !scannedText.includes(marker));
}

function collectReasons(
  checks: AgentOsPublicSurfacesBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `agent_os_public_surfaces_boundary_${check}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAgentOsPublicSurfacesBoundaryAuditInput();
  const review = reviewAgentOsPublicSurfacesBoundaryAudit(input);
  console.log(formatAgentOsPublicSurfacesBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}
