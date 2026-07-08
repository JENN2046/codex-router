#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE10_CLOSEOUT =
  "docs/governance/PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const RECOVERY_CONTROL_SOURCE =
  "packages/governance-internal-recovery-control/src/index.ts";
const RECOVERY_CONTROL_TEST = "tests/recovery-control.test.ts";
const PROVIDER_RUNNER_SOURCE =
  "packages/governance-internal-provider-execution-runner/src/index.ts";
const PROVIDER_RUNNER_TEST = "tests/provider-execution-runner.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_SOURCE_MARKERS = [
  "planGovernanceOperatorActionExecution",
  "GovernanceOperatorActionExecutionGateResultSchema",
  "GovernanceOperatorActionExecutionPlanSchema",
  "input.executionMode !== \"plan_only\"",
  "operator_action_executor_mode_not_plan_only",
  "operator_action_executor_receipt_consumption_store_proof_missing",
  "operator_action_executor_action_not_allowed",
  "addOperatorActionLifecycleReasons",
  "executionMode: \"plan_only\"",
  "Plan-only gate accepted"
] as const;

const REQUIRED_TEST_MARKERS = [
  "recovery control plans operator actions only after durable receipt consumption",
  "recovery control blocks forged durable receipt consumption without store proof",
  "recovery control preserves rollback checkpoint targets in execution plans",
  "recovery control rejects planned gate results whose top-level fields drift from the plan",
  "recovery control preserves rollback checkpoint targets in blocked gate results",
  "recovery control blocks operator action planning without consumed receipts",
  "recovery control blocks operator action planning for non-durable receipts",
  "recovery control blocks operator action planning for task/action/hash drift",
  "recovery control blocks operator action planning outside the action allowlist",
  "recovery control blocks operator action planning outside plan-only mode",
  "operator_action_executor_mode_not_plan_only",
  "gate.plan, undefined"
] as const;

const REQUIRED_PROVIDER_RUNNER_MARKERS = [
  "summarizeGovernanceOperatorActionEnvelope",
  "operatorActionSummary",
  "provider execution runner exposes operator action on third controlled read-only failure",
  "operatorActionSummary?.present, true",
  "provider execution runner blocks invalid governance state before provider hooks",
  "operatorActionSummary?.present, false",
  "provider.calls.execute, 0",
  "executeInvoked, false"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface OperatorActionExecutorGateBoundaryAuditInput {
  phase10CloseoutText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  recoveryControlSourceText: string;
  recoveryControlTestText: string;
  providerRunnerSourceText: string;
  providerRunnerTestText: string;
  governanceRunnerText: string;
}

export interface OperatorActionExecutorGateBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase10CloseoutRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    planOnlySurfacePresent: boolean;
    durableReceiptProofRequired: boolean;
    lifecycleAndAllowlistBound: boolean;
    checkpointPropagationRecorded: boolean;
    providerRunnerSummarySanitized: boolean;
    failClosedCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    gateMode: "plan_only";
    gateStatusWhenAllowed: "planned";
    executionAuthorizedByGate: false;
    hostExecutorInvocationAllowed: false;
    recoveryActionExecutionAllowed: false;
    codexCliInvocationAllowed: false;
    providerExecutionAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteAllowed: false;
    externalWriteAllowed: false;
    hostExecutorInvocationsDuringAudit: 0;
    recoveryActionExecutionsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type OperatorActionExecutorGateBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectOperatorActionExecutorGateBoundaryAuditInput(
  cwd = process.cwd()
): Promise<OperatorActionExecutorGateBoundaryAuditInput> {
  const [
    phase10CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    providerRunnerSourceText,
    providerRunnerTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE10_CLOSEOUT),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, RECOVERY_CONTROL_TEST),
    read(cwd, PROVIDER_RUNNER_SOURCE),
    read(cwd, PROVIDER_RUNNER_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase10CloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    providerRunnerSourceText,
    providerRunnerTestText,
    governanceRunnerText
  };
}

