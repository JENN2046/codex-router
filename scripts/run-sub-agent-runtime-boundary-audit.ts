#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE13_AGENT_BACKED_BOUNDARY =
  "docs/governance/PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md";
const PHASE15_REVIEW_CLOSEOUT =
  "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md";
const PHASE15_SANDBOX_CLOSEOUT =
  "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md";
const PHASE16_REVIEW_CLOSEOUT =
  "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md";
const PHASE16_SANDBOX_CLOSEOUT =
  "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md";
const PHASE17_CLOSEOUT =
  "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md";
const PHASE18_CLOSEOUT =
  "docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const RECOVERY_CONTROL_SOURCE =
  "packages/governance-internal-recovery-control/src/index.ts";
const RECOVERY_CONTROL_TEST = "tests/recovery-control.test.ts";
const PHASE15_SANDBOX_TEST =
  "tests/phase15-agent-executor-adapter-sandbox-contract.test.ts";
const PHASE16_AUTHORIZATION_TEST =
  "tests/phase16-agent-executor-adapter-dispatch-authorization.test.ts";
const PHASE16_SANDBOX_TEST =
  "tests/phase16-agent-executor-adapter-dispatch-sandbox-dry-run.test.ts";
const PHASE17_AUTHORIZATION_TEST =
  "tests/phase17-agent-task-control-dispatch-authorization.test.ts";
const PHASE18_SANDBOX_TEST =
  "tests/phase18-agent-task-control-dispatch-sandbox-dry-run.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_REVIEW_SOURCE_MARKERS = [
  "GovernanceOperatorActionAgentExecutorAdapterKindSchema",
  "\"sub_agent_adapter\"",
  "GovernanceOperatorActionAgentExecutorAdapterDescriptorSchema",
  "executionBoundary: z.literal(\"review_only\")",
  "invocationSupported: z.literal(false)",
  "sideEffectBoundary: z.literal(\"none\")",
  "reviewGovernanceOperatorActionAgentExecutorAdapterReadiness",
  "Review-only agent executor adapter readiness accepted",
  "no Codex CLI, sub-agent runtime, provider, shell, workspace-write, or recovery action was invoked"
] as const;

const REQUIRED_SANDBOX_SOURCE_MARKERS = [
  "GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacketSchema",
  "adapterKind: z.literal(\"sandbox_reference_adapter\")",
  "sideEffectBoundary: z.literal(\"sandbox_only\")",
  "runGovernanceOperatorActionAgentExecutorAdapterSandboxContract",
  "operator_action_agent_executor_adapter_sandbox_contract_adapter_required",
  "operator_action_agent_executor_adapter_sandbox_contract_audit_sink_required",
  "Sandbox-only agent executor adapter contract returned",
  "runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun",
  "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_adapter_required",
  "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_evidence_sink_required",
  "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_adapter_kind_not_sandbox_reference",
  "Phase 16 sandbox dry-run returned"
] as const;

const REQUIRED_TASK_CONTROL_SOURCE_MARKERS = [
  "GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_APPROVAL",
  "GOVERNANCE_OPERATOR_ACTION_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_APPROVAL",
  "reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization",
  "runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun",
  "adapterKind: z.literal(\"sandbox_task_control_adapter\")",
  "operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_kind_not_sandbox_task_control",
  "Phase 18 task-control sandbox dry-run returned",
  "no Codex CLI, sub-agent runtime, provider, shell, real workspace-write, external write, production recovery, or real recovery action was invoked"
] as const;

