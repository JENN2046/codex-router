#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const PRODUCTIZATION_DOC =
  "docs/governance/READONLY_PRODUCTIZATION_ACCEPTANCE.md";
const ROADMAP_DOC = "docs/agent-os-transformation/current-roadmap-20260610.md";
const PRODUCTIZATION_ACCEPTANCE =
  "scripts/run-readonly-productization-acceptance.ts";
const PRODUCTIZATION_TEST = "tests/readonly-productization-acceptance.test.ts";

const REQUIRED_ACCEPTANCE_GATE_MARKERS = [
  "Read-only productization acceptance",
  "git([\"status\", \"--short\"], cwd)",
  "git([\"branch\", \"--show-current\"], cwd)",
  "git([\"rev-list\", \"--left-right\", \"--count\", \"HEAD...origin/main\"], cwd)",
  "worktreeClean: input.gitStatusShort.trim() === \"\"",
  "branchMain: input.branch === \"main\"",
  "notBehindOrigin: behind === 0",
  "requiredEvidencePresent",
  "evidenceSchemaStatusValid",
  "formalGateChainClosed",
  "productizationDocRecorded",
  "roadmapUpdated",
  "governanceDocsNonAuthorizing",
  "readOnlyBoundaryPreserved",
  "noProviderExecuteDuringAudit: true",
  "noRealCodexCliDuringAudit: true",
  "noWorkspaceWriteDuringAudit: true",
  "noEvidenceWriteDuringAudit: true",
  "providerExecuteCallsDuringAudit: 0",
  "realCodexCliCallsDuringAudit: 0",
  "workspaceWriteCallsDuringAudit: 0",
  "evidenceWritesDuringAudit: 0"
] as const;

const REQUIRED_DOC_MARKERS = [
  "READONLY_PRODUCTIZATION_ACCEPTANCE_RECORDED",
  "does not authorize invoking the real Codex CLI",
  "does not authorize provider execute",
  "does not authorize workspace-write",
  "does not authorize remote write",
  "does not refresh evidence",
  "does not set an execution operator flag",
  "local acceptance layer only",
  "not a release gate by itself"
] as const;

const REQUIRED_ROADMAP_MARKERS = [
  "READONLY_PRODUCTIZATION_ACCEPTANCE_RECORDED",
  "npm run governance -- audit readonly-productization",
  "local-only",
  "does not authorize real Codex CLI, provider execution, workspace-write, or evidence refresh"
] as const;

const REQUIRED_TEST_MARKERS = [
  "read-only productization acceptance passes for clean local evidence",
  "read-only productization acceptance fails closed when origin freshness is unknown",
  "read-only productization acceptance blocks missing evidence",
  "read-only productization acceptance blocks broadened authorization docs",
  "read-only productization acceptance output stays summarized and sanitized",
  "read-only productization acceptance records no execution or evidence writes"
] as const;

const FORBIDDEN_DOC_RUNTIME_MARKERS = [
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

const FORBIDDEN_AUTHORIZATION_MARKERS = [
  "real Codex CLI authorized: `true`",
  "provider execute authorized: `true`",
  "workspace-write authorized: `true`",
  "remote write authorized: `true`",
  "refresh evidence authorized: `true`",
  "push authorized: `true`",
  "release authorized: `true`",
  "tag authorized: `true`",
  "deployment authorized: `true`",
  "run real Codex CLI now",
  "invoke real Codex CLI now",
  "provider execute now",
  "execute workspace-write now",
  "refresh real read-only evidence now"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ReadonlyProductizationBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  productizationDocText: string;
  roadmapText: string;
  acceptanceText: string;
  testText: string;
}

export interface ReadonlyProductizationBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    acceptanceGateRegistered: boolean;
    acceptanceGateRecorded: boolean;
    productizationDocsNonAuthorizing: boolean;
    roadmapRecordsLocalOnlyGate: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    readonlyProductizationBoundaryMode:
      "local_readonly_productization_acceptance_gate_only";
    readonlyProductizationIsProviderExecuteAuthorization: false;
    readonlyProductizationIsRealCodexCliAuthorization: false;
    readonlyProductizationIsWorkspaceWriteAuthorization: false;
    readonlyProductizationIsLocalCommandAuthorization: false;
    readonlyProductizationIsHostExecutorAuthorization: false;
    readonlyProductizationIsSubAgentRuntimeAuthorization: false;
    readonlyProductizationIsToolRuntimeAuthorization: false;
    readonlyProductizationIsExternalWriteAuthorization: false;
    readonlyProductizationIsEvidenceRefreshAuthorization: false;
    readonlyProductizationIsReleaseAuthorization: false;
    readonlyProductizationGitStateIsExecutionAuthorization: false;
    readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization: false;
    providerExecuteCallsDuringBoundaryAudit: 0;
    codexCliCallsDuringBoundaryAudit: 0;
    workspaceWriteCallsDuringBoundaryAudit: 0;
    hostExecutorCallsDuringBoundaryAudit: 0;
    subAgentRuntimeCallsDuringBoundaryAudit: 0;
    toolRuntimeCallsDuringBoundaryAudit: 0;
    shellProcessCallsDuringBoundaryAudit: 0;
    externalWriteCallsDuringBoundaryAudit: 0;
    evidenceWritesDuringBoundaryAudit: 0;
  };
  reasons: string[];
}

