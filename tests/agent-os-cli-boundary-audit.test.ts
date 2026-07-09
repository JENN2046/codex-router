import test from "node:test";
import assert from "node:assert/strict";
import {
  collectAgentOsCliBoundaryAuditInput,
  formatAgentOsCliBoundaryAuditResult,
  reviewAgentOsCliBoundaryAudit
} from "../scripts/run-agent-os-cli-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw-token"
];

test("Agent OS CLI boundary audit passes for current evidence", async () => {
  const review = reviewAgentOsCliBoundaryAudit(
    await collectAgentOsCliBoundaryAuditInput()
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
  assert.equal(review.summary.agentOsCliMode, "argv_parsing_to_local_mcp_runtime_only");
  assert.equal(review.summary.cliGrantFlagIsCapabilityGrant, false);
  assert.equal(review.summary.cliApproveToolFlagIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.cliAllowLocalMutationIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.preferredProviderIsCodexCliInvocation, false);
  assert.equal(review.summary.parsedCommandIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.localRuntimeCallIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.approvalPermitIssueIsProviderExecutionAuthorization, false);
  assert.equal(
    review.summary.approvalPermitConsumptionIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.controlledWorkspaceWriteDispatchAllowed, true);
  assert.equal(review.summary.generalWorkspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.workspaceWriteProviderExecuteAllowed, false);
  assert.equal(review.summary.sanitizedArgvContainsRawSecrets, false);
  assert.equal(review.summary.cliWrapperCallsDuringAudit, 0);
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

test("Agent OS CLI boundary audit blocks missing registration", async () => {
  const input = await collectAgentOsCliBoundaryAuditInput();
  const review = reviewAgentOsCliBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-os-cli-boundary",
      "archived-agent-os-command-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-os-cli-boundary",
      "npm run governance -- audit archived-agent-os-command-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_cli_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("agent_os_cli_boundary_governanceReadmeListsBoundary")
  );
});

test("Agent OS CLI boundary audit blocks missing control-plane authority", async () => {
  const input = await collectAgentOsCliBoundaryAuditInput();
  const review = reviewAgentOsCliBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Agent OS CLI boundary",
      "Archived command parser boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_cli_boundary_controlPlaneAuthorityRecorded")
  );
});

test("Agent OS CLI boundary audit blocks source and test drift", async () => {
  const input = await collectAgentOsCliBoundaryAuditInput();
  const review = reviewAgentOsCliBoundaryAudit({
    ...input,
    cliSourceText: input.cliSourceText
      .replaceAll("sanitizedArgv: sanitizeAgentOsCliArgv(argv)", "sanitizedArgv: argv")
      .replaceAll("runtime.handleToolCall(call)", "runtime.executeToolCall(call)"),
    cliTestText: input.cliTestText.replaceAll(
      "Agent OS CLI sanitizer redacts secret-like option values",
      "Agent OS CLI sanitizer preserves secret-like option values"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("agent_os_cli_boundary_sourceMarkersPresent"));
  assert.ok(review.reasons.includes("agent_os_cli_boundary_coverageRecorded"));
});

test("Agent OS CLI boundary audit blocks runtime execution markers", async () => {
  const input = await collectAgentOsCliBoundaryAuditInput();
  const review = reviewAgentOsCliBoundaryAudit({
    ...input,
    cliSourceText: `${input.cliSourceText}\nrunCodexCli(plan);\nprovider.execute(plan);\ndispatchToHost(task);\nspawn(command);\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_os_cli_boundary_noRuntimeExecutionSurface")
  );
});

test("Agent OS CLI boundary audit formats sanitized text and json", async () => {
  const review = reviewAgentOsCliBoundaryAudit(
    await collectAgentOsCliBoundaryAuditInput()
  );
  const text = formatAgentOsCliBoundaryAuditResult(review);
  const json = formatAgentOsCliBoundaryAuditResult(review, "json");

  assert.match(text, /Agent OS CLI boundary audit/);
  assert.match(text, /preferred provider is Codex CLI invocation: false/);
  assert.match(text, /controlled workspace-write dispatch allowed: true/);
  assert.match(text, /Codex CLI calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
