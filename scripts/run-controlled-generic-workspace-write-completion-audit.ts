#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const WORKSPACE_WRITE_EXECUTOR =
  "packages/governance-internal-workspace-write-executor/src/index.ts";
const WORKSPACE_WRITE_EXECUTOR_TEST = "tests/workspace-write-executor.test.ts";
const PROVIDER_EXECUTION_RUNNER =
  "packages/governance-internal-provider-execution-runner/src/index.ts";
const PROVIDER_EXECUTION_RUNNER_TEST = "tests/provider-execution-runner.test.ts";
const CONTROLLED_PROVIDER_DISPATCHER =
  "packages/governance-internal-controlled-provider-dispatcher/src/index.ts";
const CONTROLLED_PROVIDER_DISPATCHER_TEST =
  "tests/controlled-provider-dispatcher.test.ts";
const HOST_DISPATCHER = "packages/host-dispatcher/src/index.ts";
const HOST_DISPATCHER_TEST = "tests/host-dispatcher.test.ts";
const DESKTOP_LIVE_ADAPTER = "packages/desktop-live-adapter/src/index.ts";
const DESKTOP_LIVE_ADAPTER_TEST = "tests/desktop-live-adapter.test.ts";
const AGENT_OS_LOCAL_RUNTIME = "packages/protocol-mcp/src/agent-os-local-runtime.ts";
const AGENT_OS_MCP_LOCAL_RUNTIME_TEST = "tests/agent-os-mcp-local-runtime.test.ts";
const AGENT_OS_SDK = "packages/agent-os-sdk/src/index.ts";
const AGENT_OS_SDK_TEST = "tests/agent-os-sdk.test.ts";
const AGENT_OS_CLI = "packages/agent-os-cli/src/index.ts";
const AGENT_OS_CLI_TEST = "tests/agent-os-cli.test.ts";
const AGENT_OS_APP_SERVER_TEST = "tests/agent-os-app-server.test.ts";
const ACCEPTANCE_SCRIPT =
  "scripts/run-controlled-generic-workspace-write-acceptance.ts";
const ACCEPTANCE_TEST = "tests/controlled-generic-workspace-write-acceptance.test.ts";
const ACCEPTANCE_EVIDENCE =
  "docs/evidence/controlled-generic-workspace-write-acceptance.json";
const RELEASE_GATE_DOC = "docs/governance/WORKSPACE_WRITE_RELEASE_GATE.md";
const RELEASE_GATE_AUDIT = "scripts/run-workspace-write-release-gate-audit.ts";
const RELEASE_GATE_TEST = "tests/workspace-write-release-gate-audit.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";

const REQUIRED_EXECUTOR_MARKERS = [
  "export type WorkspaceWriteOperation",
  "runWorkspaceWriteExecution",
  "operationTargetsDeclared",
  "operationTargetsSafe",
  "preExecutionPatchGuardPassed",
  "postExecutionPatchGuardPassed",
  "rollbackVerified",
  "noProviderExecute",
  "noRealCodexCli",
  "noRemoteWrite"
] as const;

const REQUIRED_EXECUTOR_TEST_MARKERS = [
  "workspace-write executor preflights generic multi-file writes without mutating",
  "workspace-write executor executes multi-file writes and verifies rollback",
  "workspace-write executor supports update and delete operations with rollback",
  "workspace-write executor blocks undeclared targets before writing",
  "workspace-write executor consumes permit once and blocks replay"
] as const;

const REQUIRED_RUNNER_MARKERS = [
  "export async function runProviderExecutionPlanControlledWorkspaceWrite",
  "runWorkspaceWriteExecution",
  "controlled_workspace_write_succeeded",
  "providerExecuteInvoked: false",
  "workspaceWriteEvidence"
] as const;

const REQUIRED_RUNNER_TEST_MARKERS = [
  "provider execution runner executes controlled workspace-write operations through local executor only",
  "provider execution runner blocks non workspace-write plans before local write execution",
  "provider execution runner reports workspace-write executor failures without provider execute",
  "providerExecuteInvoked, false",
  "workspaceWriteEvidence?.checks.rollbackVerified"
] as const;

const REQUIRED_DISPATCHER_MARKERS = [
  "prepared-controlled-workspace-write-provider-dispatch.v1",
  "prepareControlledWorkspaceWriteProviderDispatchInput",
  "dispatchControlledWorkspaceWriteProviderExecution",
  "recordControlledWorkspaceWriteProviderDispatchPreflightArtifact",
  "runProviderExecutionPlanControlledWorkspaceWrite"
] as const;

