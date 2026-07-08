#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PR23B_DOC =
  "docs/governance/PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md";
const PR23C_DOC = "docs/governance/PR_23C_EXECUTION_EVIDENCE_BINDING.md";
const PHASE6_CLOSEOUT =
  "docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const CONTROLLED_ACCEPTANCE_SCRIPT =
  "scripts/run-controlled-readonly-provider-execution-acceptance.ts";
const PROVIDER_RUNNER_SOURCE =
  "packages/governance-internal-provider-execution-runner/src/index.ts";
const CODEX_PROVIDER_SOURCE = "packages/providers/codex-cli/src/index.ts";
const PROVIDER_RUNNER_TEST = "tests/provider-execution-runner.test.ts";
const CODEX_PROVIDER_TEST = "tests/codex-cli-provider.test.ts";
const CONTROLLED_ACCEPTANCE_TEST =
  "tests/controlled-readonly-provider-execution-acceptance.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_RUNNER_SOURCE_MARKERS = [
  "runProviderExecutionPlanControlledReadOnly",
  "mode: z.literal(\"controlled-read-only\")",
  "controlled_readonly_provider_execution_permit_required",
  "controlled_readonly_provider_execution_metadata_required",
  "controlled_readonly_requires_codex_cli_provider",
  "controlled_readonly_environment_preflight_artifact_ref_required",
  "controlled_readonly_environment_preflight_artifact_hash_required",
  "providerEntry.provider.execute(executorPlan",
  "control: \"controlled-read-only\""
] as const;

const REQUIRED_PROVIDER_SOURCE_MARKERS = [
  "codex_cli_provider_execute_only_supports_read_only",
  "codex_cli_provider_execute_requires_read_only_sandbox",
  "codex_cli_provider_execute_disallows_workspace_write",
  "codex_cli_provider_real_execute_requires_explicit_allowance",
  "codex_cli_provider_real_execute_guard_missing",
  "codex_cli_provider_real_execute_preflight_requires_injected_spawner",
  "codex_cli_provider_real_execute_preflight_requires_no_workspace_write",
  "codex_cli_provider_real_execute_preflight_must_not_send_prompt",
  "codex_cli_provider_real_execute_preflight_disallows_fallback",
  "codex_cli_provider_plan_must_not_store_raw_runtime",
  "codex_cli_provider_plan_must_not_store_prompt"
] as const;

const REQUIRED_RUNNER_TEST_MARKERS = [
  "executes controlled read-only codex-cli plans with explicit permit and guard",
  "blocks controlled read-only execution without metadata before spawn",
  "blocks controlled read-only execution without a provider permit before spawn",
  "blocks controlled read-only execution without preflight artifact binding",
  "blocks controlled read-only execution with preflight artifact drift",
  "rejects controlled read-only executor plan metadata tampering",
  "rejects controlled read-only task content replacement",
  "blocks controlled read-only execution for non-codex providers"
] as const;

const REQUIRED_PROVIDER_TEST_MARKERS = [
  "codex cli provider execute rejects workspace-write plans before spawn",
  "spawnCalls, 0"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface CodexProviderExecutionBoundaryAuditInput {
  pr23bDocText: string;
  pr23cDocText: string;
  phase6CloseoutText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  controlledAcceptanceScriptText: string;
  providerRunnerSourceText: string;
  codexProviderSourceText: string;
  providerRunnerTestText: string;
  codexProviderTestText: string;
  controlledAcceptanceTestText: string;
  governanceRunnerText: string;
}

export interface CodexProviderExecutionBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    pr23bBoundaryRecorded: boolean;
    pr23cEvidenceBindingRecorded: boolean;
    phase6CloseoutRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    controlledAcceptanceScriptRecorded: boolean;
    controlledRunnerGuardsPresent: boolean;
    codexProviderGuardsPresent: boolean;
    runnerRegressionCoverageRecorded: boolean;
    providerWorkspaceWriteBlockCoverageRecorded: boolean;
    acceptanceCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    providerId: "codex-cli";
    permittedMode: "controlled-read-only";
    permittedSideEffectClass: "read_only";
    permittedSandbox: "read-only";
    permittedApprovalPolicy: "never";
    defaultRealCodexCliAllowed: false;
    generalProviderExecutionAllowed: false;
    workspaceWriteAllowedByThisBoundary: false;
    providerExecuteCallsDuringAudit: 0;
    realCodexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    evidenceWritesDuringAudit: 0;
  };
  reasons: string[];
}

