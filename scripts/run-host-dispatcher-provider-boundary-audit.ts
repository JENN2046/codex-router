#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const HOST_DISPATCHER_SOURCE = "packages/host-dispatcher/src/index.ts";
const HOST_DISPATCHER_TEST = "tests/host-dispatcher.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_HOST_DISPATCHER_SOURCE_MARKERS = [
  "dispatchReadOnlyProviderPlan",
  "dispatchReadOnlyRunnerResultToProvider",
  "dispatchFormalReadOnlyRunnerResultToProvider",
  "dispatchControlledWorkspaceWriteProviderPlan",
  "prepareControlledWorkspaceWriteHostProviderDispatch",
  "prepareControlledWorkspaceWriteProviderDispatchInput",
  "dispatchControlledWorkspaceWriteProviderExecution",
  "ControlledWorkspaceWriteHostProviderDispatchInput",
  "host_dispatcher_read_only_provider_dispatch_requires_codex_cli",
  "plan.sideEffectClass !== \"read_only\"",
  "plan.sandboxProfile.mode !== \"read-only\"",
  "createApprovedProviderExecutionPermit",
  "createBlockedProviderExecutionPermit",
  "input.provider.execute(plan",
  "validateReadOnlyRunnerResultForProviderDispatch",
  "runner_result_host_route_not_codex_cli",
  "runner_result_tool_access_not_read_only",
  "runner_result_provider_grant_missing",
  "runner_result_provider_grant_provider_mismatch",
  "runner_result_provider_grant_side_effect_not_read_only",
  "runner_result_provider_grant_sandbox_not_read_only",
  "selectProviderForRoutingDecision",
  "host_dispatcher_formal_read_only_provider_registry_required",
  "host_dispatcher_formal_read_only_provider_metadata_required",
  "sanitizeProviderExecutionError"
] as const;

const REQUIRED_HOST_DISPATCHER_TEST_MARKERS = [
  "host dispatcher read-only provider dispatch creates permit and uses fake in-memory execution",
  "host dispatcher read-only provider dry run does not spawn",
  "host dispatcher rejects workspace-write provider dispatch before spawn",
  "host dispatcher routes controlled workspace-write through local runner",
  "host dispatcher prepares controlled workspace-write dispatch input",
  "host dispatcher requires controlled workspace-write preflight artifact",
  "controlled_workspace_write_dispatch_preflight_artifact_store_missing",
  "providerExecuteInvoked, false",
  "host dispatcher rejects invalid provider plans before permit issuance",
  "host dispatcher dispatches ready read-only runner results through provider permits",
  "host dispatcher validates provider registry selection before read-only runner dispatch",
  "host dispatcher formal read-only dispatch requires registry and metadata before spawn",
  "host dispatcher formal read-only dispatch executes only through guarded fake spawner",
  "host dispatcher dry-runs read-only runner provider dispatch without spawn",
  "host dispatcher rejects invalid runner result states before provider dispatch",
  "host dispatcher rejects invalid provider grants before spawn",
  "host dispatcher rejects missing registry providers before permit and execute",
  "host dispatcher rejects disabled registry providers before permit and execute",
  "host dispatcher rejects registry manifest mismatches before permit and execute",
  "host dispatcher rejects registry capability mismatches before permit and execute",
  "assertSafeDispatch"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "prompt",
  "stdout",
  "stderr"
] as const;

export interface HostDispatcherProviderBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  hostDispatcherSourceText: string;
  hostDispatcherTestText: string;
  governanceRunnerText: string;
}

export interface HostDispatcherProviderBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneBoundaryRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    hostDispatcherSourceGuardsPresent: boolean;
    hostDispatcherRegressionCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    dispatchMode: "controlled_read_only_and_workspace_write_provider_dispatch";
    permittedProviderId: "codex-cli";
    permittedSideEffectClass: "read_only";
    permittedSandbox: "read-only";
    readOnlyProviderDispatchAllowed: true;
    controlledWorkspaceWriteDispatchAllowed: true;
    formalDispatchRequiresRegistry: true;
    formalDispatchRequiresMetadata: true;
    generalProviderExecutionAllowed: false;
    generalWorkspaceWriteAllowedByHostDispatcher: false;
    workspaceWriteProviderExecuteAllowed: false;
    defaultRealCodexCliAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    dispatcherCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    realCodexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type HostDispatcherProviderBoundaryAuditOutputFormat = "text" | "json";

export async function collectHostDispatcherProviderBoundaryAuditInput(
  cwd = process.cwd()
): Promise<HostDispatcherProviderBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    hostDispatcherSourceText,
    hostDispatcherTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, HOST_DISPATCHER_SOURCE),
    read(cwd, HOST_DISPATCHER_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    hostDispatcherSourceText,
    hostDispatcherTestText,
    governanceRunnerText
  };
}

