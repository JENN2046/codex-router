#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE12_CLOSEOUT =
  "docs/governance/PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const DESKTOP_HOST_CLIENT_SOURCE = "packages/desktop-host-client/src/index.ts";
const DESKTOP_HOST_CLIENT_TEST = "tests/desktop-host-client.test.ts";
const PUBLIC_API_HOST_SOURCE = "packages/public-api/src/host.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_SOURCE_MARKERS = [
  "reviewCurrentOperatorActionHostExecutorAuthorization",
  "authorizeGovernanceOperatorActionHostExecutorReview({",
  "lifecycleState: this.getOperatorActionLifecycle()",
  "executionGate: input.executionGate",
  "authorizationPacket: input.authorizationPacket",
  "hostExecutorDescriptor: input.hostExecutorDescriptor",
  "dispatchCurrentOperatorActionHostExecutor",
  "dispatchGovernanceOperatorActionHostExecutor({"
] as const;

const REQUIRED_TEST_MARKERS = [
  "reviewCurrentOperatorActionHostExecutorAuthorization",
  "ready_for_host_executor_review",
  "callCountBeforeReview",
  "assert.equal(calls.length, callCountBeforeReview)",
  "idleClient.reviewCurrentOperatorActionHostExecutorAuthorization",
  "operator_action_host_executor_lifecycle_action_missing",
  "dispatchCurrentOperatorActionHostExecutor",
  "executorCalls, 0",
  "dispatchInvocations.length, 1"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface HostClientExecutorReviewBoundaryAuditInput {
  phase12CloseoutText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  desktopHostClientSourceText: string;
  desktopHostClientTestText: string;
  publicApiHostSourceText: string;
  governanceRunnerText: string;
}

export interface HostClientExecutorReviewBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase12CloseoutRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    reviewSurfacePresent: boolean;
    publicApiDelegatesReviewOnly: boolean;
    reviewUsesCurrentLifecycleOnly: boolean;
    bridgeAndDispatchIsolationRecorded: boolean;
    idleClientFailsClosed: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    surface: "desktop_host_client_review";
    boundaryMode: "review_only";
    reviewResultStatus: "ready_for_host_executor_review";
    recoveryActionDispatchAllowed: false;
    hostBridgeCallAllowedByReview: false;
    dispatchToHostAllowedByReview: false;
    codexCliInvocationAllowed: false;
    providerInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteAllowed: false;
    externalWriteAllowed: false;
    hostBridgeCallsDuringAudit: 0;
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

export type HostClientExecutorReviewBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectHostClientExecutorReviewBoundaryAuditInput(
  cwd = process.cwd()
): Promise<HostClientExecutorReviewBoundaryAuditInput> {
  const [
    phase12CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    desktopHostClientSourceText,
    desktopHostClientTestText,
    publicApiHostSourceText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE12_CLOSEOUT),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, DESKTOP_HOST_CLIENT_SOURCE),
    read(cwd, DESKTOP_HOST_CLIENT_TEST),
    read(cwd, PUBLIC_API_HOST_SOURCE),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase12CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    desktopHostClientSourceText,
    desktopHostClientTestText,
    publicApiHostSourceText,
    governanceRunnerText
  };
}

export function reviewHostClientExecutorReviewBoundaryAudit(
  input: HostClientExecutorReviewBoundaryAuditInput
): HostClientExecutorReviewBoundaryAuditResult {
  const checks = {
    phase12CloseoutRecorded: phase12CloseoutRecorded(input.phase12CloseoutText),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "host-client-executor-review-boundary"
    ),
    reviewSurfacePresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.desktopHostClientSourceText.includes(marker)
    ),
    publicApiDelegatesReviewOnly: publicApiDelegatesReviewOnly(input),
    reviewUsesCurrentLifecycleOnly: reviewUsesCurrentLifecycleOnly(input),
    bridgeAndDispatchIsolationRecorded: bridgeAndDispatchIsolationRecorded(input),
    idleClientFailsClosed: idleClientFailsClosed(input),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      surface: "desktop_host_client_review",
      boundaryMode: "review_only",
      reviewResultStatus: "ready_for_host_executor_review",
      recoveryActionDispatchAllowed: false,
      hostBridgeCallAllowedByReview: false,
      dispatchToHostAllowedByReview: false,
      codexCliInvocationAllowed: false,
      providerInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteAllowed: false,
      externalWriteAllowed: false,
      hostBridgeCallsDuringAudit: 0,
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

