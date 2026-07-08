#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const HOST_CLIENT_EXAMPLE_SOURCE = "packages/host-client-example/src/index.ts";
const HOST_CLIENT_EXAMPLE_TEST = "tests/host-client-example.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_SOURCE_MARKERS = [
  "export class ExampleDesktopHostClient",
  "async run(task: TaskEnvelopeInput)",
  "runDesktopTask({",
  "async resume(",
  "resumeDesktopTask({",
  "bridge: this.bridge",
  "this.captureOperatorAction(result)",
  "buildGovernanceForwarding()",
  "buildPersistence()",
  "createExampleDesktopHostClient",
  "createExampleHostBridge",
  "createPrimitiveSuccessEnvelope(\"shell_command\"",
  "createPrimitiveSuccessEnvelope(\"apply_patch\"",
  "createHostBridgeFromBindings({"
] as const;

const REQUIRED_TEST_MARKERS = [
  "example host client runs a task end-to-end and persists checkpoint state",
  "example host client exposes runtime governance operator action",
  "example host client consumes operator action receipts through an injected store",
  "example host client persists updated governance state between run and resume",
  "example host client rejects stale governance state before bridge execution",
  "example host client resumes from memory and surfaces resume source",
  "example host client resumes from shared memory across client instances",
  "example host client can surface typed primitive failures through a failing bridge",
  "example host client blocks release execution when telemetry is disabled",
  "host-client-example keeps internal stores and wrapper collectors out of the public surface"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw stdout",
  "raw stderr"
] as const;

export interface HostClientExampleBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  hostClientExampleSourceText: string;
  hostClientExampleTestText: string;
  governanceRunnerText: string;
}

export interface HostClientExampleBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneBoundaryRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    exampleFacadeGuardsPresent: boolean;
    exampleRegressionCoverageRecorded: boolean;
    noHostExecutorSurface: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    exampleMode: "example_host_client_facade";
    runResumeMode: "delegates_to_desktop_live_adapter";
    exampleBridgeMode: "simulated_desktop_primitive_envelopes";
    exampleOnly: true;
    runDelegatesToLiveAdapter: true;
    resumeDelegatesToLiveAdapter: true;
    simulatedShellPrimitiveAllowed: true;
    simulatedPatchPrimitiveAllowed: true;
    realShellProcessAllowed: false;
    realWorkspaceWriteAllowed: false;
    hostExecutorDispatchSurfacePresent: false;
    defaultRealExecutionAllowed: false;
    directDispatchToHostAllowedByExample: false;
    codexCliInvocationAllowedByExample: false;
    providerInvocationAllowedByExample: false;
    subAgentRuntimeInvocationAllowed: false;
    externalWriteAllowed: false;
    exampleClientCallsDuringAudit: 0;
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

export type HostClientExampleBoundaryAuditOutputFormat = "text" | "json";

export async function collectHostClientExampleBoundaryAuditInput(
  cwd = process.cwd()
): Promise<HostClientExampleBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    hostClientExampleSourceText,
    hostClientExampleTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, HOST_CLIENT_EXAMPLE_SOURCE),
    read(cwd, HOST_CLIENT_EXAMPLE_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    hostClientExampleSourceText,
    hostClientExampleTestText,
    governanceRunnerText
  };
}

export function reviewHostClientExampleBoundaryAudit(
  input: HostClientExampleBoundaryAuditInput
): HostClientExampleBoundaryAuditResult {
  const checks = {
    controlPlaneBoundaryRecorded: controlPlaneBoundaryRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit host-client-example-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "host-client-example-boundary"
    ),
    exampleFacadeGuardsPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.hostClientExampleSourceText.includes(marker)
    ),
    exampleRegressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.hostClientExampleTestText.includes(marker)
    ),
    noHostExecutorSurface: noHostExecutorSurface(input.hostClientExampleSourceText),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      exampleMode: "example_host_client_facade",
      runResumeMode: "delegates_to_desktop_live_adapter",
      exampleBridgeMode: "simulated_desktop_primitive_envelopes",
      exampleOnly: true,
      runDelegatesToLiveAdapter: true,
      resumeDelegatesToLiveAdapter: true,
      simulatedShellPrimitiveAllowed: true,
      simulatedPatchPrimitiveAllowed: true,
      realShellProcessAllowed: false,
      realWorkspaceWriteAllowed: false,
      hostExecutorDispatchSurfacePresent: false,
      defaultRealExecutionAllowed: false,
      directDispatchToHostAllowedByExample: false,
      codexCliInvocationAllowedByExample: false,
      providerInvocationAllowedByExample: false,
      subAgentRuntimeInvocationAllowed: false,
      externalWriteAllowed: false,
      exampleClientCallsDuringAudit: 0,
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

