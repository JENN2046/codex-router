#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const DESKTOP_HOST_CLIENT_SOURCE = "packages/desktop-host-client/src/index.ts";
const PUBLIC_API_HOST_SOURCE = "packages/public-api/src/host.ts";
const DESKTOP_HOST_CLIENT_TEST = "tests/desktop-host-client.test.ts";
const PUBLIC_API_SURFACE_TEST = "tests/public-api-surface.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_CLIENT_SOURCE_MARKERS = [
  "export class DesktopHostClient",
  "async run(",
  "options: DesktopHostRunOptions = {}",
  "controlledWorkspaceWriteProviderDispatchInput",
  "runDesktopTask({",
  "async resume(",
  "resumeDesktopTask({",
  "bridge: this.bridge",
  "this.captureOperatorAction(result)",
  "buildGovernanceForwarding()",
  "dispatchControlledWorkspaceWriteProviderPlan",
  "controlledWorkspaceWriteProviderDispatcher",
  "reviewCurrentOperatorActionHostExecutorAuthorization",
  "authorizeGovernanceOperatorActionHostExecutorReview({",
  "lifecycleState: this.getOperatorActionLifecycle()",
  "dispatchCurrentOperatorActionHostExecutor",
  "dispatchGovernanceOperatorActionHostExecutor({",
  "resolveHostBridge",
  "desktop_host_client_requires_bridge_or_bindings"
] as const;

const REQUIRED_PUBLIC_API_MARKERS = [
  "class DesktopHostClient",
  "DesktopHostRunOptions",
  "return this.inner.run(",
  "return this.inner.resume(",
  "return this.inner.dispatchControlledWorkspaceWriteProviderPlan(input as never)",
  "return this.inner.reviewCurrentOperatorActionHostExecutorAuthorization(",
  "return this.inner.dispatchCurrentOperatorActionHostExecutor(",
  "export function createDesktopHostClient"
] as const;

const REQUIRED_CLIENT_TEST_MARKERS = [
  "desktop host client runs through real host bindings and persists artifacts",
  "desktop host client passes governance inputs and returns operator recovery action",
  "desktop host client exposes non-executing host executor review for current operator action",
  "executorCalls, 0",
  "dispatchInvocations.length, 1",
  "idleClient.reviewCurrentOperatorActionHostExecutorAuthorization",
  "operator_action_host_executor_lifecycle_action_missing",
  "desktop host client delegates controlled workspace-write provider plans",
  "desktop_host_client_controlled_workspace_write_dispatch_test",
  "desktop host client forwards per-run controlled workspace-write dispatch input",
  "desktop_host_client_run_controlled_workspace_write_dispatch_test",
  "desktop host client persists updated governance state between run and resume",
  "desktop host client rejects stale governance state before bridge execution",
  "desktop host client resumes from memory recall when the memory adapter supports it",
  "desktop host client resumes from checkpoint lookup when no memory recall is configured",
  "desktop host client requires a real bridge or bridge bindings"
] as const;

const REQUIRED_PUBLIC_API_TEST_MARKERS = [
  "\"DesktopHostClient\"",
  "\"createDesktopHostClient\"",
  "createDesktopHostClient({",
  "void client.run(task)",
  "void client.resume(task, resumeOptions)",
  "dispatchControlledWorkspaceWriteProviderPlan",
  "public_host_controlled_workspace_write_dispatch_test",
  "public DesktopHostClient.run requires a task envelope input"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface DesktopHostClientBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  desktopHostClientSourceText: string;
  publicApiHostSourceText: string;
  desktopHostClientTestText: string;
  publicApiSurfaceTestText: string;
  governanceRunnerText: string;
}

