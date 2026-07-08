#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const PACKAGE_JSON = "package.json";
const PUBLIC_API_INDEX = "packages/public-api/src/index.ts";
const PUBLIC_API_HOST = "packages/public-api/src/host.ts";
const PUBLIC_API_PROVIDER = "packages/public-api/src/provider.ts";
const PUBLIC_API_PROTOCOL = "packages/public-api/src/protocol.ts";
const PUBLIC_API_TEST = "tests/public-api-surface.test.ts";
const PUBLIC_API_ROOT_FIXTURE = "tests/fixtures/public-api-surface-lock.fixture.json";
const PUBLIC_API_HOST_FIXTURE = "tests/fixtures/public-api-host-surface-lock.fixture.json";
const PUBLIC_API_PROVIDER_FIXTURE =
  "tests/fixtures/public-api-provider-surface-lock.fixture.json";

const REQUIRED_PACKAGE_EXPORTS = [
  "\".\"",
  "\"./sdk\"",
  "\"./host\"",
  "\"./protocol\"",
  "\"./provider\"",
  "\"./support\""
] as const;

const FORBIDDEN_PACKAGE_EXPORTS = [
  "\"./governance-internal-recovery-control\"",
  "\"./governance-internal-provider-execution-runner\"",
  "\"./governance-internal-workspace-write-guard\"",
  "\"./recovery-control\"",
  "\"./provider-execution-runner\"",
  "\"./workspace-write-guard\"",
  "\"./codex-cli-host\"",
  "\"./packages/*\""
] as const;

const REQUIRED_ROOT_FIXTURE_MARKERS = [
  "\"DesktopHostClient\"",
  "\"createDesktopHostClient\"",
  "\"createCodexDesktopLiveHostBundle\"",
  "\"ProviderManifestSchema\"",
  "\"ProviderRegistry\"",
  "\"createProviderRegistry\"",
  "\"MCP_TOOL_PROVIDER_INVOKE_DISABLED\"",
  "\"A2A_REMOTE_AGENT_PROVIDER_DISABLED\""
] as const;

const REQUIRED_HOST_SOURCE_MARKERS = [
  "DesktopHostClient as InternalDesktopHostClient",
  "private inner: InternalDesktopHostClient",
  "this.inner.run(",
  "this.inner.resume(",
  "this.inner.reviewCurrentOperatorActionHostExecutorAuthorization(",
  "this.inner.dispatchCurrentOperatorActionHostExecutor(",
  "DesktopHostOperatorActionHostExecutorDispatchMode",
  "\"dry_run\"",
  "\"execute_injected\"",
  "DesktopHostOperatorActionHostExecutorDispatchExecutor",
  "DesktopHostOperatorActionHostExecutorDispatchAuditSink",
  "DesktopHostOperatorActionHostExecutorAuthorizationResult = unknown",
  "DesktopHostOperatorActionHostExecutorDispatchResult = unknown"
] as const;

const REQUIRED_PROVIDER_SOURCE_MARKERS = [
  "ProviderManifestSchema",
  "ProviderRegistry",
  "createProviderRegistry",
  "selectProviderForGrant",
  "selectProviderForRoutingDecision",
  "parseExecutorExecutionPlan",
  "ToolProviderInvocationPlanSchema"
] as const;

const REQUIRED_PROTOCOL_SOURCE_MARKERS = [
  "MCP_TOOL_PROVIDER_INVOKE_DISABLED",
  "createMcpToolProviderSkeleton",
  "A2A_REMOTE_AGENT_PROVIDER_DISABLED",
  "createA2ARemoteAgentProviderSkeleton"
] as const;

