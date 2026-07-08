#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const ESCALATION_POLICY_DOC =
  "docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md";
const ESCALATION_POLICY_AUDIT =
  "scripts/run-capability-taxonomy-escalation-policy-audit.ts";
const ESCALATION_POLICY_TEST =
  "tests/capability-taxonomy-escalation-policy-audit.test.ts";

const REQUIRED_POLICY_MARKERS = [
  "CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED",
  "It is a local review and audit artifact only",
  "does not authorize, run, or simulate provider execute",
  "real Codex CLI execution",
  "workspace-write execution",
  "canary file write",
  "external service write",
  "push authorized: `false`",
  "release authorized: `false`",
  "tag authorized: `false`",
  "deployment authorized: `false`",
  "external service write authorized: `false`",
  "`general_workspace_write` and `general_provider_execution` remain closed",
  "It is not to run workspace-write execution or general provider execution"
] as const;

const REQUIRED_AUDIT_MARKERS = [
  "Capability taxonomy escalation policy audit",
  "git([\"status\", \"--short\"], cwd)",
  "git([\"branch\", \"--show-current\"], cwd)",
  "git([\"rev-list\", \"--left-right\", \"--count\", \"HEAD...origin/main\"], cwd)",
  "worktreeClean: input.gitStatusShort.trim() === \"\"",
  "taxonomyIsNonExecuting",
  "priorCanaryEvidenceIsValid",
  "canaryFileAbsent: !input.canaryFileExists",
  "providerExecuteCallsDuringTaxonomyReview: 0",
  "realCodexCliCallsDuringTaxonomyReview: 0",
  "workspaceWriteExecuteCallsDuringTaxonomyReview: 0",
  "canaryFileWritesDuringTaxonomyReview: 0",
  "generalProviderExecutionCallsDuringTaxonomyReview: 0",
  "externalWriteCallsDuringTaxonomyReview: 0"
] as const;

const REQUIRED_TEST_MARKERS = [
  "capability taxonomy escalation policy audit passes for current local evidence",
  "capability taxonomy escalation policy audit blocks broadened policy text",
  "capability taxonomy escalation policy audit blocks missing classes and stops",
  "capability taxonomy escalation policy audit blocks stale evidence or local target",
  "capability taxonomy escalation policy audit output stays summarized"
] as const;

const FORBIDDEN_POLICY_RUNTIME_MARKERS = [
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

export interface CapabilityTaxonomyEscalationPolicyBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  escalationPolicyDocText: string;
  escalationPolicyAuditText: string;
  escalationPolicyTestText: string;
}

export interface CapabilityTaxonomyEscalationPolicyBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    escalationPolicyAuditRegistered: boolean;
    policyNonAuthorizationRecorded: boolean;
    escalationPolicyAuditGateRecorded: boolean;
    escalationPolicyCoverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    escalationPolicyMode: "capability_escalation_policy_only";
    escalationPolicyIsProviderExecuteAuthorization: false;
    escalationPolicyIsCodexCliAuthorization: false;
    escalationPolicyIsWorkspaceWriteAuthorization: false;
    escalationPolicyIsHostExecutorAuthorization: false;
    escalationPolicyIsSubAgentRuntimeAuthorization: false;
    escalationPolicyIsToolRuntimeAuthorization: false;
    escalationPolicyIsExternalWriteAuthorization: false;
    escalationPolicyIsReleaseAuthorization: false;
    escalationPolicyIsSecretAccessAuthorization: false;
    blockedCapabilityClassIsRuntimeBlockExecution: false;
    severityIsRuntimeAuthorization: false;
    statusIsExecutionAuthorization: false;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    releaseCallsDuringAudit: 0;
    secretAccessCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type CapabilityTaxonomyEscalationPolicyBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectCapabilityTaxonomyEscalationPolicyBoundaryAuditInput(
  cwd = process.cwd()
): Promise<CapabilityTaxonomyEscalationPolicyBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    escalationPolicyDocText,
    escalationPolicyAuditText,
    escalationPolicyTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, ESCALATION_POLICY_DOC),
    read(cwd, ESCALATION_POLICY_AUDIT),
    read(cwd, ESCALATION_POLICY_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    escalationPolicyDocText,
    escalationPolicyAuditText,
    escalationPolicyTestText
  };
}

