#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE17_TASKBOOK =
  "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md";
const PHASE17_CLOSEOUT =
  "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const RECOVERY_CONTROL_SOURCE =
  "packages/governance-internal-recovery-control/src/index.ts";
const PHASE17_TEST =
  "tests/phase17-agent-task-control-dispatch-authorization.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_SOURCE_MARKERS = [
  "GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL",
  "GovernanceOperatorActionAgentTaskControlDispatchAuthorizationPacketSchema",
  "GovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResultSchema",
  "hashGovernanceOperatorActionAgentTaskControlDispatchAuthorizationReviewResult",
  "reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization",
  "requestedDispatchClass: \"agent_task_control\"",
  "requestedSideEffectClass: \"agent_context_only\"",
  "phase17_agent_task_control_review_only_no_adapter_invocation",
  "expectedAgentTaskControlOperationRef(packet.recommendedAction)",
  "operator_action_agent_task_control_dispatch_authorization_dispatch_class_not_agent_task_control",
  "operator_action_agent_task_control_dispatch_authorization_side_effect_class_not_agent_context_only",
  "operator_action_agent_task_control_dispatch_authorization_adapter_kind_incompatible",
  "operator_action_agent_task_control_dispatch_authorization_operation_ref_mismatch"
] as const;

const REQUIRED_TEST_MARKERS = [
  "phase17 task control dispatch authorization accepts review-only agent context boundary",
  "phase17 task control dispatch authorization blocks wrong dispatch classes",
  "phase17 task control dispatch authorization blocks phase16 review hash drift",
  "phase17 task control dispatch authorization binds permitted operation refs to action",
  "phase17 task control dispatch authorization blocks sandbox reference adapter kind",
  "phase17 task control dispatch authorization binds rollback by checkpoint hash only",
  "result.requestedDispatchClass, \"agent_task_control\"",
  "result.requestedSideEffectClass, \"agent_context_only\"",
  "JSON.stringify(result).includes(checkpointRef), false",
  "JSON.stringify(context.agentTaskControlDispatchAuthorizationPacket).includes(checkpointRef)"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AgentTaskControlReviewBoundaryAuditInput {
  phase17TaskbookText: string;
  phase17CloseoutText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  recoveryControlSourceText: string;
  phase17TestText: string;
  governanceRunnerText: string;
}

export interface AgentTaskControlReviewBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase17TaskbookRecorded: boolean;
    phase17CloseoutRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    implementationSurfacePresent: boolean;
    taskControlClassConstrained: boolean;
    phase16HashBindingRecorded: boolean;
    operationRefsBoundToAction: boolean;
    rollbackEvidenceSanitized: boolean;
    failClosedCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    dispatchClass: "agent_task_control";
    sideEffectClass: "agent_context_only";
    boundaryMode: "review_only";
    adapterInvocationAllowed: false;
    codexCliInvocationAllowed: false;
    providerInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteAllowed: false;
    externalWriteAllowed: false;
    productionRecoveryAllowed: false;
    recoveryActionExecutionAllowed: false;
    adapterInvocationsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentTaskControlReviewBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectAgentTaskControlReviewBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentTaskControlReviewBoundaryAuditInput> {
  const [
    phase17TaskbookText,
    phase17CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    phase17TestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE17_TASKBOOK),
    read(cwd, PHASE17_CLOSEOUT),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, PHASE17_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase17TaskbookText,
    phase17CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    phase17TestText,
    governanceRunnerText
  };
}