const REQUIRED_TEST_MARKERS = [
  "public-api facade export surface is lock-stable",
  "public-api subfacade export surfaces are lock-stable",
  "root package exports only approved public API facades",
  "public-api facade does not expose internal governance implementation",
  "dispatchGovernanceOperatorActionHostExecutor",
  "authorizeGovernanceOperatorActionHostExecutorReview",
  "runProviderExecutionPlanControlledReadOnly",
  "runProviderExecutionPlanDryRun",
  "evaluateWorkspaceWritePatchGuard",
  "runCodexDesktopLiveHostSmoke",
  "createFakeMcpToolProvider",
  "createFakeA2ATransport"
] as const;

const FORBIDDEN_PUBLIC_EXPORTS = [
  "\"dispatchGovernanceOperatorActionHostExecutor\"",
  "\"authorizeGovernanceOperatorActionHostExecutorReview\"",
  "\"runProviderExecutionPlanControlledReadOnly\"",
  "\"runProviderExecutionPlanDryRun\"",
  "\"evaluateWorkspaceWritePatchGuard\"",
  "\"runCodexCliExecPlan\"",
  "\"runCodexCliReadOnlySmoke\"",
  "\"runCodexCliWorkspaceWriteSmoke\"",
  "\"createFakeMcpToolProvider\"",
  "\"createFakeA2ATransport\""
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface PublicApiExecutionBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  packageJsonText: string;
  publicApiIndexText: string;
  publicApiHostText: string;
  publicApiProviderText: string;
  publicApiProtocolText: string;
  publicApiTestText: string;
  rootFixtureText: string;
  hostFixtureText: string;
  providerFixtureText: string;
}

export interface PublicApiExecutionBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    packageExportsFacadeOnly: boolean;
    rootPublicSurfaceLocked: boolean;
    hostPublicSurfaceLocked: boolean;
    providerPublicSurfaceLocked: boolean;
    hostFacadeDelegatesToDesktopClient: boolean;
    providerFacadeIsPlanAndRegistryOnly: boolean;
    protocolRemoteInvokeDisabledByDefault: boolean;
    negativeCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    publicApiMode: "facade_exports_only";
    hostFacadeMode: "desktop_host_client_declaration_safe_wrapper";
    providerFacadeMode: "schemas_registry_selection_only";
    protocolFacadeMode: "disabled_remote_provider_skeletons";
    internalGovernanceTopLevelExportsAllowed: false;
    directHostExecutorDispatchExportAllowed: false;
    providerExecuteExportAllowed: false;
    codexCliHostRunExportAllowed: false;
    subAgentRuntimeExportAllowed: false;
    workspaceWriteGuardExportAllowed: false;
    publicApiCallsDuringAudit: 0;
    hostExecutorInvocationsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type PublicApiExecutionBoundaryAuditOutputFormat = "text" | "json";

export async function collectPublicApiExecutionBoundaryAuditInput(
  cwd = process.cwd()
): Promise<PublicApiExecutionBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    packageJsonText,
    publicApiIndexText,
    publicApiHostText,
    publicApiProviderText,
    publicApiProtocolText,
    publicApiTestText,
    rootFixtureText,
    hostFixtureText,
    providerFixtureText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, PACKAGE_JSON),
    read(cwd, PUBLIC_API_INDEX),
    read(cwd, PUBLIC_API_HOST),
    read(cwd, PUBLIC_API_PROVIDER),
    read(cwd, PUBLIC_API_PROTOCOL),
    read(cwd, PUBLIC_API_TEST),
    read(cwd, PUBLIC_API_ROOT_FIXTURE),
    read(cwd, PUBLIC_API_HOST_FIXTURE),
    read(cwd, PUBLIC_API_PROVIDER_FIXTURE)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    packageJsonText,
    publicApiIndexText,
    publicApiHostText,
    publicApiProviderText,
    publicApiProtocolText,
    publicApiTestText,
    rootFixtureText,
    hostFixtureText,
    providerFixtureText
  };
}

