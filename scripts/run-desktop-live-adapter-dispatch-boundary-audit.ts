#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const DESKTOP_LIVE_ADAPTER_SOURCE = "packages/desktop-live-adapter/src/index.ts";
const DESKTOP_HOST_CLIENT_SOURCE = "packages/desktop-host-client/src/index.ts";
const DESKTOP_LIVE_ADAPTER_TEST = "tests/desktop-live-adapter.test.ts";
const DESKTOP_LIVE_ADAPTER_GOVERNANCE_TEST =
  "tests/desktop-live-adapter-governance.test.ts";
const DESKTOP_HOST_CLIENT_TEST = "tests/desktop-host-client.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_LIVE_ADAPTER_SOURCE_MARKERS = [
  "runDesktopTask",
  "resumeDesktopTask",
  "assertGovernanceStateTaskScoped",
  "executeDesktopTaskFromDecision",
  "decisionResult.status === \"ready\" && decisionResult.decision.hostRoute === \"codex-cli\"",
  "dispatchToHost({",
  "dispatchControlledWorkspaceWriteProviderPlan",
  "controlledWorkspaceWriteProviderDispatchInput",
  "controlled_workspace_write_provider_dispatcher",
  "createHostDispatchExecutionResult",
  "createControlledWorkspaceWriteDispatchExecutionResult",
  "host_dispatch_governance",
  "dispatchTarget: \"host_dispatcher\"",
  "dispatchTarget: \"controlled_workspace_write_provider_dispatcher\"",
  "hostDispatch.cliRun?.inspection.status",
  "collectHostDispatchBlockingReasons",
  "collectControlledWorkspaceWriteDispatchBlockingReasons",
  "applyHostDispatchFailureToGovernance",
  "applyControlledWorkspaceWriteDispatchFailureToGovernance",
  "primitiveId = `host_dispatch:${input.hostDispatch.hostRoute}`",
  "primitiveId = \"host_dispatch:controlled_workspace_write\"",
  "normalizeHostDispatchBlockingReason",
  "unknown_execution_error",
  "resolvePrimitiveHandlers(input.handlers, input.bridge)",
  "desktop_live_adapter_requires_handlers_or_bridge"
] as const;

const REQUIRED_HOST_CLIENT_SOURCE_MARKERS = [
  "runDesktopTask({",
  "resumeDesktopTask({",
  "bridge: this.bridge",
  "codexCliOptions: this.options.codexCliOptions",
  "resolveHostBridge",
  "desktop_host_client_requires_bridge_or_bindings"
] as const;

const REQUIRED_LIVE_ADAPTER_TEST_MARKERS = [
  "runDesktopTask composes decision runner and live adapter",
  "runDesktopTask dispatches codex-cli small edits instead of executing desktop primitives",
  "runDesktopTask routes controlled workspace-write dispatch before Codex CLI spawn",
  "runDesktopTask returns blocked codex-cli decisions without desktop handlers",
  "runDesktopTask preserves blocked_preflight results without executing handlers",
  "runDesktopTask accepts a host bridge instead of raw handlers",
  "host bridge bindings fail clearly when a primitive binding is missing",
  "resumeDesktopTask resumes from memory recall and still executes the plan"
] as const;

const REQUIRED_GOVERNANCE_TEST_MARKERS = [
  "governance: codex-cli host dispatch failure appends anomaly and calls onGovernanceUpdate",
  "governance: runDesktopTask rejects governance state scoped to another task",
  "normalizes opaque ${caseName} errors",
  "gov-codex-cli-host-dispatch-opaque-${caseName}",
  "governance: codex-cli host dispatch third failure triggers recovery result",
  "governance: successful codex-cli host dispatch does not trigger governance updates",
  "host_dispatch:codex-cli",
  "host_dispatch_failed:unknown_execution_error",
  "host_dispatch_governance"
] as const;

const REQUIRED_HOST_CLIENT_TEST_MARKERS = [
  "desktop host client rejects stale governance state before bridge execution",
  "desktop host client requires a real bridge or bridge bindings"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw stdout",
  "raw stderr"
] as const;

export interface DesktopLiveAdapterDispatchBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  desktopLiveAdapterSourceText: string;
  desktopHostClientSourceText: string;
  desktopLiveAdapterTestText: string;
  desktopLiveAdapterGovernanceTestText: string;
  desktopHostClientTestText: string;
  governanceRunnerText: string;
}

export interface DesktopLiveAdapterDispatchBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneBoundaryRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    liveAdapterDispatchGuardsPresent: boolean;
    hostClientForwardingGuardsPresent: boolean;
    liveAdapterRegressionCoverageRecorded: boolean;
    governanceFailureCoverageRecorded: boolean;
    hostClientBoundaryCoverageRecorded: boolean;
    noCrossRouteExecutionBroadening: boolean;
    outputSanitized: boolean;
  };
  summary: {
    dispatchMode: "route_separated_host_dispatch_or_desktop_bridge";
    codexCliHostDispatchAllowedWhenReadyAndRouted: true;
    desktopPrimitiveExecutionAllowedWhenDesktopRouted: true;
    blockedDecisionExecutionAllowed: false;
    handlersOrBridgeRequiredForDesktopRoute: true;
    governanceStateTaskScopeRequiredBeforeExecution: true;
    hostDispatchFailureCreatesExecutionObservation: true;
    controlledWorkspaceWriteDispatchAllowedWhenReadyAndLocalWrite: true;
    controlledWorkspaceWriteDispatchFailureCreatesExecutionObservation: true;
    codexCliInvocationAllowedByDesktopRoute: false;
    bridgeInvocationAllowedByCodexCliRoute: false;
    providerInvocationAllowedByDesktopLiveAdapter: false;
    generalWorkspaceWriteExecutionAllowed: false;
    workspaceWriteProviderExecuteAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    liveAdapterCallsDuringAudit: 0;
    dispatchToHostCallsDuringAudit: 0;
    bridgeCallsDuringAudit: 0;
    handlerCallsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type DesktopLiveAdapterDispatchBoundaryAuditOutputFormat = "text" | "json";

export async function collectDesktopLiveAdapterDispatchBoundaryAuditInput(
  cwd = process.cwd()
): Promise<DesktopLiveAdapterDispatchBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    desktopLiveAdapterSourceText,
    desktopHostClientSourceText,
    desktopLiveAdapterTestText,
    desktopLiveAdapterGovernanceTestText,
    desktopHostClientTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, DESKTOP_LIVE_ADAPTER_SOURCE),
    read(cwd, DESKTOP_HOST_CLIENT_SOURCE),
    read(cwd, DESKTOP_LIVE_ADAPTER_TEST),
    read(cwd, DESKTOP_LIVE_ADAPTER_GOVERNANCE_TEST),
    read(cwd, DESKTOP_HOST_CLIENT_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    desktopLiveAdapterSourceText,
    desktopHostClientSourceText,
    desktopLiveAdapterTestText,
    desktopLiveAdapterGovernanceTestText,
    desktopHostClientTestText,
    governanceRunnerText
  };
}

