#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const FORBIDDEN_PACKAGE_EXPORTS = [
  ".",
  "./sdk",
  "./host",
  "./support",
  "./testing",
  "./diagnostics",
  "./governance-internal-recovery-control",
  "./provider-execution-runner",
  "./workspace-write-guard",
  "./codex-cli-host",
  "./packages/*"
] as const;

const REQUIRED_PACKAGE_EXPORTS = [
  "./protocol",
  "./policy",
  "./codex-adapter",
  "./evidence",
  "./provider"
] as const;

const REQUIRED_FIXTURE_MARKERS = {
  protocol: [
    '"CapabilityFactsSchema"',
    '"AuthorizationDecisionSchema"',
    '"GovernedFileChangeSetSchema"',
    '"RetainReceiptSchema"',
    '"RollbackPermitSchema"'
  ],
  policy: [
    '"authorizeCapabilityFacts"',
    '"deriveCapabilityFacts"',
    '"canonicalizeGovernedFileChangeSet"',
    '"evaluateAutoApprovalPolicy"'
  ],
  codexAdapter: [
    '"AppServerSessionAttestationSchema"',
    '"CodexAppServerAdapter"',
    '"CodexAppServerNormalizedEventSchema"',
    '"CodexSdkAdapter"'
  ],
  evidence: [
    '"PreviewReceiptSchema"',
    '"RetainReceiptSchema"',
    '"issueRollbackPermit"',
    '"runGovernedRollback"',
    '"verifyRetainedChange"'
  ],
  provider: [
    '"ProviderManifestSchema"',
    '"ProviderSecurityBoundarySchema"',
    '"parseProviderManifest"',
    '"providerSupportsSideEffectClass"'
  ]
} as const;

const FORBIDDEN_PUBLIC_MARKERS = [
  "dispatchGovernanceOperatorActionHostExecutor",
  "runProviderExecutionPlanControlledReadOnly",
  "runProviderExecutionPlanDryRun",
  "runCodexCliExecPlan",
  "runCodexCliReadOnlySmoke",
  "runCodexCliWorkspaceWriteSmoke",
  "createFakeMcpToolProvider",
  "createFakeA2ATransport",
  "ProviderRegistry",
  "createProviderRegistry",
  "selectProviderForGrant",
  "ToolProviderInvocationPlanSchema"
] as const;

const REQUIRED_TEST_MARKERS = [
  "public-api facade export surface is lock-stable",
  "public protocol facade exposes kernel contracts without legacy compatibility contracts",
  "package exports only the five policy-based governance facades",
  "public-api package type targets are emitted and stay governance-internal free",
  "public-api facade does not expose internal governance implementation"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = ["OPENAI_API_KEY", "sk-proj-", "Bearer "] as const;

export interface PublicApiExecutionBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  packageJsonText: string;
  publicApiProtocolText: string;
  publicApiPolicyText: string;
  publicApiCodexAdapterText: string;
  publicApiEvidenceText: string;
  publicApiProviderText: string;
  publicApiTestText: string;
  protocolFixtureText: string;
  policyFixtureText: string;
  codexAdapterFixtureText: string;
  evidenceFixtureText: string;
  providerFixtureText: string;
}

