#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const SDK_SOURCE = "packages/agent-os-sdk/src/index.ts";
const SDK_TEST = "tests/agent-os-sdk.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "AgentOsSdkCallOptions",
  "AgentOsSdkOperation",
  "AgentOsSdkResult",
  "createAgentOsMcpLocalRuntime",
  "publicSurface: \"sdk\"",
  "createTask(",
  "approveRun(",
  "dispatchWorkspaceWrite(",
  "AgentOsDispatchWorkspaceWritePrepareInput",
  "callTool(",
  "this.runtime.handleToolCall(call)",
  "this.runtime.handleToolCallAsync(call)",
  "createRuntimeCall(toolName, input, options)",
  "call.grantedCapabilities = options.grantedCapabilities",
  "call.approvedMutatingTools = options.approvedMutatingTools",
  "call.allowLocalMutations = options.allowLocalMutations",
  "call.preferredProviderId = options.preferredProviderId",
  "operationForToolName"
] as const;

const REQUIRED_TEST_MARKERS = [
  "Agent OS SDK blocks mutating task creation by default",
  "Agent OS SDK creates a local run and provider plan without real execution",
  "Agent OS SDK delegates controlled workspace-write dispatch through async wrapper",
  "Agent OS SDK prepares workspace-write dispatch through typed input",
  "Agent OS SDK issues an approval permit through the shared local runtime",
  "Agent OS SDK consumes approval permits through the shared local runtime",
  "Agent OS SDK preserves rejected permit audit during approval consumption",
  "Agent OS SDK default approval permit IDs are unique for repeated approvals",
  "realProviderExecutionInvoked, false",
  "preferredProviderId: \"codex-cli\""
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
  "Bearer ",
  "raw-token"
] as const;

export interface AgentOsSdkBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  sdkSourceText: string;
  sdkTestText: string;
}

export interface AgentOsSdkBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeExecutionSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    agentOsSdkMode: "sdk_method_to_local_mcp_runtime_only";
    sdkCallIsProviderExecutionAuthorization: false;
    sdkGrantInputIsCapabilityGrant: false;
    sdkApproveToolInputIsToolRuntimeAuthorization: false;
    sdkAllowLocalMutationIsWorkspaceWriteExecution: false;
    preferredProviderIsCodexCliInvocation: false;
    localRuntimeCallIsProviderExecutionAuthorization: false;
    controlledWorkspaceWritePrepareAllowed: true;
    controlledWorkspaceWriteDispatchAllowed: true;
    generalWorkspaceWriteExecutionAllowed: false;
    workspaceWriteProviderExecuteAllowed: false;
    approvalPermitIssueIsProviderExecutionAuthorization: false;
    approvalPermitConsumptionIsProviderExecutionAuthorization: false;
    realProviderExecutionInvoked: false;
    sdkCallsDuringAudit: 0;
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

export type AgentOsSdkBoundaryAuditOutputFormat = "text" | "json";

export async function collectAgentOsSdkBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentOsSdkBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    sdkSourceText,
    sdkTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, SDK_SOURCE),
    read(cwd, SDK_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    sdkSourceText,
    sdkTestText
  };
}

export function reviewAgentOsSdkBoundaryAudit(
  input: AgentOsSdkBoundaryAuditInput
): AgentOsSdkBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit agent-os-sdk-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-os-sdk-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.sdkSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.sdkTestText.includes(marker)
    ),
    noRuntimeExecutionSurface:
      noRuntimeExecutionSurface(input.sdkSourceText),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      agentOsSdkMode: "sdk_method_to_local_mcp_runtime_only",
      sdkCallIsProviderExecutionAuthorization: false,
      sdkGrantInputIsCapabilityGrant: false,
      sdkApproveToolInputIsToolRuntimeAuthorization: false,
      sdkAllowLocalMutationIsWorkspaceWriteExecution: false,
      preferredProviderIsCodexCliInvocation: false,
      localRuntimeCallIsProviderExecutionAuthorization: false,
      controlledWorkspaceWritePrepareAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      approvalPermitIssueIsProviderExecutionAuthorization: false,
      approvalPermitConsumptionIsProviderExecutionAuthorization: false,
      realProviderExecutionInvoked: false,
      sdkCallsDuringAudit: 0,
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

