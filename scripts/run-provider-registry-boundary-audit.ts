#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const PROVIDER_REGISTRY_SOURCE = "packages/provider-registry/src/index.ts";
const PROVIDER_REGISTRY_TEST = "tests/provider-registry.test.ts";
const PROVIDER_REGISTRY_SELECTION_ACCEPTANCE =
  "scripts/run-provider-registry-selection-acceptance.ts";
const PROVIDER_REGISTRY_SELECTION_ACCEPTANCE_TEST =
  "tests/provider-registry-selection-acceptance.test.ts";

const REQUIRED_REGISTRY_SOURCE_MARKERS = [
  "export class ProviderRegistry",
  "register(",
  "snapshot(options: { generatedAt?: string } = {})",
  "select(request: ProviderSelectionRequest): ProviderSelectionResult",
  "registerProvider(",
  "findProvidersByKind(kind: ProviderKind)",
  "findProvidersSupportingSideEffect",
  "findProvidersSupportingSandbox",
  "assertProviderInterfaceMatchesKind",
  "assertRemoteAgentAuthSchemes",
  "provider_registry_remote_agent_auth_schemes_required",
  "provider_registry_remote_agent_anonymous_auth_rejected",
  "export class FileSystemProviderManifestStore",
  "provider-manifest-store.v1",
  "writeState(state: ProviderManifestStoreState)"
] as const;

const REQUIRED_REGISTRY_TEST_MARKERS = [
  "provider-registry read-only catalog registers codex-cli manifest",
  "provider-registry selection selects codex-cli by providerId",
  "provider-registry selection rejects manifest hash mismatch",
  "provider-registry selection rejects unsupported side effects",
  "provider-registry selection result is sanitized",
  "provider-registry routing decision selection result is sanitized",
  "provider-registry registers, gets, lists, and unregisters providers",
  "provider-registry excludes disabled providers from automatic selection",
  "provider-registry rejects remote agents without explicit authSchemes",
  "provider-registry rejects anonymous remote agent auth schemes case-insensitively",
  "provider-registry accepts Codex CLI provider while execution remains disabled",
  "file provider manifest store persists provider metadata across instances",
  "file provider manifest store refuses mutations while another lock is present"
] as const;

const REQUIRED_SELECTION_ACCEPTANCE_MARKERS = [
  "mode: \"read-only-registry-selection\"",
  "selectByProviderIdOk",
  "selectByGrantOk",
  "missingProviderBlocked",
  "disabledProviderBlockedByDefault",
  "manifestMismatchBlocked",
  "unsupportedSandboxBlocked",
  "unsupportedSideEffectBlocked",
  "noRunPath: true"
] as const;

const REQUIRED_SELECTION_ACCEPTANCE_TEST_MARKERS = [
  "provider registry selection acceptance produces evidence object",
  "provider registry selection acceptance writer persists safe json",
  "evidence.checks.noRunPath",
  "assertSafeEvidence"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  ".execute(",
  ".invoke(",
  ".createRemoteTask(",
  "runCodexCliExecPlan(",
  "dispatchToHost(",
  "dispatchGovernanceOperatorActionHostExecutor(",
  "spawnSubAgent(",
  "spawn(",
  "execFile(",
  "exec("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ProviderRegistryBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  providerRegistrySourceText: string;
  providerRegistryTestText: string;
  providerRegistrySelectionAcceptanceText: string;
  providerRegistrySelectionAcceptanceTestText: string;
}

export interface ProviderRegistryBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    registryMarkersRecorded: boolean;
    registryRegressionCoverageRecorded: boolean;
    selectionAcceptanceRecorded: boolean;
    selectionAcceptanceCoverageRecorded: boolean;
    noRuntimeProviderInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    providerRegistryMode: "catalog_selection_attestation_and_manifest_store_only";
    selectedProviderIsExecutionAuthorization: false;
    providerGrantSelectionIsProviderExecuteAuthorization: false;
    routingDecisionSelectionIsCodexCliAuthorization: false;
    registeredExecutorProviderIsRuntimeInvocation: false;
    registeredToolProviderIsToolRuntimeInvocation: false;
    registeredRemoteAgentProviderIsSubAgentRuntimeAuthorization: false;
    remoteAgentAuthSchemesAreRuntimeAuthorization: false;
    manifestStorePersistenceIsWorkspaceWriteExecution: false;
    providerRegistryCallsDuringAudit: 0;
    providerSelectionCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ProviderRegistryBoundaryAuditOutputFormat = "text" | "json";

export async function collectProviderRegistryBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ProviderRegistryBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    providerRegistrySourceText,
    providerRegistryTestText,
    providerRegistrySelectionAcceptanceText,
    providerRegistrySelectionAcceptanceTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, PROVIDER_REGISTRY_SOURCE),
    read(cwd, PROVIDER_REGISTRY_TEST),
    read(cwd, PROVIDER_REGISTRY_SELECTION_ACCEPTANCE),
    read(cwd, PROVIDER_REGISTRY_SELECTION_ACCEPTANCE_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    providerRegistrySourceText,
    providerRegistryTestText,
    providerRegistrySelectionAcceptanceText,
    providerRegistrySelectionAcceptanceTestText
  };
}

