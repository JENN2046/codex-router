#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const TARGET_HOST_OBJECT_SOURCE =
  "packages/host-client-example/src/target-host-object-contract.ts";
const TARGET_HOST_LAYER_SOURCE =
  "packages/host-client-example/src/target-host-layer-skeleton.ts";
const TARGET_HOST_STARTER_SOURCE =
  "packages/host-client-example/src/target-host-embedding-starter.ts";
const TARGET_HOST_OBJECT_TEST = "tests/target-host-object-contract.test.ts";
const TARGET_HOST_LAYER_TEST = "tests/target-host-layer-skeleton.test.ts";
const TARGET_HOST_STARTER_TEST = "tests/target-host-embedding-starter.test.ts";

const REQUIRED_OBJECT_SOURCE_MARKERS = [
  "CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS",
  "CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS",
  "CODEX_DESKTOP_TARGET_HOST_PLACEHOLDER_TAG",
  "createCodexDesktopTargetHostObjectContract",
  "inspectCodexDesktopTargetHostObjectContract",
  "getCodexDesktopTargetHostPlaceholderMethods",
  "assertCodexDesktopTargetHostObjectContract",
  "codex_desktop_target_host_contract_unwired_methods",
  "codex_desktop_target_host_contract_method_not_wired"
] as const;

const REQUIRED_LAYER_SOURCE_MARKERS = [
  "createCodexDesktopTargetHostDirectives",
  "createCodexDesktopTargetHostLayerSkeleton",
  "assertCodexDesktopTargetHostObjectContract(options.host)",
  "createCodexDesktopLiveHostStarter",
  "mergeDirectiveResolvers",
  "hasDirectiveResolvers"
] as const;

const REQUIRED_STARTER_SOURCE_MARKERS = [
  "createCodexDesktopTargetHostEmbeddingStarter",
  "getCodexDesktopTargetHostEmbeddingStatus",
  "pendingRequiredMethods",
  "pendingOptionalMethods",
  "nextAction: inspection.ready ? \"create_bundle\" : \"wire_required_methods\"",
  "createBundle()"
] as const;

const REQUIRED_TEST_MARKERS = [
  "target host object contract template reports unwired placeholder methods",
  "target host object contract template becomes ready after required methods are wired",
  "target host layer skeleton wires a real current host object through the live host starter",
  "target host layer skeleton fails fast when contract placeholders are still unwired",
  "target host embedding starter exposes a scaffold with live readiness inspection",
  "target host embedding starter can create a bundle after the scaffold is wired"
] as const;

const FORBIDDEN_SOURCE_MARKERS = [
  "provider.execute(",
  "execFile(",
  "exec(",
  "spawn(",
  "dispatchToHost(",
  "invokeSubAgent",
  "new Worker(",
  "fetch(",
  "writeFile("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface TargetHostEmbeddingBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  targetHostObjectSourceText: string;
  targetHostLayerSourceText: string;
  targetHostStarterSourceText: string;
  targetHostObjectTestText: string;
  targetHostLayerTestText: string;
  targetHostStarterTestText: string;
}

export interface TargetHostEmbeddingBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    objectContractMarkersRecorded: boolean;
    layerSkeletonMarkersRecorded: boolean;
    embeddingStarterMarkersRecorded: boolean;
    failClosedCoverageRecorded: boolean;
    noDefaultRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    targetHostEmbeddingMode: "explicit_target_host_contract_and_starter_only";
    placeholderMethodsAreRealExecution: false;
    scaffoldReadyStatusIsExecutionAuthorization: false;
    createBundleRequiresFullyWiredHost: true;
    createBundleIsHostExecutorAuthorization: false;
    directiveBuildersAreShellAuthorization: false;
    defaultRealHostExecutionAllowed: false;
    defaultHostExecutorLookupAllowed: false;
    defaultCodexCliInvocationAllowed: false;
    providerExecuteAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    shellProcessAllowedByDefault: false;
    workspaceWriteAllowedByDefault: false;
    externalWriteAllowed: false;
    bundleCreationsDuringAudit: 0;
    hostClientRunCallsDuringAudit: 0;
    hostExecutorInvocationsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type TargetHostEmbeddingBoundaryAuditOutputFormat = "text" | "json";

export async function collectTargetHostEmbeddingBoundaryAuditInput(
  cwd = process.cwd()
): Promise<TargetHostEmbeddingBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    targetHostObjectSourceText,
    targetHostLayerSourceText,
    targetHostStarterSourceText,
    targetHostObjectTestText,
    targetHostLayerTestText,
    targetHostStarterTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, TARGET_HOST_OBJECT_SOURCE),
    read(cwd, TARGET_HOST_LAYER_SOURCE),
    read(cwd, TARGET_HOST_STARTER_SOURCE),
    read(cwd, TARGET_HOST_OBJECT_TEST),
    read(cwd, TARGET_HOST_LAYER_TEST),
    read(cwd, TARGET_HOST_STARTER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    targetHostObjectSourceText,
    targetHostLayerSourceText,
    targetHostStarterSourceText,
    targetHostObjectTestText,
    targetHostLayerTestText,
    targetHostStarterTestText
  };
}

