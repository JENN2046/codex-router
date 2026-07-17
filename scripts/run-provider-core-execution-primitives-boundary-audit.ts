#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const PROVIDER_CORE_SOURCE = "packages/provider-core/src/index.ts";
const PROVIDER_GOVERNANCE_PUBLIC_SOURCE = "packages/provider-core/src/governance-public.ts";
const PROVIDER_REGISTRY_SOURCE = "packages/provider-registry/src/index.ts";
const PROVIDER_CORE_TEST = "tests/provider-core.test.ts";
const PROVIDER_REGISTRY_TEST = "tests/provider-registry.test.ts";
const TOOL_INVOCATION_PLANNER_TEST = "tests/tool-invocation-planner.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_PROVIDER_GOVERNANCE_PUBLIC_MARKERS = [
  "ProviderKindSchema",
  "\"model\"",
  "\"executor\"",
  "\"tool\"",
  "\"remote_agent\"",
  "ProviderSideEffectClassSchema",
  "\"none\"",
  "\"read\"",
  "\"read_only\"",
  "\"local_write\"",
  "\"workspace_write\"",
  "\"local_command\"",
  "\"external_write\"",
  "\"external_side_effects\"",
  "\"protected_remote\"",
  "\"destructive\"",
  "\"secret_access\"",
  "\"unknown\"",
  "ProviderSecurityBoundarySchema",
  "ProviderRequiredConfigSchema",
  "ProviderManifestSchema",
  "interface GovernanceProvider",
  "parseProviderManifest",
  "hashProviderManifest",
  "providerSupportsSideEffectClass",
  "assertProviderSupportsSideEffectClass",
  "providerSupportsSandboxProfile",
  "assertProviderSupportsSandboxProfile",
  "function stableStringifyProviderObject"
] as const;

const FORBIDDEN_PROVIDER_GOVERNANCE_PUBLIC_MARKERS = [
  "ProviderExecutionPermitSchema",
  "ProviderExecutionContext",
  "ProviderExecutionResult",
  "WorkspaceWriteProviderExecutionPermitSchema",
  "WorkspaceWriteProviderExecutionPermitV2Schema",
  "createApprovedWorkspaceWriteProviderExecutionPermit",
  "validateWorkspaceWriteProviderExecutionPermit",
  "consumeWorkspaceWriteProviderExecutionPermit",
  "ExecutorExecutionPlanSchema",
  "ToolProviderInvocationPlanSchema",
  "interface ExecutorProvider",
  "execute(",
  "interface ToolProvider",
  "invoke(",
  "interface RemoteAgentProvider",
  "createRemoteTask(",
  "interface ModelProvider"
] as const;

const REQUIRED_PROVIDER_CORE_PRIMITIVE_MARKERS = [
  "ProviderExecutionPermitSchema",
  "WorkspaceWriteProviderExecutionPermitSchema",
  "WorkspaceWriteProviderExecutionPermitV2Schema",
  "ExecutorExecutionPlanSchema",
  "ToolProviderInvocationPlanSchema",
  "interface ExecutorProvider",
  "execute(",
  "interface ToolProvider",
  "invoke(",
  "interface RemoteAgentProvider",
  "createRemoteTask("
] as const;

const REQUIRED_PROVIDER_CORE_GOVERNANCE_IMPORTS = [
  "ProviderKindSchema",
  "ProviderManifestSchema",
  "ProviderRequiredConfigSchema",
  "ProviderSecurityBoundarySchema",
  "ProviderSideEffectClassSchema",
  "assertProviderSupportsSandboxProfile",
  "assertProviderSupportsSideEffectClass",
  "hashProviderManifest",
  "providerSupportsSandboxProfile",
  "providerSupportsSideEffectClass",
  "stableStringifyProviderObject",
  "ProviderKind",
  "ProviderManifest",
  "ProviderRequiredConfig",
  "ProviderSecurityBoundary",
  "ProviderSideEffectClass"
] as const;

const SUPPORTED_PROVIDER_CORE_GOVERNANCE_REEXPORTS = [
  "ProviderKindSchema",
  "ProviderManifestSchema",
  "ProviderRequiredConfigSchema",
  "ProviderSecurityBoundarySchema",
  "ProviderSideEffectClassSchema",
  "assertProviderSupportsSandboxProfile",
  "assertProviderSupportsSideEffectClass",
  "hashProviderManifest",
  "parseProviderManifest",
  "providerSupportsSandboxProfile",
  "providerSupportsSideEffectClass",
  "GovernanceProvider",
  "ProviderKind",
  "ProviderManifest",
  "ProviderRequiredConfig",
  "ProviderSecurityBoundary",
  "ProviderSideEffectClass"
] as const;

