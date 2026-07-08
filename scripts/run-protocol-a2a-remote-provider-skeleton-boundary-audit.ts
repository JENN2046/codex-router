#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const PROTOCOL_A2A_SOURCE = "packages/protocol-a2a/src/index.ts";
const PROTOCOL_A2A_TEST = "tests/protocol-a2a.test.ts";
const PROVIDER_REGISTRY_TEST = "tests/provider-registry.test.ts";
const EXECUTION_PLANNER_TEST = "tests/execution-planner.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "A2A_REMOTE_AGENT_PROVIDER_DISABLED",
  "A2A_ANONYMOUS_REMOTE_INVOCATION_REJECTED",
  "A2A_FAKE_TRANSPORT_SUBMIT_DISABLED",
  "A2AEndpointReferenceSchema",
  "A2A endpoint must be a metadata reference, not a raw URL",
  "A2AAgentCardSkeletonSchema",
  "agentManifestToA2AAgentCard",
  "taskToA2ATaskSkeleton",
  "artifactToA2AArtifactSkeleton",
  "assertA2ARemoteInvocationAuthorized",
  "createA2ARemoteAgentProviderSkeleton",
  "createFakeA2ATransport",
  "liveNetworkService: false",
  "networkRuntimeImplemented: false",
  "remoteExecutionStarted: false",
  "fetchedBySkeleton: false",
  "throw new A2ARemoteAgentProviderDisabledError()",
  "invokeDefault: \"disabled\"",
  "networkAccess: \"none\"",
  "filesystemAccess: \"none\"",
  "secretAccess: \"brokered\"",
  "Skeleton only; does not listen on the network.",
  "Endpoints are metadata references, not raw URLs."
] as const;

const REQUIRED_TEST_MARKERS = [
  "protocol-a2a maps AgentManifest to AgentCard skeleton",
  "protocol-a2a maps Task and Run to A2ATask skeleton",
  "protocol-a2a maps Artifact to A2A artifact skeleton",
  "protocol-a2a rejects anonymous remote invocation by helper",
  "protocol-a2a remote provider is disabled by default",
  "protocol-a2a endpoint refs reject raw URLs",
  "protocol-a2a fake transport blocks task submission by default",
  "protocol-a2a fake transport queues and cancels local tasks without network",
  "A2A_REMOTE_AGENT_PROVIDER_DISABLED",
  "A2A_FAKE_TRANSPORT_SUBMIT_DISABLED",
  "createA2ARemoteAgentProviderSkeleton"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "dispatchReadOnlyRunnerResultToProvider",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "dispatchToHost(",
  "invokePrimitive",
  "invokeSubAgent",
  "spawnSubAgent",
  "hostExecutor(",
  "spawn(",
  "execFile(",
  "childProcess.exec(",
  "node:child_process",
  "child_process",
  "new Worker(",
  "fetch(",
  "createServer(",
  "listen(",
  "writeFile(",
  "mkdir(",
  "rm(",
  "rename(",
  "copyFile(",
  "apply_patch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ProtocolA2aRemoteProviderSkeletonBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  protocolA2aSourceText: string;
  protocolA2aTestText: string;
  providerRegistryTestText: string;
  executionPlannerTestText: string;
}

export interface ProtocolA2aRemoteProviderSkeletonBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    protocolA2aRemoteProviderSkeletonMode: "agent_card_task_artifact_mapping_and_disabled_remote_provider_skeleton_only";
    endpointRefIsNetworkCall: false;
    agentCardIsRemoteRuntimeAuthorization: false;
    taskSkeletonIsRemoteExecutionAuthorization: false;
    artifactUriIsFetchedBySkeleton: false;
    remoteProviderIsEnabled: false;
    remoteProviderCreatesRemoteTasks: false;
    fakeTransportIsLiveNetworkService: false;
    fakeTransportSubmissionIsRuntimeAuthorization: false;
    anonymousRemoteInvocationAllowed: false;
    authSchemeIsCapabilityGrant: false;
    remoteAgentProviderManifestIsSubAgentRuntimeAuthorization: false;
    protocolA2aCallsDuringAudit: 0;
    liveNetworkServiceStartsDuringAudit: 0;
    remoteAgentRuntimeCallsDuringAudit: 0;
    remoteTaskCreationsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    desktopPrimitiveCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    networkCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ProtocolA2aRemoteProviderSkeletonBoundaryAuditOutputFormat =
  "text" | "json";

export async function collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ProtocolA2aRemoteProviderSkeletonBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    protocolA2aSourceText,
    protocolA2aTestText,
    providerRegistryTestText,
    executionPlannerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, PROTOCOL_A2A_SOURCE),
    read(cwd, PROTOCOL_A2A_TEST),
    read(cwd, PROVIDER_REGISTRY_TEST),
    read(cwd, EXECUTION_PLANNER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    protocolA2aSourceText,
    protocolA2aTestText,
    providerRegistryTestText,
    executionPlannerTestText
  };
}