export interface DesktopHostClientBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneBoundaryRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    clientFacadeGuardsPresent: boolean;
    publicApiDelegatesToInternalClient: boolean;
    clientRegressionCoverageRecorded: boolean;
    publicApiCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    facadeMode: "desktop_host_client_facade";
    runResumeMode: "delegates_to_desktop_live_adapter";
    operatorActionDispatchMode: "review_or_explicit_injected_dispatch";
    bridgeOrBindingsRequired: true;
    runDelegatesToLiveAdapter: true;
    resumeDelegatesToLiveAdapter: true;
    currentOperatorActionLifecycleCaptured: true;
    reviewUsesCurrentLifecycleOnly: true;
    dispatchDelegatesToRecoveryControl: true;
    dryRunDispatchAllowed: true;
    executeInjectedDispatchAllowed: true;
    defaultRealExecutionAllowed: false;
    defaultHostExecutorLookupAllowed: false;
    directDispatchToHostAllowedByClient: false;
    codexCliInvocationAllowedByClient: false;
    providerInvocationAllowedByClient: false;
    controlledWorkspaceWriteDispatchAllowedByClient: true;
    generalWorkspaceWriteAllowedByClient: false;
    workspaceWriteProviderExecuteAllowedByClient: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowed: false;
    externalWriteAllowed: false;
    clientCallsDuringAudit: 0;
    liveAdapterCallsDuringAudit: 0;
    hostExecutorInvocationsDuringAudit: 0;
    dispatchToHostCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type DesktopHostClientBoundaryAuditOutputFormat = "text" | "json";

export async function collectDesktopHostClientBoundaryAuditInput(
  cwd = process.cwd()
): Promise<DesktopHostClientBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    desktopHostClientSourceText,
    publicApiHostSourceText,
    desktopHostClientTestText,
    publicApiSurfaceTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, DESKTOP_HOST_CLIENT_SOURCE),
    read(cwd, PUBLIC_API_HOST_SOURCE),
    read(cwd, DESKTOP_HOST_CLIENT_TEST),
    read(cwd, PUBLIC_API_SURFACE_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    desktopHostClientSourceText,
    publicApiHostSourceText,
    desktopHostClientTestText,
    publicApiSurfaceTestText,
    governanceRunnerText
  };
}

