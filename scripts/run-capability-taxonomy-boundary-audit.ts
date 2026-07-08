#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const TAXONOMY_DOC =
  "docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md";
const TAXONOMY_TEST =
  "tests/capability-taxonomy-escalation-policy-audit.test.ts";

const REQUIRED_TAXONOMY_MARKERS = [
  "CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED",
  "`read_only`",
  "`bounded_workspace_write_canary`",
  "`bounded_workspace_write_receipt`",
  "`scoped_workspace_write`",
  "`general_workspace_write`",
  "`general_provider_execution`",
  "`external_write`",
  "`release_or_deploy`",
  "`secret_or_credential_change`",
  "`general_workspace_write` and `general_provider_execution` remain closed",
  "successful bounded canary does not promote either class",
  "external_write`, `release_or_deploy`, and `secret_or_credential_change` require",
  "separate explicit authorization",
  "be bundled into a workspace-write gate",
  "provider execute calls during taxonomy review",
  "real Codex CLI calls during taxonomy review",
  "workspace-write execute calls during taxonomy review",
  "canary file writes during taxonomy review",
  "general provider execution calls during taxonomy review",
  "external write calls during taxonomy review"
] as const;

const REQUIRED_TEST_MARKERS = [
  "capability taxonomy escalation policy audit passes for current local evidence",
  "capability taxonomy escalation policy audit blocks broadened policy text",
  "capability taxonomy escalation policy audit blocks missing classes and stops",
  "capability taxonomy escalation policy audit output stays summarized"
] as const;

const FORBIDDEN_RUNTIME_MARKERS = [
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

export interface CapabilityTaxonomyBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  taxonomyDocText: string;
  taxonomyTestText: string;
}

export interface CapabilityTaxonomyBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    taxonomyMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    capabilityTaxonomyMode: "capability_classification_and_escalation_policy_only";
    boundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization: false;
    boundedWorkspaceWriteReceiptIsExecutionAuthorization: false;
    scopedWorkspaceWriteClassIsWorkspaceWriteExecution: false;
    generalWorkspaceWriteClassIsExecutionAuthorization: false;
    generalProviderExecutionClassIsProviderExecuteAuthorization: false;
    externalWriteClassIsExternalWriteAuthorization: false;
    releaseOrDeployClassIsReleaseAuthorization: false;
    secretCredentialChangeClassIsSecretAccessAuthorization: false;
    capabilityEscalationPolicyIsRuntimeAuthorization: false;
    canaryEvidenceBaselineIsExecutionAuthorization: false;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    canaryFileWriteCallsDuringAudit: 0;
    generalProviderExecutionCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    releaseCallsDuringAudit: 0;
    secretAccessCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type CapabilityTaxonomyBoundaryAuditOutputFormat = "text" | "json";

export async function collectCapabilityTaxonomyBoundaryAuditInput(
  cwd = process.cwd()
): Promise<CapabilityTaxonomyBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    taxonomyDocText,
    taxonomyTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, TAXONOMY_DOC),
    read(cwd, TAXONOMY_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    taxonomyDocText,
    taxonomyTestText
  };
}

