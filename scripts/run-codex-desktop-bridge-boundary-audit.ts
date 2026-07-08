#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const CODEX_DESKTOP_BINDINGS_SOURCE = "packages/codex-desktop-bindings/src/index.ts";
const DESKTOP_LIVE_ADAPTER_SOURCE = "packages/desktop-live-adapter/src/index.ts";
const CODEX_DESKTOP_BINDINGS_TEST = "tests/codex-desktop-bindings.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_BINDINGS_SOURCE_MARKERS = [
  "createCodexDesktopBindings",
  "createCodexDesktopBridge",
  "createToolStyleCodexDesktopRuntime",
  "CodexDesktopRuntime",
  "CodexDesktopToolRuntimeOperations",
  "CodexDesktopShellGovernancePolicy",
  "sendInputWithoutAgentMode",
  "runtime.spawnAgent(request)",
  "runtime.sendInput(request)",
  "runtime.waitAgent(directive)",
  "runtime.closeAgent({ target })",
  "runtime.shellCommand(normalizedRequest)",
  "runtime.applyPatch(patch)",
  "codex_desktop_shell_raw_command_disallowed",
  "codex_desktop_shell_structured_command_required",
  "codex_desktop_shell_true_disallowed",
  "codex_desktop_shell_executable_not_allowed",
  "codex_desktop_apply_patch_requires_patch",
  "hashPatch(patch)"
] as const;

const REQUIRED_LIVE_ADAPTER_BRIDGE_MARKERS = [
  "createPrimitiveHandlersFromBridge",
  "createHostBridgeFromBindings",
  "createRecordingHostBridge",
  "bridge.invokePrimitive",
  "missing_bridge_binding",
  "ALL_DESKTOP_PRIMITIVES"
] as const;

const REQUIRED_BINDINGS_TEST_MARKERS = [
  "codex desktop bindings spawn, wait, and close tracked agents through the runtime",
  "codex desktop bindings use explicit shell and patch directives for concrete runtime calls",
  "codex desktop bindings pass structured shell commands and redact shell secrets",
  "codex desktop bindings enforce governed shell command policy",
  "codex desktop bindings reject governed shell policy violations",
  "tool-style runtime forwards structured shell commands",
  "codex desktop bindings fail clearly when send_input has no agent target in strict mode",
  "codex desktop bridge wraps bindings into a DesktopHostBridge",
  "tool-style codex desktop runtime maps camelCase runtime requests into host tool shapes",
  "super-secret-token",
  "raw-secret-token",
  "Begin Patch"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "super-secret-token",
  "raw-secret-token",
  "Begin Patch",
  "stdout",
  "stderr"
] as const;

export interface CodexDesktopBridgeBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  codexDesktopBindingsSourceText: string;
  desktopLiveAdapterSourceText: string;
  codexDesktopBindingsTestText: string;
  governanceRunnerText: string;
}

export interface CodexDesktopBridgeBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneBoundaryRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    bindingsSourceGuardsPresent: boolean;
    liveAdapterBridgeHelpersPresent: boolean;
    bindingsRegressionCoverageRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    bridgeMode: "explicit_injected_desktop_host_bridge";
    runtimeToolInvocationAllowedByDefault: false;
    explicitInjectedRuntimeRequired: true;
    shellGovernancePolicySupported: true;
    rawShellAllowedByDefault: false;
    patchBodyStoredInResult: false;
    secretRedactionRequired: true;
    codexCliInvocationAllowed: false;
    providerInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    bridgeCallsDuringAudit: 0;
    runtimeToolCallsDuringAudit: 0;
    shellCallsDuringAudit: 0;
    applyPatchCallsDuringAudit: 0;
    spawnAgentCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type CodexDesktopBridgeBoundaryAuditOutputFormat = "text" | "json";

export async function collectCodexDesktopBridgeBoundaryAuditInput(
  cwd = process.cwd()
): Promise<CodexDesktopBridgeBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    codexDesktopBindingsSourceText,
    desktopLiveAdapterSourceText,
    codexDesktopBindingsTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, CODEX_DESKTOP_BINDINGS_SOURCE),
    read(cwd, DESKTOP_LIVE_ADAPTER_SOURCE),
    read(cwd, CODEX_DESKTOP_BINDINGS_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    codexDesktopBindingsSourceText,
    desktopLiveAdapterSourceText,
    codexDesktopBindingsTestText,
    governanceRunnerText
  };
}

