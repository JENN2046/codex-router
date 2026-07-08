#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const FINAL_HOST_LOCATOR = "packages/final-host-locator/src/index.ts";
const FINAL_HOST_LOCATOR_TEST = "tests/final-host-locator.test.ts";

const REQUIRED_SOURCE_GATE_MARKERS = [
  "FinalHostSourceGateStatus",
  "\"ready_for_mapping\"",
  "\"blocked_missing_editable_source\"",
  "inspectFinalHostCandidate",
  "createFinalHostSourceGate",
  "probeFinalHostCandidatePath",
  "createFinalHostSourceGateFromPathProbes",
  "createFinalHostSourceGateEvidence",
  "DEFAULT_REQUIRED_INPUTS",
  "\"editable_final_host_source\"",
  "\"startup_or_extension_seam\"",
  "\"host_runtime_surface\"",
  "\"validation_surface\"",
  "canUseAsFinalHostSource",
  "final_host_source_is_packaged_runtime",
  "final_host_source_is_reference_host_only",
  "missing_startup_or_extension_seam",
  "missing_host_runtime_surface",
  "missing_validation_surface"
] as const;

const REQUIRED_READ_ONLY_PROBE_MARKERS = [
  "canAccess(options.path, constants.R_OK)",
  "canAccess(options.path, constants.W_OK)",
  "await readDirectEntries(options.path)",
  "directEntries",
  "exists(join(root, marker))"
] as const;

const FORBIDDEN_PATH_PROBE_WRITE_MARKERS = [
  "recursive",
  "writeFile",
  "mkdir",
  "rm(",
  "rename",
  "copyFile"
] as const;

const REQUIRED_TEST_MARKERS = [
  "final host locator blocks packaged runtime as non-editable source",
  "final host locator keeps VCPChat as reference-only unless explicitly re-scoped",
  "final host locator selects an editable source only after required seams exist",
  "final host locator reports missing mapping seams on partial source candidates",
  "final host locator probes a supplied source path without recursive scanning",
  "final host locator probe leaves partial source candidates blocked",
  "final host locator probe records missing supplied paths as blocked candidates",
  "final host locator evidence summarizes blocked source gates",
  "final host locator evidence records selected source for ready gates",
  "final host locator evidence can omit candidate signals for compact display"
] as const;

const FORBIDDEN_EXECUTION_MARKERS = [
  "dispatchGovernanceOperatorActionHostExecutor",
  "dispatchToHost",
  "runDesktopTask",
  "createDesktopHostClient",
  "runCodexCli",
  "CodexCliExecutorProvider",
  ".execute(",
  "provider.execute",
  "spawnSubAgent",
  "spawn(",
  "execFile(",
  "child_process",
  "invokePrimitive",
  "shell_command(",
  "apply_patch(",
  "writeFile",
  "mkdir",
  "rm(",
  "rename",
  "copyFile",
  "evaluateWorkspaceWritePatchGuard"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface FinalHostLocatorBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  finalHostLocatorText: string;
  finalHostLocatorTestText: string;
}

export interface FinalHostLocatorBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceGateMarkersPresent: boolean;
    pathProbeIsReadOnlyAndBounded: boolean;
    coverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    locatorMode: "source_candidate_pre_mapping_only";
    readyForMappingIsHostExecutionAuthorization: false;
    packagedRuntimeCanBeFinalHostSource: false;
    referenceHostCanBeFinalHostSource: false;
    pathProbeWritesAllowed: false;
    recursiveScanAllowed: false;
    hostExecutorInvocationAllowed: false;
    desktopHostClientCreationAllowed: false;
    hostDispatchAllowed: false;
    providerExecuteAllowed: false;
    codexCliInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteExecutionAllowed: false;
    finalHostLocatorCallsDuringAudit: 0;
    pathProbeWritesDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type FinalHostLocatorBoundaryAuditOutputFormat = "text" | "json";

export async function collectFinalHostLocatorBoundaryAuditInput(
  cwd = process.cwd()
): Promise<FinalHostLocatorBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    finalHostLocatorText,
    finalHostLocatorTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, FINAL_HOST_LOCATOR),
    read(cwd, FINAL_HOST_LOCATOR_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    finalHostLocatorText,
    finalHostLocatorTestText
  };
}

