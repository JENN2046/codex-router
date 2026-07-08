#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const DESKTOP_DECISION_RUNNER = "packages/desktop-decision-runner/src/index.ts";
const ROUTING_ENGINE = "packages/routing-engine/src/index.ts";
const DESKTOP_AGENT_STRATEGY = "packages/desktop-agent-strategy/src/index.ts";
const DESKTOP_BRIDGE = "packages/desktop-bridge/src/index.ts";
const DESKTOP_DECISION_RUNNER_TEST = "tests/desktop-decision-runner.test.ts";
const DESKTOP_DECISION_RUNNER_GOVERNANCE_TEST =
  "tests/desktop-decision-runner-governance.test.ts";
const ROUTING_ENGINE_TEST = "tests/routing-engine.test.ts";
const DESKTOP_AGENT_STRATEGY_TEST = "tests/desktop-agent-strategy.test.ts";
const DESKTOP_LIVE_ADAPTER_TEST = "tests/desktop-live-adapter.test.ts";

const REQUIRED_RUNNER_MARKERS = [
  "export async function runDesktopDecision",
  "export async function resumeDesktopDecision",
  "export async function runDesktopDecisionWithGovernance",
  "routeTask(task, intent, input.policy)",
  "createDesktopExecutionPlan(decision)",
  "createDesktopExecutionPlan(decision, { authorized: true })",
  "selectProviderForRoutingDecision",
  "summarizeProviderSelectionResult",
  "planAgentStrategy",
  "resolveStatus(preflight, approval, providerSelection)",
  "providerSelection !== undefined && !providerSelection.selected",
  "ready-for-desktop-execution",
  "persistRunnerArtifacts",
  "checkpointStore.record(checkpoint)",
  "memoryAdapter.recordCheckpoint(checkpoint)",
  "auditStore.record(event)",
  "routeStrategyV2"
] as const;

const REQUIRED_ROUTING_MARKERS = [
  "export function routeTask",
  "providerGrant: createProviderGrant",
  "providerId = input.hostRoute === \"codex-cli\" ? \"codex-cli\" : \"codex-desktop\"",
  "sideEffectClass: resolveProviderSideEffectClass(input.toolAccess)",
  "sandboxMode: input.toolAccess === \"read_only\" ? \"read-only\" : \"workspace-write\""
] as const;

const REQUIRED_AGENT_STRATEGY_MARKERS = [
  "export function planAgentStrategy",
  "read_only_parallelism_allowed",
  "write_scope_needs_explicit_ownership",
  "write_parallelism_allowed_with_ownership"
] as const;

const REQUIRED_DESKTOP_BRIDGE_MARKERS = [
  "createDesktopExecutionPlan",
  "authorized?: boolean",
  "options.authorized === true",
  "plan_mode:${options.authorized === true ? \"authorized\" : \"candidate\"}"
] as const;

const REQUIRED_TEST_MARKERS = [
  "desktop decision runner blocks on preflight failures",
  "desktop decision runner blocks on approval after preflight passes",
  "desktop decision runner returns ready execution package for safe read-only work",
  "desktop decision runner read-only result can dry-run provider dispatch",
  "assert.equal(spawnCalls, 0)",
  "desktop decision runner records provider selection when registry is supplied",
  "desktop decision runner blocks when provider registry is missing provider",
  "desktop decision runner blocks when provider registry has disabled provider",
  "desktop decision runner blocks provider registry manifest hash mismatches",
  "desktop decision runner does not require desktop write tools for codex-cli small edits",
  "resumeDesktopDecision restores from memory recall before running a fresh decision",
  "desktop decision runner with governance returns base + governance state + strategy decision",
  "desktop decision runner with governance assigns governance state from routing decision",
  "routing engine covers read-only and small edit tasks",
  "desktop agent strategy disables write parallelism without ownership",
  "runDesktopTask dispatches codex-cli small edits instead of executing desktop primitives",
  "runDesktopTask preserves blocked_preflight results without executing handlers"
] as const;

const FORBIDDEN_RUNNER_EXECUTION_MARKERS = [
  "dispatchReadOnlyRunnerResultToProvider",
  "runDesktopTask",
  "dispatchToHost",
  "invokePrimitive",
  ".execute(",
  "provider.execute",
  "runCodexCli",
  "CodexCliExecutorProvider",
  "spawnSubAgent",
  "spawn(",
  "execFile(",
  "child_process",
  "evaluateWorkspaceWritePatchGuard"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface DesktopDecisionRunnerBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  desktopDecisionRunnerText: string;
  routingEngineText: string;
  desktopAgentStrategyText: string;
  desktopBridgeText: string;
  desktopDecisionRunnerTestText: string;
  desktopDecisionRunnerGovernanceTestText: string;
  routingEngineTestText: string;
  desktopAgentStrategyTestText: string;
  desktopLiveAdapterTestText: string;
}

export interface DesktopDecisionRunnerBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    decisionRunnerMarkersPresent: boolean;
    routingEngineGrantIsPlanOnly: boolean;
    agentStrategyIsAssignmentOnly: boolean;
    desktopBridgePlanMarkersPresent: boolean;
    coverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    runnerMode: "decision_package_only";
    readyStatusIsExecutionAuthorization: false;
    desktopPlanAuthorizedFlagIsDispatch: false;
    providerSelectionIsProviderExecute: false;
    providerGrantIsProviderExecute: false;
    agentStrategyIsSubAgentRuntimeInvocation: false;
    governanceStrategyExecuteActionIsRuntimeInvocation: false;
    persistenceWritesLimitedToDecisionArtifacts: true;
    desktopPrimitiveInvocationAllowed: false;
    hostDispatchAllowed: false;
    providerExecuteAllowed: false;
    codexCliInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteExecutionAllowed: false;
    desktopDecisionRunnerCallsDuringAudit: 0;
    desktopPrimitiveCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type DesktopDecisionRunnerBoundaryAuditOutputFormat = "text" | "json";

export async function collectDesktopDecisionRunnerBoundaryAuditInput(
  cwd = process.cwd()
): Promise<DesktopDecisionRunnerBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    desktopDecisionRunnerText,
    routingEngineText,
    desktopAgentStrategyText,
    desktopBridgeText,
    desktopDecisionRunnerTestText,
    desktopDecisionRunnerGovernanceTestText,
    routingEngineTestText,
    desktopAgentStrategyTestText,
    desktopLiveAdapterTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, DESKTOP_DECISION_RUNNER),
    read(cwd, ROUTING_ENGINE),
    read(cwd, DESKTOP_AGENT_STRATEGY),
    read(cwd, DESKTOP_BRIDGE),
    read(cwd, DESKTOP_DECISION_RUNNER_TEST),
    read(cwd, DESKTOP_DECISION_RUNNER_GOVERNANCE_TEST),
    read(cwd, ROUTING_ENGINE_TEST),
    read(cwd, DESKTOP_AGENT_STRATEGY_TEST),
    read(cwd, DESKTOP_LIVE_ADAPTER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    desktopDecisionRunnerText,
    routingEngineText,
    desktopAgentStrategyText,
    desktopBridgeText,
    desktopDecisionRunnerTestText,
    desktopDecisionRunnerGovernanceTestText,
    routingEngineTestText,
    desktopAgentStrategyTestText,
    desktopLiveAdapterTestText
  };
}

