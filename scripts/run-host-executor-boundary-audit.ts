#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE11_CLOSEOUT =
  "docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md";
const PHASE13_CLOSEOUT =
  "docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const RECOVERY_CONTROL_SOURCE =
  "packages/governance-internal-recovery-control/src/index.ts";
const RECOVERY_CONTROL_TEST = "tests/recovery-control.test.ts";
const DESKTOP_HOST_CLIENT_TEST = "tests/desktop-host-client.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_REVIEW_SOURCE_MARKERS = [
  "GovernanceOperatorActionHostExecutorDescriptorSchema",
  "descriptorKind: z.literal(\"injected_host_executor\")",
  "executionMode: z.literal(\"review_only\")",
  "sideEffectBoundary: z.literal(\"recovery_action_review\")",
  "dispatchSupported: z.literal(false)",
  "GovernanceOperatorActionHostExecutorAuthorizationPacketSchema",
  "GovernanceOperatorActionHostExecutorAuthorizationResultSchema",
  "authorizeGovernanceOperatorActionHostExecutorReview",
  "ready_for_host_executor_review",
  "Non-executing host executor review accepted"
] as const;

const REQUIRED_DISPATCH_SOURCE_MARKERS = [
  "GovernanceOperatorActionHostExecutorDispatchModeSchema",
  "\"dry_run\"",
  "\"execute_injected\"",
  "GovernanceOperatorActionHostExecutorDispatchInvocationSchema",
  "GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema",
  "GovernanceOperatorActionHostExecutorDispatchAuditEventSchema",
  "GovernanceOperatorActionHostExecutorDispatchResultSchema",
  "dispatchGovernanceOperatorActionHostExecutor",
  "operator_action_host_executor_dispatch_executor_required",
  "operator_action_host_executor_dispatch_audit_sink_required",
  "Dry-run host executor dispatch accepted",
  "no executor was called",
  "no global host lookup was used"
] as const;

const REQUIRED_TEST_MARKERS = [
  "authorizes non-executing host executor review after planned gate binding",
  "blocks host executor review when authorization packet bindings drift",
  "blocks host executor review for unsupported descriptor actions",
  "blocks host executor review for forged lifecycle consumption",
  "blocks host executor review with unsafe authorization evidence refs",
  "prepares host executor dispatch in dry-run without calling an executor",
  "dispatches only through the injected host executor with audit records",
  "blocks injected host executor dispatch without an audit sink",
  "blocks host executor dispatch when review bindings drift",
  "sanitizes injected host executor exceptions"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface HostExecutorBoundaryAuditInput {
  phase11CloseoutText: string;
  phase13CloseoutText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  recoveryControlSourceText: string;
  recoveryControlTestText: string;
  desktopHostClientTestText: string;
  governanceRunnerText: string;
}

export interface HostExecutorBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase11CloseoutRecorded: boolean;
    phase13CloseoutRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    reviewSurfacePresent: boolean;
    dispatchSurfacePresent: boolean;
    explicitInjectionRequired: boolean;
    dryRunDoesNotInvokeExecutor: boolean;
    noGlobalHostLookup: boolean;
    failClosedCoverageRecorded: boolean;
    desktopHostClientIsolationRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    reviewMode: "review_only";
    dispatchModes: ["dry_run", "execute_injected"];
    defaultRealExecutionAllowed: false;
    realCodexCliCallsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    hostExecutorInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type HostExecutorBoundaryAuditOutputFormat = "text" | "json";

export async function collectHostExecutorBoundaryAuditInput(
  cwd = process.cwd()
): Promise<HostExecutorBoundaryAuditInput> {
  const [
    phase11CloseoutText,
    phase13CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    desktopHostClientTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE11_CLOSEOUT),
    read(cwd, PHASE13_CLOSEOUT),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, RECOVERY_CONTROL_TEST),
    read(cwd, DESKTOP_HOST_CLIENT_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase11CloseoutText,
    phase13CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    desktopHostClientTestText,
    governanceRunnerText
  };
}