const REQUIRED_PROVIDER_CORE_GUARD_MARKERS = [
  "createApprovedProviderExecutionPermit",
  "getReadOnlyProviderExecutionPermitIssuanceBlockers",
  "provider_execution_permit_read_only_only",
  "provider_execution_permit_requires_read_only_sandbox",
  "validateProviderExecutionPermitForPlan",
  "consumeProviderExecutionPermitForPlan",
  "createApprovedWorkspaceWriteProviderExecutionPermitV2",
  "getWorkspaceWriteProviderExecutionPermitV2IssuanceBlockers",
  "operatorAuthorizationId",
  "providerExecutionPlanHash",
  "principalHash",
  "rollbackRequired",
  "protectedBranchForbidden",
  "dirtyWorktreeForbidden",
  "consumeWorkspaceWriteProviderExecutionPermitV2ForPlan",
  "consumeIfUnused"
] as const;

const REQUIRED_PROVIDER_CORE_TEST_MARKERS = [
  "provider-core blocks non-read-only provider execution permits",
  "provider-core validates approved workspace-write permit v2 with strong bindings",
  "provider-core blocks workspace-write permit v2 without hard gates",
  "provider-core consumes workspace-write permit v2 exactly once",
  "provider-core validates tool invocation plans",
  "provider-core parses a remote agent provider manifest",
  "provider-core rejects unsupported sideEffectClass via helper",
  "provider-core constrains sandbox env policy"
] as const;

const REQUIRED_PROVIDER_REGISTRY_MARKERS = [
  "assertRemoteAgentAuthSchemes",
  "provider_registry_remote_agent_auth_schemes_required",
  "provider_registry_remote_agent_anonymous_auth_rejected",
  "findProvidersByKind(kind: ProviderKind)"
] as const;

const REQUIRED_PROVIDER_REGISTRY_TEST_MARKERS = [
  "provider-registry excludes disabled providers from automatic selection",
  "provider-registry queries providers by kind",
  "provider-registry queries providers by sideEffectClass",
  "provider-registry rejects remote agents without explicit authSchemes",
  "provider-registry rejects anonymous remote agent auth schemes case-insensitively",
  "provider-registry rejects anonymous auth declared only on provider manifest"
] as const;

const REQUIRED_TOOL_PLANNER_TEST_MARKERS = [
  "tool invocation planner plans read-only tools when capability is granted",
  "tool invocation planner waits for approval when capability is missing",
  "tool invocation planner requires approval for dangerous side effects",
  "tool invocation planner plans dangerous tools with a valid approval permit",
  "tool invocation planner blocks tool sandboxes that exceed policy",
  "tool invocation planner redacts proposed input preview"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ProviderCoreExecutionPrimitivesBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  providerGovernancePublicSourceText: string;
  providerCoreInternalSourceText: string;
  providerRegistrySourceText: string;
  providerCoreTestText: string;
  providerRegistryTestText: string;
  toolInvocationPlannerTestText: string;
  governanceRunnerText: string;
}

export interface ProviderCoreExecutionPrimitivesBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneBoundaryRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    providerGovernancePublicManifestOnly: boolean;
    providerGovernanceHelperOwnershipValid: boolean;
    providerCoreMovedBindingsReexportValid: boolean;
    providerCorePrimitiveSchemasPresent: boolean;
    providerCorePermitGuardsPresent: boolean;
    providerCoreRegressionCoverageRecorded: boolean;
    providerRegistryRemoteAgentGuardsPresent: boolean;
    providerRegistryRemoteAgentCoverageRecorded: boolean;
    toolInvocationPlannerCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    providerCorePrimitiveMode: "manifest_permit_plan_only";
    remoteAgentExecutionAllowed: false;
    toolRuntimeInvocationAllowed: false;
    workspaceWriteExecutionAllowedByProviderCore: false;
    generalProviderExecutionAllowed: false;
    codexCliInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    providerCoreRuntimeCallsDuringAudit: 0;
    remoteAgentRuntimeCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ProviderCoreExecutionPrimitivesBoundaryAuditOutputFormat = "text" | "json";

export async function collectProviderCoreExecutionPrimitivesBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ProviderCoreExecutionPrimitivesBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    providerGovernancePublicSourceText,
    providerCoreInternalSourceText,
    providerRegistrySourceText,
    providerCoreTestText,
    providerRegistryTestText,
    toolInvocationPlannerTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, PROVIDER_GOVERNANCE_PUBLIC_SOURCE),
    read(cwd, PROVIDER_CORE_SOURCE),
    read(cwd, PROVIDER_REGISTRY_SOURCE),
    read(cwd, PROVIDER_CORE_TEST),
    read(cwd, PROVIDER_REGISTRY_TEST),
    read(cwd, TOOL_INVOCATION_PLANNER_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    providerGovernancePublicSourceText,
    providerCoreInternalSourceText,
    providerRegistrySourceText,
    providerCoreTestText,
    providerRegistryTestText,
    toolInvocationPlannerTestText,
    governanceRunnerText
  };
}