const REQUIRED_DISPATCHER_TEST_MARKERS = [
  "controlled provider dispatcher routes workspace-write through local runner without provider execute",
  "controlled provider dispatcher prepares workspace-write dispatch input with preflight artifact",
  "controlled provider dispatcher requires workspace-write preflight artifact before runner",
  "controlled provider dispatcher binds workspace-write operation manifest before runner",
  "workspace_write_provider_execute_should_not_be_called"
] as const;

const REQUIRED_HOST_DESKTOP_MARKERS = [
  "prepareControlledWorkspaceWriteHostProviderDispatch",
  "host dispatcher routes controlled workspace-write through local runner",
  "host dispatcher prepares controlled workspace-write dispatch input",
  "runDesktopTask routes controlled workspace-write dispatch before Codex CLI spawn",
  "controlled workspace-write dispatch completed routed execution"
] as const;

const REQUIRED_AGENT_OS_MARKERS = [
  "prepareControlledWorkspaceWriteHostProviderDispatch",
  "dispatchWorkspaceWrite",
  "--prepare-json",
  "Agent OS SDK prepares workspace-write dispatch through typed input",
  "Agent OS CLI wrapper prepares controlled workspace-write dispatch asynchronously",
  "Agent OS App Server wrapper prepares controlled workspace-write dispatch asynchronously without network"
] as const;

const REQUIRED_ACCEPTANCE_MARKERS = [
  "controlled-generic-workspace-write-acceptance.v1",
  "controlled-generic-workspace-write-local-runner",
  "preflightReadyWithoutMutation",
  "executeSucceeded",
  "createUpdateDeleteCovered",
  "permitConsumedOnce",
  "replayBlocked",
  "rollbackVerified",
  "noProviderExecute",
  "noRealCodexCli",
  "noExternalWrite",
  "evidenceSanitized"
] as const;

const REQUIRED_ACCEPTANCE_TEST_MARKERS = [
  "controlled generic workspace-write acceptance covers local runner execution",
  "controlled generic workspace-write acceptance check mode does not write evidence",
  "controlled generic workspace-write acceptance writer persists safe json"
] as const;

const REQUIRED_ACCEPTANCE_EVIDENCE_MARKERS = [
  "\"schemaVersion\": \"controlled-generic-workspace-write-acceptance.v1\"",
  "\"preflightReadyWithoutMutation\": true",
  "\"executeSucceeded\": true",
  "\"createUpdateDeleteCovered\": true",
  "\"permitConsumedOnce\": true",
  "\"replayBlocked\": true",
  "\"rollbackVerified\": true",
  "\"wroteOnlyPermittedTargets\": true",
  "\"noProviderExecute\": true",
  "\"noRealCodexCli\": true",
  "\"noExternalWrite\": true",
  "\"evidenceSanitized\": true",
  "\"executionWorkspaceWriteExecuteCalls\": 1",
  "\"providerExecuteCalls\": 0",
  "\"realCodexCliCalls\": 0",
  "\"externalWriteCalls\": 0"
] as const;

const REQUIRED_RELEASE_GATE_MARKERS = [
  "Controlled generic local workspace-write | Guarded behind permit v2, exact operation target allowlist, local runner, sanitized evidence, and rollback verification; not default authorization.",
  "General / unbounded workspace-write | Blocked.",
  "controlledGenericWorkspaceWriteAcceptanceRegistered",
  "controlled generic workspace-write acceptance status: current_local_temp_repo_execute_and_rollback",
  "workspace-write release gate audit blocks stale controlled generic evidence"
] as const;

const REQUIRED_REGISTRATION_MARKERS = [
  "auditCheck(\"controlled-generic-workspace-write-completion\"",
  "acceptanceCheck(\"controlled-generic-workspace-write\"",
  "npm run governance -- acceptance controlled-generic-workspace-write -- --check",
  "Controlled generic workspace-write acceptance",
  "controlled generic local workspace-write"
] as const;

const FORBIDDEN_COMPLETION_MARKERS = [
  "provider execute authorized: `true`",
  "real Codex CLI authorized: `true`",
  "general workspace-write authorized: `true`",
  "General / unbounded workspace-write | Guarded",
  "default workspace-write authorization: true",
  "execute workspace-write now",
  "run real workspace-write now",
  "external write authorized: `true`",
  "push authorized: `true`",
  "release authorized: `true`"
] as const;

