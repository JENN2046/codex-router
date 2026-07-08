#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE17_TASKBOOK =
  "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md";
const PHASE18_TASKBOOK =
  "docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_PHASE17_MARKERS = [
  "Phase 17 Agent Task Control Dispatch Boundary Taskbook",
  "pre-implementation boundary for future agent task control dispatch",
  "This taskbook does not authorize `codex-router` to invoke Codex CLI, spawn a\nsub-agent, call a provider, run a shell command, mutate a workspace, dispatch a\nreal recovery action, or perform production recovery",
  "A future agent task control\nadapter would be host-provided, explicitly injected, separately authorized, and\nresponsible for any operational semantics outside this repository",
  "That still is not enough to dispatch work to Codex, a sub-agent, another agent\nruntime, or any host automation",
  "requestedDispatchClass = agent_task_control",
  "requestedSideEffectClass = agent_context_only",
  "The host layer, not `codex-router`, owns any future Codex, sub-agent, or agent\nruntime integration",
  "No Phase 17 implementation approval is consumed by this taskbook",
  "APPROVE_PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION",
  "That string is not active unless Jenn provides it in a later task context",
  "Real Codex-backed, sub-agent-backed, provider-backed, workspace-write,\nshell/process, external-write, or production recovery dispatch approval is\nintentionally not defined here",
  "Without that exact approval, continuation remains review, planning, or\ndocumentation only"
] as const;

const REQUIRED_PHASE18_MARKERS = [
  "Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Taskbook",
  "pre-implementation boundary for a future sandbox-only agent task-control dispatch dry-run",
  "but it must\nnot invoke Codex CLI, spawn a sub-agent, call a provider, run a shell command,\nmutate a workspace, write to an external service, or perform real recovery",
  "This taskbook is planning authority only. It does not authorize implementation\nor adapter invocation",
  "This line is documentation and planning only. It does not add schemas, package\nexports, test fixtures, adapter invocation, sandbox writes, or runtime code",
  "This taskbook does not authorize:",
  "sandbox_task_control_adapter",
  "reject Phase 15 `sandbox_reference_adapter` for this path",
  "The future sandbox adapter is a contract witness, not a recovery engine",
  "APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION",
  "That string is not active unless Jenn provides it in a later task context",
  "Vague instructions such as \"continue\", \"next phase\", \"sandbox dry-run\", or\nbranch names must not be treated as this approval",
  "Without that exact approval, continuation remains review, planning, or\ndocumentation only"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AgentTaskControlTaskbookBoundaryAuditInput {
  phase17TaskbookText: string;
  phase18TaskbookText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
}

export interface AgentTaskControlTaskbookBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase17TaskbookRecorded: boolean;
    phase18TaskbookRecorded: boolean;
    currentStateRecordsTaskbooks: boolean;
    controlPlaneRecordsTaskbookAuthority: boolean;
    governanceReadmeListsTaskbooks: boolean;
    governanceRunnerRegistered: boolean;
    phase17ApprovalRemainsInactive: boolean;
    phase18ApprovalRemainsInactive: boolean;
    taskControlOwnershipRemainsHostBound: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    phase17ReviewApproval: "APPROVE_PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION";
    phase18SandboxApproval: "APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION";
    dispatchClass: "agent_task_control";
    sideEffectClass: "agent_context_only";
    taskbookExecutionAuthorized: false;
    adapterInvocationAllowed: false;
    codexCliInvocationAllowed: false;
    providerInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteAllowed: false;
    externalWriteAllowed: false;
    productionRecoveryAllowed: false;
    realRecoveryActionExecutionAllowed: false;
    adapterInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentTaskControlTaskbookBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectAgentTaskControlTaskbookBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentTaskControlTaskbookBoundaryAuditInput> {
  const [
    phase17TaskbookText,
    phase18TaskbookText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE17_TASKBOOK),
    read(cwd, PHASE18_TASKBOOK),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase17TaskbookText,
    phase18TaskbookText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText
  };
}