export function reviewPublicApiExecutionBoundaryAudit(
  input: PublicApiExecutionBoundaryAuditInput
): PublicApiExecutionBoundaryAuditResult {
  const checks = {
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit public-api-execution-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "public-api-execution-boundary"
    ),
    packageExportsFacadeOnly: packageExportsFacadeOnly(input.packageJsonText),
    rootPublicSurfaceLocked: rootPublicSurfaceLocked(input.rootFixtureText),
    hostPublicSurfaceLocked: hostPublicSurfaceLocked(input.hostFixtureText),
    providerPublicSurfaceLocked: providerPublicSurfaceLocked(input.providerFixtureText),
    hostFacadeDelegatesToDesktopClient: REQUIRED_HOST_SOURCE_MARKERS.every((marker) =>
      input.publicApiHostText.includes(marker)
    ),
    providerFacadeIsPlanAndRegistryOnly:
      REQUIRED_PROVIDER_SOURCE_MARKERS.every((marker) =>
        input.publicApiProviderText.includes(marker)
      )
      && !input.publicApiProviderText.includes("execute(")
      && !input.publicApiProviderText.includes("runProviderExecutionPlan"),
    protocolRemoteInvokeDisabledByDefault:
      REQUIRED_PROTOCOL_SOURCE_MARKERS.every((marker) =>
        input.publicApiProtocolText.includes(marker)
      ),
    negativeCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.publicApiTestText.includes(marker)
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      publicApiMode: "facade_exports_only",
      hostFacadeMode: "desktop_host_client_declaration_safe_wrapper",
      providerFacadeMode: "schemas_registry_selection_only",
      protocolFacadeMode: "disabled_remote_provider_skeletons",
      internalGovernanceTopLevelExportsAllowed: false,
      directHostExecutorDispatchExportAllowed: false,
      providerExecuteExportAllowed: false,
      codexCliHostRunExportAllowed: false,
      subAgentRuntimeExportAllowed: false,
      workspaceWriteGuardExportAllowed: false,
      publicApiCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatPublicApiExecutionBoundaryAuditResult(
  review: PublicApiExecutionBoundaryAuditResult,
  format: PublicApiExecutionBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Public API execution boundary audit",
    `status: ${review.status}`,
    `public API mode: ${review.summary.publicApiMode}`,
    `host facade mode: ${review.summary.hostFacadeMode}`,
    `provider facade mode: ${review.summary.providerFacadeMode}`,
    `protocol facade mode: ${review.summary.protocolFacadeMode}`,
    `internal governance top-level exports allowed: ${review.summary.internalGovernanceTopLevelExportsAllowed}`,
    `direct host executor dispatch export allowed: ${review.summary.directHostExecutorDispatchExportAllowed}`,
    `provider execute export allowed: ${review.summary.providerExecuteExportAllowed}`,
    `Codex CLI host run export allowed: ${review.summary.codexCliHostRunExportAllowed}`,
    `sub-agent runtime export allowed: ${review.summary.subAgentRuntimeExportAllowed}`,
    `workspace-write guard export allowed: ${review.summary.workspaceWriteGuardExportAllowed}`,
    `public API calls during audit: ${review.summary.publicApiCallsDuringAudit}`,
    `host executor invocations during audit: ${review.summary.hostExecutorInvocationsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Public API execution boundary")
    && text.includes("facade exports only")
    && text.includes("public facade does not authorize Codex CLI")
    && text.includes("provider execute, sub-agent runtime, host executor dispatch")
    && text.includes("npm run governance -- audit public-api-execution-boundary");
}

function packageExportsFacadeOnly(text: string): boolean {
  return REQUIRED_PACKAGE_EXPORTS.every((marker) => text.includes(marker))
    && FORBIDDEN_PACKAGE_EXPORTS.every((marker) => !text.includes(marker));
}

function rootPublicSurfaceLocked(text: string): boolean {
  return REQUIRED_ROOT_FIXTURE_MARKERS.every((marker) => text.includes(marker))
    && FORBIDDEN_PUBLIC_EXPORTS.every((marker) => !text.includes(marker));
}

function hostPublicSurfaceLocked(text: string): boolean {
  return text.includes("\"DesktopHostClient\"")
    && text.includes("\"createDesktopHostClient\"")
    && text.includes("\"createCodexDesktopLiveHostBundle\"")
    && !text.includes("\"dispatchGovernanceOperatorActionHostExecutor\"")
    && !text.includes("\"authorizeGovernanceOperatorActionHostExecutorReview\"");
}

function providerPublicSurfaceLocked(text: string): boolean {
  return text.includes("\"ProviderRegistry\"")
    && text.includes("\"ProviderManifestSchema\"")
    && text.includes("\"ToolProviderInvocationPlanSchema\"")
    && !text.includes("\"runProviderExecutionPlanControlledReadOnly\"")
    && !text.includes("\"runProviderExecutionPlanDryRun\"");
}

function noBroadExecutionAuthorization(
  input: PublicApiExecutionBoundaryAuditInput
): boolean {
  return rootPublicSurfaceLocked(input.rootFixtureText)
    && providerPublicSurfaceLocked(input.providerFixtureText)
    && !input.publicApiIndexText.includes("governance-internal-recovery-control")
    && !input.publicApiIndexText.includes("governance-internal-provider-execution-runner")
    && !input.publicApiIndexText.includes("governance-internal-workspace-write-guard")
    && !input.publicApiIndexText.includes("codex-cli-host")
    && !input.publicApiIndexText.includes("dispatchGovernanceOperatorActionHostExecutor")
    && !input.publicApiIndexText.includes("runProviderExecutionPlanControlledReadOnly")
    && !input.publicApiIndexText.includes("runCodexCliExecPlan")
    && !input.publicApiProviderText.includes("provider.execute(")
    && !input.publicApiProviderText.includes("runProviderExecutionPlan")
    && !input.publicApiProtocolText.includes("createFakeMcpToolProvider")
    && !input.publicApiProtocolText.includes("createFakeA2ATransport");
}

function outputSanitized(input: PublicApiExecutionBoundaryAuditInput): boolean {
  const review: PublicApiExecutionBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      packageExportsFacadeOnly: true,
      rootPublicSurfaceLocked: true,
      hostPublicSurfaceLocked: true,
      providerPublicSurfaceLocked: true,
      hostFacadeDelegatesToDesktopClient: true,
      providerFacadeIsPlanAndRegistryOnly: true,
      protocolRemoteInvokeDisabledByDefault: true,
      negativeCoverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      publicApiMode: "facade_exports_only",
      hostFacadeMode: "desktop_host_client_declaration_safe_wrapper",
      providerFacadeMode: "schemas_registry_selection_only",
      protocolFacadeMode: "disabled_remote_provider_skeletons",
      internalGovernanceTopLevelExportsAllowed: false,
      directHostExecutorDispatchExportAllowed: false,
      providerExecuteExportAllowed: false,
      codexCliHostRunExportAllowed: false,
      subAgentRuntimeExportAllowed: false,
      workspaceWriteGuardExportAllowed: false,
      publicApiCallsDuringAudit: 0,
      hostExecutorInvocationsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatPublicApiExecutionBoundaryAuditResult(review);
  const json = formatPublicApiExecutionBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
    !text.includes(marker)
      && !json.includes(marker)
      && !input.governanceControlPlaneText.includes(marker)
      && !input.governanceReadmeText.includes(marker)
  );
}

function collectReasons(
  checks: PublicApiExecutionBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `public_api_execution_boundary_${name}`);
}

async function read(cwd: string, relativePath: string): Promise<string> {
  return readFile(join(cwd, relativePath), "utf8");
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectPublicApiExecutionBoundaryAuditInput();
  const review = reviewPublicApiExecutionBoundaryAudit(input);

  console.log(formatPublicApiExecutionBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Public API execution boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
