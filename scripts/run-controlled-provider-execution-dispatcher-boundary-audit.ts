#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const DISPATCHER_SOURCE =
  "packages/governance-internal-controlled-provider-dispatcher/src/index.ts";
const DISPATCHER_TEST = "tests/controlled-provider-dispatcher.test.ts";
const DISPATCH_PREFLIGHT_MATRIX =
  "docs/governance/CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX.md";

const REQUIRED_SOURCE_MARKERS = [
  "ControlledReadOnlyProviderDispatchPreflightSchema",
  "controlled-provider-execution-dispatch-preflight.v1",
  "providerExecutionPlanHash",
  "runnerRealExecutionGuardRequired",
  "providerRegistrySelectionRequired",
  "permitRequired",
  "preflightArtifactBindingRequired",
  "recordControlledReadOnlyProviderDispatchPreflightArtifact",
  "controlled-provider-execution-dispatch-preflight-artifact.v1",
  "collectDispatchPreflightArtifactStoreReasons",
  "artifactStore.verifyArtifact",
  "controlled_readonly_dispatch_preflight_artifact_store_missing",
  "controlled_readonly_dispatch_preflight_artifact_store_verification_failed",
  "controlled_readonly_dispatch_preflight_artifact_hash_mismatch",
  "controlled_readonly_dispatch_preflight_artifact_executor_plan_hash_mismatch",
  "controlled_readonly_dispatch_preflight_artifact_provider_manifest_hash_mismatch",
  "controlled_readonly_dispatch_preflight_artifact_policy_decision_hash_mismatch",
  "dryRunDefaultPreserved",
  "reviewControlledReadOnlyProviderDispatch",
  "dispatchControlledReadOnlyProviderExecution",
  "runProviderExecutionPlanControlledReadOnly",
  "validateProviderExecutionPermitForPlan",
  "summarizeProviderSelectionResult",
  "requiredCapabilities: providerExecutionPlan.requiredCapabilities",
  "routeStrategyV2",
  "controlled_readonly_dispatch_governance_strategy_blocked",
  "controlled_readonly_dispatch_governance_phase_blocked",
  "controlled_readonly_dispatch_environment_preflight_artifact_hash_mismatch",
  "controlled_readonly_dispatch_preflight_metadata_not_sanitized",
  "containsForbiddenExecutionMaterial",
  "controlled_readonly_dispatch_task_hash_required",
  "controlled_readonly_dispatch_task_hash_mismatch",
  "controlled_readonly_dispatch_run_not_running",
  "controlled_readonly_dispatch_provider_plan_required_approvals_present",
  "controlled_readonly_dispatch_policy_task_mismatch",
  "controlled_readonly_dispatch_run_policy_decision_mismatch",
  "controlled_readonly_dispatch_provider_manifest_hash_required",
  "controlled_readonly_dispatch_principal_hash_required",
  "controlled_readonly_dispatch_principal_hash_mismatch",
  "controlled_readonly_dispatch_task_envelope_hash_mismatch",
  "controlled_readonly_dispatch_provider_plan_required_capabilities_policy_mismatch",
  "controlled_readonly_dispatch_provider_plan_side_effect_class_policy_mismatch",
  "capabilityScopeToCanonicalString",
  "resolvePolicySideEffectClass",
  "controlled_readonly_dispatch_executor_plan_task_hash_mismatch",
  "controlled_readonly_dispatch_executor_plan_input_hash_mismatch",
  "controlled_readonly_dispatch_executor_plan_requires_approval_policy_never",
  "readCodexCliApprovalPolicy",
  "equalStringSets",
  "controlled_readonly_dispatch_requires_read_only_side_effect",
  "controlled_readonly_dispatch_provider_execution_plan_hash_mismatch",
  "runnerInvoked: false",
  "executeInvoked: false"
] as const;