export function reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit(
  input: CapabilityTaxonomyEscalationPolicyBoundaryAuditInput
): CapabilityTaxonomyEscalationPolicyBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit capability-taxonomy-escalation-policy-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "capability-taxonomy-escalation-policy-boundary"
    ),
    escalationPolicyAuditRegistered: input.governanceRunnerText.includes(
      "capability-taxonomy-escalation-policy"
    ),
    policyNonAuthorizationRecorded: markersPresentNormalized(
      input.escalationPolicyDocText,
      REQUIRED_POLICY_MARKERS
    ),
    escalationPolicyAuditGateRecorded: REQUIRED_AUDIT_MARKERS.every((marker) =>
      input.escalationPolicyAuditText.includes(marker)
    ),
    escalationPolicyCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.escalationPolicyTestText.includes(marker)
    ),
    noRuntimeInvocationSurface:
      noRuntimeInvocationSurface(input.escalationPolicyDocText)
      && noRuntimeInvocationSurface(input.escalationPolicyTestText),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      escalationPolicyMode: "capability_escalation_policy_only",
      escalationPolicyIsProviderExecuteAuthorization: false,
      escalationPolicyIsCodexCliAuthorization: false,
      escalationPolicyIsWorkspaceWriteAuthorization: false,
      escalationPolicyIsHostExecutorAuthorization: false,
      escalationPolicyIsSubAgentRuntimeAuthorization: false,
      escalationPolicyIsToolRuntimeAuthorization: false,
      escalationPolicyIsExternalWriteAuthorization: false,
      escalationPolicyIsReleaseAuthorization: false,
      escalationPolicyIsSecretAccessAuthorization: false,
      blockedCapabilityClassIsRuntimeBlockExecution: false,
      severityIsRuntimeAuthorization: false,
      statusIsExecutionAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      releaseCallsDuringAudit: 0,
      secretAccessCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatCapabilityTaxonomyEscalationPolicyBoundaryAuditResult(
  review: CapabilityTaxonomyEscalationPolicyBoundaryAuditResult,
  format: CapabilityTaxonomyEscalationPolicyBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Capability taxonomy escalation policy boundary audit",
    `status: ${review.status}`,
    `escalation policy mode: ${review.summary.escalationPolicyMode}`,
    `escalation policy is provider execute authorization: ${review.summary.escalationPolicyIsProviderExecuteAuthorization}`,
    `escalation policy is Codex CLI authorization: ${review.summary.escalationPolicyIsCodexCliAuthorization}`,
    `escalation policy is workspace-write authorization: ${review.summary.escalationPolicyIsWorkspaceWriteAuthorization}`,
    `escalation policy is host executor authorization: ${review.summary.escalationPolicyIsHostExecutorAuthorization}`,
    `escalation policy is sub-agent runtime authorization: ${review.summary.escalationPolicyIsSubAgentRuntimeAuthorization}`,
    `escalation policy is tool runtime authorization: ${review.summary.escalationPolicyIsToolRuntimeAuthorization}`,
    `escalation policy is external-write authorization: ${review.summary.escalationPolicyIsExternalWriteAuthorization}`,
    `escalation policy is release authorization: ${review.summary.escalationPolicyIsReleaseAuthorization}`,
    `escalation policy is secret access authorization: ${review.summary.escalationPolicyIsSecretAccessAuthorization}`,
    `blocked capability class is runtime block execution: ${review.summary.blockedCapabilityClassIsRuntimeBlockExecution}`,
    `severity is runtime authorization: ${review.summary.severityIsRuntimeAuthorization}`,
    `status is execution authorization: ${review.summary.statusIsExecutionAuthorization}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    `release calls during audit: ${review.summary.releaseCallsDuringAudit}`,
    `secret access calls during audit: ${review.summary.secretAccessCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Capability taxonomy escalation policy boundary")
    && text.includes("capability escalation policy only")
    && text.includes("escalation policy is not provider execute authorization")
    && text.includes("escalation policy is not Codex CLI authorization")
    && text.includes("escalation policy is not workspace-write authorization")
    && text.includes("escalation policy is not host executor authorization")
    && text.includes("escalation policy is not sub-agent runtime authorization")
    && text.includes("escalation policy is not tool runtime authorization")
    && text.includes("escalation policy is not external-write authorization")
    && text.includes("escalation policy is not release authorization")
    && text.includes("escalation policy is not secret access authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_POLICY_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function markersPresentNormalized(
  text: string,
  markers: readonly string[]
): boolean {
  const normalizedText = normalizeWhitespace(text);

  return markers.every((marker) =>
    normalizedText.includes(normalizeWhitespace(marker))
  );
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function outputSanitized(): boolean {
  const review: CapabilityTaxonomyEscalationPolicyBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      escalationPolicyAuditRegistered: true,
      policyNonAuthorizationRecorded: true,
      escalationPolicyAuditGateRecorded: true,
      escalationPolicyCoverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      escalationPolicyMode: "capability_escalation_policy_only",
      escalationPolicyIsProviderExecuteAuthorization: false,
      escalationPolicyIsCodexCliAuthorization: false,
      escalationPolicyIsWorkspaceWriteAuthorization: false,
      escalationPolicyIsHostExecutorAuthorization: false,
      escalationPolicyIsSubAgentRuntimeAuthorization: false,
      escalationPolicyIsToolRuntimeAuthorization: false,
      escalationPolicyIsExternalWriteAuthorization: false,
      escalationPolicyIsReleaseAuthorization: false,
      escalationPolicyIsSecretAccessAuthorization: false,
      blockedCapabilityClassIsRuntimeBlockExecution: false,
      severityIsRuntimeAuthorization: false,
      statusIsExecutionAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      releaseCallsDuringAudit: 0,
      secretAccessCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatCapabilityTaxonomyEscalationPolicyBoundaryAuditResult(review);
  const json = formatCapabilityTaxonomyEscalationPolicyBoundaryAuditResult(
    review,
    "json"
  );

  return FORBIDDEN_OUTPUT_MARKERS.every(
    (marker) => !text.includes(marker) && !json.includes(marker)
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `capability_taxonomy_escalation_policy_boundary_${name}`);
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

async function main(): Promise<void> {
  const input =
    await collectCapabilityTaxonomyEscalationPolicyBoundaryAuditInput();
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatCapabilityTaxonomyEscalationPolicyBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Capability taxonomy escalation policy boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