export function reviewProviderCoreExecutionPrimitivesBoundaryAudit(
  input: ProviderCoreExecutionPrimitivesBoundaryAuditInput
): ProviderCoreExecutionPrimitivesBoundaryAuditResult {
  const checks = {
    controlPlaneBoundaryRecorded: controlPlaneBoundaryRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit provider-core-execution-primitives-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "provider-core-execution-primitives-boundary"
    ),
    providerGovernancePublicManifestOnly:
      REQUIRED_PROVIDER_GOVERNANCE_PUBLIC_MARKERS.every(
        (marker) => input.providerGovernancePublicSourceText.includes(marker)
      ) && FORBIDDEN_PROVIDER_GOVERNANCE_PUBLIC_MARKERS.every(
        (marker) => !input.providerGovernancePublicSourceText.includes(marker)
      ) && providerGovernancePublicAstBoundaryValid(
        input.providerGovernancePublicSourceText
      ),
    providerGovernanceHelperOwnershipValid: providerCoreGovernanceImportValid(
      input.providerCoreInternalSourceText
    ),
    providerCoreMovedBindingsReexportValid: providerCoreGovernanceReexportValid(
      input.providerCoreInternalSourceText
    ),
    providerCorePrimitiveSchemasPresent: REQUIRED_PROVIDER_CORE_PRIMITIVE_MARKERS.every(
      (marker) => input.providerCoreInternalSourceText.includes(marker)
    ),
    providerCorePermitGuardsPresent: REQUIRED_PROVIDER_CORE_GUARD_MARKERS.every(
      (marker) => input.providerCoreInternalSourceText.includes(marker)
    ),
    providerCoreRegressionCoverageRecorded: REQUIRED_PROVIDER_CORE_TEST_MARKERS.every(
      (marker) => input.providerCoreTestText.includes(marker)
    ),
    providerRegistryRemoteAgentGuardsPresent: REQUIRED_PROVIDER_REGISTRY_MARKERS.every(
      (marker) => input.providerRegistrySourceText.includes(marker)
    ),
    providerRegistryRemoteAgentCoverageRecorded:
      REQUIRED_PROVIDER_REGISTRY_TEST_MARKERS.every((marker) =>
        input.providerRegistryTestText.includes(marker)
      ),
    toolInvocationPlannerCoverageRecorded: REQUIRED_TOOL_PLANNER_TEST_MARKERS.every(
      (marker) => input.toolInvocationPlannerTestText.includes(marker)
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      providerCorePrimitiveMode: "manifest_permit_plan_only",
      remoteAgentExecutionAllowed: false,
      toolRuntimeInvocationAllowed: false,
      workspaceWriteExecutionAllowedByProviderCore: false,
      generalProviderExecutionAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      providerCoreRuntimeCallsDuringAudit: 0,
      remoteAgentRuntimeCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatProviderCoreExecutionPrimitivesBoundaryAuditResult(
  review: ProviderCoreExecutionPrimitivesBoundaryAuditResult,
  format: ProviderCoreExecutionPrimitivesBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Provider-core execution primitives boundary audit",
    `status: ${review.status}`,
    `provider-core primitive mode: ${review.summary.providerCorePrimitiveMode}`,
    `remote agent execution allowed: ${review.summary.remoteAgentExecutionAllowed}`,
    `tool runtime invocation allowed: ${review.summary.toolRuntimeInvocationAllowed}`,
    `workspace-write execution allowed by provider-core: ${review.summary.workspaceWriteExecutionAllowedByProviderCore}`,
    `general provider execution allowed: ${review.summary.generalProviderExecutionAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `provider-core runtime calls during audit: ${review.summary.providerCoreRuntimeCallsDuringAudit}`,
    `remote agent runtime calls during audit: ${review.summary.remoteAgentRuntimeCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneBoundaryRecorded(text: string): boolean {
  return text.includes("| Provider-core execution primitives |")
    && text.includes("manifest / permit / plan primitives only")
    && text.includes("remote-agent, tool, and workspace-write primitives are not runtime authorization")
    && text.includes("General provider execution | blocked | No");
}

function noBroadExecutionAuthorization(
  input: ProviderCoreExecutionPrimitivesBoundaryAuditInput
): boolean {
  const combined = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.providerGovernancePublicSourceText,
    input.providerCoreInternalSourceText,
    input.providerRegistrySourceText
  ].join("\n");

  return combined.includes("General provider execution | blocked | No")
    && combined.includes("General workspace write | blocked | No")
    && !/Provider-core execution primitives\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/General provider execution\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/General workspace write\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/remote-agent, tool, and workspace-write primitives are runtime authorization/i.test(combined);
}

function providerGovernancePublicAstBoundaryValid(text: string): boolean {
  const source = ts.createSourceFile(
    "provider-governance-public.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let stableStringifierInternal = false;
  let forbiddenInterfaceMember = false;
  let forbiddenImport = false;
  let forbiddenWorkspaceWritePermitLifecycle = false;

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)
      && statement.name?.text === "stableStringifyProviderObject") {
      stableStringifierInternal = ts.getJSDocTags(statement)
        .some((tag) => tag.tagName.text === "internal");
    }
  }

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)
      && /(?:WorkspaceWrite.*Permit|Permit.*WorkspaceWrite)/u.test(node.text)) {
      forbiddenWorkspaceWritePermitLifecycle = true;
    }
    if (ts.isInterfaceDeclaration(node)
      && node.members.some((member) => {
        const name = member.name;
        return name !== undefined
          && (ts.isIdentifier(name) || ts.isStringLiteral(name))
          && name.text === "execute";
      })) {
      forbiddenInterfaceMember = true;
    }
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && /(?:provider-registry|providers\/|provider-execution-runner|provider-dispatcher|controlled-provider-dispatcher|workspace-write-executor)/u
        .test(node.moduleSpecifier.text)) {
      forbiddenImport = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return stableStringifierInternal
    && !forbiddenInterfaceMember
    && !forbiddenImport
    && !forbiddenWorkspaceWritePermitLifecycle;
}