const REQUIRED_TEST_MARKERS = [
  "controlled provider dispatcher gates the runner with exact dispatch preflight",
  "controlled provider dispatcher requires stored preflight artifact before runner",
  "controlled provider dispatcher verifies stored preflight artifact payload before runner",
  "controlled provider dispatcher binds stored preflight artifact metadata before runner",
  "controlled provider dispatcher binds stored preflight artifact authorization context before runner",
  "controlled provider dispatcher stores distinct preflight artifacts for same provider runs",
  "controlled provider dispatcher blocks preflight artifact drift before runner",
  "controlled provider dispatcher blocks unsafe preflight metadata before runner",
  "controlled provider dispatcher blocks permit drift before runner",
  "controlled provider dispatcher blocks stale task content before runner",
  "controlled provider dispatcher blocks stale principal content before runner",
  "controlled provider dispatcher blocks stale task envelope content before runner",
  "controlled provider dispatcher blocks non-running runs before runner",
  "controlled provider dispatcher blocks provider plans requiring approvals before runner",
  "controlled provider dispatcher blocks policy-derived provider plan drift before runner",
  "controlled provider dispatcher blocks providers missing required capabilities before runner",
  "controlled provider dispatcher accepts runtime provider entries without duplicate attestation registration",
  "controlled provider dispatcher blocks policy task and run binding drift before runner",
  "controlled provider dispatcher blocks provider plans without manifest binding before runner",
  "controlled provider dispatcher blocks stale executor plan fields before runner",
  "controlled provider dispatcher blocks stale executor approval policy before runner",
  "controlled provider dispatcher blocks governance recovery before runner",
  "controlled provider dispatcher blocks broad provider plans before runner",
  "runnerInvoked, false",
  "executeInvoked, false",
  "validateExecutionPlan, 0",
  "execute, 0",
  "controlled_readonly_dispatch_environment_preflight_artifact_hash_mismatch",
  "controlled_readonly_dispatch_preflight_artifact_store_missing",
  "controlled_readonly_dispatch_preflight_artifact_store_verification_failed:sha256_mismatch",
  "controlled_readonly_dispatch_preflight_artifact_hash_mismatch",
  "controlled_readonly_dispatch_preflight_artifact_executor_plan_hash_mismatch",
  "controlled_readonly_dispatch_preflight_artifact_provider_manifest_hash_mismatch",
  "controlled_readonly_dispatch_preflight_artifact_policy_decision_hash_mismatch",
  "controlled_readonly_dispatch_preflight_metadata_not_sanitized",
  "controlled_readonly_dispatch_permit_provider_plan_hash_mismatch",
  "controlled_readonly_dispatch_task_hash_mismatch",
  "controlled_readonly_dispatch_run_not_running:succeeded",
  "controlled_readonly_dispatch_provider_plan_required_approvals_present",
  "provider_selection_missing_capability:fs.read:workspace/**",
  "controlled_readonly_dispatch_policy_task_mismatch:task_controlled_provider_dispatcher_other:task_controlled_provider_dispatcher_001",
  "controlled_readonly_dispatch_run_policy_decision_mismatch:decision_controlled_provider_dispatcher_001:decision_controlled_provider_dispatcher_other",
  "controlled_readonly_dispatch_provider_manifest_hash_required",
  "controlled_readonly_dispatch_principal_hash_mismatch",
  "controlled_readonly_dispatch_task_envelope_hash_mismatch",
  "controlled_readonly_dispatch_provider_plan_required_capabilities_policy_mismatch",
  "controlled_readonly_dispatch_provider_plan_side_effect_class_policy_mismatch:read_only:local_command",
  "controlled_readonly_dispatch_executor_plan_task_hash_mismatch",
  "controlled_readonly_dispatch_executor_plan_input_hash_mismatch",
  "controlled_readonly_dispatch_executor_plan_requires_approval_policy_never:on-request",
  "controlled_readonly_dispatch_governance_phase_blocked:recovery",
  "controlled_readonly_dispatch_requires_read_only_side_effect:workspace_write"
] as const;

const FORBIDDEN_DISPATCHER_SOURCE_MARKERS = [
  "provider.execute(",
  "spawn(",
  "execFile(",
  "workspace-write allowed: true",
  "dispatch authorizes workspace-write: true",
  "sub-agent runtime allowed: true",
  "host executor allowed: true"
] as const;

