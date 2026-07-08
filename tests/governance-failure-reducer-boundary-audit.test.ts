import test from "node:test";
import assert from "node:assert/strict";
import {
  collectGovernanceFailureReducerBoundaryAuditInput,
  formatGovernanceFailureReducerBoundaryAuditResult,
  reviewGovernanceFailureReducerBoundaryAudit
} from "../scripts/run-governance-failure-reducer-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("governance failure reducer boundary audit passes for current evidence", async () => {
  const review = reviewGovernanceFailureReducerBoundaryAudit(
    await collectGovernanceFailureReducerBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.reducerMarkersPresent, true);
  assert.equal(review.checks.purityMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.failureReducerMode,
    "pure_failure_to_governance_state_reducer_only"
  );
  assert.equal(review.summary.executionFailureIsRecoveryAuthorization, false);
  assert.equal(review.summary.strategyDecisionIsRuntimeAuthorization, false);
  assert.equal(review.summary.arbitrationPacketIsRecoveryExecution, false);
  assert.equal(
    review.summary.recoveryRecommendationIsHostExecutorAuthorization,
    false
  );
  assert.equal(review.summary.anomalyRecordIsRuntimeInvocation, false);
  assert.equal(review.summary.evidenceRefIsReplayAuthorization, false);
  assert.equal(review.summary.riskScoreIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.reducerStateUpdateIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.reducerCallsCallbacksDuringAudit, 0);
  assert.equal(review.summary.reducerPersistenceWritesDuringAudit, 0);
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

test("governance failure reducer boundary audit blocks missing governance registration", async () => {
  const input = await collectGovernanceFailureReducerBoundaryAuditInput();
  const review = reviewGovernanceFailureReducerBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "governance-failure-reducer-boundary",
      "archived-failure-reducer-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit governance-failure-reducer-boundary",
      "npm run governance -- audit archived-failure-reducer-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "governance_failure_reducer_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "governance_failure_reducer_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("governance failure reducer boundary audit blocks missing control-plane authority", async () => {
  const input = await collectGovernanceFailureReducerBoundaryAuditInput();
  const review = reviewGovernanceFailureReducerBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Governance failure reducer boundary",
      "Archived failure reducer boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "governance_failure_reducer_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("governance failure reducer boundary audit blocks source and test drift", async () => {
  const input = await collectGovernanceFailureReducerBoundaryAuditInput();
  const review = reviewGovernanceFailureReducerBoundaryAudit({
    ...input,
    failureReducerSourceText: input.failureReducerSourceText
      .replaceAll("createArbitrationPacket", "createRecoveryPacket")
      .replaceAll("Pure reducer: does not mutate input state", "Reducer"),
    failureReducerTestText: input.failureReducerTestText.replaceAll(
      "reducer does not mutate input state",
      "reducer mutates input state"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "governance_failure_reducer_boundary_reducerMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "governance_failure_reducer_boundary_purityMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "governance_failure_reducer_boundary_coverageRecorded"
    )
  );
});

test("governance failure reducer boundary audit blocks runtime invocation markers", async () => {
  const input = await collectGovernanceFailureReducerBoundaryAuditInput();
  const review = reviewGovernanceFailureReducerBoundaryAudit({
    ...input,
    failureReducerSourceText:
      input.failureReducerSourceText + "\nprovider.execute(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "governance_failure_reducer_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("governance failure reducer boundary audit formats sanitized text and json", async () => {
  const review = reviewGovernanceFailureReducerBoundaryAudit(
    await collectGovernanceFailureReducerBoundaryAuditInput()
  );
  const text = formatGovernanceFailureReducerBoundaryAuditResult(review);
  const json = formatGovernanceFailureReducerBoundaryAuditResult(review, "json");

  assert.match(text, /Governance failure reducer boundary audit/);
  assert.match(text, /execution failure is recovery authorization: false/);
  assert.match(text, /arbitration packet is recovery execution: false/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
