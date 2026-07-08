#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
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

const REQUIRED_SOURCE_MARKERS = [
  "RecoveryRecommendationSchema",
  "RecoveryOperatorActionSchema",
  "GovernanceOperatorActionEnvelopeSchema",
  "GovernanceOperatorActionExecutionPlanSchema",
  "GovernanceOperatorActionExecutionGateResultSchema",
  "GovernanceOperatorActionHostExecutorDescriptorSchema",
  "GovernanceOperatorActionHostExecutorAuthorizationPacketSchema",
  "GovernanceOperatorActionHostExecutorAuthorizationResultSchema",
  "GovernanceOperatorActionHostExecutorDispatchInvocationSchema",
  "GovernanceOperatorActionAgentExecutorAdapterReviewPacketSchema",
  "GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacketSchema",
  "GovernanceOperatorActionAgentTaskControlDispatchAuthorizationPacketSchema",
  "GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunPacketSchema",
  "GovernanceOperatorActionAgentTaskControlDispatchSandboxDryRunPacketSchema",
  "planGovernanceOperatorActionExecution",
  "authorizeGovernanceOperatorActionHostExecutorReview",
  "reviewGovernanceOperatorActionAgentExecutorAdapterReadiness",
  "reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization",
  "reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization",
  "runGovernanceOperatorActionAgentExecutorAdapterSandboxContract",
  "runGovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRun",
  "runGovernanceOperatorActionAgentTaskControlDispatchSandboxDryRun",
  "dispatchGovernanceOperatorActionHostExecutor"
] as const;

const REQUIRED_TEST_MARKERS = [
  "recovery control plans operator actions only after durable receipt consumption",
  "prepares host executor dispatch in dry-run without calling an executor",
  "dispatches only through the injected host executor with audit records",
  "phase16 dispatch authorization accepts review-only adapter dispatch review",
  "phase16 dispatch authorization blocks non-review dispatch classes",
  "phase16 sandbox dry-run requires sandbox dispatch and side-effect classes",
  "phase17 task control dispatch authorization accepts review-only agent context boundary",
  "phase17 task control dispatch authorization blocks wrong dispatch classes",
  "phase18 task-control sandbox dry-run calls injected sandbox adapter and records sanitized evidence",
  "phase18 task-control sandbox dry-run rejects phase15 sandbox reference adapter kind"
] as const;

const FORBIDDEN_GLOBAL_RUNTIME_MARKERS = [
  "child_process",
  "spawn(",
  "execFile(",
  "exec(",
  "fetch(",
  "provider.execute(",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "dispatchToHost(",
  "new Worker(",
  "apply_patch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface RecoveryControlOrchestrationBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  recoveryControlSourceText: string;
  recoveryControlTestText: string;
  phase15SandboxTestText: string;
  phase16AuthorizationTestText: string;
  phase16SandboxTestText: string;
  phase17AuthorizationTestText: string;
  phase18SandboxTestText: string;
}

export interface RecoveryControlOrchestrationBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    orchestrationMarkersPresent: boolean;
    phaseCoverageRecorded: boolean;
    noGlobalRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    recoveryControlMode: "schemas_packets_reviews_and_explicit_injected_witnesses_only";
    schemaStatusIsExecutionAuthorization: false;
    executionPlanIsRecoveryExecutionAuthorization: false;
    executionGateIsRuntimeAuthorization: false;
    hostExecutorReviewIsHostDispatchAuthorization: false;
    dispatchAuthorizationReviewIsAdapterInvocationAuthorization: false;
    taskControlReviewIsSubAgentRuntimeAuthorization: false;
    sandboxWitnessIsProductionRecoveryExecution: false;
    receiptStatusIsCompletionAuthorization: false;
    recoveryRecommendationIsHostExecutorAuthorization: false;
    recoveryControlCallsDuringAudit: 0;
    hostExecutorInvocationsDuringAudit: 0;
    adapterInvocationsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type RecoveryControlOrchestrationBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectRecoveryControlOrchestrationBoundaryAuditInput(
  cwd = process.cwd()
): Promise<RecoveryControlOrchestrationBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    recoveryControlSourceText,
    recoveryControlTestText,
    phase15SandboxTestText,
    phase16AuthorizationTestText,
    phase16SandboxTestText,
    phase17AuthorizationTestText,
    phase18SandboxTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, RECOVERY_CONTROL_TEST),
    read(cwd, PHASE15_SANDBOX_TEST),
    read(cwd, PHASE16_AUTHORIZATION_TEST),
    read(cwd, PHASE16_SANDBOX_TEST),
    read(cwd, PHASE17_AUTHORIZATION_TEST),
    read(cwd, PHASE18_SANDBOX_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    recoveryControlSourceText,
    recoveryControlTestText,
    phase15SandboxTestText,
    phase16AuthorizationTestText,
    phase16SandboxTestText,
    phase17AuthorizationTestText,
    phase18SandboxTestText
  };
}

