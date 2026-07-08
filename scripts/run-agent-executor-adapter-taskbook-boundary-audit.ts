#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE15_TASKBOOK =
  "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md";
const PHASE16_AUTHORIZATION_TASKBOOK =
  "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md";
const PHASE16_SANDBOX_TASKBOOK =
  "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_PHASE15_MARKERS = [
  "Phase 15 Agent Executor Adapter Authorization Taskbook",
  "pre-execution authorization boundary for future agent-backed executor adapters",
  "It does not authorize `codex-router` to invoke Codex CLI, spawn a sub-agent,\ncall a provider, run a shell command, mutate a workspace, or perform business\nrecovery",
  "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_IMPLEMENTATION",
  "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_RUN",
  "The implemented boundary still cannot call an adapter",
  "call only an explicitly injected sandbox reference adapter",
  "Real Codex-backed, sub-agent-backed, provider-backed, or workspace-write\nadapter approval is intentionally not defined here",
  "A future agent executor adapter may exist only as an explicitly injected host\ndependency. It must not be auto-discovered",
  "This taskbook does not authorize:",
  "Any Codex-backed adapter, sub-agent-backed adapter, provider-backed adapter,\nworkspace-write adapter, shell/process executor, production recovery path, or\nreal recovery-action execution requires a separate taskbook"
] as const;

const REQUIRED_PHASE16_AUTHORIZATION_MARKERS = [
  "Phase 16 Agent Executor Adapter Dispatch Authorization Taskbook",
  "pre-implementation authorization boundary for future agent executor adapter dispatch",
  "This taskbook does not authorize `codex-router` to invoke Codex CLI, spawn a\nsub-agent, call a provider, run a shell command, mutate a workspace, dispatch a\nreal recovery action, or perform production recovery",
  "Future operational execution\nbelongs to the host layer and must be explicitly injected, scoped, audited, and\nseparately authorized",
  "The current taskbook itself does not\nimplement a dispatch runner",
  "adapter auto-discovery",
  "requested dispatch class",
  "requested side-effect class",
  "No Phase 16 implementation approval is consumed by this taskbook",
  "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION",
  "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN",
  "These candidate strings are not active grants",
  "Any Codex-backed, sub-agent-backed, provider-backed, workspace-write, or\nshell/process dispatch path requires a newer, narrower approval string"
] as const;

const REQUIRED_PHASE16_SANDBOX_MARKERS = [
  "Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Taskbook",
  "pre-implementation boundary for a sandbox-only dispatch dry-run extension",
  "It must not become a Codex-backed,\nsub-agent-backed, provider-backed, shell/process, workspace-write, external\nwrite, or production recovery path",
  "This taskbook was planning authority only",
  "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN",
  "Prior Phase 15\napprovals, Phase 16 review-only approval, branch names, PR titles, or vague\n\"continue\" instructions must not be treated as this approval",
  "The sandbox dry-run is not business recovery execution",
  "completed` means the sandbox dispatch transaction completed, not that recovery\ncompleted",
  "This taskbook does not authorize:",
  "Any next adapter dispatch line beyond this sandbox dry-run requires a separate\ntaskbook and fresh exact approval string"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AgentExecutorAdapterTaskbookBoundaryAuditInput {
  phase15TaskbookText: string;
  phase16AuthorizationTaskbookText: string;
  phase16SandboxTaskbookText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
}

export interface AgentExecutorAdapterTaskbookBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase15TaskbookRecorded: boolean;
    phase16AuthorizationTaskbookRecorded: boolean;
    phase16SandboxTaskbookRecorded: boolean;
    currentStateRecordsTaskbooks: boolean;
    controlPlaneRecordsTaskbookAuthority: boolean;
    governanceReadmeListsTaskbooks: boolean;
    governanceRunnerRegistered: boolean;
    phase15ApprovalsRemainNarrow: boolean;
    phase16CandidateApprovalsRemainInactive: boolean;
    phase16SandboxApprovalRemainsNarrow: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    phase15ReviewApproval: "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_IMPLEMENTATION";
    phase15SandboxApproval: "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_RUN";
    phase16ReviewCandidate: "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION";
    phase16SandboxApproval: "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN";
    taskbookExecutionAuthorized: false;
    adapterAutoDiscoveryAllowed: false;
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

export type AgentExecutorAdapterTaskbookBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectAgentExecutorAdapterTaskbookBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentExecutorAdapterTaskbookBoundaryAuditInput> {
  const [
    phase15TaskbookText,
    phase16AuthorizationTaskbookText,
    phase16SandboxTaskbookText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE15_TASKBOOK),
    read(cwd, PHASE16_AUTHORIZATION_TASKBOOK),
    read(cwd, PHASE16_SANDBOX_TASKBOOK),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase15TaskbookText,
    phase16AuthorizationTaskbookText,
    phase16SandboxTaskbookText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText
  };
}