export function formatHostClientExecutorReviewBoundaryAuditResult(
  review: HostClientExecutorReviewBoundaryAuditResult,
  format: HostClientExecutorReviewBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Host client executor review boundary audit",
    `status: ${review.status}`,
    `surface: ${review.summary.surface}`,
    `boundary mode: ${review.summary.boundaryMode}`,
    `review result status: ${review.summary.reviewResultStatus}`,
    `recovery action dispatch allowed: ${review.summary.recoveryActionDispatchAllowed}`,
    `host bridge call allowed by review: ${review.summary.hostBridgeCallAllowedByReview}`,
    `dispatchToHost allowed by review: ${review.summary.dispatchToHostAllowedByReview}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `provider invocation allowed: ${review.summary.providerInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write allowed: ${review.summary.workspaceWriteAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `host bridge calls during audit: ${review.summary.hostBridgeCallsDuringAudit}`,
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

function phase12CloseoutRecorded(text: string): boolean {
  return text.includes("Phase 12 Operator Action Host Client Review Surface Closeout")
    && text.includes("Phase 11 non-executing host executor authorization review")
    && text.includes("DesktopHostClient")
    && text.includes("without introducing recovery action dispatch")
    && text.includes("does not authorize recovery execution")
    && text.includes("does not call bridge bindings")
    && text.includes("dispatchToHost()")
    && text.includes("Codex CLI")
    && text.includes("provider execution")
    && text.includes("workspace-write");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 12 operator action host client review surface is closed out")
    && text.includes("PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md")
    && text.includes("DesktopHostClient")
    && text.includes("current lifecycle state without bridge calls")
    && text.includes("dispatchToHost()")
    && text.includes("Codex CLI execution")
    && text.includes("recovery action dispatch");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md")
    && text.includes("Operator action host client review surface closeout")
    && text.includes("Runtime operator action host-client executor review surface")
    && text.includes("active / non-executing")
    && text.includes("bridge, dispatcher, provider, Codex CLI, and workspace-write paths remain untouched");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 12 operator action host client review surface closeout")
    && text.includes("DesktopHostClient")
    && text.includes("npm run governance -- audit host-client-executor-review-boundary");
}

function publicApiDelegatesReviewOnly(
  input: HostClientExecutorReviewBoundaryAuditInput
): boolean {
  return input.publicApiHostSourceText.includes(
    "reviewCurrentOperatorActionHostExecutorAuthorization"
  )
    && input.publicApiHostSourceText.includes(
      "this.inner.reviewCurrentOperatorActionHostExecutorAuthorization"
    )
    && input.publicApiHostSourceText.includes(
      "dispatchCurrentOperatorActionHostExecutor"
    );
}

function reviewUsesCurrentLifecycleOnly(
  input: HostClientExecutorReviewBoundaryAuditInput
): boolean {
  const reviewIndex = input.desktopHostClientSourceText.indexOf(
    "reviewCurrentOperatorActionHostExecutorAuthorization"
  );
  const dispatchIndex = input.desktopHostClientSourceText.indexOf(
    "dispatchCurrentOperatorActionHostExecutor"
  );
  const reviewBlock = reviewIndex >= 0 && dispatchIndex > reviewIndex
    ? input.desktopHostClientSourceText.slice(reviewIndex, dispatchIndex)
    : "";

  return reviewBlock.includes("authorizeGovernanceOperatorActionHostExecutorReview")
    && reviewBlock.includes("lifecycleState: this.getOperatorActionLifecycle()")
    && !reviewBlock.includes("dispatchGovernanceOperatorActionHostExecutor")
    && !reviewBlock.includes("resolveHostBridge")
    && !reviewBlock.includes(".dispatch(");
}

function bridgeAndDispatchIsolationRecorded(
  input: HostClientExecutorReviewBoundaryAuditInput
): boolean {
  return REQUIRED_TEST_MARKERS.every((marker) =>
    input.desktopHostClientTestText.includes(marker)
  )
    && input.phase12CloseoutText.includes("bridge call\n  counts do not increase");
}

function idleClientFailsClosed(
  input: HostClientExecutorReviewBoundaryAuditInput
): boolean {
  return input.desktopHostClientTestText.includes(
    "idleClient.reviewCurrentOperatorActionHostExecutorAuthorization"
  )
    && input.desktopHostClientTestText.includes("blocked.status, \"blocked\"")
    && input.desktopHostClientTestText.includes(
      "operator_action_host_executor_lifecycle_action_missing"
    );
}

function noBroadExecutionAuthorization(
  input: HostClientExecutorReviewBoundaryAuditInput
): boolean {
  const phase12 = input.phase12CloseoutText;
  const combined = [
    input.phase12CloseoutText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return phase12.includes("does not authorize recovery execution")
    && phase12.includes("real Codex CLI execution")
    && phase12.includes("workspace-write execution")
    && phase12.includes("external writes")
    && phase12.includes("provider")
    && phase12.includes("dispatchToHost()")
    && !combined.includes("host-client executor review authorizes dispatch")
    && !combined.includes("reviewCurrentOperatorActionHostExecutorAuthorization executes")
    && !combined.includes("workspace-write allowed by review: true");
}

function outputSanitized(
  input: HostClientExecutorReviewBoundaryAuditInput
): boolean {
  const outputSource = [
    input.phase12CloseoutText,
    input.currentStateText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `host_client_executor_review_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectHostClientExecutorReviewBoundaryAuditInput();
  const review = reviewHostClientExecutorReviewBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatHostClientExecutorReviewBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Host client executor review boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
