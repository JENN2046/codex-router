#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const CODEX_CLI_HOST_PUBLIC_SOURCE = "packages/codex-cli-host/src/index.ts";
const CODEX_CLI_HOST_SOURCE = "packages/codex-cli-host/src/index-impl.ts";
const CODEX_CLI_HOST_GOVERNANCE_SOURCE =
  "packages/codex-cli-host/src/governance-v2.ts";
const CODEX_CLI_HOST_TEST = "tests/codex-cli-host.test.ts";
const CODEX_CLI_HOST_READONLY_SMOKE_TEST =
  "tests/codex-cli-real-readonly-smoke-script.test.ts";
const CODEX_CLI_HOST_PUBLIC_EXPORT_FIXTURE =
  "tests/fixtures/codex-cli-host-public-export-lock.fixture.json";
const CODEX_CLI_HOST_GOVERNANCE_EXPORT_FIXTURE =
  "tests/fixtures/codex-cli-host-governance-v2-public-export-lock.fixture.json";

const REQUIRED_PUBLIC_SOURCE_MARKERS = [
  "runCodexCliExecPlan",
  "runCodexCliReadOnlySmoke",
  "runCodexCliWorkspaceWriteSmoke",
  "validateCodexCliExecPlanForRun",
  "createCodexCliWorkspaceWriteSmokePreflight",
  "CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION",
  "export * from \"./governance-v2.js\""
] as const;

const REQUIRED_RUN_SOURCE_MARKERS = [
  "spawn as spawnChildProcess",
  "const spawn = resolvedOptions.spawn ?? defaultCodexCliProcessSpawner",
  "validateCodexCliExecPlanForRun(plan, resolvedOptions)",
  "getCodexCliGovernancePreRunBlockers(plan, resolvedOptions.governance?.previousState)",
  "codex_cli_write_sandbox_requires_explicit_allowance",
  "codex_cli_workspace_write_smoke_requires_confirmation",
  "codex_cli_workspace_write_smoke_requires_clean_worktree",
  "codex_cli_workspace_write_smoke_requires_before_commit",
  "codex_cli_workspace_write_smoke_requires_rollback_command",
  "codex_cli_workspace_write_smoke_target_not_allowlisted",
  "codex_cli_workspace_write_disallows_approval_policy_never",
  "codex_cli_workspace_write_disallows_approval_arg_never",
  "assertNoDangerousCodexCliArgs(plan.args)",
  "assertNoCodexCliWorkspaceExpansionArgs(plan.args)",
  "assertNoCodexCliProviderOverrideArgs(plan.args)",
  "assertNoCodexCliPolicyBypassArgs(plan.args)",
  "approvalPolicy: \"never\"",
  "sandbox: \"read-only\"",
  "sandbox: \"workspace-write\"",
  "allowWriteSandbox: true",
  "redactCodexCliSensitiveEvidenceText",
  "sanitizeCodexCliCommandOutputForResult"
] as const;

const REQUIRED_GOVERNANCE_SOURCE_MARKERS = [
  "schemaVersion: \"codex-cli-governance-state.v2\"",
  "createCodexCliGovernanceBundle",
  "getCodexCliGovernancePreRunBlockers",
  "codex_cli_governance_step_back_active",
  "probabilityPredictionAllowed: false",
  "writeSandboxAllowed"
] as const;

const REQUIRED_TEST_MARKERS = [
  "codex cli host public export surface is lock-stable",
  "codex cli host governance-v2 public export surface is lock-stable",
  "codex cli environment preflight requires an injected spawner",
  "codex cli default process spawner never enables shell fallback",
  "codex cli host runner rejects workspace-write plans with approval never",
  "codex cli workspace-write smoke preflight blocks without explicit allowance and confirmation",
  "codex cli workspace-write smoke runner does not spawn while gates are missing",
  "codex cli workspace-write smoke runner executes only after both gates",
  "codex cli governance forces step-back after three anomalies and blocks write sandbox"
] as const;

const REQUIRED_READONLY_SMOKE_TEST_MARKERS = [
  "runCodexCliReadOnlySmoke",
  "spawnCalls.length, 2",
  "approvalPolicyNever",
  "call.args.includes(\"workspace-write\"), false"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "CODEX_ACCESS_TOKEN"
] as const;

export interface CodexCliHostBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  publicSourceText: string;
  sourceText: string;
  governanceSourceText: string;
  testText: string;
  readonlySmokeTestText: string;
  publicExportFixtureText: string;
  governanceExportFixtureText: string;
}