const FORBIDDEN_EVIDENCE_MARKERS = [
  "created controlled generic workspace write",
  "updated controlled generic workspace write",
  "initial edit value",
  "initial delete value",
  "stdout",
  "stderr",
  "raw command",
  "raw env",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
] as const;

export interface ControlledGenericWorkspaceWriteCompletionAuditInput {
  workspaceWriteExecutorText: string;
  workspaceWriteExecutorTestText: string;
  providerExecutionRunnerText: string;
  providerExecutionRunnerTestText: string;
  controlledProviderDispatcherText: string;
  controlledProviderDispatcherTestText: string;
  hostDispatcherText: string;
  hostDispatcherTestText: string;
  desktopLiveAdapterText: string;
  desktopLiveAdapterTestText: string;
  agentOsLocalRuntimeText: string;
  agentOsMcpLocalRuntimeTestText: string;
  agentOsSdkText: string;
  agentOsSdkTestText: string;
  agentOsCliText: string;
  agentOsCliTestText: string;
  agentOsAppServerTestText: string;
  acceptanceScriptText: string;
  acceptanceTestText: string;
  acceptanceEvidenceText: string;
  releaseGateDocText: string;
  releaseGateAuditText: string;
  releaseGateTestText: string;
  governanceRunnerText: string;
  governanceControlPlaneText: string;
  currentStateText: string;
}

export interface ControlledGenericWorkspaceWriteCompletionAuditResult {
  status: "passed" | "blocked";
  checks: {
    executorSupportsGenericOperations: boolean;
    runnerRoutesThroughLocalExecutor: boolean;
    dispatcherBindsPreflightAndOperations: boolean;
    hostAndDesktopSurfacesRouteControlledDispatch: boolean;
    agentOsPublicSurfacesExposePrepareAndDispatch: boolean;
    acceptanceEvidenceProvesCreateUpdateDeleteRollback: boolean;
    releaseGateRecordsGuardedControlledGenericReadiness: boolean;
    governanceSurfacesRegistered: boolean;
    noBroadAuthorizationText: boolean;
    evidenceSanitized: boolean;
  };
  summary: {
    completionMode: "controlled_generic_workspace_write_end_to_end_audit_only";
    controlledGenericWorkspaceWriteImplemented: boolean;
    controlledGenericWorkspaceWriteAcceptanceCurrent: boolean;
    defaultGeneralWorkspaceWriteAllowed: false;
    providerExecuteForWorkspaceWriteAllowed: false;
    realCodexCliWorkspaceWriteAllowed: false;
    externalWriteAllowed: false;
    auditProviderExecuteCalls: 0;
    auditCodexCliCalls: 0;
    auditWorkspaceWriteCalls: 0;
    auditExternalWriteCalls: 0;
    auditEvidenceWrites: 0;
  };
  reasons: string[];
}

export type ControlledGenericWorkspaceWriteCompletionAuditOutputFormat =
  | "text"
  | "json";

