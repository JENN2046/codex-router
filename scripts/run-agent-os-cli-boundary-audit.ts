#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const CLI_SOURCE = "packages/agent-os-cli/src/index.ts";
const CLI_TEST = "tests/agent-os-cli.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "AgentOsCliCommandSchema",
  "RunAgentOsCliCommandInput = Omit<",
  "runAgentOsCliCommand",
  "runAgentOsCliCommandAsync",
  "parseAgentOsCliArgv",
  "sanitizeAgentOsCliArgv",
  "createAgentOsMcpLocalRuntime",
  "publicSurface: \"cli\"",
  "runtime.handleToolCall(call)",
  "runtime.handleToolCallAsync(call)",
  "dispatch-workspace-write",
  "agentos.dispatch_workspace_write",
  "--dispatch-input-json",
  "--prepare-json",
  "call.grantedCapabilities = parsed.grantedCapabilities",
  "call.approvedMutatingTools = parsed.approvedMutatingTools",
  "call.allowLocalMutations = parsed.allowLocalMutations",
  "call.preferredProviderId = parsed.preferredProviderId",
  "sanitizedArgv: sanitizeAgentOsCliArgv(argv)",
  "parseCommonOption",
  "case \"--grant\"",
  "case \"--approve-tool\"",
  "case \"--allow-local-mutation\"",
  "case \"--preferred-provider\"",
  "redactInlineSecretLikeArg",
  "isSecretLikeFlag"
] as const;

const REQUIRED_TEST_MARKERS = [
  "Agent OS CLI parser maps create-task argv to a governed tool call",
  "Agent OS CLI parser maps approve-run argv to a governed tool call",
  "Agent OS CLI parser maps workspace-write dispatch argv to a governed tool call",
  "Agent OS CLI parser maps workspace-write prepare argv to a governed tool call",
  "Agent OS CLI wrapper blocks local mutation by default",
  "Agent OS CLI wrapper creates a local run and provider plan without spawning CLI",
  "Agent OS CLI wrapper delegates controlled workspace-write dispatch asynchronously",
  "Agent OS CLI wrapper prepares controlled workspace-write dispatch asynchronously",
  "Agent OS CLI wrapper issues an approval permit without spawning CLI",
  "Agent OS CLI wrapper consumes approval permits without spawning CLI",
  "Agent OS CLI wrapper preserves rejected permit audit without spawning CLI",
  "Agent OS CLI parser accepts cursors on paginated commands",
  "Agent OS CLI sanitizer redacts secret-like option values"
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

export interface AgentOsCliBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  cliSourceText: string;
  cliTestText: string;
}

export interface AgentOsCliBoundaryAuditResult {
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
    agentOsCliMode: "argv_parsing_to_local_mcp_runtime_only";
    cliGrantFlagIsCapabilityGrant: false;
    cliApproveToolFlagIsToolRuntimeAuthorization: false;
    cliAllowLocalMutationIsWorkspaceWriteExecution: false;
    preferredProviderIsCodexCliInvocation: false;
    parsedCommandIsProviderExecutionAuthorization: false;
    localRuntimeCallIsProviderExecutionAuthorization: false;
    approvalPermitIssueIsProviderExecutionAuthorization: false;
    approvalPermitConsumptionIsProviderExecutionAuthorization: false;
    controlledWorkspaceWritePrepareAllowed: true;
    controlledWorkspaceWriteDispatchAllowed: true;
    generalWorkspaceWriteExecutionAllowed: false;
    workspaceWriteProviderExecuteAllowed: false;
    sanitizedArgvContainsRawSecrets: false;
    cliWrapperCallsDuringAudit: 0;
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

export type AgentOsCliBoundaryAuditOutputFormat = "text" | "json";

export async function collectAgentOsCliBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentOsCliBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    cliSourceText,
    cliTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, CLI_SOURCE),
    read(cwd, CLI_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    cliSourceText,
    cliTestText
  };
}

export function reviewAgentOsCliBoundaryAudit(
  input: AgentOsCliBoundaryAuditInput
): AgentOsCliBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit agent-os-cli-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-os-cli-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.cliSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.cliTestText.includes(marker)
    ),
    noRuntimeExecutionSurface:
      noRuntimeExecutionSurface(input.cliSourceText),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      agentOsCliMode: "argv_parsing_to_local_mcp_runtime_only",
      cliGrantFlagIsCapabilityGrant: false,
      cliApproveToolFlagIsToolRuntimeAuthorization: false,
      cliAllowLocalMutationIsWorkspaceWriteExecution: false,
      preferredProviderIsCodexCliInvocation: false,
      parsedCommandIsProviderExecutionAuthorization: false,
      localRuntimeCallIsProviderExecutionAuthorization: false,
      approvalPermitIssueIsProviderExecutionAuthorization: false,
      approvalPermitConsumptionIsProviderExecutionAuthorization: false,
      controlledWorkspaceWritePrepareAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      sanitizedArgvContainsRawSecrets: false,
      cliWrapperCallsDuringAudit: 0,
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

