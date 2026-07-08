import test from "node:test";
import assert from "node:assert/strict";
import {
  collectAgentOsSdkBoundaryAuditInput,
  formatAgentOsSdkBoundaryAuditResult,
  reviewAgentOsSdkBoundaryAudit
} from "../scripts/run-agent-os-sdk-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw-token"
];

test("Agent OS SDK boundary audit passes for current evidence", async () => {
  const review = reviewAgentOsSdkBoundaryAudit(
    await collectAgentOsSdkBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeExecutionSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(review.summary.agentOsSdkMode, "sdk_method_to_local_mcp_runtime_only");
  assert.equal(review.summary.sdkCallIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.sdkGrantInputIsCapabilityGrant, false);
  assert.equal(review.summary.sdkApproveToolInputIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.sdkAllowLocalMutationIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.preferredProviderIsCodexCliInvocation, false);
  assert.equal(review.summary.localRuntimeCallIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.approvalPermitIssueIsProviderExecutionAuthorization, false);
  assert.equal(
    review.summary.approvalPermitConsumptionIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.realProviderExecutionInvoked, false);
  assert.equal(review.summary.sdkCallsDuringAudit, 0);
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

test("Agent OS SDK boundary audit blocks missing registration", async () => {
  const input = await collectAgentOsSdkBoundaryAuditInput();
  const review = reviewAgentOsSdkBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-os-sdk-boundary",
      "archived-agent-os-api-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-os-sdk-boundary",
      "npm run governance -- audit archived-agent-os-api-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_sdk_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("agent_os_sdk_boundary_governanceReadmeListsBoundary")
  );
});

test("Agent OS SDK boundary audit blocks missing control-plane authority", async () => {
  const input = await collectAgentOsSdkBoundaryAuditInput();
  const review = reviewAgentOsSdkBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Agent OS SDK boundary",
      "Archived SDK API boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_sdk_boundary_controlPlaneAuthorityRecorded")
  );
});

test("Agent OS SDK boundary audit blocks source and test drift", async () => {
  const input = await collectAgentOsSdkBoundaryAuditInput();
  const review = reviewAgentOsSdkBoundaryAudit({
    ...input,
    sdkSourceText: input.sdkSourceText
      .replaceAll("publicSurface: \"sdk\"", "publicSurface: \"unknown\"")
      .replaceAll("this.runtime.handleToolCall(call)", "this.runtime.executeToolCall(call)"),
    sdkTestText: input.sdkTestText.replaceAll(
      "Agent OS SDK creates a local run and provider plan without real execution",
      "Agent OS SDK creates a local run and executes provider plan"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("agent_os_sdk_boundary_sourceMarkersPresent"));
  assert.ok(review.reasons.includes("agent_os_sdk_boundary_coverageRecorded"));
});

test("Agent OS SDK boundary audit blocks runtime execution markers", async () => {
  const input = await collectAgentOsSdkBoundaryAuditInput();
  const review = reviewAgentOsSdkBoundaryAudit({
    ...input,
    sdkSourceText: `${input.sdkSourceText}\nrunCodexCli(plan);\nprovider.execute(plan);\ndispatchToHost(task);\nspawn(command);\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_sdk_boundary_noRuntimeExecutionSurface")
  );
});

test("Agent OS SDK boundary audit formats sanitized text and json", async () => {
  const review = reviewAgentOsSdkBoundaryAudit(
    await collectAgentOsSdkBoundaryAuditInput()
  );
  const text = formatAgentOsSdkBoundaryAuditResult(review);
  const json = formatAgentOsSdkBoundaryAuditResult(review, "json");

  assert.match(text, /Agent OS SDK boundary audit/);
  assert.match(text, /preferred provider is Codex CLI invocation: false/);
  assert.match(text, /Codex CLI calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