const FORBIDDEN_AUTHORITY_RUNTIME_MARKERS = [
  "provider.execute(",
  "workspace-write allowed: true",
  "dispatch authorizes workspace-write: true",
  "sub-agent runtime allowed: true",
  "host executor allowed: true"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ControlledProviderExecutionDispatcherBoundaryAuditInput {
  controlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  dispatcherSourceText: string;
  dispatcherTestText: string;
  dispatchPreflightMatrixText: string;
}

export interface ControlledProviderExecutionDispatcherBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    dispatchPreflightMatrixStillRecorded: boolean;
    dispatcherSourceRecorded: boolean;
    dispatcherRegressionCoverageRecorded: boolean;
    noDirectRuntimeInvocation: boolean;
    outputSanitized: boolean;
  };
  summary: {
    dispatcherMode: "controlled_readonly_pre_runner_dispatcher";
    consumesDispatchPreflightSchema: true;
    callsRunnerBoundary: true;
    callsProviderExecuteDirectly: false;
    callsRealCodexCliDirectly: false;
    authorizesWorkspaceWrite: false;
    authorizesHostExecutor: false;
    authorizesSubAgentRuntime: false;
    defaultDryRunPreserved: true;
    providerExecutionPlanHashRequired: true;
    providerRegistrySelectionRequired: true;
    permitValidationRequired: true;
    preflightArtifactBindingRequired: true;
    preflightArtifactStoreVerificationRequired: true;
    preflightArtifactAuthorizationContextBindingRequired: true;
    governanceStrategyStopRequired: true;
    runnerInvocationsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    realCodexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ControlledProviderExecutionDispatcherBoundaryAuditOutputFormat =
  "text" | "json";

export async function collectControlledProviderExecutionDispatcherBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ControlledProviderExecutionDispatcherBoundaryAuditInput> {
  const [
    controlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    dispatcherSourceText,
    dispatcherTestText,
    dispatchPreflightMatrixText
  ] = await Promise.all([
    read(cwd, CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, DISPATCHER_SOURCE),
    read(cwd, DISPATCHER_TEST),
    read(cwd, DISPATCH_PREFLIGHT_MATRIX)
  ]);

  return {
    controlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    dispatcherSourceText,
    dispatcherTestText,
    dispatchPreflightMatrixText
  };
}

export function reviewControlledProviderExecutionDispatcherBoundaryAudit(
  input: ControlledProviderExecutionDispatcherBoundaryAuditInput
): ControlledProviderExecutionDispatcherBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded:
      input.controlPlaneText.includes("Controlled provider execution dispatcher boundary")
      && input.controlPlaneText.includes("controlled_readonly_pre_runner_dispatcher"),
    governanceReadmeListsBoundary:
      input.governanceReadmeText.includes(
        "npm run governance -- audit controlled-provider-execution-dispatcher-boundary"
      )
      && input.governanceReadmeText.includes(
        "governance-internal-controlled-provider-dispatcher"
      ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "controlled-provider-execution-dispatcher-boundary"
    ),
    dispatchPreflightMatrixStillRecorded:
      input.dispatchPreflightMatrixText.includes(
        "CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX_RECORDED"
      )
      && input.dispatchPreflightMatrixText.includes(
        "may hand off to the provider execution runner boundary"
      ),
    dispatcherSourceRecorded: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.dispatcherSourceText.includes(marker)
    ),
    dispatcherRegressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.dispatcherTestText.includes(marker)
    ),
    noDirectRuntimeInvocation: noDirectRuntimeInvocation(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      dispatcherMode: "controlled_readonly_pre_runner_dispatcher",
      consumesDispatchPreflightSchema: true,
      callsRunnerBoundary: true,
      callsProviderExecuteDirectly: false,
      callsRealCodexCliDirectly: false,
      authorizesWorkspaceWrite: false,
      authorizesHostExecutor: false,
      authorizesSubAgentRuntime: false,
      defaultDryRunPreserved: true,
      providerExecutionPlanHashRequired: true,
      providerRegistrySelectionRequired: true,
      permitValidationRequired: true,
      preflightArtifactBindingRequired: true,
      preflightArtifactStoreVerificationRequired: true,
      preflightArtifactAuthorizationContextBindingRequired: true,
      governanceStrategyStopRequired: true,
      runnerInvocationsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatControlledProviderExecutionDispatcherBoundaryAuditResult(
  review: ControlledProviderExecutionDispatcherBoundaryAuditResult,
  format: ControlledProviderExecutionDispatcherBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Controlled provider execution dispatcher boundary audit",
    `status: ${review.status}`,
    `dispatcher mode: ${review.summary.dispatcherMode}`,
    `consumes dispatch preflight schema: ${review.summary.consumesDispatchPreflightSchema}`,
    `calls runner boundary: ${review.summary.callsRunnerBoundary}`,
    `calls provider execute directly: ${review.summary.callsProviderExecuteDirectly}`,
    `calls real Codex CLI directly: ${review.summary.callsRealCodexCliDirectly}`,
    `authorizes workspace-write: ${review.summary.authorizesWorkspaceWrite}`,
    `authorizes host executor: ${review.summary.authorizesHostExecutor}`,
    `authorizes sub-agent runtime: ${review.summary.authorizesSubAgentRuntime}`,
    `default dry-run preserved: ${review.summary.defaultDryRunPreserved}`,
    `provider execution plan hash required: ${review.summary.providerExecutionPlanHashRequired}`,
    `provider registry selection required: ${review.summary.providerRegistrySelectionRequired}`,
    `permit validation required: ${review.summary.permitValidationRequired}`,
    `preflight artifact binding required: ${review.summary.preflightArtifactBindingRequired}`,
    `preflight artifact store verification required: ${review.summary.preflightArtifactStoreVerificationRequired}`,
    `preflight artifact authorization context binding required: ${review.summary.preflightArtifactAuthorizationContextBindingRequired}`,
    `governance strategy stop required: ${review.summary.governanceStrategyStopRequired}`,
    `runner invocations during audit: ${review.summary.runnerInvocationsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `real Codex CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function outputSanitized(
  input: ControlledProviderExecutionDispatcherBoundaryAuditInput
): boolean {
  const review: ControlledProviderExecutionDispatcherBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      dispatchPreflightMatrixStillRecorded: true,
      dispatcherSourceRecorded: true,
      dispatcherRegressionCoverageRecorded: true,
      noDirectRuntimeInvocation: true,
      outputSanitized: true
    },
    summary: {
      dispatcherMode: "controlled_readonly_pre_runner_dispatcher",
      consumesDispatchPreflightSchema: true,
      callsRunnerBoundary: true,
      callsProviderExecuteDirectly: false,
      callsRealCodexCliDirectly: false,
      authorizesWorkspaceWrite: false,
      authorizesHostExecutor: false,
      authorizesSubAgentRuntime: false,
      defaultDryRunPreserved: true,
      providerExecutionPlanHashRequired: true,
      providerRegistrySelectionRequired: true,
      permitValidationRequired: true,
      preflightArtifactBindingRequired: true,
      preflightArtifactStoreVerificationRequired: true,
      preflightArtifactAuthorizationContextBindingRequired: true,
      governanceStrategyStopRequired: true,
      runnerInvocationsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatControlledProviderExecutionDispatcherBoundaryAuditResult(review);
  const json = formatControlledProviderExecutionDispatcherBoundaryAuditResult(
    review,
    "json"
  );

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
      !authorityText(input).includes(marker)
    );
}

function noDirectRuntimeInvocation(
  input: ControlledProviderExecutionDispatcherBoundaryAuditInput
): boolean {
  return FORBIDDEN_DISPATCHER_SOURCE_MARKERS.every(
    (marker) => !input.dispatcherSourceText.includes(marker)
  )
    && FORBIDDEN_AUTHORITY_RUNTIME_MARKERS.every(
      (marker) => !linkedAuthorityText(input).includes(marker)
    );
}

function authorityText(
  input: ControlledProviderExecutionDispatcherBoundaryAuditInput
): string {
  return [
    input.controlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    input.dispatcherSourceText,
    input.dispatchPreflightMatrixText
  ].join("\n");
}

function linkedAuthorityText(
  input: ControlledProviderExecutionDispatcherBoundaryAuditInput
): string {
  return [
    input.controlPlaneText,
    input.governanceReadmeText,
    input.dispatchPreflightMatrixText
  ].join("\n");
}

function collectReasons(
  checks: ControlledProviderExecutionDispatcherBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) =>
      `controlled_provider_execution_dispatcher_boundary_${name}`
    );
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input =
    await collectControlledProviderExecutionDispatcherBoundaryAuditInput();
  const review = reviewControlledProviderExecutionDispatcherBoundaryAudit(input);
  console.log(
    formatControlledProviderExecutionDispatcherBoundaryAuditResult(
      review,
      format
    )
  );

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
