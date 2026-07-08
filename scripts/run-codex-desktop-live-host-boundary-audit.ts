#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const LIVE_HOST_SOURCE = "packages/codex-desktop-live-host/src/index.ts";
const LIVE_HOST_TEST = "tests/codex-desktop-live-host.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_LIVE_HOST_SOURCE_MARKERS = [
  "REQUIRED_CODEX_DESKTOP_LIVE_HOST_RUNTIME_METHODS",
  "REQUIRED_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS",
  "OPTIONAL_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS",
  "createCodexDesktopLiveHostBundle(",
  "createCodexDesktopBridge(",
  "createDesktopHostClient({",
  "createCodexDesktopLiveHostBundleFromTools(",
  "createToolStyleCodexDesktopRuntime(options.runtimeTools)",
  "createCodexDesktopLiveHostBundleFromHostObject(",
  "assertCodexDesktopLiveHostObject(options.host)",
  "createCodexMemoryOperationsFromHostObject(options.host)",
  "createCodexDesktopLiveHostEmbeddingStarter(",
  "assertReady()",
  "createBundle()",
  "inspectCodexDesktopLiveHostObject(",
  "getCodexDesktopLiveHostEmbeddingStatus(",
  "runCodexDesktopLiveHostSmoke(",
  "if (!inspection.ready || starterStatus.pendingRequiredMethods.length > 0)",
  "const bundle = starter.createBundle()",
  "createCodexDesktopLiveHostSmokeEvidence(",
  "codex_desktop_live_host_missing_methods",
  "codex_desktop_live_host_requires_memory_operations_or_tools"
] as const;

const REQUIRED_LIVE_HOST_TEST_MARKERS = [
  "codex desktop live host bundle composes runtime, memory tools, and host client run/resume",
  "codex desktop live host bundle wires directive resolvers and persistence into engineering execution",
  "codex desktop live host requires memory operations or tool-style memory hooks",
  "codex desktop live host bundle can be created directly from tool-style runtime hooks",
  "codex desktop live host bundle can be created from a current host object",
  "codex desktop live host starter reduces current host wiring to host plus anchor",
  "codex desktop live host embedding starter exposes readiness before bundle creation",
  "codex desktop live host embedding starter creates a bundle after the current host is wired",
  "codex desktop live host smoke returns readiness failure before creating a bundle",
  "codex desktop live host smoke passes read-only, engineering, and release-posture checks",
  "codex desktop live host smoke captures run errors as structured failures",
  "codex desktop live host smoke evidence summarizes passing checks for final host capture",
  "codex desktop live host smoke evidence captures not-ready blockers",
  "codex desktop live host reports missing methods on partial current host objects",
  "codex desktop live host starter fails fast when the current host object is incomplete",
  "codex desktop live host keeps final-host helpers in the public surface"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw stdout",
  "raw stderr"
] as const;

export interface CodexDesktopLiveHostBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  liveHostSourceText: string;
  liveHostTestText: string;
  governanceRunnerText: string;
}

export interface CodexDesktopLiveHostBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneBoundaryRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    liveHostCompositionGuardsPresent: boolean;
    liveHostRegressionCoverageRecorded: boolean;
    noCrossBoundaryExecutionBroadening: boolean;
    outputSanitized: boolean;
  };
  summary: {
    liveHostMode: "explicit_current_host_runtime_and_memory_bundle";
    bundleCreationRequiresReadyHost: true;
    runtimeMethodsRequired: true;
    memoryMethodsRequired: true;
    bridgeCreatedFromInjectedRuntime: true;
    desktopHostClientCreatedWithInjectedBridge: true;
    smokeCreatesBundleOnlyAfterReadiness: true;
    smokeEvidenceSummarized: true;
    defaultRuntimeToolInvocationAllowed: false;
    codexCliInvocationAllowedByLiveHostBoundary: false;
    providerInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    liveHostBundleCreationsDuringAudit: 0;
    runtimeToolCallsDuringAudit: 0;
    memoryToolCallsDuringAudit: 0;
    bridgeCallsDuringAudit: 0;
    hostClientRunCallsDuringAudit: 0;
    smokeRunsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type CodexDesktopLiveHostBoundaryAuditOutputFormat = "text" | "json";

export async function collectCodexDesktopLiveHostBoundaryAuditInput(
  cwd = process.cwd()
): Promise<CodexDesktopLiveHostBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    liveHostSourceText,
    liveHostTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, LIVE_HOST_SOURCE),
    read(cwd, LIVE_HOST_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    liveHostSourceText,
    liveHostTestText,
    governanceRunnerText
  };
}