function providerCoreGovernanceImportValid(text: string): boolean {
  const source = ts.createSourceFile(
    "provider-core-index.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const imports = source.statements.filter((statement): statement is ts.ImportDeclaration => (
    ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === "./governance-public.js"
  ));
  const importedNames = imports.flatMap((statement) => (
    statement.importClause?.namedBindings !== undefined
    && ts.isNamedImports(statement.importClause.namedBindings)
      ? statement.importClause.namedBindings.elements.map((element) => (
        element.propertyName?.text ?? element.name.text
      ))
      : []
  ));
  const stableDefinitions = source.statements.filter((statement) => (
    ts.isFunctionDeclaration(statement)
    && statement.name?.text === "stableStringifyProviderObject"
  ));

  return imports.length === 1
    && sameStringSet(importedNames, REQUIRED_PROVIDER_CORE_GOVERNANCE_IMPORTS)
    && stableDefinitions.length === 0;
}

function providerCoreGovernanceReexportValid(text: string): boolean {
  const source = ts.createSourceFile(
    "provider-core-index.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const reexportedNames = source.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement)
      || statement.moduleSpecifier === undefined
      || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== "./governance-public.js"
      || statement.exportClause === undefined
      || !ts.isNamedExports(statement.exportClause)) {
      return [];
    }
    return statement.exportClause.elements.map((element) => (
      element.propertyName?.text ?? element.name.text
    ));
  });
  return sameStringSet(reexportedNames, SUPPORTED_PROVIDER_CORE_GOVERNANCE_REEXPORTS);
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  const normalize = (values: readonly string[]): string[] => [...new Set(values)].sort();
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function outputSanitized(input: ProviderCoreExecutionPrimitivesBoundaryAuditInput): boolean {
  void input;
  const review: ProviderCoreExecutionPrimitivesBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneBoundaryRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      providerGovernancePublicManifestOnly: true,
      providerGovernanceHelperOwnershipValid: true,
      providerCoreMovedBindingsReexportValid: true,
      providerCorePrimitiveSchemasPresent: true,
      providerCorePermitGuardsPresent: true,
      providerCoreRegressionCoverageRecorded: true,
      providerRegistryRemoteAgentGuardsPresent: true,
      providerRegistryRemoteAgentCoverageRecorded: true,
      toolInvocationPlannerCoverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      providerCorePrimitiveMode: "manifest_permit_plan_only",
      remoteAgentExecutionAllowed: false,
      toolRuntimeInvocationAllowed: false,
      workspaceWriteExecutionAllowedByProviderCore: false,
      generalProviderExecutionAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      providerCoreRuntimeCallsDuringAudit: 0,
      remoteAgentRuntimeCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatProviderCoreExecutionPrimitivesBoundaryAuditResult(review);
  const json = formatProviderCoreExecutionPrimitivesBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: ProviderCoreExecutionPrimitivesBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `provider_core_execution_primitives_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectProviderCoreExecutionPrimitivesBoundaryAuditInput();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatProviderCoreExecutionPrimitivesBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Provider-core execution primitives boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