export function reviewHostDispatcherProviderBoundaryAudit(
  input: HostDispatcherProviderBoundaryAuditInput
): HostDispatcherProviderBoundaryAuditResult {
  const checks = {
    controlPlaneBoundaryRecorded: controlPlaneBoundaryRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit host-dispatcher-provider-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "host-dispatcher-provider-boundary"
    ),
    hostDispatcherSourceGuardsPresent: REQUIRED_HOST_DISPATCHER_SOURCE_MARKERS.every(
      (marker) => input.hostDispatcherSourceText.includes(marker)
    ),
    hostDispatcherRegressionCoverageRecorded:
      REQUIRED_HOST_DISPATCHER_TEST_MARKERS.every((marker) =>
        input.hostDispatcherTestText.includes(marker)
      ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      dispatchMode: "controlled_read_only_and_workspace_write_provider_dispatch",
      permittedProviderId: "codex-cli",
      permittedSideEffectClass: "read_only",
      permittedSandbox: "read-only",
      readOnlyProviderDispatchAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      formalDispatchRequiresRegistry: true,
      formalDispatchRequiresMetadata: true,
      generalProviderExecutionAllowed: false,
      generalWorkspaceWriteAllowedByHostDispatcher: false,
      workspaceWriteProviderExecuteAllowed: false,
      defaultRealCodexCliAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      dispatcherCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatHostDispatcherProviderBoundaryAuditResult(
  review: HostDispatcherProviderBoundaryAuditResult,
  format: HostDispatcherProviderBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Host dispatcher provider boundary audit",
    `status: ${review.status}`,
    `dispatch mode: ${review.summary.dispatchMode}`,
    `permitted provider id: ${review.summary.permittedProviderId}`,
    `permitted side-effect class: ${review.summary.permittedSideEffectClass}`,
    `permitted sandbox: ${review.summary.permittedSandbox}`,
    `read-only provider dispatch allowed: ${review.summary.readOnlyProviderDispatchAllowed}`,
    `controlled workspace-write dispatch allowed: ${review.summary.controlledWorkspaceWriteDispatchAllowed}`,
    `formal dispatch requires registry: ${review.summary.formalDispatchRequiresRegistry}`,
    `formal dispatch requires metadata: ${review.summary.formalDispatchRequiresMetadata}`,
    `general provider execution allowed: ${review.summary.generalProviderExecutionAllowed}`,
    `general workspace-write allowed by host dispatcher: ${review.summary.generalWorkspaceWriteAllowedByHostDispatcher}`,
    `workspace-write provider execute allowed: ${review.summary.workspaceWriteProviderExecuteAllowed}`,
    `default real Codex CLI allowed: ${review.summary.defaultRealCodexCliAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `dispatcher calls during audit: ${review.summary.dispatcherCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `real Codex CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneBoundaryRecorded(text: string): boolean {
  return text.includes("| Host dispatcher provider boundary |")
    && text.includes("controlled read-only and controlled workspace-write provider dispatch")
    && text.includes("may delegate controlled workspace-write input preparation and dispatch to `governance-internal-controlled-provider-dispatcher`")
    && text.includes("controlled workspace-write requires permit v2, preflight artifact binding, declared operations, exact authorization id, and the local runner")
    && text.includes("Formal read-only dispatch requires registry and metadata")
    && text.includes("General provider execution | blocked | No");
}

function noBroadExecutionAuthorization(
  input: HostDispatcherProviderBoundaryAuditInput
): boolean {
  const combined = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.hostDispatcherSourceText
  ].join("\n");

  return combined.includes("General provider execution | blocked | No")
    && combined.includes("General workspace write | blocked | No")
    && !/Host dispatcher provider boundary\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/General provider execution\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/General workspace write\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/general workspace-write allowed by host dispatcher:\s*true/i.test(combined)
    && !/workspace-write provider execute allowed:\s*true/i.test(combined);
}

function outputSanitized(): boolean {
  const review: HostDispatcherProviderBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneBoundaryRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      hostDispatcherSourceGuardsPresent: true,
      hostDispatcherRegressionCoverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      dispatchMode: "controlled_read_only_and_workspace_write_provider_dispatch",
      permittedProviderId: "codex-cli",
      permittedSideEffectClass: "read_only",
      permittedSandbox: "read-only",
      readOnlyProviderDispatchAllowed: true,
      controlledWorkspaceWriteDispatchAllowed: true,
      formalDispatchRequiresRegistry: true,
      formalDispatchRequiresMetadata: true,
      generalProviderExecutionAllowed: false,
      generalWorkspaceWriteAllowedByHostDispatcher: false,
      workspaceWriteProviderExecuteAllowed: false,
      defaultRealCodexCliAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      dispatcherCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatHostDispatcherProviderBoundaryAuditResult(review);
  const json = formatHostDispatcherProviderBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: HostDispatcherProviderBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `host_dispatcher_provider_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectHostDispatcherProviderBoundaryAuditInput();
  const review = reviewHostDispatcherProviderBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatHostDispatcherProviderBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Host dispatcher provider boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
