#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const APP_SERVER_SOURCE = "packages/agent-os-app-server/src/index.ts";
const APP_SERVER_TEST = "tests/agent-os-app-server.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "AgentOsAppServerMethodSchema",
  "HandleAgentOsAppServerRequestInput = Omit<",
  "Capability grants and approvals belong in these trusted server-side options",
  "never in the client-controlled request envelope",
  "routeAgentOsAppServerRequest",
  "routeAgentOsAppServerRequestSafely",
  "handleAgentOsAppServerRequestAsync",
  "createAgentOsMcpLocalRuntime",
  "publicSurface: \"app_server\"",
  "runtime.handleToolCall(call)",
  "runtime.handleToolCallAsync(call)",
  "/agent-os/workspace-write/dispatch",
  "agentos.dispatch_workspace_write",
  "liveHttpServerStarted: false",
  "networkAccessed: false",
  "realProviderExecutionInvoked: false",
  "AGENT_OS_APP_SERVER_INVALID_METHOD",
  "AGENT_OS_APP_SERVER_INVALID_PATH",
  "AGENT_OS_APP_SERVER_INVALID_REQUEST",
  "AGENT_OS_RUNTIME_INVALID_CURSOR_PREFIXES",
  "statusCodeForRuntimeResult",
  "createBadRequestResponse",
  "parseBodyRecord",
  "queryToInput"
] as const;

const REQUIRED_TEST_MARKERS = [
  "Agent OS App Server router maps HTTP-like routes to governed tool calls",
  "Agent OS App Server wrapper delegates controlled workspace-write dispatch asynchronously without network",
  "Agent OS App Server wrapper prepares controlled workspace-write dispatch asynchronously without network",
  "Agent OS App Server wrapper blocks mutating requests by default",
  "Agent OS App Server wrapper ignores client-supplied gate fields",
  "Agent OS App Server wrapper returns audited bad requests for invalid client input",
  "Agent OS App Server wrapper converts invalid cursors into audited bad requests",
  "Agent OS App Server wrapper creates local run and provider plan without network",
  "Agent OS App Server wrapper issues an approval permit without network",
  "Agent OS App Server wrapper does not let permits expand missing capabilities",
  "Agent OS App Server wrapper keeps missing-capability candidates fail closed",
  "Agent OS App Server wrapper reports unknown local routes without starting a server"
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

export interface AgentOsAppServerBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  appServerSourceText: string;
  appServerTestText: string;
}

export interface AgentOsAppServerBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    coverageRecorded: boolean;
    noLiveServerOrRuntimeExecutionSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    agentOsAppServerMode: "http_like_request_routing_to_local_mcp_runtime_only";
    requestEnvelopeIsCapabilityGrant: false;
    routeIsLiveNetworkServer: false;
    statusCodeIsHostExecutorReceipt: false;
    clientGateFieldsAreTrusted: false;
    serverSideOptionsAreClientControlled: false;
    localRuntimeCallIsProviderExecutionAuthorization: false;
    approvalPermitIssueIsProviderExecutionAuthorization: false;
    approvalPermitConsumptionIsProviderExecutionAuthorization: false;
    controlledWorkspaceWritePrepareAllowed: true;
    controlledWorkspaceWriteDispatchAllowed: true;
    generalWorkspaceWriteExecutionAllowed: false;
    workspaceWriteProviderExecuteAllowed: false;
    liveHttpServerStarted: false;
    networkAccessed: false;
    realProviderExecutionInvoked: false;
    appServerWrapperCallsDuringAudit: 0;
    localRuntimeCallsDuringAudit: 0;
    liveHttpServerStartsDuringAudit: 0;
    networkCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    desktopPrimitiveCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentOsAppServerBoundaryAuditOutputFormat = "text" | "json";

export async function collectAgentOsAppServerBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentOsAppServerBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    appServerSourceText,
    appServerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, APP_SERVER_SOURCE),
    read(cwd, APP_SERVER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    appServerSourceText,
    appServerTestText
  };
}

export function reviewAgentOsAppServerBoundaryAudit(
  input: AgentOsAppServerBoundaryAuditInput
): AgentOsAppServerBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit agent-os-app-server-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-os-app-server-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.appServerSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.appServerTestText.includes(marker)
    ),
    noLiveServerOrRuntimeExecutionSurface:
      noLiveServerOrRuntimeExecutionSurface(input.appServerSourceText),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      agentOsAppServerMode: "http_like_request_routing_to_local_mcp_runtime_only",
      requestEnvelopeIsCapabilityGrant: false,
      routeIsLiveNetworkServer: false,
      statusCodeIsHostExecutorReceipt: false,
      clientGateFieldsAreTrusted: false,
      serverSideOptionsAreClientControlled: false,
      localRuntimeCallIsProviderExecutionAuthorization: false,
      approvalPermitIssueIsProviderExecutionAuthorization: false,
      approvalPermitConsumptionIsProviderExecutionAuthorization: false,
      controlledWorkspaceWritePrepareAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      liveHttpServerStarted: false,
      networkAccessed: false,
      realProviderExecutionInvoked: false,
      appServerWrapperCallsDuringAudit: 0,
      localRuntimeCallsDuringAudit: 0,
      liveHttpServerStartsDuringAudit: 0,
      networkCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
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