export interface PublicApiExecutionBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    packageExportsNamedGovernanceOnly: boolean;
    protocolPublicSurfaceLocked: boolean;
    policyPublicSurfaceLocked: boolean;
    codexAdapterPublicSurfaceLocked: boolean;
    evidencePublicSurfaceLocked: boolean;
    providerPublicSurfaceLocked: boolean;
    providerFacadeIsManifestSpiOnly: boolean;
    protocolExcludesMcpA2a: boolean;
    negativeCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    publicApiMode: "named_governance_subpaths_only";
    hostFacadeMode: "internal_not_exported";
    providerFacadeMode: "manifest_capability_security_spi_only";
    protocolFacadeMode: "kernel_governance_contracts_only";
    governedRollbackExportAllowed: true;
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
  const read = (path: string) => readFile(join(cwd, path), "utf8");
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    packageJsonText,
    publicApiProtocolText,
    publicApiPolicyText,
    publicApiCodexAdapterText,
    publicApiEvidenceText,
    publicApiProviderText,
    publicApiTestText,
    protocolFixtureText,
    policyFixtureText,
    codexAdapterFixtureText,
    evidenceFixtureText,
    providerFixtureText
  ] = await Promise.all([
    read("docs/governance/GOVERNANCE_CONTROL_PLANE.md"),
    read("docs/governance/README.md"),
    read("scripts/run-governance-check.ts"),
    read("package.json"),
    read("packages/public-api/src/protocol.ts"),
    read("packages/public-api/src/policy.ts"),
    read("packages/public-api/src/codex-adapter.ts"),
    read("packages/public-api/src/evidence.ts"),
    read("packages/public-api/src/provider.ts"),
    read("tests/public-api-surface.test.ts"),
    read("tests/fixtures/public-api-protocol-surface-lock.fixture.json"),
    read("tests/fixtures/public-api-policy-surface-lock.fixture.json"),
    read("tests/fixtures/public-api-codex-adapter-surface-lock.fixture.json"),
    read("tests/fixtures/public-api-evidence-surface-lock.fixture.json"),
    read("tests/fixtures/public-api-provider-surface-lock.fixture.json")
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    packageJsonText,
    publicApiProtocolText,
    publicApiPolicyText,
    publicApiCodexAdapterText,
    publicApiEvidenceText,
    publicApiProviderText,
    publicApiTestText,
    protocolFixtureText,
    policyFixtureText,
    codexAdapterFixtureText,
    evidenceFixtureText,
    providerFixtureText
  };
}

export function reviewPublicApiExecutionBoundaryAudit(
  input: PublicApiExecutionBoundaryAuditInput
): PublicApiExecutionBoundaryAuditResult {
  const publicSources = [
    input.publicApiProtocolText,
    input.publicApiPolicyText,
    input.publicApiCodexAdapterText,
    input.publicApiEvidenceText,
    input.publicApiProviderText
  ].join("\n");
  const checks = {
    controlPlaneCapabilityRecorded:
      input.governanceControlPlaneText.includes("five named governance subpaths only")
      && input.governanceControlPlaneText.includes("There is no root, SDK, host, support, MCP/A2A"),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit public-api-execution-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "public-api-execution-boundary"
    ),
    packageExportsNamedGovernanceOnly: packageExportsNamedGovernanceOnly(
      input.packageJsonText
    ),
    protocolPublicSurfaceLocked: fixtureLocked(
      input.protocolFixtureText,
      REQUIRED_FIXTURE_MARKERS.protocol
    ),
    policyPublicSurfaceLocked: fixtureLocked(
      input.policyFixtureText,
      REQUIRED_FIXTURE_MARKERS.policy
    ),
    codexAdapterPublicSurfaceLocked: fixtureLocked(
      input.codexAdapterFixtureText,
      REQUIRED_FIXTURE_MARKERS.codexAdapter
    ),
    evidencePublicSurfaceLocked: fixtureLocked(
      input.evidenceFixtureText,
      REQUIRED_FIXTURE_MARKERS.evidence
    ),
    providerPublicSurfaceLocked: fixtureLocked(
      input.providerFixtureText,
      REQUIRED_FIXTURE_MARKERS.provider
    ),
    providerFacadeIsManifestSpiOnly:
      input.publicApiProviderText.includes("GovernanceProvider")
      && !input.publicApiProviderText.includes("execute(")
      && !FORBIDDEN_PUBLIC_MARKERS.some((marker) => (
        input.publicApiProviderText.includes(marker)
      )),
    protocolExcludesMcpA2a:
      !input.publicApiProtocolText.includes("protocol-mcp")
      && !input.publicApiProtocolText.includes("protocol-a2a")
      && !input.protocolFixtureText.includes("MCP_")
      && !input.protocolFixtureText.includes("A2A_"),
    negativeCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) => (
      input.publicApiTestText.includes(marker)
    )),
    noBroadExecutionAuthorization:
      !FORBIDDEN_PUBLIC_MARKERS.some((marker) => publicSources.includes(marker))
      && !input.publicApiEvidenceText.includes("GitWorkspaceTargetRestorePrimitive")
      && !input.publicApiEvidenceText.includes("WorkspaceTargetRestorePrimitive")
      && !input.publicApiEvidenceText.includes("runGovernedRollbackWithPrimitive")
      && !input.publicApiEvidenceText.includes("createTestOnlyRollbackPermitConsumptionStore")
      && !input.publicApiEvidenceText.includes("createTestOnlyFileRollbackPermitConsumptionStore")
      && !input.publicApiPolicyText.includes("createTestOnlyLocalClonePreviewer")
      && !input.publicApiCodexAdapterText.includes("createTestOnlyLocalClonePreviewer")
      && !input.publicApiCodexAdapterText.includes("SpawnPreviewProcessRunner")
      && input.publicApiEvidenceText.includes("runGovernedRollback")
      && input.publicApiEvidenceText.includes("FileRollbackPermitConsumptionStore"),
    outputSanitized: outputSanitized(input)
  };
  const reasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `public_api_execution_boundary_${name}`);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: createSummary(),
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
    `legacy host facade mode: ${review.summary.hostFacadeMode}`,
    `provider facade mode: ${review.summary.providerFacadeMode}`,
    `protocol facade mode: ${review.summary.protocolFacadeMode}`,
    `governed rollback export allowed: ${review.summary.governedRollbackExportAllowed}`,
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

