import test from "node:test";
import assert from "node:assert/strict";
import {
  collectProtocolMcpProviderSkeletonBoundaryAuditInput,
  formatProtocolMcpProviderSkeletonBoundaryAuditResult,
  reviewProtocolMcpProviderSkeletonBoundaryAudit
} from "../scripts/run-protocol-mcp-provider-skeleton-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("protocol MCP provider skeleton boundary audit passes for current evidence", async () => {
  const review = reviewProtocolMcpProviderSkeletonBoundaryAudit(
    await collectProtocolMcpProviderSkeletonBoundaryAuditInput()
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
    review.summary.protocolMcpProviderSkeletonMode,
    "protocol_mapping_and_disabled_provider_skeleton_only"
  );
  assert.equal(review.summary.serverRefIsLiveServerConnection, false);
  assert.equal(review.summary.commandRefIsShellCommand, false);
  assert.equal(review.summary.endpointRefIsNetworkCall, false);
  assert.equal(review.summary.toolManifestIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.invocationPlanIsToolExecutionAuthorization, false);
  assert.equal(review.summary.fakeProviderIsLiveMcpServer, false);
  assert.equal(review.summary.invokeMethodIsEnabled, false);
  assert.equal(review.summary.unknownSideEffectIsAutoApproved, false);
  assert.equal(review.summary.allowedToolIsMcpInvocationAuthorization, false);
  assert.equal(review.summary.protocolMcpCallsDuringAudit, 0);
  assert.equal(review.summary.liveMcpServerConnectionsDuringAudit, 0);
  assert.equal(review.summary.toolRuntimeCallsDuringAudit, 0);
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

test("protocol MCP provider skeleton boundary audit blocks missing registration", async () => {
  const input = await collectProtocolMcpProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolMcpProviderSkeletonBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "protocol-mcp-provider-skeleton-boundary",
      "archived-mcp-provider-skeleton-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit protocol-mcp-provider-skeleton-boundary",
      "npm run governance -- audit archived-mcp-provider-skeleton-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "protocol_mcp_provider_skeleton_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "protocol_mcp_provider_skeleton_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("protocol MCP provider skeleton boundary audit blocks missing control-plane authority", async () => {
  const input = await collectProtocolMcpProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolMcpProviderSkeletonBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Protocol MCP provider skeleton boundary",
      "Archived MCP provider skeleton boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "protocol_mcp_provider_skeleton_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("protocol MCP provider skeleton boundary audit blocks source and test drift", async () => {
  const input = await collectProtocolMcpProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolMcpProviderSkeletonBoundaryAudit({
    ...input,
    protocolMcpSourceText: input.protocolMcpSourceText
      .replaceAll("throw new McpToolProviderInvokeDisabledError()", "return executeTool(plan)")
      .replaceAll("liveServerConnection: false", "liveServerConnection: true"),
    protocolMcpTestText: input.protocolMcpTestText.replaceAll(
      "protocol-mcp provider skeleton invoke is disabled",
      "protocol-mcp provider skeleton invoke is enabled"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "protocol_mcp_provider_skeleton_boundary_sourceMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes("protocol_mcp_provider_skeleton_boundary_coverageRecorded")
  );
});

test("protocol MCP provider skeleton boundary audit blocks runtime invocation markers", async () => {
  const input = await collectProtocolMcpProviderSkeletonBoundaryAuditInput();
  const review = reviewProtocolMcpProviderSkeletonBoundaryAudit({
    ...input,
    protocolMcpSourceText: input.protocolMcpSourceText + "\nfetch(endpointRef);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "protocol_mcp_provider_skeleton_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("protocol MCP provider skeleton boundary audit formats sanitized text and json", async () => {
  const review = reviewProtocolMcpProviderSkeletonBoundaryAudit(
    await collectProtocolMcpProviderSkeletonBoundaryAuditInput()
  );
  const text = formatProtocolMcpProviderSkeletonBoundaryAuditResult(review);
  const json = formatProtocolMcpProviderSkeletonBoundaryAuditResult(review, "json");

  assert.match(text, /Protocol MCP provider skeleton boundary audit/);
  assert.match(text, /invoke method is enabled: false/);
  assert.match(text, /live MCP server connections during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