export type CodexProviderExecutionBoundaryAuditOutputFormat = "text" | "json";

export async function collectCodexProviderExecutionBoundaryAuditInput(
  cwd = process.cwd()
): Promise<CodexProviderExecutionBoundaryAuditInput> {
  const [
    pr23bDocText,
    pr23cDocText,
    phase6CloseoutText,
    governanceControlPlaneText,
    governanceReadmeText,
    controlledAcceptanceScriptText,
    providerRunnerSourceText,
    codexProviderSourceText,
    providerRunnerTestText,
    codexProviderTestText,
    controlledAcceptanceTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PR23B_DOC),
    read(cwd, PR23C_DOC),
    read(cwd, PHASE6_CLOSEOUT),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, CONTROLLED_ACCEPTANCE_SCRIPT),
    read(cwd, PROVIDER_RUNNER_SOURCE),
    read(cwd, CODEX_PROVIDER_SOURCE),
    read(cwd, PROVIDER_RUNNER_TEST),
    read(cwd, CODEX_PROVIDER_TEST),
    read(cwd, CONTROLLED_ACCEPTANCE_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    pr23bDocText,
    pr23cDocText,
    phase6CloseoutText,
    governanceControlPlaneText,
    governanceReadmeText,
    controlledAcceptanceScriptText,
    providerRunnerSourceText,
    codexProviderSourceText,
    providerRunnerTestText,
    codexProviderTestText,
    controlledAcceptanceTestText,
    governanceRunnerText
  };
}

export function reviewCodexProviderExecutionBoundaryAudit(
  input: CodexProviderExecutionBoundaryAuditInput
): CodexProviderExecutionBoundaryAuditResult {
  const checks = {
    pr23bBoundaryRecorded: pr23bBoundaryRecorded(input.pr23bDocText),
    pr23cEvidenceBindingRecorded: pr23cEvidenceBindingRecorded(input.pr23cDocText),
    phase6CloseoutRecorded: phase6CloseoutRecorded(input.phase6CloseoutText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit codex-provider-execution-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "codex-provider-execution-boundary"
    ),
    controlledAcceptanceScriptRecorded: controlledAcceptanceScriptRecorded(
      input.controlledAcceptanceScriptText
    ),
    controlledRunnerGuardsPresent: REQUIRED_RUNNER_SOURCE_MARKERS.every((marker) =>
      input.providerRunnerSourceText.includes(marker)
    ),
    codexProviderGuardsPresent: REQUIRED_PROVIDER_SOURCE_MARKERS.every((marker) =>
      input.codexProviderSourceText.includes(marker)
    ),
    runnerRegressionCoverageRecorded: REQUIRED_RUNNER_TEST_MARKERS.every((marker) =>
      input.providerRunnerTestText.includes(marker)
    ),
    providerWorkspaceWriteBlockCoverageRecorded:
      REQUIRED_PROVIDER_TEST_MARKERS.every((marker) =>
        input.codexProviderTestText.includes(marker)
      ),
    acceptanceCoverageRecorded: acceptanceCoverageRecorded(
      input.controlledAcceptanceTestText
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      providerId: "codex-cli",
      permittedMode: "controlled-read-only",
      permittedSideEffectClass: "read_only",
      permittedSandbox: "read-only",
      permittedApprovalPolicy: "never",
      defaultRealCodexCliAllowed: false,
      generalProviderExecutionAllowed: false,
      workspaceWriteAllowedByThisBoundary: false,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      evidenceWritesDuringAudit: 0
    },
    reasons
  };
}

