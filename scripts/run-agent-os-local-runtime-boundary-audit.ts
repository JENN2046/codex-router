#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const LOCAL_RUNTIME = "packages/protocol-mcp/src/agent-os-local-runtime.ts";
const SERVER_MANIFEST = "packages/protocol-mcp/src/agent-os-server-manifest.ts";
const SDK_WRAPPER = "packages/agent-os-sdk/src/index.ts";
const CLI_WRAPPER = "packages/agent-os-cli/src/index.ts";
const APP_SERVER = "packages/agent-os-app-server/src/index.ts";
const LOCAL_RUNTIME_TEST = "tests/agent-os-mcp-local-runtime.test.ts";
const SDK_TEST = "tests/agent-os-sdk.test.ts";
const CLI_TEST = "tests/agent-os-cli.test.ts";
const APP_SERVER_TEST = "tests/agent-os-app-server.test.ts";

const REQUIRED_RUNTIME_MARKERS = [
  "export type AgentOsPublicSurface = \"mcp\" | \"cli\" | \"app_server\" | \"sdk\"",
  "AGENT_OS_MCP_LOCAL_MUTATION_DISABLED",
  "AGENT_OS_MCP_TOOL_APPROVAL_REQUIRED",
  "AGENT_OS_MCP_TOOL_CAPABILITY_MISSING",
  "allowLocalMutations",
  "approvedMutatingTools",
  "liveMcpServerConnection: false",
  "realProviderExecutionInvoked: false",
  "localMutationAttempted",
  "localMutationApplied",
  "planProviderExecution",
  "providerExecutionPlanStore.savePlan(plan)",
  "provider_execution_plan_stored",
  "evaluateExecutionEligibilityWithPermitStore",
  "createApprovalPermit",
  "handleToolCallAsync",
  "controlledWorkspaceWriteProviderDispatcher",
  "AGENT_OS_MCP_WORKSPACE_WRITE_DISPATCHER_NOT_CONFIGURED"
] as const;

const REQUIRED_SDK_MARKERS = [
  "createAgentOsMcpLocalRuntime",
  "publicSurface: \"sdk\"",
  "this.runtime.handleToolCall(call)"
] as const;

const REQUIRED_CLI_MARKERS = [
  "createAgentOsMcpLocalRuntime",
  "publicSurface: \"cli\"",
  "runtime.handleToolCall(call)",
  "sanitizeAgentOsCliArgv"
] as const;

const REQUIRED_APP_SERVER_MARKERS = [
  "createAgentOsMcpLocalRuntime",
  "publicSurface: \"app_server\"",
  "runtime.handleToolCall",
  "liveHttpServerStarted: false",
  "networkAccessed: false",
  "realProviderExecutionInvoked: false"
] as const;

const REQUIRED_MANIFEST_MARKERS = [
  "runtimeImplemented: z.literal(false)",
  "No task handler is executed by this MCP manifest",
  "This manifest only describes the future tool; no handler is implemented.",
  "approvalRequired"
] as const;

const REQUIRED_TEST_MARKERS = [
  "Agent OS MCP local runtime blocks mutating task creation by default",
  "Agent OS MCP local runtime creates a governed run and provider plan without execution",
  "Agent OS MCP local runtime consumes approval permits into a planned provider plan",
  "Agent OS MCP local runtime delegates controlled workspace-write dispatch asynchronously",
  "Agent OS MCP local runtime issues an approval permit for a planned run scope",
  "Agent OS SDK creates a local run and provider plan without real execution",
  "Agent OS SDK delegates controlled workspace-write dispatch through async wrapper",
  "Agent OS SDK issues an approval permit through the shared local runtime",
  "Agent OS CLI wrapper creates a local run and provider plan without spawning CLI",
  "Agent OS CLI wrapper issues an approval permit without spawning CLI",
  "Agent OS App Server wrapper issues an approval permit without network",
  "liveHttpServerStarted",
  "networkAccessed",
  "realProviderExecutionInvoked"
] as const;

