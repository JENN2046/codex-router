#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE14_RECEIPT_CONTRACT =
  "docs/governance/PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const RECOVERY_CONTROL_SOURCE =
  "packages/governance-internal-recovery-control/src/index.ts";
const RECOVERY_CONTROL_TEST = "tests/recovery-control.test.ts";
const DESKTOP_HOST_CLIENT_TEST = "tests/desktop-host-client.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const EXECUTOR_RECEIPT_STATUSES = [
  "accepted",
  "running",
  "completed",
  "failed",
  "refused",
  "aborted"
] as const;

const TERMINAL_EXECUTOR_STATUSES = ["failed", "refused", "aborted"] as const;

const REQUIRED_SOURCE_MARKERS = [
  "GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema",
  "GovernanceOperatorActionHostExecutorDispatchExecutorReasonCodeSchema",
  "GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema",
  "operator_action_host_executor_dispatch_executor_terminal_status_requires_reason_code",
  "operator_action_host_executor_dispatch_executor_reason_code_unsafe",
  "executorStatus: GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema.optional()",
  "executorReasonCode:",
  "executorResultRef: GovernanceOperatorSanitizedRefSchema.optional()",
  "executorResult = GovernanceOperatorActionHostExecutorDispatchExecutorResultSchema.parse",
  "executorStatus: executorResult.status",
  "executorReasonCode: executorResult.reasonCode",
  "executorResultRef: executorResult.resultRef",
  "Injected host executor dispatch returned"
] as const;

const REQUIRED_TEST_MARKERS = [
  "recovery control preserves injected host executor receipt status",
  "recovery control accepts non-terminal injected host executor receipt status",
  "recovery control rejects terminal injected host executor receipts without reason codes",
  "recovery control rejects unsafe injected host executor receipt reason codes",
  "phase14_agent_executor_refused",
  "phase14-agent-failed-without-reason",
  "operator_action_host_executor_dispatch_executor_reason_code_unsafe"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface HostExecutorReceiptBoundaryAuditInput {
  phase14ReceiptContractText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  recoveryControlSourceText: string;
  recoveryControlTestText: string;
  desktopHostClientTestText: string;
  governanceRunnerText: string;
}

export interface HostExecutorReceiptBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase14ContractRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    receiptStatusesConstrained: boolean;
    terminalReasonCodeRequired: boolean;
    receiptPropagationRecorded: boolean;
    desktopHostClientReceiptSurfaceRecorded: boolean;
    failClosedCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    receiptStatuses: typeof EXECUTOR_RECEIPT_STATUSES;
    terminalStatusesRequireReasonCode: true;
    dispatchResultMeansBusinessRecoveryCompleted: false;
    defaultRealExecutionAllowed: false;
    realCodexCliCallsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    executorInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type HostExecutorReceiptBoundaryAuditOutputFormat = "text" | "json";

export async function collectHostExecutorReceiptBoundaryAuditInput(
  cwd = process.cwd()
): Promise<HostExecutorReceiptBoundaryAuditInput> {
  const [
    phase14ReceiptContractText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    desktopHostClientTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE14_RECEIPT_CONTRACT),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, RECOVERY_CONTROL_TEST),
    read(cwd, DESKTOP_HOST_CLIENT_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase14ReceiptContractText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    desktopHostClientTestText,
    governanceRunnerText
  };
}