export type ReadonlyProductizationBoundaryAuditOutputFormat = "text" | "json";

export async function collectReadonlyProductizationBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ReadonlyProductizationBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    productizationDocText,
    roadmapText,
    acceptanceText,
    testText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, PRODUCTIZATION_DOC),
    read(cwd, ROADMAP_DOC),
    read(cwd, PRODUCTIZATION_ACCEPTANCE),
    read(cwd, PRODUCTIZATION_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    productizationDocText,
    roadmapText,
    acceptanceText,
    testText
  };
}

export function reviewReadonlyProductizationBoundaryAudit(
  input: ReadonlyProductizationBoundaryAuditInput
): ReadonlyProductizationBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit readonly-productization-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "auditCheck(\"readonly-productization-boundary\""
    ),
    acceptanceGateRegistered: input.governanceRunnerText.includes(
      "readonly-productization"
    ),
    acceptanceGateRecorded: REQUIRED_ACCEPTANCE_GATE_MARKERS.every((marker) =>
      input.acceptanceText.includes(marker)
    ),
    productizationDocsNonAuthorizing:
      markersPresentNormalized(input.productizationDocText, REQUIRED_DOC_MARKERS)
      && !containsForbiddenAuthorization(input.productizationDocText),
    roadmapRecordsLocalOnlyGate:
      markersPresentNormalized(input.roadmapText, REQUIRED_ROADMAP_MARKERS)
      && !containsForbiddenAuthorization(input.roadmapText),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.testText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.productizationDocText
    ),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      readonlyProductizationBoundaryMode:
        "local_readonly_productization_acceptance_gate_only",
      readonlyProductizationIsProviderExecuteAuthorization: false,
      readonlyProductizationIsRealCodexCliAuthorization: false,
      readonlyProductizationIsWorkspaceWriteAuthorization: false,
      readonlyProductizationIsLocalCommandAuthorization: false,
      readonlyProductizationIsHostExecutorAuthorization: false,
      readonlyProductizationIsSubAgentRuntimeAuthorization: false,
      readonlyProductizationIsToolRuntimeAuthorization: false,
      readonlyProductizationIsExternalWriteAuthorization: false,
      readonlyProductizationIsEvidenceRefreshAuthorization: false,
      readonlyProductizationIsReleaseAuthorization: false,
      readonlyProductizationGitStateIsExecutionAuthorization: false,
      readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization: false,
      providerExecuteCallsDuringBoundaryAudit: 0,
      codexCliCallsDuringBoundaryAudit: 0,
      workspaceWriteCallsDuringBoundaryAudit: 0,
      hostExecutorCallsDuringBoundaryAudit: 0,
      subAgentRuntimeCallsDuringBoundaryAudit: 0,
      toolRuntimeCallsDuringBoundaryAudit: 0,
      shellProcessCallsDuringBoundaryAudit: 0,
      externalWriteCallsDuringBoundaryAudit: 0,
      evidenceWritesDuringBoundaryAudit: 0
    },
    reasons
  };
}

