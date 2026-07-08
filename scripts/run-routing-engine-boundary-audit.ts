#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const ROUTING_ENGINE_SOURCE = "packages/routing-engine/src/index.ts";
const ROUTING_ENGINE_TEST = "tests/routing-engine.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "routeTask",
  "RoutingDecision",
  "ProviderGrant",
  "createProviderGrant",
  "resolveProviderSideEffectClass",
  "resolveHostRoute",
  "scoreRisk",
  "chooseReasoningEffort",
  "collectApprovalSignals",
  "getExecutionProfile",
  "hashProviderManifest",
  "codexCliProviderManifest",
  "hostRoute",
  "providerGrant",
  "sandboxMode",
  "approvalRequired"
] as const;

const REQUIRED_TEST_MARKERS = [
  "routing engine covers read-only and small edit tasks",
  "routing engine respects low-risk taskClassHint when text is neutral",
  "routing engine covers engineering, high-risk, and release tasks",
  "routing engine fails closed when a task class host route is missing",
  "providerGrant",
  "hostRoute",
  "sandboxMode",
  "approvalRequired"
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
  "invokeSubAgent",
  "spawnSubAgent",
  "hostExecutor(",
  "spawn(",
  "execFile(",
  "exec(",
  "child_process",
  "new Worker(",
  "fetch(",
  "apply_patch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface RoutingEngineBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  routingEngineSourceText: string;
  routingEngineTestText: string;
}

export interface RoutingEngineBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceRoutingMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    routingEngineMode: "routing_decision_and_provider_grant_only";
    routingDecisionIsExecutionAuthorization: false;
    hostRouteIsHostDispatchAuthorization: false;
    providerGrantIsProviderExecuteAuthorization: false;
    codexCliProviderIdIsCodexCliInvocation: false;
    desktopProviderIdIsDesktopRuntimeInvocation: false;
    sandboxModeIsWorkspaceWriteExecution: false;
    toolAccessIsToolRuntimeAuthorization: false;
    approvalRequiredIsApprovalGrant: false;
    riskScoreIsRuntimeAuthorization: false;
    parallelismAllowedIsSubAgentRuntimeAuthorization: false;
    routingEngineCallsDuringAudit: 0;
    providerGrantCreationsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    desktopRuntimeCallsDuringAudit: 0;
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

export type RoutingEngineBoundaryAuditOutputFormat = "text" | "json";

export async function collectRoutingEngineBoundaryAuditInput(
  cwd = process.cwd()
): Promise<RoutingEngineBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    routingEngineSourceText,
    routingEngineTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, ROUTING_ENGINE_SOURCE),
    read(cwd, ROUTING_ENGINE_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    routingEngineSourceText,
    routingEngineTestText
  };
}

export function reviewRoutingEngineBoundaryAudit(
  input: RoutingEngineBoundaryAuditInput
): RoutingEngineBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit routing-engine-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "routing-engine-boundary"
    ),
    sourceRoutingMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.routingEngineSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.routingEngineTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.routingEngineSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      routingEngineMode: "routing_decision_and_provider_grant_only",
      routingDecisionIsExecutionAuthorization: false,
      hostRouteIsHostDispatchAuthorization: false,
      providerGrantIsProviderExecuteAuthorization: false,
      codexCliProviderIdIsCodexCliInvocation: false,
      desktopProviderIdIsDesktopRuntimeInvocation: false,
      sandboxModeIsWorkspaceWriteExecution: false,
      toolAccessIsToolRuntimeAuthorization: false,
      approvalRequiredIsApprovalGrant: false,
      riskScoreIsRuntimeAuthorization: false,
      parallelismAllowedIsSubAgentRuntimeAuthorization: false,
      routingEngineCallsDuringAudit: 0,
      providerGrantCreationsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopRuntimeCallsDuringAudit: 0,
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

export function formatRoutingEngineBoundaryAuditResult(
  review: RoutingEngineBoundaryAuditResult,
  format: RoutingEngineBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Routing engine boundary audit",
    `status: ${review.status}`,
    `routing engine mode: ${review.summary.routingEngineMode}`,
    `routing decision is execution authorization: ${review.summary.routingDecisionIsExecutionAuthorization}`,
    `hostRoute is host dispatch authorization: ${review.summary.hostRouteIsHostDispatchAuthorization}`,
    `providerGrant is provider execute authorization: ${review.summary.providerGrantIsProviderExecuteAuthorization}`,
    `codex-cli provider id is Codex CLI invocation: ${review.summary.codexCliProviderIdIsCodexCliInvocation}`,
    `desktop provider id is desktop runtime invocation: ${review.summary.desktopProviderIdIsDesktopRuntimeInvocation}`,
    `sandboxMode is workspace-write execution: ${review.summary.sandboxModeIsWorkspaceWriteExecution}`,
    `toolAccess is tool runtime authorization: ${review.summary.toolAccessIsToolRuntimeAuthorization}`,
    `approvalRequired is approval grant: ${review.summary.approvalRequiredIsApprovalGrant}`,
    `risk score is runtime authorization: ${review.summary.riskScoreIsRuntimeAuthorization}`,
    `parallelism allowed is sub-agent runtime authorization: ${review.summary.parallelismAllowedIsSubAgentRuntimeAuthorization}`,
    `routing engine calls during audit: ${review.summary.routingEngineCallsDuringAudit}`,
    `provider grant creations during audit: ${review.summary.providerGrantCreationsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `desktop runtime calls during audit: ${review.summary.desktopRuntimeCallsDuringAudit}`,
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
  return text.includes("Routing engine boundary")
    && text.includes("routing decision and provider grant only")
    && text.includes("routing decisions are not execution authorization")
    && text.includes("hostRoute is not host dispatch authorization")
    && text.includes("providerGrant is not provider execute authorization")
    && text.includes("codex-cli provider ids are not Codex CLI invocation")
    && text.includes("desktop provider ids are not desktop runtime invocation")
    && text.includes("sandboxMode is not workspace-write execution")
    && text.includes("toolAccess is not tool runtime authorization")
    && text.includes("approvalRequired is not approval grant")
    && text.includes("risk scores are not runtime authorization")
    && text.includes("parallelism allowance is not sub-agent runtime authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: RoutingEngineBoundaryAuditInput): boolean {
  const output = formatRoutingEngineBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceRoutingMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      routingEngineMode: "routing_decision_and_provider_grant_only",
      routingDecisionIsExecutionAuthorization: false,
      hostRouteIsHostDispatchAuthorization: false,
      providerGrantIsProviderExecuteAuthorization: false,
      codexCliProviderIdIsCodexCliInvocation: false,
      desktopProviderIdIsDesktopRuntimeInvocation: false,
      sandboxModeIsWorkspaceWriteExecution: false,
      toolAccessIsToolRuntimeAuthorization: false,
      approvalRequiredIsApprovalGrant: false,
      riskScoreIsRuntimeAuthorization: false,
      parallelismAllowedIsSubAgentRuntimeAuthorization: false,
      routingEngineCallsDuringAudit: 0,
      providerGrantCreationsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopRuntimeCallsDuringAudit: 0,
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
    input.routingEngineSourceText,
    input.routingEngineTestText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: RoutingEngineBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `routing_engine_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectRoutingEngineBoundaryAuditInput();
  const review = reviewRoutingEngineBoundaryAudit(input);
  console.log(formatRoutingEngineBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Routing engine boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