const FORBIDDEN_RUNTIME_EXECUTION_MARKERS = [
  ".execute(",
  "runCodexCli",
  "spawnSubAgent",
  "dispatchGovernanceOperatorActionHostExecutor",
  "evaluateWorkspaceWritePatchGuard",
  "execFile(",
  "spawn(",
  "child_process"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AgentOsLocalRuntimeBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  localRuntimeText: string;
  serverManifestText: string;
  sdkWrapperText: string;
  cliWrapperText: string;
  appServerText: string;
  localRuntimeTestText: string;
  sdkTestText: string;
  cliTestText: string;
  appServerTestText: string;
}

export interface AgentOsLocalRuntimeBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    runtimeGateMarkersPresent: boolean;
    sdkWrapperUsesLocalRuntime: boolean;
    cliWrapperUsesLocalRuntime: boolean;
    appServerUsesLocalRuntimeWithoutNetwork: boolean;
    manifestRemainsDeclarationOnly: boolean;
    coverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    runtimeMode: "local_state_and_provider_plan_runtime";
    publicSurfaces: readonly ["mcp", "cli", "app_server", "sdk"];
    liveMcpServerConnectionAllowed: false;
    liveHttpServerStartedAllowed: false;
    networkAccessAllowed: false;
    providerPlanCanBeStored: true;
    realProviderExecutionAllowed: false;
    codexCliInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    controlledWorkspaceWriteDispatchAllowed: true;
    generalWorkspaceWriteExecutionAllowed: false;
    workspaceWriteProviderExecuteAllowed: false;
    localMutationRequiresApprovalAndAllowance: true;
    localRuntimeCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentOsLocalRuntimeBoundaryAuditOutputFormat = "text" | "json";

export async function collectAgentOsLocalRuntimeBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentOsLocalRuntimeBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    localRuntimeText,
    serverManifestText,
    sdkWrapperText,
    cliWrapperText,
    appServerText,
    localRuntimeTestText,
    sdkTestText,
    cliTestText,
    appServerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, LOCAL_RUNTIME),
    read(cwd, SERVER_MANIFEST),
    read(cwd, SDK_WRAPPER),
    read(cwd, CLI_WRAPPER),
    read(cwd, APP_SERVER),
    read(cwd, LOCAL_RUNTIME_TEST),
    read(cwd, SDK_TEST),
    read(cwd, CLI_TEST),
    read(cwd, APP_SERVER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    localRuntimeText,
    serverManifestText,
    sdkWrapperText,
    cliWrapperText,
    appServerText,
    localRuntimeTestText,
    sdkTestText,
    cliTestText,
    appServerTestText
  };
}