export async function collectControlledGenericWorkspaceWriteCompletionAuditInput(
  cwd = process.cwd()
): Promise<ControlledGenericWorkspaceWriteCompletionAuditInput> {
  const [
    workspaceWriteExecutorText,
    workspaceWriteExecutorTestText,
    providerExecutionRunnerText,
    providerExecutionRunnerTestText,
    controlledProviderDispatcherText,
    controlledProviderDispatcherTestText,
    hostDispatcherText,
    hostDispatcherTestText,
    desktopLiveAdapterText,
    desktopLiveAdapterTestText,
    agentOsLocalRuntimeText,
    agentOsMcpLocalRuntimeTestText,
    agentOsSdkText,
    agentOsSdkTestText,
    agentOsCliText,
    agentOsCliTestText,
    agentOsAppServerTestText,
    acceptanceScriptText,
    acceptanceTestText,
    acceptanceEvidenceText,
    releaseGateDocText,
    releaseGateAuditText,
    releaseGateTestText,
    governanceRunnerText,
    governanceControlPlaneText,
    currentStateText
  ] = await Promise.all([
    read(cwd, WORKSPACE_WRITE_EXECUTOR),
    read(cwd, WORKSPACE_WRITE_EXECUTOR_TEST),
    read(cwd, PROVIDER_EXECUTION_RUNNER),
    read(cwd, PROVIDER_EXECUTION_RUNNER_TEST),
    read(cwd, CONTROLLED_PROVIDER_DISPATCHER),
    read(cwd, CONTROLLED_PROVIDER_DISPATCHER_TEST),
    read(cwd, HOST_DISPATCHER),
    read(cwd, HOST_DISPATCHER_TEST),
    read(cwd, DESKTOP_LIVE_ADAPTER),
    read(cwd, DESKTOP_LIVE_ADAPTER_TEST),
    read(cwd, AGENT_OS_LOCAL_RUNTIME),
    read(cwd, AGENT_OS_MCP_LOCAL_RUNTIME_TEST),
    read(cwd, AGENT_OS_SDK),
    read(cwd, AGENT_OS_SDK_TEST),
    read(cwd, AGENT_OS_CLI),
    read(cwd, AGENT_OS_CLI_TEST),
    read(cwd, AGENT_OS_APP_SERVER_TEST),
    read(cwd, ACCEPTANCE_SCRIPT),
    read(cwd, ACCEPTANCE_TEST),
    read(cwd, ACCEPTANCE_EVIDENCE),
    read(cwd, RELEASE_GATE_DOC),
    read(cwd, RELEASE_GATE_AUDIT),
    read(cwd, RELEASE_GATE_TEST),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, CURRENT_STATE)
  ]);

  return {
    workspaceWriteExecutorText,
    workspaceWriteExecutorTestText,
    providerExecutionRunnerText,
    providerExecutionRunnerTestText,
    controlledProviderDispatcherText,
    controlledProviderDispatcherTestText,
    hostDispatcherText,
    hostDispatcherTestText,
    desktopLiveAdapterText,
    desktopLiveAdapterTestText,
    agentOsLocalRuntimeText,
    agentOsMcpLocalRuntimeTestText,
    agentOsSdkText,
    agentOsSdkTestText,
    agentOsCliText,
    agentOsCliTestText,
    agentOsAppServerTestText,
    acceptanceScriptText,
    acceptanceTestText,
    acceptanceEvidenceText,
    releaseGateDocText,
    releaseGateAuditText,
    releaseGateTestText,
    governanceRunnerText,
    governanceControlPlaneText,
    currentStateText
  };
}

export function reviewControlledGenericWorkspaceWriteCompletionAudit(
  input: ControlledGenericWorkspaceWriteCompletionAuditInput
): ControlledGenericWorkspaceWriteCompletionAuditResult {
  const hostAndDesktopText = [
    input.hostDispatcherText,
    input.hostDispatcherTestText,
    input.desktopLiveAdapterText,
    input.desktopLiveAdapterTestText
  ].join("\n");
  const agentOsText = [
    input.agentOsLocalRuntimeText,
    input.agentOsMcpLocalRuntimeTestText,
    input.agentOsSdkText,
    input.agentOsSdkTestText,
    input.agentOsCliText,
    input.agentOsCliTestText,
    input.agentOsAppServerTestText
  ].join("\n");
  const releaseGateText = [
    input.releaseGateDocText,
    input.releaseGateAuditText,
    input.releaseGateTestText
  ].join("\n");
  const registrationText = [
    input.governanceRunnerText,
    input.governanceControlPlaneText,
    input.currentStateText
  ].join("\n");
  const authorizationText = [
    input.releaseGateDocText,
    registrationText,
    input.acceptanceEvidenceText
  ].join("\n");

  const checks = {
    executorSupportsGenericOperations:
      markersPresent(input.workspaceWriteExecutorText, REQUIRED_EXECUTOR_MARKERS)
      && markersPresent(input.workspaceWriteExecutorTestText, REQUIRED_EXECUTOR_TEST_MARKERS),
    runnerRoutesThroughLocalExecutor:
      markersPresent(input.providerExecutionRunnerText, REQUIRED_RUNNER_MARKERS)
      && markersPresent(input.providerExecutionRunnerTestText, REQUIRED_RUNNER_TEST_MARKERS),
    dispatcherBindsPreflightAndOperations:
      markersPresent(input.controlledProviderDispatcherText, REQUIRED_DISPATCHER_MARKERS)
      && markersPresent(input.controlledProviderDispatcherTestText, REQUIRED_DISPATCHER_TEST_MARKERS),
    hostAndDesktopSurfacesRouteControlledDispatch:
      markersPresent(hostAndDesktopText, REQUIRED_HOST_DESKTOP_MARKERS),
    agentOsPublicSurfacesExposePrepareAndDispatch:
      markersPresent(agentOsText, REQUIRED_AGENT_OS_MARKERS),
    acceptanceEvidenceProvesCreateUpdateDeleteRollback:
      markersPresent(input.acceptanceScriptText, REQUIRED_ACCEPTANCE_MARKERS)
      && markersPresent(input.acceptanceTestText, REQUIRED_ACCEPTANCE_TEST_MARKERS)
      && markersPresent(input.acceptanceEvidenceText, REQUIRED_ACCEPTANCE_EVIDENCE_MARKERS),
    releaseGateRecordsGuardedControlledGenericReadiness:
      markersPresent(releaseGateText, REQUIRED_RELEASE_GATE_MARKERS),
    governanceSurfacesRegistered:
      markersPresent(registrationText, REQUIRED_REGISTRATION_MARKERS),
    noBroadAuthorizationText:
      !containsForbidden(authorizationText, FORBIDDEN_COMPLETION_MARKERS),
    evidenceSanitized:
      !containsForbidden(input.acceptanceEvidenceText, FORBIDDEN_EVIDENCE_MARKERS)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      completionMode: "controlled_generic_workspace_write_end_to_end_audit_only",
      controlledGenericWorkspaceWriteImplemented: reasons.length === 0,
      controlledGenericWorkspaceWriteAcceptanceCurrent:
        checks.acceptanceEvidenceProvesCreateUpdateDeleteRollback
        && checks.governanceSurfacesRegistered,
      defaultGeneralWorkspaceWriteAllowed: false,
      providerExecuteForWorkspaceWriteAllowed: false,
      realCodexCliWorkspaceWriteAllowed: false,
      externalWriteAllowed: false,
      auditProviderExecuteCalls: 0,
      auditCodexCliCalls: 0,
      auditWorkspaceWriteCalls: 0,
      auditExternalWriteCalls: 0,
      auditEvidenceWrites: 0
    },
    reasons
  };
}