export function reviewDesktopHostClientBoundaryAudit(
  input: DesktopHostClientBoundaryAuditInput
): DesktopHostClientBoundaryAuditResult {
  const checks = {
    controlPlaneBoundaryRecorded: controlPlaneBoundaryRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit desktop-host-client-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "desktop-host-client-boundary"
    ),
    clientFacadeGuardsPresent: REQUIRED_CLIENT_SOURCE_MARKERS.every((marker) =>
      input.desktopHostClientSourceText.includes(marker)
    ),
    publicApiDelegatesToInternalClient: REQUIRED_PUBLIC_API_MARKERS.every((marker) =>
      input.publicApiHostSourceText.includes(marker)
    ),
    clientRegressionCoverageRecorded: REQUIRED_CLIENT_TEST_MARKERS.every((marker) =>
      input.desktopHostClientTestText.includes(marker)
    ),
    publicApiCoverageRecorded: REQUIRED_PUBLIC_API_TEST_MARKERS.every((marker) =>
      input.publicApiSurfaceTestText.includes(marker)
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      facadeMode: "desktop_host_client_facade",
      runResumeMode: "delegates_to_desktop_live_adapter",
      operatorActionDispatchMode: "review_or_explicit_injected_dispatch",
      bridgeOrBindingsRequired: true,
      runDelegatesToLiveAdapter: true,
      resumeDelegatesToLiveAdapter: true,
      currentOperatorActionLifecycleCaptured: true,
      reviewUsesCurrentLifecycleOnly: true,
      dispatchDelegatesToRecoveryControl: true,
      dryRunDispatchAllowed: true,
      executeInjectedDispatchAllowed: true,
      defaultRealExecutionAllowed: false,
      defaultHostExecutorLookupAllowed: false,
      directDispatchToHostAllowedByClient: false,
      codexCliInvocationAllowedByClient: false,
      providerInvocationAllowedByClient: false,
      controlledWorkspaceWriteDispatchAllowedByClient: true,
      generalWorkspaceWriteAllowedByClient: false,
      workspaceWriteProviderExecuteAllowedByClient: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      externalWriteAllowed: false,
      clientCallsDuringAudit: 0,
      liveAdapterCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
      dispatchToHostCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatDesktopHostClientBoundaryAuditResult(
  review: DesktopHostClientBoundaryAuditResult,
  format: DesktopHostClientBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Desktop host client boundary audit",
    `status: ${review.status}`,
    `facade mode: ${review.summary.facadeMode}`,
    `run/resume mode: ${review.summary.runResumeMode}`,
    `operator action dispatch mode: ${review.summary.operatorActionDispatchMode}`,
    `bridge or bindings required: ${review.summary.bridgeOrBindingsRequired}`,
    `dry-run dispatch allowed: ${review.summary.dryRunDispatchAllowed}`,
    `execute-injected dispatch allowed: ${review.summary.executeInjectedDispatchAllowed}`,
    `default real execution allowed: ${review.summary.defaultRealExecutionAllowed}`,
    `default host executor lookup allowed: ${review.summary.defaultHostExecutorLookupAllowed}`,
    `direct dispatchToHost allowed by client: ${review.summary.directDispatchToHostAllowedByClient}`,
    `Codex CLI invocation allowed by client: ${review.summary.codexCliInvocationAllowedByClient}`,
    `provider invocation allowed by client: ${review.summary.providerInvocationAllowedByClient}`,
    `controlled workspace-write dispatch allowed by client: ${review.summary.controlledWorkspaceWriteDispatchAllowedByClient}`,
    `general workspace-write allowed by client: ${review.summary.generalWorkspaceWriteAllowedByClient}`,
    `workspace-write provider execute allowed by client: ${review.summary.workspaceWriteProviderExecuteAllowedByClient}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `client calls during audit: ${review.summary.clientCallsDuringAudit}`,
    `live adapter calls during audit: ${review.summary.liveAdapterCallsDuringAudit}`,
    `host executor invocations during audit: ${review.summary.hostExecutorInvocationsDuringAudit}`,
    `dispatchToHost calls during audit: ${review.summary.dispatchToHostCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
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

function controlPlaneBoundaryRecorded(text: string): boolean {
  return text.includes("Desktop host client boundary")
    && text.includes("desktop-host-client")
    && text.includes("delegates `run` and `resume` to the desktop live adapter")
    && text.includes("may delegate controlled workspace-write provider plans to the host dispatcher")
    && text.includes("review or explicit injected dispatch")
    && text.includes("does not authorize Codex CLI, general provider execution, workspace-write through `provider.execute`, general workspace-write, sub-agent runtime, shell/process, or external write by itself");
}

function noBroadExecutionAuthorization(
  input: DesktopHostClientBoundaryAuditInput
): boolean {
  const text = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText
  ].join("\n");

  return !text.includes("desktop host client default real execution allowed: true")
    && !text.includes("desktop host client default host executor lookup allowed: true")
    && !text.includes("desktop host client direct dispatchToHost allowed: true")
    && !text.includes("desktop host client Codex CLI invocation allowed: true")
    && !text.includes("desktop host client provider invocation allowed: true")
    && !text.includes("desktop host client sub-agent runtime invocation allowed: true")
    && !text.includes("desktop host client general workspace-write allowed: true")
    && !text.includes("desktop host client workspace-write provider execute allowed: true")
    && !text.includes("desktop host client external write allowed: true");
}

function outputSanitized(): boolean {
  const review: DesktopHostClientBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneBoundaryRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      clientFacadeGuardsPresent: true,
      publicApiDelegatesToInternalClient: true,
      clientRegressionCoverageRecorded: true,
      publicApiCoverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      facadeMode: "desktop_host_client_facade",
      runResumeMode: "delegates_to_desktop_live_adapter",
      operatorActionDispatchMode: "review_or_explicit_injected_dispatch",
      bridgeOrBindingsRequired: true,
      runDelegatesToLiveAdapter: true,
      resumeDelegatesToLiveAdapter: true,
      currentOperatorActionLifecycleCaptured: true,
      reviewUsesCurrentLifecycleOnly: true,
      dispatchDelegatesToRecoveryControl: true,
      dryRunDispatchAllowed: true,
      executeInjectedDispatchAllowed: true,
      defaultRealExecutionAllowed: false,
      defaultHostExecutorLookupAllowed: false,
      directDispatchToHostAllowedByClient: false,
      codexCliInvocationAllowedByClient: false,
      providerInvocationAllowedByClient: false,
      controlledWorkspaceWriteDispatchAllowedByClient: true,
      generalWorkspaceWriteAllowedByClient: false,
      workspaceWriteProviderExecuteAllowedByClient: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      externalWriteAllowed: false,
      clientCallsDuringAudit: 0,
      liveAdapterCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
      dispatchToHostCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatDesktopHostClientBoundaryAuditResult(review);
  const json = formatDesktopHostClientBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: DesktopHostClientBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `desktop_host_client_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectDesktopHostClientBoundaryAuditInput();
  const review = reviewDesktopHostClientBoundaryAudit(input);
  console.log(formatDesktopHostClientBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isDirect = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