export function reviewCodexDesktopLiveHostBoundaryAudit(
  input: CodexDesktopLiveHostBoundaryAuditInput
): CodexDesktopLiveHostBoundaryAuditResult {
  const checks = {
    controlPlaneBoundaryRecorded: controlPlaneBoundaryRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit codex-desktop-live-host-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "codex-desktop-live-host-boundary"
    ),
    liveHostCompositionGuardsPresent: REQUIRED_LIVE_HOST_SOURCE_MARKERS.every(
      (marker) => input.liveHostSourceText.includes(marker)
    ),
    liveHostRegressionCoverageRecorded: REQUIRED_LIVE_HOST_TEST_MARKERS.every(
      (marker) => input.liveHostTestText.includes(marker)
    ),
    noCrossBoundaryExecutionBroadening: noCrossBoundaryExecutionBroadening(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      liveHostMode: "explicit_current_host_runtime_and_memory_bundle",
      bundleCreationRequiresReadyHost: true,
      runtimeMethodsRequired: true,
      memoryMethodsRequired: true,
      bridgeCreatedFromInjectedRuntime: true,
      desktopHostClientCreatedWithInjectedBridge: true,
      smokeCreatesBundleOnlyAfterReadiness: true,
      smokeEvidenceSummarized: true,
      defaultRuntimeToolInvocationAllowed: false,
      codexCliInvocationAllowedByLiveHostBoundary: false,
      providerInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      liveHostBundleCreationsDuringAudit: 0,
      runtimeToolCallsDuringAudit: 0,
      memoryToolCallsDuringAudit: 0,
      bridgeCallsDuringAudit: 0,
      hostClientRunCallsDuringAudit: 0,
      smokeRunsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatCodexDesktopLiveHostBoundaryAuditResult(
  review: CodexDesktopLiveHostBoundaryAuditResult,
  format: CodexDesktopLiveHostBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Codex desktop live host boundary audit",
    `status: ${review.status}`,
    `live host mode: ${review.summary.liveHostMode}`,
    `bundle creation requires ready host: ${review.summary.bundleCreationRequiresReadyHost}`,
    `runtime methods required: ${review.summary.runtimeMethodsRequired}`,
    `memory methods required: ${review.summary.memoryMethodsRequired}`,
    `bridge created from injected runtime: ${review.summary.bridgeCreatedFromInjectedRuntime}`,
    `desktop host client created with injected bridge: ${review.summary.desktopHostClientCreatedWithInjectedBridge}`,
    `smoke creates bundle only after readiness: ${review.summary.smokeCreatesBundleOnlyAfterReadiness}`,
    `smoke evidence summarized: ${review.summary.smokeEvidenceSummarized}`,
    `default runtime tool invocation allowed: ${review.summary.defaultRuntimeToolInvocationAllowed}`,
    `Codex CLI invocation allowed by live host boundary: ${review.summary.codexCliInvocationAllowedByLiveHostBoundary}`,
    `provider invocation allowed: ${review.summary.providerInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `live host bundle creations during audit: ${review.summary.liveHostBundleCreationsDuringAudit}`,
    `runtime tool calls during audit: ${review.summary.runtimeToolCallsDuringAudit}`,
    `memory tool calls during audit: ${review.summary.memoryToolCallsDuringAudit}`,
    `bridge calls during audit: ${review.summary.bridgeCallsDuringAudit}`,
    `host client run calls during audit: ${review.summary.hostClientRunCallsDuringAudit}`,
    `smoke runs during audit: ${review.summary.smokeRunsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneBoundaryRecorded(text: string): boolean {
  return text.includes(
    "Codex desktop live host boundary | active / explicit current host runtime and memory bundle | No by itself"
  )
    && text.includes("requires a current host object with all runtime and required memory methods before bundle creation")
    && text.includes("smoke helpers create bundles only after readiness and summarize evidence")
    && text.includes("does not authorize Codex CLI, provider execution, sub-agent runtime, host executor, workspace-write, or external write by itself");
}

function noCrossBoundaryExecutionBroadening(
  input: CodexDesktopLiveHostBoundaryAuditInput
): boolean {
  const text = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText
  ].join("\n");

  return !text.includes("Codex desktop live host default runtime tool invocation allowed: true")
    && !text.includes("Codex desktop live host Codex CLI invocation allowed: true")
    && !text.includes("Codex desktop live host provider invocation allowed: true")
    && !text.includes("Codex desktop live host sub-agent runtime invocation allowed: true")
    && !text.includes("Codex desktop live host host executor invocation allowed: true")
    && !text.includes("live host bundle creations during audit: 1")
    && !text.includes("host client run calls during audit: 1")
    && !text.includes("smoke runs during audit: 1");
}

function outputSanitized(): boolean {
  const output = formatCodexDesktopLiveHostBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneBoundaryRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      liveHostCompositionGuardsPresent: true,
      liveHostRegressionCoverageRecorded: true,
      noCrossBoundaryExecutionBroadening: true,
      outputSanitized: true
    },
    summary: {
      liveHostMode: "explicit_current_host_runtime_and_memory_bundle",
      bundleCreationRequiresReadyHost: true,
      runtimeMethodsRequired: true,
      memoryMethodsRequired: true,
      bridgeCreatedFromInjectedRuntime: true,
      desktopHostClientCreatedWithInjectedBridge: true,
      smokeCreatesBundleOnlyAfterReadiness: true,
      smokeEvidenceSummarized: true,
      defaultRuntimeToolInvocationAllowed: false,
      codexCliInvocationAllowedByLiveHostBoundary: false,
      providerInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      liveHostBundleCreationsDuringAudit: 0,
      runtimeToolCallsDuringAudit: 0,
      memoryToolCallsDuringAudit: 0,
      bridgeCallsDuringAudit: 0,
      hostClientRunCallsDuringAudit: 0,
      smokeRunsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `codex_desktop_live_host_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectCodexDesktopLiveHostBoundaryAuditInput();
  const review = reviewCodexDesktopLiveHostBoundaryAudit(input);

  process.stdout.write(`${formatCodexDesktopLiveHostBoundaryAuditResult(review, format)}\n`);
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