const REQUIRED_TEST_MARKERS = [
  "assert.equal(readiness.adapterKind, \"sub_agent_adapter\")",
  "invocationSupported: true",
  "phase16 dispatch authorization blocks non-review dispatch classes",
  "phase16 sandbox dry-run requires sandbox dispatch and side-effect classes",
  "assert.equal(result.adapterKind, \"sandbox_reference_adapter\")",
  "assert.match(result.operatorInstruction ?? \"\", /no sub-agent runtime/)",
  "phase18 task-control sandbox dry-run rejects phase15 sandbox reference adapter kind"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface SubAgentRuntimeBoundaryAuditInput {
  phase13AgentBackedBoundaryText: string;
  phase15ReviewCloseoutText: string;
  phase15SandboxCloseoutText: string;
  phase16ReviewCloseoutText: string;
  phase16SandboxCloseoutText: string;
  phase17CloseoutText: string;
  phase18CloseoutText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  recoveryControlSourceText: string;
  recoveryControlTestText: string;
  phase15SandboxTestText: string;
  phase16AuthorizationTestText: string;
  phase16SandboxTestText: string;
  phase17AuthorizationTestText: string;
  phase18SandboxTestText: string;
  governanceRunnerText: string;
}

export interface SubAgentRuntimeBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase13AgentBackedBoundaryRecorded: boolean;
    phase15ReviewOnlyRecorded: boolean;
    phase15SandboxContractRecorded: boolean;
    phase16ReviewOnlyRecorded: boolean;
    phase16SandboxDryRunRecorded: boolean;
    phase17TaskControlReviewOnlyRecorded: boolean;
    phase18TaskControlSandboxRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    reviewOnlySubAgentIdentityConstrained: boolean;
    sandboxAdaptersConstrained: boolean;
    taskControlSandboxConstrained: boolean;
    failClosedCoverageRecorded: boolean;
    noBroadRuntimeAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    reviewAdapterKind: "sub_agent_adapter";
    reviewExecutionBoundary: "review_only";
    reviewInvocationSupported: false;
    sandboxAdapterKind: "sandbox_reference_adapter";
    taskControlAdapterKind: "sandbox_task_control_adapter";
    subAgentRuntimeExecutionAllowed: false;
    subAgentRuntimeCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    adapterInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type SubAgentRuntimeBoundaryAuditOutputFormat = "text" | "json";

export async function collectSubAgentRuntimeBoundaryAuditInput(
  cwd = process.cwd()
): Promise<SubAgentRuntimeBoundaryAuditInput> {
  const [
    phase13AgentBackedBoundaryText,
    phase15ReviewCloseoutText,
    phase15SandboxCloseoutText,
    phase16ReviewCloseoutText,
    phase16SandboxCloseoutText,
    phase17CloseoutText,
    phase18CloseoutText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    phase15SandboxTestText,
    phase16AuthorizationTestText,
    phase16SandboxTestText,
    phase17AuthorizationTestText,
    phase18SandboxTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE13_AGENT_BACKED_BOUNDARY),
    read(cwd, PHASE15_REVIEW_CLOSEOUT),
    read(cwd, PHASE15_SANDBOX_CLOSEOUT),
    read(cwd, PHASE16_REVIEW_CLOSEOUT),
    read(cwd, PHASE16_SANDBOX_CLOSEOUT),
    read(cwd, PHASE17_CLOSEOUT),
    read(cwd, PHASE18_CLOSEOUT),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, RECOVERY_CONTROL_TEST),
    read(cwd, PHASE15_SANDBOX_TEST),
    read(cwd, PHASE16_AUTHORIZATION_TEST),
    read(cwd, PHASE16_SANDBOX_TEST),
    read(cwd, PHASE17_AUTHORIZATION_TEST),
    read(cwd, PHASE18_SANDBOX_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase13AgentBackedBoundaryText,
    phase15ReviewCloseoutText,
    phase15SandboxCloseoutText,
    phase16ReviewCloseoutText,
    phase16SandboxCloseoutText,
    phase17CloseoutText,
    phase18CloseoutText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    phase15SandboxTestText,
    phase16AuthorizationTestText,
    phase16SandboxTestText,
    phase17AuthorizationTestText,
    phase18SandboxTestText,
    governanceRunnerText
  };
}

