import test from "node:test";
import assert from "node:assert/strict";
import {
  collectTaskGraphBoundaryAuditInput,
  formatTaskGraphBoundaryAuditResult,
  reviewTaskGraphBoundaryAudit
} from "../scripts/run-task-graph-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("task graph boundary audit passes for current evidence", async () => {
  const review = reviewTaskGraphBoundaryAudit(
    await collectTaskGraphBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceGraphMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(review.summary.taskGraphMode, "structural_task_graph_state_only");
  assert.equal(review.summary.nodeStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.graphCompletionIsRuntimeCompletion, false);
  assert.equal(review.summary.dependencyEdgeIsSchedulerDispatch, false);
  assert.equal(review.summary.conflictEdgeIsRuntimeBlockExecution, false);
  assert.equal(review.summary.checkpointNodeIsRollbackExecution, false);
  assert.equal(review.summary.graphDeltaIsWorkspaceRollbackAuthorization, false);
  assert.equal(review.summary.rollbackToCheckpointIsHostExecutorAuthorization, false);
  assert.equal(review.summary.branchMergeIsGitMergeOrWorkspaceWrite, false);
  assert.equal(review.summary.fileStorePersistenceIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.taskGraphCallsDuringAudit, 0);
  assert.equal(review.summary.taskGraphStoreWritesDuringAudit, 0);
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

test("task graph boundary audit blocks missing governance registration", async () => {
  const input = await collectTaskGraphBoundaryAuditInput();
  const review = reviewTaskGraphBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "task-graph-boundary",
      "archived-graph-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit task-graph-boundary",
      "npm run governance -- audit archived-graph-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("task_graph_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("task_graph_boundary_governanceReadmeListsBoundary")
  );
});

test("task graph boundary audit blocks missing control-plane authority", async () => {
  const input = await collectTaskGraphBoundaryAuditInput();
  const review = reviewTaskGraphBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Task graph boundary",
      "Archived graph boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("task_graph_boundary_controlPlaneAuthorityRecorded")
  );
});

test("task graph boundary audit blocks source and test drift", async () => {
  const input = await collectTaskGraphBoundaryAuditInput();
  const review = reviewTaskGraphBoundaryAudit({
    ...input,
    taskGraphSourceText: input.taskGraphSourceText
      .replaceAll("TaskGraphDeltaSchema", "GraphDeltaSchema")
      .replaceAll("rollbackToCheckpoint", "restoreCheckpoint"),
    taskGraphTestText: input.taskGraphTestText.replaceAll(
      "task-graph: rollbackToCheckpoint restores graph state",
      "task-graph: restoreCheckpoint restores graph state"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("task_graph_boundary_sourceGraphMarkersPresent")
  );
  assert.ok(review.reasons.includes("task_graph_boundary_coverageRecorded"));
});

test("task graph boundary audit blocks runtime invocation markers", async () => {
  const input = await collectTaskGraphBoundaryAuditInput();
  const review = reviewTaskGraphBoundaryAudit({
    ...input,
    taskGraphSourceText: input.taskGraphSourceText + "\nprovider.execute(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("task_graph_boundary_noRuntimeInvocationSurface")
  );
});

test("task graph boundary audit formats sanitized text and json", async () => {
  const review = reviewTaskGraphBoundaryAudit(
    await collectTaskGraphBoundaryAuditInput()
  );
  const text = formatTaskGraphBoundaryAuditResult(review);
  const json = formatTaskGraphBoundaryAuditResult(review, "json");

  assert.match(text, /Task graph boundary audit/);
  assert.match(text, /node status is execution authorization: false/);
  assert.match(text, /task graph calls during audit: 0/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