export function reviewOperatorActionExecutorGateBoundaryAudit(
  input: OperatorActionExecutorGateBoundaryAuditInput
): OperatorActionExecutorGateBoundaryAuditResult {
  const checks = {
    phase10CloseoutRecorded: phase10CloseoutRecorded(input.phase10CloseoutText),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "operator-action-executor-gate-boundary"
    ),
    planOnlySurfacePresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    durableReceiptProofRequired: durableReceiptProofRequired(input),
    lifecycleAndAllowlistBound: lifecycleAndAllowlistBound(input),
    checkpointPropagationRecorded: checkpointPropagationRecorded(input),
    providerRunnerSummarySanitized: providerRunnerSummarySanitized(input),
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
      gateMode: "plan_only",
      gateStatusWhenAllowed: "planned",
      executionAuthorizedByGate: false,
      hostExecutorInvocationAllowed: false,
      recoveryActionExecutionAllowed: false,
      codexCliInvocationAllowed: false,
      providerExecutionAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteAllowed: false,
      externalWriteAllowed: false,
      hostExecutorInvocationsDuringAudit: 0,
      recoveryActionExecutionsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatOperatorActionExecutorGateBoundaryAuditResult(
  review: OperatorActionExecutorGateBoundaryAuditResult,
  format: OperatorActionExecutorGateBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Operator action executor gate boundary audit",
    `status: ${review.status}`,
    `gate mode: ${review.summary.gateMode}`,
    `gate status when allowed: ${review.summary.gateStatusWhenAllowed}`,
    `execution authorized by gate: ${review.summary.executionAuthorizedByGate}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `recovery action execution allowed: ${review.summary.recoveryActionExecutionAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `provider execution allowed: ${review.summary.providerExecutionAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write allowed: ${review.summary.workspaceWriteAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `host executor invocations during audit: ${review.summary.hostExecutorInvocationsDuringAudit}`,
    `recovery action executions during audit: ${review.summary.recoveryActionExecutionsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
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

function phase10CloseoutRecorded(text: string): boolean {
  return text.includes("Phase 10 Operator Action Executor Gate Closeout")
    && text.includes("plan-only executor gate")
    && text.includes("executionMode: \"plan_only\"")
    && text.includes("does not authorize recovery execution")
    && text.includes("separate explicit authorization boundary")
    && text.includes("Real provider execution, real Codex CLI execution")
    && text.includes("This closeout does not authorize");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 10 operator action executor gate is closed out")
    && text.includes("gate is plan-only and does not authorize recovery execution")
    && text.includes("PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md")
    && text.includes("checkpoint-preserving plans without authorizing recovery");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md")
    && text.includes("Operator action executor gate closeout")
    && text.includes("Runtime operator action executor gate")
    && text.includes("active / plan-only")
    && text.includes("No | Phase 10 can produce a checkpoint-preserving plan");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 10 operator action executor gate closeout")
    && text.includes("plan-only operator action executor gate")
    && text.includes("npm run governance -- audit operator-action-executor-gate-boundary");
}

function durableReceiptProofRequired(
  input: OperatorActionExecutorGateBoundaryAuditInput
): boolean {
  return input.phase10CloseoutText.includes("Durable receipt proof binding")
    && input.recoveryControlSourceText.includes(
      "hasGovernanceOperatorActionReceiptConsumptionStoreProof"
    )
    && input.recoveryControlSourceText.includes(
      "operator_action_executor_receipt_consumption_store_proof_missing"
    )
    && input.recoveryControlTestText.includes(
      "blocks forged durable receipt consumption without store proof"
    );
}

function lifecycleAndAllowlistBound(
  input: OperatorActionExecutorGateBoundaryAuditInput
): boolean {
  return input.phase10CloseoutText.includes("Lifecycle binding")
    && input.phase10CloseoutText.includes("Action allowlist")
    && input.recoveryControlSourceText.includes("addOperatorActionLifecycleReasons")
    && input.recoveryControlSourceText.includes(
      "operator_action_executor_action_not_allowed"
    )
    && input.recoveryControlTestText.includes(
      "blocks operator action planning when lifecycle has not consumed the receipt"
    )
    && input.recoveryControlTestText.includes(
      "blocks operator action planning outside the action allowlist"
    );
}

function checkpointPropagationRecorded(
  input: OperatorActionExecutorGateBoundaryAuditInput
): boolean {
  return input.phase10CloseoutText.includes("Rollback checkpoint propagation")
    && input.recoveryControlSourceText.includes(
      "...(envelope.checkpointRef !== undefined ? { checkpointRef: envelope.checkpointRef } : {})"
    )
    && input.recoveryControlTestText.includes(
      "preserves rollback checkpoint targets in execution plans"
    )
    && input.recoveryControlTestText.includes(
      "preserves rollback checkpoint targets in blocked gate results"
    );
}

function providerRunnerSummarySanitized(
  input: OperatorActionExecutorGateBoundaryAuditInput
): boolean {
  return REQUIRED_PROVIDER_RUNNER_MARKERS.every((marker) =>
    [input.providerRunnerSourceText, input.providerRunnerTestText]
      .join("\n")
      .includes(marker)
  )
    && input.providerRunnerSourceText.includes("rawprompt")
    && input.providerRunnerSourceText.includes("rawstdout")
    && input.providerRunnerSourceText.includes("rawstderr")
    && input.providerRunnerTestText.includes("execute: 0");
}

function noBroadExecutionAuthorization(
  input: OperatorActionExecutorGateBoundaryAuditInput
): boolean {
  const combined = [
    input.phase10CloseoutText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return combined.includes("does not authorize recovery execution")
    && combined.includes("real Codex CLI execution")
    && combined.includes("workspace-write execution")
    && combined.includes("external writes")
    && combined.includes("general provider execution")
    && !combined.includes("operator action executor gate authorizes execution")
    && !combined.includes("executionMode: \"execute\"")
    && !combined.includes("Runtime operator action executor gate | active / execute | Yes")
    && !combined.includes("general provider execution allowed: true");
}

function outputSanitized(
  input: OperatorActionExecutorGateBoundaryAuditInput
): boolean {
  const outputSource = [
    input.phase10CloseoutText,
    input.currentStateText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `operator_action_executor_gate_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectOperatorActionExecutorGateBoundaryAuditInput();
  const review = reviewOperatorActionExecutorGateBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatOperatorActionExecutorGateBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Operator action executor gate boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
