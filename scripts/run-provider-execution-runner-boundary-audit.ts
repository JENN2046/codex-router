#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const PROVIDER_RUNNER_SOURCE =
  "packages/governance-internal-provider-execution-runner/src/index.ts";
const PROVIDER_RUNNER_TEST = "tests/provider-execution-runner.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_RUNNER_SOURCE_MARKERS = [
  "export async function runProviderExecutionPlanDryRun",
  "export async function runProviderExecutionPlanControlledReadOnly",
  "export async function runProviderExecutionPlanControlledWorkspaceWrite",
  "providerEntry.provider.execute(executorPlan",
  "executeInvoked: true",
  "providerExecuteInvoked: false",
  "controlled_readonly_requires_codex_cli_provider",
  "controlled_readonly_requires_read_only_side_effect",
  "controlled_readonly_requires_read_only_sandbox",
  "controlled_readonly_requires_no_writable_roots",
  "controlled_readonly_provider_execution_permit_required",
  "controlled_readonly_provider_execution_metadata_required",
  "codexCliProviderRealExecutionGuard",
  "controlled_readonly_environment_preflight_artifact_ref_required",
  "controlled_readonly_environment_preflight_artifact_hash_required",
  "controlled_readonly_provider_governance_state_strategy_blocked",
  "controlled_readonly_provider_governance_state_phase_blocked",
  "controlled_workspace_write_requires_workspace_write_side_effect",
  "controlled_workspace_write_requires_workspace_write_sandbox",
  "runWorkspaceWriteExecution",
  "strategyDecision.agentBudget.executor === 0"
] as const;

const REQUIRED_RUNNER_TEST_MARKERS = [
  "provider execution runner dry-runs executor plans and records audit evidence",
  "provider execution runner validates codex-cli dry-runs without invoking execute",
  "provider execution runner executes controlled workspace-write operations through local executor only",
  "provider execution runner blocks non workspace-write plans before local write execution",
  "provider execution runner reports workspace-write executor failures without provider execute",
  "provider execution runner executes controlled read-only codex-cli plans with explicit permit and guard",
  "provider execution runner blocks controlled read-only execution without metadata before spawn",
  "provider execution runner blocks controlled read-only execution without a provider permit before spawn",
  "provider execution runner blocks controlled read-only execution without preflight artifact binding",
  "provider execution runner blocks controlled read-only execution with preflight artifact drift",
  "provider execution runner rejects controlled read-only executor plan metadata tampering",
  "provider execution runner blocks controlled read-only execution for non-codex providers",
  "provider execution runner blocks governance states requiring step-back before provider hooks",
  "provider execution runner blocks simulate-only governance states before provider hooks",
  "provider execution runner blocks recovery-phase governance states before provider hooks",
  "planExecution: 0",
  "validateExecutionPlan: 0",
  "execute: 0"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ProviderExecutionRunnerBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  providerRunnerSourceText: string;
  providerRunnerTestText: string;
  governanceRunnerText: string;
}

export interface ProviderExecutionRunnerBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    controlledReadOnlyExecuteGatePresent: boolean;
    runnerRegressionCoverageRecorded: boolean;
    governanceStopCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    runnerMode: "controlled_readonly_and_workspace_write_gate";
    dryRunExecuteInvoked: false;
    controlledReadOnlyExecuteAllowed: true;
    controlledReadOnlyProviderId: "codex-cli";
    controlledReadOnlySideEffectClass: "read_only";
    controlledReadOnlySandbox: "read-only";
    permitRequired: true;
    executorPlanRequired: true;
    preflightArtifactBindingRequired: true;
    realExecutionGuardRequired: true;
    governanceStrategyStopBlocksBeforeProviderHooks: true;
    simulateBlocksBeforeProviderHooks: true;
    recoveryPhaseBlocksBeforeProviderHooks: true;
    nonCodexProviderExecutionAllowed: false;
    workspaceWriteAllowedByRunner: true;
    workspaceWriteProviderExecuteAllowed: false;
    defaultRealCodexCliAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    providerRunnerCallsDuringAudit: 0;
    providerPlanExecutionCallsDuringAudit: 0;
    providerValidateExecutionPlanCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    realCodexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ProviderExecutionRunnerBoundaryAuditOutputFormat = "text" | "json";

export async function collectProviderExecutionRunnerBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ProviderExecutionRunnerBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    providerRunnerSourceText,
    providerRunnerTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, PROVIDER_RUNNER_SOURCE),
    read(cwd, PROVIDER_RUNNER_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    providerRunnerSourceText,
    providerRunnerTestText,
    governanceRunnerText
  };
}