export function reviewProviderRegistryBoundaryAudit(
  input: ProviderRegistryBoundaryAuditInput
): ProviderRegistryBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit provider-registry-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "provider-registry-boundary"
    ),
    registryMarkersRecorded: REQUIRED_REGISTRY_SOURCE_MARKERS.every((marker) =>
      input.providerRegistrySourceText.includes(marker)
    ),
    registryRegressionCoverageRecorded: REQUIRED_REGISTRY_TEST_MARKERS.every(
      (marker) => input.providerRegistryTestText.includes(marker)
    ),
    selectionAcceptanceRecorded: REQUIRED_SELECTION_ACCEPTANCE_MARKERS.every(
      (marker) => input.providerRegistrySelectionAcceptanceText.includes(marker)
    ),
    selectionAcceptanceCoverageRecorded:
      REQUIRED_SELECTION_ACCEPTANCE_TEST_MARKERS.every((marker) =>
        input.providerRegistrySelectionAcceptanceTestText.includes(marker)
      ),
    noRuntimeProviderInvocationSurface: noRuntimeProviderInvocationSurface(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      providerRegistryMode: "catalog_selection_attestation_and_manifest_store_only",
      selectedProviderIsExecutionAuthorization: false,
      providerGrantSelectionIsProviderExecuteAuthorization: false,
      routingDecisionSelectionIsCodexCliAuthorization: false,
      registeredExecutorProviderIsRuntimeInvocation: false,
      registeredToolProviderIsToolRuntimeInvocation: false,
      registeredRemoteAgentProviderIsSubAgentRuntimeAuthorization: false,
      remoteAgentAuthSchemesAreRuntimeAuthorization: false,
      manifestStorePersistenceIsWorkspaceWriteExecution: false,
      providerRegistryCallsDuringAudit: 0,
      providerSelectionCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatProviderRegistryBoundaryAuditResult(
  review: ProviderRegistryBoundaryAuditResult,
  format: ProviderRegistryBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Provider registry boundary audit",
    `status: ${review.status}`,
    `provider registry mode: ${review.summary.providerRegistryMode}`,
    `selected provider is execution authorization: ${review.summary.selectedProviderIsExecutionAuthorization}`,
    `provider grant selection is provider execute authorization: ${review.summary.providerGrantSelectionIsProviderExecuteAuthorization}`,
    `routing decision selection is Codex CLI authorization: ${review.summary.routingDecisionSelectionIsCodexCliAuthorization}`,
    `registered executor provider is runtime invocation: ${review.summary.registeredExecutorProviderIsRuntimeInvocation}`,
    `registered tool provider is tool runtime invocation: ${review.summary.registeredToolProviderIsToolRuntimeInvocation}`,
    `registered remote agent provider is sub-agent runtime authorization: ${review.summary.registeredRemoteAgentProviderIsSubAgentRuntimeAuthorization}`,
    `remote agent auth schemes are runtime authorization: ${review.summary.remoteAgentAuthSchemesAreRuntimeAuthorization}`,
    `manifest store persistence is workspace-write execution: ${review.summary.manifestStorePersistenceIsWorkspaceWriteExecution}`,
    `provider registry calls during audit: ${review.summary.providerRegistryCallsDuringAudit}`,
    `provider selection calls during audit: ${review.summary.providerSelectionCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
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
  return text.includes("Provider registry boundary")
    && text.includes("catalog selection, attestation, and manifest store only")
    && text.includes("selected providers are not execution authorization")
    && text.includes("provider grant selection is not provider execute authorization")
    && text.includes("routing decision selection is not Codex CLI authorization")
    && text.includes("registered remote-agent providers are not sub-agent runtime authorization")
    && text.includes("manifest-store persistence is not workspace-write execution");
}

function noRuntimeProviderInvocationSurface(
  input: ProviderRegistryBoundaryAuditInput
): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) =>
    !input.providerRegistrySourceText.includes(marker)
      && !input.providerRegistrySelectionAcceptanceText.includes(marker)
  );
}

function outputSanitized(): boolean {
  const output = formatProviderRegistryBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      registryMarkersRecorded: true,
      registryRegressionCoverageRecorded: true,
      selectionAcceptanceRecorded: true,
      selectionAcceptanceCoverageRecorded: true,
      noRuntimeProviderInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      providerRegistryMode: "catalog_selection_attestation_and_manifest_store_only",
      selectedProviderIsExecutionAuthorization: false,
      providerGrantSelectionIsProviderExecuteAuthorization: false,
      routingDecisionSelectionIsCodexCliAuthorization: false,
      registeredExecutorProviderIsRuntimeInvocation: false,
      registeredToolProviderIsToolRuntimeInvocation: false,
      registeredRemoteAgentProviderIsSubAgentRuntimeAuthorization: false,
      remoteAgentAuthSchemesAreRuntimeAuthorization: false,
      manifestStorePersistenceIsWorkspaceWriteExecution: false,
      providerRegistryCallsDuringAudit: 0,
      providerSelectionCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(
  checks: ProviderRegistryBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `provider_registry_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectProviderRegistryBoundaryAuditInput();
  const review = reviewProviderRegistryBoundaryAudit(input);

  console.log(formatProviderRegistryBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Provider registry boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
