#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const EXECUTION_PROFILES_SOURCE = "packages/execution-profiles/src/index.ts";
const ROUTING_ENGINE_SOURCE = "packages/routing-engine/src/index.ts";
const DESKTOP_AGENT_STRATEGY_SOURCE =
  "packages/desktop-agent-strategy/src/index.ts";
const ROUTING_ENGINE_TEST = "tests/routing-engine.test.ts";
const DESKTOP_AGENT_STRATEGY_TEST = "tests/desktop-agent-strategy.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "ExecutionProfile",
  "EXECUTION_PROFILES",
  "getExecutionProfile",
  "stages: string[]",
  "defaultRole: AgentRole",
  "defaultToolAccess: ToolAccessLevel",
  "allowParallel: boolean",
  "maxParallelAgents: number",
  "\"recon-only\"",
  "\"engineering\"",
  "\"release-governance\"",
  "defaultToolAccess: \"protected_remote\""
] as const;

const REQUIRED_USAGE_MARKERS = [
  "getExecutionProfile",
  "profile.allowParallel",
  "profile.maxParallelAgents",
  "profile.defaultRole"
] as const;

const REQUIRED_TEST_MARKERS = [
  "routing engine covers read-only and small edit tasks",
  "routing engine covers engineering, high-risk, and release tasks",
  "desktop agent strategy allows bounded read-only parallelism",
  "desktop agent strategy disables write parallelism without ownership",
  "desktop agent strategy bounds write ownership assignments to files and max agents"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "dispatchGovernanceOperatorActionHostExecutor",
  "dispatchToHost(",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "invokePrimitive",
  "invokeSubAgent",
  "spawnSubAgent",
  "hostExecutor(",
  "spawn(",
  "execFile(",
  "exec(",
  "child_process",
  "new Worker(",
  "fetch(",
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

export interface ExecutionProfilesBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  executionProfilesSourceText: string;
  routingEngineSourceText: string;
  desktopAgentStrategySourceText: string;
  routingEngineTestText: string;
  desktopAgentStrategyTestText: string;
}

export interface ExecutionProfilesBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    usageMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    executionProfilesMode: "profile_templates_only";
    profileStageIsRuntimeStep: false;
    defaultRoleIsSubAgentRuntimeAuthorization: false;
    defaultToolAccessIsToolRuntimeAuthorization: false;
    engineeringWriteToolAccessIsWorkspaceWriteExecution: false;
    protectedRemoteToolAccessIsExternalWriteAuthorization: false;
    allowParallelIsSubAgentRuntimeAuthorization: false;
    maxParallelAgentsIsSubAgentSpawnAuthorization: false;
    releaseGovernanceProfileIsProtectedRemoteAuthorization: false;
    profileSelectionIsProviderExecutionAuthorization: false;
    executionProfileLookupsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    desktopPrimitiveCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ExecutionProfilesBoundaryAuditOutputFormat = "text" | "json";

export async function collectExecutionProfilesBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ExecutionProfilesBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    executionProfilesSourceText,
    routingEngineSourceText,
    desktopAgentStrategySourceText,
    routingEngineTestText,
    desktopAgentStrategyTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, EXECUTION_PROFILES_SOURCE),
    read(cwd, ROUTING_ENGINE_SOURCE),
    read(cwd, DESKTOP_AGENT_STRATEGY_SOURCE),
    read(cwd, ROUTING_ENGINE_TEST),
    read(cwd, DESKTOP_AGENT_STRATEGY_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    executionProfilesSourceText,
    routingEngineSourceText,
    desktopAgentStrategySourceText,
    routingEngineTestText,
    desktopAgentStrategyTestText
  };
}

