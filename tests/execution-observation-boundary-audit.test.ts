import test from "node:test";
import assert from "node:assert/strict";
import {
  collectExecutionObservationBoundaryAuditInput,
  formatExecutionObservationBoundaryAuditResult,
  reviewExecutionObservationBoundaryAudit
} from "../scripts/run-execution-observation-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("execution observation boundary audit passes for current evidence", async () => {
  const review = reviewExecutionObservationBoundaryAudit(
    await collectExecutionObservationBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceSchemaAndStoreMarkersRecorded, true);
  assert.equal(review.checks.taskScopedRefResolutionRecorded, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.observationMode,
    "sanitized_task_scoped_observation_record_only"
  );
  assert.equal(review.summary.observationStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.succeededObservationIsCompletionAuthorization, false);
  assert.equal(review.summary.failedObservationIsRecoveryAuthorization, false);
  assert.equal(review.summary.evidenceRefIsRuntimeInvocation, false);
  assert.equal(review.summary.observationRefResolutionIsReplayAuthorization, false);
  assert.equal(
    review.summary.observationRecordWriteIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.fileStorePersistenceAllowed, true);
  assert.equal(review.summary.providerExecuteAllowed, false);
  assert.equal(review.summary.codexCliInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.hostDispatchAllowed, false);
  assert.equal(review.summary.shellProcessAllowed, false);
  assert.equal(review.summary.workspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.externalWriteAllowed, false);
  assert.equal(review.summary.observationBusEmitsDuringAudit, 0);
  assert.equal(review.summary.observationStoreWritesDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.hostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("execution observation boundary audit blocks missing governance registration", async () => {
  const input = await collectExecutionObservationBoundaryAuditInput();
  const review = reviewExecutionObservationBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "execution-observation-boundary",
      "archived-observation-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit execution-observation-boundary",
      "npm run governance -- audit archived-observation-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_observation_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_observation_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("execution observation boundary audit blocks missing control-plane authority", async () => {
  const input = await collectExecutionObservationBoundaryAuditInput();
  const review = reviewExecutionObservationBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Execution observation boundary",
      "Archived observation boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_observation_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("execution observation boundary audit blocks missing source and test coverage markers", async () => {
  const input = await collectExecutionObservationBoundaryAuditInput();
  const review = reviewExecutionObservationBoundaryAudit({
    ...input,
    executionObservationSourceText: input.executionObservationSourceText
      .replaceAll("ExecutionObservationStore", "ObservationStore")
      .replaceAll("observation.taskId === taskId", "true"),
    executionObservationTestText: input.executionObservationTestText.replaceAll(
      "execution observation refs do not resolve across colliding file store task paths",
      "archived collision behavior"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_observation_boundary_sourceSchemaAndStoreMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_observation_boundary_taskScopedRefResolutionRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_observation_boundary_failClosedCoverageRecorded"
    )
  );
});

test("execution observation boundary audit blocks runtime invocation markers", async () => {
  const input = await collectExecutionObservationBoundaryAuditInput();
  const review = reviewExecutionObservationBoundaryAudit({
    ...input,
    executionObservationSourceText:
      input.executionObservationSourceText + "\nprovider.execute(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_observation_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("execution observation boundary audit formats sanitized text and json", async () => {
  const review = reviewExecutionObservationBoundaryAudit(
    await collectExecutionObservationBoundaryAuditInput()
  );
  const text = formatExecutionObservationBoundaryAuditResult(review);
  const json = formatExecutionObservationBoundaryAuditResult(review, "json");

  assert.match(text, /Execution observation boundary audit/);
  assert.match(
    text,
    /observation status is execution authorization: false/
  );
  assert.match(text, /observation bus emits during audit: 0/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