export function reviewCodexDesktopBridgeBoundaryAudit(
  input: CodexDesktopBridgeBoundaryAuditInput
): CodexDesktopBridgeBoundaryAuditResult {
  const checks = {
    controlPlaneBoundaryRecorded: controlPlaneBoundaryRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit codex-desktop-bridge-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "codex-desktop-bridge-boundary"
    ),
    bindingsSourceGuardsPresent: REQUIRED_BINDINGS_SOURCE_MARKERS.every((marker) =>
      input.codexDesktopBindingsSourceText.includes(marker)
    ),
    liveAdapterBridgeHelpersPresent: REQUIRED_LIVE_ADAPTER_BRIDGE_MARKERS.every(
      (marker) => input.desktopLiveAdapterSourceText.includes(marker)
    ),
    bindingsRegressionCoverageRecorded: REQUIRED_BINDINGS_TEST_MARKERS.every(
      (marker) => input.codexDesktopBindingsTestText.includes(marker)
    ),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      bridgeMode: "explicit_injected_desktop_host_bridge",
      runtimeToolInvocationAllowedByDefault: false,
      explicitInjectedRuntimeRequired: true,
      shellGovernancePolicySupported: true,
      rawShellAllowedByDefault: false,
      patchBodyStoredInResult: false,
      secretRedactionRequired: true,
      codexCliInvocationAllowed: false,
      providerInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      bridgeCallsDuringAudit: 0,
      runtimeToolCallsDuringAudit: 0,
      shellCallsDuringAudit: 0,
      applyPatchCallsDuringAudit: 0,
      spawnAgentCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatCodexDesktopBridgeBoundaryAuditResult(
  review: CodexDesktopBridgeBoundaryAuditResult,
  format: CodexDesktopBridgeBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Codex desktop bridge boundary audit",
    `status: ${review.status}`,
    `bridge mode: ${review.summary.bridgeMode}`,
    `runtime tool invocation allowed by default: ${review.summary.runtimeToolInvocationAllowedByDefault}`,
    `explicit injected runtime required: ${review.summary.explicitInjectedRuntimeRequired}`,
    `shell governance policy supported: ${review.summary.shellGovernancePolicySupported}`,
    `raw shell allowed by default: ${review.summary.rawShellAllowedByDefault}`,
    `patch body stored in result: ${review.summary.patchBodyStoredInResult}`,
    `secret redaction required: ${review.summary.secretRedactionRequired}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `provider invocation allowed: ${review.summary.providerInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `bridge calls during audit: ${review.summary.bridgeCallsDuringAudit}`,
    `runtime tool calls during audit: ${review.summary.runtimeToolCallsDuringAudit}`,
    `shell calls during audit: ${review.summary.shellCallsDuringAudit}`,
    `apply patch calls during audit: ${review.summary.applyPatchCallsDuringAudit}`,
    `spawn agent calls during audit: ${review.summary.spawnAgentCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneBoundaryRecorded(text: string): boolean {
  return text.includes("| Codex desktop bridge boundary |")
    && text.includes("explicit injected desktop host bridge")
    && text.includes("runtime tool invocation is not default-authorized")
    && text.includes("shell governance and patch hashing")
    && text.includes("General provider execution | blocked | No");
}

function noBroadExecutionAuthorization(
  input: CodexDesktopBridgeBoundaryAuditInput
): boolean {
  const combined = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.codexDesktopBindingsSourceText,
    input.desktopLiveAdapterSourceText
  ].join("\n");

  return combined.includes("General provider execution | blocked | No")
    && combined.includes("General workspace write | blocked | No")
    && !/Codex desktop bridge boundary\s*\|\s*active\s*\|\s*Yes/i.test(combined)
    && !/runtime tool invocation allowed by default:\s*true/i.test(combined)
    && !/sub-agent runtime invocation allowed:\s*true/i.test(combined)
    && !/host executor invocation allowed:\s*true/i.test(combined);
}

function outputSanitized(): boolean {
  const review: CodexDesktopBridgeBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneBoundaryRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      bindingsSourceGuardsPresent: true,
      liveAdapterBridgeHelpersPresent: true,
      bindingsRegressionCoverageRecorded: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      bridgeMode: "explicit_injected_desktop_host_bridge",
      runtimeToolInvocationAllowedByDefault: false,
      explicitInjectedRuntimeRequired: true,
      shellGovernancePolicySupported: true,
      rawShellAllowedByDefault: false,
      patchBodyStoredInResult: false,
      secretRedactionRequired: true,
      codexCliInvocationAllowed: false,
      providerInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      bridgeCallsDuringAudit: 0,
      runtimeToolCallsDuringAudit: 0,
      shellCallsDuringAudit: 0,
      applyPatchCallsDuringAudit: 0,
      spawnAgentCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatCodexDesktopBridgeBoundaryAuditResult(review);
  const json = formatCodexDesktopBridgeBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: CodexDesktopBridgeBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `codex_desktop_bridge_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectCodexDesktopBridgeBoundaryAuditInput();
  const review = reviewCodexDesktopBridgeBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatCodexDesktopBridgeBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Codex desktop bridge boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
