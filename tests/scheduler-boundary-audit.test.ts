import test from "node:test";
import assert from "node:assert/strict";
import {
  collectSchedulerBoundaryAuditInput,
  formatSchedulerBoundaryAuditResult,
  reviewSchedulerBoundaryAudit
} from "../scripts/run-scheduler-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("scheduler boundary audit passes for current evidence", async () => {
  const review = reviewSchedulerBoundaryAudit(
    await collectSchedulerBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceSchedulerMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.schedulerMode,
    "queue_and_execution_lease_state_machine_only"
  );
  assert.equal(review.summary.queuedStatusIsDispatchAuthorization, false);
  assert.equal(review.summary.leasedStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.activeLeaseIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.workerIdIsHostOrSubAgentAuthorization, false);
  assert.equal(review.summary.releaseLeaseIsRuntimeCompletionProof, false);
  assert.equal(review.summary.failLeaseIsRecoveryExecution, false);
  assert.equal(review.summary.expiredLeaseIsRetryExecution, false);
  assert.equal(review.summary.exhaustedStatusIsRuntimeBlockExecution, false);
  assert.equal(review.summary.fileStatePersistenceIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.fileLockIsShellProcessExecution, false);
  assert.equal(review.summary.schedulerCallsDuringAudit, 0);
  assert.equal(review.summary.schedulerLeaseAcquisitionsDuringAudit, 0);
  assert.equal(review.summary.schedulerStateWritesDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.hostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.toolRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("scheduler boundary audit blocks missing governance registration", async () => {
  const input = await collectSchedulerBoundaryAuditInput();
  const review = reviewSchedulerBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "scheduler-boundary",
      "queue-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit scheduler-boundary",
      "npm run governance -- audit queue-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("scheduler_boundary_governanceRunnerRegistered"));
  assert.ok(review.reasons.includes("scheduler_boundary_governanceReadmeListsBoundary"));
});

test("scheduler boundary audit blocks missing control-plane authority", async () => {
  const input = await collectSchedulerBoundaryAuditInput();
  const review = reviewSchedulerBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Scheduler boundary",
      "Archived scheduler boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("scheduler_boundary_controlPlaneAuthorityRecorded"));
});

test("scheduler boundary audit blocks source and test drift", async () => {
  const input = await collectSchedulerBoundaryAuditInput();
  const review = reviewSchedulerBoundaryAudit({
    ...input,
    schedulerSourceText: input.schedulerSourceText
      .replaceAll("SchedulerExecutionLeaseSchema", "LeaseRecordSchema")
      .replaceAll("expireLeasesInState", "expireRuntimeLeasesInState"),
    schedulerTestText: input.schedulerTestText.replaceAll(
      "scheduler stops dispatching after maxAttempts is exhausted",
      "scheduler keeps dispatching after maxAttempts is exhausted"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("scheduler_boundary_sourceSchedulerMarkersPresent"));
  assert.ok(review.reasons.includes("scheduler_boundary_coverageRecorded"));
});

test("scheduler boundary audit blocks runtime invocation markers", async () => {
  const input = await collectSchedulerBoundaryAuditInput();
  const review = reviewSchedulerBoundaryAudit({
    ...input,
    schedulerSourceText: input.schedulerSourceText + "\nprovider.execute(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("scheduler_boundary_noRuntimeInvocationSurface"));
});

test("scheduler boundary audit formats sanitized text and json", async () => {
  const review = reviewSchedulerBoundaryAudit(
    await collectSchedulerBoundaryAuditInput()
  );
  const text = formatSchedulerBoundaryAuditResult(review);
  const json = formatSchedulerBoundaryAuditResult(review, "json");

  assert.match(text, /Scheduler boundary audit/);
  assert.match(text, /queued status is dispatch authorization: false/);
  assert.match(text, /scheduler calls during audit: 0/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