export function reviewExecutionProfilesBoundaryAudit(
  input: ExecutionProfilesBoundaryAuditInput
): ExecutionProfilesBoundaryAuditResult {
  const usageText = [
    input.routingEngineSourceText,
    input.desktopAgentStrategySourceText
  ].join("\n");
  const coverageText = [
    input.routingEngineTestText,
    input.desktopAgentStrategyTestText
  ].join("\n");
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit execution-profiles-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "execution-profiles-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.executionProfilesSourceText.includes(marker)
    ),
    usageMarkersPresent: REQUIRED_USAGE_MARKERS.every((marker) =>
      usageText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      coverageText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.executionProfilesSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      executionProfilesMode: "profile_templates_only",
      profileStageIsRuntimeStep: false,
      defaultRoleIsSubAgentRuntimeAuthorization: false,
      defaultToolAccessIsToolRuntimeAuthorization: false,
      engineeringWriteToolAccessIsWorkspaceWriteExecution: false,
      protectedRemoteToolAccessIsExternalWriteAuthorization: false,
      allowParallelIsSubAgentRuntimeAuthorization: false,
      maxParallelAgentsIsSubAgentSpawnAuthorization: false,
      releaseGovernanceProfileIsProtectedRemoteAuthorization: false,
      profileSelectionIsProviderExecutionAuthorization: false,
      executionProfileLookupsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatExecutionProfilesBoundaryAuditResult(
  review: ExecutionProfilesBoundaryAuditResult,
  format: ExecutionProfilesBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Execution profiles boundary audit",
    `status: ${review.status}`,
    `execution profiles mode: ${review.summary.executionProfilesMode}`,
    `profile stage is runtime step: ${review.summary.profileStageIsRuntimeStep}`,
    `default role is sub-agent runtime authorization: ${review.summary.defaultRoleIsSubAgentRuntimeAuthorization}`,
    `default tool access is tool runtime authorization: ${review.summary.defaultToolAccessIsToolRuntimeAuthorization}`,
    `engineering write tool access is workspace-write execution: ${review.summary.engineeringWriteToolAccessIsWorkspaceWriteExecution}`,
    `protected remote tool access is external-write authorization: ${review.summary.protectedRemoteToolAccessIsExternalWriteAuthorization}`,
    `allowParallel is sub-agent runtime authorization: ${review.summary.allowParallelIsSubAgentRuntimeAuthorization}`,
    `maxParallelAgents is sub-agent spawn authorization: ${review.summary.maxParallelAgentsIsSubAgentSpawnAuthorization}`,
    `release-governance profile is protected remote authorization: ${review.summary.releaseGovernanceProfileIsProtectedRemoteAuthorization}`,
    `profile selection is provider execution authorization: ${review.summary.profileSelectionIsProviderExecutionAuthorization}`,
    `execution profile lookups during audit: ${review.summary.executionProfileLookupsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `desktop primitive calls during audit: ${review.summary.desktopPrimitiveCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
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
  return text.includes("Execution profiles boundary")
    && text.includes("profile templates only")
    && text.includes("profile stages are not runtime steps")
    && text.includes("default roles are not sub-agent runtime authorization")
    && text.includes("defaultToolAccess is not tool runtime authorization")
    && text.includes("engineering_write is not workspace-write execution")
    && text.includes("protected_remote is not external-write authorization")
    && text.includes("allowParallel is not sub-agent runtime authorization")
    && text.includes("maxParallelAgents is not sub-agent spawn authorization")
    && text.includes("release-governance is not protected-remote authorization")
    && text.includes("profile selection is not provider execution authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: ExecutionProfilesBoundaryAuditInput): boolean {
  const output = formatExecutionProfilesBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      usageMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      executionProfilesMode: "profile_templates_only",
      profileStageIsRuntimeStep: false,
      defaultRoleIsSubAgentRuntimeAuthorization: false,
      defaultToolAccessIsToolRuntimeAuthorization: false,
      engineeringWriteToolAccessIsWorkspaceWriteExecution: false,
      protectedRemoteToolAccessIsExternalWriteAuthorization: false,
      allowParallelIsSubAgentRuntimeAuthorization: false,
      maxParallelAgentsIsSubAgentSpawnAuthorization: false,
      releaseGovernanceProfileIsProtectedRemoteAuthorization: false,
      profileSelectionIsProviderExecutionAuthorization: false,
      executionProfileLookupsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
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
    input.executionProfilesSourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: ExecutionProfilesBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `execution_profiles_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectExecutionProfilesBoundaryAuditInput();
  const review = reviewExecutionProfilesBoundaryAudit(input);
  console.log(formatExecutionProfilesBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Execution profiles boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