export function formatControlledGenericWorkspaceWriteCompletionAuditResult(
  result: ControlledGenericWorkspaceWriteCompletionAuditResult,
  format: ControlledGenericWorkspaceWriteCompletionAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  return [
    "Controlled generic workspace-write completion audit",
    `status: ${result.status}`,
    `completion mode: ${result.summary.completionMode}`,
    `controlled generic workspace-write implemented: ${result.summary.controlledGenericWorkspaceWriteImplemented}`,
    `controlled generic acceptance current: ${result.summary.controlledGenericWorkspaceWriteAcceptanceCurrent}`,
    `default general workspace-write allowed: ${result.summary.defaultGeneralWorkspaceWriteAllowed}`,
    `provider execute for workspace-write allowed: ${result.summary.providerExecuteForWorkspaceWriteAllowed}`,
    `real Codex CLI workspace-write allowed: ${result.summary.realCodexCliWorkspaceWriteAllowed}`,
    `external write allowed: ${result.summary.externalWriteAllowed}`,
    `provider execute calls during audit: ${result.summary.auditProviderExecuteCalls}`,
    `Codex CLI calls during audit: ${result.summary.auditCodexCliCalls}`,
    `workspace-write calls during audit: ${result.summary.auditWorkspaceWriteCalls}`,
    `external-write calls during audit: ${result.summary.auditExternalWriteCalls}`,
    `evidence writes during audit: ${result.summary.auditEvidenceWrites}`,
    ...(result.reasons.length > 0
      ? [`blocking reasons: ${result.reasons.join(", ")}`]
      : [])
  ].join("\n") + "\n";
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `controlled_generic_workspace_write_completion_${name}`);
}

function markersPresent(text: string, markers: readonly string[]): boolean {
  return markers.every((marker) => text.includes(marker));
}

function containsForbidden(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

async function main(): Promise<void> {
  const format: ControlledGenericWorkspaceWriteCompletionAuditOutputFormat =
    process.argv.includes("--json") ? "json" : "text";
  const result = reviewControlledGenericWorkspaceWriteCompletionAudit(
    await collectControlledGenericWorkspaceWriteCompletionAuditInput()
  );

  process.stdout.write(
    formatControlledGenericWorkspaceWriteCompletionAuditResult(result, format)
  );
  process.exitCode = result.status === "passed" ? 0 : 1;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