export function formatCodexProviderExecutionBoundaryAuditResult(
  review: CodexProviderExecutionBoundaryAuditResult,
  format: CodexProviderExecutionBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Codex provider execution boundary audit",
    `status: ${review.status}`,
    `provider id: ${review.summary.providerId}`,
    `permitted mode: ${review.summary.permittedMode}`,
    `permitted side-effect class: ${review.summary.permittedSideEffectClass}`,
    `permitted sandbox: ${review.summary.permittedSandbox}`,
    `permitted approval policy: ${review.summary.permittedApprovalPolicy}`,
    `default real Codex CLI allowed: ${review.summary.defaultRealCodexCliAllowed}`,
    `general provider execution allowed: ${review.summary.generalProviderExecutionAllowed}`,
    `workspace-write allowed by this boundary: ${review.summary.workspaceWriteAllowedByThisBoundary}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `real Codex CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    `evidence writes during audit: ${review.summary.evidenceWritesDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function pr23bBoundaryRecorded(text: string): boolean {
  return text.includes("PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE_RECORDED")
    && text.includes("mode must be `controlled-read-only`")
    && text.includes("provider id must be `codex-cli`")
    && text.includes("provider plan side effect must be `read_only`")
    && text.includes("provider plan sandbox must be `read-only`")
    && text.includes("approval policy must be `never`")
    && text.includes("injected fake spawner")
    && text.includes("real Codex CLI calls at zero")
    && text.includes("This PR does not authorize");
}

function pr23cEvidenceBindingRecorded(text: string): boolean {
  return text.includes("PR_23C_EXECUTION_EVIDENCE_BINDING_RECORDED")
    && text.includes("does not broaden the PR-23B execution boundary")
    && text.includes("provider-execution-controlled-readonly-evidence.v2")
    && text.includes("explicit `controlled-read-only` mode")
    && text.includes("explicit metadata containing the codex-cli real-execution guard")
    && text.includes("injected execution dependency evidence")
    && text.includes("does not store")
    && text.includes("stdout or stderr");
}

function phase6CloseoutRecorded(text: string): boolean {
  return text.includes("PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT_RECORDED")
    && text.includes("Controlled read-only provider execution")
    && text.includes("guarded / productized narrow path")
    && text.includes("General workspace-write")
    && text.includes("General provider execution")
    && text.includes("blocked")
    && text.includes("Real Codex CLI execution remains outside the default path")
    && text.includes("real Codex CLI execution by default");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md")
    && text.includes("PR_23C_EXECUTION_EVIDENCE_BINDING.md")
    && text.includes("| Controlled read-only real execution |")
    && text.includes("Yes, narrow")
    && text.includes("| General provider execution | blocked | No |")
    && text.includes("| General workspace write | blocked | No |")
    && text.includes("| Workspace-write real canary | experimental / blocked by default | No by default |");
}

function controlledAcceptanceScriptRecorded(text: string): boolean {
  return text.includes("codex-cli-controlled-readonly-provider-execution-acceptance.v1")
    && text.includes("controlled-readonly-provider-execution-fake-spawner-local-only")
    && text.includes("providerId: \"codex-cli\"")
    && text.includes("sideEffectClass: \"read_only\"")
    && text.includes("sandbox: \"read-only\"")
    && text.includes("approvalPolicy: \"never\"")
    && text.includes("realCodexCliCalls: 0")
    && text.includes("workspaceWriteExecuteCalls: 0")
    && text.includes("externalWriteCalls: 0");
}

function acceptanceCoverageRecorded(text: string): boolean {
  return text.includes("controlled read-only provider execution acceptance covers permit lifecycle")
    && text.includes("realCodexCliCalls, 0")
    && text.includes("workspaceWriteExecuteCalls, 0")
    && text.includes("externalWriteCalls, 0")
    && text.includes("check mode does not write evidence");
}

function noBroadExecutionAuthorization(
  input: CodexProviderExecutionBoundaryAuditInput
): boolean {
  const combined = [
    input.pr23bDocText,
    input.pr23cDocText,
    input.phase6CloseoutText,
    input.governanceControlPlaneText
  ].join("\n");

  return combined.includes("real Codex CLI execution by default")
    && combined.includes("default provider execution")
    && combined.includes("general provider execution")
    && combined.includes("general workspace-write")
    && combined.includes("workspace-write real canary")
    && combined.includes("external write")
    && combined.includes("push, release")
    && !/General provider execution\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/General workspace write\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/real Codex CLI execution by default[^\n]*authorize/i.test(combined);
}

function outputSanitized(input: CodexProviderExecutionBoundaryAuditInput): boolean {
  const outputSource = [
    input.pr23bDocText,
    input.pr23cDocText,
    input.phase6CloseoutText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `codex_provider_execution_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectCodexProviderExecutionBoundaryAuditInput();
  const review = reviewCodexProviderExecutionBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatCodexProviderExecutionBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Codex provider execution boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
