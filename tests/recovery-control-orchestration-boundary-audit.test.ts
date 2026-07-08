import test from "node:test";
import assert from "node:assert/strict";
import {
  collectRecoveryControlOrchestrationBoundaryAuditInput,
  formatRecoveryControlOrchestrationBoundaryAuditResult,
  reviewRecoveryControlOrchestrationBoundaryAudit
} from "../scripts/run-recovery-control-orchestration-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("recovery control orchestration boundary audit passes for current evidence", async () => {
  const review = reviewRecoveryControlOrchestrationBoundaryAudit(
    await collectRecoveryControlOrchestrationBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.orchestrationMarkersPresent, true);
  assert.equal(review.checks.phaseCoverageRecorded, true);
  assert.equal(review.checks.noGlobalRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.recoveryControlMode,
    "schemas_packets_reviews_and_explicit_injected_witnesses_only"
  );
  assert.equal(review.summary.schemaStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.executionPlanIsRecoveryExecutionAuthorization, false);
  assert.equal(review.summary.executionGateIsRuntimeAuthorization, false);
  assert.equal(review.summary.hostExecutorReviewIsHostDispatchAuthorization, false);
  assert.equal(
    review.summary.dispatchAuthorizationReviewIsAdapterInvocationAuthorization,
    false
  );
  assert.equal(review.summary.taskControlReviewIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.sandboxWitnessIsProductionRecoveryExecution, false);
  assert.equal(review.summary.receiptStatusIsCompletionAuthorization, false);
  assert.equal(review.summary.recoveryRecommendationIsHostExecutorAuthorization, false);
  assert.equal(review.summary.recoveryControlCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
  assert.equal(review.summary.adapterInvocationsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("recovery control orchestration boundary audit blocks missing governance registration", async () => {
  const input = await collectRecoveryControlOrchestrationBoundaryAuditInput();
  const review = reviewRecoveryControlOrchestrationBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "recovery-control-orchestration-boundary",
      "recovery-control-runtime-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit recovery-control-orchestration-boundary",
      "npm run governance -- audit recovery-control-runtime-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "recovery_control_orchestration_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "recovery_control_orchestration_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("recovery control orchestration boundary audit blocks missing control-plane authority", async () => {
  const input = await collectRecoveryControlOrchestrationBoundaryAuditInput();
  const review = reviewRecoveryControlOrchestrationBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Recovery control orchestration boundary",
      "Archived recovery control boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "recovery_control_orchestration_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("recovery control orchestration boundary audit blocks source and test drift", async () => {
  const input = await collectRecoveryControlOrchestrationBoundaryAuditInput();
  const review = reviewRecoveryControlOrchestrationBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText
      .replaceAll("planGovernanceOperatorActionExecution", "runRecoveryExecution")
      .replaceAll(
        "reviewGovernanceOperatorActionAgentTaskControlDispatchAuthorization",
        "executeGovernanceOperatorActionAgentTaskControlDispatch"
      ),
    phase18SandboxTestText: input.phase18SandboxTestText.replaceAll(
      "phase18 task-control sandbox dry-run rejects phase15 sandbox reference adapter kind",
      "phase18 task-control sandbox dry-run accepts phase15 sandbox reference adapter kind"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "recovery_control_orchestration_boundary_orchestrationMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "recovery_control_orchestration_boundary_phaseCoverageRecorded"
    )
  );
});

test("recovery control orchestration boundary audit blocks global runtime markers", async () => {
  const input = await collectRecoveryControlOrchestrationBoundaryAuditInput();
  const review = reviewRecoveryControlOrchestrationBoundaryAudit({
    ...input,
    recoveryControlSourceText:
      input.recoveryControlSourceText + "\nprovider.execute(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "recovery_control_orchestration_boundary_noGlobalRuntimeInvocationSurface"
    )
  );
});

test("recovery control orchestration boundary audit formats sanitized text and json", async () => {
  const review = reviewRecoveryControlOrchestrationBoundaryAudit(
    await collectRecoveryControlOrchestrationBoundaryAuditInput()
  );
  const text = formatRecoveryControlOrchestrationBoundaryAuditResult(review);
  const json = formatRecoveryControlOrchestrationBoundaryAuditResult(review, "json");

  assert.match(text, /Recovery control orchestration boundary audit/);
  assert.match(text, /schema status is execution authorization: false/);
  assert.match(text, /recovery control calls during audit: 0/);
  assert.match(text, /adapter invocations during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