export function formatHostClientExampleBoundaryAuditResult(
  review: HostClientExampleBoundaryAuditResult,
  format: HostClientExampleBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Host client example boundary audit",
    `status: ${review.status}`,
    `example mode: ${review.summary.exampleMode}`,
    `run/resume mode: ${review.summary.runResumeMode}`,
    `example bridge mode: ${review.summary.exampleBridgeMode}`,
    `example only: ${review.summary.exampleOnly}`,
    `simulated shell primitive allowed: ${review.summary.simulatedShellPrimitiveAllowed}`,
    `simulated patch primitive allowed: ${review.summary.simulatedPatchPrimitiveAllowed}`,
    `real shell/process allowed: ${review.summary.realShellProcessAllowed}`,
    `real workspace-write allowed: ${review.summary.realWorkspaceWriteAllowed}`,
    `host executor dispatch surface present: ${review.summary.hostExecutorDispatchSurfacePresent}`,
    `default real execution allowed: ${review.summary.defaultRealExecutionAllowed}`,
    `direct dispatchToHost allowed by example: ${review.summary.directDispatchToHostAllowedByExample}`,
    `Codex CLI invocation allowed by example: ${review.summary.codexCliInvocationAllowedByExample}`,
    `provider invocation allowed by example: ${review.summary.providerInvocationAllowedByExample}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `example client calls during audit: ${review.summary.exampleClientCallsDuringAudit}`,
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
  return text.includes("Host client example boundary")
    && text.includes("host-client-example")
    && text.includes("example-only host facade")
    && text.includes("delegates `run` and `resume` to the desktop live adapter")
    && text.includes("simulated desktop primitive envelopes")
    && text.includes("does not authorize Codex CLI, provider, sub-agent runtime, host executor, real shell/process, workspace-write, or external write");
}

function noHostExecutorSurface(text: string): boolean {
  return !text.includes("dispatchCurrentOperatorActionHostExecutor")
    && !text.includes("dispatchGovernanceOperatorActionHostExecutor")
    && !text.includes("authorizeGovernanceOperatorActionHostExecutorReview");
}

function noBroadExecutionAuthorization(
  input: HostClientExampleBoundaryAuditInput
): boolean {
  const text = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText
  ].join("\n");

  return !text.includes("host client example default real execution allowed: true")
    && !text.includes("host client example direct dispatchToHost allowed: true")
    && !text.includes("host client example Codex CLI invocation allowed: true")
    && !text.includes("host client example provider invocation allowed: true")
    && !text.includes("host client example sub-agent runtime invocation allowed: true")
    && !text.includes("host client example host executor dispatch allowed: true")
    && !text.includes("host client example real shell/process allowed: true")
    && !text.includes("host client example workspace-write allowed: true")
    && !text.includes("host client example external write allowed: true");
}

function outputSanitized(): boolean {
  const review: HostClientExampleBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneBoundaryRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      exampleFacadeGuardsPresent: true,
      exampleRegressionCoverageRecorded: true,
      noHostExecutorSurface: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      exampleMode: "example_host_client_facade",
      runResumeMode: "delegates_to_desktop_live_adapter",
      exampleBridgeMode: "simulated_desktop_primitive_envelopes",
      exampleOnly: true,
      runDelegatesToLiveAdapter: true,
      resumeDelegatesToLiveAdapter: true,
      simulatedShellPrimitiveAllowed: true,
      simulatedPatchPrimitiveAllowed: true,
      realShellProcessAllowed: false,
      realWorkspaceWriteAllowed: false,
      hostExecutorDispatchSurfacePresent: false,
      defaultRealExecutionAllowed: false,
      directDispatchToHostAllowedByExample: false,
      codexCliInvocationAllowedByExample: false,
      providerInvocationAllowedByExample: false,
      subAgentRuntimeInvocationAllowed: false,
      externalWriteAllowed: false,
      exampleClientCallsDuringAudit: 0,
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
  const text = formatHostClientExampleBoundaryAuditResult(review);
  const json = formatHostClientExampleBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: HostClientExampleBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `host_client_example_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectHostClientExampleBoundaryAuditInput();
  const review = reviewHostClientExampleBoundaryAudit(input);
  console.log(formatHostClientExampleBoundaryAuditResult(review, format));

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