export function reviewAgentTaskControlTaskbookBoundaryAudit(
  input: AgentTaskControlTaskbookBoundaryAuditInput
): AgentTaskControlTaskbookBoundaryAuditResult {
  const checks = {
    phase17TaskbookRecorded: REQUIRED_PHASE17_MARKERS.every((marker) =>
      input.phase17TaskbookText.includes(marker)
    ),
    phase18TaskbookRecorded: REQUIRED_PHASE18_MARKERS.every((marker) =>
      input.phase18TaskbookText.includes(marker)
    ),
    currentStateRecordsTaskbooks: currentStateRecordsTaskbooks(input.currentStateText),
    controlPlaneRecordsTaskbookAuthority: controlPlaneRecordsTaskbookAuthority(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsTaskbooks: governanceReadmeListsTaskbooks(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-task-control-taskbook-boundary"
    ),
    phase17ApprovalRemainsInactive: phase17ApprovalRemainsInactive(
      input.phase17TaskbookText
    ),
    phase18ApprovalRemainsInactive: phase18ApprovalRemainsInactive(
      input.phase18TaskbookText
    ),
    taskControlOwnershipRemainsHostBound: taskControlOwnershipRemainsHostBound(input),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      phase17ReviewApproval:
        "APPROVE_PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION",
      phase18SandboxApproval:
        "APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION",
      dispatchClass: "agent_task_control",
      sideEffectClass: "agent_context_only",
      taskbookExecutionAuthorized: false,
      adapterInvocationAllowed: false,
      codexCliInvocationAllowed: false,
      providerInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteAllowed: false,
      externalWriteAllowed: false,
      productionRecoveryAllowed: false,
      realRecoveryActionExecutionAllowed: false,
      adapterInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatAgentTaskControlTaskbookBoundaryAuditResult(
  review: AgentTaskControlTaskbookBoundaryAuditResult,
  format: AgentTaskControlTaskbookBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent task-control taskbook boundary audit",
    `status: ${review.status}`,
    `dispatch class: ${review.summary.dispatchClass}`,
    `side-effect class: ${review.summary.sideEffectClass}`,
    `taskbook execution authorized: ${review.summary.taskbookExecutionAuthorized}`,
    `adapter invocation allowed: ${review.summary.adapterInvocationAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `provider invocation allowed: ${review.summary.providerInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write allowed: ${review.summary.workspaceWriteAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `production recovery allowed: ${review.summary.productionRecoveryAllowed}`,
    `real recovery-action execution allowed: ${review.summary.realRecoveryActionExecutionAllowed}`,
    `adapter invocations during audit: ${review.summary.adapterInvocationsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function currentStateRecordsTaskbooks(text: string): boolean {
  return text.includes("PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md")
    && text.includes("PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md")
    && text.includes("future `agent_task_control` + `agent_context_only` packet")
    && text.includes("sandbox-only task-control contract witness boundary")
    && text.includes("sub-agent runtime invocation")
    && text.includes("recovery-action execution blocked");
}

function controlPlaneRecordsTaskbookAuthority(text: string): boolean {
  return text.includes("PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md")
    && text.includes(
      "Current human authority for future `agent_task_control` / `agent_context_only` dispatch authorization requirements; taskbook boundary and not Codex CLI, provider, sub-agent runtime, shell/process, workspace-write, external-write, or production recovery authorization."
    )
    && text.includes("PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md")
    && text.includes(
      "Current taskbook authority for a future sandbox-only task-control contract witness; planning-only and not adapter invocation, Codex CLI, provider, sub-agent runtime, shell/process, workspace-write, external-write, or production recovery authorization."
    );
}

function governanceReadmeListsTaskbooks(text: string): boolean {
  return text.includes(
    "[Phase 17 agent task control dispatch boundary taskbook](PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md)"
  )
    && text.includes("current taskbook boundary for future `agent_task_control` dispatch")
    && text.includes(
      "[Phase 18 agent task control dispatch sandbox dry-run taskbook](PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md)"
    )
    && text.includes("current planning boundary for a future sandbox-only task-control contract");
}

function phase17ApprovalRemainsInactive(text: string): boolean {
  return text.includes("No Phase 17 implementation approval is consumed by this taskbook")
    && text.includes("That string is not active unless Jenn provides it in a later task context")
    && text.includes("Without that exact approval, continuation remains review, planning, or\ndocumentation only")
    && text.includes("Real Codex-backed, sub-agent-backed, provider-backed, workspace-write,\nshell/process, external-write, or production recovery dispatch approval is\nintentionally not defined here");
}

function phase18ApprovalRemainsInactive(text: string): boolean {
  return text.includes("No Phase 18 implementation approval is consumed by this taskbook")
    && text.includes("That string is not active unless Jenn provides it in a later task context")
    && text.includes("Vague instructions such as \"continue\", \"next phase\", \"sandbox dry-run\", or\nbranch names must not be treated as this approval")
    && text.includes("Without that exact approval, continuation remains review, planning, or\ndocumentation only");
}

function taskControlOwnershipRemainsHostBound(
  input: AgentTaskControlTaskbookBoundaryAuditInput
): boolean {
  return input.phase17TaskbookText.includes(
    "The host layer, not `codex-router`, owns any future Codex, sub-agent, or agent\nruntime integration"
  )
    && input.phase17TaskbookText.includes("future host adapter")
    && input.phase18TaskbookText.includes(
      "The future sandbox adapter is a contract witness, not a recovery engine"
    )
    && input.phase18TaskbookText.includes("reject Phase 15 `sandbox_reference_adapter` for this path");
}

function noBroadExecutionAuthorization(
  input: AgentTaskControlTaskbookBoundaryAuditInput
): boolean {
  const text = [
    input.phase17TaskbookText,
    input.phase18TaskbookText,
    input.governanceControlPlaneText,
    input.governanceReadmeText
  ].join("\n");

  return text.includes("This taskbook does not authorize:")
    && text.includes("sub-agent process or runtime invocation")
    && text.includes("adapter invocation")
    && text.includes("planning-only and not adapter invocation")
    && !text.includes("taskbook execution authorized: true")
    && !text.includes("adapter invocation allowed: true")
    && !text.includes("Codex CLI invocation allowed: true")
    && !text.includes("provider invocation allowed: true")
    && !text.includes("sub-agent runtime invocation allowed: true")
    && !text.includes("workspace-write allowed: true")
    && !text.includes("production recovery allowed: true")
    && !text.includes("real recovery-action execution allowed: true");
}

function outputSanitized(): boolean {
  const review: AgentTaskControlTaskbookBoundaryAuditResult = {
    status: "passed",
    checks: {
      phase17TaskbookRecorded: true,
      phase18TaskbookRecorded: true,
      currentStateRecordsTaskbooks: true,
      controlPlaneRecordsTaskbookAuthority: true,
      governanceReadmeListsTaskbooks: true,
      governanceRunnerRegistered: true,
      phase17ApprovalRemainsInactive: true,
      phase18ApprovalRemainsInactive: true,
      taskControlOwnershipRemainsHostBound: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      phase17ReviewApproval:
        "APPROVE_PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION",
      phase18SandboxApproval:
        "APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION",
      dispatchClass: "agent_task_control",
      sideEffectClass: "agent_context_only",
      taskbookExecutionAuthorized: false,
      adapterInvocationAllowed: false,
      codexCliInvocationAllowed: false,
      providerInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteAllowed: false,
      externalWriteAllowed: false,
      productionRecoveryAllowed: false,
      realRecoveryActionExecutionAllowed: false,
      adapterInvocationsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatAgentTaskControlTaskbookBoundaryAuditResult(review);
  const json = formatAgentTaskControlTaskbookBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: AgentTaskControlTaskbookBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `agent_task_control_taskbook_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAgentTaskControlTaskbookBoundaryAuditInput();
  const review = reviewAgentTaskControlTaskbookBoundaryAudit(input);
  console.log(formatAgentTaskControlTaskbookBoundaryAuditResult(review, format));

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