export function reviewProviderExecutionRunnerBoundaryAudit(
  input: ProviderExecutionRunnerBoundaryAuditInput
): ProviderExecutionRunnerBoundaryAuditResult {
  const checks = {
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit provider-execution-runner-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "provider-execution-runner-boundary"
    ),
    controlledReadOnlyExecuteGatePresent:
      REQUIRED_RUNNER_SOURCE_MARKERS.every((marker) =>
        input.providerRunnerSourceText.includes(marker)
      ),
    runnerRegressionCoverageRecorded:
      REQUIRED_RUNNER_TEST_MARKERS.every((marker) =>
        input.providerRunnerTestText.includes(marker)
      ),
    governanceStopCoverageRecorded: governanceStopCoverageRecorded(
      input.providerRunnerTestText
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      runnerMode: "controlled_readonly_and_workspace_write_gate",
      dryRunExecuteInvoked: false,
      controlledReadOnlyExecuteAllowed: true,
      controlledReadOnlyProviderId: "codex-cli",
      controlledReadOnlySideEffectClass: "read_only",
      controlledReadOnlySandbox: "read-only",
      permitRequired: true,
      executorPlanRequired: true,
      preflightArtifactBindingRequired: true,
      realExecutionGuardRequired: true,
      governanceStrategyStopBlocksBeforeProviderHooks: true,
      simulateBlocksBeforeProviderHooks: true,
      recoveryPhaseBlocksBeforeProviderHooks: true,
      nonCodexProviderExecutionAllowed: false,
      workspaceWriteAllowedByRunner: true,
      workspaceWriteProviderExecuteAllowed: false,
      defaultRealCodexCliAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      providerRunnerCallsDuringAudit: 0,
      providerPlanExecutionCallsDuringAudit: 0,
      providerValidateExecutionPlanCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatProviderExecutionRunnerBoundaryAuditResult(
  review: ProviderExecutionRunnerBoundaryAuditResult,
  format: ProviderExecutionRunnerBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Provider execution runner boundary audit",
    `status: ${review.status}`,
    `runner mode: ${review.summary.runnerMode}`,
    `controlled read-only execute allowed: ${review.summary.controlledReadOnlyExecuteAllowed}`,
    `controlled read-only provider id: ${review.summary.controlledReadOnlyProviderId}`,
    `controlled read-only side-effect class: ${review.summary.controlledReadOnlySideEffectClass}`,
    `controlled read-only sandbox: ${review.summary.controlledReadOnlySandbox}`,
    `permit required: ${review.summary.permitRequired}`,
    `preflight artifact binding required: ${review.summary.preflightArtifactBindingRequired}`,
    `real execution guard required: ${review.summary.realExecutionGuardRequired}`,
    `non-codex provider execution allowed: ${review.summary.nonCodexProviderExecutionAllowed}`,
    `workspace-write allowed by runner: ${review.summary.workspaceWriteAllowedByRunner}`,
    `workspace-write provider execute allowed: ${review.summary.workspaceWriteProviderExecuteAllowed}`,
    `provider runner calls during audit: ${review.summary.providerRunnerCallsDuringAudit}`,
    `provider planExecution calls during audit: ${review.summary.providerPlanExecutionCallsDuringAudit}`,
    `provider validateExecutionPlan calls during audit: ${review.summary.providerValidateExecutionPlanCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `real Codex CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Provider execution runner boundary")
    && text.includes("controlled read-only")
    && text.includes("controlled workspace-write")
    && text.includes("provider.execute");
}

function governanceStopCoverageRecorded(text: string): boolean {
  return text.includes(
    "controlled_readonly_provider_governance_state_strategy_blocked:step_back"
  )
    && text.includes(
      "controlled_readonly_provider_governance_state_strategy_blocked:simulate"
    )
    && text.includes(
      "controlled_readonly_provider_governance_state_phase_blocked:recovery"
    )
    && text.includes("planExecution: 0")
    && text.includes("validateExecutionPlan: 0")
    && text.includes("execute: 0");
}

function noBroadExecutionAuthorization(
  input: ProviderExecutionRunnerBoundaryAuditInput
): boolean {
  const text = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText
  ].join("\n");

  return !text.includes("provider execution runner workspace-write provider execute allowed: true")
    && !text.includes("provider execution runner default real Codex CLI allowed: true")
    && !text.includes("provider execution runner non-codex provider execution allowed: true")
    && !text.includes("provider execution runner sub-agent runtime invocation allowed: true")
    && !text.includes("provider execution runner host executor invocation allowed: true");
}

function outputSanitized(
  input: ProviderExecutionRunnerBoundaryAuditInput
): boolean {
  const review: ProviderExecutionRunnerBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      controlledReadOnlyExecuteGatePresent: true,
      runnerRegressionCoverageRecorded: true,
      governanceStopCoverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      runnerMode: "controlled_readonly_and_workspace_write_gate",
      dryRunExecuteInvoked: false,
      controlledReadOnlyExecuteAllowed: true,
      controlledReadOnlyProviderId: "codex-cli",
      controlledReadOnlySideEffectClass: "read_only",
      controlledReadOnlySandbox: "read-only",
      permitRequired: true,
      executorPlanRequired: true,
      preflightArtifactBindingRequired: true,
      realExecutionGuardRequired: true,
      governanceStrategyStopBlocksBeforeProviderHooks: true,
      simulateBlocksBeforeProviderHooks: true,
      recoveryPhaseBlocksBeforeProviderHooks: true,
      nonCodexProviderExecutionAllowed: false,
      workspaceWriteAllowedByRunner: true,
      workspaceWriteProviderExecuteAllowed: false,
      defaultRealCodexCliAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      providerRunnerCallsDuringAudit: 0,
      providerPlanExecutionCallsDuringAudit: 0,
      providerValidateExecutionPlanCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatProviderExecutionRunnerBoundaryAuditResult(review);
  const json = formatProviderExecutionRunnerBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
      !input.providerRunnerSourceText.includes(marker)
    );
}

function collectReasons(
  checks: ProviderExecutionRunnerBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `provider_execution_runner_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectProviderExecutionRunnerBoundaryAuditInput();
  const review = reviewProviderExecutionRunnerBoundaryAudit(input);
  console.log(formatProviderExecutionRunnerBoundaryAuditResult(review, format));

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
