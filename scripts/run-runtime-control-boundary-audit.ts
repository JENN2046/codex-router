#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const RUNTIME_CONTROL_SOURCE =
  "packages/governance-internal-runtime-control/src/index.ts";
const RUNTIME_CONTROL_TEST = "tests/runtime-control.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "EscalationOutcome",
  "CreateRuntimeSignalFromGovernanceStateInput",
  "createRuntimeSignalFromGovernanceState",
  "evaluateRuntimeSignals",
  "upgradeModel",
  "MODEL_LADDER",
  "action: \"none\"",
  "action: \"upgrade_model\"",
  "action: \"open_circuit\"",
  "failure_threshold_reached",
  "scope_expanded",
  "context_pressure",
  "high_risk_signal",
  "validation_failed",
  "execution_failures:"
] as const;

const REQUIRED_TEST_MARKERS = [
  "runtime control upgrades codex spark to gpt-5.4-mini before larger models",
  "runtime control returns no action when signal stays below escalation thresholds",
  "runtime control upgrades model when failure threshold is reached",
  "runtime control upgrades model on scope expansion and validation failure",
  "runtime control upgrades model when context pressure reaches policy threshold",
  "runtime control opens circuit for sticky high-risk signal at max model",
  "runtime control derives attempt failure signal from governance execution anomalies",
  "runtime control derives sticky risk signal from high-risk governance state"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "dispatchGovernanceOperatorActionHostExecutor",
  "dispatchToHost(",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "invokeSubAgent",
  "spawnSubAgent",
  "hostExecutor(",
  "spawn(",
  "execFile(",
  "exec(",
  "child_process",
  "new Worker(",
  "fetch(",
  "writeFile(",
  "mkdir(",
  "rm(",
  "rename(",
  "copyFile(",
  "apply_patch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface RuntimeControlBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  runtimeControlSourceText: string;
  runtimeControlTestText: string;
}

export interface RuntimeControlBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    runtimeControlMode: "runtime_signal_and_escalation_outcome_only";
    runtimeSignalIsExecutionAuthorization: false;
    escalationOutcomeIsProviderExecutionAuthorization: false;
    upgradeModelIsModelRuntimeInvocation: false;
    openCircuitIsHostDispatchAuthorization: false;
    failureCountIsRecoveryExecutionAuthorization: false;
    contextPressureIsSubAgentRuntimeAuthorization: false;
    highRiskSignalIsCodexCliAuthorization: false;
    runtimeControlCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    modelRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type RuntimeControlBoundaryAuditOutputFormat = "text" | "json";

export async function collectRuntimeControlBoundaryAuditInput(
  cwd = process.cwd()
): Promise<RuntimeControlBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    runtimeControlSourceText,
    runtimeControlTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, RUNTIME_CONTROL_SOURCE),
    read(cwd, RUNTIME_CONTROL_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    runtimeControlSourceText,
    runtimeControlTestText
  };
}

export function reviewRuntimeControlBoundaryAudit(
  input: RuntimeControlBoundaryAuditInput
): RuntimeControlBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit runtime-control-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "runtime-control-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.runtimeControlSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.runtimeControlTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.runtimeControlSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      runtimeControlMode: "runtime_signal_and_escalation_outcome_only",
      runtimeSignalIsExecutionAuthorization: false,
      escalationOutcomeIsProviderExecutionAuthorization: false,
      upgradeModelIsModelRuntimeInvocation: false,
      openCircuitIsHostDispatchAuthorization: false,
      failureCountIsRecoveryExecutionAuthorization: false,
      contextPressureIsSubAgentRuntimeAuthorization: false,
      highRiskSignalIsCodexCliAuthorization: false,
      runtimeControlCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      modelRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatRuntimeControlBoundaryAuditResult(
  review: RuntimeControlBoundaryAuditResult,
  format: RuntimeControlBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Runtime control boundary audit",
    `status: ${review.status}`,
    `runtime control mode: ${review.summary.runtimeControlMode}`,
    `runtime signal is execution authorization: ${review.summary.runtimeSignalIsExecutionAuthorization}`,
    `escalation outcome is provider execution authorization: ${review.summary.escalationOutcomeIsProviderExecutionAuthorization}`,
    `upgrade_model is model runtime invocation: ${review.summary.upgradeModelIsModelRuntimeInvocation}`,
    `open_circuit is host dispatch authorization: ${review.summary.openCircuitIsHostDispatchAuthorization}`,
    `failure count is recovery execution authorization: ${review.summary.failureCountIsRecoveryExecutionAuthorization}`,
    `context pressure is sub-agent runtime authorization: ${review.summary.contextPressureIsSubAgentRuntimeAuthorization}`,
    `high-risk signal is Codex CLI authorization: ${review.summary.highRiskSignalIsCodexCliAuthorization}`,
    `runtime control calls during audit: ${review.summary.runtimeControlCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `model runtime calls during audit: ${review.summary.modelRuntimeCallsDuringAudit}`,
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
  return text.includes("Runtime control boundary")
    && text.includes("runtime signal and escalation outcome only")
    && text.includes("runtime signals are not execution authorization")
    && text.includes("escalation outcomes are not provider execution authorization")
    && text.includes("upgrade_model is not model runtime invocation")
    && text.includes("open_circuit is not host dispatch authorization")
    && text.includes("failure counts are not recovery execution authorization")
    && text.includes("context pressure is not sub-agent runtime authorization")
    && text.includes("high-risk signals are not Codex CLI authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: RuntimeControlBoundaryAuditInput): boolean {
  const output = formatRuntimeControlBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      runtimeControlMode: "runtime_signal_and_escalation_outcome_only",
      runtimeSignalIsExecutionAuthorization: false,
      escalationOutcomeIsProviderExecutionAuthorization: false,
      upgradeModelIsModelRuntimeInvocation: false,
      openCircuitIsHostDispatchAuthorization: false,
      failureCountIsRecoveryExecutionAuthorization: false,
      contextPressureIsSubAgentRuntimeAuthorization: false,
      highRiskSignalIsCodexCliAuthorization: false,
      runtimeControlCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      modelRuntimeCallsDuringAudit: 0,
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
    input.runtimeControlSourceText,
    input.runtimeControlTestText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(checks: RuntimeControlBoundaryAuditResult["checks"]): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `runtime_control_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectRuntimeControlBoundaryAuditInput();
  const review = reviewRuntimeControlBoundaryAudit(input);
  console.log(formatRuntimeControlBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Runtime control boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