export function formatAgentOsCliBoundaryAuditResult(
  review: AgentOsCliBoundaryAuditResult,
  format: AgentOsCliBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent OS CLI boundary audit",
    `status: ${review.status}`,
    `Agent OS CLI mode: ${review.summary.agentOsCliMode}`,
    `CLI grant flag is capability grant: ${review.summary.cliGrantFlagIsCapabilityGrant}`,
    `CLI approve-tool flag is tool runtime authorization: ${review.summary.cliApproveToolFlagIsToolRuntimeAuthorization}`,
    `CLI allow-local-mutation is workspace-write execution: ${review.summary.cliAllowLocalMutationIsWorkspaceWriteExecution}`,
    `preferred provider is Codex CLI invocation: ${review.summary.preferredProviderIsCodexCliInvocation}`,
    `parsed command is provider execution authorization: ${review.summary.parsedCommandIsProviderExecutionAuthorization}`,
    `local runtime call is provider execution authorization: ${review.summary.localRuntimeCallIsProviderExecutionAuthorization}`,
    `approval permit issue is provider execution authorization: ${review.summary.approvalPermitIssueIsProviderExecutionAuthorization}`,
    `approval permit consumption is provider execution authorization: ${review.summary.approvalPermitConsumptionIsProviderExecutionAuthorization}`,
    `controlled workspace-write prepare allowed: ${review.summary.controlledWorkspaceWritePrepareAllowed}`,
    `controlled workspace-write dispatch allowed: ${review.summary.controlledWorkspaceWriteDispatchAllowed}`,
    `general workspace-write execution allowed: ${review.summary.generalWorkspaceWriteExecutionAllowed}`,
    `workspace-write provider.execute allowed: ${review.summary.workspaceWriteProviderExecuteAllowed}`,
    `sanitized argv contains raw secrets: ${review.summary.sanitizedArgvContainsRawSecrets}`,
    `CLI wrapper calls during audit: ${review.summary.cliWrapperCallsDuringAudit}`,
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
  return text.includes("Agent OS CLI boundary")
    && text.includes("argv parsing to local MCP runtime only")
    && text.includes("CLI grant flags are not capability grants")
    && text.includes("approve-tool flags are not tool runtime authorization")
    && text.includes("allow-local-mutation is not workspace-write execution")
    && text.includes("preferred provider is not Codex CLI invocation")
    && text.includes("parsed commands are not provider execution authorization")
    && text.includes("approval permit issue and consumption are not provider execution")
    && text.includes("controlled workspace-write dispatch")
    && text.includes("workspace-write through `provider.execute`")
    && text.includes("sanitized argv must not expose raw secrets")
    && text.includes("the CLI wrapper does not spawn Codex CLI");
}

function noRuntimeExecutionSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: AgentOsCliBoundaryAuditInput): boolean {
  const output = formatAgentOsCliBoundaryAuditResult({
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
      agentOsCliMode: "argv_parsing_to_local_mcp_runtime_only",
      cliGrantFlagIsCapabilityGrant: false,
      cliApproveToolFlagIsToolRuntimeAuthorization: false,
      cliAllowLocalMutationIsWorkspaceWriteExecution: false,
      preferredProviderIsCodexCliInvocation: false,
      parsedCommandIsProviderExecutionAuthorization: false,
      localRuntimeCallIsProviderExecutionAuthorization: false,
      approvalPermitIssueIsProviderExecutionAuthorization: false,
      approvalPermitConsumptionIsProviderExecutionAuthorization: false,
      controlledWorkspaceWritePrepareAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      sanitizedArgvContainsRawSecrets: false,
      cliWrapperCallsDuringAudit: 0,
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
    input.cliSourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !scannedText.includes(marker));
}

function collectReasons(
  checks: AgentOsCliBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `agent_os_cli_boundary_${check}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAgentOsCliBoundaryAuditInput();
  const review = reviewAgentOsCliBoundaryAudit(input);
  console.log(formatAgentOsCliBoundaryAuditResult(review, format));
  process.exitCode = review.status === "passed" ? 0 : 1;
}