export function reviewAgentOsLocalRuntimeBoundaryAudit(
  input: AgentOsLocalRuntimeBoundaryAuditInput
): AgentOsLocalRuntimeBoundaryAuditResult {
  const checks = {
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit agent-os-local-runtime-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-os-local-runtime-boundary"
    ),
    runtimeGateMarkersPresent: REQUIRED_RUNTIME_MARKERS.every((marker) =>
      input.localRuntimeText.includes(marker)
    ),
    sdkWrapperUsesLocalRuntime: REQUIRED_SDK_MARKERS.every((marker) =>
      input.sdkWrapperText.includes(marker)
    ),
    cliWrapperUsesLocalRuntime: REQUIRED_CLI_MARKERS.every((marker) =>
      input.cliWrapperText.includes(marker)
    ),
    appServerUsesLocalRuntimeWithoutNetwork: REQUIRED_APP_SERVER_MARKERS.every(
      (marker) => input.appServerText.includes(marker)
    ),
    manifestRemainsDeclarationOnly: REQUIRED_MANIFEST_MARKERS.every((marker) =>
      input.serverManifestText.includes(marker)
    ),
    coverageRecorded: coverageRecorded(input),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      runtimeMode: "local_state_and_provider_plan_runtime",
      publicSurfaces: ["mcp", "cli", "app_server", "sdk"],
      liveMcpServerConnectionAllowed: false,
      liveHttpServerStartedAllowed: false,
      networkAccessAllowed: false,
      providerPlanCanBeStored: true,
      realProviderExecutionAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      localMutationRequiresApprovalAndAllowance: true,
      localRuntimeCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatAgentOsLocalRuntimeBoundaryAuditResult(
  review: AgentOsLocalRuntimeBoundaryAuditResult,
  format: AgentOsLocalRuntimeBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent OS local runtime boundary audit",
    `status: ${review.status}`,
    `runtime mode: ${review.summary.runtimeMode}`,
    `public surfaces: ${review.summary.publicSurfaces.join(",")}`,
    `live MCP server connection allowed: ${review.summary.liveMcpServerConnectionAllowed}`,
    `live HTTP server started allowed: ${review.summary.liveHttpServerStartedAllowed}`,
    `network access allowed: ${review.summary.networkAccessAllowed}`,
    `provider plan can be stored: ${review.summary.providerPlanCanBeStored}`,
    `real provider execution allowed: ${review.summary.realProviderExecutionAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `controlled workspace-write dispatch allowed: ${review.summary.controlledWorkspaceWriteDispatchAllowed}`,
    `general workspace-write execution allowed: ${review.summary.generalWorkspaceWriteExecutionAllowed}`,
    `workspace-write provider execute allowed: ${review.summary.workspaceWriteProviderExecuteAllowed}`,
    `local mutation requires approval and allowance: ${review.summary.localMutationRequiresApprovalAndAllowance}`,
    `local runtime calls during audit: ${review.summary.localRuntimeCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Agent OS local runtime boundary")
    && text.includes("local state and provider-plan runtime")
    && text.includes("may delegate controlled workspace-write provider plans")
    && text.includes("does not authorize provider execute, Codex CLI")
    && text.includes("host executor, sub-agent runtime, general workspace-write")
    && text.includes("npm run governance -- audit agent-os-local-runtime-boundary");
}

function coverageRecorded(input: AgentOsLocalRuntimeBoundaryAuditInput): boolean {
  const testText = [
    input.localRuntimeTestText,
    input.sdkTestText,
    input.cliTestText,
    input.appServerTestText
  ].join("\n");

  return REQUIRED_TEST_MARKERS.every((marker) => testText.includes(marker));
}

function noBroadExecutionAuthorization(
  input: AgentOsLocalRuntimeBoundaryAuditInput
): boolean {
  return FORBIDDEN_RUNTIME_EXECUTION_MARKERS.every((marker) =>
    !input.localRuntimeText.includes(marker)
      && !input.sdkWrapperText.includes(marker)
      && !input.cliWrapperText.includes(marker)
      && !input.appServerText.includes(marker)
  )
    && !input.localRuntimeText.includes("realProviderExecutionInvoked: true")
    && !input.localRuntimeText.includes("liveMcpServerConnection: true")
    && !input.appServerText.includes("liveHttpServerStarted: true")
    && !input.appServerText.includes("networkAccessed: true")
    && !input.appServerText.includes("realProviderExecutionInvoked: true");
}

function outputSanitized(input: AgentOsLocalRuntimeBoundaryAuditInput): boolean {
  const review: AgentOsLocalRuntimeBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      runtimeGateMarkersPresent: true,
      sdkWrapperUsesLocalRuntime: true,
      cliWrapperUsesLocalRuntime: true,
      appServerUsesLocalRuntimeWithoutNetwork: true,
      manifestRemainsDeclarationOnly: true,
      coverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      runtimeMode: "local_state_and_provider_plan_runtime",
      publicSurfaces: ["mcp", "cli", "app_server", "sdk"],
      liveMcpServerConnectionAllowed: false,
      liveHttpServerStartedAllowed: false,
      networkAccessAllowed: false,
      providerPlanCanBeStored: true,
      realProviderExecutionAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      localMutationRequiresApprovalAndAllowance: true,
      localRuntimeCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatAgentOsLocalRuntimeBoundaryAuditResult(review);
  const json = formatAgentOsLocalRuntimeBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
    !text.includes(marker)
      && !json.includes(marker)
      && !input.governanceControlPlaneText.includes(marker)
      && !input.governanceReadmeText.includes(marker)
  );
}

function collectReasons(
  checks: AgentOsLocalRuntimeBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `agent_os_local_runtime_boundary_${name}`);
}

async function read(cwd: string, relativePath: string): Promise<string> {
  return readFile(join(cwd, relativePath), "utf8");
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAgentOsLocalRuntimeBoundaryAuditInput();
  const review = reviewAgentOsLocalRuntimeBoundaryAudit(input);

  console.log(formatAgentOsLocalRuntimeBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Agent OS local runtime boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