function packageExportsNamedGovernanceOnly(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { exports?: Record<string, unknown> };
    const keys = Object.keys(parsed.exports ?? {}).sort();
    return keys.length === REQUIRED_PACKAGE_EXPORTS.length
      && REQUIRED_PACKAGE_EXPORTS.every((key) => keys.includes(key))
      && FORBIDDEN_PACKAGE_EXPORTS.every((key) => !keys.includes(key));
  } catch {
    return false;
  }
}

function fixtureLocked(text: string, required: readonly string[]): boolean {
  return required.every((marker) => text.includes(marker))
    && FORBIDDEN_PUBLIC_MARKERS.every((marker) => !text.includes(`"${marker}"`));
}

function createSummary(): PublicApiExecutionBoundaryAuditResult["summary"] {
  return {
    publicApiMode: "named_governance_subpaths_only",
    hostFacadeMode: "internal_not_exported",
    providerFacadeMode: "manifest_capability_security_spi_only",
    protocolFacadeMode: "kernel_governance_contracts_only",
    governedRollbackExportAllowed: true,
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
  };
}

function outputSanitized(input: PublicApiExecutionBoundaryAuditInput): boolean {
  const sample: PublicApiExecutionBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneCapabilityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      packageExportsNamedGovernanceOnly: true,
      protocolPublicSurfaceLocked: true,
      policyPublicSurfaceLocked: true,
      codexAdapterPublicSurfaceLocked: true,
      evidencePublicSurfaceLocked: true,
      providerPublicSurfaceLocked: true,
      providerFacadeIsManifestSpiOnly: true,
      protocolExcludesMcpA2a: true,
      negativeCoverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: createSummary(),
    reasons: []
  };
  const output = `${formatPublicApiExecutionBoundaryAuditResult(sample)}\n${formatPublicApiExecutionBoundaryAuditResult(sample, "json")}`;
  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => (
    !output.includes(marker)
    && !input.governanceControlPlaneText.includes(marker)
    && !input.governanceReadmeText.includes(marker)
  ));
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const review = reviewPublicApiExecutionBoundaryAudit(
    await collectPublicApiExecutionBoundaryAuditInput()
  );
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