export function reviewTargetHostEmbeddingBoundaryAudit(
  input: TargetHostEmbeddingBoundaryAuditInput
): TargetHostEmbeddingBoundaryAuditResult {
  const combinedSourceText = [
    input.targetHostObjectSourceText,
    input.targetHostLayerSourceText,
    input.targetHostStarterSourceText
  ].join("\n");
  const combinedTestText = [
    input.targetHostObjectTestText,
    input.targetHostLayerTestText,
    input.targetHostStarterTestText
  ].join("\n");
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit target-host-embedding-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "target-host-embedding-boundary"
    ),
    objectContractMarkersRecorded: REQUIRED_OBJECT_SOURCE_MARKERS.every((marker) =>
      input.targetHostObjectSourceText.includes(marker)
    ),
    layerSkeletonMarkersRecorded: REQUIRED_LAYER_SOURCE_MARKERS.every((marker) =>
      input.targetHostLayerSourceText.includes(marker)
    ),
    embeddingStarterMarkersRecorded: REQUIRED_STARTER_SOURCE_MARKERS.every(
      (marker) => input.targetHostStarterSourceText.includes(marker)
    ),
    failClosedCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      combinedTestText.includes(marker)
    ),
    noDefaultRuntimeInvocationSurface: FORBIDDEN_SOURCE_MARKERS.every(
      (marker) => !combinedSourceText.includes(marker)
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      targetHostEmbeddingMode: "explicit_target_host_contract_and_starter_only",
      placeholderMethodsAreRealExecution: false,
      scaffoldReadyStatusIsExecutionAuthorization: false,
      createBundleRequiresFullyWiredHost: true,
      createBundleIsHostExecutorAuthorization: false,
      directiveBuildersAreShellAuthorization: false,
      defaultRealHostExecutionAllowed: false,
      defaultHostExecutorLookupAllowed: false,
      defaultCodexCliInvocationAllowed: false,
      providerExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowedByDefault: false,
      workspaceWriteAllowedByDefault: false,
      externalWriteAllowed: false,
      bundleCreationsDuringAudit: 0,
      hostClientRunCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
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

export function formatTargetHostEmbeddingBoundaryAuditResult(
  review: TargetHostEmbeddingBoundaryAuditResult,
  format: TargetHostEmbeddingBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Target host embedding boundary audit",
    `status: ${review.status}`,
    `target host embedding mode: ${review.summary.targetHostEmbeddingMode}`,
    `placeholder methods are real execution: ${review.summary.placeholderMethodsAreRealExecution}`,
    `scaffold ready status is execution authorization: ${review.summary.scaffoldReadyStatusIsExecutionAuthorization}`,
    `createBundle requires fully wired host: ${review.summary.createBundleRequiresFullyWiredHost}`,
    `createBundle is host executor authorization: ${review.summary.createBundleIsHostExecutorAuthorization}`,
    `directive builders are shell authorization: ${review.summary.directiveBuildersAreShellAuthorization}`,
    `default real host execution allowed: ${review.summary.defaultRealHostExecutionAllowed}`,
    `default host executor lookup allowed: ${review.summary.defaultHostExecutorLookupAllowed}`,
    `default Codex CLI invocation allowed: ${review.summary.defaultCodexCliInvocationAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `shell/process allowed by default: ${review.summary.shellProcessAllowedByDefault}`,
    `workspace-write allowed by default: ${review.summary.workspaceWriteAllowedByDefault}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `bundle creations during audit: ${review.summary.bundleCreationsDuringAudit}`,
    `host client run calls during audit: ${review.summary.hostClientRunCallsDuringAudit}`,
    `host executor invocations during audit: ${review.summary.hostExecutorInvocationsDuringAudit}`,
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
  return text.includes("Target host embedding boundary")
    && text.includes("explicit target-host contract and starter only")
    && text.includes("placeholder host methods are not real execution")
    && text.includes("scaffold ready status is not execution authorization")
    && text.includes("createBundle requires a fully wired explicit host")
    && text.includes("createBundle is not host executor authorization")
    && text.includes("directive builders are not shell authorization");
}

function outputSanitized(input: TargetHostEmbeddingBoundaryAuditInput): boolean {
  const output = formatTargetHostEmbeddingBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      objectContractMarkersRecorded: true,
      layerSkeletonMarkersRecorded: true,
      embeddingStarterMarkersRecorded: true,
      failClosedCoverageRecorded: true,
      noDefaultRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      targetHostEmbeddingMode: "explicit_target_host_contract_and_starter_only",
      placeholderMethodsAreRealExecution: false,
      scaffoldReadyStatusIsExecutionAuthorization: false,
      createBundleRequiresFullyWiredHost: true,
      createBundleIsHostExecutorAuthorization: false,
      directiveBuildersAreShellAuthorization: false,
      defaultRealHostExecutionAllowed: false,
      defaultHostExecutorLookupAllowed: false,
      defaultCodexCliInvocationAllowed: false,
      providerExecuteAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      shellProcessAllowedByDefault: false,
      workspaceWriteAllowedByDefault: false,
      externalWriteAllowed: false,
      bundleCreationsDuringAudit: 0,
      hostClientRunCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
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
    input.targetHostObjectSourceText,
    input.targetHostLayerSourceText,
    input.targetHostStarterSourceText,
    input.targetHostObjectTestText,
    input.targetHostLayerTestText,
    input.targetHostStarterTestText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: TargetHostEmbeddingBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `target_host_embedding_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectTargetHostEmbeddingBoundaryAuditInput();
  const review = reviewTargetHostEmbeddingBoundaryAudit(input);
  console.log(formatTargetHostEmbeddingBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Target host embedding boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