export function reviewSubAgentRuntimeBoundaryAudit(
  input: SubAgentRuntimeBoundaryAuditInput
): SubAgentRuntimeBoundaryAuditResult {
  const checks = {
    phase13AgentBackedBoundaryRecorded: phase13AgentBackedBoundaryRecorded(
      input.phase13AgentBackedBoundaryText
    ),
    phase15ReviewOnlyRecorded: phase15ReviewOnlyRecorded(
      input.phase15ReviewCloseoutText
    ),
    phase15SandboxContractRecorded: phase15SandboxContractRecorded(
      input.phase15SandboxCloseoutText
    ),
    phase16ReviewOnlyRecorded: phase16ReviewOnlyRecorded(
      input.phase16ReviewCloseoutText
    ),
    phase16SandboxDryRunRecorded: phase16SandboxDryRunRecorded(
      input.phase16SandboxCloseoutText
    ),
    phase17TaskControlReviewOnlyRecorded: phase17TaskControlReviewOnlyRecorded(
      input.phase17CloseoutText
    ),
    phase18TaskControlSandboxRecorded: phase18TaskControlSandboxRecorded(
      input.phase18CloseoutText
    ),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit sub-agent-runtime-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "sub-agent-runtime-boundary"
    ),
    reviewOnlySubAgentIdentityConstrained:
      REQUIRED_REVIEW_SOURCE_MARKERS.every((marker) =>
        input.recoveryControlSourceText.includes(marker)
      ),
    sandboxAdaptersConstrained: REQUIRED_SANDBOX_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    taskControlSandboxConstrained: REQUIRED_TASK_CONTROL_SOURCE_MARKERS.every(
      (marker) => input.recoveryControlSourceText.includes(marker)
    ),
    failClosedCoverageRecorded: failClosedCoverageRecorded(input),
    noBroadRuntimeAuthorization: noBroadRuntimeAuthorization(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      reviewAdapterKind: "sub_agent_adapter",
      reviewExecutionBoundary: "review_only",
      reviewInvocationSupported: false,
      sandboxAdapterKind: "sandbox_reference_adapter",
      taskControlAdapterKind: "sandbox_task_control_adapter",
      subAgentRuntimeExecutionAllowed: false,
      subAgentRuntimeCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      adapterInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatSubAgentRuntimeBoundaryAuditResult(
  review: SubAgentRuntimeBoundaryAuditResult,
  format: SubAgentRuntimeBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Sub-agent runtime boundary audit",
    `status: ${review.status}`,
    `review adapter kind: ${review.summary.reviewAdapterKind}`,
    `review execution boundary: ${review.summary.reviewExecutionBoundary}`,
    `review invocation supported: ${review.summary.reviewInvocationSupported}`,
    `sandbox adapter kind: ${review.summary.sandboxAdapterKind}`,
    `task-control adapter kind: ${review.summary.taskControlAdapterKind}`,
    `sub-agent runtime execution allowed: ${review.summary.subAgentRuntimeExecutionAllowed}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
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

function phase13AgentBackedBoundaryRecorded(text: string): boolean {
  return text.includes("Phase 13 Agent-Backed Recovery Executor Boundary")
    && text.includes("Codex / sub-agent runtime")
    && text.includes("explicitly selected and authorized by the host layer")
    && text.includes("Sandbox reference executor")
    && text.includes("not a production executor")
    && text.includes("Any production host executor, Codex CLI-backed executor, provider-backed")
    && text.includes("requires a separate taskbook");
}

function phase15ReviewOnlyRecorded(text: string): boolean {
  return text.includes("Phase 15 Agent Executor Adapter Review-Only Closeout")
    && text.includes("review-only readiness boundary")
    && text.includes("executionBoundary = review_only")
    && text.includes("invocationSupported = false")
    && text.includes("sideEffectBoundary = none")
    && text.includes("sub-agent process or runtime invocation");
}

function phase15SandboxContractRecorded(text: string): boolean {
  return text.includes("Phase 15 Agent Executor Adapter Sandbox Contract Closeout")
    && text.includes("sandbox-only adapter contract run boundary")
    && text.includes("adapterKind = sandbox_reference_adapter")
    && text.includes("sideEffectBoundary = sandbox_only")
    && text.includes("No global adapter lookup is allowed")
    && text.includes("sub-agent process or runtime invocation");
}

function phase16ReviewOnlyRecorded(text: string): boolean {
  return text.includes("Phase 16 Agent Executor Adapter Dispatch Authorization Review-Only Closeout")
    && text.includes("review-only dispatch authorization boundary")
    && text.includes("requestedDispatchClass = review_only")
    && text.includes("requestedSideEffectClass = none")
    && text.includes("does not authorize")
    && text.includes("sub-agent process or runtime invocation");
}

function phase16SandboxDryRunRecorded(text: string): boolean {
  return text.includes("Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Closeout")
    && text.includes("sandbox-only dispatch dry-run boundary")
    && text.includes("adapterKind = sandbox_reference_adapter")
    && text.includes("requestedSideEffectClass = sandbox_only")
    && text.includes("sub-agent process or runtime invocation")
    && text.includes("Any Codex-backed adapter, sub-agent-backed adapter");
}

function phase17TaskControlReviewOnlyRecorded(text: string): boolean {
  return text.includes("Phase 17 Agent Task Control Dispatch Authorization Review-Only Closeout")
    && text.includes("review-only authorization boundary")
    && text.includes("requestedDispatchClass = agent_task_control")
    && text.includes("requestedSideEffectClass = agent_context_only")
    && text.includes("sub-agent process or runtime invocation")
    && text.includes("Any Codex-backed adapter, sub-agent-backed adapter");
}

function phase18TaskControlSandboxRecorded(text: string): boolean {
  return text.includes("Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Closeout")
    && text.includes("sandbox-only dry-run boundary")
    && text.includes("adapterKind = sandbox_task_control_adapter")
    && text.includes("spawn a sub-agent runtime")
    && text.includes("The Phase 15 `sandbox_reference_adapter` remains incompatible")
    && text.includes("The implementation did not run real Codex CLI, provider execution, sub-agent");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Sub-agent runtime execution boundary")
    && text.includes("blocked / review identities only")
    && text.includes("No")
    && text.includes("sub_agent_adapter")
    && text.includes("sandbox_reference_adapter")
    && text.includes("sandbox_task_control_adapter");
}

function failClosedCoverageRecorded(input: SubAgentRuntimeBoundaryAuditInput): boolean {
  const combinedTests = [
    input.recoveryControlTestText,
    input.phase15SandboxTestText,
    input.phase16AuthorizationTestText,
    input.phase16SandboxTestText,
    input.phase17AuthorizationTestText,
    input.phase18SandboxTestText
  ].join("\n");

  return REQUIRED_TEST_MARKERS.every((marker) => combinedTests.includes(marker));
}

function noBroadRuntimeAuthorization(input: SubAgentRuntimeBoundaryAuditInput): boolean {
  const docs = [
    input.phase15ReviewCloseoutText,
    input.phase15SandboxCloseoutText,
    input.phase16ReviewCloseoutText,
    input.phase16SandboxCloseoutText,
    input.phase17CloseoutText,
    input.phase18CloseoutText,
    input.governanceControlPlaneText
  ].join("\n");
  const source = input.recoveryControlSourceText;

  const docsKeepRuntimeBlocked =
    countIncludes(docs, "sub-agent process or runtime invocation") >= 4
    && docs.includes("spawn a sub-agent runtime")
    && docs.includes("not a Codex CLI adapter, sub-agent\nruntime adapter")
    && docs.includes("requires a new taskbook")
    && docs.includes("No global adapter lookup is allowed");
  const sourceKeepsRuntimeBlocked =
    source.includes("invocationSupported: z.literal(false)")
    && source.includes("adapterKind: z.literal(\"sandbox_reference_adapter\")")
    && source.includes("adapterKind: z.literal(\"sandbox_task_control_adapter\")")
    && source.includes("operator_action_agent_executor_adapter_sandbox_contract_adapter_required")
    && source.includes("operator_action_agent_task_control_dispatch_sandbox_dry_run_adapter_required");
  const noPositiveRuntimeAuthorization =
    !docs.includes("sub-agent runtime execution authorized")
    && !docs.includes("spawn sub-agent runtime allowed")
    && !docs.includes("sub_agent_adapter can invoke runtime")
    && !source.includes("invocationSupported: z.literal(true)")
    && !source.includes("spawnAgent(")
    && !source.includes("spawn_agent(");

  return docsKeepRuntimeBlocked && sourceKeepsRuntimeBlocked && noPositiveRuntimeAuthorization;
}

function outputSanitized(): boolean {
  const review: SubAgentRuntimeBoundaryAuditResult = {
    status: "passed",
    checks: {
      phase13AgentBackedBoundaryRecorded: true,
      phase15ReviewOnlyRecorded: true,
      phase15SandboxContractRecorded: true,
      phase16ReviewOnlyRecorded: true,
      phase16SandboxDryRunRecorded: true,
      phase17TaskControlReviewOnlyRecorded: true,
      phase18TaskControlSandboxRecorded: true,
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      reviewOnlySubAgentIdentityConstrained: true,
      sandboxAdaptersConstrained: true,
      taskControlSandboxConstrained: true,
      failClosedCoverageRecorded: true,
      noBroadRuntimeAuthorization: true,
      outputSanitized: true
    },
    summary: {
      reviewAdapterKind: "sub_agent_adapter",
      reviewExecutionBoundary: "review_only",
      reviewInvocationSupported: false,
      sandboxAdapterKind: "sandbox_reference_adapter",
      taskControlAdapterKind: "sandbox_task_control_adapter",
      subAgentRuntimeExecutionAllowed: false,
      subAgentRuntimeCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      adapterInvocationsDuringAudit: 0
    },
    reasons: []
  };
  const output = formatSubAgentRuntimeBoundaryAuditResult(review);
  const json = formatSubAgentRuntimeBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: SubAgentRuntimeBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `sub_agent_runtime_boundary_${name}`);
}

function countIncludes(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectSubAgentRuntimeBoundaryAuditInput();
  const review = reviewSubAgentRuntimeBoundaryAudit(input);
  console.log(formatSubAgentRuntimeBoundaryAuditResult(review, format));

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