export function reviewHostExecutorReceiptBoundaryAudit(
  input: HostExecutorReceiptBoundaryAuditInput
): HostExecutorReceiptBoundaryAuditResult {
  const checks = {
    phase14ContractRecorded: phase14ContractRecorded(
      input.phase14ReceiptContractText
    ),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "host-executor-receipt-boundary"
    ),
    receiptStatusesConstrained: receiptStatusesConstrained(input),
    terminalReasonCodeRequired: terminalReasonCodeRequired(input),
    receiptPropagationRecorded: receiptPropagationRecorded(input),
    desktopHostClientReceiptSurfaceRecorded:
      desktopHostClientReceiptSurfaceRecorded(input),
    failClosedCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.recoveryControlTestText.includes(marker)
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      receiptStatuses: EXECUTOR_RECEIPT_STATUSES,
      terminalStatusesRequireReasonCode: true,
      dispatchResultMeansBusinessRecoveryCompleted: false,
      defaultRealExecutionAllowed: false,
      realCodexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      executorInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatHostExecutorReceiptBoundaryAuditResult(
  review: HostExecutorReceiptBoundaryAuditResult,
  format: HostExecutorReceiptBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Host executor receipt boundary audit",
    `status: ${review.status}`,
    `receipt statuses: ${review.summary.receiptStatuses.join(",")}`,
    `terminal statuses require reason code: ${review.summary.terminalStatusesRequireReasonCode}`,
    `dispatch result means business recovery completed: ${review.summary.dispatchResultMeansBusinessRecoveryCompleted}`,
    `default real execution allowed: ${review.summary.defaultRealExecutionAllowed}`,
    `real Codex CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    `executor invocations during audit: ${review.summary.executorInvocationsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function phase14ContractRecorded(text: string): boolean {
  return text.includes("Phase 14 Agent Executor Receipt Contract")
    && text.includes("status: active boundary")
    && text.includes("non-executing host executor receipt normalization")
    && text.includes("dispatch.status = dispatched")
    && text.includes("does not mean business recovery finished")
    && EXECUTOR_RECEIPT_STATUSES.every((status) => text.includes(`\`${status}\``))
    && TERMINAL_EXECUTOR_STATUSES.every((status) => text.includes(status))
    && text.includes("Terminal executor statuses require a stable reason code")
    && text.includes("Raw exception messages")
    && text.includes("This boundary does not add");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 14 agent executor receipt contract is recorded")
    && text.includes("PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT_RECORDED")
    && text.includes("authorizing")
    && text.includes("recovery execution")
    && text.includes("Codex CLI adapter")
    && text.includes("provider adapter")
    && text.includes("shell/process executor")
    && text.includes("external write")
    && text.includes("workspace-write")
    && text.includes("production recovery execution");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("[Phase 14 Agent Executor Receipt Contract](PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md)")
    && text.includes("| `PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md` | Agent executor receipt contract |")
    && text.includes("| Agent executor receipt contract | active / non-executing | No |")
    && text.includes("| Agent executor receipt contract | `PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md` |");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 14 agent executor receipt contract")
    && text.includes("not real recovery-action execution authorization")
    && text.includes("npm run governance -- audit host-executor-receipt-boundary");
}

function receiptStatusesConstrained(
  input: HostExecutorReceiptBoundaryAuditInput
): boolean {
  return EXECUTOR_RECEIPT_STATUSES.every((status) =>
    input.recoveryControlSourceText.includes(`"${status}"`)
  )
    && input.recoveryControlSourceText.includes(
      "GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema"
    )
    && input.recoveryControlSourceText.includes(
      "status: GovernanceOperatorActionHostExecutorDispatchExecutorStatusSchema"
    )
    && input.phase14ReceiptContractText.includes(
      "The outer dispatch result remains separate"
    );
}

function terminalReasonCodeRequired(
  input: HostExecutorReceiptBoundaryAuditInput
): boolean {
  return TERMINAL_EXECUTOR_STATUSES.every((status) =>
    input.recoveryControlSourceText.includes(`"${status}"`)
  )
    && REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    )
    && input.recoveryControlTestText.includes(
      "rejects terminal injected host executor receipts without reason codes"
    )
    && input.recoveryControlTestText.includes(
      "rejects unsafe injected host executor receipt reason codes"
    );
}

function receiptPropagationRecorded(
  input: HostExecutorReceiptBoundaryAuditInput
): boolean {
  return input.recoveryControlSourceText.includes("executorStatus: executorResult.status")
    && input.recoveryControlSourceText.includes(
      "executorReasonCode: executorResult.reasonCode"
    )
    && input.recoveryControlSourceText.includes(
      "executorResultRef: executorResult.resultRef"
    )
    && input.recoveryControlSourceText.includes(
      "Injected host executor dispatch returned"
    )
    && input.recoveryControlTestText.includes("executorStatus, \"refused\"")
    && input.recoveryControlTestText.includes(
      "executorReasonCode, \"phase14_agent_executor_refused\""
    )
    && input.recoveryControlTestText.includes("executorStatus, \"running\"");
}

function desktopHostClientReceiptSurfaceRecorded(
  input: HostExecutorReceiptBoundaryAuditInput
): boolean {
  return input.desktopHostClientTestText.includes("executorStatus, \"accepted\"")
    && input.desktopHostClientTestText.includes(
      "executorResultRef, \"artifact:desktop-host-client-dispatch-result\""
    )
    && input.desktopHostClientTestText.includes("callCountBeforeReview")
    && input.desktopHostClientTestText.includes(
      "assert.equal(calls.length, callCountBeforeReview)"
    );
}

function noBroadExecutionAuthorization(
  input: HostExecutorReceiptBoundaryAuditInput
): boolean {
  const combined = [
    input.phase14ReceiptContractText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return combined.includes("not an authorization to invoke Codex CLI")
    && combined.includes("does not add an executor adapter")
    && combined.includes("Codex CLI adapter")
    && combined.includes("provider adapter")
    && combined.includes("shell/process executor")
    && combined.includes("external write")
    && combined.includes("workspace-wide write")
    && combined.includes("production recovery")
    && !/Agent executor receipt contract\s*\|\s*active[^\n|]*\|\s*Yes/i.test(combined)
    && !combined.includes("means business recovery finished")
    && !combined.includes("dispatch.status = dispatched authorizes recovery completion");
}

function outputSanitized(input: HostExecutorReceiptBoundaryAuditInput): boolean {
  const outputSource = [
    input.phase14ReceiptContractText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `host_executor_receipt_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectHostExecutorReceiptBoundaryAuditInput();
  const review = reviewHostExecutorReceiptBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatHostExecutorReceiptBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Host executor receipt boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
