import test from "node:test";
import assert from "node:assert/strict";
import {
  collectRoutingEngineBoundaryAuditInput,
  formatRoutingEngineBoundaryAuditResult,
  reviewRoutingEngineBoundaryAudit
} from "../scripts/run-routing-engine-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("routing engine boundary audit passes for current evidence", async () => {
  const review = reviewRoutingEngineBoundaryAudit(
    await collectRoutingEngineBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceRoutingMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.routingEngineMode,
    "routing_decision_and_provider_grant_only"
  );
  assert.equal(review.summary.routingDecisionIsExecutionAuthorization, false);
  assert.equal(review.summary.hostRouteIsHostDispatchAuthorization, false);
  assert.equal(review.summary.providerGrantIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.codexCliProviderIdIsCodexCliInvocation, false);
  assert.equal(review.summary.desktopProviderIdIsDesktopRuntimeInvocation, false);
  assert.equal(review.summary.sandboxModeIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.toolAccessIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.approvalRequiredIsApprovalGrant, false);
  assert.equal(review.summary.riskScoreIsRuntimeAuthorization, false);
  assert.equal(review.summary.parallelismAllowedIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.routingEngineCallsDuringAudit, 0);
  assert.equal(review.summary.providerGrantCreationsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.desktopRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.hostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.toolRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("routing engine boundary audit blocks missing governance registration", async () => {
  const input = await collectRoutingEngineBoundaryAuditInput();
  const review = reviewRoutingEngineBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "routing-engine-boundary",
      "route-decision-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit routing-engine-boundary",
      "npm run governance -- audit route-decision-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("routing_engine_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("routing_engine_boundary_governanceReadmeListsBoundary")
  );
});

test("routing engine boundary audit blocks missing control-plane authority", async () => {
  const input = await collectRoutingEngineBoundaryAuditInput();
  const review = reviewRoutingEngineBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Routing engine boundary",
      "Archived routing boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("routing_engine_boundary_controlPlaneAuthorityRecorded")
  );
});

test("routing engine boundary audit blocks source and test drift", async () => {
  const input = await collectRoutingEngineBoundaryAuditInput();
  const review = reviewRoutingEngineBoundaryAudit({
    ...input,
    routingEngineSourceText: input.routingEngineSourceText
      .replaceAll("createProviderGrant", "createExecutionGrant")
      .replaceAll("resolveHostRoute", "resolveRuntimeRoute"),
    routingEngineTestText: input.routingEngineTestText.replaceAll(
      "routing engine fails closed when a task class host route is missing",
      "routing engine falls back when a task class host route is missing"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("routing_engine_boundary_sourceRoutingMarkersPresent")
  );
  assert.ok(review.reasons.includes("routing_engine_boundary_coverageRecorded"));
});

test("routing engine boundary audit blocks runtime invocation markers", async () => {
  const input = await collectRoutingEngineBoundaryAuditInput();
  const review = reviewRoutingEngineBoundaryAudit({
    ...input,
    routingEngineSourceText:
      input.routingEngineSourceText + "\nprovider.execute(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("routing_engine_boundary_noRuntimeInvocationSurface")
  );
});

test("routing engine boundary audit formats sanitized text and json", async () => {
  const review = reviewRoutingEngineBoundaryAudit(
    await collectRoutingEngineBoundaryAuditInput()
  );
  const text = formatRoutingEngineBoundaryAuditResult(review);
  const json = formatRoutingEngineBoundaryAuditResult(review, "json");

  assert.match(text, /Routing engine boundary audit/);
  assert.match(text, /routing decision is execution authorization: false/);
  assert.match(text, /routing engine calls during audit: 0/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
