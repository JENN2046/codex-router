import test from "node:test";
import assert from "node:assert/strict";
import {
  collectAgentOsPublicSurfacesBoundaryAuditInput,
  formatAgentOsPublicSurfacesBoundaryAuditResult,
  reviewAgentOsPublicSurfacesBoundaryAudit
} from "../scripts/run-agent-os-public-surfaces-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("Agent OS public surfaces boundary audit passes for current evidence", async () => {
  const review = reviewAgentOsPublicSurfacesBoundaryAudit(
    await collectAgentOsPublicSurfacesBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noDirectExecutionSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.agentOsPublicSurfacesMode,
    "public_surface_to_local_mcp_runtime_only"
  );
  assert.equal(review.summary.sdkCallIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.cliGrantFlagIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.cliApproveToolFlagIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.cliAllowLocalMutationIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.preferredProviderIsCodexCliInvocation, false);
  assert.equal(review.summary.appServerRequestEnvelopeIsCapabilityGrant, false);
  assert.equal(review.summary.appServerRouteIsNetworkServer, false);
  assert.equal(review.summary.appServerStatusCodeIsExecutionReceipt, false);
  assert.equal(review.summary.approvalPermitIssueIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.controlledWorkspaceWriteDispatchAllowed, true);
  assert.equal(review.summary.generalWorkspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.workspaceWriteProviderExecuteAllowed, false);
  assert.equal(review.summary.agentOsPublicSurfaceCallsDuringAudit, 0);
  assert.equal(review.summary.localRuntimeCallsDuringAudit, 0);
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

test("Agent OS public surfaces boundary audit blocks missing registration", async () => {
  const input = await collectAgentOsPublicSurfacesBoundaryAuditInput();
  const review = reviewAgentOsPublicSurfacesBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-os-public-surfaces-boundary",
      "archived-public-surfaces-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-os-public-surfaces-boundary",
      "npm run governance -- audit archived-public-surfaces-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_public_surfaces_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_os_public_surfaces_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("Agent OS public surfaces boundary audit blocks missing control-plane authority", async () => {
  const input = await collectAgentOsPublicSurfacesBoundaryAuditInput();
  const review = reviewAgentOsPublicSurfacesBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Agent OS public surfaces boundary",
      "Archived public surfaces boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_public_surfaces_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("Agent OS public surfaces boundary audit blocks source and test drift", async () => {
  const input = await collectAgentOsPublicSurfacesBoundaryAuditInput();
  const review = reviewAgentOsPublicSurfacesBoundaryAudit({
    ...input,
    sdkSourceText: input.sdkSourceText.replaceAll(
      "this.runtime.handleToolCall(call)",
      "this.runtime.executeToolCall(call)"
    ),
    cliSourceText: input.cliSourceText.replaceAll(
      "sanitizeAgentOsCliArgv",
      "forwardAgentOsCliArgv"
    ),
    appServerTestText: input.appServerTestText.replaceAll(
      "Agent OS App Server wrapper ignores client-supplied gate fields",
      "Agent OS App Server wrapper accepts client-supplied gate fields"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_public_surfaces_boundary_sourceMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes("agent_os_public_surfaces_boundary_coverageRecorded")
  );
});

test("Agent OS public surfaces boundary audit blocks direct execution markers", async () => {
  const input = await collectAgentOsPublicSurfacesBoundaryAuditInput();
  const review = reviewAgentOsPublicSurfacesBoundaryAudit({
    ...input,
    cliSourceText: input.cliSourceText + "\nrunCodexCli(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_public_surfaces_boundary_noDirectExecutionSurface"
    )
  );
});

test("Agent OS public surfaces boundary audit formats sanitized text and json", async () => {
  const review = reviewAgentOsPublicSurfacesBoundaryAudit(
    await collectAgentOsPublicSurfacesBoundaryAuditInput()
  );
  const text = formatAgentOsPublicSurfacesBoundaryAuditResult(review);
  const json = formatAgentOsPublicSurfacesBoundaryAuditResult(review, "json");

  assert.match(text, /Agent OS public surfaces boundary audit/);
  assert.match(text, /CLI grant flag is provider execution authorization: false/);
  assert.match(text, /controlled workspace-write dispatch allowed: true/);
  assert.match(text, /network calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