export function formatReadonlyProductizationBoundaryAuditResult(
  review: ReadonlyProductizationBoundaryAuditResult,
  format: ReadonlyProductizationBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Read-only productization boundary audit",
    `status: ${review.status}`,
    `boundary mode: ${review.summary.readonlyProductizationBoundaryMode}`,
    `productization is provider execute authorization: ${review.summary.readonlyProductizationIsProviderExecuteAuthorization}`,
    `productization is real Codex CLI authorization: ${review.summary.readonlyProductizationIsRealCodexCliAuthorization}`,
    `productization is workspace-write authorization: ${review.summary.readonlyProductizationIsWorkspaceWriteAuthorization}`,
    `productization is evidence refresh authorization: ${review.summary.readonlyProductizationIsEvidenceRefreshAuthorization}`,
    `productization is release authorization: ${review.summary.readonlyProductizationIsReleaseAuthorization}`,
    `productization git state is execution authorization: ${review.summary.readonlyProductizationGitStateIsExecutionAuthorization}`,
    `provider execute calls during boundary audit: ${review.summary.providerExecuteCallsDuringBoundaryAudit}`,
    `real CLI calls during boundary audit: ${review.summary.codexCliCallsDuringBoundaryAudit}`,
    `workspace-write calls during boundary audit: ${review.summary.workspaceWriteCallsDuringBoundaryAudit}`,
    `evidence writes during boundary audit: ${review.summary.evidenceWritesDuringBoundaryAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, path: string): Promise<string> {
  return await readFile(join(cwd, path), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return markersPresentNormalized(text, [
    "Read-only productization boundary",
    "local read-only productization acceptance gate only",
    "not provider execute authorization",
    "not real Codex CLI authorization",
    "not workspace-write authorization",
    "not local command authorization",
    "not host executor authorization",
    "not sub-agent runtime authorization",
    "not tool runtime authorization",
    "not external-write authorization",
    "not evidence refresh authorization",
    "not release authorization",
    "git state is not execution authorization",
    "worktree clean is not provider execution authorization"
  ]);
}

function markersPresentNormalized(
  text: string,
  markers: readonly string[]
): boolean {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();

  return markers.every((marker) =>
    normalized.includes(marker.replace(/\s+/g, " ").toLowerCase())
  );
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_DOC_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function containsForbiddenAuthorization(text: string): boolean {
  const lower = text.toLowerCase();

  return FORBIDDEN_AUTHORIZATION_MARKERS.some((marker) =>
    lower.includes(marker.toLowerCase())
  );
}

function outputSanitized(): boolean {
  const fixture = formatReadonlyProductizationBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      acceptanceGateRegistered: true,
      acceptanceGateRecorded: true,
      productizationDocsNonAuthorizing: true,
      roadmapRecordsLocalOnlyGate: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      readonlyProductizationBoundaryMode:
        "local_readonly_productization_acceptance_gate_only",
      readonlyProductizationIsProviderExecuteAuthorization: false,
      readonlyProductizationIsRealCodexCliAuthorization: false,
      readonlyProductizationIsWorkspaceWriteAuthorization: false,
      readonlyProductizationIsLocalCommandAuthorization: false,
      readonlyProductizationIsHostExecutorAuthorization: false,
      readonlyProductizationIsSubAgentRuntimeAuthorization: false,
      readonlyProductizationIsToolRuntimeAuthorization: false,
      readonlyProductizationIsExternalWriteAuthorization: false,
      readonlyProductizationIsEvidenceRefreshAuthorization: false,
      readonlyProductizationIsReleaseAuthorization: false,
      readonlyProductizationGitStateIsExecutionAuthorization: false,
      readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization: false,
      providerExecuteCallsDuringBoundaryAudit: 0,
      codexCliCallsDuringBoundaryAudit: 0,
      workspaceWriteCallsDuringBoundaryAudit: 0,
      hostExecutorCallsDuringBoundaryAudit: 0,
      subAgentRuntimeCallsDuringBoundaryAudit: 0,
      toolRuntimeCallsDuringBoundaryAudit: 0,
      shellProcessCallsDuringBoundaryAudit: 0,
      externalWriteCallsDuringBoundaryAudit: 0,
      evidenceWritesDuringBoundaryAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !fixture.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `readonly_productization_boundary_${name}`);
}

async function main(): Promise<void> {
  const review = reviewReadonlyProductizationBoundaryAudit(
    await collectReadonlyProductizationBoundaryAuditInput()
  );
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatReadonlyProductizationBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Read-only productization boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