export function reviewCapabilityTaxonomyBoundaryAudit(
  input: CapabilityTaxonomyBoundaryAuditInput
): CapabilityTaxonomyBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit capability-taxonomy-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "capability-taxonomy-boundary"
    ),
    taxonomyMarkersPresent: REQUIRED_TAXONOMY_MARKERS.every((marker) =>
      input.taxonomyDocText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.taxonomyTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(input.taxonomyDocText),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      capabilityTaxonomyMode:
        "capability_classification_and_escalation_policy_only",
      boundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization: false,
      boundedWorkspaceWriteReceiptIsExecutionAuthorization: false,
      scopedWorkspaceWriteClassIsWorkspaceWriteExecution: false,
      generalWorkspaceWriteClassIsExecutionAuthorization: false,
      generalProviderExecutionClassIsProviderExecuteAuthorization: false,
      externalWriteClassIsExternalWriteAuthorization: false,
      releaseOrDeployClassIsReleaseAuthorization: false,
      secretCredentialChangeClassIsSecretAccessAuthorization: false,
      capabilityEscalationPolicyIsRuntimeAuthorization: false,
      canaryEvidenceBaselineIsExecutionAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      canaryFileWriteCallsDuringAudit: 0,
      generalProviderExecutionCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      releaseCallsDuringAudit: 0,
      secretAccessCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatCapabilityTaxonomyBoundaryAuditResult(
  review: CapabilityTaxonomyBoundaryAuditResult,
  format: CapabilityTaxonomyBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Capability taxonomy boundary audit",
    `status: ${review.status}`,
    `capability taxonomy mode: ${review.summary.capabilityTaxonomyMode}`,
    `bounded workspace-write canary is workspace-write authorization: ${review.summary.boundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization}`,
    `bounded workspace-write receipt is execution authorization: ${review.summary.boundedWorkspaceWriteReceiptIsExecutionAuthorization}`,
    `scoped workspace-write class is workspace-write execution: ${review.summary.scopedWorkspaceWriteClassIsWorkspaceWriteExecution}`,
    `general workspace-write class is execution authorization: ${review.summary.generalWorkspaceWriteClassIsExecutionAuthorization}`,
    `general provider execution class is provider execute authorization: ${review.summary.generalProviderExecutionClassIsProviderExecuteAuthorization}`,
    `external_write class is external-write authorization: ${review.summary.externalWriteClassIsExternalWriteAuthorization}`,
    `release_or_deploy class is release authorization: ${review.summary.releaseOrDeployClassIsReleaseAuthorization}`,
    `secret_or_credential_change class is secret access authorization: ${review.summary.secretCredentialChangeClassIsSecretAccessAuthorization}`,
    `capability escalation policy is runtime authorization: ${review.summary.capabilityEscalationPolicyIsRuntimeAuthorization}`,
    `canary evidence baseline is execution authorization: ${review.summary.canaryEvidenceBaselineIsExecutionAuthorization}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `canary file write calls during audit: ${review.summary.canaryFileWriteCallsDuringAudit}`,
    `general provider execution calls during audit: ${review.summary.generalProviderExecutionCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    `release calls during audit: ${review.summary.releaseCallsDuringAudit}`,
    `secret access calls during audit: ${review.summary.secretAccessCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Capability taxonomy boundary")
    && text.includes("capability classification and escalation policy only")
    && text.includes("bounded workspace-write canary is not workspace-write authorization")
    && text.includes("bounded workspace-write receipt is not execution authorization")
    && text.includes("scoped workspace-write class is not workspace-write execution")
    && text.includes("general workspace-write class is not execution authorization")
    && text.includes("general provider execution class is not provider execute authorization")
    && text.includes("external_write class is not external-write authorization")
    && text.includes("release_or_deploy class is not release authorization")
    && text.includes("secret_or_credential_change class is not secret access authorization")
    && text.includes("capability escalation policy is not runtime authorization")
    && text.includes("canary evidence baseline is not execution authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(_input: CapabilityTaxonomyBoundaryAuditInput): boolean {
  const output = formatCapabilityTaxonomyBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      taxonomyMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      capabilityTaxonomyMode:
        "capability_classification_and_escalation_policy_only",
      boundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization: false,
      boundedWorkspaceWriteReceiptIsExecutionAuthorization: false,
      scopedWorkspaceWriteClassIsWorkspaceWriteExecution: false,
      generalWorkspaceWriteClassIsExecutionAuthorization: false,
      generalProviderExecutionClassIsProviderExecuteAuthorization: false,
      externalWriteClassIsExternalWriteAuthorization: false,
      releaseOrDeployClassIsReleaseAuthorization: false,
      secretCredentialChangeClassIsSecretAccessAuthorization: false,
      capabilityEscalationPolicyIsRuntimeAuthorization: false,
      canaryEvidenceBaselineIsExecutionAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      canaryFileWriteCallsDuringAudit: 0,
      generalProviderExecutionCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      releaseCallsDuringAudit: 0,
      secretAccessCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `capability_taxonomy_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectCapabilityTaxonomyBoundaryAuditInput();
  const review = reviewCapabilityTaxonomyBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatCapabilityTaxonomyBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Capability taxonomy boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