export function formatAgentOsAppServerBoundaryAuditResult(
  review: AgentOsAppServerBoundaryAuditResult,
  format: AgentOsAppServerBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent OS app-server boundary audit",
    `status: ${review.status}`,
    `Agent OS app-server mode: ${review.summary.agentOsAppServerMode}`,
    `request envelope is capability grant: ${review.summary.requestEnvelopeIsCapabilityGrant}`,
    `route is live network server: ${review.summary.routeIsLiveNetworkServer}`,
    `status code is host executor receipt: ${review.summary.statusCodeIsHostExecutorReceipt}`,
    `client gate fields are trusted: ${review.summary.clientGateFieldsAreTrusted}`,
    `server-side options are client controlled: ${review.summary.serverSideOptionsAreClientControlled}`,
    `local runtime call is provider execution authorization: ${review.summary.localRuntimeCallIsProviderExecutionAuthorization}`,
    `approval permit issue is provider execution authorization: ${review.summary.approvalPermitIssueIsProviderExecutionAuthorization}`,
    `approval permit consumption is provider execution authorization: ${review.summary.approvalPermitConsumptionIsProviderExecutionAuthorization}`,
    `controlled workspace-write prepare allowed: ${review.summary.controlledWorkspaceWritePrepareAllowed}`,
    `controlled workspace-write dispatch allowed: ${review.summary.controlledWorkspaceWriteDispatchAllowed}`,
    `general workspace-write execution allowed: ${review.summary.generalWorkspaceWriteExecutionAllowed}`,
    `workspace-write provider.execute allowed: ${review.summary.workspaceWriteProviderExecuteAllowed}`,
    `live HTTP server started: ${review.summary.liveHttpServerStarted}`,
    `network accessed: ${review.summary.networkAccessed}`,
    `real provider execution invoked: ${review.summary.realProviderExecutionInvoked}`,
    `app-server wrapper calls during audit: ${review.summary.appServerWrapperCallsDuringAudit}`,
    `local runtime calls during audit: ${review.summary.localRuntimeCallsDuringAudit}`,
    `live HTTP server starts during audit: ${review.summary.liveHttpServerStartsDuringAudit}`,
    `network calls during audit: ${review.summary.networkCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `desktop primitive calls during audit: ${review.summary.desktopPrimitiveCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
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
  return text.includes("Agent OS app-server wrapper boundary")
    && text.includes("HTTP-like request routing to local MCP runtime only")
    && text.includes("HTTP-like routes are not live network servers")
    && text.includes("request envelopes are not capability grants")
    && text.includes("client-supplied gate fields remain ignored")
    && text.includes("status codes are not host executor receipts")
    && text.includes("approval permit issue and consumption are not provider execution")
    && text.includes("controlled workspace-write dispatch")
    && text.includes("workspace-write through `provider.execute`")
    && text.includes("live HTTP servers remain unimplemented")
    && text.includes("network access remains absent")
    && text.includes("real provider execution remains uninvoked");
}

function noLiveServerOrRuntimeExecutionSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: AgentOsAppServerBoundaryAuditInput): boolean {
  const output = formatAgentOsAppServerBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      coverageRecorded: true,
      noLiveServerOrRuntimeExecutionSurface: true,
      outputSanitized: true
    },
    summary: {
      agentOsAppServerMode: "http_like_request_routing_to_local_mcp_runtime_only",
      requestEnvelopeIsCapabilityGrant: false,
      routeIsLiveNetworkServer: false,
      statusCodeIsHostExecutorReceipt: false,
      clientGateFieldsAreTrusted: false,
      serverSideOptionsAreClientControlled: false,
      localRuntimeCallIsProviderExecutionAuthorization: false,
      approvalPermitIssueIsProviderExecutionAuthorization: false,
      approvalPermitConsumptionIsProviderExecutionAuthorization: false,
      controlledWorkspaceWritePrepareAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      liveHttpServerStarted: false,
      networkAccessed: false,
      realProviderExecutionInvoked: false,
      appServerWrapperCallsDuringAudit: 0,
      localRuntimeCallsDuringAudit: 0,
      liveHttpServerStartsDuringAudit: 0,
      networkCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });
  const scannedText = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    input.appServerSourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !scannedText.includes(marker));
}

function collectReasons(
  checks: AgentOsAppServerBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `agent_os_app_server_boundary_${check}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAgentOsAppServerBoundaryAuditInput();
  const review = reviewAgentOsAppServerBoundaryAudit(input);
  console.log(formatAgentOsAppServerBoundaryAuditResult(review, format));
  process.exitCode = review.status === "passed" ? 0 : 1;
}
