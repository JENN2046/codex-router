import test from "node:test";
import assert from "node:assert/strict";
import {
  collectAgentOsAppServerBoundaryAuditInput,
  formatAgentOsAppServerBoundaryAuditResult,
  reviewAgentOsAppServerBoundaryAudit
} from "../scripts/run-agent-os-app-server-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("Agent OS app-server boundary audit passes for current evidence", async () => {
  const review = reviewAgentOsAppServerBoundaryAudit(
    await collectAgentOsAppServerBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noLiveServerOrRuntimeExecutionSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.agentOsAppServerMode,
    "http_like_request_routing_to_local_mcp_runtime_only"
  );
  assert.equal(review.summary.requestEnvelopeIsCapabilityGrant, false);
  assert.equal(review.summary.routeIsLiveNetworkServer, false);
  assert.equal(review.summary.statusCodeIsHostExecutorReceipt, false);
  assert.equal(review.summary.clientGateFieldsAreTrusted, false);
  assert.equal(review.summary.serverSideOptionsAreClientControlled, false);
  assert.equal(review.summary.localRuntimeCallIsProviderExecutionAuthorization, false);
  assert.equal(
    review.summary.approvalPermitIssueIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.approvalPermitConsumptionIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.controlledWorkspaceWriteDispatchAllowed, true);
  assert.equal(review.summary.generalWorkspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.workspaceWriteProviderExecuteAllowed, false);
  assert.equal(review.summary.liveHttpServerStarted, false);
  assert.equal(review.summary.networkAccessed, false);
  assert.equal(review.summary.realProviderExecutionInvoked, false);
  assert.equal(review.summary.appServerWrapperCallsDuringAudit, 0);
  assert.equal(review.summary.localRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.liveHttpServerStartsDuringAudit, 0);
  assert.equal(review.summary.networkCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.desktopPrimitiveCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.hostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("Agent OS app-server boundary audit blocks missing registration", async () => {
  const input = await collectAgentOsAppServerBoundaryAuditInput();
  const review = reviewAgentOsAppServerBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-os-app-server-boundary",
      "archived-app-server-wrapper-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-os-app-server-boundary",
      "npm run governance -- audit archived-app-server-wrapper-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_app_server_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("agent_os_app_server_boundary_governanceReadmeListsBoundary")
  );
});

test("Agent OS app-server boundary audit blocks missing control-plane authority", async () => {
  const input = await collectAgentOsAppServerBoundaryAuditInput();
  const review = reviewAgentOsAppServerBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Agent OS app-server wrapper boundary",
      "Archived Agent OS app-server boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_app_server_boundary_controlPlaneAuthorityRecorded")
  );
});

test("Agent OS app-server boundary audit blocks source and test drift", async () => {
  const input = await collectAgentOsAppServerBoundaryAuditInput();
  const review = reviewAgentOsAppServerBoundaryAudit({
    ...input,
    appServerSourceText: input.appServerSourceText
      .replaceAll("liveHttpServerStarted: false", "liveHttpServerStarted: true")
      .replaceAll("networkAccessed: false", "networkAccessed: true"),
    appServerTestText: input.appServerTestText.replaceAll(
      "Agent OS App Server wrapper ignores client-supplied gate fields",
      "Agent OS App Server wrapper trusts client-supplied gate fields"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_app_server_boundary_sourceMarkersPresent")
  );
  assert.ok(
    review.reasons.includes("agent_os_app_server_boundary_coverageRecorded")
  );
});

test("Agent OS app-server boundary audit blocks live server and runtime markers", async () => {
  const input = await collectAgentOsAppServerBoundaryAuditInput();
  const review = reviewAgentOsAppServerBoundaryAudit({
    ...input,
    appServerSourceText: `${input.appServerSourceText}\ncreateServer().listen(0);\nfetch(\"https://example.invalid\");\nprovider.execute(plan);\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_app_server_boundary_noLiveServerOrRuntimeExecutionSurface"
    )
  );
});

test("Agent OS app-server boundary audit formats sanitized text and json", async () => {
  const review = reviewAgentOsAppServerBoundaryAudit(
    await collectAgentOsAppServerBoundaryAuditInput()
  );
  const text = formatAgentOsAppServerBoundaryAuditResult(review);
  const json = formatAgentOsAppServerBoundaryAuditResult(review, "json");

  assert.match(text, /Agent OS app-server boundary audit/);
  assert.match(text, /route is live network server: false/);
  assert.match(text, /live HTTP server starts during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