export function reviewAgentExecutorAdapterTaskbookBoundaryAudit(
  input: AgentExecutorAdapterTaskbookBoundaryAuditInput
): AgentExecutorAdapterTaskbookBoundaryAuditResult {
  const checks = {
    phase15TaskbookRecorded: REQUIRED_PHASE15_MARKERS.every((marker) =>
      input.phase15TaskbookText.includes(marker)
    ),
    phase16AuthorizationTaskbookRecorded:
      REQUIRED_PHASE16_AUTHORIZATION_MARKERS.every((marker) =>
        input.phase16AuthorizationTaskbookText.includes(marker)
      ),
    phase16SandboxTaskbookRecorded: REQUIRED_PHASE16_SANDBOX_MARKERS.every(
      (marker) => input.phase16SandboxTaskbookText.includes(marker)
    ),
    currentStateRecordsTaskbooks: currentStateRecordsTaskbooks(input.currentStateText),
    controlPlaneRecordsTaskbookAuthority: controlPlaneRecordsTaskbookAuthority(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsTaskbooks: governanceReadmeListsTaskbooks(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-executor-adapter-taskbook-boundary"
    ),
    phase15ApprovalsRemainNarrow: phase15ApprovalsRemainNarrow(
      input.phase15TaskbookText
    ),
    phase16CandidateApprovalsRemainInactive:
      phase16CandidateApprovalsRemainInactive(input.phase16AuthorizationTaskbookText),
    phase16SandboxApprovalRemainsNarrow: phase16SandboxApprovalRemainsNarrow(
      input.phase16SandboxTaskbookText
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      phase15ReviewApproval:
        "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_IMPLEMENTATION",
      phase15SandboxApproval:
        "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_RUN",
      phase16ReviewCandidate:
        "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION",
      phase16SandboxApproval:
        "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN",
      taskbookExecutionAuthorized: false,
      adapterAutoDiscoveryAllowed: false,
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

export function formatAgentExecutorAdapterTaskbookBoundaryAuditResult(
  review: AgentExecutorAdapterTaskbookBoundaryAuditResult,
  format: AgentExecutorAdapterTaskbookBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent executor adapter taskbook boundary audit",
    `status: ${review.status}`,
    `taskbook execution authorized: ${review.summary.taskbookExecutionAuthorized}`,
    `adapter auto-discovery allowed: ${review.summary.adapterAutoDiscoveryAllowed}`,
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
  return text.includes("PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md")
    && text.includes("PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md")
    && text.includes("PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md")
    && text.includes("pre-execution requirements")
    && text.includes("future dispatch authorization requirements")
    && text.includes("dispatch sandbox dry-run taskbook");
}

function controlPlaneRecordsTaskbookAuthority(text: string): boolean {
  return text.includes("PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md")
    && text.includes(
      "Current human authority for future adapter pre-execution review requirements; not Codex CLI, provider, sub-agent runtime, shell, workspace-write, or production recovery execution authorization."
    )
    && text.includes("PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md")
    && text.includes(
      "Current human authority for future adapter dispatch authorization requirements; design-only and not Codex CLI, provider, sub-agent runtime, shell/process, workspace-write, external-write, or production recovery authorization."
    )
    && text.includes("PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md")
    && text.includes(
      "Implemented planning authority for the sandbox-only dispatch dry-run stop; not Codex CLI, provider, sub-agent runtime, shell/process, workspace-write, external-write, or production recovery authorization."
    );
}

function governanceReadmeListsTaskbooks(text: string): boolean {
  return text.includes(
    "[Phase 15 agent executor adapter authorization taskbook](PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md)"
  )
    && text.includes("current pre-execution authorization boundary")
    && text.includes(
      "[Phase 16 agent executor adapter dispatch authorization taskbook](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md)"
    )
    && text.includes("current pre-implementation boundary")
    && text.includes(
      "[Phase 16 agent executor adapter dispatch sandbox dry-run taskbook](PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md)"
    )
    && text.includes("implemented planning boundary for the sandbox-only dispatch dry-run");
}

function phase15ApprovalsRemainNarrow(text: string): boolean {
  return text.includes("Review-only implementation approval")
    && text.includes("Single sandbox-only adapter contract run approval")
    && text.includes("Real Codex-backed, sub-agent-backed, provider-backed, or workspace-write\nadapter approval is intentionally not defined here")
    && text.includes("The implemented boundary still cannot call an adapter")
    && text.includes("The sandbox contract run remains a contract witness");
}

function phase16CandidateApprovalsRemainInactive(text: string): boolean {
  return text.includes("No Phase 16 implementation approval is consumed by this taskbook")
    && text.includes("These candidate strings are not active grants")
    && text.includes("Vague approval, branch names,\ntask names, or prior Phase 15 approvals must not be treated as execution\nauthorization")
    && text.includes("The next safe implementation stop is a non-executing review-only schema");
}

function phase16SandboxApprovalRemainsNarrow(text: string): boolean {
  return text.includes("The implementation requires this exact approval string")
    && text.includes("APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN")
    && text.includes("must not be treated as this approval")
    && text.includes("The sandbox dry-run is not business recovery execution")
    && text.includes("Any next adapter dispatch line beyond this sandbox dry-run requires a separate\ntaskbook and fresh exact approval string");
}

function noBroadExecutionAuthorization(
  input: AgentExecutorAdapterTaskbookBoundaryAuditInput
): boolean {
  const text = [
    input.phase15TaskbookText,
    input.phase16AuthorizationTaskbookText,
    input.phase16SandboxTaskbookText,
    input.governanceControlPlaneText,
    input.governanceReadmeText
  ].join("\n");

  return text.includes("does not authorize `codex-router` to invoke Codex CLI")
    && text.includes("This taskbook does not authorize:")
    && text.includes("These candidate strings are not active grants")
    && text.includes("not Codex CLI, provider, sub-agent runtime")
    && !text.includes("taskbook execution authorized: true")
    && !text.includes("adapter auto-discovery allowed: true")
    && !text.includes("Codex CLI invocation allowed: true")
    && !text.includes("provider invocation allowed: true")
    && !text.includes("sub-agent runtime invocation allowed: true")
    && !text.includes("workspace-write allowed: true")
    && !text.includes("production recovery allowed: true")
    && !text.includes("real recovery-action execution allowed: true");
}

function outputSanitized(): boolean {
  const review: AgentExecutorAdapterTaskbookBoundaryAuditResult = {
    status: "passed",
    checks: {
      phase15TaskbookRecorded: true,
      phase16AuthorizationTaskbookRecorded: true,
      phase16SandboxTaskbookRecorded: true,
      currentStateRecordsTaskbooks: true,
      controlPlaneRecordsTaskbookAuthority: true,
      governanceReadmeListsTaskbooks: true,
      governanceRunnerRegistered: true,
      phase15ApprovalsRemainNarrow: true,
      phase16CandidateApprovalsRemainInactive: true,
      phase16SandboxApprovalRemainsNarrow: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      phase15ReviewApproval:
        "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_IMPLEMENTATION",
      phase15SandboxApproval:
        "APPROVE_PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_RUN",
      phase16ReviewCandidate:
        "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_IMPLEMENTATION",
      phase16SandboxApproval:
        "APPROVE_PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_SANDBOX_DRY_RUN",
      taskbookExecutionAuthorized: false,
      adapterAutoDiscoveryAllowed: false,
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
  const text = formatAgentExecutorAdapterTaskbookBoundaryAuditResult(review);
  const json = formatAgentExecutorAdapterTaskbookBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: AgentExecutorAdapterTaskbookBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `agent_executor_adapter_taskbook_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectAgentExecutorAdapterTaskbookBoundaryAuditInput();
  const review = reviewAgentExecutorAdapterTaskbookBoundaryAudit(input);
  console.log(formatAgentExecutorAdapterTaskbookBoundaryAuditResult(review, format));

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
