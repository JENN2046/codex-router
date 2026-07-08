import test from "node:test";
import assert from "node:assert/strict";
import {
  collectDesktopAgentStrategyBoundaryAuditInput,
  formatDesktopAgentStrategyBoundaryAuditResult,
  reviewDesktopAgentStrategyBoundaryAudit
} from "../scripts/run-desktop-agent-strategy-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("desktop agent strategy boundary audit passes for current evidence", async () => {
  const review = reviewDesktopAgentStrategyBoundaryAudit(
    await collectDesktopAgentStrategyBoundaryAuditInput()
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
    review.summary.desktopAgentStrategyMode,
    "agent_assignment_and_ownership_plan_only"
  );
  assert.equal(review.summary.parallelPlanIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.workerAssignmentIsRuntimeInvocation, false);
  assert.equal(review.summary.writeModeIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.ownershipTargetIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.maxAgentsIsSubAgentSpawnAuthorization, false);
  assert.equal(
    review.summary.readOnlyAnalystIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.strategyReasonIsExecutionGate, false);
  assert.equal(review.summary.desktopAgentStrategyCallsDuringAudit, 0);
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

test("desktop agent strategy boundary audit blocks missing governance registration", async () => {
  const input = await collectDesktopAgentStrategyBoundaryAuditInput();
  const review = reviewDesktopAgentStrategyBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "desktop-agent-strategy-boundary",
      "archived-agent-strategy-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit desktop-agent-strategy-boundary",
      "npm run governance -- audit archived-agent-strategy-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_agent_strategy_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "desktop_agent_strategy_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("desktop agent strategy boundary audit blocks missing control-plane authority", async () => {
  const input = await collectDesktopAgentStrategyBoundaryAuditInput();
  const review = reviewDesktopAgentStrategyBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Desktop agent strategy boundary",
      "Archived agent strategy boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_agent_strategy_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("desktop agent strategy boundary audit blocks source and test drift", async () => {
  const input = await collectDesktopAgentStrategyBoundaryAuditInput();
  const review = reviewDesktopAgentStrategyBoundaryAudit({
    ...input,
    desktopAgentStrategySourceText: input.desktopAgentStrategySourceText
      .replaceAll("planAgentStrategy", "runAgentStrategy")
      .replaceAll("write_parallelism_allowed_with_ownership", "write_parallelism_authorized"),
    desktopAgentStrategyTestText: input.desktopAgentStrategyTestText.replaceAll(
      "desktop agent strategy bounds write ownership assignments to files and max agents",
      "desktop agent strategy authorizes write ownership assignments"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_agent_strategy_boundary_sourceMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes("desktop_agent_strategy_boundary_coverageRecorded")
  );
});

test("desktop agent strategy boundary audit blocks runtime invocation markers", async () => {
  const input = await collectDesktopAgentStrategyBoundaryAuditInput();
  const review = reviewDesktopAgentStrategyBoundaryAudit({
    ...input,
    desktopAgentStrategySourceText:
      input.desktopAgentStrategySourceText + "\nspawnSubAgent(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_agent_strategy_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("desktop agent strategy boundary audit formats sanitized text and json", async () => {
  const review = reviewDesktopAgentStrategyBoundaryAudit(
    await collectDesktopAgentStrategyBoundaryAuditInput()
  );
  const text = formatDesktopAgentStrategyBoundaryAuditResult(review);
  const json = formatDesktopAgentStrategyBoundaryAuditResult(review, "json");

  assert.match(text, /Desktop agent strategy boundary audit/);
  assert.match(text, /parallel plan is sub-agent runtime authorization: false/);
  assert.match(text, /workspace-write calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