export function reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit(
  input: ProtocolA2aRemoteProviderSkeletonBoundaryAuditInput
): ProtocolA2aRemoteProviderSkeletonBoundaryAuditResult {
  const testText = [
    input.protocolA2aTestText,
    input.providerRegistryTestText,
    input.executionPlannerTestText
  ].join("\n");
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit protocol-a2a-remote-provider-skeleton-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "protocol-a2a-remote-provider-skeleton-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.protocolA2aSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      testText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.protocolA2aSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      protocolA2aRemoteProviderSkeletonMode:
        "agent_card_task_artifact_mapping_and_disabled_remote_provider_skeleton_only",
      endpointRefIsNetworkCall: false,
      agentCardIsRemoteRuntimeAuthorization: false,
      taskSkeletonIsRemoteExecutionAuthorization: false,
      artifactUriIsFetchedBySkeleton: false,
      remoteProviderIsEnabled: false,
      remoteProviderCreatesRemoteTasks: false,
      fakeTransportIsLiveNetworkService: false,
      fakeTransportSubmissionIsRuntimeAuthorization: false,
      anonymousRemoteInvocationAllowed: false,
      authSchemeIsCapabilityGrant: false,
      remoteAgentProviderManifestIsSubAgentRuntimeAuthorization: false,
      protocolA2aCallsDuringAudit: 0,
      liveNetworkServiceStartsDuringAudit: 0,
      remoteAgentRuntimeCallsDuringAudit: 0,
      remoteTaskCreationsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      networkCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatProtocolA2aRemoteProviderSkeletonBoundaryAuditResult(
  review: ProtocolA2aRemoteProviderSkeletonBoundaryAuditResult,
  format: ProtocolA2aRemoteProviderSkeletonBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Protocol A2A remote provider skeleton boundary audit",
    `status: ${review.status}`,
    `protocol A2A remote provider skeleton mode: ${review.summary.protocolA2aRemoteProviderSkeletonMode}`,
    `endpoint ref is network call: ${review.summary.endpointRefIsNetworkCall}`,
    `agent card is remote runtime authorization: ${review.summary.agentCardIsRemoteRuntimeAuthorization}`,
    `task skeleton is remote execution authorization: ${review.summary.taskSkeletonIsRemoteExecutionAuthorization}`,
    `artifact URI is fetched by skeleton: ${review.summary.artifactUriIsFetchedBySkeleton}`,
    `remote provider is enabled: ${review.summary.remoteProviderIsEnabled}`,
    `remote provider creates remote tasks: ${review.summary.remoteProviderCreatesRemoteTasks}`,
    `fake transport is live network service: ${review.summary.fakeTransportIsLiveNetworkService}`,
    `fake transport submission is runtime authorization: ${review.summary.fakeTransportSubmissionIsRuntimeAuthorization}`,
    `anonymous remote invocation allowed: ${review.summary.anonymousRemoteInvocationAllowed}`,
    `auth scheme is capability grant: ${review.summary.authSchemeIsCapabilityGrant}`,
    `remote agent provider manifest is sub-agent runtime authorization: ${review.summary.remoteAgentProviderManifestIsSubAgentRuntimeAuthorization}`,
    `protocol A2A calls during audit: ${review.summary.protocolA2aCallsDuringAudit}`,
    `live network service starts during audit: ${review.summary.liveNetworkServiceStartsDuringAudit}`,
    `remote agent runtime calls during audit: ${review.summary.remoteAgentRuntimeCallsDuringAudit}`,
    `remote task creations during audit: ${review.summary.remoteTaskCreationsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `desktop primitive calls during audit: ${review.summary.desktopPrimitiveCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `network calls during audit: ${review.summary.networkCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Protocol A2A remote provider skeleton boundary")
    && text.includes("agent card, task, artifact mapping and disabled remote provider skeleton only")
    && text.includes("endpoint refs are not network calls")
    && text.includes("agent cards are not remote runtime authorization")
    && text.includes("task skeletons are not remote execution authorization")
    && text.includes("artifact URIs are not fetched by the skeleton")
    && text.includes("remote providers remain disabled")
    && text.includes("fake transports are not live network services")
    && text.includes("anonymous remote invocation remains rejected")
    && text.includes("remote-agent provider manifests are not sub-agent runtime authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(
  input: ProtocolA2aRemoteProviderSkeletonBoundaryAuditInput
): boolean {
  const output = formatProtocolA2aRemoteProviderSkeletonBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      protocolA2aRemoteProviderSkeletonMode:
        "agent_card_task_artifact_mapping_and_disabled_remote_provider_skeleton_only",
      endpointRefIsNetworkCall: false,
      agentCardIsRemoteRuntimeAuthorization: false,
      taskSkeletonIsRemoteExecutionAuthorization: false,
      artifactUriIsFetchedBySkeleton: false,
      remoteProviderIsEnabled: false,
      remoteProviderCreatesRemoteTasks: false,
      fakeTransportIsLiveNetworkService: false,
      fakeTransportSubmissionIsRuntimeAuthorization: false,
      anonymousRemoteInvocationAllowed: false,
      authSchemeIsCapabilityGrant: false,
      remoteAgentProviderManifestIsSubAgentRuntimeAuthorization: false,
      protocolA2aCallsDuringAudit: 0,
      liveNetworkServiceStartsDuringAudit: 0,
      remoteAgentRuntimeCallsDuringAudit: 0,
      remoteTaskCreationsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      networkCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });
  const scannedText = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    input.protocolA2aSourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !scannedText.includes(marker));
}

function collectReasons(
  checks: ProtocolA2aRemoteProviderSkeletonBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `protocol_a2a_remote_provider_skeleton_boundary_${check}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit(input);
  console.log(formatProtocolA2aRemoteProviderSkeletonBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}