export function reviewHostExecutorBoundaryAudit(
  input: HostExecutorBoundaryAuditInput
): HostExecutorBoundaryAuditResult {
  const checks = {
    phase11CloseoutRecorded: phase11CloseoutRecorded(input.phase11CloseoutText),
    phase13CloseoutRecorded: phase13CloseoutRecorded(input.phase13CloseoutText),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "host-executor-boundary"
    ),
    reviewSurfacePresent: REQUIRED_REVIEW_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    dispatchSurfacePresent: REQUIRED_DISPATCH_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    explicitInjectionRequired: explicitInjectionRequired(input.recoveryControlSourceText),
    dryRunDoesNotInvokeExecutor: dryRunDoesNotInvokeExecutor(input),
    noGlobalHostLookup: noGlobalHostLookup(input),
    failClosedCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.recoveryControlTestText.includes(marker)
    ),
    desktopHostClientIsolationRecorded: desktopHostClientIsolationRecorded(input),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      reviewMode: "review_only",
      dispatchModes: ["dry_run", "execute_injected"],
      defaultRealExecutionAllowed: false,
      realCodexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatHostExecutorBoundaryAuditResult(
  review: HostExecutorBoundaryAuditResult,
  format: HostExecutorBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Host executor boundary audit",
    `status: ${review.status}`,
    `review mode: ${review.summary.reviewMode}`,
    `dispatch modes: ${review.summary.dispatchModes.join(",")}`,
    `default real execution allowed: ${review.summary.defaultRealExecutionAllowed}`,
    `real Codex CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    `host executor invocations during audit: ${review.summary.hostExecutorInvocationsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function phase11CloseoutRecorded(text: string): boolean {
  return text.includes("Phase 11 Operator Action Host Executor Boundary Closeout")
    && text.includes("non-executing host executor boundary")
    && text.includes("injected host executor descriptor")
    && text.includes("without dispatching the action")
    && text.includes("dispatchSupported: false")
    && text.includes("does not authorize recovery execution");
}

function phase13CloseoutRecorded(text: string): boolean {
  return text.includes("Phase 13 Operator Action Host Executor Dispatch Closeout")
    && text.includes("explicit-injection only")
    && text.includes("does not add")
    && text.includes("real host executor")
    && text.includes("dispatchToHost()")
    && text.includes("recovery execution")
    && text.includes("execute_injected")
    && text.includes("requires a caller-supplied executor and audit sink")
    && text.includes("APPROVE_PHASE_13_REAL_HOST_EXECUTOR_DISPATCH_RUN");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 11 operator action host executor boundary is closed out")
    && text.includes("implemented boundary is non-executing")
    && text.includes("Phase 13 operator action host executor dispatch is closed out")
    && text.includes("dry-run and explicit injected-executor dispatch control exist")
    && text.includes("without adding")
    && text.includes("real recovery executor");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md")
    && text.includes("PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md")
    && text.includes("| Runtime operator action host executor boundary |")
    && text.includes("| Runtime operator action host executor dispatch |")
    && text.includes("No by default")
    && text.includes("real `resume`, `rollback`, `abort`, or `fork` dispatch remains a separate authorization stop");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 11 operator action host executor boundary closeout")
    && text.includes("Phase 13 operator action host executor dispatch closeout")
    && text.includes("npm run governance -- audit host-executor-boundary");
}

function explicitInjectionRequired(text: string): boolean {
  return text.includes("if (dispatchMode === \"execute_injected\")")
    && text.includes("input.executor === undefined")
    && text.includes("input.auditSink === undefined")
    && text.includes("operator_action_host_executor_dispatch_executor_required")
    && text.includes("operator_action_host_executor_dispatch_audit_sink_required");
}

function dryRunDoesNotInvokeExecutor(input: HostExecutorBoundaryAuditInput): boolean {
  return input.phase13CloseoutText.includes("Dispatch dry-run")
    && input.phase13CloseoutText.includes("No")
    && input.recoveryControlSourceText.includes("if (dispatchMode === \"dry_run\")")
    && input.recoveryControlSourceText.includes("no executor was called")
    && input.recoveryControlTestText.includes("executorCalls, 0");
}

function noGlobalHostLookup(input: HostExecutorBoundaryAuditInput): boolean {
  return input.recoveryControlSourceText.includes("no global host lookup was used")
    && input.phase13CloseoutText.includes("explicit-injection only")
    && input.phase13CloseoutText.includes("Host-client dispatch tests prove bridge bindings are not reused as hidden")
    && input.desktopHostClientTestText.includes("callCountBeforeReview")
    && input.desktopHostClientTestText.includes("assert.equal(calls.length, callCountBeforeReview)");
}

function desktopHostClientIsolationRecorded(input: HostExecutorBoundaryAuditInput): boolean {
  return input.phase13CloseoutText.includes("Host-client surface")
    && input.desktopHostClientTestText.includes("dispatchCurrentOperatorActionHostExecutor")
    && input.desktopHostClientTestText.includes("callCountBeforeReview")
    && input.desktopHostClientTestText.includes("dispatchInvocations.length, 1")
    && input.desktopHostClientTestText.includes("assert.equal(calls.length, callCountBeforeReview)");
}

function noBroadExecutionAuthorization(input: HostExecutorBoundaryAuditInput): boolean {
  const combined = [
    input.phase11CloseoutText,
    input.phase13CloseoutText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return combined.includes("does not authorize recovery execution")
    && input.phase13CloseoutText.includes("does not invoke a provider")
    && input.phase13CloseoutText.includes("does not invoke Codex CLI")
    && input.phase13CloseoutText.includes("does not perform")
    && input.phase13CloseoutText.includes("workspace-write")
    && combined.includes("external service write")
    && combined.includes("secret or credential changes")
    && !/real recovery dispatch\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/General provider execution\s*\|\s*active\s*\|\s*Yes/i.test(combined);
}

function outputSanitized(input: HostExecutorBoundaryAuditInput): boolean {
  const outputSource = [
    input.phase11CloseoutText,
    input.phase13CloseoutText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `host_executor_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectHostExecutorBoundaryAuditInput();
  const review = reviewHostExecutorBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatHostExecutorBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Host executor boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