export function reviewFinalHostLocatorBoundaryAudit(
  input: FinalHostLocatorBoundaryAuditInput
): FinalHostLocatorBoundaryAuditResult {
  const checks = {
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit final-host-locator-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "final-host-locator-boundary"
    ),
    sourceGateMarkersPresent: REQUIRED_SOURCE_GATE_MARKERS.every((marker) =>
      input.finalHostLocatorText.includes(marker)
    ),
    pathProbeIsReadOnlyAndBounded: pathProbeIsReadOnlyAndBounded(
      input.finalHostLocatorText
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.finalHostLocatorTestText.includes(marker)
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(
      input.finalHostLocatorText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      locatorMode: "source_candidate_pre_mapping_only",
      readyForMappingIsHostExecutionAuthorization: false,
      packagedRuntimeCanBeFinalHostSource: false,
      referenceHostCanBeFinalHostSource: false,
      pathProbeWritesAllowed: false,
      recursiveScanAllowed: false,
      hostExecutorInvocationAllowed: false,
      desktopHostClientCreationAllowed: false,
      hostDispatchAllowed: false,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      finalHostLocatorCallsDuringAudit: 0,
      pathProbeWritesDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatFinalHostLocatorBoundaryAuditResult(
  review: FinalHostLocatorBoundaryAuditResult,
  format: FinalHostLocatorBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Final host locator boundary audit",
    `status: ${review.status}`,
    `locator mode: ${review.summary.locatorMode}`,
    `ready_for_mapping is host execution authorization: ${review.summary.readyForMappingIsHostExecutionAuthorization}`,
    `packaged runtime can be final host source: ${review.summary.packagedRuntimeCanBeFinalHostSource}`,
    `reference host can be final host source: ${review.summary.referenceHostCanBeFinalHostSource}`,
    `path probe writes allowed: ${review.summary.pathProbeWritesAllowed}`,
    `recursive scan allowed: ${review.summary.recursiveScanAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `desktop host client creation allowed: ${review.summary.desktopHostClientCreationAllowed}`,
    `host dispatch allowed: ${review.summary.hostDispatchAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write execution allowed: ${review.summary.workspaceWriteExecutionAllowed}`,
    `final host locator calls during audit: ${review.summary.finalHostLocatorCallsDuringAudit}`,
    `path probe writes during audit: ${review.summary.pathProbeWritesDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Final host locator boundary")
    && text.includes("source candidate and pre-mapping only")
    && text.includes("ready_for_mapping is not host execution authorization")
    && text.includes("npm run governance -- audit final-host-locator-boundary");
}

function pathProbeIsReadOnlyAndBounded(text: string): boolean {
  return REQUIRED_READ_ONLY_PROBE_MARKERS.every((marker) => text.includes(marker))
    && FORBIDDEN_PATH_PROBE_WRITE_MARKERS.every((marker) => !text.includes(marker));
}

function noBroadExecutionAuthorization(text: string): boolean {
  return FORBIDDEN_EXECUTION_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: FinalHostLocatorBoundaryAuditInput): boolean {
  const review: FinalHostLocatorBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceGateMarkersPresent: true,
      pathProbeIsReadOnlyAndBounded: true,
      coverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      locatorMode: "source_candidate_pre_mapping_only",
      readyForMappingIsHostExecutionAuthorization: false,
      packagedRuntimeCanBeFinalHostSource: false,
      referenceHostCanBeFinalHostSource: false,
      pathProbeWritesAllowed: false,
      recursiveScanAllowed: false,
      hostExecutorInvocationAllowed: false,
      desktopHostClientCreationAllowed: false,
      hostDispatchAllowed: false,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      finalHostLocatorCallsDuringAudit: 0,
      pathProbeWritesDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatFinalHostLocatorBoundaryAuditResult(review);
  const json = formatFinalHostLocatorBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
    !text.includes(marker)
      && !json.includes(marker)
      && !input.governanceControlPlaneText.includes(marker)
      && !input.governanceReadmeText.includes(marker)
  );
}

function collectReasons(
  checks: FinalHostLocatorBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `final_host_locator_boundary_${name}`);
}

async function read(cwd: string, relativePath: string): Promise<string> {
  return readFile(join(cwd, relativePath), "utf8");
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectFinalHostLocatorBoundaryAuditInput();
  const review = reviewFinalHostLocatorBoundaryAudit(input);

  console.log(formatFinalHostLocatorBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Final host locator boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