export interface CodexCliHostBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    publicSurfaceLocked: boolean;
    hostRunGuardsPresent: boolean;
    governanceGuardsPresent: boolean;
    regressionCoverageRecorded: boolean;
    readonlySmokeCoverageRecorded: boolean;
    publicExportFixtureLocksRunSurface: boolean;
    governanceExportFixtureLocksControlSurface: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    hostMode: "explicit_codex_cli_host_execution_surface";
    readOnlySmokeSandbox: "read-only";
    readOnlySmokeApprovalPolicy: "never";
    workspaceWriteRequiresExplicitAllowance: true;
    workspaceWriteRequiresConfirmation: true;
    workspaceWriteRequiresCleanWorktree: true;
    workspaceWriteRequiresRollbackBinding: true;
    governanceStepBackBlocksWriteSandbox: true;
    defaultRealCodexCliAllowedByBoundaryAudit: false;
    shellFallbackAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    providerExecutionAllowedByHostBoundary: false;
    codexCliProcessSpawnsDuringAudit: 0;
    evidenceWritesDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type CodexCliHostBoundaryAuditOutputFormat = "text" | "json";

export async function collectCodexCliHostBoundaryAuditInput(
  cwd = process.cwd()
): Promise<CodexCliHostBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    publicSourceText,
    sourceText,
    governanceSourceText,
    testText,
    readonlySmokeTestText,
    publicExportFixtureText,
    governanceExportFixtureText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, CODEX_CLI_HOST_PUBLIC_SOURCE),
    read(cwd, CODEX_CLI_HOST_SOURCE),
    read(cwd, CODEX_CLI_HOST_GOVERNANCE_SOURCE),
    read(cwd, CODEX_CLI_HOST_TEST),
    read(cwd, CODEX_CLI_HOST_READONLY_SMOKE_TEST),
    read(cwd, CODEX_CLI_HOST_PUBLIC_EXPORT_FIXTURE),
    read(cwd, CODEX_CLI_HOST_GOVERNANCE_EXPORT_FIXTURE)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    publicSourceText,
    sourceText,
    governanceSourceText,
    testText,
    readonlySmokeTestText,
    publicExportFixtureText,
    governanceExportFixtureText
  };
}