export function reviewRecoveryControlOrchestrationBoundaryAudit(
  input: RecoveryControlOrchestrationBoundaryAuditInput
): RecoveryControlOrchestrationBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit recovery-control-orchestration-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "recovery-control-orchestration-boundary"
    ),
    orchestrationMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    phaseCoverageRecorded: phaseCoverageRecorded(input),
    noGlobalRuntimeInvocationSurface: noGlobalRuntimeInvocationSurface(
      input.recoveryControlSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      recoveryControlMode:
        "schemas_packets_reviews_and_explicit_injected_witnesses_only",
      schemaStatusIsExecutionAuthorization: false,
      executionPlanIsRecoveryExecutionAuthorization: false,
      executionGateIsRuntimeAuthorization: false,
      hostExecutorReviewIsHostDispatchAuthorization: false,
      dispatchAuthorizationReviewIsAdapterInvocationAuthorization: false,
      taskControlReviewIsSubAgentRuntimeAuthorization: false,
      sandboxWitnessIsProductionRecoveryExecution: false,
      receiptStatusIsCompletionAuthorization: false,
      recoveryRecommendationIsHostExecutorAuthorization: false,
      recoveryControlCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
      adapterInvocationsDuringAudit: 0,
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

export function formatRecoveryControlOrchestrationBoundaryAuditResult(
  review: RecoveryControlOrchestrationBoundaryAuditResult,
  format: RecoveryControlOrchestrationBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Recovery control orchestration boundary audit",
    `status: ${review.status}`,
    `recovery control mode: ${review.summary.recoveryControlMode}`,
    `schema status is execution authorization: ${review.summary.schemaStatusIsExecutionAuthorization}`,
    `execution plan is recovery execution authorization: ${review.summary.executionPlanIsRecoveryExecutionAuthorization}`,
    `execution gate is runtime authorization: ${review.summary.executionGateIsRuntimeAuthorization}`,
    `host executor review is host dispatch authorization: ${review.summary.hostExecutorReviewIsHostDispatchAuthorization}`,
    `dispatch authorization review is adapter invocation authorization: ${review.summary.dispatchAuthorizationReviewIsAdapterInvocationAuthorization}`,
    `task control review is sub-agent runtime authorization: ${review.summary.taskControlReviewIsSubAgentRuntimeAuthorization}`,
    `sandbox witness is production recovery execution: ${review.summary.sandboxWitnessIsProductionRecoveryExecution}`,
    `receipt status is completion authorization: ${review.summary.receiptStatusIsCompletionAuthorization}`,
    `recovery recommendation is host executor authorization: ${review.summary.recoveryRecommendationIsHostExecutorAuthorization}`,
    `recovery control calls during audit: ${review.summary.recoveryControlCallsDuringAudit}`,
    `host executor invocations during audit: ${review.summary.hostExecutorInvocationsDuringAudit}`,
    `adapter invocations during audit: ${review.summary.adapterInvocationsDuringAudit}`,
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

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Recovery control orchestration boundary")
    && text.includes("schemas, packets, reviews, and explicit injected witnesses only")
    && text.includes("schema statuses are not execution authorization")
    && text.includes("execution plans are not recovery execution authorization")
    && text.includes("execution gates are not runtime authorization")
    && text.includes("host executor reviews are not host dispatch authorization")
    && text.includes("dispatch authorization reviews are not adapter invocation authorization")
    && text.includes("task-control reviews are not sub-agent runtime authorization")
    && text.includes("sandbox witnesses are not production recovery execution")
    && text.includes("receipt statuses are not completion authorization")
    && text.includes("recovery recommendations are not host executor authorization");
}

function phaseCoverageRecorded(
  input: RecoveryControlOrchestrationBoundaryAuditInput
): boolean {
  const combined = [
    input.recoveryControlTestText,
    input.phase15SandboxTestText,
    input.phase16AuthorizationTestText,
    input.phase16SandboxTestText,
    input.phase17AuthorizationTestText,
    input.phase18SandboxTestText
  ].join("\n");

  return REQUIRED_TEST_MARKERS.every((marker) => combined.includes(marker));
}

function noGlobalRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_GLOBAL_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(
  input: RecoveryControlOrchestrationBoundaryAuditInput
): boolean {
  const output = formatRecoveryControlOrchestrationBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      orchestrationMarkersPresent: true,
      phaseCoverageRecorded: true,
      noGlobalRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      recoveryControlMode:
        "schemas_packets_reviews_and_explicit_injected_witnesses_only",
      schemaStatusIsExecutionAuthorization: false,
      executionPlanIsRecoveryExecutionAuthorization: false,
      executionGateIsRuntimeAuthorization: false,
      hostExecutorReviewIsHostDispatchAuthorization: false,
      dispatchAuthorizationReviewIsAdapterInvocationAuthorization: false,
      taskControlReviewIsSubAgentRuntimeAuthorization: false,
      sandboxWitnessIsProductionRecoveryExecution: false,
      receiptStatusIsCompletionAuthorization: false,
      recoveryRecommendationIsHostExecutorAuthorization: false,
      recoveryControlCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
      adapterInvocationsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });
  const aggregateText = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: RecoveryControlOrchestrationBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `recovery_control_orchestration_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectRecoveryControlOrchestrationBoundaryAuditInput();
  const review = reviewRecoveryControlOrchestrationBoundaryAudit(input);
  console.log(formatRecoveryControlOrchestrationBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Recovery control orchestration boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