export function formatAgentOsSdkBoundaryAuditResult(
  review: AgentOsSdkBoundaryAuditResult,
  format: AgentOsSdkBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent OS SDK boundary audit",
    `status: ${review.status}`,
    `Agent OS SDK mode: ${review.summary.agentOsSdkMode}`,
    `SDK call is provider execution authorization: ${review.summary.sdkCallIsProviderExecutionAuthorization}`,
    `SDK grant input is capability grant: ${review.summary.sdkGrantInputIsCapabilityGrant}`,
    `SDK approve-tool input is tool runtime authorization: ${review.summary.sdkApproveToolInputIsToolRuntimeAuthorization}`,
    `SDK allow-local-mutation is workspace-write execution: ${review.summary.sdkAllowLocalMutationIsWorkspaceWriteExecution}`,
    `preferred provider is Codex CLI invocation: ${review.summary.preferredProviderIsCodexCliInvocation}`,
    `local runtime call is provider execution authorization: ${review.summary.localRuntimeCallIsProviderExecutionAuthorization}`,
    `controlled workspace-write prepare allowed: ${review.summary.controlledWorkspaceWritePrepareAllowed}`,
    `controlled workspace-write dispatch allowed: ${review.summary.controlledWorkspaceWriteDispatchAllowed}`,
    `general workspace-write execution allowed: ${review.summary.generalWorkspaceWriteExecutionAllowed}`,
    `workspace-write provider execute allowed: ${review.summary.workspaceWriteProviderExecuteAllowed}`,
    `approval permit issue is provider execution authorization: ${review.summary.approvalPermitIssueIsProviderExecutionAuthorization}`,
    `approval permit consumption is provider execution authorization: ${review.summary.approvalPermitConsumptionIsProviderExecutionAuthorization}`,
    `real provider execution invoked: ${review.summary.realProviderExecutionInvoked}`,
    `SDK calls during audit: ${review.summary.sdkCallsDuringAudit}`,
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
  return text.includes("Agent OS SDK boundary")
    && text.includes("SDK method calls to local MCP runtime only")
    && text.includes("SDK call options are not capability grants")
    && text.includes("approved mutating tools are not tool runtime authorization")
    && text.includes("allow-local-mutation is not workspace-write execution")
    && text.includes("preferred provider is not Codex CLI invocation")
    && text.includes("local runtime calls are not provider execution authorization")
    && text.includes("may delegate controlled workspace-write provider plans")
    && text.includes("general workspace-write remains blocked")
    && text.includes("approval permit issue and consumption are not provider execution")
    && text.includes("real provider execution remains uninvoked");
}

function noRuntimeExecutionSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: AgentOsSdkBoundaryAuditInput): boolean {
  const output = formatAgentOsSdkBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeExecutionSurface: true,
      outputSanitized: true
    },
    summary: {
      agentOsSdkMode: "sdk_method_to_local_mcp_runtime_only",
      sdkCallIsProviderExecutionAuthorization: false,
      sdkGrantInputIsCapabilityGrant: false,
      sdkApproveToolInputIsToolRuntimeAuthorization: false,
      sdkAllowLocalMutationIsWorkspaceWriteExecution: false,
      preferredProviderIsCodexCliInvocation: false,
      localRuntimeCallIsProviderExecutionAuthorization: false,
      controlledWorkspaceWritePrepareAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      approvalPermitIssueIsProviderExecutionAuthorization: false,
      approvalPermitConsumptionIsProviderExecutionAuthorization: false,
      realProviderExecutionInvoked: false,
      sdkCallsDuringAudit: 0,
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
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !scannedText.includes(marker));
}

function collectReasons(
  checks: AgentOsSdkBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `agent_os_sdk_boundary_${check}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAgentOsSdkBoundaryAuditInput();
  const review = reviewAgentOsSdkBoundaryAudit(input);
  console.log(formatAgentOsSdkBoundaryAuditResult(review, format));
  process.exitCode = review.status === "passed" ? 0 : 1;
}