export function reviewDesktopDecisionRunnerBoundaryAudit(
  input: DesktopDecisionRunnerBoundaryAuditInput
): DesktopDecisionRunnerBoundaryAuditResult {
  const checks = {
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit desktop-decision-runner-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "desktop-decision-runner-boundary"
    ),
    decisionRunnerMarkersPresent: REQUIRED_RUNNER_MARKERS.every((marker) =>
      input.desktopDecisionRunnerText.includes(marker)
    ),
    routingEngineGrantIsPlanOnly: REQUIRED_ROUTING_MARKERS.every((marker) =>
      input.routingEngineText.includes(marker)
    ),
    agentStrategyIsAssignmentOnly: REQUIRED_AGENT_STRATEGY_MARKERS.every((marker) =>
      input.desktopAgentStrategyText.includes(marker)
    ),
    desktopBridgePlanMarkersPresent: REQUIRED_DESKTOP_BRIDGE_MARKERS.every((marker) =>
      input.desktopBridgeText.includes(marker)
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
      runnerMode: "decision_package_only",
      readyStatusIsExecutionAuthorization: false,
      desktopPlanAuthorizedFlagIsDispatch: false,
      providerSelectionIsProviderExecute: false,
      providerGrantIsProviderExecute: false,
      agentStrategyIsSubAgentRuntimeInvocation: false,
      governanceStrategyExecuteActionIsRuntimeInvocation: false,
      persistenceWritesLimitedToDecisionArtifacts: true,
      desktopPrimitiveInvocationAllowed: false,
      hostDispatchAllowed: false,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      desktopDecisionRunnerCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatDesktopDecisionRunnerBoundaryAuditResult(
  review: DesktopDecisionRunnerBoundaryAuditResult,
  format: DesktopDecisionRunnerBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Desktop decision runner boundary audit",
    `status: ${review.status}`,
    `runner mode: ${review.summary.runnerMode}`,
    `ready status is execution authorization: ${review.summary.readyStatusIsExecutionAuthorization}`,
    `desktop plan authorized flag is dispatch: ${review.summary.desktopPlanAuthorizedFlagIsDispatch}`,
    `provider selection is provider execute: ${review.summary.providerSelectionIsProviderExecute}`,
    `provider grant is provider execute: ${review.summary.providerGrantIsProviderExecute}`,
    `agent strategy is sub-agent runtime invocation: ${review.summary.agentStrategyIsSubAgentRuntimeInvocation}`,
    `governance strategy execute action is runtime invocation: ${review.summary.governanceStrategyExecuteActionIsRuntimeInvocation}`,
    `persistence writes limited to decision artifacts: ${review.summary.persistenceWritesLimitedToDecisionArtifacts}`,
    `desktop primitive invocation allowed: ${review.summary.desktopPrimitiveInvocationAllowed}`,
    `host dispatch allowed: ${review.summary.hostDispatchAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write execution allowed: ${review.summary.workspaceWriteExecutionAllowed}`,
    `desktop decision runner calls during audit: ${review.summary.desktopDecisionRunnerCallsDuringAudit}`,
    `desktop primitive calls during audit: ${review.summary.desktopPrimitiveCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Desktop decision runner boundary")
    && text.includes("decision package only")
    && text.includes("ready status, provider selection, provider grants, agent strategy")
    && text.includes("are not runtime authorization")
    && text.includes("npm run governance -- audit desktop-decision-runner-boundary");
}

function coverageRecorded(input: DesktopDecisionRunnerBoundaryAuditInput): boolean {
  const testText = [
    input.desktopDecisionRunnerTestText,
    input.desktopDecisionRunnerGovernanceTestText,
    input.routingEngineTestText,
    input.desktopAgentStrategyTestText,
    input.desktopLiveAdapterTestText
  ].join("\n");

  return REQUIRED_TEST_MARKERS.every((marker) => testText.includes(marker));
}

function noBroadExecutionAuthorization(
  input: DesktopDecisionRunnerBoundaryAuditInput
): boolean {
  return FORBIDDEN_RUNNER_EXECUTION_MARKERS.every((marker) =>
    !input.desktopDecisionRunnerText.includes(marker)
      && !input.routingEngineText.includes(marker)
      && !input.desktopAgentStrategyText.includes(marker)
  )
    && !input.desktopDecisionRunnerText.includes("provider.execute")
    && !input.desktopDecisionRunnerText.includes("realProviderExecutionInvoked: true")
    && !input.desktopDecisionRunnerText.includes("workspaceWriteExecutionAllowed: true")
    && !input.routingEngineText.includes("provider.execute")
    && !input.desktopAgentStrategyText.includes("spawn_agent(");
}

function outputSanitized(input: DesktopDecisionRunnerBoundaryAuditInput): boolean {
  const review: DesktopDecisionRunnerBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      decisionRunnerMarkersPresent: true,
      routingEngineGrantIsPlanOnly: true,
      agentStrategyIsAssignmentOnly: true,
      desktopBridgePlanMarkersPresent: true,
      coverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      runnerMode: "decision_package_only",
      readyStatusIsExecutionAuthorization: false,
      desktopPlanAuthorizedFlagIsDispatch: false,
      providerSelectionIsProviderExecute: false,
      providerGrantIsProviderExecute: false,
      agentStrategyIsSubAgentRuntimeInvocation: false,
      governanceStrategyExecuteActionIsRuntimeInvocation: false,
      persistenceWritesLimitedToDecisionArtifacts: true,
      desktopPrimitiveInvocationAllowed: false,
      hostDispatchAllowed: false,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      desktopDecisionRunnerCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatDesktopDecisionRunnerBoundaryAuditResult(review);
  const json = formatDesktopDecisionRunnerBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
    !text.includes(marker)
      && !json.includes(marker)
      && !input.governanceControlPlaneText.includes(marker)
      && !input.governanceReadmeText.includes(marker)
  );
}

function collectReasons(
  checks: DesktopDecisionRunnerBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `desktop_decision_runner_boundary_${name}`);
}

async function read(cwd: string, relativePath: string): Promise<string> {
  return readFile(join(cwd, relativePath), "utf8");
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectDesktopDecisionRunnerBoundaryAuditInput();
  const review = reviewDesktopDecisionRunnerBoundaryAudit(input);

  console.log(formatDesktopDecisionRunnerBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Desktop decision runner boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
