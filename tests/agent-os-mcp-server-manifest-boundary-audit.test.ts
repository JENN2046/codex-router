import test from "node:test";
import assert from "node:assert/strict";
import {
  collectAgentOsMcpServerManifestBoundaryAuditInput,
  formatAgentOsMcpServerManifestBoundaryAuditResult,
  reviewAgentOsMcpServerManifestBoundaryAudit
} from "../scripts/run-agent-os-mcp-server-manifest-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("Agent OS MCP server manifest boundary audit passes for current evidence", async () => {
  const review = reviewAgentOsMcpServerManifestBoundaryAudit(
    await collectAgentOsMcpServerManifestBoundaryAuditInput()
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
  assert.equal(review.summary.agentOsMcpServerManifestMode, "manifest_only_no_runtime");
  assert.equal(review.summary.runtimeImplementedMeansLiveServer, false);
  assert.equal(review.summary.toolManifestIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.requiredCapabilityIsCapabilityGrant, false);
  assert.equal(review.summary.approvalRequiredIsApprovalGrant, false);
  assert.equal(review.summary.localWriteSideEffectIsWorkspaceWriteExecution, false);
  assert.equal(
    review.summary.providerPlanningOutputIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.approvalPermitOutputIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.listedToolIsMcpToolInvocation, false);
  assert.equal(review.summary.manifestExportIsPublicExecutionSurface, false);
  assert.equal(review.summary.agentOsMcpServerManifestCallsDuringAudit, 0);
  assert.equal(review.summary.liveMcpServerStartsDuringAudit, 0);
  assert.equal(review.summary.localRuntimeCallsDuringAudit, 0);
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

test("Agent OS MCP server manifest boundary audit blocks missing registration", async () => {
  const input = await collectAgentOsMcpServerManifestBoundaryAuditInput();
  const review = reviewAgentOsMcpServerManifestBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-os-mcp-server-manifest-boundary",
      "archived-mcp-server-manifest-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-os-mcp-server-manifest-boundary",
      "npm run governance -- audit archived-mcp-server-manifest-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_mcp_server_manifest_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_os_mcp_server_manifest_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("Agent OS MCP server manifest boundary audit blocks missing control-plane authority", async () => {
  const input = await collectAgentOsMcpServerManifestBoundaryAuditInput();
  const review = reviewAgentOsMcpServerManifestBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Agent OS MCP server manifest boundary",
      "Archived MCP manifest boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_mcp_server_manifest_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("Agent OS MCP server manifest boundary audit blocks source and test drift", async () => {
  const input = await collectAgentOsMcpServerManifestBoundaryAuditInput();
  const review = reviewAgentOsMcpServerManifestBoundaryAudit({
    ...input,
    serverManifestSourceText: input.serverManifestSourceText
      .replaceAll("runtimeImplemented: z.literal(false)", "runtimeImplemented: z.boolean()")
      .replaceAll("policyGated: true", "policyGated: false"),
    serverManifestTestText: input.serverManifestTestText.replaceAll(
      "Agent OS MCP server manifest declares all tools and no runtime",
      "Agent OS MCP server manifest starts all tool handlers"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_mcp_server_manifest_boundary_sourceMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes("agent_os_mcp_server_manifest_boundary_coverageRecorded")
  );
});

test("Agent OS MCP server manifest boundary audit blocks runtime invocation markers", async () => {
  const input = await collectAgentOsMcpServerManifestBoundaryAuditInput();
  const review = reviewAgentOsMcpServerManifestBoundaryAudit({
    ...input,
    serverManifestSourceText:
      input.serverManifestSourceText + "\ncreateAgentOsMcpLocalRuntime(options);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_mcp_server_manifest_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("Agent OS MCP server manifest boundary audit formats sanitized text and json", async () => {
  const review = reviewAgentOsMcpServerManifestBoundaryAudit(
    await collectAgentOsMcpServerManifestBoundaryAuditInput()
  );
  const text = formatAgentOsMcpServerManifestBoundaryAuditResult(review);
  const json = formatAgentOsMcpServerManifestBoundaryAuditResult(review, "json");

  assert.match(text, /Agent OS MCP server manifest boundary audit/);
  assert.match(text, /tool manifest is tool runtime authorization: false/);
  assert.match(text, /live MCP server starts during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