export function reviewCodexCliHostBoundaryAudit(
  input: CodexCliHostBoundaryAuditInput
): CodexCliHostBoundaryAuditResult {
  const checks = {
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit codex-cli-host-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "codex-cli-host-boundary"
    ),
    publicSurfaceLocked: REQUIRED_PUBLIC_SOURCE_MARKERS.every((marker) =>
      input.publicSourceText.includes(marker)
    ),
    hostRunGuardsPresent: REQUIRED_RUN_SOURCE_MARKERS.every((marker) =>
      input.sourceText.includes(marker)
    ),
    governanceGuardsPresent: REQUIRED_GOVERNANCE_SOURCE_MARKERS.every((marker) =>
      input.governanceSourceText.includes(marker)
    ),
    regressionCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.testText.includes(marker)
    ),
    readonlySmokeCoverageRecorded: REQUIRED_READONLY_SMOKE_TEST_MARKERS.every((marker) =>
      input.readonlySmokeTestText.includes(marker)
    ),
    publicExportFixtureLocksRunSurface: publicExportFixtureLocksRunSurface(
      input.publicExportFixtureText
    ),
    governanceExportFixtureLocksControlSurface:
      governanceExportFixtureLocksControlSurface(input.governanceExportFixtureText),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      hostMode: "explicit_codex_cli_host_execution_surface",
      readOnlySmokeSandbox: "read-only",
      readOnlySmokeApprovalPolicy: "never",
      workspaceWriteRequiresExplicitAllowance: true,
      workspaceWriteRequiresConfirmation: true,
      workspaceWriteRequiresCleanWorktree: true,
      workspaceWriteRequiresRollbackBinding: true,
      governanceStepBackBlocksWriteSandbox: true,
      defaultRealCodexCliAllowedByBoundaryAudit: false,
      shellFallbackAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      providerExecutionAllowedByHostBoundary: false,
      codexCliProcessSpawnsDuringAudit: 0,
      evidenceWritesDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatCodexCliHostBoundaryAuditResult(
  review: CodexCliHostBoundaryAuditResult,
  format: CodexCliHostBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Codex CLI host boundary audit",
    `status: ${review.status}`,
    `host mode: ${review.summary.hostMode}`,
    `read-only smoke sandbox: ${review.summary.readOnlySmokeSandbox}`,
    `read-only smoke approval policy: ${review.summary.readOnlySmokeApprovalPolicy}`,
    `workspace-write requires explicit allowance: ${review.summary.workspaceWriteRequiresExplicitAllowance}`,
    `workspace-write requires confirmation: ${review.summary.workspaceWriteRequiresConfirmation}`,
    `workspace-write requires clean worktree: ${review.summary.workspaceWriteRequiresCleanWorktree}`,
    `workspace-write requires rollback binding: ${review.summary.workspaceWriteRequiresRollbackBinding}`,
    `governance step-back blocks write sandbox: ${review.summary.governanceStepBackBlocksWriteSandbox}`,
    `default real Codex CLI allowed by boundary audit: ${review.summary.defaultRealCodexCliAllowedByBoundaryAudit}`,
    `shell fallback allowed: ${review.summary.shellFallbackAllowed}`,
    `provider execution allowed by host boundary: ${review.summary.providerExecutionAllowedByHostBoundary}`,
    `Codex CLI process spawns during audit: ${review.summary.codexCliProcessSpawnsDuringAudit}`,
    `evidence writes during audit: ${review.summary.evidenceWritesDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external writes during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Codex CLI host boundary")
    && text.includes("explicit Codex CLI host execution surface")
    && text.includes("read-only smoke stays `read-only` with approval policy `never`")
    && text.includes("workspace-write smoke requires explicit allowance and confirmation")
    && text.includes("governance step-back blocks write sandbox before spawn")
    && text.includes("npm run governance -- audit codex-cli-host-boundary");
}

function publicExportFixtureLocksRunSurface(text: string): boolean {
  return text.includes("\"runCodexCliExecPlan\"")
    && text.includes("\"runCodexCliReadOnlySmoke\"")
    && text.includes("\"runCodexCliWorkspaceWriteSmoke\"")
    && text.includes("\"validateCodexCliExecPlanForRun\"")
    && text.includes("\"CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION\"");
}

function governanceExportFixtureLocksControlSurface(text: string): boolean {
  return text.includes("\"createCodexCliGovernanceBundle\"")
    && text.includes("\"getCodexCliGovernancePreRunBlockers\"")
    && text.includes("\"routeCodexCliStrategyV2\"")
    && text.includes("\"shouldCreateCodexCliArbitrationPacket\"");
}

function noBroadExecutionAuthorization(
  input: CodexCliHostBoundaryAuditInput
): boolean {
  return controlPlaneCapabilityRecorded(input.governanceControlPlaneText)
    && !input.governanceControlPlaneText.includes(
      "Codex CLI host boundary | active | authorizes broad workspace-write"
    )
    && !input.governanceControlPlaneText.includes(
      "codex-cli-host may dispatch host executor"
    )
    && !input.governanceControlPlaneText.includes(
      "codex-cli-host may invoke sub-agent runtime"
    )
    && !input.sourceText.includes("shell: true")
    && !input.sourceText.includes("dispatchCurrentOperatorActionHostExecutor")
    && !input.sourceText.includes("dispatchGovernanceOperatorActionHostExecutor")
    && !input.sourceText.includes("authorizeGovernanceOperatorActionHostExecutorReview")
    && !input.sourceText.includes("spawnSubAgent")
    && !input.sourceText.includes("provider.execute(");
}

function outputSanitized(input: CodexCliHostBoundaryAuditInput): boolean {
  const review = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      publicSurfaceLocked: true,
      hostRunGuardsPresent: true,
      governanceGuardsPresent: true,
      regressionCoverageRecorded: true,
      readonlySmokeCoverageRecorded: true,
      publicExportFixtureLocksRunSurface: true,
      governanceExportFixtureLocksControlSurface: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      hostMode: "explicit_codex_cli_host_execution_surface",
      readOnlySmokeSandbox: "read-only",
      readOnlySmokeApprovalPolicy: "never",
      workspaceWriteRequiresExplicitAllowance: true,
      workspaceWriteRequiresConfirmation: true,
      workspaceWriteRequiresCleanWorktree: true,
      workspaceWriteRequiresRollbackBinding: true,
      governanceStepBackBlocksWriteSandbox: true,
      defaultRealCodexCliAllowedByBoundaryAudit: false,
      shellFallbackAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      providerExecutionAllowedByHostBoundary: false,
      codexCliProcessSpawnsDuringAudit: 0,
      evidenceWritesDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  } as CodexCliHostBoundaryAuditResult;
  const text = formatCodexCliHostBoundaryAuditResult(review);
  const json = formatCodexCliHostBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
    !text.includes(marker)
      && !json.includes(marker)
      && !input.governanceControlPlaneText.includes(marker)
      && !input.governanceReadmeText.includes(marker)
  );
}

function collectReasons(
  checks: CodexCliHostBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `codex_cli_host_boundary_${name}`);
}

async function read(cwd: string, relativePath: string): Promise<string> {
  return readFile(join(cwd, relativePath), "utf8");
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectCodexCliHostBoundaryAuditInput();
  const review = reviewCodexCliHostBoundaryAudit(input);

  console.log(formatCodexCliHostBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Codex CLI host boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
