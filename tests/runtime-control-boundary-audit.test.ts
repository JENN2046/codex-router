import test from "node:test";
import assert from "node:assert/strict";
import {
  collectRuntimeControlBoundaryAuditInput,
  formatRuntimeControlBoundaryAuditResult,
  reviewRuntimeControlBoundaryAudit
} from "../scripts/run-runtime-control-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("runtime control boundary audit passes for current evidence", async () => {
  const review = reviewRuntimeControlBoundaryAudit(
    await collectRuntimeControlBoundaryAuditInput()
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
    review.summary.runtimeControlMode,
    "runtime_signal_and_escalation_outcome_only"
  );
  assert.equal(review.summary.runtimeSignalIsExecutionAuthorization, false);
  assert.equal(
    review.summary.escalationOutcomeIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.upgradeModelIsModelRuntimeInvocation, false);
  assert.equal(review.summary.openCircuitIsHostDispatchAuthorization, false);
  assert.equal(
    review.summary.failureCountIsRecoveryExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.contextPressureIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(review.summary.highRiskSignalIsCodexCliAuthorization, false);
  assert.equal(review.summary.runtimeControlCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.hostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.modelRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("runtime control boundary audit blocks missing governance registration", async () => {
  const input = await collectRuntimeControlBoundaryAuditInput();
  const review = reviewRuntimeControlBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "runtime-control-boundary",
      "archived-control-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit runtime-control-boundary",
      "npm run governance -- audit archived-control-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "runtime_control_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "runtime_control_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("runtime control boundary audit blocks missing control-plane authority", async () => {
  const input = await collectRuntimeControlBoundaryAuditInput();
  const review = reviewRuntimeControlBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Runtime control boundary",
      "Archived runtime control boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "runtime_control_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("runtime control boundary audit blocks source and test drift", async () => {
  const input = await collectRuntimeControlBoundaryAuditInput();
  const review = reviewRuntimeControlBoundaryAudit({
    ...input,
    runtimeControlSourceText: input.runtimeControlSourceText
      .replaceAll("evaluateRuntimeSignals", "authorizeRuntimeSignals")
      .replaceAll("action: \"open_circuit\"", "action: \"execute\""),
    runtimeControlTestText: input.runtimeControlTestText.replaceAll(
      "runtime control opens circuit for sticky high-risk signal at max model",
      "runtime control executes sticky high-risk signal at max model"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("runtime_control_boundary_sourceMarkersPresent")
  );
  assert.ok(
    review.reasons.includes("runtime_control_boundary_coverageRecorded")
  );
});

test("runtime control boundary audit blocks runtime invocation markers", async () => {
  const input = await collectRuntimeControlBoundaryAuditInput();
  const review = reviewRuntimeControlBoundaryAudit({
    ...input,
    runtimeControlSourceText:
      input.runtimeControlSourceText + "\nprovider.execute(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "runtime_control_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("runtime control boundary audit formats sanitized text and json", async () => {
  const review = reviewRuntimeControlBoundaryAudit(
    await collectRuntimeControlBoundaryAuditInput()
  );
  const text = formatRuntimeControlBoundaryAuditResult(review);
  const json = formatRuntimeControlBoundaryAuditResult(review, "json");

  assert.match(text, /Runtime control boundary audit/);
  assert.match(text, /runtime signal is execution authorization: false/);
  assert.match(text, /upgrade_model is model runtime invocation: false/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
