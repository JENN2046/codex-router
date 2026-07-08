#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE17_CLOSEOUT =
  "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md";
const PHASE18_TASKBOOK =
  "docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md";
const PHASE18_CLOSEOUT =
  "docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const RECOVERY_CONTROL_SOURCE =
  "packages/governance-internal-recovery-control/src/index.ts";
const PHASE18_TEST =
  "tests/phase18-agent-task-control-dispatch-sandbox-dry-run.test.ts";
const PHASE18_FIXTURE =
  "tests/fixtures/phase18-sandbox-task-control-adapter.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_SOURCE_MARKERS = [
  "GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_APPROVAL",
  "GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunPacketSchema",
  "GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunInvocationSchema",
  "GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAdapterResultSchema",
  "GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunAuditEventSchema",
  "GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunResultSchema",
  "runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun",
  "APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION",
  "phase18_task_control_sandbox_dry_run_no_real_recovery_execution"
] as const;

const REQUIRED_FAIL_CLOSED_MARKERS = [
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_authorization_review_required",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_packet_required",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_required",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_audit_sink_required",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_evidence_sink_required",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_kind_incompatible",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_kind_not_sandbox_task_control",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_operation_ref_mismatch",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_audit_sink_failed",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_evidence_sink_failed"
] as const;

const REQUIRED_TEST_MARKERS = [
  "calls injected sandbox adapter and records sanitized evidence",
  "blocks before adapter when evidence sink is missing",
  "blocks before adapter when phase17 review hash drifts",
  "rejects phase15 sandbox reference adapter kind",
  "records completion evidence only after final audit succeeds",
  "sanitizes adapter failures"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AgentTaskControlSandboxBoundaryAuditInput {
  phase17CloseoutText: string;
  phase18TaskbookText: string;
  phase18CloseoutText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  recoveryControlSourceText: string;
  phase18TestText: string;
  phase18FixtureText: string;
  governanceRunnerText: string;
}

export interface AgentTaskControlSandboxBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase17PrerequisiteRecorded: boolean;
    phase18TaskbookRecorded: boolean;
    phase18CloseoutRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    implementationSurfacePresent: boolean;
    separateAdapterKindEnforced: boolean;
    explicitInjectionRequired: boolean;
    failClosedBeforeAdapter: boolean;
    sanitizedEvidenceBoundaryRecorded: boolean;
    validationCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    dispatchClass: "agent_task_control";
    sideEffectClass: "agent_context_only";
    adapterKind: "sandbox_task_control_adapter";
    approvalString: "APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION";
    realCodexCliCallsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    adapterInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentTaskControlSandboxBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectAgentTaskControlSandboxBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentTaskControlSandboxBoundaryAuditInput> {
  const [
    phase17CloseoutText,
    phase18TaskbookText,
    phase18CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    phase18TestText,
    phase18FixtureText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE17_CLOSEOUT),
    read(cwd, PHASE18_TASKBOOK),
    read(cwd, PHASE18_CLOSEOUT),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, PHASE18_TEST),
    read(cwd, PHASE18_FIXTURE),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase17CloseoutText,
    phase18TaskbookText,
    phase18CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    phase18TestText,
    phase18FixtureText,
    governanceRunnerText
  };
}