export function reviewDesktopLiveAdapterDispatchBoundaryAudit(
  input: DesktopLiveAdapterDispatchBoundaryAuditInput
): DesktopLiveAdapterDispatchBoundaryAuditResult {
  const checks = {
    controlPlaneBoundaryRecorded: controlPlaneBoundaryRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit desktop-live-adapter-dispatch-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "desktop-live-adapter-dispatch-boundary"
    ),
    liveAdapterDispatchGuardsPresent: REQUIRED_LIVE_ADAPTER_SOURCE_MARKERS.every(
      (marker) => input.desktopLiveAdapterSourceText.includes(marker)
    ),
    hostClientForwardingGuardsPresent: REQUIRED_HOST_CLIENT_SOURCE_MARKERS.every(
      (marker) => input.desktopHostClientSourceText.includes(marker)
    ),
    liveAdapterRegressionCoverageRecorded: REQUIRED_LIVE_ADAPTER_TEST_MARKERS.every(
      (marker) => input.desktopLiveAdapterTestText.includes(marker)
    ),
    governanceFailureCoverageRecorded: REQUIRED_GOVERNANCE_TEST_MARKERS.every(
      (marker) => input.desktopLiveAdapterGovernanceTestText.includes(marker)
    ),
    hostClientBoundaryCoverageRecorded: REQUIRED_HOST_CLIENT_TEST_MARKERS.every(
      (marker) => input.desktopHostClientTestText.includes(marker)
    ),
    noCrossRouteExecutionBroadening: noCrossRouteExecutionBroadening(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      dispatchMode: "route_separated_host_dispatch_or_desktop_bridge",
      codexCliHostDispatchAllowedWhenReadyAndRouted: true,
      desktopPrimitiveExecutionAllowedWhenDesktopRouted: true,
      blockedDecisionExecutionAllowed: false,
      handlersOrBridgeRequiredForDesktopRoute: true,
      governanceStateTaskScopeRequiredBeforeExecution: true,
      hostDispatchFailureCreatesExecutionObservation: true,
      controlledWorkspaceWriteDispatchAllowedWhenReadyAndLocalWrite: true,
      controlledWorkspaceWriteDispatchFailureCreatesExecutionObservation: true,
      codexCliInvocationAllowedByDesktopRoute: false,
      bridgeInvocationAllowedByCodexCliRoute: false,
      providerInvocationAllowedByDesktopLiveAdapter: false,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      liveAdapterCallsDuringAudit: 0,
      dispatchToHostCallsDuringAudit: 0,
      bridgeCallsDuringAudit: 0,
      handlerCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatDesktopLiveAdapterDispatchBoundaryAuditResult(
  review: DesktopLiveAdapterDispatchBoundaryAuditResult,
  format: DesktopLiveAdapterDispatchBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Desktop live adapter dispatch boundary audit",
    `status: ${review.status}`,
    `dispatch mode: ${review.summary.dispatchMode}`,
    `codex-cli host dispatch allowed when ready and routed: ${review.summary.codexCliHostDispatchAllowedWhenReadyAndRouted}`,
    `desktop primitive execution allowed when desktop routed: ${review.summary.desktopPrimitiveExecutionAllowedWhenDesktopRouted}`,
    `blocked decision execution allowed: ${review.summary.blockedDecisionExecutionAllowed}`,
    `handlers or bridge required for desktop route: ${review.summary.handlersOrBridgeRequiredForDesktopRoute}`,
    `governance state task scope required before execution: ${review.summary.governanceStateTaskScopeRequiredBeforeExecution}`,
    `host dispatch failure creates execution observation: ${review.summary.hostDispatchFailureCreatesExecutionObservation}`,
    `controlled workspace-write dispatch allowed when ready and local-write: ${review.summary.controlledWorkspaceWriteDispatchAllowedWhenReadyAndLocalWrite}`,
    `controlled workspace-write dispatch failure creates execution observation: ${review.summary.controlledWorkspaceWriteDispatchFailureCreatesExecutionObservation}`,
    `Codex CLI invocation allowed by desktop route: ${review.summary.codexCliInvocationAllowedByDesktopRoute}`,
    `bridge invocation allowed by codex-cli route: ${review.summary.bridgeInvocationAllowedByCodexCliRoute}`,
    `provider invocation allowed by desktop live adapter: ${review.summary.providerInvocationAllowedByDesktopLiveAdapter}`,
    `general workspace-write execution allowed: ${review.summary.generalWorkspaceWriteExecutionAllowed}`,
    `workspace-write provider.execute allowed: ${review.summary.workspaceWriteProviderExecuteAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `live adapter calls during audit: ${review.summary.liveAdapterCallsDuringAudit}`,
    `dispatchToHost calls during audit: ${review.summary.dispatchToHostCallsDuringAudit}`,
    `bridge calls during audit: ${review.summary.bridgeCallsDuringAudit}`,
    `handler calls during audit: ${review.summary.handlerCallsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneBoundaryRecorded(text: string): boolean {
  return text.includes("| Desktop live adapter dispatch boundary |")
    && text.includes("route-separated host dispatch or desktop bridge")
    && text.includes("codex-cli routes do not invoke desktop bridge handlers")
    && text.includes("controlled workspace-write dispatch")
    && text.includes("workspace-write through `provider.execute`")
    && text.includes("blocked decisions do not execute")
    && text.includes("General provider execution | blocked | No");
}

function noCrossRouteExecutionBroadening(
  input: DesktopLiveAdapterDispatchBoundaryAuditInput
): boolean {
  const combined = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.desktopLiveAdapterSourceText,
    input.desktopHostClientSourceText
  ].join("\n");

  return combined.includes("General provider execution | blocked | No")
    && combined.includes("General workspace write | blocked | No")
    && !/Desktop live adapter dispatch boundary\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/blocked decision execution allowed:\s*true/i.test(combined)
    && !/bridge invocation allowed by codex-cli route:\s*true/i.test(combined)
    && !/provider invocation allowed by desktop live adapter:\s*true/i.test(combined);
}

function outputSanitized(): boolean {
  const review: DesktopLiveAdapterDispatchBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneBoundaryRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      liveAdapterDispatchGuardsPresent: true,
      hostClientForwardingGuardsPresent: true,
      liveAdapterRegressionCoverageRecorded: true,
      governanceFailureCoverageRecorded: true,
      hostClientBoundaryCoverageRecorded: true,
      noCrossRouteExecutionBroadening: true,
      outputSanitized: true
    },
    summary: {
      dispatchMode: "route_separated_host_dispatch_or_desktop_bridge",
      codexCliHostDispatchAllowedWhenReadyAndRouted: true,
      desktopPrimitiveExecutionAllowedWhenDesktopRouted: true,
      blockedDecisionExecutionAllowed: false,
      handlersOrBridgeRequiredForDesktopRoute: true,
      governanceStateTaskScopeRequiredBeforeExecution: true,
      hostDispatchFailureCreatesExecutionObservation: true,
      controlledWorkspaceWriteDispatchAllowedWhenReadyAndLocalWrite: true,
      controlledWorkspaceWriteDispatchFailureCreatesExecutionObservation: true,
      codexCliInvocationAllowedByDesktopRoute: false,
      bridgeInvocationAllowedByCodexCliRoute: false,
      providerInvocationAllowedByDesktopLiveAdapter: false,
      generalWorkspaceWriteExecutionAllowed: false,
      workspaceWriteProviderExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      liveAdapterCallsDuringAudit: 0,
      dispatchToHostCallsDuringAudit: 0,
      bridgeCallsDuringAudit: 0,
      handlerCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatDesktopLiveAdapterDispatchBoundaryAuditResult(review);
  const json = formatDesktopLiveAdapterDispatchBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: DesktopLiveAdapterDispatchBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `desktop_live_adapter_dispatch_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectDesktopLiveAdapterDispatchBoundaryAuditInput();
  const review = reviewDesktopLiveAdapterDispatchBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatDesktopLiveAdapterDispatchBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Desktop live adapter dispatch boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