export function reviewAgentTaskControlReviewBoundaryAudit(
  input: AgentTaskControlReviewBoundaryAuditInput
): AgentTaskControlReviewBoundaryAuditResult {
  const checks = {
    phase17TaskbookRecorded: phase17TaskbookRecorded(input.phase17TaskbookText),
    phase17CloseoutRecorded: phase17CloseoutRecorded(input.phase17CloseoutText),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-task-control-review-boundary"
    ),
    implementationSurfacePresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    taskControlClassConstrained: taskControlClassConstrained(input),
    phase16HashBindingRecorded: phase16HashBindingRecorded(input),
    operationRefsBoundToAction: operationRefsBoundToAction(input),
    rollbackEvidenceSanitized: rollbackEvidenceSanitized(input),
    failClosedCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.phase17TestText.includes(marker)
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      dispatchClass: "agent_task_control",
      sideEffectClass: "agent_context_only",
      boundaryMode: "review_only",
      adapterInvocationAllowed: false,
      codexCliInvocationAllowed: false,
      providerInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteAllowed: false,
      externalWriteAllowed: false,
      productionRecoveryAllowed: false,
      recoveryActionExecutionAllowed: false,
      adapterInvocationsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatAgentTaskControlReviewBoundaryAuditResult(
  review: AgentTaskControlReviewBoundaryAuditResult,
  format: AgentTaskControlReviewBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent task control review boundary audit",
    `status: ${review.status}`,
    `dispatch class: ${review.summary.dispatchClass}`,
    `side-effect class: ${review.summary.sideEffectClass}`,
    `boundary mode: ${review.summary.boundaryMode}`,
    `adapter invocation allowed: ${review.summary.adapterInvocationAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `provider invocation allowed: ${review.summary.providerInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write allowed: ${review.summary.workspaceWriteAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `production recovery allowed: ${review.summary.productionRecoveryAllowed}`,
    `recovery action execution allowed: ${review.summary.recoveryActionExecutionAllowed}`,
    `adapter invocations during audit: ${review.summary.adapterInvocationsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function phase17TaskbookRecorded(text: string): boolean {
  return text.includes("Phase 17 Agent Task Control Dispatch Boundary Taskbook")
    && text.includes("requestedDispatchClass = agent_task_control")
    && text.includes("requestedSideEffectClass = agent_context_only")
    && text.includes("agent_context_only")
    && text.includes("does not authorize `codex-router` to invoke Codex CLI")
    && text.includes("spawn a\nsub-agent")
    && text.includes("mutate a workspace")
    && text.includes("real agent invocation blocked");
}

function phase17CloseoutRecorded(text: string): boolean {
  return text.includes("Phase 17 Agent Task Control Dispatch Authorization Review-Only Closeout")
    && text.includes("review-only authorization boundary")
    && text.includes("requestedDispatchClass = agent_task_control")
    && text.includes("requestedSideEffectClass = agent_context_only")
    && text.includes("phase17_agent_task_control_review_only_no_adapter_invocation")
    && text.includes("does not invoke an adapter")
    && text.includes("This closeout does not authorize");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 17 agent task control dispatch boundary is recorded")
    && text.includes("Phase 17 agent task control dispatch authorization review-only")
    && text.includes("non-executing `agent_task_control` + `agent_context_only`")
    && text.includes("It does not invoke\n  an adapter")
    && text.includes("real_agent_task_control_dispatch");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md")
    && text.includes("PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md")
    && text.includes("Agent task control dispatch authorization")
    && text.includes("active / review-only")
    && text.includes("without invoking an adapter, Codex CLI, provider, sub-agent runtime");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 17 agent task control dispatch authorization review-only closeout")
    && text.includes("npm run governance -- audit agent-task-control-review-boundary");
}

function taskControlClassConstrained(
  input: AgentTaskControlReviewBoundaryAuditInput
): boolean {
  return input.recoveryControlSourceText.includes(
    "requestedDispatchClass: \"agent_task_control\""
  )
    && input.recoveryControlSourceText.includes(
      "requestedSideEffectClass: \"agent_context_only\""
    )
    && input.recoveryControlSourceText.includes(
      "operator_action_agent_task_control_dispatch_authorization_dispatch_class_not_agent_task_control"
    )
    && input.recoveryControlSourceText.includes(
      "operator_action_agent_task_control_dispatch_authorization_side_effect_class_not_agent_context_only"
    )
    && input.phase17TestText.includes("blocks wrong dispatch classes");
}

function phase16HashBindingRecorded(
  input: AgentTaskControlReviewBoundaryAuditInput
): boolean {
  return input.phase17CloseoutText.includes("Phase 16 dispatch authorization review hash")
    && input.recoveryControlSourceText.includes(
      "phase16DispatchAuthorizationReviewHash"
    )
    && input.recoveryControlSourceText.includes(
      "operator_action_agent_task_control_dispatch_authorization_packet_phase16_review_hash_mismatch"
    )
    && input.phase17TestText.includes("blocks phase16 review hash drift");
}

function operationRefsBoundToAction(
  input: AgentTaskControlReviewBoundaryAuditInput
): boolean {
  return input.phase17CloseoutText.includes(
    "task-control-operation:${recommendedAction}"
  )
    && input.recoveryControlSourceText.includes(
      "expectedAgentTaskControlOperationRef(packet.recommendedAction)"
    )
    && input.recoveryControlSourceText.includes(
      "operator_action_agent_task_control_dispatch_authorization_operation_ref_mismatch"
    )
    && input.phase17TestText.includes("binds permitted operation refs to action");
}

function rollbackEvidenceSanitized(
  input: AgentTaskControlReviewBoundaryAuditInput
): boolean {
  return input.phase17CloseoutText.includes("rollback checkpoint hashing without raw checkpoint ref exposure")
    && input.phase17TestText.includes("binds rollback by checkpoint hash only")
    && input.phase17TestText.includes(
      "JSON.stringify(result).includes(checkpointRef), false"
    )
    && input.phase17TestText.includes(
      "JSON.stringify(context.agentTaskControlDispatchAuthorizationPacket).includes(checkpointRef),"
    )
    && input.phase17TestText.includes("false");
}

function noBroadExecutionAuthorization(
  input: AgentTaskControlReviewBoundaryAuditInput
): boolean {
  const combined = [
    input.phase17TaskbookText,
    input.phase17CloseoutText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return countIncludes(combined, "does not authorize") >= 3
    && combined.includes("adapter invocation")
    && combined.includes("Codex CLI")
    && combined.includes("sub-agent")
    && combined.includes("provider")
    && combined.includes("shell")
    && combined.includes("workspace")
    && combined.includes("external")
    && combined.includes("production recovery")
    && !combined.includes("real_agent_task_control_dispatch authorized")
    && !combined.includes("agent_task_control execution authorized")
    && !combined.includes("adapter invocation allowed")
    && !combined.includes("sub-agent runtime execution authorized")
    && !combined.includes("requestedSideEffectClass = workspace_write");
}

function outputSanitized(
  input: AgentTaskControlReviewBoundaryAuditInput
): boolean {
  const outputSource = [
    input.phase17TaskbookText,
    input.phase17CloseoutText,
    input.currentStateText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `agent_task_control_review_boundary_${name}`);
}

function countIncludes(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

async function main(): Promise<void> {
  const input = await collectAgentTaskControlReviewBoundaryAuditInput();
  const review = reviewAgentTaskControlReviewBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatAgentTaskControlReviewBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Agent task control review boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
