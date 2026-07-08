import test from "node:test";
import assert from "node:assert/strict";
import {
  collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput,
  formatProtocolA2aRemoteProviderSkeletonBoundaryAuditResult,
  reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit
} from "../scripts/run-protocol-a2a-remote-provider-skeleton-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("protocol A2A remote provider skeleton boundary audit passes for current evidence", async () => {
  const review = reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit(
    await collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.protocolA2aRemoteProviderSkeletonMode,
    "agent_card_task_artifact_mapping_and_disabled_remote_provider_skeleton_only"
  );
  assert.equal(review.summary.endpointRefIsNetworkCall, false);
  assert.equal(review.summary.agentCardIsRemoteRuntimeAuthorization, false);
  assert.equal(review.summary.taskSkeletonIsRemoteExecutionAuthorization, false);
  assert.equal(review.summary.artifactUriIsFetchedBySkeleton, false);
  assert.equal(review.summary.remoteProviderIsEnabled, false);
  assert.equal(review.summary.remoteProviderCreatesRemoteTasks, false);
  assert.equal(review.summary.fakeTransportIsLiveNetworkService, false);
  assert.equal(review.summary.fakeTransportSubmissionIsRuntimeAuthorization, false);
  assert.equal(review.summary.anonymousRemoteInvocationAllowed, false);
  assert.equal(review.summary.authSchemeIsCapabilityGrant, false);
  assert.equal(
    review.summary.remoteAgentProviderManifestIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(review.summary.protocolA2aCallsDuringAudit, 0);
  assert.equal(review.summary.liveNetworkServiceStartsDuringAudit, 0);
  assert.equal(review.summary.remoteAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.remoteTaskCreationsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.desktopPrimitiveCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.hostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.networkCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("protocol A2A remote provider skeleton boundary audit blocks missing registration", async () => {
  const input = await collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "protocol-a2a-remote-provider-skeleton-boundary",
      "archived-a2a-remote-provider-skeleton-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit protocol-a2a-remote-provider-skeleton-boundary",
      "npm run governance -- audit archived-a2a-remote-provider-skeleton-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "protocol_a2a_remote_provider_skeleton_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "protocol_a2a_remote_provider_skeleton_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("protocol A2A remote provider skeleton boundary audit blocks missing control-plane authority", async () => {
  const input = await collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Protocol A2A remote provider skeleton boundary",
      "Archived A2A remote provider skeleton boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "protocol_a2a_remote_provider_skeleton_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("protocol A2A remote provider skeleton boundary audit blocks source and test drift", async () => {
  const input = await collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit({
    ...input,
    protocolA2aSourceText: input.protocolA2aSourceText
      .replaceAll(
        "throw new A2ARemoteAgentProviderDisabledError()",
        "return createRemoteTask(input)"
      )
      .replaceAll("liveNetworkService: false", "liveNetworkService: true"),
    protocolA2aTestText: input.protocolA2aTestText.replaceAll(
      "protocol-a2a remote provider is disabled by default",
      "protocol-a2a remote provider is enabled by default"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "protocol_a2a_remote_provider_skeleton_boundary_sourceMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "protocol_a2a_remote_provider_skeleton_boundary_coverageRecorded"
    )
  );
});

test("protocol A2A remote provider skeleton boundary audit blocks runtime invocation markers", async () => {
  const input = await collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit({
    ...input,
    protocolA2aSourceText: input.protocolA2aSourceText + "\nfetch(endpointRef);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "protocol_a2a_remote_provider_skeleton_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("protocol A2A remote provider skeleton boundary audit formats sanitized text and json", async () => {
  const review = reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit(
    await collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput()
  );
  const text = formatProtocolA2aRemoteProviderSkeletonBoundaryAuditResult(review);
  const json = formatProtocolA2aRemoteProviderSkeletonBoundaryAuditResult(
    review,
    "json"
  );

  assert.match(text, /Protocol A2A remote provider skeleton boundary audit/);
  assert.match(text, /remote provider is enabled: false/);
  assert.match(text, /live network service starts during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