export function reviewAgentTaskControlSandboxBoundaryAudit(
  input: AgentTaskControlSandboxBoundaryAuditInput
): AgentTaskControlSandboxBoundaryAuditResult {
  const checks = {
    phase17PrerequisiteRecorded: phase17PrerequisiteRecorded(input.phase17CloseoutText),
    phase18TaskbookRecorded: phase18TaskbookRecorded(input.phase18TaskbookText),
    phase18CloseoutRecorded: phase18CloseoutRecorded(input.phase18CloseoutText),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-task-control-sandbox-boundary"
    ),
    implementationSurfacePresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    separateAdapterKindEnforced: separateAdapterKindEnforced(input),
    explicitInjectionRequired: explicitInjectionRequired(input.recoveryControlSourceText),
    failClosedBeforeAdapter: REQUIRED_FAIL_CLOSED_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    sanitizedEvidenceBoundaryRecorded: sanitizedEvidenceBoundaryRecorded(input),
    validationCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.phase18TestText.includes(marker)
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
      adapterKind: "sandbox_task_control_adapter",
      approvalString:
        "APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION",
      realCodexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      adapterInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatAgentTaskControlSandboxBoundaryAuditResult(
  review: AgentTaskControlSandboxBoundaryAuditResult,
  format: AgentTaskControlSandboxBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent task control sandbox boundary audit",
    `status: ${review.status}`,
    `dispatch class: ${review.summary.dispatchClass}`,
    `side-effect class: ${review.summary.sideEffectClass}`,
    `adapter kind: ${review.summary.adapterKind}`,
    `approval string: ${review.summary.approvalString}`,
    `real Codex CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    `adapter invocations during audit: ${review.summary.adapterInvocationsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function phase17PrerequisiteRecorded(text: string): boolean {
  return text.includes("Phase 17 Agent Task Control Dispatch Authorization Review-Only Closeout")
    && text.includes("requestedDispatchClass = agent_task_control")
    && text.includes("requestedSideEffectClass = agent_context_only")
    && text.includes("does not invoke an adapter")
    && text.includes("sub-agent runtime")
    && text.includes("workspace-write");
}

function phase18TaskbookRecorded(text: string): boolean {
  return text.includes("Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Taskbook")
    && text.includes("sandbox_task_control_adapter")
    && text.includes("APPROVE_PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_IMPLEMENTATION")
    && text.includes("Vague instructions")
    && text.includes("must not be treated as this approval")
    && text.includes("sandbox_reference_adapter");
}

function phase18CloseoutRecorded(text: string): boolean {
  return text.includes("Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Closeout")
    && text.includes("status: active boundary")
    && text.includes("sandbox-only dry-run boundary")
    && text.includes("sandbox_task_control_adapter")
    && text.includes("phase18_task_control_sandbox_dry_run_no_real_recovery_execution")
    && text.includes("It does not invoke Codex CLI")
    && text.includes("spawn a sub-agent runtime")
    && text.includes("mutate a real workspace");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 18 agent task control dispatch sandbox dry-run implementation")
    && text.includes("explicitly injected")
    && text.includes("sandbox_task_control_adapter")
    && text.includes("It does not authorize Codex CLI")
    && text.includes("sub-agent runtime");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("[Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Taskbook](PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md)")
    && text.includes("[Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Closeout](PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md)")
    && text.includes("| Agent task control dispatch sandbox dry-run taskbook | `PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md` |")
    && text.includes("| Agent task control dispatch sandbox dry-run closeout | `PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md` |")
    && text.includes("| Agent task control dispatch sandbox dry-run |")
    && text.includes("active / sandbox contract witness")
    && text.includes("No real execution")
    && text.includes("Codex CLI, provider, sub-agent runtime, shell/process execution");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 18 agent task control dispatch sandbox dry-run closeout")
    && text.includes("sandbox_task_control_adapter")
    && text.includes("npm run governance -- audit agent-task-control-sandbox-boundary");
}

function separateAdapterKindEnforced(
  input: AgentTaskControlSandboxBoundaryAuditInput
): boolean {
  return input.recoveryControlSourceText.includes("z.literal(\"sandbox_task_control_adapter\")")
    && input.recoveryControlSourceText.includes("sandbox_reference_adapter")
    && input.phase18TestText.includes("rejects phase15 sandbox reference adapter kind")
    && input.phase18CloseoutText.includes("The Phase 15 `sandbox_reference_adapter` remains incompatible")
    && input.phase18FixtureText.includes("Phase18SandboxTaskControlAdapter");
}

function explicitInjectionRequired(text: string): boolean {
  return text.includes("input.adapter === undefined")
    && text.includes("input.auditSink === undefined")
    && text.includes("input.evidenceSink === undefined")
    && text.includes("operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_required")
    && text.includes("operator_action_agent_task_control_dispatch_sandbox_dry_run_audit_sink_required")
    && text.includes("operator_action_agent_task_control_dispatch_sandbox_dry_run_evidence_sink_required");
}

function sanitizedEvidenceBoundaryRecorded(
  input: AgentTaskControlSandboxBoundaryAuditInput
): boolean {
  return input.phase18CloseoutText.includes("They do not contain raw prompts")
    && input.phase18CloseoutText.includes("raw stdout/stderr")
    && input.phase18FixtureText.includes("taskIdHash")
    && input.phase18FixtureText.includes("actionRefHash")
    && input.phase18FixtureText.includes("receiptIdHash")
    && input.phase18TestText.includes("records completion evidence only after final audit succeeds")
    && input.phase18TestText.includes("sanitizes adapter failures");
}

function noBroadExecutionAuthorization(
  input: AgentTaskControlSandboxBoundaryAuditInput
): boolean {
  const combined = [
    input.phase18TaskbookText,
    input.phase18CloseoutText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return input.phase18CloseoutText.includes("It does not invoke Codex CLI")
    && combined.includes("does not authorize Codex CLI")
    && combined.includes("sub-agent runtime")
    && combined.includes("shell/process execution")
    && combined.includes("workspace-write")
    && combined.includes("external write")
    && combined.includes("production recovery")
    && !/general\s+(?:provider|workspace-write).*allowed/i.test(combined)
    && !/real execution allowed\s*\|\s*Yes[^|]*Agent task control/i.test(combined);
}

function outputSanitized(input: AgentTaskControlSandboxBoundaryAuditInput): boolean {
  return FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
    !input.phase18CloseoutText.includes(marker)
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `agent_task_control_sandbox_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectAgentTaskControlSandboxBoundaryAuditInput();
  const review = reviewAgentTaskControlSandboxBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatAgentTaskControlSandboxBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Agent task control sandbox boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
